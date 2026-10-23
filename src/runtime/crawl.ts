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

/** One context per viewport: session, uncap hook, request blocking, reduced motion. */
export async function newScanContext(browser: Browser, opts: { viewport: Viewport; sessionPath: string | null; devOrigin: string; apiOrigin: string | null }): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport: { width: opts.viewport.width, height: opts.viewport.height },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
    ...(opts.sessionPath ? { storageState: opts.sessionPath } : {}),
  });
  await installUncap(context);
  const dev = new URL(opts.devOrigin).origin;
  await context.route('**/*', (route) => {
    const u = new URL(route.request().url());
    const ok = u.origin === dev || (opts.apiOrigin ? u.origin === opts.apiOrigin : LOCAL.has(u.hostname));
    return ok ? route.continue() : route.abort();
  });
  return context;
}

export async function crawlRoute(opts: { context: BrowserContext; baseUrl: string; route: string; viewport: Viewport; shotsDir: string; resolver: Resolver; index: ComponentIndex }): Promise<CrawlResult> {
  const page = await opts.context.newPage();
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(String(e.message ?? e).slice(0, 200)));
  const res: CrawlResult = { route: opts.route, viewport: opts.viewport.name, status: 'pending', finalUrl: null, raw: null, elements: [], instances: new Map(), screenshot: null, links: [], pageErrors, page };
  try {
    await page.goto(opts.baseUrl + opts.route, { waitUntil: 'load', timeout: 90_000 });
    try { await page.waitForLoadState('networkidle', { timeout: 15_000 }); } catch { /* keep going */ }
    await page.waitForTimeout(1500);
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
