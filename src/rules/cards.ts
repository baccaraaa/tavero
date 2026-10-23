import type { Finding, RuleInput } from '../core/types.js';
import { groupVariants, nearVariants, describeSignature } from './signature.js';
import { findingId, variantEvidence, groupedSampleEvidence } from './common.js';

const COMPONENT_LOOKS_LIKE_CARD = /card|panel|tile/i;

/** Spec §11 "cards" (preliminary): card-like container variants, near pairs, inline cards. */
export function cardsRule(input: RuleInput): Finding[] {
  const out: Finding[] = [];
  const variants = groupVariants(input.samples, 'card');
  if (!variants.length) return out;
  const samples = variants.reduce((n, v) => n + v.count, 0);
  out.push({
    id: findingId('cards', 'variants'), rule: 'cards', key: 'variants', preliminary: true,
    severity: variants.length >= 5 ? 'high' : variants.length >= 2 ? 'medium' : 'info',
    title: `${variants.length} card style${variants.length === 1 ? '' : 's'}`,
    summary: variants.length === 1
      ? `All ${samples} card samples share one style.`
      : `${samples} card-like containers fall into ${variants.length} distinct styles (background, border, radius, padding, shadow).`,
    stats: { variants: variants.length, samples },
    evidence: variants.map((v) => { const e = variantEvidence(v, input.instances); return { ...e, value: e.value + (v.example.nested ? ' [nested]' : '') }; }),
  });
  for (const { a, b, differs } of nearVariants(variants)) {
    const key = `near:${a.id}:${b.id}`;
    out.push({
      id: findingId('cards', key), rule: 'cards', key, preliminary: true, severity: 'medium',
      title: `Two card styles differ only in ${differs.join(', ')}`,
      summary: `${a.count} and ${b.count} samples; unify on one of them.`,
      stats: { a: a.count, b: b.count, differs: differs.length },
      evidence: [
        { ...variantEvidence(a, input.instances), value: `${describeSignature(a.signature)} (${differs.map((d) => `${d}=${a.signature[d]}`).join(', ')})` },
        { ...variantEvidence(b, input.instances), value: `${describeSignature(b.signature)} (${differs.map((d) => `${d}=${b.signature[d]}`).join(', ')})` },
      ],
    });
  }
  const raw = input.samples.filter((s) => s.role === 'card' && s.hops === 0 && s.componentName && !COMPONENT_LOOKS_LIKE_CARD.test(s.componentName));
  if (raw.length) {
    const evidence = groupedSampleEvidence(raw, input.instances, (s) => `${describeSignature({ bg: s.styles.bg, borderWidth: s.styles.borderWidth, borderColor: s.styles.borderColor, radius: s.styles.radius.join('/'), paddingY: s.styles.paddingY, paddingX: s.styles.paddingX, shadow: s.styles.shadow })}${s.nested ? ' [nested]' : ''}`);
    out.push({
      id: findingId('cards', 'raw'), rule: 'cards', key: 'raw', preliminary: true, severity: 'medium',
      title: `${evidence.length} place(s) build card-like containers inline instead of a card component`,
      summary: `${raw.length} container sample(s) look like cards but are rendered by non-card components; consider the shared card component.`,
      stats: { samples: raw.length, places: evidence.length },
      evidence,
    });
  }
  return out;
}
