import type { Scan } from '../core/query.js';
import type { Evidence, Finding, ScanMeta } from '../core/types.js';
import type { DiffView } from '../core/views.js';
import { isVariantFinding, variantLabel } from '../core/decisions.js';
import { closeSync, openSync, readSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { esc, rel } from '../report/esc.js';

export type Tab = 'findings' | 'components' | 'tokens' | 'scans';

/** Preloaded so the text does not reflow when the web fonts swap in (layout shift in the demo on the site). */
const FONTS = ['onest-latin-400-normal', 'onest-latin-500-normal', 'onest-latin-600-normal', 'ibm-plex-mono-latin-400-normal'];

/** How pages link: the live server uses absolute paths; the static export (tavero ui --export) uses relative files. */
export interface PageCtx {
  mode: 'live' | 'static';
  link(path: string): string;
  file(scan: Scan, p: string): string;
}

/** /files/<scan>/<path inside it>: works for crops kept from an earlier scan, with no '..' a browser would fold away. */
export const fileUrl = (scan: Scan, p: string): string =>
  '/files/' + rel(join(scan.outDir, 'scans'), isAbsolute(p) ? p : join(scan.dir, p)).split('/').map(encodeURIComponent).join('/');

export const LIVE: PageCtx = { mode: 'live', link: (p) => p, file: fileUrl };

const STATUS_LABEL: Record<string, string> = { fix: 'Fix', accepted: 'Intended', reopened: 'Reopened', canonical: 'Canonical', none: 'No decision' };
/** One filter bucket per finding: a chosen canonical (closed or not) counts as canonical. */
export const statusKey = (f: Finding): string => {
  const s = f.decision?.status;
  if (s === 'fix' || s === 'accepted' || s === 'reopened') return s;
  if (s === 'resolved' || f.decision?.canonical) return 'canonical';
  return 'none';
};

const TABS: Array<[Tab, string, string]> = [['findings', 'Findings', '/'], ['components', 'Components', '/components'], ['tokens', 'Tokens', '/tokens'], ['scans', 'Scans', '/scans']];

export function layout(ctx: PageCtx, o: { title: string; token: string; scan: string | null; meta: ScanMeta | null; tab: Tab; body: string }): string {
  const s = o.meta?.stats;
  const live = ctx.mode === 'live';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${live ? `<meta name="tavero-token" content="${esc(o.token)}"><meta name="tavero-scan" content="${esc(o.scan ?? '')}">` : ''}
<title>${esc(o.title)} · Tavero</title>${FONTS.map((f) => `<link rel="preload" href="${ctx.link(`/assets/fonts/${f}.woff2`)}" as="font" type="font/woff2" crossorigin>`).join('')}<link rel="stylesheet" href="${ctx.link('/assets/tokens.css')}"><link rel="stylesheet" href="${ctx.link('/assets/style.css')}"></head><body>
<header class="top"><b class="brand">Tavero</b><span class="meta">${o.meta ? `${esc(o.meta.project.dir.split(/[\\/]/).pop())} · scan ${esc(o.scan)} · ${s!.findings.high} high, ${s!.findings.medium} medium, ${s!.findings.info} info` : 'no scan yet'}</span>
<nav>${TABS.map(([t, label, path]) => `<a href="${ctx.link(path)}"${t === o.tab ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav>
${live ? '<span id="newscan" hidden>New scan available. <a href="">Reload</a></span>' : ''}</header>
<main class="${o.tab}">${o.body}</main>${live ? `<script src="${ctx.link('/assets/client.js')}"></script>` : ''}</body></html>`;
}

export function noScanPage(): string {
  return `<section class="empty"><h1>No scan yet</h1><p>Run <code>tavero scan --url http://localhost:5173</code> in the project, or ask your agent to call <code>tavero_scan</code>. This page updates by itself.</p></section>`;
}

const badge = (f: Finding) => { const k = statusKey(f); return k === 'none' ? '' : `<span class="badge ${k}">${STATUS_LABEL[k]}</span>`; };
const where = (e: Evidence) => (e.file ? `${e.file}${e.line ? ':' + e.line : ''}` : [e.route, e.viewport].filter(Boolean).join(' @ '));
/** A source location that wraps at folder boundaries in narrow table columns. */
const whereHtml = (e: Evidence) => esc(where(e)).replace(/\//g, '/<wbr>');
/** Width and height from a PNG header, or null. */
function pngSize(file: string): { w: number; h: number } | null {
  try {
    const fd = openSync(file, 'r');
    const b = Buffer.alloc(24);
    try { readSync(fd, b, 0, 24, 0); } finally { closeSync(fd); }
    return b.toString('ascii', 12, 16) === 'IHDR' ? { w: b.readUInt32BE(16), h: b.readUInt32BE(20) } : null;
  } catch { return null; }
}
/** A crop with its size fitted into the 160×88 box style.css allows, so rows do not jump as images load. */
const img = (ctx: PageCtx, scan: Scan, p: string) => {
  const s = pngSize(isAbsolute(p) ? p : join(scan.dir, p));
  const k = s ? Math.min(1, 160 / s.w, 88 / s.h) : 0;
  return `<img src="${ctx.file(scan, p)}" alt="" loading="lazy"${s ? ` width="${Math.round(s.w * k)}" height="${Math.round(s.h * k)}"` : ''}>`;
};
const cropImg = (ctx: PageCtx, scan: Scan, componentId: string | null | undefined, viewport: string) => {
  if (!componentId) return '';
  const i = scan.instancesOf(componentId, viewport).find((x) => x.crop);
  return i?.crop ? img(ctx, scan, i.crop) : '';
};
/** A variant row shows that variant's own crop at the width; scans before per-variant crops fall back to the component's. */
const variantImg = (ctx: PageCtx, scan: Scan, e: Evidence, viewport: string) => {
  const own = e.variantId ? scan.variantCrops(e.variantId)[viewport] : undefined;
  return own ? img(ctx, scan, own) : cropImg(ctx, scan, e.componentId, viewport);
};

export interface FindingFilters { rule: string[]; severity: string[]; status: string[] }
export function parseFilters(q: URLSearchParams): FindingFilters {
  return { rule: q.getAll('rule'), severity: q.getAll('severity'), status: q.getAll('status') };
}
export function filterFindings(all: Finding[], f: FindingFilters): Finding[] {
  // without a status filter, findings a human closed (accepted, or every variant inside the canonical) are hidden
  return all.filter((x) => (!f.rule.length || f.rule.includes(x.rule)) && (!f.severity.length || f.severity.includes(x.severity))
    && (f.status.length ? f.status.includes(statusKey(x)) : !['accepted', 'resolved'].includes(x.decision?.status ?? '')));
}

export function findingsPage(ctx: PageCtx, scan: Scan, filters: FindingFilters, selected: string | null, query: string): string {
  const all = scan.findings({ includeAccepted: true, limit: 10_000 }).items.map((x) => scan.finding(x.id)!);
  const shown = filterFindings(all, filters);
  const count = (pred: (f: Finding) => boolean) => all.filter(pred).length;
  const box = (name: keyof FindingFilters, value: string, label: string, n: number) =>
    `<label><input type="checkbox" name="${name}" value="${value}"${filters[name].includes(value) ? ' checked' : ''}> ${esc(label)} <span class="n">${n}</span></label>`;
  const sel = shown.find((f) => f.id === selected) ?? shown[0] ?? null;
  const filtersHtml = ctx.mode === 'live'
    ? `<form class="filters" method="get" action="/">
<h3>Rule</h3>${['buttons', 'cards', 'colors', 'scales'].map((r) => box('rule', r, r, count((f) => f.rule === r))).join('')}
<h3>Severity</h3>${['high', 'medium', 'info'].map((s) => box('severity', s, s, count((f) => f.severity === s))).join('')}
<h3>Decision</h3>${['none', 'fix', 'accepted', 'canonical', 'reopened'].map((s) => box('status', s, STATUS_LABEL[s], count((f) => statusKey(f) === s))).join('')}
<button type="submit" class="secondary">Apply</button></form>`
    : `<aside class="filters"><h3>Findings</h3><p class="n">${shown.length} open</p><p class="static-note">A read-only copy of the Tavero panel. In your project these decisions are made in <code>tavero ui</code>.</p></aside>`;
  const href = (id: string) => ctx.link('/f/' + id) + (ctx.mode === 'live' && query ? '?' + esc(query) : '');
  return `${filtersHtml}
<ol class="list">${shown.map((f) => `<li><a class="row ${f.severity}${sel && f.id === sel.id ? ' sel' : ''}" data-id="${esc(f.id)}" href="${href(f.id)}"><span class="sev">${f.severity}</span> ${esc(f.title)} ${badge(f)} <span class="n">${f.evidence.length}</span></a></li>`).join('')}</ol>
<section class="panel" id="panel" tabindex="0" aria-label="Finding">${sel ? findingPanel(ctx, scan, sel) : '<p class="n">No findings match these filters.</p>'}</section>`;
}

export function findingPanel(ctx: PageCtx, scan: Scan, f: Finding): string {
  const vps = scan.meta.viewports.map((v) => v.name);
  const d = f.decision;
  const live = ctx.mode === 'live';
  const head = `<h2>${esc(f.title)} ${badge(f)}</h2><p class="n"><code>${esc(f.id)}</code> · ${f.rule}${f.preliminary ? ' (preliminary rule)' : ''} · ${f.severity}</p><p>${esc(f.summary)}</p>`;
  const actions = live ? `<div class="actions" data-id="${esc(f.id)}">
<button data-action="fix" class="${d?.status === 'fix' ? 'on' : ''}">1 Fix</button>
<button data-action="accepted" class="${d?.status === 'accepted' || d?.status === 'reopened' ? 'on' : ''}">2 Intended</button>
${isVariantFinding(f) ? '<button data-action="canonical">3 Canonical</button>' : ''}
<button data-action="note">4 Note</button><button data-action="clear" title="Esc">Clear</button>
<input name="reason" placeholder="Reason, for intended" value="${esc(d?.reason ?? '')}">
<textarea name="note" placeholder="Note to the agent">${esc(d?.note ?? '')}</textarea></div>`
    : `<p class="static-note">In your project these decisions are made in <code>tavero ui</code>.</p>`;
  const body = isVariantFinding(f)
    ? `<table class="variants"><tr>${live ? '<th>Primary</th><th>Allowed</th>' : ''}<th>Variant</th>${vps.map((v) => `<th>${esc(v)}</th>`).join('')}<th>Rendered by</th></tr>
${f.evidence.map((e) => `<tr class="${e.canonical ?? ''}">${live ? `<td><input type="radio" name="primary" value="${esc(e.variantId)}"${e.canonical === 'primary' ? ' checked' : ''} aria-label="Primary"></td><td><input type="checkbox" name="allowed" value="${esc(e.variantId)}"${e.canonical === 'allowed' ? ' checked' : ''} aria-label="Allowed"></td>` : ''}<td class="v">${esc(e.value)}${live ? `<div><input name="vname" data-variant="${esc(e.variantId)}" placeholder="variant name" aria-label="Variant name" value="${esc(e.variantId ? d?.canonical?.names?.[e.variantId] ?? '' : '')}"></div>` : ''}${e.canonical ? `<div class="exp">${e.canonical === 'primary' ? 'primary' : 'allowed'}</div>` : e.expected ? `<div class="exp" title="${esc(e.expected)}">bring to the canonical</div>` : ''}</td>${vps.map((v) => `<td>${variantImg(ctx, scan, e, v)}</td>`).join('')}<td><code>${whereHtml(e)}</code></td></tr>`).join('')}</table>
${live ? '<button data-action="save-canonical" class="primary">Save canonical</button>' : ''}
<pre class="agent">The agent will see:\n${esc(agentPreview(f))}</pre>`
    : `<table class="evidence"><tr><th>Value</th><th>Expected</th><th>Component</th><th>Where</th>${vps.map((v) => `<th>${esc(v)}</th>`).join('')}</tr>
${f.evidence.map((e) => `<tr><td>${esc(e.value)}</td><td>${esc(e.expected)}</td><td>${esc(e.component)}</td><td><code>${whereHtml(e)}</code></td>${vps.map((v) => `<td>${cropImg(ctx, scan, e.componentId, v)}</td>`).join('')}</tr>`).join('')}</table>`;
  return head + actions + body;
}

function agentPreview(f: Finding): string {
  const primary = f.evidence.find((e) => e.canonical === 'primary');
  if (!primary) return 'No canonical yet: the agent sees every variant as drift.';
  const others = f.evidence.filter((e) => !e.canonical).length;
  return `tavero_context → "${variantLabel(primary)}" is canonical\ntavero_finding ${f.id} → expected on ${others} variant(s): "${f.evidence.find((e) => !e.canonical)?.expected ?? variantLabel(primary)}"${f.decision?.note ? `\nnote: "${f.decision.note}"` : ''}`;
}

export function componentsPage(ctx: PageCtx, scan: Scan): string {
  const vps = scan.meta.viewports.map((v) => v.name);
  return `<table class="components"><tr><th>Component</th><th>File</th><th>Instances</th><th>Pages</th>${vps.map((v) => `<th>${esc(v)}</th>`).join('')}</tr>
${scan.allComponents.map((c) => `<tr><td><a href="${ctx.link('/components/' + c.id)}">${esc(c.name)}</a></td><td><code>${esc(c.file ? `${c.file}${c.line ? ':' + c.line : ''}` : 'no file')}</code></td><td>${c.instances}</td><td>${c.pages.length}</td>${vps.map((v) => `<td>${cropImg(ctx, scan, c.id, v)}</td>`).join('')}</tr>`).join('')}</table>`;
}

export function componentPage(ctx: PageCtx, scan: Scan, id: string): string | null {
  const c = scan.component(id);
  if (!c) return null;
  const crops = scan.crops(c.id).map((p) => img(ctx, scan, p)).join('');
  const related = scan.allFindings.filter((f) => f.evidence.some((e) => e.componentId === c.id || e.component === c.name));
  return `<h2>${esc(c.name)}</h2><p class="n"><code>${esc(c.file ?? 'no file')}${c.line ? ':' + c.line : ''}</code> · ${c.instances} instances on ${c.pages.length} page(s) · props: ${esc(c.props.join(', ') || 'none')}</p>
<div class="crops">${crops || '<p class="n">No crops.</p>'}</div>
<h3>Findings with this component</h3><ul>${related.map((f) => `<li><a href="${ctx.link('/f/' + f.id)}">${esc(f.title)}</a> ${badge(f)}</li>`).join('') || '<li class="n">None</li>'}</ul>`;
}

export function tokensPage(ctx: PageCtx, scan: Scan, kind: string | null): string {
  const toks = scan.allTokens.filter((t) => !kind || t.kind === kind);
  const kinds = [...new Set(scan.allTokens.map((t) => t.kind))];
  const filter = ctx.mode === 'live' ? `<p class="kinds">${['', ...kinds].map((k) => `<a href="/tokens${k ? '?kind=' + k : ''}"${(kind ?? '') === k ? ' aria-current="page"' : ''}>${k || 'all'}</a>`).join('')}</p>` : '';
  return `${filter}
<table class="tokens"><tr><th>Name</th><th>Kind</th><th>Value</th><th>Resolved</th><th>Source</th></tr>
${toks.map((t) => `<tr><td><code>${esc(t.name)}</code></td><td>${t.kind}</td><td>${esc(t.value)}</td><td>${t.kind === 'color' ? `<span class="sw" style="background:${esc(t.resolved)}"></span>` : ''}${esc(t.resolved)}</td><td><code>${'file' in t.source ? esc(`${t.source.file}:${t.source.line}`) : esc(t.source.source)}</code></td></tr>`).join('')}</table>`;
}

export function scansPage(scans: Array<{ name: string; meta: ScanMeta | null }>, diff: DiffView | null): string {
  const rows = scans.slice().reverse().map((s) => `<tr><td><code>${esc(s.name)}</code></td><td>${s.meta ? (s.meta.stale ? 'partial' : 'full') : ''}</td><td>${s.meta ? `${s.meta.stats.findings.high} / ${s.meta.stats.findings.medium} / ${s.meta.stats.findings.info}` : ''}</td><td>${s.meta?.diff ? `+${s.meta.diff.new} −${s.meta.diff.resolved}` : ''}</td></tr>`).join('');
  const d = diff ? `<h3>${esc(diff.from)} → ${esc(diff.to)}</h3>${diff.note ? `<p class="n">${esc(diff.note)}</p>` : ''}
<h4>Resolved (${diff.findings.resolved.length})</h4><ul>${diff.findings.resolved.map((f) => `<li>${esc(f.title)} <code>${esc(f.id)}</code></li>`).join('')}</ul>
<h4>New (${diff.findings.new.length})</h4><ul>${diff.findings.new.map((f) => `<li>${esc(f.title)} <code>${esc(f.id)}</code></li>`).join('')}</ul>` : '<p class="n">Two scans are needed for a diff.</p>';
  return `<table class="scans"><tr><th>Scan</th><th>Kind</th><th>High / medium / info</th><th>Diff</th></tr>${rows}</table>${d}`;
}
