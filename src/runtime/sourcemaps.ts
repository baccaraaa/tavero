import { SourceMapConsumer } from 'source-map';
import type { Framework, ResolvedLoc } from '../core/types.js';

export interface Resolver {
  resolve(loc: string): Promise<ResolvedLoc>;
  cached(loc: string): ResolvedLoc | undefined;
  mapsFetched(): number;
}

const NOT_APP = /(^|\/)node_modules\/|^_next\/|^@vite\/|^@fs\/|^@id\/|react-refresh|^node:|^__vite/;

/**
 * Turns "url:line:col" stack locations into project-relative paths.
 * Vite dev URLs already are source paths; Next/Turbopack chunk URLs are resolved
 * through the chunk's source map (served as <chunk>.map in dev).
 */
/**
 * A source-map source or dev-server URL → project-relative path plus whether it is app code.
 * Handles `file:///C:/...` (Windows) and `file:///home/...` (Linux), Turbopack's `[project]/...`,
 * dev-server URLs and bare absolute paths.
 */
export function classifySource(source: string, opts: { projectDir: string; baseUrl: string }): { path: string; app: boolean } {
  const projectAbs = opts.projectDir.replace(/\\/g, '/').replace(/\/$/, '');
  let p = source.replace(/\\/g, '/');
  if (p.startsWith('file://')) p = p.slice(7).replace(/^\/([A-Za-z]:\/)/, '$1'); // keep "/home/x", turn "/C:/x" into "C:/x"
  const i = p.indexOf('[project]/');
  if (i >= 0) p = p.slice(i + 10);
  if (p.startsWith(projectAbs + '/')) p = p.slice(projectAbs.length + 1);
  if (p.startsWith(opts.baseUrl + '/')) p = p.slice(opts.baseUrl.length + 1);
  p = p.replace(/^\/+/, '');
  return { path: p, app: !NOT_APP.test(p) };
}

export function createResolver(opts: { kind: Framework; baseUrl: string; projectDir: string }): Resolver {
  const mapCache = new Map<string, SourceMapConsumer | null>();
  const locCache = new Map<string, ResolvedLoc>();
  const classify = (path: string) => classifySource(path, opts);

  async function consumerFor(chunkUrl: string): Promise<SourceMapConsumer | null> {
    if (mapCache.has(chunkUrl)) return mapCache.get(chunkUrl)!;
    let c: SourceMapConsumer | null = null;
    try {
      const r = await fetch(chunkUrl + '.map');
      if (r.ok) c = await new SourceMapConsumer(await r.json());
    } catch { c = null; }
    mapCache.set(chunkUrl, c);
    return c;
  }

  /**
   * Vite serves each module transformed (JSX runtime imports, React Refresh preamble), so stack lines point into
   * the transformed code; the module carries an inline source map back to the original lines.
   */
  async function viteConsumerFor(moduleUrl: string): Promise<SourceMapConsumer | null> {
    if (mapCache.has(moduleUrl)) return mapCache.get(moduleUrl)!;
    let c: SourceMapConsumer | null = null;
    try {
      const r = await fetch(moduleUrl);
      if (r.ok) {
        const code = await r.text();
        const m = code.match(/\/\/# sourceMappingURL=data:application\/json;(?:charset=utf-8;)?base64,([A-Za-z0-9+/=]+)\s*$/);
        if (m) c = await new SourceMapConsumer(JSON.parse(Buffer.from(m[1], 'base64').toString('utf8')));
      }
    } catch { c = null; }
    mapCache.set(moduleUrl, c);
    return c;
  }

  async function resolve(loc: string): Promise<ResolvedLoc> {
    const hit = locCache.get(loc);
    if (hit) return hit;
    let out: ResolvedLoc = { raw: loc, path: null, line: null, col: null, app: false };
    const m = loc.match(/^(.*):(\d+):(\d+)$/);
    if (m) {
      const url = m[1], line = Number(m[2]), col = Number(m[3]);
      if (opts.kind === 'vite') {
        try {
          const c = classify(decodeURIComponent(new URL(url).pathname));
          out = { raw: loc, path: c.path, line, col, app: c.app };
          if (c.app) {
            const cons = await viteConsumerFor(url);
            const pos = cons?.originalPositionFor({ line, column: Math.max(0, col - 1) });
            if (pos?.line) out = { ...out, line: pos.line, col: (pos.column ?? 0) + 1 };
          }
        } catch { /* unparsable url */ }
      } else {
        const chunk = url.replace(/\?.*$/, '');
        const cons = await consumerFor(chunk);
        if (cons) {
          const pos = cons.originalPositionFor({ line, column: Math.max(0, col - 1) });
          if (pos.source) { const c = classify(decodeURIComponent(pos.source)); out = { raw: loc, path: c.path, line: pos.line, col: pos.column, app: c.app }; }
        } else {
          const name = chunk.split('/').pop() ?? '';
          out = { raw: loc, path: name, line, col, app: !/next_dist|node_modules|react-server-dom/.test(name) && /_src_/.test(name) };
        }
      }
    }
    locCache.set(loc, out);
    return out;
  }

  return { resolve, cached: (loc) => locCache.get(loc), mapsFetched: () => mapCache.size };
}
