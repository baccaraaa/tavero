import type { Finding, RuleInput, Role } from '../core/types.js';
import { groupVariants, nearVariants, describeSignature } from './signature.js';
import { findingId, variantEvidence, groupedSampleEvidence } from './common.js';

const ROLE_KEY: Record<string, string> = { 'button-text': 'text', 'button-icon': 'icon' };
const COMPONENT_LOOKS_LIKE_BUTTON = /button|btn/i;

/** Spec §11 "buttons": style variants per role, near-duplicate pairs, buttons written outside button components. */
export function buttonsRule(input: RuleInput): Finding[] {
  const out: Finding[] = [];
  for (const role of ['button-text', 'button-icon'] as Role[]) {
    const variants = groupVariants(input.samples, role);
    if (!variants.length) continue;
    const samples = variants.reduce((n, v) => n + v.count, 0);
    const key = `variants:${ROLE_KEY[role]}`;
    out.push({
      id: findingId('buttons', key), rule: 'buttons', key,
      severity: variants.length >= 5 ? 'high' : variants.length >= 2 ? 'medium' : 'info',
      title: `${variants.length} ${role === 'button-text' ? 'text button' : 'icon button'} style${variants.length === 1 ? '' : 's'}`,
      summary: variants.length === 1
        ? `All ${samples} ${role} samples share one style.`
        : `${samples} ${role} samples fall into ${variants.length} distinct styles; the most common is used ${variants[0].count} time(s).`,
      stats: { variants: variants.length, samples },
      evidence: variants.map((v) => variantEvidence(v, input.instances)),
    });
    for (const { a, b, differs } of nearVariants(variants)) {
      const key2 = `near:${a.id}:${b.id}`;
      out.push({
        id: findingId('buttons', key2), rule: 'buttons', key: key2, severity: 'medium',
        title: `Two ${ROLE_KEY[role]} button styles differ only in ${differs.join(', ')}`,
        summary: `${a.count} and ${b.count} samples; unify on one of them.`,
        stats: { a: a.count, b: b.count, differs: differs.length },
        evidence: [
          { ...variantEvidence(a, input.instances), value: `${describeSignature(a.signature)} (${differs.map((d) => `${d}=${a.signature[d]}`).join(', ')})` },
          { ...variantEvidence(b, input.instances), value: `${describeSignature(b.signature)} (${differs.map((d) => `${d}=${b.signature[d]}`).join(', ')})` },
        ],
      });
    }
  }
  const raw = input.samples.filter((s) => (s.role === 'button-text' || s.role === 'button-icon') && s.hops === 0 && s.componentName && !COMPONENT_LOOKS_LIKE_BUTTON.test(s.componentName));
  if (raw.length) {
    const evidence = groupedSampleEvidence(raw, input.instances, (s) => s.text || '(icon)');
    out.push({
      id: findingId('buttons', 'raw'), rule: 'buttons', key: 'raw', severity: 'medium',
      title: `${evidence.length} place(s) write <button> directly in page or section markup`,
      summary: `${raw.length} button sample(s) are rendered by components that are not button components; move them to the shared button component.`,
      stats: { samples: raw.length, places: evidence.length },
      evidence,
    });
  }
  return out;
}
