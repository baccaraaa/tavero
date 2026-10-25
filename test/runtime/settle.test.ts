import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { newScanContext, settle } from '../../src/runtime/crawl.js';
import { DEFAULT_VIEWPORTS } from '../../src/core/types.js';

const ORIGIN = 'http://localhost:9';
let browser: Browser;
beforeAll(async () => { browser = await chromium.launch(); });
afterAll(async () => { await browser.close(); });

async function open(html: string): Promise<Page> {
  const context = await newScanContext(browser, { viewport: DEFAULT_VIEWPORTS[2], sessionPath: null, devOrigin: ORIGIN, apiOrigin: null });
  const page = await context.newPage();
  await page.route(`${ORIGIN}/**`, (r) => r.fulfill({ contentType: 'text/html', body: html }));
  await page.goto(`${ORIGIN}/`);
  return page;
}

describe('settle', () => {
  it('reads a quiet page early', async () => {
    const page = await open('<main>ready</main>');
    const t0 = Date.now();
    await settle(page);
    expect(Date.now() - t0).toBeLessThan(1000);
    await page.context().close();
  });
  it('waits for a short app timer while the DOM is quiet: a loading bar that hides 1 s after the route resolves', async () => {
    const page = await open('<div id="bar" style="height:2px;box-shadow:0 0 10px #62748e"></div><script>setTimeout(() => document.getElementById("bar").remove(), 1000)</script>');
    await settle(page);
    expect(await page.locator('#bar').count()).toBe(0);
    await page.context().close();
  });
  it('gives up at maxMs on a page that keeps scheduling timers', async () => {
    const page = await open('<script>const loop = () => setTimeout(loop, 500); loop();</script>');
    const t0 = Date.now();
    await settle(page, { maxMs: 1200 });
    expect(Date.now() - t0).toBeLessThan(2000);
    await page.context().close();
  });
});
