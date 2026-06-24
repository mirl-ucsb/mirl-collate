/* overlay.js — overlay mode: one viewer, two stacked images, four ways to
   read the difference between them (curtain swipe, onion skin, blink, and a
   pixel difference). Base is image 1, top is image 2. */

MC.Overlay = (function () {
  const S = MC.state;
  let dividerWired = false;

  function topItem() {
    const v = S.overlayViewer;
    return v && v.world.getItemCount() > 1 ? v.world.getItemAt(v.world.getItemCount() - 1) : null;
  }

  function build(container) {
    const osd = MC.util.h('div', { class: 'osd' });
    const wrap = MC.util.h('div', { class: 'osd-wrap' }, osd);
    const cap = MC.util.h('div', { class: 'pane-cap' },
      MC.util.h('span', { class: 'plate' }, 'Plates I · II'),
      MC.util.h('span', { class: 'name' }, 'Base: ' + MC.Viewers.paneName(0) + '  ·  Top: ' + MC.Viewers.paneName(1)));
    const pane = MC.util.h('div', { class: 'pane' }, wrap, cap);
    container.appendChild(pane);

    const slotA = S.slots[0], slotB = S.slots[1];
    if (!slotA.tileSource || !slotB.tileSource) {
      wrap.append(MC.util.h('div', { class: 'empty-pane' },
        MC.util.h('div', { class: 'big' }, '⧉'),
        MC.util.h('div', null, 'Overlay needs two images.'),
        MC.util.h('div', { class: 'hint' }, 'Load image 1 (the base) and image 2 (laid on top) in the Images panel.')));
      document.getElementById('stage').classList.remove('curtain-on');
      return;
    }

    const viewer = OpenSeadragon({
      element: osd, crossOriginPolicy: 'Anonymous',
      showNavigationControl: false, showNavigator: false,
      visibilityRatio: 0.5, minZoomImageRatio: 0.3, maxZoomPixelRatio: 12, animationTime: 0.4,
      gestureSettingsMouse: { clickToZoom: false, dblClickToZoom: true },
    });
    S.overlayViewer = viewer;
    const loading = MC.util.h('div', { class: 'pane-loading' }, 'Loading…');
    wrap.appendChild(loading);
    const clearLoading = () => { loading.remove(); viewer.removeHandler('tile-drawn', clearLoading); };
    viewer.addHandler('tile-drawn', clearLoading);
    viewer.addTiledImage({
      tileSource: slotA.tileSource, x: 0, y: 0, width: 1, index: 0,
      success: () => MC.Annotations.renderFor(viewer, 0),
    });
    viewer.addTiledImage({
      tileSource: slotB.tileSource, x: 0, y: 0, width: 1, index: 1,
      success: () => applyMode(),
    });
    viewer.addHandler('canvas-click', e => {
      if (!S.annotate || !e.quick) return;
      e.preventDefaultAction = true;
      const vpt = viewer.viewport.pointFromPixel(e.position);
      MC.Annotations.add(0, vpt.x, vpt.y);
    });
    viewer.addHandler('update-viewport', () => { if (S.overlay.mode === 'curtain') applyCurtain(); });
    viewer.addHandler('open-failed', () => MC.util.toast('An overlay image failed to load.'));
    wireDivider();
    applyMode();
  }

  function clearBlink() {
    if (S.overlay._blink) { clearInterval(S.overlay._blink); S.overlay._blink = null; }
  }

  function applyMode() {
    const top = topItem();
    const stage = document.getElementById('stage');
    stage.classList.toggle('curtain-on', S.view === 'overlay' && S.overlay.mode === 'curtain');
    if (!top) return;
    clearBlink();
    top.setClip(null);
    top.setCompositeOperation(null);
    top.setOpacity(1);
    applyGain();

    if (S.overlay.mode === 'curtain') {
      applyCurtain();
    } else if (S.overlay.mode === 'onion') {
      top.setOpacity(S.overlay.opacity);
    } else if (S.overlay.mode === 'diff') {
      top.setCompositeOperation('difference');
    } else if (S.overlay.mode === 'blink') {
      let on = true;
      top.setOpacity(1);
      S.overlay._blink = setInterval(() => { on = !on; top.setOpacity(on ? 1 : 0); }, S.overlay.blinkMs || 900);
    }
  }

  /* screen-fixed curtain: recompute the image clip from the divider column. */
  function applyCurtain() {
    const top = topItem(); if (!top) return;
    const v = S.overlayViewer;
    const w = v.container.clientWidth, h = v.container.clientHeight;
    const px = S.overlay.split * w;
    const p = top.viewerElementToImageCoordinates(new OpenSeadragon.Point(px, h / 2));
    const size = top.getContentSize();
    const x = Math.max(0, Math.min(size.x, p.x));
    top.setClip(new OpenSeadragon.Rect(x, 0, Math.max(0, size.x - x), size.y));
  }

  function wireDivider() {
    const curtain = document.getElementById('curtain');
    const stage = document.getElementById('stage');
    curtain.style.left = (S.overlay.split * 100) + '%';
    if (dividerWired) return;
    dividerWired = true;
    let dragging = false;
    const move = e => {
      if (!dragging) return;
      const r = stage.getBoundingClientRect();
      const cx = (e.touches ? e.touches[0].clientX : e.clientX);
      S.overlay.split = Math.max(0.02, Math.min(0.98, (cx - r.left) / r.width));
      curtain.style.left = (S.overlay.split * 100) + '%';
      applyCurtain();
      e.preventDefault();
    };
    const up = () => { dragging = false; };
    curtain.addEventListener('pointerdown', e => { dragging = true; e.preventDefault(); });
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  /* difference mode is near-black on similar images; a brightness gain on the
     composited canvas makes the difference legible without altering the pixels */
  function diffCanvas() {
    const v = S.overlayViewer;
    return v && v.element ? v.element.querySelector('canvas') : null;
  }
  function applyGain() {
    const cv = diffCanvas(); if (!cv) return;
    const g = (S.view === 'overlay' && S.overlay.mode === 'diff') ? (S.overlay.diffGain || 1) : 1;
    cv.style.filter = g > 1 ? 'brightness(' + g + ')' : '';
  }

  function setMode(mode) { S.overlay.mode = mode; applyMode(); }
  function setOpacity(v) { S.overlay.opacity = v; if (S.overlay.mode === 'onion') applyMode(); }
  function setBlinkMs(ms) { S.overlay.blinkMs = ms; if (S.overlay.mode === 'blink') applyMode(); }
  function setDiffGain(v) { S.overlay.diffGain = v; applyGain(); }

  return { build, applyMode, applyCurtain, setMode, setOpacity, setBlinkMs, setDiffGain };
})();
