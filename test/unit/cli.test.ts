import { describe, it, expect } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeTmpProject } from '../helpers/tmp.js';
import { writeScanFixture } from '../helpers/scanFixture.js';
import { saveDecision } from '../../src/core/decisions.js';

function cli(args: string[]): { out: string; code: number } {
  const r = spawnSync('npx', ['tsx', 'src/cli/index.ts', ...args], { encoding: 'utf8', shell: true });
  return { out: (r.stdout + r.stderr).trim(), code: r.status ?? -1 };
}

const killTree = (pid: number) => { if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(pid), '/T', '/F']); else try { process.kill(-pid, 'SIGKILL'); } catch { /* gone */ } };

function fixture() {
  const p = makeTmpProject({});
  const scanDir = join(p.dir, '.tavero', 'scans', 's1');
  mkdirSync(join(scanDir, 'crops', 'c_aaa'), { recursive: true });
  writeFileSync(join(scanDir, 'crops', 'c_aaa', 'mobile__root__0.png'), 'x');
  writeFileSync(join(scanDir, 'scan.json'), JSON.stringify({ version: '0.1.0', createdAt: 'x', url: 'http://localhost:1', project: { dir: p.dir, framework: 'vite' }, viewports: [{ name: 'mobile', width: 375, height: 812 }], routes: [{ path: '/', source: 'cli', status: 'ok' }], stats: { pages: 1, components: 2, instances: 2, tokens: 1, unresolvedComponents: 0, findings: { high: 1, medium: 1, info: 0 } }, warnings: [], stale: false, staleRoutes: [], rescannedRoutes: [], rulesRun: ['buttons', 'cards', 'colors', 'scales'], diff: null }));
  writeFileSync(join(scanDir, 'components.json'), JSON.stringify([
    { id: 'c_aaa', name: 'Button', file: 'src/ui/Button.tsx', line: 3, resolved: 'stack', instances: 2, pages: ['/'], props: ['variant'] },
    { id: 'c_bbb', name: 'Card', file: 'src/ui/Card.tsx', line: 1, resolved: 'stack', instances: 1, pages: ['/'], props: [] },
  ]));
  writeFileSync(join(scanDir, 'instances.json'), JSON.stringify([
    { id: 'i_1', componentId: 'c_aaa', route: '/', viewport: 'mobile', rect: { x: 0, y: 0, w: 10, h: 10 }, hosts: 1, crop: join(scanDir, 'crops', 'c_aaa', 'mobile__root__0.png') },
    { id: 'i_2', componentId: 'c_aaa', route: '/', viewport: 'desktop', rect: { x: 0, y: 0, w: 10, h: 10 }, hosts: 1 },
  ]));
  writeFileSync(join(scanDir, 'tokens.json'), JSON.stringify([{ id: '--a', name: '--a', kind: 'color', value: '#fff', resolved: '#ffffff', theme: 'light', source: { file: 'src/t.css', line: 2 } }]));
  const findings = [
    { id: 'f_1', rule: 'buttons', key: 'variants:text', severity: 'high', title: '5 text button styles', summary: 's', stats: { variants: 5 }, evidence: [{ value: 'a' }, { value: 'b' }, { value: 'c' }] },
    { id: 'f_2', rule: 'colors', key: 'off:#1a9f6e', severity: 'medium', title: 'Color #1a9f6e is not a project token', summary: 's', stats: { total: 1 }, evidence: [{ value: 'background #1a9f6e', file: 'src/X.tsx:1:1' }] },
  ];
  const extras = (dir: string) => {
    writeFileSync(join(dir, 'static.json'), JSON.stringify({ tailwind: { version: null, theme: null }, hardcodedColors: {}, warnings: [] }));
    writeFileSync(join(dir, 'samples.json'), '[]');
    writeFileSync(join(dir, 'scales.json'), JSON.stringify({ radius: {}, padding: {}, gap: {}, fontSize: {}, fontWeight: {}, shadow: {}, typography: {} }));
  };
  writeFileSync(join(scanDir, 'findings.json'), JSON.stringify(findings));
  extras(scanDir);
  // a previous scan with only f_2, for diff
  const prev = join(p.dir, '.tavero', 'scans', 's0');
  mkdirSync(prev, { recursive: true });
  for (const f of ['scan.json', 'components.json', 'instances.json', 'tokens.json']) writeFileSync(join(prev, f), readFileSync(join(scanDir, f)));
  writeFileSync(join(prev, 'findings.json'), JSON.stringify([findings[1]]));
  extras(prev);
  writeFileSync(join(p.dir, '.tavero', 'scans', 'latest'), 's1');
  return p;
}

describe('cli', () => {
  it('components lists a table and supports --json with total/page', () => {
    const p = fixture();
    const t = cli(['components', '--dir', p.dir]);
    expect(t.code).toBe(0);
    expect(t.out).toContain('Button');
    expect(t.out).toContain('src/ui/Button.tsx:3');
    expect(t.out).toMatch(/^id\s+name\s+instances\s+pages\s+file/m);
    const j = cli(['components', '--dir', p.dir, '--json', '--limit', '1']);
    const data = JSON.parse(j.out);
    expect(data.total).toBe(2);
    expect(data.page).toBe(1);
    expect(data.items[0].name).toBe('Button');
    p.cleanup();
  });
  it('component, show and tokens', () => {
    const p = fixture();
    expect(cli(['component', 'Button', '--dir', p.dir]).out).toMatch(/props:\s+variant/);
    expect(cli(['show', 'Button', '--dir', p.dir, '--viewport', 'mobile']).out).toContain('mobile__root__0.png');
    expect(cli(['show', 'Card', '--dir', p.dir]).out).toContain('no crops');
    expect(cli(['tokens', '--dir', p.dir, '--kind', 'color']).out).toContain('--a');
    expect(cli(['component', 'Nope', '--dir', p.dir]).code).toBe(1);
    p.cleanup();
  });
  it('findings and finding', () => {
    const p = fixture();
    const list = cli(['findings', '--dir', p.dir]);
    expect(list.code).toBe(0);
    expect(list.out).toMatch(/^id\s+sev\s+rule\s+decision\s+title\s+evidence/m);
    expect(list.out).toContain('f_1');
    expect(cli(['findings', '--dir', p.dir, '--rule', 'colors', '--json']).out).toContain('"total": 1');
    const one = cli(['finding', 'f_2', '--dir', p.dir]).out;
    expect(one).toContain('Color #1a9f6e is not a project token');
    expect(one).toContain('src/X.tsx:1:1');
    expect(cli(['finding', 'nope', '--dir', p.dir]).code).toBe(1);
    p.cleanup();
  });
  it('context prints the agent markdown', () => {
    const p = fixture();
    const r = cli(['context', '--dir', p.dir]);
    expect(r.code).toBe(0);
    expect(r.out).toContain('## Canonical components');
    expect(r.out).toContain('buttons: 1 finding');
    p.cleanup();
  });
  it('diff between previous and latest', () => {
    const p = fixture();
    const r = cli(['diff', '--dir', p.dir]);
    expect(r.code).toBe(0);
    expect(r.out).toContain('diff vs s0: +1 new, -0 resolved, 1 unchanged');
    expect(r.out).toContain('f_1');
    const j = JSON.parse(cli(['diff', '--dir', p.dir, '--json']).out);
    expect(j.findings.new).toEqual([{ id: 'f_1', severity: 'high', rule: 'buttons', title: '5 text button styles' }]);
    expect(j.note).toBeNull();
    p.cleanup();
  });
  it('report writes report.html into the latest scan', () => {
    const p = fixture();
    const r = cli(['report', '--dir', p.dir]);
    expect(r.code).toBe(0);
    expect(r.out).toContain('report.html');
    const html = readFileSync(join(p.dir, '.tavero', 'scans', 's1', 'report.html'), 'utf8');
    expect(html).toContain('5 text button styles');
    expect(html).toContain('src="crops/c_aaa/mobile__root__0.png"');
    p.cleanup();
  });
  it('mcp --print-config prints a client config and rejects unknown clients', () => {
    const ok = spawnSync('npx', ['tsx', 'src/cli/index.ts', 'mcp', '--print-config', 'claude', '--dir', 'frontend'], { encoding: 'utf8', shell: true });
    expect(ok.status).toBe(0);
    expect(JSON.parse(ok.stdout).mcpServers.tavero.args).toEqual(['-y', 'tavero', 'mcp', '--dir', 'frontend']);
    expect(ok.stderr).toContain('.mcp.json');
    expect(cli(['mcp', '--print-config', 'nope']).code).toBe(2);
  });
  it('findings honours decisions: --all shows accepted, --decision filters', async () => {
    const p = makeTmpProject({});
    writeScanFixture(p.dir);
    await saveDecision(join(p.dir, '.tavero'), 'f_col', { status: 'accepted', reason: 'ok' }, 2);
    await saveDecision(join(p.dir, '.tavero'), 'f_btn', { status: 'fix' }, 3);
    expect(cli(['findings', '--dir', p.dir]).out).not.toContain('f_col');
    const all = cli(['findings', '--dir', p.dir, '--all']).out;
    expect(all).toContain('f_col');
    expect(all).toMatch(/f_btn\s.*fix/);
    expect(JSON.parse(cli(['findings', '--dir', p.dir, '--decision', 'fix', '--json']).out).total).toBe(1);
    p.cleanup();
  });
  it('ui prints its url and serves the panel', async () => {
    const p = makeTmpProject({});
    writeScanFixture(p.dir);
    const child = spawn('npx', ['tsx', 'src/cli/index.ts', 'ui', '--dir', p.dir, '--port', '0'], { shell: true, detached: process.platform !== 'win32' });
    try {
      const url = await new Promise<string>((ok, fail) => {
        let buf = '';
        child.stdout.on('data', (c) => { buf += c; const m = buf.match(/http:\/\/127\.0\.0\.1:\d+\//); if (m) ok(m[0]); });
        setTimeout(() => fail(new Error('no url: ' + buf)), 30_000);
      });
      expect(await (await fetch(url)).text()).toContain('3 text button styles');
    } finally { killTree(child.pid!); p.cleanup(); }
  });
  it('fails with exit 2 and a hint when there is no scan', () => {
    const p = makeTmpProject({});
    const r = cli(['components', '--dir', p.dir]);
    expect(r.code).toBe(2);
    expect(r.out).toContain('tavero scan');
    p.cleanup();
  });
});
