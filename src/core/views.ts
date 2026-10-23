import { basename, resolve } from 'node:path';
import type { Scan } from './query.js';
import type { Component, DiffResult, Finding, ScanMeta } from './types.js';
import type { ScanResult } from './scan.js';
import { TaveroError } from './errors.js';
import { diffScans, listScans, partialNote } from './diff.js';
import { loadScan, resolveScanDir } from './loadScan.js';

/** One representation per answer, shared by `tavero … --json` and the MCP tools. */
export type ComponentDetail = Component & { instancesByPage: Record<string, string[]>; crops: string[] };
export type FindingRow = Pick<Finding, 'id' | 'severity' | 'rule' | 'title'>;
export type ComponentRow = Pick<Component, 'id' | 'name' | 'file'>;
export interface DiffView {
  from: string; to: string;
  findings: { new: FindingRow[]; resolved: FindingRow[]; unchanged: DiffResult['findings']['unchanged'] };
  components: { added: ComponentRow[]; removed: ComponentRow[] };
  staleRoutes: number; note: string | null;
}
export interface ScanSummary { dir: string; scan: string; stats: ScanMeta['stats']; stale: boolean; staleRoutes: string[]; diff: ScanMeta['diff']; unauthenticatedRoutes: string[]; warnings: string[] }

export function findingView(s: Scan, id: string, q: { evidenceLimit?: number; evidencePage?: number } = {}): Finding & { evidenceTotal: number } {
  const f = s.finding(id, q);
  if (!f) throw new TaveroError('unknown-finding', `finding "${id}" not found`, 1);
  return f;
}

export function componentView(s: Scan, idOrName: string): ComponentDetail {
  const c = s.component(idOrName);
  if (!c) throw new TaveroError('unknown-component', `component "${idOrName}" not found`, 1);
  const byPage = new Map<string, Set<string>>();
  for (const i of s.instancesOf(c.id)) { const set = byPage.get(i.route) ?? new Set<string>(); set.add(i.viewport); byPage.set(i.route, set); }
  return { ...c, instancesByPage: Object.fromEntries([...byPage].map(([r, v]) => [r, [...v]])), crops: s.crops(c.id) };
}

export function showView(s: Scan, idOrName: string, viewport?: string): { crops: string[] } {
  if (!s.component(idOrName)) throw new TaveroError('unknown-component', `component "${idOrName}" not found`, 1);
  return { crops: s.crops(idOrName, viewport) };
}

const row = (f: Finding): FindingRow => ({ id: f.id, severity: f.severity, rule: f.rule, title: f.title });
const crow = (c: Component): ComponentRow => ({ id: c.id, name: c.name, file: c.file });

export async function diffView(projectDir: string, out: string | undefined, from?: string, to?: string): Promise<DiffView> {
  const outDir = out ?? resolve(projectDir, '.tavero');
  const scans = await listScans(outDir);
  const toDir = to ? resolve(outDir, 'scans', to) : await resolveScanDir(projectDir, out);
  const fromName = from ?? scans[scans.indexOf(basename(toDir)) - 1];
  if (!fromName) throw new TaveroError('no-previous-scan', 'need two scans to diff', 2);
  const d = await diffScans(resolve(outDir, 'scans', fromName), toDir);
  const staleRoutes = (await loadScan(toDir)).meta.staleRoutes?.length ?? 0;
  return {
    from: d.from, to: d.to,
    findings: { new: d.findings.new.map(row), resolved: d.findings.resolved.map(row), unchanged: d.findings.unchanged },
    components: { added: d.components.added.map(crow), removed: d.components.removed.map(crow) },
    staleRoutes, note: staleRoutes ? partialNote(staleRoutes) : null,
  };
}

export function scanView(res: ScanResult): ScanSummary {
  const unauthenticatedRoutes = res.meta.routes.filter((r) => r.status === 'unauthenticated').map((r) => r.path);
  const warnings = [...res.warnings];
  if (unauthenticatedRoutes.length) warnings.push(`${unauthenticatedRoutes.length} route(s) landed on a login page (${unauthenticatedRoutes.join(', ')}); the saved session is missing or expired, ask the human to run \`tavero login --url <login url>\``);
  return { dir: res.dir, scan: basename(res.dir), stats: res.meta.stats, stale: res.meta.stale, staleRoutes: res.meta.staleRoutes, diff: res.meta.diff, unauthenticatedRoutes, warnings };
}
