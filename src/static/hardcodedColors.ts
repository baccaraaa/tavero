import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { parseColor } from './tokens.js';

const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'build', '.git', 'out', 'public', '.tavero']);
const LITERAL = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b|rgba?\([^)]*\)|hsla?\([^)]*\)/gi;
const ARBITRARY = /-\[(#[0-9a-f]{3,8}|rgba?\([^\]]*\)|hsla?\([^\]]*\))\]/gi;

async function walk(dir: string, out: string[]): Promise<void> {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) await walk(full, out); }
    else if (/\.(tsx|jsx|ts|js|mjs|cjs|css)$/.test(e.name) && !/\.d\.ts$/.test(e.name)) out.push(full);  // class maps often live in .ts files
  }
}

/** Color literals in source, keyed by normalized hex, excluding custom-property declarations and token files. */
export async function findHardcodedColors(projectDir: string, srcRoots: string[], excludeFiles: Set<string>): Promise<Record<string, Array<{ file: string; line: number }>>> {
  const out: Record<string, Array<{ file: string; line: number }>> = {};
  for (const root of srcRoots) {
    const files: string[] = [];
    await walk(root, files);
    for (const f of files.sort()) {
      const rel = relative(projectDir, f).replace(/\\/g, '/');
      if (excludeFiles.has(rel)) continue;
      const lines = (await readFile(f, 'utf8')).split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/^\s*--[\w-]+\s*:/.test(line)) continue;
        const seen = new Set<string>();
        // Tailwind arbitrary values write spaces as underscores: bg-[hsl(265_70%_58%/0.13)]
        const arbitrary = [...line.matchAll(ARBITRARY)].map((x) => x[1].replace(/_/g, ' '));
        const matches = arbitrary.concat([...line.replace(ARBITRARY, '').matchAll(LITERAL)].map((x) => x[0]));
        for (const m of matches) {
          if (m.includes('var(')) continue; // hsl(var(--token)) is a token reference, not a literal
          const h = parseColor(m);
          if (!h || seen.has(h)) continue;
          seen.add(h);
          (out[h] ?? (out[h] = [])).push({ file: rel, line: i + 1 });
        }
      }
    }
  }
  return out;
}

const TOKEN_REF = /var\(\s*(--[\w-]+)/g;

/** Token names each source file references through var(--…), sorted; files without references are left out. */
export async function findTokenRefs(projectDir: string, srcRoots: string[]): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {};
  for (const root of srcRoots) {
    const files: string[] = [];
    await walk(root, files);
    for (const f of files.sort()) {
      const names = new Set([...(await readFile(f, 'utf8')).matchAll(TOKEN_REF)].map((m) => m[1]));
      if (names.size) out[relative(projectDir, f).replace(/\\/g, '/')] = [...names].sort();
    }
  }
  return out;
}
