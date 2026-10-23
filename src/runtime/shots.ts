import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Page } from 'playwright';
import type { AttributedInstance, StyleSample, Viewport } from '../core/types.js';
import { buttonSignature, cardSignature, variantId } from '../rules/signature.js';
import { routeSlug } from '../core/ids.js';

/** Crop selected component instances out of the already-settled page. Returns instance key → file. */
export async function cropInstances(opts: {
  page: Page;
  instances: Array<{ instance: AttributedInstance; componentId: string }>;
  docSize: [number, number];
  viewport: Viewport;
  cropsDir: string;
  route: string;
  perComponentBudget: Map<string, number>;
  limit: number;
  maxAreaRatio: number;
  select: Set<string>;
}): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const vpArea = opts.viewport.width * opts.viewport.height;
  for (const { instance, componentId } of opts.instances) {
    if (!opts.select.has(instance.name)) continue;
    const budgetKey = `${componentId}|${opts.viewport.name}`;
    const used = opts.perComponentBudget.get(budgetKey) ?? 0;
    if (used >= opts.limit) continue;
    const { x, y, w, h } = instance.rect;
    if (w * h > vpArea * opts.maxAreaRatio || w < 4 || h < 4) continue;
    const cx = Math.max(0, x - 4), cy = Math.max(0, y - 4);
    const clip = { x: cx, y: cy, width: Math.min(w + 8, opts.docSize[0] - cx), height: Math.min(h + 8, opts.docSize[1] - cy) };
    if (clip.width < 4 || clip.height < 4) continue;
    const dir = join(opts.cropsDir, componentId);
    await mkdir(dir, { recursive: true });
    const file = join(dir, `${opts.viewport.name}__${routeSlug(opts.route)}__${used}.png`);
    try { await opts.page.screenshot({ path: file, clip, fullPage: true }); } catch { continue; }
    opts.perComponentBudget.set(budgetKey, used + 1);
    out.set(instance.key, file);
  }
  return out;
}

/**
 * One crop per style variant (button or card signature) and width, from the first page that shows it:
 * crops/variants/<variantId>/<viewport>.png. Sets `crop` on that sample; `seen` spans the whole scan.
 */
export async function cropVariantSamples(opts: { page: Page; samples: StyleSample[]; docSize: [number, number]; viewport: Viewport; cropsDir: string; seen: Set<string>; maxAreaRatio: number }): Promise<number> {
  const vpArea = opts.viewport.width * opts.viewport.height;
  let made = 0;
  for (const s of opts.samples) {
    if (s.role !== 'button-text' && s.role !== 'button-icon' && s.role !== 'card') continue;
    const vid = variantId(s.role === 'card' ? cardSignature(s.styles) : buttonSignature(s.styles));
    const key = `${vid}|${opts.viewport.name}`;
    if (opts.seen.has(key)) continue;
    const { x, y, w, h } = s.rect;
    if (w * h > vpArea * opts.maxAreaRatio || w < 4 || h < 4) continue;
    const cx = Math.max(0, x - 4), cy = Math.max(0, y - 4);
    const clip = { x: cx, y: cy, width: Math.min(w + 8, opts.docSize[0] - cx), height: Math.min(h + 8, opts.docSize[1] - cy) };
    if (clip.width < 4 || clip.height < 4) continue;
    const dir = join(opts.cropsDir, 'variants', vid);
    await mkdir(dir, { recursive: true });
    const file = join(dir, `${opts.viewport.name}.png`);
    try { await opts.page.screenshot({ path: file, clip, fullPage: true }); } catch { continue; }
    opts.seen.add(key);
    s.crop = file;
    made++;
  }
  return made;
}
