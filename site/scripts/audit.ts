// The site's quality gates; runs all of them and exits non-zero if any failed:
// 1. Tavero scans the site in dev mode: 0 high and medium findings; the report is published at /audit/.
// 2. The static build is served locally and checked with Lighthouse (desktop and mobile, every category >= 0.95),
// 3. axe (no WCAG 2 A/AA violations, nothing serious or critical) and
// 4. every page at 375/768/1440: no horizontal scroll, a full-page screenshot into site/.audit/.
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { extname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, gzipSync } from 'node:zlib';
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import lighthouse from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';
import { attachOrLaunch } from '../../src/runtime/server.js';
import { scan } from '../../src/core/scan.js';
import { loadScan } from '../../src/core/loadScan.js';
import { buildReport } from '../../src/report/html.js';
import { DOCS, docHref } from '../lib/docs.js';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SITE = join(ROOT, 'site');
const DEV = 'http://localhost:5190';
const STATIC_PORT = 5191;
const STATIC = `http://localhost:${STATIC_PORT}`;
const SHOTS = join(SITE, '.audit');
const ROUTES = ['/', '/docs/', ...DOCS.map((d) => docHref(d.slug)), '/demo/', '/audit/'];
const LIGHTHOUSE_ROUTES = ['/', '/docs/quick-start/', '/demo/'];
const WIDTHS = [375, 768, 1440];
const MIN_SCORE = 0.95;

const failures: string[] = [];
const fail = (msg: string) => { failures.push(msg); console.log(`  FAIL ${msg}`); };

async function taveroGate() {
  console.log('1. Tavero scan of the site (dev mode)');
  const out = join(SITE, '.tavero');
  const dev = await attachOrLaunch({ url: DEV, projectDir: SITE, devScript: 'next dev', logPath: join(tmpdir(), 'tavero-site-dev.log'), timeoutMs: 240_000 });
  try {
    await scan({ projectDir: SITE, url: DEV, out, routes: ROUTES, log: (l) => process.stdout.write(`   ${l}\n`) });
  } finally { dev.stop(); }
  const s = await loadScan(SITE, out);
  // read like an agent would: with the site's decisions (site/.tavero/decisions.json) applied
  const open = s.findings({ limit: 200 }).items;
  const count = (sev: string) => open.filter((f) => f.severity === sev).length;
  const [high, medium, info] = [count('high'), count('medium'), count('info')];
  // the report goes next to its crops so its relative image paths keep working
  const pub = join(SITE, 'public', 'audit');
  rmSync(pub, { recursive: true, force: true });
  mkdirSync(pub, { recursive: true });
  writeFileSync(join(pub, 'report.html'), buildReport(s));
  cpSync(join(s.dir, 'crops'), join(pub, 'crops'), { recursive: true });
  mkdirSync(join(SITE, 'generated'), { recursive: true });
  writeFileSync(join(SITE, 'generated', 'audit.json'), JSON.stringify({ high, medium, info, pages: s.meta.stats.pages, at: s.meta.createdAt }, null, 2) + '\n');
  console.log(`   ${s.meta.stats.pages} pages: ${high} high, ${medium} medium, ${info} info`);
  for (const f of open.filter((x) => x.severity === 'high' || x.severity === 'medium')) {
    fail(`tavero ${f.severity} ${f.id} ${f.title}`);
    for (const e of s.finding(f.id)?.evidence.slice(0, 4) ?? []) console.log(`       ${e.value} · ${e.component ?? ''} ${e.file ?? ''}${e.line ? ':' + e.line : ''} ${e.variantId ?? ''}`);
  }
}

const TYPES: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json', '.txt': 'text/plain', '.ico': 'image/x-icon' };

const COMPRESSIBLE = new Set(['.html', '.css', '.js', '.json', '.svg', '.txt']);

/**
 * A static host for site/out that behaves like the hosts the site will be deployed to: directories serve
 * index.html, misses serve 404.html with status 404, text is compressed, hashed assets are cached for good.
 */
function serveOut(): Promise<Server> {
  const dir = join(SITE, 'out');
  const srv = createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url ?? '/', STATIC).pathname);
    let p = join(dir, path);
    try { if ((await stat(p)).isDirectory()) p = join(p, 'index.html'); await stat(p); } catch { p = join(dir, '404.html'); res.statusCode = 404; }
    res.setHeader('content-type', TYPES[extname(p)] ?? 'application/octet-stream');
    if (path.startsWith('/_next/static/')) res.setHeader('cache-control', 'public, max-age=31536000, immutable');
    let body = await readFile(p);
    const accept = String(req.headers['accept-encoding'] ?? '');
    if (COMPRESSIBLE.has(extname(p))) {
      if (accept.includes('br')) { body = brotliCompressSync(body); res.setHeader('content-encoding', 'br'); }
      else if (accept.includes('gzip')) { body = gzipSync(body); res.setHeader('content-encoding', 'gzip'); }
    }
    res.end(body);
  });
  return new Promise((r) => srv.listen(STATIC_PORT, () => r(srv)));
}

async function lighthouseGate() {
  console.log('2. Lighthouse');
  const port = 9333;
  const browser = await chromium.launch({ args: [`--remote-debugging-port=${port}`] });
  try {
    for (const route of LIGHTHOUSE_ROUTES) {
      for (const [preset, config] of [['mobile', undefined], ['desktop', desktopConfig]] as const) {
        const r = await lighthouse(STATIC + route, { port, output: 'json', logLevel: 'error' }, config);
        const cats = r?.lhr.categories ?? {};
        const scores = Object.values(cats).map((c) => `${c.id} ${Math.round((c.score ?? 0) * 100)}`).join(', ');
        console.log(`   ${route} ${preset}: ${scores}`);
        for (const c of Object.values(cats)) if ((c.score ?? 0) < MIN_SCORE) {
          fail(`lighthouse ${route} ${preset} ${c.id} ${Math.round((c.score ?? 0) * 100)}`);
          const audits = c.auditRefs.map((a) => r!.lhr.audits[a.id]).filter((a) => a && a.score !== null && a.score < 1 && a.scoreDisplayMode !== 'informative');
          for (const a of audits.slice(0, 6)) console.log(`       ${a.id}: ${a.title}${a.displayValue ? ` (${a.displayValue})` : ''}`);
          const shifts = (r!.lhr.audits['layout-shifts']?.details as { items?: Array<{ node?: { selector?: string }; score?: number }> } | undefined)?.items ?? [];
          for (const s of shifts.slice(0, 4)) console.log(`       shift ${s.score?.toFixed(3)}: ${s.node?.selector ?? '?'}`);
        }
      }
    }
  } finally { await browser.close(); }
}

async function pageGates() {
  console.log('3. axe, 4. widths and screenshots');
  rmSync(SHOTS, { recursive: true, force: true });
  mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const route of ROUTES) {
      for (const w of WIDTHS) {
        // axe needs a page from an explicit context
        const context = await browser.newContext({ viewport: { width: w, height: 900 } });
        const page = await context.newPage();
        await page.goto(STATIC + route, { waitUntil: 'networkidle' });
        await page.evaluate(async () => { for (const i of document.images) i.loading = 'eager'; await Promise.all([...document.images].map((i) => i.decode().catch(() => null))); await document.fonts.ready; });
        const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
        if (sw > iw) fail(`width ${route} at ${w}: scrollWidth ${sw}`);
        if (w === 1440 || w === 375) {
          const res = await new AxeBuilder({ page }).analyze();
          const bad = res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical' || v.tags.some((t) => t === 'wcag2a' || t === 'wcag2aa'));
          for (const v of bad) fail(`axe ${route} at ${w}: ${v.id} (${v.impact}) ${v.help}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
        }
        const name = route === '/' ? 'home' : route.replace(/^\/|\/$/g, '').replace(/\//g, '-');
        await page.screenshot({ path: join(SHOTS, `${name}-${w}.png`), fullPage: true });
        await context.close();
      }
      console.log(`   ${route} checked`);
    }
  } finally { await browser.close(); }
}

// --skip-scan reuses the last scan and build, for iterating on the browser gates
if (!process.argv.includes('--skip-scan')) {
  await taveroGate();
  console.log('   building the static site');
  const b = spawnSync('npm', ['run', 'build'], { cwd: SITE, shell: true, encoding: 'utf8' });
  if (b.status !== 0) { console.log(b.stdout, b.stderr); fail('next build'); process.exit(1); }
}
const srv = await serveOut();
try {
  await lighthouseGate();
  await pageGates();
} finally { srv.close(); }
console.log(failures.length ? `\n${failures.length} failure(s)` : '\nall gates passed');
process.exit(failures.length ? 1 : 0);
