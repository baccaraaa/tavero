import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { isUnauthenticated, login, loadSessionPath, sessionPath } from '../../src/runtime/session.js';
import { makeTmpProject } from '../helpers/tmp.js';

describe('session', () => {
  it('detects redirects to login and password forms, but not on login routes themselves', () => {
    expect(isUnauthenticated({ route: '/dashboard', finalUrl: 'http://x/login?from=/dashboard', hasPasswordInput: true })).toBe(true);
    expect(isUnauthenticated({ route: '/dashboard', finalUrl: 'http://x/dashboard', hasPasswordInput: true })).toBe(true);
    expect(isUnauthenticated({ route: '/dashboard', finalUrl: 'http://x/dashboard', hasPasswordInput: false })).toBe(false);
    expect(isUnauthenticated({ route: '/login', finalUrl: 'http://x/login', hasPasswordInput: true })).toBe(false);
    expect(isUnauthenticated({ route: '/auth/signin', finalUrl: 'http://x/auth/signin', hasPasswordInput: true })).toBe(false);
  });
  it('login saves storage state when the caller signals completion', async () => {
    const srv = createServer((_, res) => {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<html><body><script>localStorage.setItem("k","v")</script>hi</body></html>');
    }).listen(5995, '127.0.0.1');
    await new Promise((r) => srv.once('listening', r));
    const p = makeTmpProject({});
    const out = `${p.dir}/.tavero`;
    expect(await loadSessionPath(out)).toBeNull();
    const saved = await login({ url: 'http://127.0.0.1:5995', outDir: out, waitForEnter: async () => { await new Promise((r) => setTimeout(r, 1500)); }, headless: true });
    expect(saved).toBe(sessionPath(out));
    expect(existsSync(saved)).toBe(true);
    expect(await loadSessionPath(out)).toBe(saved);
    const state = JSON.parse(await readFile(saved, 'utf8'));
    expect(JSON.stringify(state)).toContain('"k"');
    srv.close();
    p.cleanup();
  });
});
