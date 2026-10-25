import type { Evidence, Finding, PageRecord, Token } from '../core/types.js';
import { deltaE, hex as toHex } from './normalize.js';
import { findingId } from './common.js';

const base6 = (h: string) => h.slice(0, 7).toLowerCase();
// what Chromium paints in color-scheme dark on unstyled controls and links: fields, buttons, their borders, links
const DARK_UA = new Set(['#3b3b3b', '#6b6b6b', '#858585', '#121212', '#9e9eff', '#d0adf0', '#ff9e9e']);

/** Relative luminance of #rrggbb[aa], 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

const where = (loc: string | null): { file?: string; line?: number } => {
  const m = loc?.match(/^(.*?):(\d+)(?::\d+)?$/);
  return m ? { file: m[1], line: Number(m[2]) } : loc ? { file: loc } : {};
};

/**
 * The dark theme, compared with the light render of the same page (elements matched by DOM path): light
 * backgrounds and dark text that do not change, and colors that only the dark theme uses and no token has.
 */
export function darkThemeRule(pages: PageRecord[], tokens: Token[]): { findings: Finding[]; notApplied: string[] } {
  const lightByRoute = new Map(pages.filter((p) => !p.theme && p.probe).map((p) => [p.route, p]));
  const darkPages = pages.filter((p) => p.theme === 'dark' && p.status === 'ok' && p.probe);
  // token values as the dark theme computes them, as hex: they come as written (oklch(), #fff, hsl())
  const darkTokens: Record<string, string> = {};
  for (const p of darkPages) for (const [k, v] of Object.entries(p.darkTokens ?? {})) { const h = toHex(v); if (h) darkTokens[k] = h; }
  const colorTokens = tokens.filter((t) => t.kind === 'color' && /^#[0-9a-f]{6}/i.test(t.resolved));
  // the token to use: one whose light value is this color and that changes in the dark theme
  const themeToken = (hex: string): string | null => {
    const t = colorTokens.find((x) => base6(x.resolved) === base6(hex) && darkTokens[x.name] && base6(darkTokens[x.name]) !== base6(hex));
    return t ? `${t.name} (light ${base6(t.resolved)}, dark ${base6(darkTokens[t.name])})` : null;
  };
  type Group = { count: number; ev: Evidence };
  const lightBg = new Map<string, Group>(), darkText = new Map<string, Group>();
  const add = (m: Map<string, Group>, key: string, ev: Evidence) => { const g = m.get(key); if (g) g.count++; else m.set(key, { count: 1, ev }); };
  const notApplied: string[] = [];
  const darkUsed: Record<string, { n: number; examples: Evidence[] }> = {};
  for (const d of darkPages) {
    const l = lightByRoute.get(d.route);
    if (!l) continue;
    // the theme is on when the page itself got clearly darker
    if (luminance(d.pageBg ?? '#ffffff') > luminance(l.pageBg ?? '#ffffff') - 0.25) { notApplied.push(d.route); continue; }
    const byKey = new Map(l.probe!.map((p) => [p.k, p]));
    for (const p of d.probe!) {
      const q = byKey.get(p.k);
      if (!q) continue;
      const loc = where(p.f);
      if (p.bg && q.bg === p.bg && luminance(p.bg) > 0.8 && p.a >= 2500) {
        add(lightBg, `${p.c}|${p.f}|${p.bg}`, { route: d.route, viewport: d.viewport, component: p.c ?? undefined, ...loc, value: `background ${p.bg} in both themes`, expected: themeToken(p.bg) ?? 'a color that changes with the theme: a token with a dark value, or a dark: variant' });
      }
      const behind = p.pbg ?? d.pageBg ?? '#000000';
      if (p.fg && q.fg === p.fg && luminance(p.fg) < 0.2 && luminance(behind) < 0.2) {
        add(darkText, `${p.c}|${p.f}|${p.fg}`, { route: d.route, viewport: d.viewport, component: p.c ?? undefined, ...loc, value: `text ${p.fg} on ${behind}`, expected: themeToken(p.fg) ?? 'a text color that changes with the theme: a token with a dark value, or a dark: variant' });
      }
    }
    for (const [hex, c] of Object.entries(d.colors)) {
      const u = darkUsed[base6(hex)] ?? (darkUsed[base6(hex)] = { n: 0, examples: [] });
      u.n += c.bg + c.color + c.border;
      for (const e of c.examples) if (u.examples.length < 3) u.examples.push({ route: e.route, viewport: e.viewport, component: e.component ?? undefined, ...where(e.file ?? null), value: hex });
    }
  }
  const findings: Finding[] = [];
  const emit = (key: string, groups: Map<string, Group>, title: (n: number) => string, summary: string) => {
    if (!groups.size) return;
    const list = [...groups.values()].sort((a, b) => b.count - a.count);
    const evidence = list.map((g) => ({ ...g.ev, value: g.count > 1 ? `${g.ev.value} ×${g.count}` : g.ev.value }));
    findings.push({ id: findingId('colors', key), rule: 'colors', key, severity: 'medium', title: title(groups.size), summary, stats: { places: groups.size, elements: list.reduce((n, g) => n + g.count, 0) }, evidence });
  };
  emit('dark:light-bg', lightBg, (n) => `${n} place(s) keep a light background in dark theme`, 'These backgrounds render the same in both themes, so they stay light on the dark page; usually a hardcoded color or a missing dark: variant.');
  emit('dark:dark-text', darkText, (n) => `${n} place(s) keep dark text on a dark background in dark theme`, 'This text renders the same dark color in both themes and becomes hard to read on the dark page.');
  // colors only the dark theme uses, near no token value of either theme
  const lightUsed = new Set(pages.filter((p) => !p.theme).flatMap((p) => Object.keys(p.colors).map(base6)));
  const palette = [...colorTokens.map((t) => base6(t.resolved)), ...Object.values(darkTokens).map(base6)];
  for (const [hex, u] of Object.entries(darkUsed).sort()) {
    if (lightUsed.has(hex) || DARK_UA.has(hex) || palette.some((p) => deltaE(p, hex) < 2)) continue;
    const key = `dark:off:${hex}`;
    findings.push({ id: findingId('colors', key), rule: 'colors', key, severity: 'medium', title: `In dark theme: color ${hex} is not a project token`, summary: `Used ${u.n} time(s) in the dark theme only, and no token has this value in either theme.`, stats: { total: u.n }, evidence: u.examples });
  }
  return { findings, notApplied };
}
