// Next 16 names static-export prefetch files by replacing "/" with "." in the segment path
// (`__next.docs.quick-start.__PAGE__.txt`), but on Windows the collected paths use "\", so the files land in
// nested folders (`__next.docs/quick-start/__PAGE__.txt`) and the client router's prefetches 404.
// This moves them to the flat names. Builds on Linux and macOS have nothing to move.
import { readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const OUT = join(import.meta.dirname, '..', 'out');
let moved = 0;
const files = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? files(p) : [p]; });
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (!statSync(p).isDirectory()) continue;
    if (!name.startsWith('__next.')) { walk(p); continue; }
    for (const f of files(p)) { renameSync(f, join(dir, `${name}.${relative(p, f).split(sep).join('.')}`)); moved++; }
    rmSync(p, { recursive: true });
  }
}
walk(OUT);
if (moved) console.log(`fix-segments: moved ${moved} prefetch file(s) to flat names`);
