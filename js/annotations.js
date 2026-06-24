/* annotations.js — numbered markers pinned to the image in viewport
   coordinates, so they ride along as you zoom and pan. */

MC.Annotations = (function () {
  const S = MC.state;

  function viewerForSlot(slot) {
    if (S.view === 'overlay') return slot === 0 ? S.overlayViewer : null;
    return S.viewers.find(v => v._slot === slot) || null;
  }
  function pinEl(n, id) {
    const el = MC.util.h('div', { class: 'pin', title: 'Marker ' + n }, MC.util.h('span', null, String(n)));
    el.addEventListener('click', ev => { ev.stopPropagation(); MC.App.openTab('anno'); flash(id); });
    return el;
  }

  function renderFor(viewer, slot) {
    if (!viewer) return;
    viewer.clearOverlays();
    S.annotations.forEach((a, idx) => {
      if (a.slot !== slot) return;
      viewer.addOverlay({
        element: pinEl(idx + 1, a.id),
        location: new OpenSeadragon.Point(a.x, a.y),
        placement: OpenSeadragon.Placement.CENTER,
      });
    });
  }
  function renderAll() {
    if (S.view === 'overlay') renderFor(S.overlayViewer, 0);
    else for (const v of S.viewers) renderFor(v, v._slot);
  }

  function add(slot, x, y) {
    S.annotations.push({ id: 'a' + (++S.annoSeq), slot, x, y, label: '', note: '' });
    renderFor(viewerForSlot(slot), slot);
    list();
    MC.App.openTab('anno');
  }
  function remove(id) {
    S.annotations = S.annotations.filter(a => a.id !== id);
    renderAll();
    list();
  }
  function locate(a) {
    const v = viewerForSlot(a.slot);
    if (!v || !v.world.getItemCount()) return;
    v.viewport.panTo(new OpenSeadragon.Point(a.x, a.y), false);
    v.viewport.zoomTo(Math.max(v.viewport.getZoom(), 2.5), new OpenSeadragon.Point(a.x, a.y));
  }
  function flash(id) {
    const row = document.querySelector('.anno-item[data-id="' + id + '"]');
    if (row) { row.style.outline = '2px solid var(--accent)'; setTimeout(() => row.style.outline = '', 900); row.scrollIntoView({ block: 'nearest' }); }
  }

  function list() {
    const box = document.getElementById('anno-list');
    const empty = document.getElementById('anno-empty');
    box.innerHTML = '';
    empty.style.display = S.annotations.length ? 'none' : 'block';
    S.annotations.forEach((a, idx) => {
      const labelInput = MC.util.h('input', { type: 'text', placeholder: 'Short label', value: a.label });
      labelInput.addEventListener('input', () => a.label = labelInput.value);
      const noteInput = MC.util.h('input', { type: 'text', placeholder: 'Note', value: a.note });
      noteInput.addEventListener('input', () => a.note = noteInput.value);
      const num = MC.util.h('div', { class: 'num', title: 'Go to marker' }, String(idx + 1));
      num.addEventListener('click', () => locate(a));
      box.append(MC.util.h('div', { class: 'anno-item', 'data-id': a.id },
        num,
        MC.util.h('div', { class: 'grow' }, labelInput, noteInput,
          MC.util.h('div', { class: 'meta' }, 'on ' + MC.Viewers.paneName(a.slot))),
        MC.util.h('button', { class: 'x', title: 'Delete marker', onclick: () => remove(a.id) }, '×')));
    });
    // pixel distance between consecutive markers placed on the same image
    if (S.annotations.length >= 2) {
      const dl = MC.util.h('div', { class: 'anno-dist' });
      dl.append(MC.util.h('div', { class: 'anno-dist-head' }, 'Distance, image pixels'));
      for (let i = 1; i < S.annotations.length; i++) {
        const d = pixelDist(S.annotations[i - 1], S.annotations[i]);
        const val = d == null ? 'different images' : d.toLocaleString() + ' px';
        dl.append(MC.util.h('div', { class: 'anno-dist-row' },
          i + ' → ' + (i + 1) + '  ', MC.util.h('span', { class: 'd' }, val)));
      }
      box.append(dl);
    }
  }

  /* straight-line distance between two markers in the image's own pixels;
     null when they sit on different images or the image size is unknown */
  function pixelDist(a, b) {
    if (a.slot !== b.slot) return null;
    const slot = S.slots[a.slot];
    const W = slot && slot.pixel ? slot.pixel.x : null;
    if (!W) return null;
    return Math.round(W * Math.hypot(b.x - a.x, b.y - a.y));
  }

  function rows() {
    return S.annotations.map((a, idx) => {
      const slot = S.slots[a.slot];
      const W = slot.pixel ? slot.pixel.x : null;
      return {
        marker: idx + 1,
        image: MC.Viewers.paneName(a.slot),
        label: a.label, note: a.note,
        viewport_x: +a.x.toFixed(5), viewport_y: +a.y.toFixed(5),
        pixel_x: W ? Math.round(a.x * W) : '', pixel_y: W ? Math.round(a.y * W) : '',
      };
    });
  }
  function toJSON() { return JSON.stringify(rows(), null, 2); }
  function toCSV() {
    const r = rows();
    const cols = ['marker', 'image', 'label', 'note', 'viewport_x', 'viewport_y', 'pixel_x', 'pixel_y'];
    const esc = v => '"' + String(v).replace(/"/g, '""') + '"';
    return [cols.join(',')].concat(r.map(row => cols.map(c => esc(row[c])).join(','))).join('\n');
  }

  return { add, remove, renderFor, renderAll, list, toJSON, toCSV };
})();
