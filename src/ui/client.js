// Tavero panel client: keyboard triage, decision posts, live "new scan" notice. No framework.
(() => {
  const token = document.querySelector('meta[name=tavero-token]')?.content ?? '';
  const scanName = document.querySelector('meta[name=tavero-scan]')?.content ?? '';
  const panel = document.getElementById('panel');
  const rows = () => [...document.querySelectorAll('.list .row')];
  const current = () => document.querySelector('.actions')?.dataset.id ?? null;

  async function show(id, push = true) {
    if (!panel || !id) return;
    const r = await fetch(`/f/${encodeURIComponent(id)}`, { headers: { 'X-Tavero-Fragment': '1' } });
    if (!r.ok) return;
    panel.innerHTML = await r.text();
    rows().forEach((a) => a.classList.toggle('sel', a.dataset.id === id));
    document.querySelector(`.list .row[data-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'nearest' });
    if (push) history.replaceState(null, '', `/f/${encodeURIComponent(id)}${location.search}`);
  }

  async function decide(id, body, method = 'POST') {
    const r = await fetch(`/api/decisions/${encodeURIComponent(id)}`, { method, headers: { 'content-type': 'application/json', 'x-tavero-token': token }, body: method === 'POST' ? JSON.stringify(body) : undefined });
    if (!r.ok) { alertBar(`Not saved: ${(await r.json().catch(() => ({}))).error ?? r.status}`); return; }
    const { finding } = await r.json();
    const row = document.querySelector(`.list .row[data-id="${CSS.escape(id)}"]`);
    const hidden = ['accepted', 'resolved'].includes(finding?.decision?.status) && !new URLSearchParams(location.search).getAll('status').length;
    if (hidden && row) {
      const list = rows(); const next = list[list.indexOf(row) + 1] ?? list[list.indexOf(row) - 1];
      row.parentElement.remove();
      if (next) await show(next.dataset.id); else panel.innerHTML = '<p class="n">Every finding under these filters has a decision.</p>';
    } else {
      await show(id, false);
      if (row) setBadge(row, keyOf(finding?.decision));
    }
  }

  const LABEL = { fix: 'Fix', accepted: 'Intended', reopened: 'Reopened', canonical: 'Canonical' };
  const keyOf = (d) => (!d ? null : ['fix', 'accepted', 'reopened'].includes(d.status) ? d.status : d.status === 'resolved' || d.canonical ? 'canonical' : null);
  function setBadge(row, status) {
    row.querySelector('.badge')?.remove();
    if (!status || !LABEL[status]) return;
    const b = document.createElement('span');
    b.className = `badge ${status}`; b.textContent = LABEL[status];
    row.querySelector('.n:last-child')?.before(b, ' ');
  }

  function alertBar(text) {
    let bar = document.getElementById('alert');
    if (!bar) { bar = document.createElement('div'); bar.id = 'alert'; document.body.append(bar); }
    bar.textContent = text; bar.hidden = false; setTimeout(() => { bar.hidden = true; }, 4000);
  }

  function field(name) { return panel?.querySelector(`[name=${name}]`); }
  function canonicalBody() {
    const primary = panel.querySelector('input[name=primary]:checked')?.value;
    if (!primary) { alertBar('Pick the primary variant first'); return null; }
    const allowed = [...panel.querySelectorAll('input[name=allowed]:checked')].map((x) => x.value).filter((v) => v !== primary);
    const names = {};
    for (const i of panel.querySelectorAll('input[name=vname]')) if (i.value.trim() && (i.dataset.variant === primary || allowed.includes(i.dataset.variant))) names[i.dataset.variant] = i.value.trim();
    return { canonical: { primary, allowed, names } };
  }

  async function act(action) {
    const id = current(); if (!id) return;
    if (action === 'fix') return decide(id, { status: 'fix' });
    if (action === 'accepted') { const r = field('reason'); r?.focus(); r?.select(); return; }
    if (action === 'note') { field('note')?.focus(); return; }
    if (action === 'canonical') { panel.querySelector('input[name=primary]')?.focus(); return; }
    if (action === 'save-canonical') { const b = canonicalBody(); if (b) return decide(id, b); return; }
    if (action === 'clear') return decide(id, null, 'DELETE');
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest('.list .row');
    if (a) { e.preventDefault(); show(a.dataset.id); return; }
    const b = e.target.closest('[data-action]');
    if (b) { e.preventDefault(); act(b.dataset.action); }
  });

  document.addEventListener('change', (e) => { if (e.target.closest('form.filters')) e.target.form.submit(); });

  document.addEventListener('keydown', (e) => {
    const t = e.target;
    const typing = t instanceof HTMLInputElement && t.type === 'text' || t instanceof HTMLTextAreaElement || (t instanceof HTMLInputElement && !t.type);
    const id = current();
    if (typing) {
      if (e.key === 'Escape') { t.blur(); return; }
      if (e.key === 'Enter' && t.name === 'reason') { e.preventDefault(); t.blur(); if (id) decide(id, { status: 'accepted', reason: t.value }); }
      if (e.key === 'Enter' && t.name === 'note' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); t.blur(); if (id) decide(id, { note: t.value }); }
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const list = rows(); if (!list.length) return;
      const i = list.findIndex((a) => a.dataset.id === id);
      const next = list[Math.max(0, Math.min(list.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))];
      e.preventDefault(); show(next.dataset.id); return;
    }
    const map = { 1: 'fix', 2: 'accepted', 3: 'canonical', 4: 'note', Escape: 'clear' };
    if (map[e.key]) { e.preventDefault(); act(map[e.key]); }
  });

  // the note textarea saves on blur so a human does not need a shortcut
  document.addEventListener('focusout', (e) => {
    const t = e.target;
    if (t instanceof HTMLTextAreaElement && t.name === 'note' && current() && t.value !== t.defaultValue) decide(current(), { note: t.value });
  });

  // live notice when an agent (or the CLI) wrote a new scan
  setInterval(async () => {
    try {
      const { scan } = await (await fetch('/api/latest', { cache: 'no-store' })).json();
      const n = document.getElementById('newscan');
      if (n && scan && scan !== scanName) n.hidden = false;
    } catch { /* server stopped */ }
  }, 5000);
})();
