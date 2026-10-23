import { describe, it, expect } from 'vitest';
import { buttonsRule } from '../../src/rules/buttons.js';
import type { NormalizedStyles, RuleInput, StyleSample } from '../../src/core/types.js';

const N = (o: Partial<NormalizedStyles> = {}): NormalizedStyles => ({ bg: '#3366ff', color: '#ffffff', borderWidth: 0, borderStyle: 'none', borderColor: null, radius: [6, 6, 6, 6], paddingY: 8, paddingX: 14, padding: [8, 14, 8, 14], gap: 0, fontSize: 14, fontWeight: 700, lineHeight: 20, fontFamily: 'Arial', shadow: 'none', height: 36, display: 'inline-block', position: 'static', ...o });
const S = (id: string, styles: NormalizedStyles, over: Partial<StyleSample> = {}): StyleSample => ({ id, route: '/', viewport: 'desktop', role: 'button-text', componentId: 'c_btn', componentName: 'Button', file: 'src/Button.tsx', line: 3, hops: 0, rect: { x: 0, y: 0, w: 80, h: 36 }, text: 'Save', styles, parentBg: null, children: 0, nested: false, inOverlay: false, ...over });
const input = (samples: StyleSample[]): RuleInput => ({ samples, colors: {}, scales: { radius: {}, padding: {}, gap: {}, fontSize: {}, fontWeight: {}, shadow: {}, typography: {} }, tokens: [], staticInfo: { tailwind: { version: null, theme: null }, hardcodedColors: {}, warnings: [] }, components: [], instances: [{ id: 'i1', componentId: 'c_btn', route: '/', viewport: 'desktop', rect: { x: 0, y: 0, w: 1, h: 1 }, hosts: 1, crop: 'C:/crops/btn.png' }] });

describe('buttonsRule', () => {
  it('reports variants with severity, near pairs and raw buttons', () => {
    const f = buttonsRule(input([
      S('s1', N()), S('s2', N()),
      S('s3', N({ paddingX: 16 })),
      S('s4', N({ bg: '#ff0000' })),
      S('s5', N({ bg: '#10b981', radius: [999, 999, 999, 999] }), { componentName: 'PillButton', componentId: 'c_pill', file: 'src/Pill.tsx' }),
      S('s6', N({ bg: '#111111' }), { componentName: 'Home', componentId: 'c_home', file: 'src/Home.tsx', line: 12, text: 'Raw' }),
      S('s7', N(), { role: 'button-icon', text: '', componentName: 'IconButton', componentId: 'c_ic' }),
    ]));
    const byKey = Object.fromEntries(f.map((x) => [x.key, x]));
    expect(byKey['variants:text']).toMatchObject({ rule: 'buttons', severity: 'high', stats: { variants: 5, samples: 6 } });
    expect(byKey['variants:text'].id).toMatch(/^f_/);
    expect(byKey['variants:text'].evidence[0]).toMatchObject({ component: 'Button', file: 'src/Button.tsx', componentId: 'c_btn', crop: 'C:/crops/btn.png', sampleId: 's1', route: '/', viewport: 'desktop' });
    expect(byKey['variants:text'].evidence[0].value).toContain('bg #3366ff');
    expect(byKey['variants:icon']).toMatchObject({ severity: 'info', stats: { variants: 1, samples: 1 } });
    const near = f.filter((x) => x.key.startsWith('near:'));
    expect(near).toHaveLength(1);
    expect(near[0]).toMatchObject({ severity: 'medium' });
    expect(near[0].evidence.map((e) => e.value).join(' ')).toContain('paddingX');
    expect(byKey['raw']).toMatchObject({ severity: 'medium', stats: { samples: 1 } });
    expect(byKey['raw'].evidence[0]).toMatchObject({ component: 'Home', file: 'src/Home.tsx', line: 12, value: 'Raw' });
  });
  it('is quiet when there is one style and no raw buttons', () => {
    const f = buttonsRule(input([S('s1', N()), S('s2', N())]));
    expect(f.map((x) => [x.key, x.severity])).toEqual([['variants:text', 'info']]);
  });
});
