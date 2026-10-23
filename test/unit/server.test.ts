import { describe, it, expect } from 'vitest';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { isUp, attachOrLaunch, killPort } from '../../src/runtime/server.js';
import { makeTmpProject } from '../helpers/tmp.js';

describe('dev server', () => {
  it('attaches to a running server without launching', async () => {
    const srv = createServer((_, res) => { res.writeHead(200); res.end('ok'); }).listen(5998, '127.0.0.1');
    await new Promise((r) => srv.once('listening', r));
    expect(await isUp('http://127.0.0.1:5998')).toBe(true);
    const h = await attachOrLaunch({ url: 'http://127.0.0.1:5998', projectDir: '.', devScript: null, logPath: 'ignored.log' });
    expect(h.launched).toBe(false);
    h.stop();
    srv.close();
  });
  it('launches npm run dev when nothing listens, then stops it', async () => {
    const fake = resolve('test/helpers/fake-dev-server.cjs').replace(/\\/g, '/');
    const p = makeTmpProject({ 'package.json': JSON.stringify({ scripts: { dev: `node "${fake}" 5997` } }) });
    expect(await isUp('http://127.0.0.1:5997')).toBe(false);
    const h = await attachOrLaunch({ url: 'http://127.0.0.1:5997', projectDir: p.dir, devScript: 'node', logPath: `${p.dir}/dev.log`, timeoutMs: 30_000 });
    expect(h.launched).toBe(true);
    expect(await isUp('http://127.0.0.1:5997')).toBe(true);
    h.stop();
    await new Promise((r) => setTimeout(r, 1500));
    expect(await isUp('http://127.0.0.1:5997')).toBe(false);
    expect(killPort(5997)).toEqual([]);
    p.cleanup();
  });
  it('fails clearly without a dev script', async () => {
    await expect(attachOrLaunch({ url: 'http://127.0.0.1:5996', projectDir: '.', devScript: null, logPath: 'x.log' })).rejects.toMatchObject({ code: 'dev-server' });
  });
});
