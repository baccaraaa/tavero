import { describe, it, expect } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadScan } from '../../src/core/loadScan.js';
import { componentView, diffView, findingView, scanView, showView } from '../../src/core/views.js';
import type { ScanResult } from '../../src/core/scan.js';
import { makeTmpProject } from '../helpers/tmp.js';

const META = (over: object = {}) => ({ version: '0.2.0', createdAt: 'x', url: 'http://localhost:5173', project: { dir: '.', framework: 'vite' }, viewports: [{ name: 'mobile', width: 375, height: 812 }], routes: [{ path: '/', source: 'cli', status: 'ok' }], stats: { pages: 1, components: 1, instances: 2, tokens: 0, unresolvedComponents: 0, findings: { high: 1, medium: 0, info: 0 } }, warnings: [], stale: false, staleRoutes: [], rescannedRoutes: [], rulesRun: ['buttons'], diff: null, ...over });
const F = (id: string, n: number) => ({ id, rule: 'buttons', key: id, severity: 'high', title: `t ${id}`, summary: 's', stats: { n }, evidence: [{ value: 'a', route: '/' }, { value: 'b', route: '/x' }] });

function fixture() {
  const p = makeTmpProject({});
  const write = (name: string, meta: object, findings: object[]) => {
    const d = join(p.dir, '.tavero', 'scans', name);
    mkdirSync(join(d, 'crops', 'c_a'), { recursive: true });
    writeFileSync(join(d, 'scan.json'), JSON.stringify(meta));
    writeFileSync(join(d, 'components.json'), JSON.stringify([{ id: 'c_a', name: 'Button', file: 'src/B.tsx', line: 1, resolved: 'stack', instances: 2, pages: ['/'], props: [] }]));
    writeFileSync(join(d, 'instances.json'), JSON.stringify([
      { id: 'i1', componentId: 'c_a', route: '/', viewport: 'mobile', rect: { x: 0, y: 0, w: 1, h: 1 }, hosts: 1, crop: 'crops/c_a/m.png' },
      { id: 'i2', componentId: 'c_a', route: '/', viewport: 'desktop', rect: { x: 0, y: 0, w: 1, h: 1 }, hosts: 1 },
    ]));
    writeFileSync(join(d, 'tokens.json'), '[]');
    writeFileSync(join(d, 'findings.json'), JSON.stringify(findings));
  };
  write('s0', META(), [F('f_1', 5), F('f_2', 1)]);
  write('s1', META({ stale: true, staleRoutes: ['/x'] }), [F('f_1', 3), F('f_3', 1)]);
  writeFileSync(join(p.dir, '.tavero', 'scans', 'latest'), 's1');
  return p;
}

describe('views', () => {
  it('finding, component and show views with not-found codes', async () => {
    const p = fixture();
    const s = await loadScan(p.dir);
    expect(findingView(s, 'f_1', { evidenceLimit: 1 })).toMatchObject({ id: 'f_1', evidenceTotal: 2, evidence: [{ value: 'a' }] });
    expect(() => findingView(s, 'nope')).toThrow(expect.objectContaining({ code: 'unknown-finding' }));
    expect(componentView(s, 'Button')).toMatchObject({ id: 'c_a', instancesByPage: { '/': ['mobile', 'desktop'] } });
    expect(componentView(s, 'Button').crops[0]).toMatch(/crops[\\/]c_a[\\/]m\.png$/);
    expect(showView(s, 'c_a', 'desktop')).toEqual({ crops: [] });
    expect(() => showView(s, 'Nope')).toThrow(expect.objectContaining({ code: 'unknown-component' }));
    p.cleanup();
  });
  it('diff view is compact and carries the partial-rescan note', async () => {
    const p = fixture();
    const d = await diffView(p.dir, undefined);
    expect(d.from).toBe('s0');
    expect(d.findings.new).toEqual([{ id: 'f_3', severity: 'high', rule: 'buttons', title: 't f_3' }]);
    expect(d.findings.resolved).toEqual([{ id: 'f_2', severity: 'high', rule: 'buttons', title: 't f_2' }]);
    expect(d.findings.unchanged).toEqual([{ id: 'f_1', title: 't f_1', statsChanged: { n: [5, 3] } }]);
    expect(d.components).toEqual({ added: [], removed: [] });
    expect(d.staleRoutes).toBe(1);
    expect(d.note).toContain('1 stale route(s)');
    await expect(diffView(p.dir, undefined, undefined, 's0')).rejects.toMatchObject({ code: 'no-previous-scan' });
    p.cleanup();
  });
  it('scan view summarizes a scan result and flags login redirects', () => {
    const res = { dir: '/p/.tavero/scans/2026-10-22T10-00-00-000', components: [], warnings: ['w1'], devServer: { launched: false, stop: () => {} },
      meta: META({ routes: [{ path: '/', source: 'cli', status: 'ok' }, { path: '/dash', source: 'cli', status: 'unauthenticated', reason: 'landed on /login' }], diff: { from: 's0', new: 0, resolved: 1, unchanged: 3, note: null } }) } as unknown as ScanResult;
    const v = scanView(res);
    expect(v).toMatchObject({ scan: '2026-10-22T10-00-00-000', unauthenticatedRoutes: ['/dash'], diff: { resolved: 1 }, stale: false });
    expect(v.warnings[0]).toBe('w1');
    expect(v.warnings[1]).toContain('tavero login');
  });
});
