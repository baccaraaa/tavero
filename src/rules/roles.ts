import type { AttributedElement, NormalizedStyles, Role } from '../core/types.js';
import { hex } from './normalize.js';

const CARD_TAGS = new Set(['div', 'section', 'article', 'li']);

function isButtonLike(el: AttributedElement, n: NormalizedStyles): boolean {
  if (el.t === 'button') return true;
  if (el.t === 'input' && (el.type === 'submit' || el.type === 'button')) return true;
  if (el.role === 'button') return true;
  if (el.t === 'a') {
    const styled = !!n.bg || (n.borderWidth > 0 && !!n.borderColor);
    const padded = n.padding[0] >= 6 && n.padding[3] >= 6;
    return styled && padded && el.text.length <= 40;
  }
  return false;
}

/** Spec §11 roles: button-text / button-icon / card, or null. */
export function classifyRole(el: AttributedElement, n: NormalizedStyles, viewport: { width: number; height: number }): Role | null {
  if (isButtonLike(el, n)) {
    if (!el.text.trim()) return 'button-icon';
    // nav/menu items and unstyled clickable wrappers (cards, list rows) are not action buttons
    if (el.inNav) return null;
    const unstyled = !n.bg && !(n.borderWidth > 0 && n.borderColor) && n.shadow === 'none';
    const zeroPadding = n.padding.every((p) => p === 0);
    if (unstyled && (zeroPadding || el.r[2] >= viewport.width * 0.6)) return null;
    return 'button-text';
  }
  if (!CARD_TAGS.has(el.t) || el.inInteractive) return null;
  const parentBg = hex(el.parentBg);
  const distinctBg = !!n.bg && n.bg !== parentBg;
  const bordered = n.borderWidth > 0 && !!n.borderColor;
  const shadowed = n.shadow !== 'none';
  if (!(distinctBg || bordered || shadowed)) return null;
  if (Math.max(...n.radius) < 4) return null;
  if (n.padding.some((p) => p < 8)) return null;
  if (el.children < 2) return null;
  const area = el.r[2] * el.r[3];
  const vp = viewport.width * viewport.height;
  if (area < vp * 0.01 || area > vp * 0.6) return null;
  return 'card';
}
