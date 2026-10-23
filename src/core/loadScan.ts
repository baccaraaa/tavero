import { readFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { loadDecisions } from './decisions.js';
import { Scan } from './query.js';
import { TaveroError } from './errors.js';
import type { Component, Finding, Instance, ScaleCounts, ScanMeta, StaticInfo, StyleSample, Token } from './types.js';

async function exists(p: string): Promise<boolean> {
  try { await stat(p); return true; } catch { return false; }
}

/** A scan directory as given, or the latest scan under <target>/.tavero (or under `out`). */
export async function resolveScanDir(target: string, out?: string): Promise<string> {
  if (await exists(join(target, 'scan.json'))) return target;
  const base = out ?? join(target, '.tavero');
  const latest = join(base, 'scans', 'latest');
  if (!(await exists(latest))) throw new TaveroError('no-scan', `No scan found under ${base}; run \`tavero scan\` first`, 2);
  return join(base, 'scans', (await readFile(latest, 'utf8')).trim());
}

const EMPTY_STATIC: StaticInfo = { tailwind: { version: null, theme: null }, hardcodedColors: {}, warnings: [] };
const EMPTY_SCALES: ScaleCounts = { radius: {}, padding: {}, gap: {}, fontSize: {}, fontWeight: {}, shadow: {}, typography: {} };

export async function loadScan(target: string, out?: string): Promise<Scan> {
  const dir = await resolveScanDir(target, out);
  const read = async <T>(f: string, fallback?: T): Promise<T> => {
    try { return JSON.parse(await readFile(join(dir, f), 'utf8')) as T; }
    catch (e) { if (fallback !== undefined) return fallback; throw e; }
  };
  const outDir = out ?? dirname(dirname(dir));
  return new Scan(
    dir,
    await read<ScanMeta>('scan.json'),
    await read<Component[]>('components.json'),
    await read<Instance[]>('instances.json'),
    await read<Token[]>('tokens.json'),
    await read<Finding[]>('findings.json', []),
    await read<StaticInfo>('static.json', EMPTY_STATIC),
    await read<StyleSample[]>('samples.json', []),
    await read<ScaleCounts>('scales.json', EMPTY_SCALES),
    outDir,
    await loadDecisions(outDir),
  );
}
