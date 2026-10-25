import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Browser, BrowserContext, Page } from 'playwright';
import type { AttributedElement, AttributedInstance, RawPage, RouteStatus, Viewport } from '../core/types.js';
import { routeSlug } from '../core/ids.js';
import type { ComponentIndex } from '../static/componentIndex.js';
import { inspect } from './page/inspect.js';
import { installUncap } from './uncap.js';
import { attributePage } from './attribute.js';
import type { Resolver } from './sourcemaps.js';
import { isUnauthenticated } from './session.js';
import { normalizeLink } from './routes/index.js';

export interface CrawlResult {
  route: string;
  viewport: string;
  status: RouteStatus;
  reason?: string;
  finalUrl: string | null;
  raw: RawPage | null;
  elements: AttributedElement[];
  instances: Map<string, AttributedInstance>;
  screenshot: string | null;
  links: string[];
  pageErrors: string[];
  /** Left open so crops can be taken; the caller closes it. */
  page: Page | null;
}

const LOCAL = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Before any app code: the theme keys next-themes, the shadcn templates, Chakra and MUI read, and the dark class and
 * data-theme on <html>, kept when a framework resets them while hydrating. A string: esbuild would wrap a function.
 */
const FORCE_DARK = `(() => {
  try { for (const k of ['theme', 'vite-ui-theme', 'color-theme', 'ui-theme', 'chakra-ui-color-mode', 'mui-mode']) if (localStorage.getItem(k) === null) localStorage.setItem(k, 'dark'); } catch (e) {}
  const apply = () => {
    const h = document.documentElement;
    if (!h) return;
    if (!h.classList.contains('dark')) h.classList.add('dark');
    if (h.getAttribute('data-theme') !== 'dark') h.setAttribute('data-theme', 'dark');
    h.style.colorScheme = 'dark';
  };
  apply();
  if (document.documentElement) new MutationObserver(apply).observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
  document.addEventListener('DOMContentLoaded', apply);
})();`;

/**
 * Short timers the app has pending: a loading bar that hides 1 s after the route resolves, a fade that starts later.
 * The DOM is quiet meanwhile, so settle() waits for them too. The original setTimeout stays for Tavero's own waits.
 */
const TRACK_TIMERS = `(() => {
  const st = window.setTimeout, ct = window.clearTimeout, pending = new Set();
  window.__taveroSetTimeout = st;
  window.__taveroTimers = pending;
  window.setTimeout = function (fn, ms, ...args) {
    const d = Number(ms) || 0;
    if (typeof fn !== 'function' || d <= 50 || d > 2000) return st.call(window, fn, ms, ...args);
    const id = st.call(window, function () { pending.delete(id); fn.apply(this, args); }, ms);
    pending.add(id);
    return id;
  };
  window.clearTimeout = function (id) { pending.delete(id); return ct.call(window, id); };
})();`;

/** One context per viewport: session, uncap hook, request blocking, reduced motion. */
export async function newScanContext(browser: Browser, opts: { viewport: Viewport; sessionPath: string | null; devOrigin: string; apiOrigin: string | null }): Promise<BrowserContext> {
  const dark = opts.viewport.theme === 'dark';
  const context = await browser.newContext({
    viewport: { width: opts.viewport.width, height: opts.viewport.height },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
    colorScheme: dark ? 'dark' : 'light',
    ...(opts.sessionPath ? { storageState: opts.sessionPath } : {}),
  });
  await context.addInitScript(TRACK_TIMERS);
  if (dark) await context.addInitScript(FORCE_DARK);
  await installUncap(context);
  const dev = new URL(opts.devOrigin).origin;
  await context.route('**/*', (route) => {
    const u = new URL(route.request().url());
    const ok = u.origin === dev || (opts.apiOrigin ? u.origin === opts.apiOrigin : LOCAL.has(u.hostname));
    return ok ? route.continue() : route.abort();
  });
  return context;
}

/**
 * Wait until the page stops changing: no DOM mutation for `quietMs`, no short app timer pending and no CSS
 * animation or transition running; at most `maxMs`. Replaces a fixed pause, so a page that is ready early is read
 * early and a late-rendering one still gets its time.
 */
export async function settle(page: Page, opts: { quietMs?: number; maxMs?: number } = {}): Promise<void> {
  const quietMs = opts.quietMs ?? 300, maxMs = opts.maxMs ?? 2500;
  // a string, not a function: esbuild (tsx, vitest) would wrap inner functions in a __name helper the page lacks
  await page.evaluate(`new Promise((resolve) => {
    const st = window.__taveroSetTimeout || setTimeout;
    const t0 = Date.now();
    let last = t0;
    const obs = new MutationObserver(() => { last = Date.now(); });
    obs.observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
    const busy = () => (window.__taveroTimers && window.__taveroTimers.size > 0)
      || (document.getAnimations ? document.getAnimations().some((a) => a.playState === 'running' && a.effect && a.effect.getTiming().iterations !== Infinity) : false);
    const tick = () => {
      const now = Date.now();
      if (now - t0 >= ${maxMs} || (now - last >= ${quietMs} && !busy())) { obs.disconnect(); resolve(); return; }
      st(tick, 50);
    };
    st(tick, 50);
  })`);
}

export async function crawlRoute(opts: { context: BrowserContext; baseUrl: string; route: string; viewport: Viewport; shotsDir: string; resolver: Resolver; index: ComponentIndex }): Promise<CrawlResult> {
  const page = await opts.context.newPage();
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(String(e.message ?? e).slice(0, 200)));
  const res: CrawlResult = { route: opts.route, viewport: opts.viewport.name, status: 'pending', finalUrl: null, raw: null, elements: [], instances: new Map(), screenshot: null, links: [], pageErrors, page };
  try {
    await page.goto(opts.baseUrl + opts.route, { waitUntil: 'load', timeout: 90_000 });
    try { await page.waitForLoadState('networkidle', { timeout: 15_000 }); } catch { /* keep going */ }
    await settle(page);
    await page.evaluate(async () => {
      const h = document.documentElement.scrollHeight;
      for (let y = 0; y < h; y += 700) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 50)); }
      window.scrollTo(0, 0);
    });
    await page.addStyleTag({ content: '*, *::before, *::after { animation-play-state: paused !important; transition: none !important; }' });
    await page.waitForTimeout(100);
    const raw = await inspect(page);
    res.raw = raw;
    res.finalUrl = raw.url;
    if (raw.nextBuildError) { res.status = 'failed'; res.reason = `next build error: ${raw.nextBuildError}`; return res; }
    if (!raw.reactDetected) { res.status = 'no-react'; res.reason = 'no React fiber found on the page'; }
    else if (isUnauthenticated({ route: opts.route, finalUrl: raw.url, hasPasswordInput: raw.hasPasswordInput })) { res.status = 'unauthenticated'; res.reason = `landed on ${raw.url}`; }
    else res.status = 'ok';
    const att = await attributePage(raw, opts.resolver, opts.index);
    res.elements = att.elements;
    res.instances = att.instances;
    res.links = [...new Set(raw.links.map((l) => normalizeLink(l, opts.baseUrl)).filter((x): x is string => !!x && x !== opts.route))];
    await mkdir(opts.shotsDir, { recursive: true });
    res.screenshot = join(opts.shotsDir, `${opts.viewport.name}__${routeSlug(opts.route)}.png`);
    await page.screenshot({ path: res.screenshot, fullPage: true });
  } catch (e) {
    res.status = 'failed';
    res.reason = String((e as Error).message ?? e).slice(0, 300);
  }
  return res;
}
