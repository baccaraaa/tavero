import { describe, it, expect } from 'vitest';
import { cardsRule } from '../../src/rules/cards.js';
import type { NormalizedStyles, RuleInput, StyleSample } from '../../src/core/types.js';

const N = (o: Partial<NormalizedStyles> = {}): NormalizedStyles => ({ bg: '#ffffff', color: '#21252b', borderWidth: 1, borderStyle: 'solid', borderColor: '#e5e7eb', radius: [12, 12, 12, 12], paddingY: 16, paddingX: 16, padding: [16, 16, 16, 16], gap: 0, fontSize: 16, fontWeight: 400, lineHeight: 24, fontFamily: 'Arial', shadow: 'none', height: 120, display: 'block', position: 'static', ...o });
const S = (id: string, styles: NormalizedStyles, over: Partial<StyleSample> = {}): StyleSample => ({ id, route: '/', viewport: 'desktop', role: 'card', componentId: 'c_card', componentName: 'DashCard', file: 'src/DashCard.tsx', line: 20, hops: 0, rect: { x: 0, y: 0, w: 400, h: 120 }, text: '', styles, parentBg: null, children: 3, nested: false, inOverlay: false, ...over });
const input = (samples: StyleSample[]): RuleInput => ({ samples, colors: {}, scales: { radius: {}, padding: {}, gap: {}, fontSize: {}, fontWeight: {}, shadow: {}, typography: {} }, tokens: [], staticInfo: { tailwind: { version: null, theme: null }, hardcodedColors: {}, warnings: [] }, components: [], instances: [] });

describe('cardsRule', () => {
  it('reports card variants, near pairs and raw cards as preliminary findings', () => {
    const f = cardsRule(input([
      S('s1', N()), S('s2', N()),
      S('s3', N({ radius: [10, 10, 10, 10] }), { componentName: 'ResumeCard', componentId: 'c_r', file: 'src/ResumeCard.tsx' }),
      S('s4', N({ bg: '#f6f7f9', borderWidth: 0, borderColor: null, shadow: '0 1 2 0 #0000001a' }), { componentName: 'KpiRow', componentId: 'c_k', file: 'src/KpiRow.tsx', line: 40 }),
      S('s5', N(), { nested: true }),
    ]));
    const byKey = Object.fromEntries(f.map((x) => [x.key, x]));
    expect(f.every((x) => x.preliminary === true && x.rule === 'cards')).toBe(true);
    expect(byKey['variants']).toMatchObject({ severity: 'medium', stats: { variants: 3, samples: 5 } });
    expect(f.filter((x) => x.key.startsWith('near:'))).toHaveLength(1);
    expect(byKey['raw']).toMatchObject({ stats: { samples: 1 } });
    expect(byKey['raw'].evidence[0]).toMatchObject({ component: 'KpiRow', file: 'src/KpiRow.tsx', line: 40 });
    expect(byKey['variants'].evidence.some((e) => e.value.includes('[nested]'))).toBe(false);
  });
});
