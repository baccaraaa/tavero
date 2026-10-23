import { describe, it, expect } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadScan } from '../../src/core/loadScan.js';
import { makeTmpProject } from '../helpers/tmp.js';
import { saveDecision } from '../../src/core/decisions.js';
import { writeScanFixture } from '../helpers/scanFixture.js';

function fixture() {
  const p = makeTmpProject({});
  const scanDir = join(p.dir, '.tavero', 'scans', '2026-10-21T10-00-00');
  mkdirSync(scanDir, { recursive: true });
  const components = [
    { id: 'c_aaa', name: 'Button', file: 'src/ui/Button.tsx', line: 3, resolved: 'stack', instances: 10, pages: ['/', '/x'], props: ['variant'] },
    { id: 'c_bbb', name: 'Card', file: 'src/ui/Card.tsx', line: 1, resolved: 'stack', instances: 4, pages: ['/'], props: [] },
    { id: 'c_ccc', name: 'Hero', file: null, line: null, resolved: 'none', instances: 1, pages: ['/'], props: [] },
  ];
  const instances = [
    { id: 'i_1', componentId: 'c_aaa', route: '/', viewport: 'mobile', rect: { x: 0, y: 0, w: 10, h: 10 }, hosts: 1, crop: 'crops/c_aaa/mobile__root__0.png' },
    { id: 'i_2', componentId: 'c_aaa', route: '/', viewport: 'desktop', rect: { x: 0, y: 0, w: 10, h: 10 }, hosts: 1, crop: 'crops/c_aaa/desktop__root__0.png' },
    { id: 'i_3', componentId: 'c_bbb', route: '/', viewport: 'mobile', rect: { x: 0, y: 0, w: 10, h: 10 }, hosts: 2 },
  ];
  const tokens = [
    { id: '--a', name: '--a', kind: 'color', value: '#fff', resolved: '#ffffff', theme: 'light', source: { source: 'runtime' } },
    { id: '--r', name: '--r', kind: 'radius', value: '8px', resolved: '8px', theme: 'light', source: { file: 'src/t.css', line: 2 } },
  ];
  writeFileSync(join(scanDir, 'scan.json'), JSON.stringify({ version: '0.1.0', createdAt: 'x', url: 'http://localhost:1', project: { dir: p.dir, framework: 'vite' }, viewports: [], routes: [], stats: { pages: 1, components: 3, instances: 3, tokens: 2, unresolvedComponents: 1 }, warnings: [], stale: false }));
  writeFileSync(join(scanDir, 'components.json'), JSON.stringify(components));
  writeFileSync(join(scanDir, 'instances.json'), JSON.stringify(instances));
  writeFileSync(join(scanDir, 'tokens.json'), JSON.stringify(tokens));
  writeFileSync(join(scanDir, 'findings.json'), JSON.stringify([
    { id: 'f_1', rule: 'buttons', key: 'variants:text', severity: 'high', title: '5 text button styles', summary: 's', stats: { variants: 5 }, evidence: [{ value: 'a' }, { value: 'b' }, { value: 'c' }] },
    { id: 'f_2', rule: 'colors', key: 'off:#1a9f6e', severity: 'medium', title: 'Color #1a9f6e is not a project token', summary: 's', stats: { total: 1 }, evidence: [{ value: 'background #1a9f6e', file: 'src/X.tsx:1:1' }] },
  ]));
  writeFileSync(join(scanDir, 'static.json'), JSON.stringify({ tailwind: { version: null, theme: null }, hardcodedColors: {}, warnings: [] }));
  writeFileSync(join(scanDir, 'samples.json'), '[]');
  writeFileSync(join(scanDir, 'scales.json'), JSON.stringify({ radius: {}, padding: {}, gap: {}, fontSize: {}, fontWeight: {}, shadow: {}, typography: {} }));
  writeFileSync(join(p.dir, '.tavero', 'scans', 'latest'), '2026-10-21T10-00-00');
  return { p, scanDir };
}

describe('Scan query API', () => {
  it('loads latest from a project dir and pages components', async () => {
    const { p } = fixture();
    const s = await loadScan(p.dir);
    const page1 = s.components({ limit: 2 });
    expect(page1.total).toBe(3);
    expect(page1.items.map((c) => c.name)).toEqual(['Button', 'Card']);
    expect(s.components({ limit: 2, page: 2 }).items.map((c) => c.name)).toEqual(['Hero']);
    expect(s.components({ sort: 'name' }).items.map((c) => c.name)).toEqual(['Button', 'Card', 'Hero']);
    expect(s.components({ query: 'car' }).items.map((c) => c.name)).toEqual(['Card']);
    expect(s.components({ unresolvedOnly: true }).items.map((c) => c.name)).toEqual(['Hero']);
    p.cleanup();
  });
  it('finds a component by id or name, lists instances and crops', async () => {
    const { p, scanDir } = fixture();
    const s = await loadScan(scanDir);
    expect(s.component('c_bbb')?.name).toBe('Card');
    expect(s.component('Button')?.id).toBe('c_aaa');
    expect(s.component('Nope')).toBeNull();
    expect(s.instancesOf('c_aaa').map((i) => i.id)).toEqual(['i_1', 'i_2']);
    expect(s.instancesOf('c_aaa', 'desktop').map((i) => i.id)).toEqual(['i_2']);
    expect(s.crops('Button', 'mobile')).toEqual([join(scanDir, 'crops/c_aaa/mobile__root__0.png')]);
    expect(s.crops('Card')).toEqual([]);
    expect(s.tokens({ kind: 'radius' }).items.map((t) => t.name)).toEqual(['--r']);
    p.cleanup();
  });
  it('lists and reads findings with paged evidence', async () => {
    const { p } = fixture();
    const s = await loadScan(p.dir);
    expect(s.findings().items.map((f) => [f.id, f.evidenceCount])).toEqual([['f_1', 3], ['f_2', 1]]);
    expect(s.findings({ rule: 'colors' }).total).toBe(1);
    expect(s.findings({ severity: 'high' }).items.map((f) => f.id)).toEqual(['f_1']);
    const f = s.finding('f_1', { evidenceLimit: 2, evidencePage: 2 })!;
    expect(f.evidence.map((e) => e.value)).toEqual(['c']);
    expect(f.evidenceTotal).toBe(3);
    expect(s.finding('nope')).toBeNull();
    p.cleanup();
  });
  it('fails clearly when there is no scan', async () => {
    const p = makeTmpProject({});
    await expect(loadScan(p.dir)).rejects.toMatchObject({ code: 'no-scan' });
    p.cleanup();
  });
});
describe('Scan with decisions', () => {
  it('hides accepted findings, filters by decision, keeps hidden ones openable, and names the canonical in context', async () => {
    const p = makeTmpProject({});
    writeScanFixture(p.dir);
    const out = join(p.dir, '.tavero');
    await saveDecision(out, 'f_col', { status: 'accepted', reason: 'brand red' }, 2);
    await saveDecision(out, 'f_btn', { canonical: { primary: 'v_a', allowed: ['v_b'] } }, 3);
    const s = await loadScan(p.dir);
    expect(s.findings().items.map((f) => f.id)).toEqual(['f_btn']);
    expect(s.findings({ includeAccepted: true }).items.map((f) => f.id)).toEqual(['f_btn', 'f_col']);
    expect(s.findings({ decision: 'fix' }).total).toBe(0);
    expect(s.finding('f_col')!.decision).toMatchObject({ status: 'accepted', reason: 'brand red' });
    expect(s.finding('f_btn')!.evidence[2].expected).toBe('Button (bg #2d4deb, radius 9999) or Card (bg #ffffff, border 1px #e8eaed)');
    expect(s.rawFindings).toHaveLength(2);
    expect(s.allFindings.map((f) => f.id)).toEqual(['f_btn']);
    const md = s.regenerateContext();
    expect(md).toContain('Action button is Button (bg #2d4deb, radius 9999) from src/ui/Button.tsx; also allowed: Card (bg #ffffff, border 1px #e8eaed).');
    expect(md).not.toContain('#d92626');
    p.cleanup();
  });
});
