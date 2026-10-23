import { describe, it, expect } from 'vitest';
import { colorsRule } from '../../src/rules/colors.js';
import type { ColorCounts, RuleInput, Token } from '../../src/core/types.js';

const tok = (name: string, hex: string): Token => ({ id: name, name, kind: 'color', value: hex, resolved: hex, theme: 'light', source: { source: 'runtime' } });
const ex = { route: '/', viewport: 'desktop', component: 'X', file: 'src/X.tsx:1:1' };
const input = (colors: ColorCounts, tokens: Token[], hardcoded: RuleInput['staticInfo']['hardcodedColors'] = {}, tailwind: 3 | null = 3): RuleInput => ({
  samples: [], colors, scales: { radius: {}, padding: {}, gap: {}, fontSize: {}, fontWeight: {}, shadow: {}, typography: {} }, tokens,
  staticInfo: { tailwind: { version: tailwind, theme: null }, hardcodedColors: hardcoded, warnings: [] }, components: [], instances: [],
});

describe('colorsRule', () => {
  it('classifies off-palette, tailwind-default, near pairs and hardcoded colors', () => {
    const f = colorsRule(input({
      '#2d4deb': { bg: 3, color: 0, border: 0, examples: [ex] }, // token
      '#2d4dec': { bg: 1, color: 0, border: 0, examples: [ex] }, // within ΔE 2 of the token → token
      '#3b82f6': { bg: 2, color: 0, border: 0, examples: [ex] }, // tailwind blue-500
      '#1a9f6e': { bg: 1, color: 0, border: 0, examples: [ex] }, // off
      '#6b7280': { bg: 0, color: 9, border: 0, examples: [ex] }, // tailwind gray-500
      '#6b7580': { bg: 0, color: 2, border: 0, examples: [ex] }, // off, ΔE ≈ 2.7 from gray-500 → near pair
      '#00000080': { bg: 1, color: 0, border: 0, examples: [ex] }, // black with alpha: off
    }, [tok('--lp-accent', '#2d4deb')], { '#1a9f6e': [{ file: 'src/a.css', line: 7 }], '#2d4deb': [{ file: 'src/b.tsx', line: 2 }], '#abcdef': [{ file: 'src/landing.tsx', line: 9 }, { file: 'src/landing.tsx', line: 12 }] }));
    const keys = f.map((x) => x.key).sort();
    // #abcdef is a literal that never renders on the scanned pages: no per-color finding, only the summary
    expect(keys).toEqual(['default:#3b82f6', 'default:#6b7280', 'hardcoded', 'hardcoded:#1a9f6e', 'hardcoded:#2d4deb', 'near:#6b7280:#6b7580', 'off:#000000', 'off:#1a9f6e', 'off:#6b7580']);
    expect(f.find((x) => x.key === 'hardcoded')).toMatchObject({ severity: 'info', stats: { colors: 3, places: 4, rendered: 2 } });
    expect(f.find((x) => x.key === 'hardcoded')!.evidence[0]).toMatchObject({ value: '#abcdef × 2', file: 'src/landing.tsx', line: 9 });
    const off = f.find((x) => x.key === 'off:#1a9f6e')!;
    expect(off).toMatchObject({ rule: 'colors', severity: 'medium', stats: { bg: 1, color: 0, border: 0, total: 1 } });
    // the literal's source places come first, then where it renders; a far token is not offered as the fix
    expect(off.evidence[0]).toMatchObject({ file: 'src/a.css', line: 7, value: 'literal #1a9f6e in source' });
    expect(off.evidence[1]).toMatchObject({ route: '/', component: 'X', file: 'src/X.tsx:1:1', value: 'background #1a9f6e' });
    expect(off.evidence[1].expected).toMatch(/^no close token \(nearest --lp-accent #2d4deb, ΔE \d+(\.\d+)?\); add a token$/);
    expect(off.summary).toContain('No close token');
    expect(f.find((x) => x.key === 'default:#3b82f6')).toMatchObject({ severity: 'medium', title: 'Tailwind default blue-500 (#3b82f6) used instead of a project token' });
    expect(f.find((x) => x.key === 'hardcoded:#2d4deb')!.evidence).toEqual([{ file: 'src/b.tsx', line: 2, value: '#2d4deb', expected: '--lp-accent' }]);
  });
  it('offers the nearest token as expected only when it is close (ΔE < 10)', () => {
    const f = colorsRule(input({ '#4060f0': { bg: 2, color: 0, border: 0, examples: [ex] } }, [tok('--lp-accent', '#2d4deb')]));
    const off = f.find((x) => x.key === 'off:#4060f0')!;
    expect(off.evidence[0].expected).toMatch(/^--lp-accent #2d4deb \(ΔE 5\.\d\)$/);
    expect(off.summary).toContain('Nearest token --lp-accent');
  });
  it('finds the source literal of an alpha color by its base color', () => {
    // rendered as #30a66f24 (14% alpha); the static scan records the literal under its base #30a66f
    const f = colorsRule(input({ '#30a66f24': { bg: 3, color: 0, border: 0, examples: [ex] } }, [tok('--lp-accent', '#2d4deb')], { '#30a66f': [{ file: 'src/tones.ts', line: 16 }] }));
    expect(f.find((x) => x.key === 'off:#30a66f')!.evidence[0]).toMatchObject({ file: 'src/tones.ts', line: 16, value: 'literal #30a66f in source' });
  });
  it('reports browser-default colors that no source writes as one info finding, not as off-palette', () => {
    const f = colorsRule(input({
      '#f0f0f0': { bg: 4, color: 0, border: 0, examples: [ex] },   // unstyled <button> background
      '#0000ee': { bg: 0, color: 2, border: 0, examples: [ex] },   // unstyled link
      '#000000': { bg: 0, color: 7, border: 0, examples: [ex] },   // default text, but written in source below
      '#00000080': { bg: 1, color: 0, border: 0, examples: [ex] }, // an alpha black is never a browser default
    }, [tok('--lp-accent', '#2d4deb')], { '#000000': [{ file: 'src/a.css', line: 3 }] }));
    const keys = f.map((x) => x.key);
    expect(keys).not.toContain('off:#f0f0f0');
    expect(keys).not.toContain('off:#0000ee');
    expect(keys).toContain('off:#000000');
    const ua = f.find((x) => x.key === 'ua-defaults')!;
    expect(ua).toMatchObject({ severity: 'info', stats: { colors: 2, total: 6 } });
    expect(ua.title).toBe('2 browser-default colors on unstyled elements');
    expect(ua.evidence.map((e) => e.value).sort()).toEqual(['background #f0f0f0', 'text #0000ee']);
    expect(keys.filter((k) => k.startsWith('near:') && (k.includes('#f0f0f0') || k.includes('#0000ee')))).toEqual([]);
  });
  it('prefers a close token from the family the file already uses over the global nearest', () => {
    const rendered = { '#3757e0': { bg: 2, color: 0, border: 0, examples: [{ route: '/', viewport: 'desktop', component: 'Tile', file: 'src/tones.ts:12:3' }] } };
    const tokens = [tok('--lp-accent', '#2d4deb'), tok('--ds-c-blue', '#4a66d6')];
    const base = input(rendered, tokens, { '#3757e0': [{ file: 'src/tones.ts', line: 12 }] });
    const f = colorsRule({ ...base, staticInfo: { ...base.staticInfo, tokenRefs: { 'src/tones.ts': ['--ds-c-green', '--ds-c-violet'] } } });
    const off = f.find((x) => x.key === 'off:#3757e0')!;
    expect(off.evidence[0].expected).toBe('--ds-c-blue #4a66d6 (ΔE 4.9; src/tones.ts already uses --ds-*)');
    expect(off.summary).toContain('--ds-c-blue');
    // without family information the global nearest stays
    expect(colorsRule(base).find((x) => x.key === 'off:#3757e0')!.evidence[0].expected).toBe('--lp-accent #2d4deb (ΔE 3.1)');
  });
  it('groups alpha variants under their base color', () => {
    const f = colorsRule(input({
      '#d92626': { bg: 0, color: 6, border: 0, examples: [ex] },
      '#d9262640': { bg: 3, color: 0, border: 0, examples: [ex] },
      '#d9262659': { bg: 0, color: 0, border: 3, examples: [ex] },
    }, [tok('--lp-accent', '#2d4deb')]));
    expect(f.map((x) => x.key).sort()).toEqual(['off:#d92626']);
    const off = f[0];
    expect(off.stats).toMatchObject({ bg: 3, color: 6, border: 3, total: 12, variants: 3 });
    expect(off.evidence.map((e) => e.value).sort()).toEqual(['background #d9262640', 'border #d9262659', 'text #d92626']);
    expect(off.title).toBe('Color #d92626 (3 alpha variants) is not a project token');
  });
  it('raises severity to high with 10 or more off-palette colors and skips default findings without own colors', () => {
    const colors: ColorCounts = {};
    for (let i = 0; i < 10; i++) colors[`#1${i}0000`] = { bg: 1, color: 0, border: 0, examples: [ex] };
    colors['#3b82f6'] = { bg: 1, color: 0, border: 0, examples: [ex] };
    const f = colorsRule(input(colors, []));
    expect(f.filter((x) => x.key.startsWith('off:')).every((x) => x.severity === 'high')).toBe(true);
    expect(f.some((x) => x.key.startsWith('default:'))).toBe(false);
  });
});
