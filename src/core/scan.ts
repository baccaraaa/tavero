import { mkdir, writeFile, readFile, readdir, copyFile, stat, rm } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import type { Component, Finding, PageRecord, RouteEntry, RuleInput, RuleName, ScanMeta, StaticInfo, Viewport } from './types.js';
import { detectTailwind } from '../static/tailwind.js';
import { findHardcodedColors, findTokenRefs } from '../static/hardcodedColors.js';
import { runRules, sortFindings, RULE_NAMES } from '../rules/index.js';
import { diffScans, formatDiff, partialNote } from './diff.js';
import { DEFAULT_VIEWPORTS } from './types.js';
import { componentId } from './ids.js';
import { detectProject } from '../project/detect.js';
import { buildComponentIndex } from '../static/componentIndex.js';
import { findTokenDeclarations } from '../static/tokens.js';
import { planRoutes, writeRoutesFile, readRoutesFile } from '../runtime/routes/index.js';
import { attachOrLaunch } from '../runtime/server.js';
import { loadSessionPath } from '../runtime/session.js';
import { createResolver } from '../runtime/sourcemaps.js';
import { newScanContext, crawlRoute } from '../runtime/crawl.js';
import { cropInstances, cropVariantSamples } from '../runtime/shots.js';
import { derivePage, emptyScales } from './derive/page.js';
import { aggregate, pageFileName } from './derive/aggregate.js';
import { loadScan } from './loadScan.js';
import { buildReport } from '../report/html.js';
import { TaveroError } from './errors.js';

const VERSION: string = (createRequire(import.meta.url)('../../package.json') as { version: string }).version;

export interface ScanOptions {
  projectDir: string;
  url: string;
  routes?: string[];
  viewports?: Viewport[];
  out?: string;
  crop?: string[];
  apiOrigin?: string | null;
  keepRaw?: boolean;
  rules?: string[];
  log?: (line: string) => void;
  /** checked between pages; a cancelled scan removes its directory and leaves `latest` untouched */
  signal?: AbortSignal;
  /** called after every crawled page; `total` is known only for explicit routes */
  onPage?: (p: { done: number; total: number | null; line: string }) => void;
  /** leave a dev server this scan launched running; the caller stops it through `result.devServer` */
  keepDevServer?: boolean;
}
export interface ScanResult { dir: string; meta: ScanMeta; components: Component[]; warnings: string[]; devServer: { launched: boolean; stop: () => void } }

// milliseconds keep two scans started in the same second apart
const stamp = (d = new Date()): string => d.toISOString().replace(/[:.]/g, '-').slice(0, 23);
async function exists(p: string): Promise<boolean> {
  try { await stat(p); return true; } catch { return false; }
}

/** The scan directory `latest` points to, when it exists and is complete. */
export async function previousScanDir(outDir: string): Promise<string | null> {
  const latest = join(outDir, 'scans', 'latest');
  if (!(await exists(latest))) return null;
  const dir = join(outDir, 'scans', (await readFile(latest, 'utf8')).trim());
  return (await exists(join(dir, 'scan.json'))) ? dir : null;
}

export async function readPages(scanDir: string): Promise<PageRecord[]> {
  const dir = join(scanDir, 'pages');
  if (!(await exists(dir))) return [];
  const files = (await readdir(dir)).filter((f) => f.endsWith('.json')).sort();
  return Promise.all(files.map(async (f) => JSON.parse(await readFile(join(dir, f), 'utf8')) as PageRecord));
}

export async function scan(opts: ScanOptions): Promise<ScanResult> {
  const log = opts.log ?? (() => {});
  const project = await detectProject(opts.projectDir);
  const outDir = opts.out ?? join(project.dir, '.tavero');
  const previous = await previousScanDir(outDir);
  const scanDir = join(outDir, 'scans', stamp());
  const shotsDir = join(scanDir, 'shots');
  const cropsDir = join(scanDir, 'crops');
  const pagesDir = join(scanDir, 'pages');
  for (const d of [shotsDir, cropsDir, pagesDir]) await mkdir(d, { recursive: true });
  log(`project: ${project.framework} at ${project.dir}`);
  log(`writing to ${scanDir}`);

  const index = await buildComponentIndex(project.dir, project.srcRoots);
  const declMap = await findTokenDeclarations(project.cssEntries, project.dir);
  const { queue, warnings } = await planRoutes({ cliRoutes: opts.routes, project, outDir });
  const tw = await detectTailwind(project);
  warnings.push(...tw.warnings);
  const hardcodedColors = await findHardcodedColors(project.dir, project.srcRoots, new Set([...declMap.values()].map((d) => d.file)));
  const tokenRefs = await findTokenRefs(project.dir, project.srcRoots);
  const staticInfo: StaticInfo = { tailwind: { version: tw.version, theme: tw.theme }, hardcodedColors, tokenRefs, warnings: tw.warnings };
  const server = await attachOrLaunch({ url: opts.url, projectDir: project.dir, devScript: project.devScript, logPath: join(outDir, 'devserver.log') });
  if (server.launched) log('launched the dev server; its bundler cache is written by the project itself, as on any dev run');
  const sessionPath = await loadSessionPath(outDir);
  if (!sessionPath) warnings.push('no session (.tavero/session.json); pages behind login will be empty — run `tavero login --url ...`');
  // a partial rescan without explicit widths keeps the previous scan's widths, so its stats stay comparable
  let viewports = opts.viewports ?? DEFAULT_VIEWPORTS;
  if (!opts.viewports && opts.routes?.length && previous) {
    try { viewports = (JSON.parse(await readFile(join(previous, 'scan.json'), 'utf8')) as ScanMeta).viewports; } catch { /* keep defaults */ }
  }
  const resolver = createResolver({ kind: project.framework, baseUrl: new URL(opts.url).origin, projectDir: project.dir });
  const browser = await chromium.launch();
  const budget = new Map<string, number>();
  const variantSeen = new Set<string>();
  const crawled: PageRecord[] = [];
  let tokensTaken = false;
  const total = opts.routes?.length ? opts.routes.length * viewports.length : null;
  let done = 0;
  let cancelled = false;

  try {
    for (let vi = 0; vi < viewports.length; vi++) {
      const vp = viewports[vi];
      const context = await newScanContext(browser, { viewport: vp, sessionPath, devOrigin: opts.url, apiOrigin: opts.apiOrigin ?? null });
      // the first viewport drives link discovery; later passes replay the final route list
      const replay = vi === 0 ? null : queue.entries().filter((e) => e.status !== 'failed').map((e) => ({ path: e.path, depth: 0 }));
      let cursor = 0;
      for (;;) {
        if (opts.signal?.aborted) throw new TaveroError('cancelled', 'scan cancelled', 130);
        const item = replay ? replay[cursor++] : queue.next();
        if (!item) break;
        const res = await crawlRoute({ context, baseUrl: opts.url, route: item.path, viewport: vp, shotsDir, resolver, index });
        const distinct = new Set([...res.instances.values()].map((i) => i.name)).size;
        const line = `${vp.name.padEnd(7)} ${item.path.padEnd(40)} ${res.status}${res.reason ? ' ' + res.reason : ''}  components=${distinct}`;
        log(line);
        done++;
        opts.onPage?.({ done, total, line });
        if (res.status === 'failed' && res.reason?.startsWith('next build error')) {
          await res.page?.close();
          throw new TaveroError('next-build-error', res.reason, 3);
        }
        if (vi === 0) {
          queue.setStatus(item.path, res.status, res.reason);
          // explicit --routes means exactly those routes: no link discovery
          if (!opts.routes?.length && item.depth < 2) for (const l of res.links) queue.add(l, 'crawl', item.depth + 1);
        }
        let record: PageRecord;
        if (res.raw && res.status !== 'failed') {
          const counts = new Map<string, number>();
          for (const inst of res.instances.values()) counts.set(inst.name, (counts.get(inst.name) ?? 0) + 1);
          const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([n]) => n);
          const list = [...res.instances.values()].map((instance) => ({ instance, componentId: componentId(instance.file, instance.name) }));
          const crops = res.page
            ? await cropInstances({ page: res.page, instances: list, docSize: res.raw.docSize, viewport: vp, cropsDir, route: item.path, perComponentBudget: budget, limit: 12, maxAreaRatio: 0.6, select: new Set([...(opts.crop ?? []), ...top]) })
            : new Map<string, string>();
          const takeTokens = !tokensTaken && res.raw.tokens.length > 0;
          if (takeTokens) tokensTaken = true;
          record = derivePage({
            route: item.path, viewport: vp, status: res.status, reason: res.reason, docSize: res.raw.docSize,
            elements: res.elements, instances: [...res.instances.values()], crops, links: res.links,
            tokens: takeTokens ? { decls: res.raw.tokens, values: res.raw.tokenValues } : undefined,
          });
          if (res.page) await cropVariantSamples({ page: res.page, samples: record.samples, docSize: res.raw.docSize, viewport: vp, cropsDir, seen: variantSeen, maxAreaRatio: 0.6 });
          if (opts.keepRaw) {
            await mkdir(join(scanDir, 'raw'), { recursive: true });
            await writeFile(join(scanDir, 'raw', pageFileName(vp.name, item.path)), JSON.stringify(res.raw));
          }
        } else {
          record = { route: item.path, viewport: vp.name, status: 'failed', reason: res.reason, docSize: [0, 0], crawledAt: new Date().toISOString(), links: [], instances: [], samples: [], colors: {}, scales: emptyScales() };
        }
        await writeFile(join(pagesDir, pageFileName(vp.name, item.path)), JSON.stringify(record));
        crawled.push(record);
        await res.page?.close();
      }
      await context.close();
    }
  } catch (e) {
    cancelled = (e as { code?: string }).code === 'cancelled';
    throw e;
  } finally {
    await browser.close();
    if (!opts.keepDevServer) server.stop();
    if (cancelled) await rm(scanDir, { recursive: true, force: true });
  }

  // partial rescan: keep the previous scan's pages for routes not rescanned (same viewport names only)
  const rescanned = new Set(crawled.map((p) => `${p.viewport}|${p.route}`));
  const staleRoutes = new Set<string>();
  let routesForMeta: RouteEntry[] = queue.entries();
  if (opts.routes?.length && previous) {
    const prevPages = await readPages(previous);
    const vpNames = new Set(viewports.map((v) => v.name));
    for (const p of prevPages) {
      if (!vpNames.has(p.viewport) || rescanned.has(`${p.viewport}|${p.route}`)) continue;
      await copyFile(join(previous, 'pages', pageFileName(p.viewport, p.route)), join(pagesDir, pageFileName(p.viewport, p.route)));
      staleRoutes.add(p.route);
    }
    const prevRoutes = (await readRoutesFile(previous)) ?? [];
    const known = new Set(routesForMeta.map((r) => r.path));
    routesForMeta = [...routesForMeta, ...prevRoutes.filter((r) => !known.has(r.path) && staleRoutes.has(r.path))];
  }
  const pages = await readPages(scanDir);
  const agg = aggregate(pages, { declMap });
  const okPages = pages.filter((p) => p.status !== 'failed').length;

  // rules → findings; with --rules, findings of the other rules are carried over from the previous scan
  const requested = (opts.rules ?? []).filter((r): r is RuleName => (RULE_NAMES as string[]).includes(r));
  if (opts.rules?.length && requested.length !== opts.rules.length) warnings.push(`unknown rules ignored: ${opts.rules.filter((r) => !(RULE_NAMES as string[]).includes(r)).join(', ')}`);
  const ruleInput: RuleInput = { samples: agg.samples, colors: agg.colors, scales: agg.scales, tokens: agg.tokens, staticInfo, instances: agg.instances, components: agg.components };
  let findings = runRules(ruleInput, requested.length ? requested : undefined);
  if (requested.length && previous) {
    try {
      const prev = JSON.parse(await readFile(join(previous, 'findings.json'), 'utf8')) as Finding[];
      findings = sortFindings([...findings, ...prev.filter((f) => !requested.includes(f.rule))]);
    } catch { /* no previous findings */ }
  }
  const findingCounts = { high: 0, medium: 0, info: 0 };
  for (const f of findings) findingCounts[f.severity]++;

  const meta: ScanMeta = {
    version: VERSION,
    createdAt: new Date().toISOString(),
    url: opts.url,
    project: { dir: project.dir, framework: project.framework },
    viewports,
    routes: routesForMeta,
    stats: { pages: okPages, components: agg.components.length, instances: agg.instances.length, tokens: agg.tokens.length, unresolvedComponents: agg.components.filter((c) => !c.file).length, findings: findingCounts },
    warnings,
    stale: staleRoutes.size > 0,
    staleRoutes: [...staleRoutes].sort(),
    rescannedRoutes: opts.routes?.length ? [...new Set(crawled.map((p) => p.route))].sort() : [],
    rulesRun: requested.length ? requested : RULE_NAMES,
    diff: null,
  };
  // data files first, then findings, then the diff (it reads both scans from disk), then scan.json last
  await writeFile(join(scanDir, 'components.json'), JSON.stringify(agg.components, null, 2));
  await writeFile(join(scanDir, 'instances.json'), JSON.stringify(agg.instances));
  await writeFile(join(scanDir, 'samples.json'), JSON.stringify(agg.samples));
  await writeFile(join(scanDir, 'colors.json'), JSON.stringify(agg.colors, null, 2));
  await writeFile(join(scanDir, 'scales.json'), JSON.stringify(agg.scales, null, 2));
  await writeFile(join(scanDir, 'tokens.json'), JSON.stringify(agg.tokens, null, 2));
  await writeFile(join(scanDir, 'routes.json'), JSON.stringify(routesForMeta, null, 2));
  await writeFile(join(scanDir, 'static.json'), JSON.stringify(staticInfo, null, 2));
  await writeFile(join(scanDir, 'findings.json'), JSON.stringify(findings, null, 2));
  if (previous) {
    const diff = await diffScans(previous, scanDir);
    meta.diff = { from: diff.from, new: diff.findings.new.length, resolved: diff.findings.resolved.length, unchanged: diff.findings.unchanged.length, note: staleRoutes.size ? partialNote(staleRoutes.size) : null };
    log(formatDiff(diff, { staleRoutes: staleRoutes.size }));
  }
  await writeFile(join(scanDir, 'scan.json'), JSON.stringify(meta, null, 2));
  // context and report go through loadScan so human decisions (tavero ui) apply to them
  const loaded = await loadScan(scanDir);
  await writeFile(join(scanDir, 'context.md'), loaded.regenerateContext());
  await writeFile(join(scanDir, 'report.html'), buildReport(loaded));
  await writeRoutesFile(outDir, routesForMeta);
  await writeFile(join(outDir, 'scans', 'latest'), basename(scanDir));
  return { dir: scanDir, meta, components: agg.components, warnings, devServer: server };
}
