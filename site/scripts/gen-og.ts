// The link preview image (Open Graph and Twitter, 1200×630), rendered with the site's own fonts from a built site
// (npm run site:build first) and written to app/opengraph-image.png; lib/seo.ts names it as og:image and
// twitter:image on every page. Run it again when the headline or the demo finding changes.
// `--size 1280x640 --out <file>` renders another size, e.g. the GitHub social preview.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const OUT = join(ROOT, 'site', 'out');
const APP = join(ROOT, 'site', 'app');
const TYPES: Record<string, string> = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain' };
const srv = createServer(async (q, r) => {
  let p = join(OUT, decodeURIComponent(new URL(q.url ?? '/', 'http://x').pathname));
  try { if ((await stat(p)).isDirectory()) p = join(p, 'index.html'); r.setHeader('content-type', TYPES[extname(p)] ?? 'application/octet-stream'); r.end(await readFile(p)); } catch { r.statusCode = 404; r.end(); }
}).listen(5196);

const arg = (name: string) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
const [W, H] = (arg('--size') ?? '1200x630').split('x').map(Number);
const TARGET = arg('--out') ?? join(APP, 'opengraph-image.png');

const finding = 'data:image/webp;base64,' + readFileSync(join(ROOT, 'docs', 'images', 'finding.webp')).toString('base64');
const logo = readFileSync(join(APP, 'icon.svg'), 'utf8').replace('<svg ', '<svg width="44" height="44" ');

const card = `
<div style="position:fixed;inset:0;background:#ffffff;display:flex;gap:48px;padding:64px;box-sizing:border-box;align-items:center;overflow:hidden">
  <div style="flex:0 0 520px;display:flex;flex-direction:column;justify-content:space-between;height:100%">
    <div style="display:flex;align-items:center;gap:14px;font:600 28px 'Onest';color:#141414">${logo}Tavero</div>
    <div style="font:400 72px/1.02 'Instrument Serif';color:#141414;letter-spacing:-0.5px">Keep the UI your agent writes consistent.</div>
    <div style="font:400 22px 'Onest';color:#4a4a4a">UI consistency checks for React apps, for coding agents. Free and open source.</div>
    <div style="font:500 20px 'IBM Plex Mono';color:#6f6f6f">taveroui.com</div>
  </div>
  <img src="${finding}" style="width:600px;border:1px solid #e3e3e3;border-radius:12px;box-shadow:0 1px 2px rgba(20,20,20,.05),0 4px 12px rgba(20,20,20,.04)">
</div>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.goto('http://localhost:5196/', { waitUntil: 'networkidle' });
  // load the faces before the text exists, so font-display: optional cannot fall back
  await page.evaluate(async () => {
    await Promise.all(['400 72px "Instrument Serif"', '400 22px Onest', '600 28px Onest', '500 20px "IBM Plex Mono"'].map((f) => document.fonts.load(f, 'Keep the UI')));
  });
  await page.evaluate((html) => { document.body.innerHTML = html; }, card);
  await page.evaluate(async () => { await Promise.all([...document.images].map((i) => i.decode())); await document.fonts.ready; });
  await page.screenshot({ path: TARGET });
} finally { await browser.close(); srv.close(); }
console.log(TARGET);
