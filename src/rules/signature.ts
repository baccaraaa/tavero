import type { NormalizedStyles, Role, StyleSample } from '../core/types.js';
import { hashId } from '../core/ids.js';
import { nearColor } from './normalize.js';

export type Signature = Record<string, string | number | null>;
export interface Variant {
  id: string;
  role: Role;
  signature: Signature;
  count: number;
  sampleIds: string[];
  components: Record<string, number>;
  files: Record<string, number>;
  pages: string[];
  example: StyleSample;
  /** viewport → crop of this variant (from samples that carry one) */
  crops?: Record<string, string>;
}

const radiusKey = (r: [number, number, number, number]) => r.join('/');

export function buttonSignature(n: NormalizedStyles): Signature {
  return { radius: radiusKey(n.radius), paddingY: n.paddingY, paddingX: n.paddingX, fontSize: n.fontSize, fontWeight: n.fontWeight, bg: n.bg, color: n.color, borderWidth: n.borderWidth, borderColor: n.borderColor, shadow: n.shadow };
}

export function cardSignature(n: NormalizedStyles): Signature {
  return { bg: n.bg, borderWidth: n.borderWidth, borderColor: n.borderColor, radius: radiusKey(n.radius), paddingY: n.paddingY, paddingX: n.paddingX, shadow: n.shadow };
}

export function signatureKey(sig: Signature): string {
  return Object.entries(sig).map(([k, v]) => `${k}=${v ?? ''}`).join('|');
}

export function variantId(sig: Signature): string {
  return hashId('v', signatureKey(sig));
}

export function describeSignature(sig: Signature): string {
  const parts: string[] = [];
  parts.push(sig.bg ? `bg ${sig.bg}` : 'no bg');
  if ('color' in sig) parts.push(sig.color ? `text ${sig.color}` : 'no text color');
  if (typeof sig.radius === 'string') { const corners = sig.radius.split('/'); parts.push(`radius ${new Set(corners).size === 1 ? corners[0] : sig.radius}`); }
  parts.push(`padding ${sig.paddingY}/${sig.paddingX}`);
  if ('fontSize' in sig) parts.push(`${sig.fontSize}px/${sig.fontWeight}`);
  parts.push(sig.borderWidth ? `border ${sig.borderWidth}px ${sig.borderColor ?? ''}`.trim() : 'no border');
  parts.push(sig.shadow && sig.shadow !== 'none' ? `shadow ${sig.shadow}` : 'no shadow');
  return parts.join(', ');
}

/** Group samples of one role by exact signature; most common first. */
export function groupVariants(samples: StyleSample[], role: Role): Variant[] {
  const sigFn = role === 'card' ? cardSignature : buttonSignature;
  const map = new Map<string, Variant>();
  for (const s of samples) {
    if (s.role !== role) continue;
    const sig = sigFn(s.styles);
    const id = variantId(sig);
    let v = map.get(id);
    if (!v) { v = { id, role, signature: sig, count: 0, sampleIds: [], components: {}, files: {}, pages: [], example: s }; map.set(id, v); }
    v.count++;
    v.sampleIds.push(s.id);
    if (s.componentName) v.components[s.componentName] = (v.components[s.componentName] ?? 0) + 1;
    if (s.file) v.files[s.file] = (v.files[s.file] ?? 0) + 1;
    if (!v.pages.includes(s.route)) v.pages.push(s.route);
    if (s.crop) (v.crops ??= {})[s.viewport] ??= s.crop;
  }
  return [...map.values()].map((v) => ({ ...v, pages: v.pages.sort() })).sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
}

const NUMERIC = new Set(['paddingY', 'paddingX', 'borderWidth', 'fontSize']);
const COLORS = new Set(['bg', 'color', 'borderColor']);

function fieldNear(k: string, a: string | number | null, b: string | number | null): boolean {
  if (a === b) return true;
  if (NUMERIC.has(k)) return typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= 2;
  if (COLORS.has(k)) return nearColor(a as string | null, b as string | null, 5);
  if (k === 'radius' && typeof a === 'string' && typeof b === 'string') {
    const x = a.split('/').map(Number), y = b.split('/').map(Number);
    return x.every((v, i) => Math.abs(v - y[i]) <= 2);
  }
  return false;
}

/** Pairs of variants that differ only within tolerance (lengths ≤ 2 px, colors ΔE < 5). */
export function nearVariants(variants: Variant[]): Array<{ a: Variant; b: Variant; differs: string[] }> {
  const out: Array<{ a: Variant; b: Variant; differs: string[] }> = [];
  for (let i = 0; i < variants.length; i++) {
    for (let j = i + 1; j < variants.length; j++) {
      const a = variants[i], b = variants[j];
      const differs = Object.keys(a.signature).filter((k) => a.signature[k] !== b.signature[k]);
      if (differs.length === 0 || !differs.every((k) => fieldNear(k, a.signature[k], b.signature[k]))) continue;
      out.push(a.id < b.id ? { a, b, differs } : { a: b, b: a, differs });
    }
  }
  return out;
}
