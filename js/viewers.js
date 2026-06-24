/* viewers.js — namespace, shared state, and the OpenSeadragon panes.
   Handles image / IIIF loading, the side-by-side and grid layouts, and the
   linked pan-and-zoom that keeps every frame looking at the same spot. */

window.MC = window.MC || {};

/* ---------- tiny DOM + misc helpers ---------- */
MC.util = {
  h(tag, props, ...kids) {
    const e = document.createElement(tag);
    if (props) for (const k in props) {
      const v = props[k];
      if (v == null) continue;
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
      else e.setAttribute(k, v);
    }
    for (const c of kids) {
      if (c == null || c === false) continue;
      e.append(c.nodeType ? c : document.createTextNode(c));
    }
    return e;
  },
  toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(MC._tt); MC._tt = setTimeout(() => t.classList.remove('show'), 1900);
  },
  download(name, blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  },
  downloadText(name, text, type = 'text/plain') { this.download(name, new Blob([text], { type })); },
};

/* ---------- state ---------- */
function newSlot(i) {
  return {
    i, source: null, tileSource: null, ready: false,
    meta: { label: '', creator: '', date: '', repository: '', accession: '', rights: '', sourceUrl: '' },
  };
}
MC.state = {
  view: 'side',          // 'side' | 'grid' | 'overlay'
  sync: true,
  annotate: false,
  slots: [newSlot(0), newSlot(1), newSlot(2), newSlot(3)],
  viewers: [],           // active OSD viewers for side / grid
  overlayViewer: null,   // single OSD viewer for overlay mode
  overlay: { mode: 'curtain', split: 0.5, opacity: 0.5 },
  annotations: [],       // { id, slot, x, y, label, note }  x,y in viewport coords
  annoSeq: 0,
};

MC.Viewers = (function () {
  const S = MC.state;
  const IMG_EXT = /\.(jpe?g|png|gif|webp|bmp|tiff?|avif|svg)(\?|#|$)/i;

  /* ----- turn a user source into an OpenSeadragon tile source ----- */
  function serviceId(service) {
    const s = Array.isArray(service) ? service[0] : service;
    return s && (s.id || s['@id']) || null;
  }
  function infoUrl(base) {
    if (!base) return null;
    return /info\.json$/.test(base) ? base : base.replace(/\/$/, '') + '/info.json';
  }
  function isImageInfo(data) {
    if (!data || typeof data !== 'object') return false;
    const ctx = [].concat(data['@context'] || []).join(' ');
    return data.protocol === 'http://iiif.io/api/image' || /image\/[123]/.test(ctx) ||
      !!(data.width && (data.sizes || data.tiles || data.height));
  }
  function manifestImage(data) {
    // from a IIIF Presentation manifest (v2 or v3): the image service and/or a
    // static image for the first canvas. Returns { service, image } or null.
    const type = data.type || data['@type'] || '';
    if (!/Manifest/.test(type)) return null;
    const canvas = (data.items && data.items[0]) ||
      (data.sequences && data.sequences[0] && data.sequences[0].canvases && data.sequences[0].canvases[0]);
    if (!canvas) return null;
    let body = null;
    if (canvas.items) {
      const ap = canvas.items[0]; const anno = ap && ap.items && ap.items[0];
      body = anno && anno.body;
    } else if (canvas.images) {
      body = canvas.images[0] && canvas.images[0].resource;
    }
    if (!body) return null;
    return { service: infoUrl(serviceId(body.service)), image: body.id || body['@id'] || null };
  }
  // Map a few well-known collection *pages* to their IIIF manifest, so pasting
  // the page a curator is actually looking at just works. Extend as needed.
  function mapKnownPage(url) {
    let m;
    if ((m = url.match(/collections\.britishart\.yale\.edu\/catalog\/tms:(\d+)/i)))
      return 'https://manifests.collections.yale.edu/ycba/obj/' + m[1];   // Yale Center for British Art
    return null;
  }
  async function tryJson(u) {
    try { const r = await fetch(u, { mode: 'cors' }); if (!r.ok) return null; return await r.json(); }
    catch (e) { return null; }
  }
  async function fromUrl(rawUrl) {
    const url = mapKnownPage(rawUrl) || rawUrl;
    if (IMG_EXT.test(url)) return { type: 'image', url };
    const looksIIIF = url !== rawUrl || /(\.json)(\?|#|$)|\/manifest|\/iiif\//i.test(url);
    // read the address as JSON; if that is not JSON, try <base>/info.json
    let data = await tryJson(url);
    if (!data && !/info\.json$/i.test(url)) data = await tryJson(infoUrl(url));
    if (data) {
      if (isImageInfo(data)) return data;                         // a IIIF Image API info.json
      const mi = manifestImage(data);
      if (mi) {
        if (mi.service) {
          const info = await tryJson(mi.service);                 // confirm the deep-zoom service is live
          if (isImageInfo(info)) return info;
        }
        if (mi.image) return { type: 'image', url: mi.image };    // fall back to the full image
      }
    }
    // a JSON/IIIF address we could not read is almost always a CORS block.
    if (looksIIIF) {
      throw new Error('Could not read this IIIF source. The server may block cross-origin access (CORS), which is required to use it here. Try the object’s IIIF manifest or info.json link.');
    }
    return { type: 'image', url };
  }
  async function makeTileSource(source) {
    if (!source) return null;
    if (source.kind === 'file') return { type: 'image', url: source.objectUrl };
    return fromUrl(source.url);
  }

  /* ----- panes: each image is a numbered plate, captioned beneath ----- */
  const ROMAN = ['I', 'II', 'III', 'IV'];
  function paneName(i) {
    const s = S.slots[i];
    if (s.meta.label) return s.meta.label;
    if (s.source && s.source.name) return s.source.name;
    if (s.source && s.source.url) return s.source.url.split('/').pop() || s.source.url;
    return 'Image ' + (i + 1);
  }
  function makePane(i) {
    const osd = MC.util.h('div', { class: 'osd', id: 'osd-' + i });
    const wrap = MC.util.h('div', { class: 'osd-wrap' }, osd);
    const nameEl = MC.util.h('span', { class: 'name' }, paneName(i));
    const cap = MC.util.h('div', { class: 'pane-cap' },
      MC.util.h('span', { class: 'plate' }, 'Plate ' + ROMAN[i]),
      nameEl,
      MC.util.h('span', { class: 'cap-actions' },
        MC.util.h('button', { title: 'Load an image here', onclick: () => MC.App.loadDialog(i) }, 'Load'),
        MC.util.h('button', { title: 'Edit details', onclick: () => MC.App.focusSlot(i) }, 'Details')));
    const pane = MC.util.h('div', { class: 'pane' }, wrap, cap);
    // drag and drop a file onto the plate
    pane.addEventListener('dragover', e => { e.preventDefault(); pane.classList.add('drop'); });
    pane.addEventListener('dragleave', () => pane.classList.remove('drop'));
    pane.addEventListener('drop', e => {
      e.preventDefault(); pane.classList.remove('drop');
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) MC.App.loadFile(i, f);
    });
    return { el: pane, osd, wrap, nameEl };
  }
  function emptyPane(pane, i) {
    pane.wrap.append(MC.util.h('div', { class: 'empty-pane' },
      MC.util.h('div', { class: 'big' }, '⧉'),
      MC.util.h('div', null, 'Drop an image here, or'),
      MC.util.h('button', { class: 'btn stamp', onclick: () => MC.App.loadDialog(i) }, 'Load image')));
  }

  function makeViewer(osdEl, tileSource, slotIndex) {
    const pane = osdEl.parentElement;
    const loading = MC.util.h('div', { class: 'pane-loading' }, 'Loading…');
    if (pane) pane.appendChild(loading);
    const viewer = OpenSeadragon({
      element: osdEl,
      tileSources: tileSource,
      crossOriginPolicy: 'Anonymous',
      showNavigationControl: false,
      showNavigator: false,
      visibilityRatio: 0.5,
      minZoomImageRatio: 0.3,
      maxZoomPixelRatio: 12,
      animationTime: 0.4,
      gestureSettingsMouse: { clickToZoom: false, dblClickToZoom: true },
    });
    viewer._slot = slotIndex;
    let tileFails = 0;
    viewer.addHandler('open', () => {
      S.slots[slotIndex].ready = true;
      const item = viewer.world.getItemAt(0);
      if (item) S.slots[slotIndex].pixel = item.getContentSize();
      MC.Annotations.renderFor(viewer, slotIndex);
    });
    // keep the spinner up until pixels actually paint (big IIIF images tile in
    // for several seconds after the info.json is ready)
    const clearLoading = () => { loading.remove(); viewer.removeHandler('tile-drawn', clearLoading); };
    viewer.addHandler('tile-drawn', clearLoading);
    viewer.addHandler('open-failed', () => {
      loading.remove();
      const iiif = S.slots[slotIndex].source && S.slots[slotIndex].source.kind === 'iiif';
      if (pane) pane.appendChild(MC.util.h('div', { class: 'pane-error' },
        MC.util.h('div', null, 'This image could not be loaded.'),
        MC.util.h('div', { class: 'pane-error-hint' },
          iiif ? 'The IIIF server may not allow cross-origin access (CORS), which is required to read it here.'
               : 'Check the address, or try a direct image or IIIF link.')));
      MC.util.toast('Image ' + (slotIndex + 1) + ' did not load.');
    });
    viewer.addHandler('tile-load-failed', () => {
      if (++tileFails === 4) MC.util.toast('Some tiles were blocked. The image server may not allow cross-origin (CORS) use.');
    });
    viewer.addHandler('canvas-click', e => {
      if (!S.annotate || !e.quick) return;
      e.preventDefaultAction = true;
      const vpt = viewer.viewport.pointFromPixel(e.position);
      MC.Annotations.add(slotIndex, vpt.x, vpt.y);
    });
    viewer.addHandler('zoom', () => relay(viewer));
    viewer.addHandler('pan', () => relay(viewer));
    return viewer;
  }

  /* ----- linked pan & zoom ----- */
  const EPS = 1e-6;
  let syncing = false;
  function relay(src) {
    if (syncing || !S.sync || S.view === 'overlay') return;
    syncing = true;
    const z = src.viewport.getZoom();
    /* centre as a fraction of the source image, so panning lands on the same
       relative point even when the two images differ in size or aspect */
    let frac = null;
    const srcItem = src.world.getItemCount() ? src.world.getItemAt(0) : null;
    if (srcItem) {
      const ip = srcItem.viewportToImageCoordinates(src.viewport.getCenter());
      const sz = srcItem.getContentSize();
      if (sz.x && sz.y) frac = { x: ip.x / sz.x, y: ip.y / sz.y };
    }
    for (const v of S.viewers) {
      if (v === src || !v.world.getItemCount()) continue;
      if (Math.abs(v.viewport.getZoom() - z) > EPS) v.viewport.zoomTo(z, null, true);
      if (frac) {
        const item = v.world.getItemAt(0);
        const tsz = item.getContentSize();
        const target = item.imageToViewportCoordinates(frac.x * tsz.x, frac.y * tsz.y);
        const tc = v.viewport.getCenter();
        if (Math.abs(tc.x - target.x) > EPS || Math.abs(tc.y - target.y) > EPS) v.viewport.panTo(target, true);
      }
    }
    syncing = false;
  }

  /* ----- (re)build the layout ----- */
  function destroy() {
    if (S.overlay && S.overlay._blink) { clearInterval(S.overlay._blink); S.overlay._blink = null; }
    for (const v of S.viewers) try { v.destroy(); } catch (e) {}
    S.viewers = [];
    if (S.overlayViewer) { try { S.overlayViewer.destroy(); } catch (e) {} S.overlayViewer = null; }
    document.getElementById('viewers').innerHTML = '';
  }
  function rebuild() {
    destroy();
    const container = document.getElementById('viewers');
    container.className = 'viewers ' + S.view;
    if (S.view === 'overlay') { MC.Overlay.build(container); return; }
    const n = S.view === 'grid' ? 4 : 2;
    for (let i = 0; i < n; i++) {
      const pane = makePane(i);
      container.appendChild(pane.el);
      const slot = S.slots[i];
      if (slot.tileSource) S.viewers.push(makeViewer(pane.osd, slot.tileSource, i));
      else emptyPane(pane, i);
    }
  }

  function resetView() {
    for (const v of S.viewers) if (v.world.getItemCount()) v.viewport.goHome(true);
    if (S.overlayViewer && S.overlayViewer.world.getItemCount()) S.overlayViewer.viewport.goHome(true);
  }

  async function setSource(i, source) {
    S.slots[i].source = source;
    S.slots[i].ready = false;
    try {
      S.slots[i].tileSource = await makeTileSource(source);
    } catch (e) {
      S.slots[i].tileSource = null;
      rebuild();
      MC.App.refreshSidebar();
      MC.util.toast(e && e.message ? e.message : 'Could not read that source.');
      return;
    }
    if (!S.slots[i].meta.label && source.name) S.slots[i].meta.label = source.name.replace(/\.[^.]+$/, '');
    if (!S.slots[i].meta.accessed) S.slots[i].meta.accessed = new Date().toISOString().slice(0, 10);
    rebuild();
    MC.App.refreshSidebar();
  }

  return { rebuild, resetView, setSource, destroy, makeTileSource, paneName, relay };
})();
