import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { DecisionView, Evidence, Finding, Role } from './types.js';
import { TaveroError } from './errors.js';

export interface Decision { status: 'fix' | 'accepted' | null; reason?: string; note?: string; canonical?: { primary: string; allowed: string[]; names?: Record<string, string> }; at: string; places: number }
export interface Decisions { version: 1; findings: Record<string, Decision> }
export type DecisionPatch = Partial<Pick<Decision, 'status' | 'reason' | 'note' | 'canonical'>>;

export const VARIANT_ROLE: Record<string, Role> = { 'buttons:variants:text': 'button-text', 'buttons:variants:icon': 'button-icon', 'cards:variants': 'card' };
export const isVariantFinding = (f: Pick<Finding, 'rule' | 'key'>): boolean => `${f.rule}:${f.key}` in VARIANT_ROLE;
export const decisionsPath = (outDir: string): string => join(outDir, 'decisions.json');

export async function loadDecisions(outDir: string): Promise<Decisions> {
  let text: string;
  try { text = await readFile(decisionsPath(outDir), 'utf8'); } catch { return { version: 1, findings: {} }; }
  try {
    const d = JSON.parse(text) as Decisions;
    return { version: 1, findings: d.findings ?? {} };
  } catch (e) {
    throw new TaveroError('bad-decisions', `${decisionsPath(outDir)} is not valid JSON (${(e as Error).message}); fix or delete it`, 2);
  }
}

// one writer at a time inside this process; the file is replaced atomically
let queue: Promise<unknown> = Promise.resolve();
function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}
async function write(outDir: string, d: Decisions): Promise<void> {
  await mkdir(outDir, { recursive: true });
  const tmp = `${decisionsPath(outDir)}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, JSON.stringify(d, null, 2) + '\n');
  await rename(tmp, decisionsPath(outDir));
}

export function saveDecision(outDir: string, findingId: string, patch: DecisionPatch, places: number): Promise<Decisions> {
  return serialized(async () => {
    const d = await loadDecisions(outDir);
    const prev = d.findings[findingId];
    d.findings[findingId] = { ...prev, ...patch, status: patch.status !== undefined ? patch.status : prev?.status ?? null, at: new Date().toISOString(), places };
    await write(outDir, d);
    return d;
  });
}

export function clearDecision(outDir: string, findingId: string): Promise<Decisions> {
  return serialized(async () => {
    const d = await loadDecisions(outDir);
    delete d.findings[findingId];
    await write(outDir, d);
    return d;
  });
}

/** "DashButton (bg #2d4deb, radius 9999)": the component plus the signature part of a variant evidence value. */
export const variantLabel = (e: Evidence, name?: string): string => `${e.component ?? 'unknown'}${name ? ` "${name}"` : ''} (${e.value.split(' — ')[0]})`;

function withCanonical(f: Finding, c: { primary: string; allowed: string[]; names?: Record<string, string> }): { finding: Finding; resolved: boolean } {
  const primary = f.evidence.find((e) => e.variantId === c.primary);
  if (!primary) return { finding: f, resolved: false };
  const allowed = new Set(c.allowed);
  const targets = [primary, ...f.evidence.filter((e) => e.variantId && allowed.has(e.variantId))];
  const expected = targets.map((e) => variantLabel(e, e.variantId ? c.names?.[e.variantId] : undefined)).join(' or ');
  const evidence = f.evidence.map((e) => e.variantId === c.primary ? { ...e, canonical: 'primary' as const }
    : e.variantId && allowed.has(e.variantId) ? { ...e, canonical: 'allowed' as const } : { ...e, expected });
  const outside = evidence.filter((e) => !e.canonical).length;
  return { finding: { ...f, evidence, stats: { ...f.stats, variants: outside + 1 } }, resolved: outside === 0 };
}

const RANK = (f: Finding): number => (f.decision?.status === 'fix' || f.decision?.status === 'reopened' ? 0 : 1);

/**
 * Spec §5: decisions applied at read time. `accepted` and fully canonical findings are hidden unless
 * `includeHidden`; an accepted finding with more evidence places than when it was accepted comes back
 * as `reopened`; `fix` and `reopened` sort first, the rest keep their order.
 */
export function applyDecisions(findings: Finding[], d: Decisions, opts: { includeHidden?: boolean } = {}): Finding[] {
  const out: Finding[] = [];
  for (const f of findings) {
    const dec = d.findings[f.id];
    if (!dec) { out.push(f); continue; }
    let finding = f;
    let status: DecisionView['status'] = dec.status;
    if (dec.canonical && isVariantFinding(f)) {
      const r = withCanonical(f, dec.canonical);
      finding = r.finding;
      if (r.resolved) status = 'resolved';
    }
    if (status === 'accepted' && f.evidence.length > dec.places) status = 'reopened';
    const view: DecisionView = { status };
    if (dec.reason) view.reason = dec.reason;
    if (dec.note) view.note = dec.note;
    if (dec.canonical) view.canonical = dec.canonical;
    finding = { ...finding, decision: view };
    if (!opts.includeHidden && (status === 'accepted' || status === 'resolved')) continue;
    out.push(finding);
  }
  return out.map((f, i) => ({ f, i })).sort((a, b) => RANK(a.f) - RANK(b.f) || a.i - b.i).map((x) => x.f);
}

export type CanonicalByRole = Partial<Record<Role, { component: string; file: string | null; label: string; allowed: string[] }>>;
/** Canonical variants chosen by a human, per role, from findings that already went through applyDecisions. */
export function canonicalByRole(findings: Finding[]): CanonicalByRole {
  const out: CanonicalByRole = {};
  for (const f of findings) {
    const role = VARIANT_ROLE[`${f.rule}:${f.key}`];
    if (!role || !f.decision?.canonical) continue;
    const primary = f.evidence.find((e) => e.canonical === 'primary');
    if (!primary) continue;
    const names = f.decision.canonical.names ?? {};
    const label = (e: Evidence) => variantLabel(e, e.variantId ? names[e.variantId] : undefined);
    out[role] = { component: primary.component ?? 'unknown', file: primary.file ?? null, label: label(primary), allowed: f.evidence.filter((e) => e.canonical === 'allowed').map(label) };
  }
  return out;
}
