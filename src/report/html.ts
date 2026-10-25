import { esc, rel } from './esc.js';
import type { Scan } from '../core/query.js';
import type { Evidence } from '../core/types.js';

const n = (x: number, one: string): string => `${x} ${one}${x === 1 ? '' : 's'}`;

const CSS = `
body{font:14px/1.45 system-ui,sans-serif;margin:0;padding:24px;color:#1f2328;background:#fff}
h1{font-size:22px;margin:0 0 4px}h2{font-size:17px;margin:32px 0 8px}
.muted{color:#656d76}code{font:12px ui-monospace,monospace}
table{border-collapse:collapse;width:100%;margin:8px 0}th,td{border:1px solid #d0d7de;padding:4px 8px;text-align:left;vertical-align:top}
th{background:#f6f8fa}tr.high td:first-child{border-left:4px solid #cf222e}tr.medium td:first-child{border-left:4px solid #bf8700}tr.info td:first-child{border-left:4px solid #0969da}
details summary{cursor:pointer}details table{margin:6px 0 0;font-size:12px}
img{max-width:220px;max-height:110px;display:block;background:#f6f8fa;border:1px solid #d0d7de}
.sw{display:inline-block;width:12px;height:12px;border:1px solid #d0d7de;vertical-align:middle;margin-right:6px}
.pill{display:inline-block;padding:1px 8px;border-radius:999px;background:#f6f8fa;border:1px solid #d0d7de;margin-right:6px}
`;

/** Spec §15: one self-contained HTML file rendered from the scan's JSON; it computes nothing itself. */
export function buildReport(scan: Scan): string {
  const m = scan.meta, s = m.stats;
  const viewports = m.viewports.map((v) => v.name);
  const where = (e: Evidence): string => (e.file ? `${e.file}${e.line ? ':' + e.line : ''}` : [e.route, e.viewport].filter(Boolean).join(' @ '));
  const cropLink = (e: Evidence): string => (e.crop ? `<a href="${esc(rel(scan.dir, e.crop))}">crop</a>` : '');

  const findings = scan.allFindings.map((f) => `<tr class="${f.severity}"><td><code>${esc(f.id)}</code></td><td>${f.severity}</td><td>${f.rule}${f.preliminary ? '*' : ''}</td><td>${esc(f.decision?.status ?? '')}</td><td><details><summary>${esc(f.title)}</summary><p>${esc(f.summary)}</p><p class="muted">${esc(Object.entries(f.stats).map(([k, v]) => `${k}=${v}`).join('  '))}</p><table><tr><th>value</th><th>expected</th><th>component</th><th>where</th><th></th></tr>${f.evidence.map((e) => `<tr><td>${esc(e.value)}</td><td>${esc(e.expected)}</td><td>${esc(e.component)}</td><td>${esc(where(e))}</td><td>${cropLink(e)}</td></tr>`).join('')}</table></details></td><td>${f.evidence.length}</td></tr>`).join('\n');

  const components = scan.allComponents.map((c) => {
    const cells = viewports.map((v) => { const i = scan.instancesOf(c.id, v).find((x) => x.crop); return `<td>${i?.crop ? `<img src="${esc(rel(scan.dir, i.crop))}" alt="${esc(c.name)} ${esc(v)}" loading="lazy">` : ''}</td>`; }).join('');
    return `<tr><td>${esc(c.name)}</td><td>${c.file ? esc(`${c.file}${c.line ? ':' + c.line : ''}`) : '<i class="muted">unresolved</i>'}</td><td>${c.instances}</td><td>${c.pages.length}</td>${cells}</tr>`;
  }).join('\n');

  const tokens = scan.allTokens.map((t) => `<tr><td><code>${esc(t.name)}</code></td><td>${t.kind}</td><td>${esc(t.value)}</td><td>${t.kind === 'color' ? `<span class="sw" style="background:${esc(t.resolved)}"></span>` : ''}${esc(t.resolved)}</td><td>${'file' in t.source ? esc(`${t.source.file}:${t.source.line}`) : esc(t.source.source)}</td></tr>`).join('\n');

  const routes = m.routes.map((r) => `<tr><td>${esc(r.path)}</td><td>${r.source}</td><td>${r.status}</td><td>${esc(r.reason)}</td></tr>`).join('\n');
  const stale = m.stale ? `<p><span class="pill">partial rescan</span>${esc(m.diff?.note ?? `${n(m.staleRoutes.length, 'route')} carried over from the previous scan`)}</p>` : '';
  const warnings = m.warnings.length ? `<ul>${m.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : '';

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tavero report · ${esc(m.project.dir.split(/[\\/]/).pop())}</title><style>${CSS}</style></head>
<body>
<h1>Tavero report</h1>
<p class="muted">${esc(m.project.dir)} · ${esc(m.url)} · ${m.project.framework} · ${esc(m.createdAt)} · tavero ${esc(m.version)}</p>
<p><span class="pill">${s.findings.high} high</span><span class="pill">${s.findings.medium} medium</span><span class="pill">${s.findings.info} info</span> ${n(s.pages, 'page')}, ${n(s.components, 'component')} (${s.unresolvedComponents} without file), ${n(s.instances, 'instance')}, ${n(s.tokens, 'token')}; viewports ${esc(viewports.join(', '))}${m.themes?.length ? `, plus ${esc(m.themes.join(', '))} theme at ${esc([...m.viewports].sort((a, b) => b.width - a.width)[0]?.name ?? 'desktop')} width` : ''}; rules ${esc(m.rulesRun.join(', '))}</p>
${stale}${warnings}
<h2>Findings</h2>
<table><tr><th>id</th><th>severity</th><th>rule</th><th>decision</th><th>title (open for evidence)</th><th>evidence</th></tr>
${findings}
</table>
<p class="muted">* preliminary rule</p>
<h2>Components</h2>
<table><tr><th>name</th><th>file</th><th>instances</th><th>pages</th>${viewports.map((v) => `<th>${esc(v)}</th>`).join('')}</tr>
${components}
</table>
<h2>Tokens</h2>
<table><tr><th>name</th><th>kind</th><th>value</th><th>resolved</th><th>source</th></tr>
${tokens}
</table>
<h2>Routes</h2>
<table><tr><th>path</th><th>source</th><th>status</th><th>reason</th></tr>
${routes}
</table>
</body></html>
`;
}
