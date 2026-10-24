import type { ColorCounts, Component, CountEntry, Instance, PageRecord, ScaleCounts, StyleSample, Token } from '../types.js';
import { SCALE_PROPS } from '../types.js';
import { routeSlug } from '../ids.js';
import { buildTokens } from '../../static/tokens.js';
import { emptyScales } from './page.js';

const MAX_EXAMPLES = 5;

export const pageFileName = (viewport: string, route: string): string => `${viewport}__${routeSlug(route)}.json`;

function mergeEntry(into: Record<string, CountEntry>, from: Record<string, CountEntry>): void {
  for (const [k, v] of Object.entries(from)) {
    const e = into[k] ?? (into[k] = { count: 0, examples: [] });
    e.count += v.count;
    for (const ex of v.examples) if (e.examples.length < MAX_EXAMPLES) e.examples.push(ex);
  }
}

type ComponentAcc = Component & { propSet: Set<string>; pageSet: Set<string> };

/** Pure aggregation of page records into the scan-level files. */
export function aggregate(pages: PageRecord[], opts: { declMap: Map<string, { file: string; line: number; value?: string }> }): { components: Component[]; instances: Instance[]; samples: StyleSample[]; colors: ColorCounts; scales: ScaleCounts; tokens: Token[] } {
  const comps = new Map<string, ComponentAcc>();
  const instances: Instance[] = [];
  const samples: StyleSample[] = [];
  const colors: ColorCounts = {};
  const scales = emptyScales();
  let tokens: Token[] = [];
  for (const p of pages) {
    for (const i of p.instances) {
      let c = comps.get(i.componentId);
      if (!c) {
        c = { id: i.componentId, name: i.name, file: i.file, line: i.line, resolved: i.resolved, instances: 0, pages: [], props: [], propSet: new Set(), pageSet: new Set() };
        comps.set(i.componentId, c);
      }
      c.instances++;
      c.pageSet.add(p.route);
      for (const pr of i.props) c.propSet.add(pr);
      const { key: _k, name: _n, file: _f, line: _l, resolved: _r, props: _p, ...plain } = i;
      instances.push(plain);
    }
    samples.push(...p.samples);
    for (const [hex, v] of Object.entries(p.colors)) {
      const c = colors[hex] ?? (colors[hex] = { bg: 0, color: 0, border: 0, examples: [] });
      c.bg += v.bg; c.color += v.color; c.border += v.border;
      for (const ex of v.examples) if (c.examples.length < MAX_EXAMPLES) c.examples.push(ex);
    }
    for (const k of [...SCALE_PROPS, 'typography'] as const) mergeEntry(scales[k], p.scales[k]);
    if (!tokens.length && p.tokens && p.tokens.decls.length) tokens = buildTokens(p.tokens.decls, p.tokens.values, opts.declMap);
  }
  const components = [...comps.values()]
    .map(({ propSet, pageSet, ...c }) => ({ ...c, props: [...propSet].sort(), pages: [...pageSet].sort() }))
    .sort((a, b) => b.instances - a.instances || a.name.localeCompare(b.name));
  return { components, instances, samples, colors, scales, tokens };
}
