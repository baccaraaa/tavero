import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const DYNAMIC = 'dynamic segment needs an example; add it to routes.json or --routes';
const SPLAT = 'splat route is not a page';

/** TanStack Router's generated route tree lists every page in `interface FileRoutesByFullPath`. */
export function parseTanstackRouteTree(source: string): { routes: string[]; skipped: Array<{ path: string; reason: string }> } {
  const block = source.match(/interface FileRoutesByFullPath\s*\{([^}]*)\}/);
  const routes = new Set<string>();
  const skipped: Array<{ path: string; reason: string }> = [];
  if (!block) return { routes: [], skipped };
  for (const m of block[1].matchAll(/^\s*'([^']+)'\s*:/gm)) {
    const path = m[1].replace(/\/+$/, '') || '/';
    if (/(^|\/)\$($|\/)/.test(path)) skipped.push({ path, reason: SPLAT });
    else if (/\$[A-Za-z_]/.test(path)) skipped.push({ path, reason: DYNAMIC });
    else routes.add(path);
  }
  return { routes: [...routes].sort(), skipped };
}

async function findRouteTrees(dir: string, out: string[]): Promise<void> {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') await findRouteTrees(full, out); }
    else if (e.name === 'routeTree.gen.ts') out.push(full);
  }
}

export async function discoverTanstackRoutes(srcRoots: string[]): Promise<{ routes: string[]; skipped: Array<{ path: string; reason: string }> }> {
  const routes = new Set<string>();
  const skipped: Array<{ path: string; reason: string }> = [];
  for (const root of srcRoots) {
    const files: string[] = [];
    await findRouteTrees(root, files);
    for (const f of files) {
      const r = parseTanstackRouteTree(await readFile(f, 'utf8'));
      r.routes.forEach((x) => routes.add(x));
      skipped.push(...r.skipped);
    }
  }
  return { routes: [...routes].sort(), skipped };
}
