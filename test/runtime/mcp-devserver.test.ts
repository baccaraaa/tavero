import { describe, it, expect } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { MINI_VITE_URL, MINI_VITE_DIR } from '../helpers/miniVite.js';
import { connectMcp } from '../helpers/mcpClient.js';
import { isUp } from '../../src/runtime/server.js';

async function waitFor(cond: () => Promise<boolean>, ms = 20_000): Promise<boolean> {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await cond()) return true; await new Promise((r) => setTimeout(r, 500)); }
  return cond();
}

describe('MCP-launched dev server', () => {
  it('survives between scans and stops when the client disconnects', async () => {
    // the previous test file stops the mini app in afterAll; the port takes a moment to free up
    expect(await waitFor(async () => !(await isUp(MINI_VITE_URL)))).toBe(true);
    const mcp = await connectMcp(MINI_VITE_DIR, mkdtempSync(join(tmpdir(), 'tavero-mcp-dev-')));
    const args = { name: 'tavero_scan', arguments: { url: MINI_VITE_URL, routes: ['/'], viewports: ['mobile'] } };
    try {
      expect((await mcp.client.callTool(args, undefined, { timeout: 240_000 })).isError).toBeFalsy();
      expect(await isUp(MINI_VITE_URL)).toBe(true);
      const t0 = Date.now();
      expect((await mcp.client.callTool(args, undefined, { timeout: 240_000 })).isError).toBeFalsy();
      expect(Date.now() - t0).toBeLessThan(60_000);
    } finally {
      await mcp.close();
    }
    expect(await waitFor(async () => !(await isUp(MINI_VITE_URL)))).toBe(true);
  });
});
