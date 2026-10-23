import { readFile, readdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { Component, DiffResult, Finding } from './types.js';

async function readJson<T>(dir: string, file: string, fallback: T): Promise<T> {
  try { return JSON.parse(await readFile(join(dir, file), 'utf8')) as T; } catch { return fallback; }
}

/** Scan directory names under <out>/scans, oldest first. */
export async function listScans(outDir: string): Promise<string[]> {
  try { return (await readdir(join(outDir, 'scans'))).filter((n) => n !== 'latest').sort(); } catch { return []; }
}

/** Findings by stable id: new / resolved / unchanged (with changed stats); components by id. */
export async function diffScans(fromDir: string, toDir: string): Promise<DiffResult> {
  const [fa, fb, ca, cb] = await Promise.all([
    readJson<Finding[]>(fromDir, 'findings.json', []), readJson<Finding[]>(toDir, 'findings.json', []),
    readJson<Component[]>(fromDir, 'components.json', []), readJson<Component[]>(toDir, 'components.json', []),
  ]);
  const A = new Map(fa.map((f) => [f.id, f]));
  const B = new Map(fb.map((f) => [f.id, f]));
  const unchanged = fb.filter((f) => A.has(f.id)).map((f) => {
    const prev = A.get(f.id)!;
    const statsChanged: Record<string, [number, number]> = {};
    for (const k of new Set([...Object.keys(prev.stats), ...Object.keys(f.stats)])) if (prev.stats[k] !== f.stats[k]) statsChanged[k] = [prev.stats[k] ?? 0, f.stats[k] ?? 0];
    return { id: f.id, title: f.title, statsChanged };
  });
  const CA = new Set(ca.map((c) => c.id)), CB = new Set(cb.map((c) => c.id));
  return {
    from: basename(fromDir),
    to: basename(toDir),
    findings: { new: fb.filter((f) => !A.has(f.id)), resolved: fa.filter((f) => !B.has(f.id)), unchanged },
    components: { added: cb.filter((c) => !CA.has(c.id)), removed: ca.filter((c) => !CB.has(c.id)) },
  };
}

/** Spec §12: after a partial rescan the diff is only honest for the rescanned routes. */
export const partialNote = (stale: number): string => `partial rescan: stats changed only on the rescanned routes; ${stale} stale route(s) may still carry findings, run a full scan to resolve`;

export function formatDiff(d: DiffResult, opts: { staleRoutes?: number } = {}): string {
  const changed = d.findings.unchanged.filter((u) => Object.keys(u.statsChanged).length).length;
  const base = `diff vs ${d.from}: +${d.findings.new.length} new, -${d.findings.resolved.length} resolved, ${d.findings.unchanged.length} unchanged (${changed} changed stats); components +${d.components.added.length} -${d.components.removed.length}`;
  return opts.staleRoutes ? `${base} — ${partialNote(opts.staleRoutes)}` : base;
}
