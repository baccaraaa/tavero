import { describe, it, expect } from 'vitest';
import { attributePage } from '../../src/runtime/attribute.js';
import { createResolver } from '../../src/runtime/sourcemaps.js';
import type { RawPage } from '../../src/core/types.js';

const base = 'http://localhost:5173';
const app = (p: string, l = 1, c = 1) => `${base}/${p}?t=1:${l}:${c}`;
const lib = (p: string) => `${base}/node_modules/.vite/deps/${p}?v=abc:10:5`;

function rawPage(partial: Partial<RawPage>): RawPage {
  return { url: base + '/', viewport: [1440, 900], docSize: [1440, 2000], reactDetected: true, elements: [], owners: {}, tokens: [], tokenValues: {}, links: [], hasPasswordInput: false, nextBuildError: null, ...partial };
}
const el = (t: string, sf: Array<{ fn: string | null; loc: string }> | null, oc: number[], r: [number, number, number, number], si: string[] = []) =>
  ({ t, role: null, type: null, inInteractive: false, inNav: false, inOverlay: false, f: true, sf, oc, si, r, text: '', styles: {}, children: 0, parentBg: null });

describe('attributePage', () => {
  it('direct owner when the element call site is app code', async () => {
    const raw = rawPage({
      owners: { 1: { name: 'Button', frames: [{ fn: 'Home', loc: app('src/pages/Home.tsx', 9, 7) }], props: ['variant'] } },
      elements: [el('button', [{ fn: 'Button', loc: app('src/components/Button.tsx', 3, 10) }], [1], [10, 10, 80, 30])],
    });
    const out = await attributePage(raw, createResolver({ kind: 'vite', baseUrl: base, projectDir: 'C:/p' }), new Map());
    expect(out.elements[0]).toMatchObject({ o: 'Button', a: 'Button', al: 'src/components/Button.tsx:3:10', ah: 0 });
    const inst = [...out.instances.values()][0];
    expect(inst).toMatchObject({ name: 'Button', file: 'src/components/Button.tsx', line: 3, resolved: 'stack', usedFrom: 'src/pages/Home.tsx:9:7', hosts: 1, props: ['variant'] });
  });
  it('walks past library owners to the app component that used them', async () => {
    const raw = rawPage({
      owners: {
        // <Primitive.button> is created by a Radix helper called from DashButton's render: the stack has both
        1: { name: 'Primitive.button', frames: [{ fn: null, loc: lib('@radix-ui_react-slot.js') }, { fn: 'DashButton', loc: app('src/ui/DashButton.tsx', 8, 5) }], props: [] },
        2: { name: 'DashButton', frames: [{ fn: 'Toolbar', loc: app('src/sections/Toolbar.tsx', 20, 5) }], props: ['size'] },
        3: { name: 'Toolbar', frames: [{ fn: 'Page', loc: app('src/pages/Page.tsx', 4, 3) }], props: [] },
      },
      elements: [
        el('button', [{ fn: null, loc: lib('@radix-ui_react-primitive.js') }], [1, 2, 3], [0, 0, 50, 20]),
        el('span', [{ fn: 'DashButton', loc: app('src/ui/DashButton.tsx', 12, 9) }], [2, 3], [0, 0, 40, 20]),
      ],
    });
    const out = await attributePage(raw, createResolver({ kind: 'vite', baseUrl: base, projectDir: 'C:/p' }), new Map());
    expect(out.elements[0]).toMatchObject({ o: 'Primitive.button', a: 'DashButton', ah: 1, via: 'Primitive.button' });
    expect(out.elements[1]).toMatchObject({ a: 'DashButton', ah: 0, al: 'src/ui/DashButton.tsx:12:9' });
    const inst = [...out.instances.values()].find((i) => i.name === 'DashButton')!;
    // defining file comes from the first app frame seen inside DashButton's render (line 8 via the wrapper, then 12)
    expect(inst).toMatchObject({ file: 'src/ui/DashButton.tsx', line: 8, hosts: 2, props: ['size'] });
    expect(inst.rect).toEqual({ x: 0, y: 0, w: 50, h: 20 });
  });
  it('credits the authoring component for elements cloned by a library Slot', async () => {
    const raw = rawPage({
      owners: {
        1: { name: 'Primitive.button.SlotClone', frames: [{ fn: null, loc: lib('@radix-ui_react-slot.js') }], props: [] },
        2: { name: 'Slot', frames: [{ fn: null, loc: lib('@radix-ui_react-slot.js') }], props: [] },
        3: { name: 'NavItem', frames: [{ fn: 'SidebarNav', loc: app('src/shell/SidebarNav.tsx', 60, 9) }], props: ['to', 'label'] },
      },
      elements: [el('button', [{ fn: 'NavItem', loc: app('src/shell/SidebarNav.tsx', 242, 7) }], [1, 2, 3], [0, 0, 200, 40])],
    });
    const out = await attributePage(raw, createResolver({ kind: 'vite', baseUrl: base, projectDir: 'C:/p' }), new Map());
    expect(out.elements[0]).toMatchObject({ o: 'Primitive.button.SlotClone', a: 'NavItem', aid: '3', ah: 0, via: 'Primitive.button.SlotClone', al: 'src/shell/SidebarNav.tsx:242:7' });
    expect([...out.instances.values()][0]).toMatchObject({ name: 'NavItem', file: 'src/shell/SidebarNav.tsx', line: 242, props: ['to', 'label'] });
  });
  it('falls back to server component names via the static index', async () => {
    const raw = rawPage({ elements: [el('section', [{ fn: null, loc: lib('next_dist_compiled.js') }], [], [0, 0, 100, 100], ['Hero@Server'])] });
    const index = new Map([['Hero', [{ file: 'src/components/Hero.tsx', line: 5 }]]]);
    const out = await attributePage(raw, createResolver({ kind: 'vite', baseUrl: base, projectDir: 'C:/p' }), index);
    expect(out.elements[0]).toMatchObject({ a: 'Hero', al: 'src/components/Hero.tsx:5', ah: 0, via: 'rsc' });
    expect([...out.instances.values()][0]).toMatchObject({ name: 'Hero', file: 'src/components/Hero.tsx', line: 5, resolved: 'static' });
  });
  it('skips library server components to the innermost app one (next/link inside a server Button)', async () => {
    const raw = rawPage({ elements: [el('a', [{ fn: null, loc: lib('next_dist_client_link.js') }], [], [0, 0, 120, 40], ['Home@Server', 'Button@Server', 'LinkComponent@Server'])] });
    const index = new Map([['Home', [{ file: 'app/page.tsx', line: 3 }]], ['Button', [{ file: 'components/Button.tsx', line: 10 }]]]);
    const out = await attributePage(raw, createResolver({ kind: 'vite', baseUrl: base, projectDir: 'C:/p' }), index);
    expect(out.elements[0]).toMatchObject({ a: 'Button', al: 'components/Button.tsx:10', via: 'rsc' });
  });
});
