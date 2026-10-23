import type { ScaleProp, StaticInfo, Token } from '../core/types.js';
import { SCALE_PROPS } from '../core/types.js';
import { isTailwindDefault } from '../static/tailwind.js';
import { normalizeShadow } from './normalize.js';
import { parseColor } from '../static/tokens.js';

export interface Declared {
  palette: Map<string, string>;           // hex → token or theme name
  hasOwnColors: boolean;                  // the project declares at least one color of its own
  scales: Record<ScaleProp, Set<string>>; // declared values as count keys (px as strings; shadows normalized)
  tailwindVersion: 3 | 4 | null;
}

const TW_RADIUS = [0, 2, 4, 6, 8, 12, 16, 24, 9999];
const TW_SPACING = [0, 1, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 208, 224, 240, 256, 288, 320, 384];
const TW_FONT_SIZE = [12, 14, 16, 18, 20, 24, 30, 36, 48, 60, 72, 96, 128];
const WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];

/** px as is, rem/em × 16, otherwise null. */
export function toPx(css: string): number | null {
  const m = css.trim().match(/^(-?[\d.]+)(px|rem|em)?$/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  return Math.round(m[2] === 'rem' || m[2] === 'em' ? n * 16 : n);
}

export function declared(tokens: Token[], st: StaticInfo): Declared {
  const palette = new Map<string, string>();
  const scales = Object.fromEntries(SCALE_PROPS.map((k) => [k, new Set<string>()])) as Record<ScaleProp, Set<string>>;
  const addPx = (prop: ScaleProp, css: string) => { const v = toPx(css); if (v !== null) scales[prop].add(String(v)); };
  for (const t of tokens) {
    switch (t.kind) {
      case 'color': { const h = parseColor(t.resolved) ?? parseColor(t.value); if (h && !palette.has(h)) palette.set(h, t.name); break; }
      case 'radius': addPx('radius', t.resolved); break;
      case 'spacing': addPx('padding', t.resolved); addPx('gap', t.resolved); break;
      case 'font-size': addPx('fontSize', t.resolved); break;
      case 'font-weight': if (/^\d{3}$/.test(t.resolved.trim())) scales.fontWeight.add(t.resolved.trim()); break;
      case 'shadow': scales.shadow.add(normalizeShadow(t.resolved)); break;
      default: break;
    }
  }
  const theme = st.tailwind.theme;
  if (theme) {
    for (const [name, hex] of Object.entries(theme.colors)) if (!isTailwindDefault(hex) && !palette.has(hex)) palette.set(hex, name);
    theme.radius.forEach((v) => addPx('radius', v));
    theme.spacing.forEach((v) => { addPx('padding', v); addPx('gap', v); });
    theme.fontSize.forEach((v) => addPx('fontSize', v));
    theme.shadow.forEach((v) => scales.shadow.add(normalizeShadow(v)));
  }
  if (st.tailwind.version) {
    TW_RADIUS.forEach((v) => scales.radius.add(String(v)));
    TW_SPACING.forEach((v) => { scales.padding.add(String(v)); scales.gap.add(String(v)); });
    TW_FONT_SIZE.forEach((v) => scales.fontSize.add(String(v)));
  }
  WEIGHTS.forEach((w) => scales.fontWeight.add(String(w)));
  return { palette, hasOwnColors: palette.size > 0, scales, tailwindVersion: st.tailwind.version };
}
