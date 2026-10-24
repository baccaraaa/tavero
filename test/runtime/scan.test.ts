import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';
import { startMiniVite, MINI_VITE_URL, MINI_VITE_DIR } from '../helpers/miniVite.js';
import { scan } from '../../src/core/scan.js';
import { loadScan } from '../../src/core/loadScan.js';
import { DEFAULT_VIEWPORTS, type Component, type Instance, type Token, type RouteEntry } from '../../src/core/types.js';

let stop: () => void;
beforeAll(async () => { stop = await startMiniVite(); });
afterAll(() => stop());

describe('scan', () => {
  it('writes a complete scan directory for the mini app', async () => {
    const out = mkdtempSync(join(tmpdir(), 'tavero-scan-'));
    const res = await scan({ projectDir: MINI_VITE_DIR, url: MINI_VITE_URL, out, viewports: [DEFAULT_VIEWPORTS[0], DEFAULT_VIEWPORTS[2]], crop: ['Button'] });
    expect(existsSync(join(res.dir, 'scan.json'))).toBe(true);
    for (const f of ['tokens.json', 'components.json', 'instances.json', 'routes.json', 'samples.json', 'colors.json', 'scales.json', 'findings.json', 'report.html']) expect(existsSync(join(res.dir, f))).toBe(true);
    expect(readFileSync(join(out, 'scans', 'latest'), 'utf8').trim()).toBe(res.dir.split(/[\\/]/).pop());

    const components = JSON.parse(readFileSync(join(res.dir, 'components.json'), 'utf8')) as Component[];
    const button = components.find((c) => c.name === 'Button')!;
    expect(button).toMatchObject({ file: 'src/components/Button.tsx', resolved: 'stack', instances: 8, pages: ['/'] });
    expect(button.props.sort()).toEqual(['onClick', 'variant']);
    expect(components.map((c) => c.name)).toEqual(expect.arrayContaining(['PillButton', 'Card', 'Home', 'Many']));

    const instances = JSON.parse(readFileSync(join(res.dir, 'instances.json'), 'utf8')) as Instance[];
    const buttonInstances = instances.filter((i) => i.componentId === button.id);
    expect(buttonInstances).toHaveLength(8);
    expect(buttonInstances.every((i) => i.crop && existsSync(i.crop))).toBe(true);
    expect(readdirSync(join(res.dir, 'crops', button.id))).toHaveLength(8);

    const routes = JSON.parse(readFileSync(join(res.dir, 'routes.json'), 'utf8')) as RouteEntry[];
    expect(routes.map((r) => [r.path, r.source, r.status])).toEqual([['/', 'crawl', 'ok'], ['/many', 'crawl', 'ok']]);

    const tokens = JSON.parse(readFileSync(join(res.dir, 'tokens.json'), 'utf8')) as Token[];
    const brand = tokens.find((t) => t.name === '--color-brand')!;
    expect(brand).toMatchObject({ kind: 'color', resolved: '#3366ff', source: { file: 'src/tokens.css', line: 2 } });
    expect(tokens.find((t) => t.name === '--tw-ring-inset')).toBeUndefined();

    expect(res.meta.stats).toMatchObject({ pages: 4, tokens: tokens.length });
    expect(existsSync(join(res.dir, 'shots', 'mobile__root.png'))).toBe(true);
    expect(existsSync(join(res.dir, 'shots', 'desktop__many.png'))).toBe(true);
    expect(readdirSync(join(res.dir, 'pages')).sort()).toEqual(['desktop__many.json', 'desktop__root.json', 'mobile__many.json', 'mobile__root.json']);
    const samples = JSON.parse(readFileSync(join(res.dir, 'samples.json'), 'utf8')) as Array<{ role: string; componentName: string | null }>;
    expect(samples.filter((s) => s.role === 'button-text' && s.componentName === 'Button')).toHaveLength(8);
    expect(samples.filter((s) => s.role === 'card' && s.componentName === 'Card')).toHaveLength(4);
    const colors = JSON.parse(readFileSync(join(res.dir, 'colors.json'), 'utf8')) as Record<string, { bg: number }>;
    expect(colors['#3366ff'].bg).toBeGreaterThanOrEqual(2);
    const staticInfo = JSON.parse(readFileSync(join(res.dir, 'static.json'), 'utf8')) as { hardcodedColors: Record<string, Array<{ file: string; line: number }>>; tailwind: { version: number | null } };
    expect(staticInfo.tailwind.version).toBeNull();
    expect(staticInfo.hardcodedColors['#10b981']).toEqual([{ file: 'src/index.css', line: 7 }]);
    expect(staticInfo.hardcodedColors['#3366ff']).toBeUndefined();
    const findings = JSON.parse(readFileSync(join(res.dir, 'findings.json'), 'utf8')) as Array<{ rule: string }>;
    expect(findings.length).toBeGreaterThan(3);
    expect(res.meta.rulesRun).toEqual(['buttons', 'cards', 'colors', 'scales']);
  });
  it('crops each button and card variant once per width, and variant evidence points at its own crop', async () => {
    const out = mkdtempSync(join(tmpdir(), 'tavero-scan-'));
    const res = await scan({ projectDir: MINI_VITE_DIR, url: MINI_VITE_URL, out, routes: ['/'], viewports: [DEFAULT_VIEWPORTS[0], DEFAULT_VIEWPORTS[2]] });
    const findings = JSON.parse(readFileSync(join(res.dir, 'findings.json'), 'utf8')) as Array<{ rule: string; key: string; evidence: Array<{ variantId?: string; crop?: string }> }>;
    const text = findings.find((f) => f.rule === 'buttons' && f.key === 'variants:text')!;
    for (const e of text.evidence) {
      expect(e.crop?.replace(/\\/g, '/'), e.variantId).toMatch(new RegExp(`/crops/variants/${e.variantId}/(mobile|desktop)\\.png$`));
      expect(existsSync(e.crop!)).toBe(true);
    }
    const dirs = readdirSync(join(res.dir, 'crops', 'variants'));
    expect(dirs).toEqual(expect.arrayContaining(text.evidence.map((e) => e.variantId!)));
    for (const v of dirs) expect(readdirSync(join(res.dir, 'crops', 'variants', v)).every((f) => /^(mobile|desktop)\.png$/.test(f))).toBe(true);
    const s = await loadScan(MINI_VITE_DIR, out);
    expect(Object.keys(s.variantCrops(text.evidence[0].variantId!)).sort()).toEqual(['desktop', 'mobile']);
  });
  it('reports progress per page; a cancelled scan leaves no directory and keeps latest', async () => {
    const out = mkdtempSync(join(tmpdir(), 'tavero-scan-'));
    const first = await scan({ projectDir: MINI_VITE_DIR, url: MINI_VITE_URL, out, routes: ['/'], viewports: [DEFAULT_VIEWPORTS[0]] });
    const pages: Array<{ done: number; total: number | null; line: string }> = [];
    const second = await scan({ projectDir: MINI_VITE_DIR, url: MINI_VITE_URL, out, routes: ['/', '/many'], viewports: [DEFAULT_VIEWPORTS[0], DEFAULT_VIEWPORTS[2]], onPage: (p) => pages.push(p) });
    expect(pages.map((p) => [p.done, p.total])).toEqual([[1, 4], [2, 4], [3, 4], [4, 4]]);
    expect(pages[0].line).toMatch(/^desktop\s+\/\s+ok/); // widest first: that pass discovers the routes
    expect(basename(second.dir)).toMatch(/^\d{4}-\d\d-\d\dT\d\d-\d\d-\d\d-\d{3}$/);
    const ac = new AbortController();
    await expect(scan({ projectDir: MINI_VITE_DIR, url: MINI_VITE_URL, out, routes: ['/', '/many'], viewports: [DEFAULT_VIEWPORTS[0]], signal: ac.signal, onPage: () => ac.abort() })).rejects.toMatchObject({ code: 'cancelled' });
    expect(readdirSync(join(out, 'scans')).filter((n) => n !== 'latest').sort()).toEqual([basename(first.dir), basename(second.dir)].sort());
    expect(readFileSync(join(out, 'scans', 'latest'), 'utf8').trim()).toBe(basename(second.dir));
    expect(existsSync(join(out, 'devserver.log'))).toBe(false); // the mini app was already running: nothing launched, nothing logged
  });
  it('explicit routes disable link discovery and a second scan with fewer routes is a partial rescan', async () => {
    const out = mkdtempSync(join(tmpdir(), 'tavero-scan-'));
    const full = await scan({ projectDir: MINI_VITE_DIR, url: MINI_VITE_URL, out, routes: ['/', '/many'], viewports: [DEFAULT_VIEWPORTS[0]] });
    expect(full.meta.stale).toBe(false);
    expect(readdirSync(join(full.dir, 'pages')).sort()).toEqual(['mobile__many.json', 'mobile__root.json']);
    const partial = await scan({ projectDir: MINI_VITE_DIR, url: MINI_VITE_URL, out, routes: ['/'], viewports: [DEFAULT_VIEWPORTS[0]] });
    expect(partial.meta.stale).toBe(true);
    expect(partial.meta.staleRoutes).toEqual(['/many']);
    expect(partial.meta.rescannedRoutes).toEqual(['/']);
    expect(partial.meta.diff?.note).toContain('1 stale route(s)');
    expect(readdirSync(join(partial.dir, 'pages')).sort()).toEqual(['mobile__many.json', 'mobile__root.json']);
    expect(partial.meta.stats.pages).toBe(2);
    const routes = JSON.parse(readFileSync(join(partial.dir, 'routes.json'), 'utf8')) as RouteEntry[];
    expect(routes.map((r) => r.path).sort()).toEqual(['/', '/many']);
    // a partial rescan without viewports reuses the previous scan's widths, so stats stay comparable
    const again = await scan({ projectDir: MINI_VITE_DIR, url: MINI_VITE_URL, out, routes: ['/'] });
    expect(again.meta.viewports.map((v) => v.name)).toEqual(['mobile']);
    expect(again.meta.stats.pages).toBe(2);
  });
});
