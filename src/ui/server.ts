import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadScan } from '../core/loadScan.js';
import type { Scan } from '../core/query.js';
import { listScans } from '../core/diff.js';
import { diffView } from '../core/views.js';
import { clearDecision, saveDecision, type DecisionPatch } from '../core/decisions.js';
import type { ScanMeta } from '../core/types.js';
import { LIVE, componentPage, componentsPage, findingPanel, findingsPage, layout, noScanPage, parseFilters, scansPage, tokensPage, type Tab } from './pages.js';

const ASSETS = dirname(fileURLToPath(import.meta.url)); // src/ui under tsx, dist/ui when built
const TYPES: Record<string, string> = { '.png': 'image/png', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2' };

export async function createUiServer(o: { projectDir: string; out?: string; port?: number }): Promise<{ url: string; port: number; token: string; close(): Promise<void> }> {
  const outDir = o.out ?? join(o.projectDir, '.tavero');
  const token = randomBytes(32).toString('hex');
  const load = async (): Promise<Scan | null> => { try { return await loadScan(o.projectDir, o.out); } catch (e) { if ((e as { code?: string }).code === 'no-scan') return null; throw e; } };
  const send = (res: ServerResponse, status: number, body: string | Buffer, type = 'text/html; charset=utf-8') => { res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' }); res.end(body); };
  const json = (res: ServerResponse, status: number, v: unknown) => send(res, status, JSON.stringify(v), 'application/json; charset=utf-8');
  const page = (res: ServerResponse, scan: Scan | null, tab: Tab, title: string, body: string) =>
    send(res, 200, layout(LIVE, { title, token, scan: scan ? scan.dir.split(/[\\/]/).pop()! : null, meta: scan?.meta ?? null, tab, body }));
  const readBody = (req: IncomingMessage) => new Promise<string>((ok, fail) => { let b = ''; req.on('data', (c) => { b += c; if (b.length > 1e6) req.destroy(); }); req.on('end', () => ok(b)); req.on('error', fail); });

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const path = decodeURIComponent(url.pathname);
    if (path.startsWith('/assets/')) {
      const name = path.slice(8);
      if (!['client.js', 'style.css', 'tokens.css'].includes(name) && !/^fonts\/[\w.-]+\.woff2$/.test(name)) return send(res, 404, 'not found', 'text/plain');
      try { return send(res, 200, await readFile(join(ASSETS, name)), TYPES[name.slice(name.lastIndexOf('.'))]); } catch { return send(res, 404, 'not found', 'text/plain'); }
    }
    if (path === '/api/latest') {
      try { return json(res, 200, { scan: (await readFile(join(outDir, 'scans', 'latest'), 'utf8')).trim() }); } catch { return json(res, 200, { scan: null }); }
    }
    if (path.startsWith('/api/decisions/')) {
      if (req.method !== 'POST' && req.method !== 'DELETE') return json(res, 405, { error: 'method not allowed' });
      if (req.headers['x-tavero-token'] !== token) return json(res, 403, { error: 'missing or wrong session token' });
      const id = path.slice('/api/decisions/'.length);
      const scan = await load();
      const f = scan?.rawFindings.find((x) => x.id === id);
      if (!scan || !f) return json(res, 404, { error: `unknown finding ${id}` });
      try {
        if (req.method === 'DELETE') await clearDecision(scan.outDir, id);
        else {
          const b = JSON.parse((await readBody(req)) || '{}') as DecisionPatch;
          const patch: DecisionPatch = {};
          if (b.status === 'fix' || b.status === 'accepted' || b.status === null) patch.status = b.status;
          if (typeof b.reason === 'string') patch.reason = b.reason.slice(0, 500);
          if (typeof b.note === 'string') patch.note = b.note.slice(0, 2000);
          if (b.canonical && typeof b.canonical.primary === 'string') {
            const allowed = (b.canonical.allowed ?? []).filter((x) => typeof x === 'string');
            const keep = new Set([b.canonical.primary, ...allowed]);
            // names only for the variants the human marked, short, non-empty
            const names = Object.fromEntries(Object.entries(b.canonical.names ?? {}).filter(([k, v]) => keep.has(k) && typeof v === 'string' && v.trim() && v.length <= 40).map(([k, v]) => [k, v.trim()]));
            patch.canonical = { primary: b.canonical.primary, allowed, ...(Object.keys(names).length ? { names } : {}) };
          }
          await saveDecision(scan.outDir, id, patch, f.evidence.length);
        }
      } catch (e) { return json(res, 500, { error: (e as Error).message }); }
      const fresh = await load();
      return json(res, 200, { finding: fresh!.finding(id) });
    }
    if (req.method !== 'GET') return send(res, 405, 'method not allowed', 'text/plain');
    const scan = await load();
    if (path.startsWith('/files/')) {
      if (!scan) return send(res, 404, 'not found', 'text/plain');
      // /files/<scan>/<path>: any scan folder of this project (a partial rescan keeps crops of an earlier scan), nothing outside
      const root = resolve(outDir, 'scans');
      const file = resolve(root, path.slice(7));
      if (!file.startsWith(root + sep)) return send(res, 404, 'not found', 'text/plain');
      try { return send(res, 200, await readFile(file), TYPES[file.slice(file.lastIndexOf('.'))] ?? 'application/octet-stream'); } catch { return send(res, 404, 'not found', 'text/plain'); }
    }
    if (!scan) return page(res, null, 'findings', 'No scan', noScanPage());
    if (path === '/') return page(res, scan, 'findings', 'Findings', findingsPage(LIVE, scan, parseFilters(url.searchParams), url.searchParams.get('f'), url.searchParams.toString()));
    if (path.startsWith('/f/')) {
      const id = path.slice(3);
      const f = scan.finding(id, { evidenceLimit: 200 });
      if (!f) return send(res, 404, 'unknown finding', 'text/plain');
      if (req.headers['x-tavero-fragment'] === '1') return send(res, 200, findingPanel(LIVE, scan, f));
      return page(res, scan, 'findings', f.title, findingsPage(LIVE, scan, parseFilters(url.searchParams), id, url.searchParams.toString()));
    }
    if (path === '/components') return page(res, scan, 'components', 'Components', componentsPage(LIVE, scan));
    if (path.startsWith('/components/')) {
      const body = componentPage(LIVE, scan, path.slice('/components/'.length));
      return body ? page(res, scan, 'components', 'Component', body) : send(res, 404, 'unknown component', 'text/plain');
    }
    if (path === '/tokens') return page(res, scan, 'tokens', 'Tokens', tokensPage(LIVE, scan, url.searchParams.get('kind')));
    if (path === '/scans') {
      const names = await listScans(outDir);
      const scans = await Promise.all(names.map(async (name) => { try { return { name, meta: JSON.parse(await readFile(join(outDir, 'scans', name, 'scan.json'), 'utf8')) as ScanMeta }; } catch { return { name, meta: null }; } }));
      const diff = await diffView(o.projectDir, o.out, url.searchParams.get('from') ?? undefined, url.searchParams.get('to') ?? undefined).catch(() => null);
      return page(res, scan, 'scans', 'Scans', scansPage(scans, diff));
    }
    return send(res, 404, 'not found', 'text/plain');
  }

  const server = createServer((req, res) => { handle(req, res).catch((e) => send(res, 500, `tavero ui: ${(e as Error).message}`, 'text/plain')); });
  await new Promise<void>((ok, fail) => { server.once('error', fail); server.listen(o.port ?? 4747, '127.0.0.1', () => ok()); });
  const port = (server.address() as { port: number }).port;
  return { url: `http://127.0.0.1:${port}/`, port, token, close: () => new Promise<void>((ok) => server.close(() => ok())) };
}
