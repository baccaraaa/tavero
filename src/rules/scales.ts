import type { Evidence, Finding, RuleInput, ScaleProp } from '../core/types.js';
import { SCALE_PROPS } from '../core/types.js';
import { declared } from './declared.js';
import { findingId } from './common.js';

const LABEL: Record<ScaleProp, string> = { radius: 'radius', padding: 'padding', gap: 'gap', fontSize: 'font size', fontWeight: 'font weight', shadow: 'shadow' };
const unit = (prop: ScaleProp, v: string) => (prop === 'shadow' || prop === 'fontWeight' ? v : `${v}px`);

function nearestDeclared(prop: ScaleProp, value: string, declaredSet: Set<string>): string | undefined {
  if (prop === 'shadow') return undefined;
  const n = Number(value);
  let best: { v: string; d: number } | null = null;
  for (const dv of declaredSet) {
    const d = Math.abs(Number(dv) - n);
    if (!best || d < best.d) best = { v: dv, d };
  }
  return best ? unit(prop, best.v) : undefined;
}

/** Spec §11 "scales": used values per property against the declared scale, plus a typography summary. */
export function scalesRule(input: RuleInput): Finding[] {
  const out: Finding[] = [];
  const d = declared(input.tokens, input.staticInfo);
  for (const prop of SCALE_PROPS) {
    const used = Object.entries(input.scales[prop]).sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]));
    const declaredSet = d.scales[prop];
    const off = declaredSet.size ? used.filter(([v]) => !declaredSet.has(v)) : [];
    if (prop !== 'shadow') off.sort((a, b) => Number(a[0]) - Number(b[0]));
    const offUses = off.reduce((n, [, e]) => n + e.count, 0);
    const evidence: Evidence[] = off.map(([v, e]) => ({ route: e.examples[0]?.route, viewport: e.examples[0]?.viewport, component: e.examples[0]?.component, file: e.examples[0]?.file, value: unit(prop, v), expected: nearestDeclared(prop, v, declaredSet) }));
    const severity = !declaredSet.size || off.length === 0 ? 'info' : off.length >= 10 ? 'high' : 'medium';
    out.push({
      id: findingId('scales', prop), rule: 'scales', key: prop, severity,
      title: `${used.length} distinct ${LABEL[prop]} values, ${declaredSet.size} declared`,
      summary: !declaredSet.size
        ? `No ${LABEL[prop]} scale is declared (no tokens, no Tailwind); values seen: ${used.slice(0, 8).map(([v]) => unit(prop, v)).join(', ')}.`
        : off.length ? `${off.length} value(s) outside the declared scale, used ${offUses} time(s).` : `Every ${LABEL[prop]} value is on the declared scale.`,
      stats: { values: used.length, declared: declaredSet.size, offScale: off.length, offScaleUses: offUses },
      evidence,
    });
  }
  const combos = Object.entries(input.scales.typography).sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]));
  out.push({
    id: findingId('scales', 'typography'), rule: 'scales', key: 'typography', severity: 'info',
    title: `${combos.length} distinct size/weight/line-height combinations`,
    summary: combos.length ? `Top: ${combos.slice(0, 3).map(([k, e]) => `${k} (${e.count})`).join(', ')}.` : 'No text measured.',
    stats: { combos: combos.length },
    evidence: combos.slice(0, 5).map(([k, e]) => {
      const [size, weight, lh] = k.split('/');
      return { route: e.examples[0]?.route, component: e.examples[0]?.component, file: e.examples[0]?.file, value: `${size}px / ${weight} / ${lh === 'n' ? 'normal' : lh + 'px'} — ${e.count} uses` };
    }),
  });
  return out;
}
