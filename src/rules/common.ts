import type { Evidence, Instance, RuleName, StyleSample } from '../core/types.js';
import { hashId } from '../core/ids.js';
import type { Variant } from './signature.js';
import { describeSignature } from './signature.js';

/** Stable finding id: the same rule + key always hashes to the same id across scans. */
export const findingId = (rule: RuleName, key: string): string => hashId('f', `${rule}:${key}`);

/** First crop of a component at a viewport (falls back to any viewport). */
export function cropFor(instances: Instance[], componentId: string | null, viewport: string): string | undefined {
  if (!componentId) return undefined;
  return instances.find((i) => i.componentId === componentId && i.viewport === viewport && i.crop)?.crop
    ?? instances.find((i) => i.componentId === componentId && i.crop)?.crop;
}

export function topKey(record: Record<string, number>): string | null {
  const e = Object.entries(record).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return e.length ? e[0][0] : null;
}

/** The variant's own crop: the example's width first, else any width it was cropped at. */
const variantCrop = (v: Variant): string | undefined => v.example.crop ?? v.crops?.[v.example.viewport] ?? Object.values(v.crops ?? {})[0];

export function variantEvidence(v: Variant, instances: Instance[]): Evidence {
  const s = v.example;
  return {
    route: s.route, viewport: s.viewport, componentId: s.componentId,
    component: topKey(v.components), file: topKey(v.files) ?? s.file, line: s.line,
    value: `${describeSignature(v.signature)} — ${v.count} instance(s) via ${Object.keys(v.components).join(', ') || 'unknown'} on ${v.pages.length} page(s)`,
    crop: variantCrop(v) ?? cropFor(instances, s.componentId, s.viewport), sampleId: s.id, variantId: v.id,
  };
}

export function sampleEvidence(s: StyleSample, instances: Instance[], value: string): Evidence {
  return { route: s.route, viewport: s.viewport, componentId: s.componentId, component: s.componentName, file: s.file, line: s.line, value, crop: cropFor(instances, s.componentId, s.viewport), sampleId: s.id };
}

/** One evidence row per source place (file:line), with the number of samples it produced; most frequent first. */
export function groupedSampleEvidence(samples: StyleSample[], instances: Instance[], valueOf: (s: StyleSample) => string): Evidence[] {
  const groups = new Map<string, { s: StyleSample; n: number }>();
  for (const s of samples) {
    const key = `${s.file ?? '?'}:${s.line ?? 0}:${valueOf(s)}`;
    const g = groups.get(key);
    if (g) g.n++; else groups.set(key, { s, n: 1 });
  }
  return [...groups.values()]
    .sort((a, b) => b.n - a.n || (a.s.file ?? '').localeCompare(b.s.file ?? ''))
    .map(({ s, n }) => sampleEvidence(s, instances, valueOf(s) + (n > 1 ? ` ×${n}` : '')));
}
