import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser } from 'playwright';
import { startMiniVite, MINI_VITE_URL } from '../helpers/miniVite.js';
import { inspect } from '../../src/runtime/page/inspect.js';
import { installUncap } from '../../src/runtime/uncap.js';

let stop: () => void;
let browser: Browser;
beforeAll(async () => { stop = await startMiniVite(); browser = await chromium.launch(); });
afterAll(async () => { await browser.close(); stop(); });

async function countWithSrc(uncap: boolean): Promise<number> {
  const context = await browser.newContext();
  if (uncap) await installUncap(context);
  const page = await context.newPage();
  await page.goto(MINI_VITE_URL + '/many', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const raw = await inspect(page, { styleProps: [] });
  await context.close();
  return raw.elements.filter((e) => e.t === 'span' && e.sf?.some((f) => f.loc.includes('/src/pages/Many.tsx'))).length;
}

describe('uncap', () => {
  it('without the hook only the first ~10000 elements carry real stacks; with it all 11000 do', async () => {
    expect(await countWithSrc(false)).toBeLessThanOrEqual(10_100);
    expect(await countWithSrc(true)).toBe(11_000);
  });
});
