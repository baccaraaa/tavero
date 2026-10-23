import { readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

const DYNAMIC_REASON = 'dynamic segment needs an example; add it to routes.json or --routes';

async function exists(p: string): Promise<boolean> {
  try { await stat(p); return true; } catch { return false; }
}

async function walk(dir: string, out: string[]): Promise<void> {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== 'api') await walk(full, out); }
    else out.push(full);
  }
}

function appRoute(rel: string): string {
  const segs = rel.split('/').slice(0, -1).filter((s) => s && !/^\(.*\)$/.test(s) && !s.startsWith('@') && !s.startsWith('_'));
  return '/' + segs.join('/');
}

function pagesRoute(rel: string): string {
  const noExt = rel.replace(/\.(tsx|jsx|js)$/, '');
  const segs = noExt.split('/').filter((s) => s && s !== 'index');
  return '/' + segs.join('/');
}

export async function discoverNextRoutes(projectDir: string): Promise<{ routes: string[]; skipped: Array<{ path: string; reason: string }> }> {
  const routes = new Set<string>();
  const skipped: Array<{ path: string; reason: string }> = [];
  const classify = (route: string) => {
    if (/\[[^\]]+\]/.test(route)) skipped.push({ path: route, reason: DYNAMIC_REASON });
    else routes.add(route);
  };

  for (const appDir of [join(projectDir, 'app'), join(projectDir, 'src', 'app')]) {
    if (!(await exists(appDir))) continue;
    const files: string[] = [];
    await walk(appDir, files);
    for (const f of files) {
      const rel = relative(appDir, f).replace(/\\/g, '/');
      if (/(^|\/)page\.(tsx|jsx|js)$/.test(rel)) classify(appRoute(rel));
    }
  }
  for (const pagesDir of [join(projectDir, 'pages'), join(projectDir, 'src', 'pages')]) {
    if (!(await exists(pagesDir))) continue;
    const files: string[] = [];
    await walk(pagesDir, files);
    for (const f of files) {
      const rel = relative(pagesDir, f).replace(/\\/g, '/');
      if (!/\.(tsx|jsx|js)$/.test(rel) || /(^|\/)_(app|document|error)\./.test(rel) || /^(404|500)\./.test(rel)) continue;
      classify(pagesRoute(rel));
    }
  }
  return { routes: [...routes].sort(), skipped: skipped.sort((a, b) => a.path.localeCompare(b.path)) };
}
