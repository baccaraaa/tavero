import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

export type ComponentIndex = Map<string, Array<{ file: string; line: number }>>;

const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'build', '.git', 'out', 'public', '.tavero']);
// a default-exported function is a component whatever its case: Next pages are often `export default function page()`
const DEFAULT_FN = /^\s*export\s+default\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*[<(]/;
const FN_DECL = /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Z][A-Za-z0-9_]*)\s*[<(]/;
const CONST_DECL = /^\s*(?:export\s+)?const\s+([A-Z][A-Za-z0-9_]*)\s*(?::\s*[^=]+)?=\s*(?:React\.)?(?:memo|forwardRef)?\s*[<(]?\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*(?::[^=]*)?=>|[A-Za-z_$][\w$]*\s*=>|\(\s*\{)/;

async function walk(dir: string, onFile: (full: string) => Promise<void>): Promise<void> {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) await walk(full, onFile); continue; }
    if (/\.(tsx|jsx|ts)$/.test(e.name) && !/\.d\.ts$/.test(e.name)) await onFile(full);
  }
}

export async function buildComponentIndex(projectDir: string, srcRoots: string[]): Promise<ComponentIndex> {
  const index: ComponentIndex = new Map();
  for (const root of srcRoots) {
    await walk(root, async (full) => {
      const rel = relative(projectDir, full).replace(/\\/g, '/');
      const lines = (await readFile(full, 'utf8')).split('\n');
      for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(FN_DECL) ?? lines[i].match(CONST_DECL) ?? lines[i].match(DEFAULT_FN);
        if (!m) continue;
        const list = index.get(m[1]) ?? [];
        list.push({ file: rel, line: i + 1 });
        index.set(m[1], list);
      }
    });
  }
  return index;
}

export function collisions(index: ComponentIndex): Array<{ name: string; files: string[] }> {
  const out: Array<{ name: string; files: string[] }> = [];
  for (const [name, list] of index) {
    const files = [...new Set(list.map((x) => x.file))].sort();
    if (files.length > 1) out.push({ name, files });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
