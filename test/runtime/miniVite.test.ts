import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium } from 'playwright';
import { startMiniVite, MINI_VITE_URL } from '../helpers/miniVite.js';

let stop: () => void;
beforeAll(async () => { stop = await startMiniVite(); });
afterAll(() => stop());

describe('mini-vite app', () => {
  it('serves Home with the expected components and Many with 11000 cells', async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(MINI_VITE_URL + '/', { waitUntil: 'networkidle' });
    expect(await page.locator('.btn').count()).toBe(4);
    expect(await page.locator('.pill').count()).toBe(1);
    expect(await page.locator('.card').count()).toBe(2);
    await page.goto(MINI_VITE_URL + '/many', { waitUntil: 'networkidle' });
    expect(await page.locator('.cell').count()).toBe(11000);
    await browser.close();
  });
});
