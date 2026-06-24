/* citation.js — build a citation for an image from the details on its card.
   Returns both an HTML form (title in italics, for the panel) and a plain-text
   form (clean for pasting). Styles: Chicago note, MLA, APA, BibTeX. */

MC.Citation = (function () {
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const has = s => s && String(s).trim();

  function fmtAccessed(meta, style) {
    const iso = meta && meta.accessed;
    const d = iso ? new Date(iso + 'T00:00:00') : new Date();
    if (style === 'mla') return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
    return MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }

  function build(meta, style, seq) {
    const title = has(meta.label) ? meta.label.trim() : 'Untitled';
    const creator = has(meta.creator) ? meta.creator.trim() : '';
    const date = has(meta.date) ? meta.date.trim() : '';
    const repo = has(meta.repository) ? meta.repository.trim() : '';
    const acc = has(meta.accession) ? meta.accession.trim() : '';
    const url = has(meta.sourceUrl) ? meta.sourceUrl.trim() : '';
    const rights = has(meta.rights) ? meta.rights.trim() : '';
    const titleH = '<em>' + esc(title) + '</em>';

    let H = '', T = '';

    if (style === 'chicago') {
      const ph = [], pt = [];
      if (creator) { ph.push(esc(creator)); pt.push(creator); }
      ph.push(titleH); pt.push(title);
      [date, repo, acc].forEach(p => { if (p) { ph.push(esc(p)); pt.push(p); } });
      H = ph.join(', '); T = pt.join(', ');
      if (url) { H += ', accessed ' + fmtAccessed(meta, '') + ', ' + esc(url); T += ', accessed ' + fmtAccessed(meta, '') + ', ' + url; }
      H += '.'; T += '.';

    } else if (style === 'mla') {
      const sh = [], st = [];
      if (creator) { sh.push(esc(creator)); st.push(creator); }
      sh.push(titleH); st.push(title);
      if (date) { sh.push(esc(date)); st.push(date); }
      const rp = [repo, acc].filter(Boolean).join(', ');
      if (rp) { sh.push(esc(rp)); st.push(rp); }
      if (url) { sh.push(esc(url)); st.push(url); }
      H = sh.join('. ') + '.'; T = st.join('. ') + '.';
      if (url) { H += ' Accessed ' + fmtAccessed(meta, 'mla') + '.'; T += ' Accessed ' + fmtAccessed(meta, 'mla') + '.'; }

    } else if (style === 'apa') {
      let h = '', t = '';
      if (creator) { h += esc(creator) + ' '; t += creator + ' '; }
      h += '(' + (date || 'n.d.') + '). '; t += '(' + (date || 'n.d.') + '). ';
      h += titleH + ' [Image]. '; t += title + ' [Image]. ';
      if (repo) { h += esc(repo) + '. '; t += repo + '. '; }
      if (url) { h += esc(url); t += url; }
      H = h.trim(); T = t.trim();

    } else { // bibtex
      const slug = title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24);
      let key = ((creator.split(/\s+/).pop() || '').replace(/\W/g, '') + date.replace(/\D/g, '') + slug) || 'image';
      if (seq != null) key += String(seq);
      const lines = ['@misc{' + key + ','];
      if (creator) lines.push('  author       = {' + creator + '},');
      lines.push('  title        = {' + title + '},');
      if (date) lines.push('  year         = {' + date + '},');
      const hp = [repo, acc].filter(Boolean).join(', ');
      if (hp) lines.push('  howpublished = {' + hp + '},');
      if (rights) lines.push('  note         = {' + rights + '},');
      if (url) lines.push('  url          = {' + url + '},');
      lines.push('}');
      T = lines.join('\n'); H = esc(T);
    }
    return { html: H, text: T };
  }

  return { build };
})();
