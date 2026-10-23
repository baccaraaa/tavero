import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { Framework, ProjectInfo } from '../core/types.js';
import { TaveroError } from '../core/errors.js';

async function exists(p: string): Promise<boolean> {
  try { await stat(p); return true; } catch { return false; }
}

async function anyExists(dir: string, names: string[]): Promise<boolean> {
  for (const n of names) if (await exists(join(dir, n))) return true;
  return false;
}

/** All .css files under a source root (depth-limited); Tailwind entry files are listed first so their @import closure wins. */
async function findCss(root: string, depth: number, out: { entries: string[]; others: string[] }): Promise<void> {
  if (depth < 0) return;
  let entries;
  try { entries = await readdir(root, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const full = join(root, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') await findCss(full, depth - 1, out); continue; }
    if (!e.name.endsWith('.css')) continue;
    const text = await readFile(full, 'utf8');
    if (/@tailwind\s|@import\s+["']tailwindcss["']/.test(text)) out.entries.push(full);
    else out.others.push(full);
  }
}

export async function detectProject(dir: string): Promise<ProjectInfo> {
  let pkg: Record<string, unknown>;
  try { pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8')); }
  catch { throw new TaveroError('unsupported-project', `No package.json in ${dir}`, 2); }
  const deps = { ...((pkg.dependencies as object) ?? {}), ...((pkg.devDependencies as object) ?? {}) } as Record<string, string>;
  let framework: Framework;
  if (deps.next) framework = 'next';
  else if (deps.vite) framework = 'vite';
  else if (await anyExists(dir, ['next.config.ts', 'next.config.js', 'next.config.mjs'])) framework = 'next';
  else if (await anyExists(dir, ['vite.config.ts', 'vite.config.js', 'vite.config.mjs', 'vite.config.mts'])) framework = 'vite';
  else throw new TaveroError('unsupported-project', `Neither "next" nor "vite" found in ${dir}/package.json, and no next.config.* / vite.config.* file`, 2);

  const candidates = (await exists(join(dir, 'src'))) ? ['src'] : ['app', 'components', 'pages', 'lib'];
  const srcRoots: string[] = [];
  for (const c of candidates) if (await exists(join(dir, c))) srcRoots.push(join(dir, c));

  let tailwindConfig: string | null = null;
  for (const ext of ['ts', 'js', 'cjs', 'mjs']) {
    const p = join(dir, `tailwind.config.${ext}`);
    if (await exists(p)) { tailwindConfig = p; break; }
  }

  const css = { entries: [] as string[], others: [] as string[] };
  for (const root of srcRoots) await findCss(root, 4, css);
  const cssEntries = [...css.entries.sort(), ...css.others.sort()];

  const scripts = (pkg.scripts as Record<string, string>) ?? {};
  return { dir, framework, srcRoots, tailwindConfig, cssEntries, devScript: scripts.dev ?? null, packageJson: pkg };
}
