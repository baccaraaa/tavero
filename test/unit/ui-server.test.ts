import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createUiServer } from '../../src/ui/server.js';
import { makeTmpProject } from '../helpers/tmp.js';
import { writeScanFixture } from '../helpers/scanFixture.js';

let close: (() => Promise<void>) | null = null;
afterEach(async () => { await close?.(); close = null; });

async function start(dir: string) {
  const s = await createUiServer({ projectDir: dir, port: 0 });
  close = s.close;
  return s;
}

describe('tavero ui server', () => {
  it('renders the triage page with filters, list and the first finding', async () => {
    const p = makeTmpProject({});
    writeScanFixture(p.dir);
    const s = await start(p.dir);
    expect(s.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);
    const html = await (await fetch(s.url)).text();
    expect(html).toContain('<meta name="tavero-token" content="' + s.token + '">');
    expect(html).toContain('3 text button styles');
    expect(html).toContain('1 Fix');
    expect(html).toContain('href="/assets/tokens.css"');
    expect((await fetch(s.url + 'assets/tokens.css')).status).toBe(200);
    expect((await fetch(s.url + 'assets/fonts/onest-latin-400-normal.woff2')).status).toBe(200);
    expect((await fetch(s.url + 'assets/fonts/../server.ts')).status).toBe(404);
    expect(html).toContain('Color #d92626 is not a project token');
    expect(html).toContain('data-id="f_btn"');
    expect(html).toContain('name="primary" value="v_a"'); // canonical picker for the variants finding shown first
    expect(html).toContain('src="/files/s1/crops/c_aaa/mobile__root__0.png"');
    const frag = await (await fetch(s.url + 'f/f_col', { headers: { 'X-Tavero-Fragment': '1' } })).text();
    expect(frag).not.toContain('<html');
    expect(frag).toContain('literal #d92626 in source');
    for (const path of ['components', 'components/c_aaa', 'tokens', 'scans']) expect((await fetch(s.url + path)).status, path).toBe(200);
    p.cleanup();
  });
  it('writes decisions only with the session token and serves files only from the scan folder', async () => {
    const p = makeTmpProject({});
    writeScanFixture(p.dir);
    const s = await start(p.dir);
    const post = (id: string, body: unknown, token?: string) => fetch(s.url + 'api/decisions/' + id, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { 'x-tavero-token': token } : {}) }, body: JSON.stringify(body) });
    expect((await post('f_col', { status: 'accepted', reason: 'x' })).status).toBe(403);
    expect((await post('f_nope', { status: 'fix' }, s.token)).status).toBe(404);
    const ok = await post('f_col', { status: 'accepted', reason: 'brand red' }, s.token);
    expect(ok.status).toBe(200);
    expect((await ok.json()).finding.decision).toMatchObject({ status: 'accepted', reason: 'brand red' });
    expect(JSON.parse(readFileSync(join(p.dir, '.tavero', 'decisions.json'), 'utf8')).findings.f_col).toMatchObject({ status: 'accepted', places: 2 });
    expect(await (await fetch(s.url)).text()).not.toContain('data-id="f_col"');
    const named = await post('f_btn', { canonical: { primary: 'v_a', allowed: ['v_b'], names: { v_a: 'primary', v_b: 'outline', v_c: 'ignored', v_x: 'x'.repeat(99) } } }, s.token);
    expect((await named.json()).finding.decision.canonical.names).toEqual({ v_a: 'primary', v_b: 'outline' });
    expect(await (await fetch(s.url + 'f/f_btn')).text()).toContain('value="primary"');
    expect((await fetch(s.url + 'api/decisions/f_col', { method: 'DELETE', headers: { 'x-tavero-token': s.token } })).status).toBe(200);
    expect(await (await fetch(s.url)).text()).toContain('data-id="f_col"');
    expect((await fetch(s.url + 'files/s1/crops/c_aaa/mobile__root__0.png')).status).toBe(200);
    expect((await fetch(s.url + 'files/s1/scan.json')).status).toBe(200);
    expect((await fetch(s.url + 'files/..%2F..%2Fdecisions.json')).status).toBe(404);
    expect((await fetch(s.url + 'files/../../../package.json')).status).toBe(404);
    p.cleanup();
  });
  it('reports the latest scan and shows a hint when there is none', async () => {
    const p = makeTmpProject({});
    const s = await start(p.dir);
    expect(await (await fetch(s.url)).text()).toContain('tavero scan --url');
    expect(await (await fetch(s.url + 'api/latest')).json()).toEqual({ scan: null });
    writeScanFixture(p.dir, { name: 's2' });
    expect(await (await fetch(s.url + 'api/latest')).json()).toEqual({ scan: 's2' });
    p.cleanup();
  });
  it('answers 500 without overwriting a broken decisions file', async () => {
    const p = makeTmpProject({});
    writeScanFixture(p.dir);
    writeFileSync(join(p.dir, '.tavero', 'decisions.json'), '{ broken');
    const s = await start(p.dir);
    const r = await fetch(s.url + 'api/decisions/f_col', { method: 'POST', headers: { 'content-type': 'application/json', 'x-tavero-token': s.token }, body: JSON.stringify({ status: 'fix' }) });
    expect(r.status).toBe(500);
    expect(readFileSync(join(p.dir, '.tavero', 'decisions.json'), 'utf8')).toBe('{ broken');
    p.cleanup();
  });
});
