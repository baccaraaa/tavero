import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, mkdtempSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { startMiniVite, MINI_VITE_URL, MINI_VITE_DIR } from '../helpers/miniVite.js';
import { connectMcp, text } from '../helpers/mcpClient.js';

let stop: () => void;
beforeAll(async () => { stop = await startMiniVite(); });
afterAll(() => stop());

const scanArgs = (over: object = {}) => ({ name: 'tavero_scan', arguments: { url: MINI_VITE_URL, routes: ['/', '/many'], viewports: ['mobile'], ...over } });

describe('tavero_scan over MCP', () => {
  it('streams progress per page, returns the summary, keeps stdout clean, then diff works', async () => {
    const out = mkdtempSync(join(tmpdir(), 'tavero-mcp-scan-'));
    const mcp = await connectMcp(MINI_VITE_DIR, out);
    try {
      const progress: Array<{ progress: number; total?: number; message?: string }> = [];
      const r = await mcp.client.callTool(scanArgs(), undefined, { onprogress: (p) => progress.push(p), timeout: 180_000, resetTimeoutOnProgress: true });
      expect(r.isError).toBeFalsy();
      expect(progress.map((p) => [p.progress, p.total])).toEqual([[1, 2], [2, 2]]);
      expect(progress[0].message).toMatch(/^mobile\s+\/\s+ok/);
      const v = r.structuredContent as { stats: { pages: number }; scan: string; next: string };
      expect(v.stats.pages).toBe(2);
      expect(v.next).toContain('tavero_findings');
      const again = await mcp.client.callTool(scanArgs({ routes: ['/'], rules: ['colors'] }), undefined, { timeout: 180_000 });
      expect((again.structuredContent as { stale: boolean; next: string }).stale).toBe(true);
      expect((again.structuredContent as { next: string }).next).toContain('tavero_diff');
      const d = await mcp.client.callTool({ name: 'tavero_diff', arguments: {} });
      expect((d.structuredContent as { note: string }).note).toContain('1 stale route(s)');
      expect(mcp.errors).toEqual([]);
    } finally { await mcp.close(); }
  });
  it('rejects a second scan while one runs, and a cancelled scan leaves no folder', async () => {
    const out = mkdtempSync(join(tmpdir(), 'tavero-mcp-scan-'));
    const mcp = await connectMcp(MINI_VITE_DIR, out);
    try {
      let firstPage!: () => void;
      const started = new Promise<void>((r) => { firstPage = r; });
      const running = mcp.client.callTool(scanArgs(), undefined, { onprogress: () => firstPage(), timeout: 180_000 });
      await started;
      const second = await mcp.client.callTool(scanArgs());
      expect(second.isError).toBe(true);
      expect(text(second)).toContain('already running');
      await running;
      const ac = new AbortController();
      await expect(mcp.client.callTool(scanArgs(), undefined, { signal: ac.signal, onprogress: () => ac.abort(), timeout: 180_000 })).rejects.toThrow();
      const deadline = Date.now() + 30_000;
      const incomplete = () => readdirSync(join(out, 'scans')).filter((n) => n !== 'latest' && !existsSync(join(out, 'scans', n, 'scan.json')));
      while (incomplete().length && Date.now() < deadline) await new Promise((r) => setTimeout(r, 500));
      expect(incomplete()).toEqual([]);
      expect(readdirSync(join(out, 'scans')).filter((n) => n !== 'latest')).toHaveLength(1);
    } finally { await mcp.close(); }
  });
});
