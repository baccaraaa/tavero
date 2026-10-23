import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser } from 'playwright';
import { startMiniVite, MINI_VITE_URL, MINI_VITE_DIR } from '../helpers/miniVite.js';
import { inspect } from '../../src/runtime/page/inspect.js';
import { createResolver } from '../../src/runtime/sourcemaps.js';
import { attributePage } from '../../src/runtime/attribute.js';

let stop: () => void;
let browser: Browser;
beforeAll(async () => { stop = await startMiniVite(); browser = await chromium.launch(); });
afterAll(async () => { await browser.close(); stop(); });

describe('attribution on mini-vite', () => {
  it('maps Home elements to Button, PillButton, Card with files and lines', async () => {
    const page = await browser.newPage();
    await page.goto(MINI_VITE_URL + '/', { waitUntil: 'networkidle' });
    const raw = await inspect(page);
    const out = await attributePage(raw, createResolver({ kind: 'vite', baseUrl: MINI_VITE_URL, projectDir: MINI_VITE_DIR }), new Map());
    const byName = (n: string) => [...out.instances.values()].filter((i) => i.name === n);
    expect(byName('Button')).toHaveLength(4); // three on the page plus the fixed banner's Accept
    expect(byName('Button')[0]).toMatchObject({ file: 'src/components/Button.tsx', resolved: 'stack' });
    expect([...byName('Button')[0].props].sort()).toEqual(['onClick', 'variant']);
    expect(byName('PillButton')[0]).toMatchObject({ file: 'src/components/PillButton.tsx' });
    expect(byName('Card')).toHaveLength(2);
    expect(byName('Card')[0].file).toBe('src/components/Card.tsx');
    const raw1 = out.elements.find((e) => e.t === 'button' && e.text === 'Raw button')!;
    expect(raw1).toMatchObject({ a: 'Home', ah: 0 });
    expect(out.elements.filter((e) => e.a).length / out.elements.length).toBeGreaterThan(0.9);
    await page.close();
  });
});
