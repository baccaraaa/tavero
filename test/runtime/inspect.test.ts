import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser } from 'playwright';
import { startMiniVite, MINI_VITE_URL } from '../helpers/miniVite.js';
import { inspect } from '../../src/runtime/page/inspect.js';

let stop: () => void;
let browser: Browser;
beforeAll(async () => { stop = await startMiniVite(); browser = await chromium.launch(); });
afterAll(async () => { await browser.close(); stop(); });

describe('inspect', () => {
  it('collects owners, call-site frames, props, tokens, links on Home', async () => {
    const page = await browser.newPage();
    await page.goto(MINI_VITE_URL + '/', { waitUntil: 'networkidle' });
    const raw = await inspect(page);
    expect(raw.reactDetected).toBe(true);
    const ownerNames = new Set(Object.values(raw.owners).map((o) => o.name));
    expect(ownerNames).toContain('Button');
    expect(ownerNames).toContain('PillButton');
    expect(ownerNames).toContain('Card');
    expect(ownerNames).toContain('Home');
    const btnOwner = Object.values(raw.owners).find((o) => o.name === 'Button')!;
    expect(btnOwner.props.sort()).toEqual(['onClick', 'variant']);
    const btn = raw.elements.find((e) => e.t === 'button' && e.text === 'Save')!;
    expect(btn.sf?.some((f) => f.loc.includes('/src/components/Button.tsx'))).toBe(true);
    expect(btn.styles['background-color']).toBe('rgb(51, 102, 255)');
    expect(btn.parentBg).toBeTruthy();
    const h1 = raw.elements.find((e) => e.t === 'h1')!;
    expect(h1.sf?.some((f) => f.loc.includes('/src/pages/Home.tsx'))).toBe(true);
    expect(raw.tokens.map((t) => t.name)).toEqual(expect.arrayContaining(['--color-brand', '--radius-card', '--tw-ring-inset']));
    expect(raw.tokenValues['--color-brand']).toBe('#3366ff');
    expect(raw.links).toContain(MINI_VITE_URL + '/many');
    expect(raw.hasPasswordInput).toBe(false);
    expect(raw.nextBuildError).toBeNull();
    expect(raw.docSize[0]).toBeGreaterThan(0);
    const pillIcon = raw.elements.find((e) => e.t === 'span' && e.text === '' && e.styles['display'] === 'inline-block')!;
    expect(pillIcon.inInteractive).toBe(true);
    expect(btn.inInteractive).toBe(false);
    expect(btn.role).toBeNull();
    expect(btn.type).toBeNull();
    const accept = raw.elements.find((e) => e.t === 'button' && e.text === 'Accept')!;
    expect(accept.inOverlay).toBe(true);
    expect(btn.inOverlay).toBe(false);
    await page.close();
  });
});
