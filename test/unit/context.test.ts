import { describe, it, expect } from 'vitest';
import { buildContext } from '../../src/context/context.js';
import type { Component, Finding, ScanMeta, StyleSample, Token, NormalizedStyles } from '../../src/core/types.js';

const meta: ScanMeta = { version: '0.1.0', createdAt: 'x', url: 'http://localhost:5173', project: { dir: 'C:/p', framework: 'vite' }, viewports: [], routes: [], stats: { pages: 8, components: 70, instances: 700, tokens: 12, unresolvedComponents: 0, findings: { high: 1, medium: 3, info: 4 } }, warnings: [], stale: false, staleRoutes: [], rescannedRoutes: [], rulesRun: ['buttons', 'cards', 'colors', 'scales'], diff: null };
const tok = (name: string, kind: Token['kind'], value: string, resolved = value): Token => ({ id: name, name, kind, value, resolved, theme: 'light', source: { file: 'src/index.css', line: 3 } });
const comp = (id: string, name: string, file: string, instances: number, props: string[] = []): Component => ({ id, name, file, line: 10, resolved: 'stack', instances, pages: ['/'], props });
const N = (o: Partial<NormalizedStyles> = {}): NormalizedStyles => ({ bg: '#2d4deb', color: '#ffffff', borderWidth: 0, borderStyle: 'none', borderColor: null, radius: [9999, 9999, 9999, 9999], paddingY: 8, paddingX: 16, padding: [8, 16, 8, 16], gap: 0, fontSize: 14, fontWeight: 500, lineHeight: 20, fontFamily: 'Geist', shadow: 'none', height: 36, display: 'inline-flex', position: 'static', ...o });
const sample = (id: string, role: StyleSample['role'], componentId: string, componentName: string, file: string, inOverlay = false, route = '/'): StyleSample => ({ id, route, viewport: 'desktop', role, componentId, componentName, file, line: 1, hops: 0, rect: { x: 0, y: 0, w: 1, h: 1 }, text: 'x', styles: N(), parentBg: null, children: 2, nested: false, inOverlay });
const finding = (id: string, rule: Finding['rule'], severity: Finding['severity'], title: string): Finding => ({ id, rule, key: id, severity, title, summary: '', stats: {}, evidence: [] });

describe('buildContext', () => {
  const input = {
    meta,
    components: [
      comp('c_db', 'DashButton', 'src/components/dashboard/primitives/DashButton.tsx', 23, ['variant', 'size']),
      comp('c_b', 'Button', 'src/components/ui/button.tsx', 36, ['variant']),
      comp('c_card', 'DashCard', 'src/components/dashboard/primitives/DashCard.tsx', 57, ['flush']),
    ],
    tokens: [tok('--lp-accent', 'color', '221 83% 53%', '#2d4deb'), tok('--lp-bg', 'color', '220 20% 97%', '#f6f7f9'), tok('--lp-radius', 'radius', '12px'), tok('--font-display', 'font-family', 'Geist')],
    samples: [
      sample('s1', 'button-text', 'c_db', 'DashButton', 'src/components/dashboard/primitives/DashButton.tsx'),
      sample('s2', 'button-text', 'c_db', 'DashButton', 'src/components/dashboard/primitives/DashButton.tsx'),
      sample('s3', 'button-text', 'c_b', 'Button', 'src/components/ui/button.tsx'),
      sample('s4', 'card', 'c_card', 'DashCard', 'src/components/dashboard/primitives/DashCard.tsx'),
    ],
    findings: [finding('f_1', 'buttons', 'high', '5 text button styles'), finding('f_2', 'colors', 'medium', 'Color #1a9f6e is not a project token'), finding('f_3', 'scales', 'info', '4 distinct radius values, 10 declared')],
    scales: { radius: { '12': { count: 40, examples: [] }, '9999': { count: 10, examples: [] } }, padding: { '16': { count: 30, examples: [] } }, gap: {}, fontSize: {}, fontWeight: {}, shadow: {}, typography: { '14/500/20': { count: 50, examples: [] }, '16/400/24': { count: 30, examples: [] } } },
    staticInfo: { tailwind: { version: 3 as const, theme: null }, hardcodedColors: {}, warnings: [] },
  };
  it('renders the five sections in order, imperative and within budget', () => {
    const md = buildContext(input);
    const idx = (s: string) => md.indexOf(s);
    expect(idx('## Stack')).toBeGreaterThanOrEqual(0);
    expect(idx('## Tokens')).toBeGreaterThan(idx('## Stack'));
    expect(idx('## Canonical components')).toBeGreaterThan(idx('## Tokens'));
    expect(idx('## Conventions')).toBeGreaterThan(idx('## Canonical components'));
    expect(idx('## Open problems')).toBeGreaterThan(idx('## Conventions'));
    expect(md).toContain('Vite, React, Tailwind 3');
    expect(md).toContain('| --lp-accent | #2d4deb |');
    expect(md).toContain('Action button is DashButton from src/components/dashboard/primitives/DashButton.tsx (props: variant, size); also seen: Button from src/components/ui/button.tsx (1 sample on 1 route).');
    expect(md).toContain('Card is DashCard from src/components/dashboard/primitives/DashCard.tsx');
    expect(md).toContain('Dominant radius 12px (80%)');
    expect(md).toContain('14px/500/20px (63%)');
    expect(md).toContain('buttons: 1 finding, worst f_1 (high) 5 text button styles');
    expect(md.length).toBeLessThanOrEqual(1500 * 4);
  });
  it('ranks canonical components by samples, ignoring overlay samples, with routes as the tie-breaker', () => {
    const md = buildContext({
      ...input,
      components: [...input.components, comp('c_cookie', 'CookieButton', 'src/common/CookieBanner.tsx', 24), comp('c_top', 'Topbar', 'src/components/shell/Topbar.tsx', 8)],
      samples: [
        // the real action button: 4 samples on 2 routes
        sample('a1', 'button-text', 'c_db', 'DashButton', 'src/components/dashboard/primitives/DashButton.tsx', false, '/dashboard'),
        sample('a2', 'button-text', 'c_db', 'DashButton', 'src/components/dashboard/primitives/DashButton.tsx', false, '/dashboard'),
        sample('a3', 'button-text', 'c_db', 'DashButton', 'src/components/dashboard/primitives/DashButton.tsx', false, '/dashboard/resumes'),
        sample('a4', 'button-text', 'c_db', 'DashButton', 'src/components/dashboard/primitives/DashButton.tsx', false, '/dashboard/resumes'),
        // a cookie banner: 8 samples on 4 routes, all inside a fixed overlay
        ...['/a', '/b', '/c', '/d'].flatMap((r, i) => [sample(`o${i}a`, 'button-text', 'c_cookie', 'CookieButton', 'src/common/CookieBanner.tsx', true, r), sample(`o${i}b`, 'button-text', 'c_cookie', 'CookieButton', 'src/common/CookieBanner.tsx', true, r)]),
        // a shell button on every route, but fewer samples than the real one
        ...['/a', '/b', '/c'].map((r, i) => sample(`t${i}`, 'button-text', 'c_top', 'Topbar', 'src/components/shell/Topbar.tsx', false, r)),
        // same sample count as the topbar, fewer routes
        sample('b1', 'button-text', 'c_b', 'Button', 'src/components/ui/button.tsx', false, '/dashboard'),
        sample('b2', 'button-text', 'c_b', 'Button', 'src/components/ui/button.tsx', false, '/dashboard'),
        sample('b3', 'button-text', 'c_b', 'Button', 'src/components/ui/button.tsx', false, '/dashboard'),
      ],
    });
    expect(md).toContain('Action button is DashButton from');
    expect(md).not.toContain('CookieButton');
    expect(md).toContain('also seen: Topbar from src/components/shell/Topbar.tsx (3 samples on 3 routes); Button from src/components/ui/button.tsx (3 samples on 1 route)');
  });
  it('shrinks under a small budget', () => {
    const md = buildContext({ ...input, budgetTokens: 120 });
    expect(md.length).toBeLessThanOrEqual(120 * 4 + 200);
    expect(md).toContain('## Open problems');
  });
});
