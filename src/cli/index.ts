#!/usr/bin/env node
import { Command } from 'commander';
import { resolve, join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { buildReport } from '../report/html.js';
import { componentView, diffView, findingView, scanView, showView } from '../core/views.js';
import { createContext, runStdio } from '../mcp/server.js';
import { CLIENTS, clientConfig, type McpClientName } from '../mcp/config.js';
import { createUiServer } from '../ui/server.js';
import { exportUi } from '../ui/export.js';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { scan } from '../core/scan.js';
import { loadScan } from '../core/loadScan.js';
import { login } from '../runtime/session.js';
import { TaveroError } from '../core/errors.js';
import { DEFAULT_VIEWPORTS, type TokenKind } from '../core/types.js';
import { table, pagedFooter, emit, truncate, clampLimit, hintFor } from './format.js';

const pkg = createRequire(import.meta.url)('../../package.json') as { version: string };
const program = new Command();
program
  .name('tavero')
  .description('UI consistency auditor for React apps, built for AI coding agents')
  .version(pkg.version)
  .option('--dir <projectDir>', 'project directory', process.cwd())
  .option('--out <dir>', 'tavero output directory (default <dir>/.tavero)')
  .option('--json', 'machine-readable output', false);

type Global = { dir: string; out?: string; json: boolean };
const g = (): Global => { const o = program.opts<Global>(); return { ...o, dir: resolve(o.dir) }; };
const list = (v?: string) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : undefined);
const fileLine = (c: { file: string | null; line: number | null }) => (c.file ? `${c.file}${c.line ? ':' + c.line : ''}` : '(unresolved)');
/** Views throw neutral errors; the CLI rewords known codes with its own hints. */
const withHint = <T>(fn: () => T, hints: Record<string, string>): T => {
  try { return fn(); } catch (e) {
    const code = (e as { code?: string }).code;
    if (code && hints[code]) throw new TaveroError(code, hints[code], (e as TaveroError).exitCode ?? 1);
    throw e;
  }
};

program
  .command('scan')
  .description('crawl the app and write an inventory to .tavero/scans/<time>/')
  .argument('[dir]', 'project directory (overrides --dir)')
  .requiredOption('--url <url>', 'dev server url, e.g. http://localhost:5173')
  .option('--routes <list>', 'comma-separated routes, overrides discovery')
  .option('--viewports <list>', 'comma-separated viewport names', 'mobile,tablet,desktop')
  .option('--crop <list>', 'always crop these component names')
  .option('--api-origin <url>', 'allow requests to this backend origin (default: any localhost)')
  .option('--keep-raw', 'keep per-page raw JSON', false)
  .option('--rules <list>', 'comma-separated rules to (re)compute: buttons,cards,colors,scales')
  .action(async (dir: string | undefined, o) => {
    const G = g();
    const projectDir = dir ? resolve(dir) : G.dir;
    const names = list(o.viewports) ?? [];
    const viewports = DEFAULT_VIEWPORTS.filter((v) => names.includes(v.name));
    if (!viewports.length) throw new TaveroError('bad-args', `unknown viewports "${o.viewports}"; known: ${DEFAULT_VIEWPORTS.map((v) => v.name).join(', ')}`, 2);
    const res = await scan({ projectDir, url: o.url, routes: list(o.routes), viewports, out: G.out, crop: list(o.crop), apiOrigin: o.apiOrigin ?? null, keepRaw: o.keepRaw, rules: list(o.rules), log: (l) => { if (!G.json) console.log(l); } });
    const s = res.meta.stats;
    const v = scanView(res);
    emit(G, v, () => [
      '',
      `scan written to ${res.dir}`,
      `pages ${s.pages}  components ${s.components} (${s.unresolvedComponents} without file)  instances ${s.instances}  tokens ${s.tokens}`,
      `findings ${s.findings.high} high / ${s.findings.medium} medium / ${s.findings.info} info${res.meta.stale ? `  (stale: ${res.meta.staleRoutes.length} route(s) carried over)` : ''}`,
      ...v.warnings.map((w) => `warning: ${w}`),
      `report: ${join(res.dir, 'report.html')}`,
      'next: tavero findings | tavero finding <id> | tavero context | tavero components',
    ].join('\n'));
  });

program
  .command('findings')
  .description('list findings of the latest scan')
  .option('--rule <rule>', 'buttons|cards|colors|scales')
  .option('--severity <sev>', 'high|medium|info')
  .option('--decision <d>', 'none|fix|reopened (human decisions from tavero ui)')
  .option('--all', 'include findings a human marked accepted', false)
  .option('--limit <n>', 'rows per page', '20')
  .option('--page <n>', 'page number', '1')
  .action(async (o) => {
    const G = g();
    const s = await loadScan(G.dir, G.out);
    const p = s.findings({ rule: o.rule, severity: o.severity, decision: o.decision, includeAccepted: o.all, limit: clampLimit(o.limit), page: Number(o.page) || 1 });
    emit(G, p, () => [
      table(['id', 'sev', 'rule', 'decision', 'title', 'evidence'], p.items.map((f) => [f.id, f.severity, f.rule + (f.preliminary ? '*' : ''), f.decision?.status ?? '', truncate(f.title, 70), String(f.evidenceCount)])),
      pagedFooter(p),
      p.items.some((f) => f.preliminary) ? '* preliminary rule' : '',
    ].filter(Boolean).join('\n'));
  });

program
  .command('finding')
  .description('one finding with its evidence')
  .argument('<id>')
  .option('--evidence <n>', 'evidence rows per page', '20')
  .option('--page <n>', 'evidence page', '1')
  .action(async (id: string, o) => {
    const G = g();
    const s = await loadScan(G.dir, G.out);
    const limit = clampLimit(o.evidence), pg = Number(o.page) || 1;
    const f = withHint(() => findingView(s, id, { evidenceLimit: limit, evidencePage: pg }), { 'unknown-finding': `finding "${id}" not found; list with: tavero findings` });
    emit(G, f, () => [
      `${f.title}  [${f.severity}] ${f.rule}${f.preliminary ? ' (preliminary)' : ''}  ${f.id}`,
      f.summary,
      `stats: ${Object.entries(f.stats).map(([k, v]) => `${k}=${v}`).join('  ')}`,
      `evidence (${f.evidenceTotal}):`,
      table(['value', 'expected', 'component', 'where', 'crop'], f.evidence.map((e) => [truncate(e.value, 60), e.expected ?? '', e.component ?? '', [e.file, e.line].filter(Boolean).join(':') || [e.route, e.viewport].filter(Boolean).join(' @ '), e.crop ?? ''])),
      pagedFooter({ total: f.evidenceTotal, page: pg, limit }),
    ].filter(Boolean).join('\n'));
  });

program
  .command('login')
  .description('open a browser and log in by hand, or pass --email/--password to log in headlessly; saves the session for scans')
  .requiredOption('--url <url>', 'login page url')
  .option('--email <email>', 'fill the email field and submit (headless)')
  .option('--password <password>', 'fill the password field and submit (headless)')
  .action(async (o) => {
    const G = g();
    const p = await login({ url: o.url, outDir: G.out ?? resolve(G.dir, '.tavero'), email: o.email, password: o.password });
    emit(G, { session: p }, () => `session saved to ${p}`);
  });

program
  .command('components')
  .description('list components of the latest scan')
  .option('--sort <by>', 'instances|name', 'instances')
  .option('--limit <n>', 'rows per page', '20')
  .option('--page <n>', 'page number', '1')
  .option('--query <q>', 'filter by name or file')
  .option('--unresolved', 'only components without a file', false)
  .action(async (o) => {
    const G = g();
    const s = await loadScan(G.dir, G.out);
    const p = s.components({ sort: o.sort, limit: clampLimit(o.limit), page: Number(o.page) || 1, query: o.query, unresolvedOnly: o.unresolved });
    emit(G, p, () => [table(['id', 'name', 'instances', 'pages', 'file'], p.items.map((c) => [c.id, c.name, String(c.instances), String(c.pages.length), fileLine(c)])), pagedFooter(p)].filter(Boolean).join('\n'));
  });

program
  .command('component')
  .description('details of one component')
  .argument('<idOrName>')
  .action(async (idOrName: string) => {
    const G = g();
    const s = await loadScan(G.dir, G.out);
    const c = withHint(() => componentView(s, idOrName), { 'unknown-component': `component "${idOrName}" not found; try: tavero components --query ${idOrName}` });
    const byPage = Object.entries(c.instancesByPage);
    const crops = c.crops;
    emit(G, c, () => [
      `${c.name}  ${c.id}`,
      `file:      ${fileLine(c)}  (${c.resolved})`,
      `instances: ${c.instances} on ${c.pages.length} page(s)`,
      `props:     ${c.props.join(', ') || '(none)'}`,
      'pages:',
      ...byPage.map(([r, v]) => `  ${r}  [${v.join(', ')}]`),
      `crops:     ${crops.length} (tavero show ${c.name})`,
    ].join('\n'));
  });

program
  .command('show')
  .description('print crop image paths for a component')
  .argument('<idOrName>')
  .option('--viewport <name>')
  .action(async (idOrName: string, o) => {
    const G = g();
    const s = await loadScan(G.dir, G.out);
    const shown = withHint(() => showView(s, idOrName, o.viewport), { 'unknown-component': `component "${idOrName}" not found` });
    const crops = shown.crops;
    emit(G, shown, () => (crops.length ? crops.join('\n') : `no crops for ${idOrName}${o.viewport ? ' at ' + o.viewport : ''}; rerun scan with --crop ${idOrName}`));
  });

program
  .command('context')
  .description('compact design-system context for an agent (read it before writing new UI)')
  .option('--budget <tokens>', 'approximate token budget', '1500')
  .action(async (o) => {
    const G = g();
    const s = await loadScan(G.dir, G.out);
    const md = s.regenerateContext(Number(o.budget) || 1500);
    emit(G, { markdown: md }, () => md);
  });

program
  .command('report')
  .description('write a self-contained HTML report (report.html) into the latest scan directory')
  .action(async () => {
    const G = g();
    const s = await loadScan(G.dir, G.out);
    const file = join(s.dir, 'report.html');
    await writeFile(file, buildReport(s));
    emit(G, { file }, () => `report written to ${file}`);
  });

program
  .command('mcp')
  .description('run the MCP server on stdio for this project (tools tavero_*), or print a client config')
  .option('--print-config <client>', `print the MCP config for one of: ${CLIENTS.join(', ')}`)
  .action(async (o) => {
    const G = g();
    if (o.printConfig) {
      if (!(CLIENTS as readonly string[]).includes(o.printConfig)) throw new TaveroError('bad-args', `unknown client "${o.printConfig}"; known: ${CLIENTS.join(', ')}`, 2);
      // keep --dir as typed (relative paths suit project-level configs); g() would resolve it
      const dirOpt = program.getOptionValueSource('dir') === 'default' ? undefined : program.opts<Global>().dir;
      const c = clientConfig(o.printConfig as McpClientName, { dir: dirOpt, cwd: process.cwd(), platform: process.platform });
      process.stderr.write(`put this in ${c.file} (merge with servers already there)
`);
      process.stdout.write(c.text);
      return;
    }
    await runStdio(createContext(G.dir, G.out));
  });

program
  .command('ui')
  .description('open the local web panel: triage findings and set decisions agents will see')
  .option('--port <n>', 'port on 127.0.0.1', '4747')
  .option('--open', 'open the browser', false)
  .option('--export <dir>', 'write a static read-only copy of the panel for the latest scan and exit')
  .action(async (o) => {
    const G = g();
    if (o.export) {
      const r = await exportUi({ projectDir: G.dir, out: G.out, dir: resolve(o.export) });
      emit(G, r, () => `exported ${r.pages} pages and ${r.files} crops to ${resolve(o.export)}`);
      return;
    }
    const port = Number(o.port);
    const s = await createUiServer({ projectDir: G.dir, out: G.out, port: Number.isFinite(port) ? port : 4747 }).catch((e: { code?: string; message: string }) => {
      if (e.code === 'EADDRINUSE') throw new TaveroError('port-in-use', `port ${o.port} is busy; pass --port <n>`, 2);
      throw e;
    });
    process.stdout.write(`Tavero panel: ${s.url}\n(Ctrl+C to stop)\n`);
    if (o.open) spawn(process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open', process.platform === 'win32' ? ['/c', 'start', '', s.url] : [s.url], { stdio: 'ignore', detached: true }).unref();
    await new Promise<void>((done) => { process.once('SIGINT', () => { void s.close().then(done); }); });
  });

program
  .command('diff')
  .description('compare two scans (default: previous vs latest)')
  .argument('[from]', 'scan directory name under .tavero/scans')
  .argument('[to]', 'scan directory name under .tavero/scans')
  .action(async (from: string | undefined, to: string | undefined) => {
    const G = g();
    const d = await diffView(G.dir, G.out, from, to).catch((e: { code?: string }) => {
      if (e.code === 'no-previous-scan') throw new TaveroError('no-scan', 'need two scans to diff; run tavero scan again', 2);
      throw e;
    });
    const changed = d.findings.unchanged.filter((u) => Object.keys(u.statsChanged).length).length;
    const head = `diff vs ${d.from}: +${d.findings.new.length} new, -${d.findings.resolved.length} resolved, ${d.findings.unchanged.length} unchanged (${changed} changed stats); components +${d.components.added.length} -${d.components.removed.length}${d.note ? ' — ' + d.note : ''}`;
    const rows = (fs: typeof d.findings.new) => table(['id', 'sev', 'rule', 'title'], fs.map((f) => [f.id, f.severity, f.rule, truncate(f.title, 70)]));
    emit(G, d, () => [
      head,
      d.findings.new.length ? 'new:' : '', d.findings.new.length ? rows(d.findings.new) : '',
      d.findings.resolved.length ? 'resolved:' : '', d.findings.resolved.length ? rows(d.findings.resolved) : '',
    ].filter(Boolean).join('\n'));
  });

program
  .command('tokens')
  .description('list design tokens found in the app')
  .option('--kind <kind>', 'color|radius|spacing|font-size|font-weight|font-family|shadow|other')
  .option('--limit <n>', 'rows per page', '200')
  .option('--page <n>', 'page number', '1')
  .action(async (o) => {
    const G = g();
    const s = await loadScan(G.dir, G.out);
    const p = s.tokens({ kind: o.kind as TokenKind | undefined, limit: clampLimit(o.limit, 200), page: Number(o.page) || 1 });
    emit(G, p, () => [table(['name', 'kind', 'value', 'resolved', 'source'], p.items.map((t) => [t.name, t.kind, truncate(t.value, 28), truncate(t.resolved, 20), 'file' in t.source ? `${t.source.file}:${t.source.line}` : t.source.source])), pagedFooter(p)].filter(Boolean).join('\n'));
  });

program.parseAsync(process.argv).catch((e: unknown) => {
  const err = e as Partial<TaveroError>;
  const message = err.message ?? String(e);
  console.error(`tavero: ${message}`);
  const hint = hintFor(message);
  if (hint) console.error(hint);
  process.exit(typeof err.exitCode === 'number' ? err.exitCode : 1);
});
