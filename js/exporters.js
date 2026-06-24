/* exporters.js — save the comparison as a PNG figure, save / open a project
   file, and export the annotation markers as JSON or CSV. */

MC.Exporters = (function () {
  const S = MC.state;

  function drawPins(ctx, viewer, slot, dx, dy, cw) {
    if (!viewer || !viewer.element) return;
    const dpr = cw / viewer.element.clientWidth;
    const r = Math.max(11, cw * 0.013);
    S.annotations.forEach((a, idx) => {
      if (a.slot !== slot) return;
      const pt = viewer.viewport.pixelFromPoint(new OpenSeadragon.Point(a.x, a.y), true);
      const x = dx + pt.x * dpr, y = dy + pt.y * dpr;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = '#f6f2e9'; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = '#221d14'; ctx.stroke();
      ctx.fillStyle = '#7e2c19'; ctx.font = '500 ' + Math.round(r * 1.0) + 'px "Plex Mono", monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(idx + 1), x, y);
    });
  }

  function snapshotCanvas() {
    const panes = Array.from(document.querySelectorAll('#viewers .pane'));
    const cells = panes.map((p, i) => ({ pane: p, idx: i, canvas: p.querySelector('canvas') })).filter(c => c.canvas);
    if (!cells.length) return null;
    const cw = cells[0].canvas.width, ch = cells[0].canvas.height;
    const gap = Math.max(6, Math.round(cw * 0.012));
    let cols = cells.length, rows = 1;
    if (S.view === 'grid') { cols = 2; rows = 2; }
    else if (S.view === 'overlay') { cols = 1; rows = 1; }
    const out = document.createElement('canvas');
    out.width = cols * cw + (cols - 1) * gap;
    out.height = rows * ch + (rows - 1) * gap;
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, out.width, out.height);
    cells.forEach((cell, idx) => {
      const pos = S.view === 'grid' ? cell.idx : idx;
      const col = pos % cols, row = Math.floor(pos / cols);
      const dx = col * (cw + gap), dy = row * (ch + gap);
      try { ctx.drawImage(cell.canvas, dx, dy, cw, ch); } catch (e) {}
      const viewer = S.view === 'overlay'
        ? S.overlayViewer
        : S.viewers.find(v => v.element && v.element.closest('.pane') === cell.pane);
      const slot = viewer ? (viewer._slot != null ? viewer._slot : 0) : 0;
      try { drawPins(ctx, viewer, slot, dx, dy, cw); } catch (e) {}
    });
    return out;
  }

  function savePNG() {
    const out = snapshotCanvas();
    if (!out) { MC.util.toast('Load an image first.'); return; }
    try {
      out.toBlob(blob => {
        if (!blob) { MC.util.toast('Export blocked: a remote image did not allow copying (CORS).'); return; }
        MC.util.download('mirl-collate.png', blob);
      }, 'image/png');
    } catch (e) {
      MC.util.toast('Export blocked: a remote image did not allow copying (CORS).');
    }
  }

  function projectJSON() {
    return JSON.stringify({
      tool: 'mirl-collate', version: 1, savedAt: new Date().toISOString(),
      view: S.view, sync: S.sync,
      overlay: { mode: S.overlay.mode, split: S.overlay.split, opacity: S.overlay.opacity, blinkMs: S.overlay.blinkMs || 900 },
      slots: S.slots.map(s => ({
        source: s.source && (s.source.kind === 'file'
          ? { kind: 'file', name: s.source.name }
          : { kind: s.source.kind, url: s.source.url, name: s.source.name }),
        meta: s.meta,
      })),
      annotations: S.annotations,
    }, null, 2);
  }
  function saveProject() {
    MC.util.downloadText('mirl-collate-project.json', projectJSON(), 'application/json');
  }

  async function loadProject(obj) {
    if (!obj || obj.tool !== 'mirl-collate') { MC.util.toast('That is not a MIRL Collate project file.'); return; }
    S.view = obj.view || 'side';
    S.sync = obj.sync !== false;
    Object.assign(S.overlay, obj.overlay || {});
    S.annotations = (obj.annotations || []).map(a => Object.assign({ label: '', note: '' }, a));
    S.annoSeq = S.annotations.length;
    let needFiles = false;
    for (let i = 0; i < 4; i++) {
      const sl = obj.slots && obj.slots[i];
      S.slots[i] = newSlot(i);
      if (!sl) continue;
      if (sl.meta) Object.assign(S.slots[i].meta, sl.meta);
      if (sl.source) {
        if (sl.source.kind === 'file') {
          needFiles = true;
          S.slots[i].source = { kind: 'file', name: sl.source.name, objectUrl: null };
        } else {
          S.slots[i].source = sl.source;
          try { S.slots[i].tileSource = await MC.Viewers.makeTileSource(sl.source); } catch (e) {}
        }
      }
    }
    MC.App.syncControls();
    MC.Viewers.rebuild();
    MC.App.refreshSidebar();
    MC.util.toast(needFiles ? 'Project loaded. Re-load any local image files (their details are kept).' : 'Project loaded.');
  }
  function openProjectFile(file) {
    const r = new FileReader();
    r.onload = () => { try { loadProject(JSON.parse(r.result)); } catch (e) { MC.util.toast('Could not read that project file.'); } };
    r.readAsText(file);
  }

  function exportAnno(kind) {
    if (!S.annotations.length) { MC.util.toast('No markers to export.'); return; }
    if (kind === 'csv') MC.util.downloadText('mirl-collate-annotations.csv', MC.Annotations.toCSV(), 'text/csv');
    else MC.util.downloadText('mirl-collate-annotations.json', MC.Annotations.toJSON(), 'application/json');
  }

  return { savePNG, saveProject, openProjectFile, exportAnno, snapshotCanvas };
})();
