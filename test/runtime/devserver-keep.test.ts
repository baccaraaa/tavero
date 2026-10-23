import { describe, it, expect } from 'vitest';
import { existsSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { MINI_VITE_URL, MINI_VITE_DIR } from '../helpers/miniVite.js';
import { isUp } from '../../src/runtime/server.js';
import { scan } from '../../src/core/scan.js';
import { DEFAULT_VIEWPORTS } from '../../src/core/types.js';

async function waitFor(cond: () => Promise<boolean>, ms = 15_000): Promise<boolean> {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await cond()) return true; await new Promise((r) => setTimeout(r, 500)); }
  return cond();
}

describe('keepDevServer', () => {
  it('leaves a dev server that the scan launched running until the caller stops it', async () => {
    // other test files stop the mini app in afterAll; the port takes a moment to free up
    expect(await waitFor(async () => !(await isUp(MINI_VITE_URL)))).toBe(true);
    const out = mkdtempSync(join(tmpdir(), 'tavero-keep-'));
    const res = await scan({ projectDir: MINI_VITE_DIR, url: MINI_VITE_URL, out, routes: ['/'], viewports: [DEFAULT_VIEWPORTS[0]], keepDevServer: true });
    try {
      expect(res.devServer.launched).toBe(true);
      expect(await isUp(MINI_VITE_URL)).toBe(true);
      expect(existsSync(join(out, 'devserver.log'))).toBe(true);
    } finally {
      res.devServer.stop();
    }
    expect(await waitFor(async () => !(await isUp(MINI_VITE_URL)))).toBe(true);
  });
});
