import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { startMiniVite, MINI_VITE_URL, MINI_VITE_DIR } from '../helpers/miniVite.js';
import { connectMcp, text } from '../helpers/mcpClient.js';
import { scan } from '../../src/core/scan.js';
import { DEFAULT_VIEWPORTS } from '../../src/core/types.js';
import { makeTmpProject } from '../helpers/tmp.js';
import { writeScanFixture } from '../helpers/scanFixture.js';
import { saveDecision } from '../../src/core/decisions.js';

const cliJson = (args: string[]) => JSON.parse(spawnSync('npx', ['tsx', 'src/cli/index.ts', ...args, '--json'], { encoding: 'utf8', shell: true }).stdout);
const strip = (o: Record<string, unknown>) => { const { next, ...rest } = o; return rest; };

let stop: () => void;
let out: string;
let mcp: Awaited<ReturnType<typeof connectMcp>>;
beforeAll(async () => {
  stop = await startMiniVite();
  out = mkdtempSync(join(tmpdir(), 'tavero-mcp-'));
  await scan({ projectDir: MINI_VITE_DIR, url: MINI_VITE_URL, out, routes: ['/'], viewports: [DEFAULT_VIEWPORTS[0], DEFAULT_VIEWPORTS[2]], crop: ['Button'] });
  mcp = await connectMcp(MINI_VITE_DIR, out);
});
afterAll(async () => { await mcp?.close(); stop(); });

describe('tavero mcp (read tools)', () => {
  it('lists the nine tools with descriptions and object schemas', async () => {
    const { tools } = await mcp.client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(['tavero_component', 'tavero_components', 'tavero_context', 'tavero_diff', 'tavero_finding', 'tavero_findings', 'tavero_scan', 'tavero_show', 'tavero_tokens']);
    for (const t of tools) { expect(t.description!.length, t.name).toBeGreaterThan(60); expect(t.inputSchema.type).toBe('object'); }
  });
  it('read tools return the same data as the CLI --json, plus a next hint', async () => {
    const dirArgs = ['--dir', MINI_VITE_DIR, '--out', out];
    const findings = (await mcp.client.callTool({ name: 'tavero_findings', arguments: { limit: 5 } })).structuredContent as Record<string, unknown>;
    expect(strip(findings)).toEqual(cliJson(['findings', ...dirArgs, '--limit', '5']));
    expect(findings.next).toMatch(/tavero_finding/);
    const id = (findings.items as Array<{ id: string }>)[0].id;
    const one = (await mcp.client.callTool({ name: 'tavero_finding', arguments: { id } })).structuredContent as Record<string, unknown>;
    expect(strip(one)).toEqual(cliJson(['finding', id, ...dirArgs]));
    expect(one.next).toContain('tavero_scan');
    expect(one.next).toContain(MINI_VITE_URL);
    const comp = (await mcp.client.callTool({ name: 'tavero_component', arguments: { idOrName: 'Button' } })).structuredContent as Record<string, unknown>;
    expect(strip(comp)).toEqual(cliJson(['component', 'Button', ...dirArgs]));
    const shown = (await mcp.client.callTool({ name: 'tavero_show', arguments: { idOrName: 'Button', viewport: 'mobile' } })).structuredContent as { crops: string[] };
    expect(shown.crops.length).toBeGreaterThan(0);
    const comps = (await mcp.client.callTool({ name: 'tavero_components', arguments: { query: 'Button' } })).structuredContent as Record<string, unknown>;
    expect(strip(comps)).toEqual(cliJson(['components', ...dirArgs, '--query', 'Button']));
    const toks = (await mcp.client.callTool({ name: 'tavero_tokens', arguments: { kind: 'color' } })).structuredContent as Record<string, unknown>;
    expect(strip(toks)).toEqual(cliJson(['tokens', ...dirArgs, '--kind', 'color']));
    const ctx = await mcp.client.callTool({ name: 'tavero_context', arguments: {} });
    expect(text(ctx)).toContain('## Canonical components');
    expect(mcp.errors).toEqual([]);
  });
  it('caps page size, rejects bad enums, and answers domain errors with hints', async () => {
    const over = await mcp.client.callTool({ name: 'tavero_findings', arguments: { limit: 500 } }).catch((e: Error) => ({ isError: true, content: [{ type: 'text', text: e.message }] }));
    expect(over.isError).toBe(true);
    const bad = await mcp.client.callTool({ name: 'tavero_findings', arguments: { rule: 'nope' } }).catch((e: Error) => ({ isError: true, content: [{ type: 'text', text: e.message }] }));
    expect(bad.isError).toBe(true);
    expect(text(bad)).toMatch(/rule/);
    const unknown = await mcp.client.callTool({ name: 'tavero_finding', arguments: { id: 'f_nope' } });
    expect(unknown.isError).toBe(true);
    expect(text(unknown)).toContain('tavero_findings');
    const comp = await mcp.client.callTool({ name: 'tavero_component', arguments: { idOrName: 'Nope' } });
    expect(text(comp)).toContain('tavero_components');
    const diff = await mcp.client.callTool({ name: 'tavero_diff', arguments: {} });
    expect(diff.isError).toBe(true);
    expect(text(diff)).toContain('tavero_scan');
  });
  it('read tools apply human decisions', async () => {
    const proj = makeTmpProject({});
    writeScanFixture(proj.dir);
    await saveDecision(join(proj.dir, '.tavero'), 'f_col', { status: 'accepted', reason: 'brand' }, 2);
    await saveDecision(join(proj.dir, '.tavero'), 'f_btn', { note: 'secondary buttons are outline', canonical: { primary: 'v_a', allowed: [] } }, 3);
    const m = await connectMcp(proj.dir, join(proj.dir, '.tavero'));
    try {
      const list = (await m.client.callTool({ name: 'tavero_findings', arguments: {} })).structuredContent as { items: Array<{ id: string }> };
      expect(list.items.map((f) => f.id)).toEqual(['f_btn']);
      const withHidden = (await m.client.callTool({ name: 'tavero_findings', arguments: { includeAccepted: true } })).structuredContent as { total: number };
      expect(withHidden.total).toBe(2);
      const one = (await m.client.callTool({ name: 'tavero_finding', arguments: { id: 'f_btn' } })).structuredContent as { decision: { note: string }; evidence: Array<{ expected?: string }> };
      expect(one.decision.note).toBe('secondary buttons are outline');
      expect(one.evidence[1].expected).toBe('Button (bg #2d4deb, radius 9999)');
      expect(text(await m.client.callTool({ name: 'tavero_context', arguments: {} }))).toContain('Action button is Button (bg #2d4deb, radius 9999)');
    } finally { await m.close(); proj.cleanup(); }
  });
  it('without any scan, every read tool says to call tavero_scan first', async () => {
    const empty = await connectMcp(MINI_VITE_DIR, mkdtempSync(join(tmpdir(), 'tavero-mcp-empty-')));
    try {
      for (const name of ['tavero_context', 'tavero_findings', 'tavero_components', 'tavero_tokens']) {
        const r = await empty.client.callTool({ name, arguments: {} });
        expect(r.isError, name).toBe(true);
        expect(text(r), name).toContain('call tavero_scan');
      }
    } finally { await empty.close(); }
  });
});
