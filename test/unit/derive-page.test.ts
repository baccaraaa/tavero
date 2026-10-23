import { describe, it, expect } from 'vitest';
import { derivePage } from '../../src/core/derive/page.js';
import { DEFAULT_VIEWPORTS, type AttributedElement, type AttributedInstance } from '../../src/core/types.js';

const S = (over: Record<string, string>) => ({
  'background-color': 'rgba(0, 0, 0, 0)', color: 'rgb(33, 37, 43)', 'border-top-width': '0px', 'border-top-style': 'none', 'border-top-color': 'rgb(0, 0, 0)',
  'border-top-left-radius': '0px', 'border-top-right-radius': '0px', 'border-bottom-right-radius': '0px', 'border-bottom-left-radius': '0px',
  'padding-top': '0px', 'padding-right': '0px', 'padding-bottom': '0px', 'padding-left': '0px', gap: 'normal', 'font-size': '16px', 'font-weight': '400',
  'line-height': '24px', 'font-family': 'Arial', 'box-shadow': 'none', height: '20px', display: 'block', position: 'static', ...over,
});
const el = (p: Partial<AttributedElement> & { t: string; r: [number, number, number, number] }): AttributedElement => ({
  role: null, type: null, inInteractive: false, inNav: false, inOverlay: false, f: true, o: null, s: null, a: null, al: null, ah: null, aid: null, si: [], styles: S({}), children: 0, parentBg: 'rgb(246, 247, 249)', text: '', ...p,
});
const cardStyles = (bg = 'rgb(255, 255, 255)') => S({ 'background-color': bg, 'border-top-width': '1px', 'border-top-style': 'solid', 'border-top-color': 'rgb(229, 231, 235)', 'border-top-left-radius': '12px', 'border-top-right-radius': '12px', 'border-bottom-right-radius': '12px', 'border-bottom-left-radius': '12px', 'padding-top': '16px', 'padding-right': '16px', 'padding-bottom': '16px', 'padding-left': '16px', height: '120px' });

describe('derivePage', () => {
  it('produces samples, color and scale counts, and instance ids', () => {
    const btnStyles = S({ 'background-color': 'rgb(51, 102, 255)', color: 'rgb(255, 255, 255)', 'border-top-left-radius': '6px', 'border-top-right-radius': '6px', 'border-bottom-right-radius': '6px', 'border-bottom-left-radius': '6px', 'padding-top': '8px', 'padding-right': '14px', 'padding-bottom': '8px', 'padding-left': '14px', 'font-weight': '700', height: '36px', display: 'inline-block' });
    const elements = [
      el({ t: 'section', r: [20, 20, 400, 120], styles: cardStyles(), children: 3, a: 'Card', al: 'src/Card.tsx:3:5', ah: 0, aid: 'k1' }),
      el({ t: 'button', r: [40, 90, 80, 36], styles: btnStyles, text: 'Save', a: 'Button', al: 'src/Button.tsx:3:10', ah: 0, aid: 'k2' }),
      el({ t: 'p', r: [40, 40, 200, 24], text: 'Body', a: 'Card', al: 'src/Card.tsx:4:5', ah: 0, aid: 'k1' }),
    ];
    const instances: AttributedInstance[] = [
      { key: 'k1', name: 'Card', file: 'src/Card.tsx', line: 3, resolved: 'stack', usedFrom: null, hosts: 2, rect: { x: 20, y: 20, w: 400, h: 120 }, props: ['title'] },
      { key: 'k2', name: 'Button', file: 'src/Button.tsx', line: 3, resolved: 'stack', usedFrom: null, hosts: 1, rect: { x: 40, y: 90, w: 80, h: 36 }, props: ['variant'] },
    ];
    const page = derivePage({ route: '/', viewport: DEFAULT_VIEWPORTS[2], status: 'ok', docSize: [1440, 900], elements, instances, crops: new Map([['k2', 'C:/x/crop.png']]), links: ['/many'] });
    expect(page.instances.map((i) => [i.name, i.componentId.startsWith('c_'), i.id.startsWith('i_'), i.crop])).toEqual([['Card', true, true, undefined], ['Button', true, true, 'C:/x/crop.png']]);
    expect(page.samples.map((s) => [s.role, s.componentName, s.file, s.line, s.hops, s.nested])).toEqual([['card', 'Card', 'src/Card.tsx', 3, 0, false], ['button-text', 'Button', 'src/Button.tsx', 3, 0, false]]);
    expect(page.samples[1].styles.bg).toBe('#3366ff');
    expect(page.samples[0].id).toMatch(/^s_/);
    expect(page.samples[0].componentId).toBe(page.instances[0].componentId);
    expect(page.colors['#3366ff']).toMatchObject({ bg: 1, color: 0, border: 0 });
    expect(page.colors['#ffffff']).toMatchObject({ bg: 1, color: 1 });
    expect(page.colors['#e5e7eb']).toMatchObject({ border: 1 });
    expect(page.colors['#21252b']).toMatchObject({ color: 1, examples: [{ route: '/', viewport: 'desktop', component: 'Card', file: 'src/Card.tsx:4:5' }] });
    expect(page.scales.radius).toMatchObject({ '6': { count: 1 }, '12': { count: 1 } });
    expect(page.scales.padding).toMatchObject({ '8': { count: 1 }, '14': { count: 1 }, '16': { count: 1 } });
    expect(page.scales.fontWeight).toMatchObject({ '700': { count: 1 }, '400': { count: 1 } });
    expect(page.scales.typography).toMatchObject({ '16/700/24': { count: 1 }, '16/400/24': { count: 1 } });
    expect(page.scales.shadow).toEqual({});
  });
  it('flags nested cards', () => {
    const page = derivePage({ route: '/', viewport: DEFAULT_VIEWPORTS[2], status: 'ok', docSize: [1440, 900], elements: [
      el({ t: 'div', r: [0, 0, 500, 300], styles: cardStyles(), children: 2 }),
      el({ t: 'div', r: [20, 20, 300, 150], styles: cardStyles('rgb(246, 247, 249)'), children: 2, parentBg: 'rgb(255, 255, 255)' }),
    ], instances: [], crops: new Map(), links: [] });
    expect(page.samples.map((s) => s.nested)).toEqual([false, true]);
  });
});
