import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const DYNAMIC = 'dynamic segment needs an example; add it to routes.json or --routes';
const WILDCARD = 'wildcard route is not a page';
const RELATIVE_OBJ = 'relative path in object form cannot be joined; add the full path to routes.json';

function joinPath(parent: string, child: string): string {
  if (child.startsWith('/')) return child.replace(/\/+$/, '') || '/';
  const base = parent.replace(/\/+$/, '');
  return (base + '/' + child.replace(/^\/+/, '')).replace(/\/+/g, '/') || '/';
}

/** Pure parser over one source file: JSX <Route> nesting plus absolute object-form paths. */
export function parseReactRouterRoutes(source: string): { routes: string[]; skipped: Array<{ path: string; reason: string }> } {
  const routes = new Set<string>();
  const skipped: Array<{ path: string; reason: string }> = [];
  const emit = (p: string) => {
    if (/\*/.test(p)) skipped.push({ path: p, reason: WILDCARD });
    else if (/:[A-Za-z_]/.test(p)) skipped.push({ path: p, reason: DYNAMIC });
    else routes.add(p);
  };
  const tag = /<Route\b([^>]*?)(\/?)>|<\/Route\s*>/g;
  const stack: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = tag.exec(source))) {
    if (m[0].startsWith('</')) { stack.pop(); continue; }
    const attrs = m[1] ?? '';
    const pathAttr = attrs.match(/\bpath\s*=\s*["']([^"']+)["']/);
    const isIndex = /\bindex\b/.test(attrs);
    const parent = stack[stack.length - 1] ?? '/';
    const full = pathAttr ? joinPath(parent, pathAttr[1]) : parent;
    if (pathAttr || isIndex) emit(full);
    if (m[2] !== '/') stack.push(full);
  }
  const obj = /\bpath\s*:\s*["']([^"']+)["']/g;
  while ((m = obj.exec(source))) {
    if (m[1].startsWith('/')) emit(m[1]);
    else skipped.push({ path: m[1], reason: RELATIVE_OBJ });
  }
  return { routes: [...routes].sort(), skipped };
}

async function walk(dir: string, out: string[]): Promise<void> {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') await walk(full, out); }
    else if (/\.(tsx|jsx)$/.test(e.name)) out.push(full);
  }
}

export async function discoverReactRouterRoutes(projectDir: string, srcRoots: string[]): Promise<{ routes: string[]; skipped: Array<{ path: string; reason: string }> }> {
  const routes = new Set<string>();
  const skipped: Array<{ path: string; reason: string }> = [];
  for (const root of srcRoots) {
    const files: string[] = [];
    await walk(root, files);
    for (const f of files) {
      const text = await readFile(f, 'utf8');
      if (!/<Route\b|createBrowserRouter\(/.test(text)) continue;
      const r = parseReactRouterRoutes(text);
      r.routes.forEach((x) => routes.add(x));
      skipped.push(...r.skipped);
    }
  }
  void projectDir;
  return { routes: [...routes].sort(), skipped };
}
