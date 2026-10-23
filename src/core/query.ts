import { dirname, isAbsolute, join } from 'node:path';
import { readFile } from 'node:fs/promises';
import type { Component, Finding, Instance, RuleName, ScaleCounts, ScanMeta, Severity, StaticInfo, StyleSample, Token, TokenKind } from './types.js';
import { buildContext } from '../context/context.js';
import { applyDecisions, canonicalByRole, type Decisions } from './decisions.js';

export interface Paged<T> { items: T[]; total: number; page: number; limit: number }

const page = <T>(all: T[], limit = 20, pageNo = 1): Paged<T> => ({ items: all.slice((pageNo - 1) * limit, pageNo * limit), total: all.length, page: pageNo, limit });

/** Read-only view over one scan directory; every query is paged so agents never get the whole inventory at once. */
export class Scan {
  constructor(
    public dir: string,
    public meta: ScanMeta,
    private comps: Component[],
    private insts: Instance[],
    private toks: Token[],
    private finds: Finding[] = [],
    private stat: StaticInfo = { tailwind: { version: null, theme: null }, hardcodedColors: {}, warnings: [] },
    public samples: StyleSample[] = [],
    public scales: ScaleCounts = { radius: {}, padding: {}, gap: {}, fontSize: {}, fontWeight: {}, shadow: {}, typography: {} },
    /** the .tavero folder that holds scans/ and decisions.json */
    public outDir: string = dirname(dirname(dir)),
    private dec: Decisions = { version: 1, findings: {} },
  ) {}

  get staticInfo(): StaticInfo { return this.stat; }
  /** findings with human decisions applied; accepted and fully canonical ones removed */
  get allFindings(): Finding[] { return applyDecisions(this.finds, this.dec); }
  /** findings exactly as the scan wrote them */
  get rawFindings(): Finding[] { return this.finds; }
  get decisions(): Decisions { return this.dec; }

  /** viewport → absolute crop path of one style variant (crops/variants/<id>/<viewport>.png, possibly in an earlier scan) */
  variantCrops(variantId: string): Record<string, string> {
    const out: Record<string, string> = {};
    const re = new RegExp(`[\\\\/]variants[\\\\/]${variantId}[\\\\/]([^\\\\/.]+)\\.png$`);
    for (const s of this.samples) {
      const m = s.crop?.match(re);
      if (m && !out[m[1]]) out[m[1]] = isAbsolute(s.crop!) ? s.crop! : join(this.dir, s.crop!);
    }
    return out;
  }
  get allComponents(): Component[] { return this.comps; }
  get allTokens(): Token[] { return this.toks; }

  components(q: { sort?: 'instances' | 'name'; limit?: number; page?: number; query?: string; unresolvedOnly?: boolean } = {}): Paged<Component> {
    let list = this.comps;
    if (q.query) {
      const needle = q.query.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(needle) || (c.file ?? '').toLowerCase().includes(needle));
    }
    if (q.unresolvedOnly) list = list.filter((c) => !c.file);
    list = [...list].sort(q.sort === 'name' ? (a, b) => a.name.localeCompare(b.name) : (a, b) => b.instances - a.instances || a.name.localeCompare(b.name));
    return page(list, q.limit, q.page);
  }

  component(idOrName: string): Component | null {
    return this.comps.find((c) => c.id === idOrName) ?? this.comps.find((c) => c.name === idOrName) ?? null;
  }

  instancesOf(componentId: string, viewport?: string): Instance[] {
    return this.insts.filter((i) => i.componentId === componentId && (!viewport || i.viewport === viewport));
  }

  crops(idOrName: string, viewport?: string): string[] {
    const c = this.component(idOrName);
    if (!c) return [];
    return this.instancesOf(c.id, viewport)
      .map((i) => i.crop)
      .filter((x): x is string => !!x)
      .map((p) => (isAbsolute(p) ? p : join(this.dir, p)));
  }

  tokens(q: { kind?: TokenKind; limit?: number; page?: number } = {}): Paged<Token> {
    return page(q.kind ? this.toks.filter((t) => t.kind === q.kind) : this.toks, q.limit ?? 200, q.page);
  }

  findings(q: { rule?: RuleName; severity?: Severity; limit?: number; page?: number; decision?: 'none' | 'fix' | 'reopened'; includeAccepted?: boolean } = {}): Paged<Finding & { evidenceCount: number }> {
    let list = applyDecisions(this.finds, this.dec, { includeHidden: q.includeAccepted });
    if (q.decision) list = list.filter((f) => (q.decision === 'none' ? f.decision?.status == null : f.decision?.status === q.decision));
    if (q.rule) list = list.filter((f) => f.rule === q.rule);
    if (q.severity) list = list.filter((f) => f.severity === q.severity);
    return page(list.map((f) => ({ ...f, evidence: [], evidenceCount: f.evidence.length })), q.limit, q.page);
  }

  finding(id: string, q: { evidenceLimit?: number; evidencePage?: number } = {}): (Finding & { evidenceTotal: number }) | null {
    const f = applyDecisions(this.finds, this.dec, { includeHidden: true }).find((x) => x.id === id);
    if (!f) return null;
    const limit = q.evidenceLimit ?? 20, pg = q.evidencePage ?? 1;
    return { ...f, evidence: f.evidence.slice((pg - 1) * limit, pg * limit), evidenceTotal: f.evidence.length };
  }

  async contextMarkdown(): Promise<string> {
    return readFile(join(this.dir, 'context.md'), 'utf8');
  }

  /** Rebuild the agent context from the loaded scan with a specific token budget. */
  regenerateContext(budgetTokens = 1500): string {
    return buildContext({ meta: this.meta, components: this.comps, tokens: this.toks, samples: this.samples, findings: this.allFindings, scales: this.scales, staticInfo: this.stat, budgetTokens, canonical: canonicalByRole(applyDecisions(this.finds, this.dec, { includeHidden: true })) });
  }
}
