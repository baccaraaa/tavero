import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ProjectInfo, RouteEntry, RouteSource, RouteStatus } from '../../core/types.js';
import { discoverNextRoutes } from './next.js';
import { discoverReactRouterRoutes } from './reactRouter.js';
import { discoverTanstackRoutes } from './tanstack.js';

const ASSET_EXT = /\.(pdf|png|jpe?g|gif|svg|webp|ico|css|js|mjs|map|json|xml|txt|zip|mp4|webm|mp3|woff2?|ttf)$/i;

/** Same-origin page path from any href, or null for external, non-http and asset links. */
export function normalizeLink(href: string, baseUrl: string): string | null {
  let u: URL;
  try { u = new URL(href, baseUrl); } catch { return null; }
  const base = new URL(baseUrl);
  if (u.origin !== base.origin || !/^https?:$/.test(u.protocol)) return null;
  if (ASSET_EXT.test(u.pathname)) return null;
  const path = u.pathname.replace(/\/+$/, '');
  return path || '/';
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Collapse id-like segments so /resumes/12 and /resumes/15 count as one route pattern. */
export function collapseDynamic(path: string): string {
  return path
    .split('/')
    .map((seg) => {
      if (!seg) return seg;
      if (/^\d+$/.test(seg) || UUID.test(seg) || /^[0-9a-f]{8,}$/i.test(seg)) return ':param';
      if (seg.length >= 8 && /\d/.test(seg)) return ':param';
      return seg;
    })
    .join('/');
}

export class RouteQueue {
  private items: Array<{ path: string; depth: number; entry: RouteEntry }> = [];
  private patterns = new Set<string>();
  private paths = new Set<string>();
  private cursor = 0;
  constructor(private cap = 60) {}
  /** Crawled links are deduped by pattern (/items/1, /items/2); declared routes only by exact path (/401, /403). */
  add(path: string, source: RouteSource, depth: number): boolean {
    const pattern = collapseDynamic(path);
    if (this.paths.has(path) || (source === 'crawl' && this.patterns.has(pattern)) || this.items.length >= this.cap) return false;
    this.paths.add(path);
    this.patterns.add(pattern);
    this.items.push({ path, depth, entry: { path, source, status: 'pending' } });
    return true;
  }
  next(): { path: string; depth: number } | undefined {
    // advance only when there is an item: during a parallel crawl an idle worker asks before routes are added
    const it = this.items[this.cursor];
    if (!it) return undefined;
    this.cursor++;
    return { path: it.path, depth: it.depth };
  }
  entries(): RouteEntry[] { return this.items.map((i) => i.entry); }
  setStatus(path: string, status: RouteStatus, reason?: string): void {
    const it = this.items.find((i) => i.path === path);
    if (it) { it.entry.status = status; if (reason) it.entry.reason = reason; }
  }
  get size(): number { return this.items.length; }
  get full(): boolean { return this.items.length >= this.cap; }
}

export async function readRoutesFile(outDir: string): Promise<RouteEntry[] | null> {
  try { return JSON.parse(await readFile(join(outDir, 'routes.json'), 'utf8')) as RouteEntry[]; } catch { return null; }
}

export async function writeRoutesFile(outDir: string, entries: RouteEntry[]): Promise<void> {
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, 'routes.json'), JSON.stringify(entries, null, 2));
}

/** Priority: --routes, then .tavero/routes.json, then framework discovery, then "/" as a crawl seed. */
export async function planRoutes(opts: { cliRoutes?: string[]; project: ProjectInfo; outDir: string; cap?: number }): Promise<{ queue: RouteQueue; warnings: string[] }> {
  const queue = new RouteQueue(opts.cap ?? 60);
  const warnings: string[] = [];
  if (opts.cliRoutes?.length) {
    for (const r of opts.cliRoutes) queue.add(r, 'cli', 0);
    return { queue, warnings };
  }
  const saved = await readRoutesFile(opts.outDir);
  if (saved?.length) {
    for (const e of saved) if (e.status !== 'skipped') queue.add(e.path, 'routes.json', 0);
    return { queue, warnings };
  }
  const discovered: Array<{ source: RouteSource; routes: string[]; skipped: Array<{ path: string; reason: string }> }> = opts.project.framework === 'next'
    ? [{ source: 'next', ...(await discoverNextRoutes(opts.project.dir)) }]
    : [
        { source: 'react-router', ...(await discoverReactRouterRoutes(opts.project.dir, opts.project.srcRoots)) },
        { source: 'tanstack-router', ...(await discoverTanstackRoutes(opts.project.srcRoots)) },
      ];
  outer: for (const found of discovered) {
    for (const r of found.routes) {
      if (!queue.add(r, found.source, 0) && queue.full) { warnings.push(`route cap reached (${queue.size}); narrow with --routes`); break outer; }
    }
    for (const s of found.skipped) warnings.push(`skipped ${s.path}: ${s.reason}`);
  }
  if (queue.size === 0) { queue.add('/', 'crawl', 0); warnings.push('no routes discovered; starting from /'); }
  return { queue, warnings };
}
