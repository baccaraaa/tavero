import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright';
import { startMiniVite, MINI_VITE_URL } from '../helpers/miniVite.js';
import { login } from '../../src/runtime/session.js';

let stop: () => void;
beforeAll(async () => { stop = await startMiniVite(); });
afterAll(() => stop());

describe('headless login', () => {
  it('fills the form, waits for the redirect and saves a state that keeps the user signed in', async () => {
    const out = mkdtempSync(join(tmpdir(), 'tavero-login-'));
    const saved = await login({ url: MINI_VITE_URL + '/login', outDir: out, email: 'a@b.c', password: 'pw', headless: true });
    const state = JSON.parse(readFileSync(saved, 'utf8')) as { origins: Array<{ localStorage: Array<{ name: string; value: string }> }> };
    expect(state.origins.some((o) => o.localStorage.some((kv) => kv.name === 'mini-auth' && kv.value === '1'))).toBe(true);
    const browser = await chromium.launch();
    const context = await browser.newContext({ storageState: saved });
    const page = await context.newPage();
    await page.goto(MINI_VITE_URL + '/', { waitUntil: 'networkidle' });
    expect(await page.locator('.who').count()).toBe(1);
    await browser.close();
  });
  it('fails clearly when the page has no login form', async () => {
    const out = mkdtempSync(join(tmpdir(), 'tavero-login-'));
    await expect(login({ url: MINI_VITE_URL + '/many', outDir: out, email: 'a@b.c', password: 'pw', headless: true })).rejects.toMatchObject({ code: 'login-failed' });
  });
});
