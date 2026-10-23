import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser } from 'playwright';
import { mkdtempSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { startMiniVite, MINI_VITE_URL, MINI_VITE_DIR } from '../helpers/miniVite.js';
import { scan } from '../../src/core/scan.js';
import { loadScan } from '../../src/core/loadScan.js';
import { createUiServer } from '../../src/ui/server.js';
import { DEFAULT_VIEWPORTS } from '../../src/core/types.js';

let stopVite: () => void;
let browser: Browser;
let out: string;
let ui: Awaited<ReturnType<typeof createUiServer>>;
beforeAll(async () => {
  stopVite = await startMiniVite();
  out = mkdtempSync(join(tmpdir(), 'tavero-ui-'));
  await scan({ projectDir: MINI_VITE_DIR, url: MINI_VITE_URL, out, routes: ['/'], viewports: [DEFAULT_VIEWPORTS[0], DEFAULT_VIEWPORTS[2]], crop: ['Button'] });
  ui = await createUiServer({ projectDir: MINI_VITE_DIR, out, port: 0 });
  browser = await chromium.launch();
});
afterAll(async () => { await browser?.close(); await ui?.close(); stopVite(); });

describe('panel in a browser', () => {
  it('keyboard triage: ↓ then 2 with a reason hides the finding for agents', async () => {
    const page = await browser.newPage();
    await page.goto(ui.url);
    const ids = await page.locator('.list .row').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.id));
    expect(ids.length).toBeGreaterThan(3);
    await page.keyboard.press('ArrowDown');
    await expect.poll(() => page.locator('.actions').getAttribute('data-id')).toBe(ids[1]);
    await page.keyboard.press('2');
    await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('name'))).toBe('reason');
    await page.keyboard.type('brand choice');
    await page.keyboard.press('Enter');
    await expect.poll(() => page.locator(`.list .row[data-id="${ids[1]}"]`).count()).toBe(0);
    const d = JSON.parse(readFileSync(join(out, 'decisions.json'), 'utf8'));
    expect(d.findings[ids[1]!]).toMatchObject({ status: 'accepted', reason: 'brand choice' });
    expect((await loadScan(MINI_VITE_DIR, out)).findings({ limit: 200 }).items.map((f) => f.id)).not.toContain(ids[1]);
    await page.close();
  });
  it('picking a canonical button variant changes what the agent context says', async () => {
    const s = await loadScan(MINI_VITE_DIR, out);
    const btn = s.rawFindings.find((f) => f.rule === 'buttons' && f.key === 'variants:text')!;
    const page = await browser.newPage();
    await page.goto(ui.url + 'f/' + btn.id);
    const second = btn.evidence[1].variantId!;
    await page.locator(`input[name=primary][value="${second}"]`).check();
    await page.locator(`input[name=vname][data-variant="${second}"]`).fill('main');
    await page.locator('[data-action=save-canonical]').click();
    await expect.poll(async () => (await loadScan(MINI_VITE_DIR, out)).finding(btn.id)!.decision?.canonical?.primary).toBe(second);
    await expect.poll(() => page.locator('pre.agent').textContent()).toContain('canonical');
    expect((await loadScan(MINI_VITE_DIR, out)).regenerateContext()).toContain(`Action button is ${btn.evidence[1].component} "main" (`);
    await page.close();
  });
});
