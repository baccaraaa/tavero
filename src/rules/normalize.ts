import { parse, formatHex, formatHex8, differenceCiede2000 } from 'culori';
import type { NormalizedStyles } from '../core/types.js';

const ciede = differenceCiede2000();

/** Any CSS color → lowercase hex; null for transparent, fully transparent alpha, or unparsable. */
export function hex(css: string | undefined | null): string | null {
  if (!css) return null;
  const v = css.trim();
  if (v === 'transparent' || v === 'none') return null;
  const c = parse(v);
  if (!c) return null;
  const alpha = c.alpha ?? 1;
  if (alpha <= 0) return null;
  return alpha >= 1 ? formatHex(c) : formatHex8(c);
}

/** A px length → rounded integer; anything else → 0. */
export function px(css: string | undefined | null): number {
  if (!css) return 0;
  const m = css.trim().match(/^(-?[\d.]+)px$/);
  return m ? Math.round(Number(m[1])) : 0;
}

/** Split on whitespace, keeping function calls like rgba(...) together. */
function shadowTokens(part: string): string[] {
  const tokens: string[] = [];
  let depth = 0, cur = '';
  for (const ch of part) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (/\s/.test(ch) && depth === 0) { if (cur) tokens.push(cur); cur = ''; }
    else cur += ch;
  }
  if (cur) tokens.push(cur);
  return tokens;
}

/**
 * Any box-shadow (computed "rgba(0,0,0,.1) 0px 1px 2px 0px" or authored "0 1px 2px rgba(0,0,0,.1)")
 * → "0 1 2 0 #0000001a"; several shadows joined with ", ".
 */
export function normalizeShadow(css: string | undefined | null): string {
  if (!css || css.trim() === 'none') return 'none';
  const parts = css.split(/,(?![^(]*\))/).map((s) => s.trim()).filter(Boolean);
  const out: string[] = [];
  for (const part of parts) {
    let color = '#000000';
    let inset = false;
    const nums: number[] = [];
    for (const t of shadowTokens(part)) {
      if (t === 'inset') { inset = true; continue; }
      if (/^-?[\d.]+(px|rem|em)?$/.test(t)) { nums.push(/rem|em$/.test(t) ? Math.round(parseFloat(t) * 16) : Math.round(parseFloat(t))); continue; }
      const h = hex(t);
      if (h) color = h;
    }
    while (nums.length < 4) nums.push(0);
    if (nums.every((v) => v === 0)) continue; // "0 0 #0000" placeholders from Tailwind ring utilities
    out.push(`${nums[0]} ${nums[1]} ${nums[2]} ${nums[3]} ${color}${inset ? ' inset' : ''}`);
  }
  return out.length ? out.join(', ') : 'none';
}

export function firstFamily(css: string | undefined | null): string {
  if (!css) return '';
  return css.split(',')[0].trim().replace(/^["']|["']$/g, '');
}

const WEIGHTS: Record<string, number> = { normal: 400, bold: 700, lighter: 300, bolder: 700 };

export function normalizeStyles(s: Record<string, string>): NormalizedStyles {
  const g = (k: string) => s[k] ?? '';
  const radius: [number, number, number, number] = [px(g('border-top-left-radius')), px(g('border-top-right-radius')), px(g('border-bottom-right-radius')), px(g('border-bottom-left-radius'))];
  const padding: [number, number, number, number] = [px(g('padding-top')), px(g('padding-right')), px(g('padding-bottom')), px(g('padding-left'))];
  const lh = g('line-height');
  const fw = g('font-weight');
  const borderStyle = g('border-top-style') || 'none';
  const borderWidth = borderStyle === 'none' ? 0 : px(g('border-top-width'));
  return {
    bg: hex(g('background-color')),
    color: hex(g('color')),
    borderWidth,
    borderStyle,
    borderColor: borderWidth > 0 ? hex(g('border-top-color')) : null,
    radius,
    paddingY: padding[0],
    paddingX: padding[3],
    padding,
    gap: px(g('gap')),
    fontSize: px(g('font-size')),
    fontWeight: WEIGHTS[fw] ?? (Number(fw) || 400),
    lineHeight: /px$/.test(lh) ? px(lh) : null,
    fontFamily: firstFamily(g('font-family')),
    shadow: normalizeShadow(g('box-shadow')),
    height: px(g('height')),
    display: g('display') || 'block',
    position: g('position') || 'static',
  };
}

export function deltaE(a: string, b: string): number {
  const ca = parse(a), cb = parse(b);
  if (!ca || !cb) return Number.POSITIVE_INFINITY;
  return ciede(ca, cb);
}

export function nearColor(a: string | null, b: string | null, max = 5): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return deltaE(a, b) < max;
}
