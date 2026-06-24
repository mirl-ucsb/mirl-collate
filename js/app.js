/* app.js — user interface wiring: toolbar, sidebar cards, tabs, file dialogs,
   citation panel, export menu, keyboard. Loaded last. */

MC.App = (function () {
  const S = MC.state;
  let fileTarget = 0;
  let citeText = '';

  /* ---------- sidebar: image cards ---------- */
  function metaField(slot, key, label, ph) {
    const input = MC.util.h('input', { type: 'text', value: slot.meta[key] || '', placeholder: ph || '' });
    input.addEventListener('input', () => { slot.meta[key] = input.value; onMetaChange(); });
    return MC.util.h('div', { class: 'field' }, MC.util.h('label', null, label), input);
  }
  function buildSlotCards() {
    const box = document.getElementById('slot-cards');
    box.innerHTML = '';
    S.slots.forEach(slot => {
      const i = slot.i;
      const urlInput = MC.util.h('input', { type: 'url', placeholder: 'Web address, or IIIF info.json / manifest' });
      const goUrl = () => { const u = urlInput.value.trim(); if (u) loadUrl(i, u); };
      urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') goUrl(); });
      const status = MC.util.h('div', { class: 'meta', id: 'status-' + i },
        slot.source ? (slot.source.name || slot.source.url || 'loaded') : 'no image');
      box.append(MC.util.h('div', { class: 'card', id: 'card-' + i },
        MC.util.h('h3', null, MC.util.h('span', { class: 'dot' }), 'Image ' + (i + 1),
          MC.util.h('span', { style: { flex: '1' } }),
          MC.util.h('button', { class: 'x', title: 'Clear this image', onclick: () => clearSlot(i) }, '×')),
        MC.util.h('div', { style: { display: 'flex', gap: '6px', marginBottom: '6px' } },
          MC.util.h('button', { class: 'btn', onclick: () => loadDialog(i) }, 'Choose file…'),
          MC.util.h('button', { class: 'btn', onclick: goUrl }, 'Load address')),
        MC.util.h('div', { class: 'field' }, urlInput),
        status,
        metaField(slot, 'label', 'Title', 'e.g. View of the south facade'),
        metaField(slot, 'creator', 'Creator / maker'),
        MC.util.h('div', { class: 'row2' }, metaField(slot, 'date', 'Date'), metaField(slot, 'accession', 'Accession no.')),
        metaField(slot, 'repository', 'Repository / collection'),
        metaField(slot, 'sourceUrl', 'Source URL'),
        metaField(slot, 'rights', 'Rights / credit')));
    });
  }
  function onMetaChange() { updatePaneNames(); refreshCite(); }
  function updatePaneNames() {
    if (S.view === 'overlay') {
      const n = document.querySelector('#viewers .pane-cap .name');
      if (n) n.textContent = 'Base: ' + MC.Viewers.paneName(0) + '  ·  Top: ' + MC.Viewers.paneName(1);
      return;
    }
    S.viewers.forEach(v => {
      const pane = v.element.closest('.pane');
      const n = pane && pane.querySelector('.pane-cap .name');
      if (n) n.textContent = MC.Viewers.paneName(v._slot);
    });
  }

  /* ---------- loading ---------- */
  function loadDialog(i) { fileTarget = i; document.getElementById('file-input').click(); }
  function focusSlot(i) {
    openTab('images');
    const card = document.getElementById('card-' + i);
    if (card) { card.scrollIntoView({ block: 'nearest' }); card.style.outline = '2px solid var(--accent)'; setTimeout(() => card.style.outline = '', 900); }
  }
  function loadFile(i, file) {
    if (!/^image\//.test(file.type) && !/\.(jpe?g|png|gif|webp|bmp|tiff?|avif|svg)$/i.test(file.name)) {
      MC.util.toast('Please choose an image file.'); return;
    }
    MC.Viewers.setSource(i, { kind: 'file', objectUrl: URL.createObjectURL(file), name: file.name });
  }
  function loadUrl(i, url) {
    const kind = /iiif|info\.json|manifest|\/full\//i.test(url) ? 'iiif' : 'url';
    MC.Viewers.setSource(i, { kind, url, name: url.split(/[?#]/)[0].split('/').pop() || url });
  }
  function clearSlot(i) {
    S.slots[i] = newSlot(i);
    S.annotations = S.annotations.filter(a => a.slot !== i);
    MC.Viewers.rebuild();
    refreshSidebar();
  }

  /* ---------- views / toggles ---------- */
  /* mirror the visual 'on' state onto aria-pressed for every toggle button */
  function reflectPressed() {
    document.querySelectorAll('#view-seg button, #ov-seg button, .tabs button, #sync-btn, #annotate-btn').forEach(b => {
      b.setAttribute('aria-pressed', b.classList.contains('on') ? 'true' : 'false');
    });
  }
  function setView(view) {
    S.view = view;
    document.querySelectorAll('#view-seg button').forEach(b => b.classList.toggle('on', b.dataset.view === view));
    reflectPressed();
    document.getElementById('sync-group').style.display = view === 'overlay' ? 'none' : '';
    document.getElementById('overlay-group').style.display = view === 'overlay' ? '' : 'none';
    document.getElementById('stage').classList.toggle('curtain-on', view === 'overlay' && S.overlay.mode === 'curtain');
    MC.Viewers.rebuild();
    updatePaneNames();
  }
  function toggleSync() {
    S.sync = !S.sync;
    document.getElementById('sync-btn').classList.toggle('on', S.sync); reflectPressed();
    if (S.sync && S.viewers.length) MC.Viewers.relay(S.viewers[0]);
  }
  function toggleAnnotate() {
    S.annotate = !S.annotate;
    document.getElementById('annotate-btn').classList.toggle('on', S.annotate); reflectPressed();
    document.getElementById('stage').classList.toggle('annotate', S.annotate);
    if (S.annotate) openTab('anno');
  }
  function setOverlayMode(mode) {
    document.querySelectorAll('#ov-seg button').forEach(b => b.classList.toggle('on', b.dataset.ov === mode));
    reflectPressed();
    document.getElementById('ov-opacity-wrap').style.display = mode === 'onion' ? '' : 'none';
    document.getElementById('ov-blink-wrap').style.display = mode === 'blink' ? '' : 'none';
    document.getElementById('ov-gain-wrap').style.display = mode === 'diff' ? '' : 'none';
    MC.Overlay.setMode(mode);
  }

  /* ---------- tabs / panel ---------- */
  function openTab(name) {
    document.getElementById('sidebar').classList.remove('collapsed');
    document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
    reflectPressed();
    ['images', 'anno', 'cite'].forEach(t => document.getElementById('tab-' + t).classList.toggle('hidden', t !== name));
  }

  /* ---------- citation ---------- */
  function hasMeta(s) { return Object.values(s.meta).some(v => v && String(v).trim()); }
  function refreshCite() {
    const sel = document.getElementById('cite-slot');
    const out = document.getElementById('cite-out');
    const prev = sel.value;
    sel.innerHTML = '';
    const filled = S.slots.filter(s => s.source || hasMeta(s));
    if (!filled.length) { out.textContent = 'Add an image and its details to build a citation.'; citeText = ''; return; }
    filled.forEach(s => sel.append(MC.util.h('option', { value: String(s.i) },
      'Image ' + (s.i + 1) + (s.meta.label ? ' — ' + s.meta.label : ''))));
    if ([...sel.options].some(o => o.value === prev)) sel.value = prev;
    const i = parseInt(sel.value, 10);
    const style = document.getElementById('cite-style').value;
    const built = MC.Citation.build(S.slots[i].meta, style, i);
    out.innerHTML = built.html; citeText = built.text;
  }
  function copyCite() {
    if (!citeText) return;
    const done = () => MC.util.toast('Citation copied');
    if (navigator.clipboard) navigator.clipboard.writeText(citeText).then(done, fallbackCopy);
    else fallbackCopy();
    function fallbackCopy() {
      const ta = document.createElement('textarea'); ta.value = citeText; document.body.append(ta);
      ta.select(); try { document.execCommand('copy'); done(); } catch (e) {} ta.remove();
    }
  }

  /* ---------- refresh everything in the panel ---------- */
  function refreshSidebar() {
    buildSlotCards();
    document.querySelectorAll('#slot-cards .dot').forEach((d, i) => {
      d.style.background = S.slots[i] && S.slots[i].source ? 'var(--accent)' : 'var(--line)';
    });
    updatePaneNames();
    MC.Annotations.list();
    refreshCite();
  }

  /* ---------- toolbar / inputs wiring ---------- */
  function syncControls() {
    document.querySelectorAll('#view-seg button').forEach(b => b.classList.toggle('on', b.dataset.view === S.view));
    document.getElementById('sync-btn').classList.toggle('on', S.sync);
    document.getElementById('sync-group').style.display = S.view === 'overlay' ? 'none' : '';
    document.getElementById('overlay-group').style.display = S.view === 'overlay' ? '' : 'none';
    document.querySelectorAll('#ov-seg button').forEach(b => b.classList.toggle('on', b.dataset.ov === S.overlay.mode));
    document.getElementById('ov-opacity').value = Math.round((S.overlay.opacity || 0.5) * 100);
    document.getElementById('ov-opacity-wrap').style.display = S.overlay.mode === 'onion' ? '' : 'none';
    document.getElementById('ov-blink').value = S.overlay.blinkMs || 900;
    document.getElementById('ov-blink-wrap').style.display = S.overlay.mode === 'blink' ? '' : 'none';
    document.getElementById('ov-gain').value = S.overlay.diffGain || 1;
    document.getElementById('ov-gain-wrap').style.display = S.overlay.mode === 'diff' ? '' : 'none';
    document.getElementById('annotate-btn').classList.toggle('on', S.annotate);
    document.getElementById('stage').classList.toggle('annotate', S.annotate);
    document.getElementById('stage').classList.toggle('curtain-on', S.view === 'overlay' && S.overlay.mode === 'curtain');
    reflectPressed();
  }
  function wire() {
    document.querySelectorAll('#view-seg button').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
    document.getElementById('sync-btn').addEventListener('click', toggleSync);
    document.querySelectorAll('#ov-seg button').forEach(b => b.addEventListener('click', () => setOverlayMode(b.dataset.ov)));
    document.getElementById('ov-opacity').addEventListener('input', e => MC.Overlay.setOpacity(e.target.value / 100));
    document.getElementById('ov-blink').addEventListener('input', e => MC.Overlay.setBlinkMs(+e.target.value));
    document.getElementById('ov-gain').addEventListener('input', e => MC.Overlay.setDiffGain(+e.target.value));
    document.getElementById('annotate-btn').addEventListener('click', toggleAnnotate);
    document.getElementById('reset-btn').addEventListener('click', MC.Viewers.resetView);
    document.getElementById('sidebar-btn').addEventListener('click', () => document.getElementById('sidebar').classList.toggle('collapsed'));
    document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => openTab(b.dataset.tab)));

    const menu = document.getElementById('export-menu');
    document.getElementById('export-btn').addEventListener('click', e => { e.stopPropagation(); menu.classList.toggle('hidden'); });
    document.addEventListener('click', () => menu.classList.add('hidden'));
    menu.addEventListener('click', e => e.stopPropagation());
    menu.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      menu.classList.add('hidden');
      const a = b.dataset.act;
      if (a === 'png') MC.Exporters.savePNG();
      else if (a === 'project') MC.Exporters.saveProject();
      else if (a === 'load') document.getElementById('project-input').click();
      else if (a === 'anno-json') MC.Exporters.exportAnno('json');
      else if (a === 'anno-csv') MC.Exporters.exportAnno('csv');
    }));

    document.getElementById('file-input').addEventListener('change', e => {
      const f = e.target.files && e.target.files[0]; if (f) loadFile(fileTarget, f); e.target.value = '';
    });
    document.getElementById('project-input').addEventListener('change', e => {
      const f = e.target.files && e.target.files[0]; if (f) MC.Exporters.openProjectFile(f); e.target.value = '';
    });
    document.getElementById('cite-slot').addEventListener('change', refreshCite);
    document.getElementById('cite-style').addEventListener('change', refreshCite);
    document.getElementById('cite-copy').addEventListener('click', copyCite);

    document.addEventListener('keydown', e => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
      if (e.key === 'a') toggleAnnotate();
      else if (e.key === 'r') MC.Viewers.resetView();
      else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && S.view === 'overlay' && S.overlay.mode === 'curtain') {
        S.overlay.split = Math.max(0.02, Math.min(0.98, S.overlay.split + (e.key === 'ArrowLeft' ? -0.02 : 0.02)));
        document.getElementById('curtain').style.left = (S.overlay.split * 100) + '%';
        MC.Overlay.applyCurtain();
      }
    });
  }

  async function loadSamplesIfEmpty() {
    if (S.slots.some(s => s.source)) return;
    const common = { repository: 'Material / Image Research Lab, UCSB', rights: 'CC0 (demonstration image)' };
    S.slots[0].meta = Object.assign({ label: 'Sample facade, state A', creator: 'MIRL demonstration', date: '', accession: '', sourceUrl: '' }, common);
    S.slots[1].meta = Object.assign({ label: 'Sample facade, state B', creator: 'MIRL demonstration', date: '', accession: '', sourceUrl: '' }, common);
    await MC.Viewers.setSource(0, { kind: 'url', url: 'samples/facade-a.png', name: 'facade-a.png' });
    await MC.Viewers.setSource(1, { kind: 'url', url: 'samples/facade-b.png', name: 'facade-b.png' });
  }

  function init() {
    wire();
    syncControls();
    MC.Viewers.rebuild();
    loadSamplesIfEmpty();
    refreshSidebar();
  }

  return { init, loadDialog, focusSlot, loadFile, loadUrl, openTab, refreshSidebar, syncControls };
})();

document.addEventListener('DOMContentLoaded', MC.App.init);
