import { describe, it, expect } from 'vitest';
import { scalesRule } from '../../src/rules/scales.js';
import type { RuleInput, ScaleCounts, Token } from '../../src/core/types.js';

const ex = { route: '/', viewport: 'desktop', component: 'X', file: 'src/X.tsx:1:1' };
const entry = (count: number) => ({ count, examples: [ex] });
const input = (scales: ScaleCounts, tokens: Token[], tailwind: 3 | null): RuleInput => ({ samples: [], colors: {}, scales, tokens, staticInfo: { tailwind: { version: tailwind, theme: null }, hardcodedColors: {}, warnings: [] }, components: [], instances: [] });
const empty = (): ScaleCounts => ({ radius: {}, padding: {}, gap: {}, fontSize: {}, fontWeight: {}, shadow: {}, typography: {} });

describe('scalesRule', () => {
  it('compares used values against declared scales', () => {
    const s = empty();
    s.radius = { '6': entry(10), '12': entry(4), '9999': entry(2), '7': entry(1), '13': entry(1) };
    s.padding = { '8': entry(5), '14': entry(5), '16': entry(3) };
    s.fontSize = { '14': entry(5), '16': entry(5), '13': entry(1) };
    s.fontWeight = { '400': entry(5), '700': entry(2), '550': entry(1) };
    s.shadow = { '0 1 2 0 #0000001a': entry(3) };
    s.typography = { '14/400/20': entry(5), '16/400/24': entry(5), '13/400/18': entry(1) };
    const f = scalesRule(input(s, [{ id: '--radius', name: '--radius', kind: 'radius', value: '0.625rem', resolved: '0.625rem', theme: 'light', source: { source: 'runtime' } }], 3));
    const byKey = Object.fromEntries(f.map((x) => [x.key, x]));
    expect(byKey.radius).toMatchObject({ rule: 'scales', severity: 'medium', stats: { values: 5, offScale: 2, offScaleUses: 2 }, title: '5 distinct radius values, 10 declared' });
    expect(byKey.radius.evidence.map((e) => [e.value, e.expected])).toEqual([['7px', '6px'], ['13px', '12px']]);
    expect(byKey.radius.evidence[0]).toMatchObject({ route: '/', file: 'src/X.tsx:1:1' });
    expect(byKey.padding).toMatchObject({ severity: 'info', stats: { offScale: 0 } });
    expect(byKey.fontSize).toMatchObject({ severity: 'medium', stats: { offScale: 1 } });
    expect(byKey.fontWeight).toMatchObject({ severity: 'medium', stats: { offScale: 1 } });
    expect(byKey.shadow).toMatchObject({ severity: 'info', stats: { values: 1, declared: 0 } });
    expect(byKey.typography).toMatchObject({ severity: 'info', stats: { combos: 3 } });
    expect(byKey.typography.evidence[0].value).toBe('14px / 400 / 20px — 5 uses');
  });
  it('is info everywhere without Tailwind or tokens', () => {
    const s = empty();
    s.radius = { '6': entry(1), '7': entry(1) };
    const f = scalesRule(input(s, [], null));
    expect(f.find((x) => x.key === 'radius')).toMatchObject({ severity: 'info', stats: { declared: 0, offScale: 0 } });
  });
});
