import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser } from 'playwright';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { inspect } from '../../src/runtime/page/inspect.js';
import { normalizeStyles } from '../../src/rules/normalize.js';
import { classifyRole } from '../../src/rules/roles.js';
import type { AttributedElement } from '../../src/core/types.js';

let browser: Browser;
beforeAll(async () => { browser = await chromium.launch(); });
afterAll(async () => { await browser.close(); });

describe('classifyRole', () => {
  it('classifies buttons, icon buttons, cards and rejects the rest', async () => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(pathToFileURL(resolve('test/pages/roles.html')).href);
    const ids = await page.evaluate(() => Array.from(document.querySelectorAll('[id]')).map((e) => [e.id, e.tagName.toLowerCase(), e.getBoundingClientRect().x, e.getBoundingClientRect().y]));
    const raw = await inspect(page);
    const byId = new Map<string, AttributedElement>();
    for (const [id, tag, x, y] of ids as Array<[string, string, number, number]>) {
      const el = raw.elements.find((e) => e.t === tag && e.r[0] === Math.round(x) && e.r[1] === Math.round(y))!;
      byId.set(id, { ...el, o: null, s: null, a: null, al: null, ah: null, aid: null });
    }
    const role = (id: string) => classifyRole(byId.get(id)!, normalizeStyles(byId.get(id)!.styles), { width: 1440, height: 900 });
    expect(role('b1')).toBe('button-text');
    expect(role('b2')).toBe('button-text');
    expect(role('b3')).toBe('button-text');
    expect(role('l1')).toBeNull();
    expect(role('i1')).toBe('button-icon');
    expect(role('c1')).toBe('card');
    expect(role('c2')).toBe('card');
    expect(role('n1')).toBeNull();
    expect(role('n2')).toBeNull();
    expect(role('c3')).toBe('card');
    expect(role('c4')).toBe('card');
    expect(role('n3')).toBeNull();
    expect(role('nv1')).toBeNull(); // inside <nav>
    expect(role('w1')).toBeNull(); // unstyled, zero padding: clickable wrapper
    expect(role('w2')).toBeNull(); // unstyled, wider than 60% of the viewport: list row
    expect(role('g1')).toBe('button-text'); // unstyled but compact and padded: a ghost button
    await page.close();
  });
});
