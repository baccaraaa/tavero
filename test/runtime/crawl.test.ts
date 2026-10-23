import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser } from 'playwright';
import { existsSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { startMiniVite, MINI_VITE_URL, MINI_VITE_DIR } from '../helpers/miniVite.js';
import { newScanContext, crawlRoute } from '../../src/runtime/crawl.js';
import { cropInstances } from '../../src/runtime/shots.js';
import { createResolver } from '../../src/runtime/sourcemaps.js';
import { componentId } from '../../src/core/ids.js';
import { DEFAULT_VIEWPORTS } from '../../src/core/types.js';

let stop: () => void;
let browser: Browser;
beforeAll(async () => { stop = await startMiniVite(); browser = await chromium.launch(); });
afterAll(async () => { await browser.close(); stop(); });

describe('crawlRoute', () => {
  it('settles, collects, screenshots, finds links and crops instances', async () => {
    const out = mkdtempSync(join(tmpdir(), 'tavero-crawl-'));
    const viewport = DEFAULT_VIEWPORTS[0];
    const context = await newScanContext(browser, { viewport, sessionPath: null, devOrigin: MINI_VITE_URL, apiOrigin: null });
    const resolver = createResolver({ kind: 'vite', baseUrl: MINI_VITE_URL, projectDir: MINI_VITE_DIR });
    const res = await crawlRoute({ context, baseUrl: MINI_VITE_URL, route: '/', viewport, shotsDir: join(out, 'shots'), resolver, index: new Map() });
    expect(res.status).toBe('ok');
    expect(res.links).toEqual(['/many']);
    expect(existsSync(res.screenshot!)).toBe(true);
    expect(res.instances.size).toBeGreaterThan(3);
    const list = [...res.instances.values()].map((instance) => ({ instance, componentId: componentId(instance.file, instance.name) }));
    const crops = await cropInstances({ page: res.page!, instances: list, docSize: res.raw!.docSize, viewport, cropsDir: join(out, 'crops'), route: '/', perComponentBudget: new Map(), limit: 12, maxAreaRatio: 0.6, select: new Set(['Button', 'Card']) });
    const cropped = [...crops.values()];
    expect(cropped.length).toBe(6); // 4 Button (incl. the fixed banner) + 2 Card
    expect(cropped.every((p) => existsSync(p))).toBe(true);
    await res.page!.close();
    await context.close();
  });
  it('reports a failed route instead of throwing', async () => {
    const viewport = DEFAULT_VIEWPORTS[2];
    const context = await newScanContext(browser, { viewport, sessionPath: null, devOrigin: 'http://127.0.0.1:5994', apiOrigin: null });
    const resolver = createResolver({ kind: 'vite', baseUrl: 'http://127.0.0.1:5994', projectDir: MINI_VITE_DIR });
    const res = await crawlRoute({ context, baseUrl: 'http://127.0.0.1:5994', route: '/', viewport, shotsDir: tmpdir(), resolver, index: new Map() });
    expect(res.status).toBe('failed');
    expect(res.reason).toMatch(/ERR_CONNECTION_REFUSED|net::/);
    await context.close();
  });
});
