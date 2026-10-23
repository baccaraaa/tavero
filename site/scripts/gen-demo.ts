// Demo materials for the site, all from a real scan of demo/acme: the static panel for /demo/panel/,
// the landing page's findings and crops (site/generated/demo.json, site/public/demo-assets/), and a panel screenshot.
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { attachOrLaunch } from '../../src/runtime/server.js';
import { scan } from '../../src/core/scan.js';
import { loadScan } from '../../src/core/loadScan.js';
import { saveDecision } from '../../src/core/decisions.js';
import { exportUi } from '../../src/ui/export.js';
import { createUiServer } from '../../src/ui/server.js';
import type { Evidence } from '../../src/core/types.js';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const ACME = join(ROOT, 'demo', 'acme');
const OUT = join(ACME, '.tavero');
const URL_ = 'http://localhost:5180';
const ASSETS = join(ROOT, 'site', 'public', 'demo-assets');
const PANEL = join(ROOT, 'site', 'public', 'demo', 'panel');

export interface Img { src: string; w: number; h: number }
export interface DemoRow { crop: Img | null; component: string; where: string; uses: number; signature: string; canonical: 'primary' | 'allowed' | null; name: string | null }
export interface Demo {
  scannedAt: string;
  pages: number; routes: number; widths: number; components: number;
  findings: { high: number; medium: number; info: number };
  buttons: { id: string; title: string; variants: number; rows: DemoRow[]; expected: string };
  cards: { title: string; crops: Img[] };
  /** 2x screenshot as `src`, 1x as `src1x`, for srcset */
  panel: Img & { src1x: string };
  color: { hex: string; where: string; expected: string } | null;
  radius: { used: string[]; declared: string[] };
  canonical: string;
}

/** Width and height from the PNG header, so the site can reserve the space and avoid layout shift. */
const pngSize = (file: string): { w: number; h: number } => { const b = readFileSync(file); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; };
const uses = (e: Evidence) => Number(e.value.match(/— (\d+) instance/)?.[1] ?? 0);
const signature = (e: Evidence) => e.value.split(' — ')[0];
const where = (e: Evidence) => `${e.file ?? ''}${e.line ? ':' + e.line : ''}`;

export async function genDemo(): Promise<Demo> {
  const dev = await attachOrLaunch({ url: URL_, projectDir: ACME, devScript: 'vite', logPath: join(tmpdir(), 'tavero-acme-gen.log'), timeoutMs: 120_000 });
  try {
    rmSync(OUT, { recursive: true, force: true });
    await scan({ projectDir: ACME, url: URL_, out: OUT, log: (l) => process.stdout.write(l + '\n') });
  } finally { dev.stop(); }

  // the demo shows a person's decision at work: Button primary is the canonical, secondary and ghost are allowed
  let s = await loadScan(ACME, OUT);
  const btn = s.rawFindings.find((f) => f.rule === 'buttons' && f.key === 'variants:text')!;
  const byUse = [...btn.evidence].sort((a, b) => uses(b) - uses(a));
  const primary = byUse.find((e) => e.component === 'Button' && /^bg #3b5bdb/.test(e.value))!;
  const secondary = byUse.find((e) => e.component === 'Button' && /^bg #ffffff/.test(e.value))!;
  const ghost = byUse.find((e) => e.component === 'Button' && /^no bg/.test(e.value))!;
  await saveDecision(OUT, btn.id, { canonical: { primary: primary.variantId!, allowed: [secondary.variantId!, ghost.variantId!], names: { [primary.variantId!]: 'primary', [secondary.variantId!]: 'secondary', [ghost.variantId!]: 'ghost' } } }, btn.evidence.length);
  s = await loadScan(ACME, OUT);

  rmSync(PANEL, { recursive: true, force: true });
  rmSync(ASSETS, { recursive: true, force: true });
  mkdirSync(ASSETS, { recursive: true });
  await exportUi({ projectDir: ACME, out: OUT, dir: PANEL });

  const copyCrop = (variantId: string | undefined, viewport = 'desktop'): Img | null => {
    if (!variantId) return null;
    const crops = s.variantCrops(variantId);
    const src = crops[viewport] ?? Object.values(crops)[0];
    if (!src) return null;
    const name = `${variantId}.png`;
    copyFileSync(src, join(ASSETS, name));
    return { src: `/demo-assets/${name}`, ...pngSize(src) };
  };
  const applied = s.finding(btn.id)!;
  // every variant, canonical ones first (primary, then allowed), then the drift by how often it renders
  const rank = (e: Evidence) => (e.canonical === 'primary' ? 0 : e.canonical === 'allowed' ? 1 : 2);
  const names = applied.decision?.canonical?.names ?? {};
  const rows: DemoRow[] = [...applied.evidence].sort((a, b) => rank(a) - rank(b) || uses(b) - uses(a))
    .map((e) => ({ crop: copyCrop(e.variantId), component: e.component ?? 'unknown', where: where(e), uses: uses(e), signature: signature(e), canonical: e.canonical ?? null, name: e.variantId ? names[e.variantId] ?? null : null }));
  const cards = s.rawFindings.find((f) => f.rule === 'cards' && f.key === 'variants');
  const off = s.rawFindings.filter((f) => f.rule === 'colors' && f.key.startsWith('off:'))
    .map((f) => ({ f, lit: f.evidence.find((e) => e.value.startsWith('literal')) })).find((x) => x.lit);
  const radius = s.rawFindings.find((f) => f.rule === 'scales' && f.key === 'radius');
  const declaredRadius = s.allTokens.filter((t) => t.kind === 'radius').map((t) => t.resolved);

  const demo: Demo = {
    scannedAt: s.meta.createdAt,
    pages: s.meta.stats.pages, routes: new Set(s.meta.routes.map((r) => r.path)).size, widths: s.meta.viewports.length, components: s.meta.stats.components,
    findings: s.meta.stats.findings,
    buttons: { id: btn.id, title: applied.title, variants: btn.evidence.length, rows, expected: applied.evidence.find((e) => !e.canonical)?.expected ?? '' },
    cards: { title: cards?.title ?? '', crops: (cards?.evidence ?? []).slice(0, 3).map((e) => copyCrop(e.variantId)).filter((x): x is Img => !!x) },
    panel: { src: '/demo-assets/panel@2x.webp', src1x: '/demo-assets/panel.webp', w: 0, h: 0 },
    color: off ? { hex: off.f.key.slice(4), where: where(off.lit!), expected: off.lit!.expected ?? '' } : null,
    radius: { used: (radius?.evidence ?? []).map((e) => e.value.split(' ')[0]), declared: declaredRadius },
    canonical: s.regenerateContext().split('\n').find((l) => l.startsWith('Action button is')) ?? '',
  };

  // a screenshot of the live panel on the canonical picker, at 1x and 2x, as WebP (a 2x PNG of it is ~450 KB);
  // Chromium encodes it through a canvas, so no image library is needed
  const ui = await createUiServer({ projectDir: ACME, out: OUT, port: 0 });
  const browser = await chromium.launch();
  try {
    for (const [scale, name] of [[1, 'panel.webp'], [2, 'panel@2x.webp']] as const) {
      // wide enough for the variant table with all three widths and the source column
      const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: scale });
      await page.goto(ui.url + 'f/' + btn.id, { waitUntil: 'networkidle' });
      await page.evaluate(async () => { for (const i of document.images) i.loading = 'eager'; await Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; })))); await document.fonts.ready; });
      const png = await page.screenshot();
      const webp = await page.evaluate(async (b64) => {
        const img = new Image();
        img.src = 'data:image/png;base64,' + b64;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        c.getContext('2d')!.drawImage(img, 0, 0);
        return c.toDataURL('image/webp', 0.9).split(',')[1];
      }, png.toString('base64'));
      writeFileSync(join(ASSETS, name), Buffer.from(webp, 'base64'));
      if (scale === 2) Object.assign(demo.panel, { w: png.readUInt32BE(16), h: png.readUInt32BE(20) });
      await page.close();
    }
  } finally { await browser.close(); await ui.close(); }
  // written last: the manifest carries the screenshot's real size
  mkdirSync(join(ROOT, 'site', 'generated'), { recursive: true });
  writeFileSync(join(ROOT, 'site', 'generated', 'demo.json'), JSON.stringify(demo, null, 2) + '\n');
  return demo;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const d = await genDemo();
  console.log(`demo: ${d.pages} pages, ${d.findings.high} high / ${d.findings.medium} medium, ${d.buttons.variants} button styles; canonical: ${d.canonical}`);
}

