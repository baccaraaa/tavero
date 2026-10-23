import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Finding } from '../../src/core/types.js';

export const FIXTURE_FINDINGS: Finding[] = [
  { id: 'f_btn', rule: 'buttons', key: 'variants:text', severity: 'high', title: '3 text button styles', summary: 's', stats: { variants: 3, samples: 50 }, evidence: [
    { variantId: 'v_a', componentId: 'c_aaa', component: 'Button', file: 'src/ui/Button.tsx', line: 3, route: '/', viewport: 'mobile', value: 'bg #2d4deb, radius 9999 — 23 instance(s) via Button on 1 page(s)', crop: 'crops/c_aaa/mobile__root__0.png' },
    { variantId: 'v_b', componentId: 'c_bbb', component: 'Card', file: 'src/ui/Card.tsx', line: 1, route: '/', viewport: 'mobile', value: 'bg #ffffff, border 1px #e8eaed — 21 instance(s) via Card on 1 page(s)' },
    { variantId: 'v_c', componentId: 'c_bbb', component: 'Card', file: 'src/ui/Card.tsx', line: 9, route: '/', viewport: 'mobile', value: 'bg #21252b0d — 6 instance(s) via Card on 1 page(s)' },
  ] },
  { id: 'f_col', rule: 'colors', key: 'off:#d92626', severity: 'medium', title: 'Color #d92626 is not a project token', summary: 's', stats: { total: 2 }, evidence: [{ value: 'literal #d92626 in source', file: 'src/x.css', line: 4 }, { value: 'background #d92626', route: '/', viewport: 'mobile', component: 'Card' }] },
];

/** A complete small scan under <projectDir>/.tavero/scans/<name>, marked latest. */
export function writeScanFixture(projectDir: string, opts: { name?: string; findings?: Finding[] } = {}): string {
  const name = opts.name ?? 's1';
  const dir = join(projectDir, '.tavero', 'scans', name);
  mkdirSync(join(dir, 'crops', 'c_aaa'), { recursive: true });
  writeFileSync(join(dir, 'crops', 'c_aaa', 'mobile__root__0.png'), 'png');
  const w = (f: string, v: unknown) => writeFileSync(join(dir, f), JSON.stringify(v));
  w('scan.json', { version: '0.3.0', createdAt: '2026-10-23T10:00:00.000Z', url: 'http://localhost:5173', project: { dir: projectDir, framework: 'vite' }, viewports: [{ name: 'mobile', width: 375, height: 812 }, { name: 'desktop', width: 1440, height: 900 }], routes: [{ path: '/', source: 'cli', status: 'ok' }], stats: { pages: 2, components: 2, instances: 2, tokens: 1, unresolvedComponents: 0, findings: { high: 1, medium: 1, info: 0 } }, warnings: [], stale: false, staleRoutes: [], rescannedRoutes: [], rulesRun: ['buttons', 'cards', 'colors', 'scales'], diff: null });
  w('components.json', [
    { id: 'c_aaa', name: 'Button', file: 'src/ui/Button.tsx', line: 3, resolved: 'stack', instances: 1, pages: ['/'], props: ['variant'] },
    { id: 'c_bbb', name: 'Card', file: 'src/ui/Card.tsx', line: 1, resolved: 'stack', instances: 1, pages: ['/'], props: [] },
  ]);
  w('instances.json', [
    { id: 'i_1', componentId: 'c_aaa', route: '/', viewport: 'mobile', rect: { x: 0, y: 0, w: 10, h: 10 }, hosts: 1, crop: join(dir, 'crops', 'c_aaa', 'mobile__root__0.png') },
    { id: 'i_2', componentId: 'c_bbb', route: '/', viewport: 'mobile', rect: { x: 0, y: 0, w: 10, h: 10 }, hosts: 1 },
  ]);
  w('tokens.json', [{ id: '--a', name: '--a', kind: 'color', value: '#2d4deb', resolved: '#2d4deb', theme: 'light', source: { file: 'src/t.css', line: 2 } }]);
  w('findings.json', opts.findings ?? FIXTURE_FINDINGS);
  w('static.json', { tailwind: { version: null, theme: null }, hardcodedColors: {}, warnings: [] });
  w('samples.json', []);
  w('scales.json', { radius: {}, padding: {}, gap: {}, fontSize: {}, fontWeight: {}, shadow: {}, typography: {} });
  writeFileSync(join(projectDir, '.tavero', 'scans', 'latest'), name);
  return dir;
}
