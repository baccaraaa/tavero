import { describe, it, expect } from 'vitest';
import { buttonSignature, cardSignature, signatureKey, variantId, groupVariants, nearVariants, describeSignature } from '../../src/rules/signature.js';
import type { NormalizedStyles, StyleSample } from '../../src/core/types.js';

const N = (o: Partial<NormalizedStyles> = {}): NormalizedStyles => ({ bg: '#3366ff', color: '#ffffff', borderWidth: 0, borderStyle: 'none', borderColor: null, radius: [6, 6, 6, 6], paddingY: 8, paddingX: 14, padding: [8, 14, 8, 14], gap: 0, fontSize: 14, fontWeight: 700, lineHeight: 20, fontFamily: 'Arial', shadow: 'none', height: 36, display: 'inline-block', position: 'static', ...o });
const S = (id: string, styles: NormalizedStyles, over: Partial<StyleSample> = {}): StyleSample => ({ id, route: '/', viewport: 'desktop', role: 'button-text', componentId: 'c_1', componentName: 'Button', file: 'src/Button.tsx', line: 3, hops: 0, rect: { x: 0, y: 0, w: 80, h: 36 }, text: 'Save', styles, parentBg: null, children: 0, nested: false, inOverlay: false, ...over });

describe('signature', () => {
  it('button and card signatures and keys', () => {
    const sig = buttonSignature(N());
    expect(sig).toEqual({ radius: '6/6/6/6', paddingY: 8, paddingX: 14, fontSize: 14, fontWeight: 700, bg: '#3366ff', color: '#ffffff', borderWidth: 0, borderColor: null, shadow: 'none' });
    // the rendered height follows layout (a stretched flex row on mobile, wrapped text), not a style decision
    expect(buttonSignature(N({ height: 52 }))).toEqual(sig);
    expect(signatureKey(sig)).toBe('radius=6/6/6/6|paddingY=8|paddingX=14|fontSize=14|fontWeight=700|bg=#3366ff|color=#ffffff|borderWidth=0|borderColor=|shadow=none');
    expect(variantId(sig)).toMatch(/^v_[0-9a-f]{10}$/);
    expect(cardSignature(N({ bg: '#ffffff', borderWidth: 1, borderColor: '#e5e7eb', radius: [12, 12, 12, 12], paddingY: 16, paddingX: 16 }))).toEqual({ bg: '#ffffff', borderWidth: 1, borderColor: '#e5e7eb', radius: '12/12/12/12', paddingY: 16, paddingX: 16, shadow: 'none' });
    expect(describeSignature(sig)).toBe('bg #3366ff, text #ffffff, radius 6, padding 8/14, 14px/700, no border, no shadow');
  });
  it('groups variants and finds near pairs', () => {
    const samples = [
      S('s1', N()),
      S('s2', N(), { route: '/x', componentName: 'DashButton', componentId: 'c_2', file: 'src/DashButton.tsx' }),
      S('s3', N({ paddingX: 16, bg: '#3468ff' })),
      S('s4', N({ bg: '#ff0000', color: '#ffffff' })),
      S('s5', N(), { role: 'button-icon', text: '' }),
    ];
    const v = groupVariants(samples, 'button-text');
    expect(v.map((x) => x.count)).toEqual([2, 1, 1]);
    expect(v[0]).toMatchObject({ components: { Button: 1, DashButton: 1 }, files: { 'src/Button.tsx': 1, 'src/DashButton.tsx': 1 }, pages: ['/', '/x'], sampleIds: ['s1', 's2'] });
    expect(v[0].example.id).toBe('s1');
    const near = nearVariants(v);
    expect(near).toHaveLength(1);
    expect(near[0].differs.sort()).toEqual(['bg', 'paddingX']);
    expect(groupVariants(samples, 'button-icon')).toHaveLength(1);
  });
});
