import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadScan } from '../core/loadScan.js';
import type { Scan } from '../core/query.js';
import { listScans } from '../core/diff.js';
import { diffView } from '../core/views.js';
import type { ScanMeta } from '../core/types.js';
import { rel } from '../report/esc.js';
import { componentPage, componentsPage, findingsPage, layout, scansPage, statusKey, tokensPage, type PageCtx, type Tab } from './pages.js';

const ASSETS = dirname(fileURLToPath(import.meta.url)); // src/ui under tsx, dist/ui when built

/** Flat, relative file names so the export works from file:// and from any static host, in any subfolder. */
const STATIC: PageCtx = {
  mode: 'static',
  link(path) {
    if (path === '/') return 'index.html';
    if (path.startsWith('/f/')) return `f-${path.slice(3)}.html`;
    if (path === '/components') return 'components.html';
    if (path.startsWith('/components/')) return `component-${path.slice(12)}.html`;
    if (path === '/tokens') return 'tokens.html';
    if (path === '/scans') return 'scans.html';
    if (path.startsWith('/assets/')) return path.slice(1);
    return path.replace(/^\//, '');
  },
  file: (scan, p) => 'files/' + rel(join(scan.outDir, 'scans'), isAbsolute(p) ? p : join(scan.dir, p)).split('/').map(encodeURIComponent).join('/'),
};

/**
 * `tavero ui --export <dir>`: a read-only copy of the panel for the current scan — findings (every finding gets
 * its own page, hidden ones included), components, tokens, scans — plus the crops those pages show.
 */
export async function exportUi(o: { projectDir: string; out?: string; dir: string }): Promise<{ pages: number; files: number }> {
  const scan: Scan = await loadScan(o.projectDir, o.out);
  const outDir = o.out ?? join(o.projectDir, '.tavero');
  const name = scan.dir.split(/[\\/]/).pop()!;
  const pages = new Map<string, string>();
  const page = (file: string, tab: Tab, title: string, body: string) =>
    pages.set(file, layout(STATIC, { title, token: '', scan: name, meta: scan.meta, tab, body }));
  const none = { rule: [], severity: [], status: [] };

  page('index.html', 'findings', 'Findings', findingsPage(STATIC, scan, none, null, ''));
  for (const raw of scan.rawFindings) {
    // a finding a human closed is hidden from the default list; its own page lists its bucket so it is the one shown
    const f = scan.finding(raw.id)!;
    const key = statusKey(f);
    const hidden = ['accepted', 'resolved'].includes(f.decision?.status ?? '');
    page(STATIC.link('/f/' + f.id), 'findings', f.title, findingsPage(STATIC, scan, hidden ? { ...none, status: [key] } : none, f.id, ''));
  }
  page('components.html', 'components', 'Components', componentsPage(STATIC, scan));
  for (const c of scan.allComponents) page(STATIC.link('/components/' + c.id), 'components', c.name, componentPage(STATIC, scan, c.id) ?? '');
  page('tokens.html', 'tokens', 'Tokens', tokensPage(STATIC, scan, null));
  const names = await listScans(outDir);
  const scans = await Promise.all(names.map(async (n) => { try { return { name: n, meta: JSON.parse(await readFile(join(outDir, 'scans', n, 'scan.json'), 'utf8')) as ScanMeta }; } catch { return { name: n, meta: null }; } }));
  const diff = await diffView(o.projectDir, o.out).catch(() => null);
  page('scans.html', 'scans', 'Scans', scansPage(scans, diff));

  await mkdir(o.dir, { recursive: true });
  const refs = new Set<string>();
  for (const [file, html] of pages) {
    await writeFile(join(o.dir, file), html);
    for (const m of html.matchAll(/src="files\/([^"]+)"/g)) refs.add(decodeURI(m[1]));
  }
  // crops: copied from any scan folder of the project, never from outside it
  const scansRoot = resolve(outDir, 'scans');
  let files = 0;
  for (const r of refs) {
    const from = resolve(scansRoot, r);
    if (!from.startsWith(scansRoot + sep)) continue;
    const to = join(o.dir, 'files', ...r.split('/'));
    await mkdir(dirname(to), { recursive: true });
    try { await copyFile(from, to); files++; } catch { /* a crop missing on disk stays a broken image, as in the live panel */ }
  }
  await mkdir(join(o.dir, 'assets', 'fonts'), { recursive: true });
  for (const f of ['tokens.css', 'style.css']) await copyFile(join(ASSETS, f), join(o.dir, 'assets', f));
  for (const f of await readdir(join(ASSETS, 'fonts'))) await copyFile(join(ASSETS, 'fonts', f), join(o.dir, 'assets', 'fonts', f));
  return { pages: pages.size, files };
}
