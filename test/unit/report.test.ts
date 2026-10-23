import { describe, it, expect } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadScan } from '../../src/core/loadScan.js';
import { buildReport } from '../../src/report/html.js';
import { makeTmpProject } from '../helpers/tmp.js';

function fixture() {
  const p = makeTmpProject({});
  const scanDir = join(p.dir, '.tavero', 'scans', 's1');
  mkdirSync(join(scanDir, 'crops', 'c_aaa'), { recursive: true });
  const absCrop = join(scanDir, 'crops', 'c_aaa', 'desktop__root__0.png');
  writeFileSync(join(scanDir, 'scan.json'), JSON.stringify({ version: '0.1.0', createdAt: '2026-10-22T10:00:00.000Z', url: 'http://localhost:5173', project: { dir: p.dir, framework: 'vite' }, viewports: [{ name: 'mobile', width: 375, height: 812 }, { name: 'desktop', width: 1440, height: 900 }], routes: [{ path: '/', source: 'cli', status: 'ok' }, { path: '/x', source: 'crawl', status: 'failed', reason: 'timeout' }], stats: { pages: 2, components: 2, instances: 3, tokens: 2, unresolvedComponents: 1, findings: { high: 1, medium: 1, info: 0 } }, warnings: ['one warning'], stale: true, staleRoutes: ['/x'], rescannedRoutes: ['/'], rulesRun: ['buttons', 'cards', 'colors', 'scales'], diff: { from: 's0', new: 1, resolved: 0, unchanged: 1, note: 'partial rescan: 1 stale route(s)' } }));
  writeFileSync(join(scanDir, 'components.json'), JSON.stringify([
    { id: 'c_aaa', name: 'Button', file: 'src/ui/Button.tsx', line: 3, resolved: 'stack', instances: 2, pages: ['/'], props: ['variant'] },
    { id: 'c_bbb', name: 'Hero', file: null, line: null, resolved: 'none', instances: 1, pages: ['/'], props: [] },
  ]));
  writeFileSync(join(scanDir, 'instances.json'), JSON.stringify([
    { id: 'i_1', componentId: 'c_aaa', route: '/', viewport: 'mobile', rect: { x: 0, y: 0, w: 10, h: 10 }, hosts: 1, crop: 'crops/c_aaa/mobile__root__0.png' },
    { id: 'i_2', componentId: 'c_aaa', route: '/', viewport: 'desktop', rect: { x: 0, y: 0, w: 10, h: 10 }, hosts: 1, crop: absCrop },
    { id: 'i_3', componentId: 'c_bbb', route: '/', viewport: 'mobile', rect: { x: 0, y: 0, w: 10, h: 10 }, hosts: 1 },
  ]));
  writeFileSync(join(scanDir, 'tokens.json'), JSON.stringify([
    { id: '--a', name: '--a', kind: 'color', value: '#fff', resolved: '#ffffff', theme: 'light', source: { file: 'src/t.css', line: 2 } },
    { id: '--r', name: '--r', kind: 'radius', value: '8px', resolved: '8px', theme: 'light', source: { source: 'runtime' } },
  ]));
  writeFileSync(join(scanDir, 'findings.json'), JSON.stringify([
    { id: 'f_1', rule: 'buttons', key: 'variants:text', severity: 'high', title: '5 text button styles <b>', summary: 'five', stats: { variants: 5 }, evidence: [{ value: 'bg #2d4deb', component: 'Button', file: 'src/ui/Button.tsx', line: 3, crop: absCrop }] },
    { id: 'f_2', rule: 'cards', key: 'variants', severity: 'medium', title: '2 card styles', summary: 's', stats: { variants: 2 }, evidence: [{ value: 'radius 12', route: '/', viewport: 'desktop' }], preliminary: true },
  ]));
  writeFileSync(join(scanDir, 'static.json'), JSON.stringify({ tailwind: { version: null, theme: null }, hardcodedColors: {}, warnings: [] }));
  writeFileSync(join(scanDir, 'samples.json'), '[]');
  writeFileSync(join(scanDir, 'scales.json'), JSON.stringify({ radius: {}, padding: {}, gap: {}, fontSize: {}, fontWeight: {}, shadow: {}, typography: {} }));
  writeFileSync(join(p.dir, '.tavero', 'scans', 'latest'), 's1');
  return p;
}

describe('buildReport', () => {
  it('renders summary, findings with evidence, components with crops and tokens into one self-contained page', async () => {
    const p = fixture();
    const html = buildReport(await loadScan(p.dir));
    expect(html).toMatch(/^<!doctype html>/i);
    expect(html).toContain('<title>Tavero report');
    // summary
    expect(html).toContain('http://localhost:5173');
    expect(html).toContain('1 high');
    expect(html).toContain('partial rescan: 1 stale route(s)');
    expect(html).toContain('one warning');
    expect(html).toContain('/x');
    expect(html).toContain('timeout');
    // findings: escaped title, evidence rows, preliminary mark, relative crop link
    expect(html).toContain('5 text button styles &lt;b&gt;');
    expect(html).not.toContain('<b>');
    expect(html).toContain('bg #2d4deb');
    expect(html).toContain('src/ui/Button.tsx:3');
    expect(html).toContain('cards*');
    expect(html).toContain('href="crops/c_aaa/desktop__root__0.png"');
    // components: one crop per viewport, relative paths whether stored relative or absolute
    expect(html).toContain('src="crops/c_aaa/mobile__root__0.png"');
    expect(html).toContain('src="crops/c_aaa/desktop__root__0.png"');
    expect(html).toContain('Hero');
    expect(html).toContain('unresolved');
    // tokens with a swatch
    expect(html).toContain('--a');
    expect(html).toContain('background:#ffffff');
    expect(html).toContain('src/t.css:2');
    // self-contained
    expect(html).not.toMatch(/<script\s+src|<link\s/);
    p.cleanup();
  });
});
