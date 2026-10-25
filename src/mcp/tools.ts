import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { loadScan } from '../core/loadScan.js';
import { componentView, diffView, findingView, scanView, showView } from '../core/views.js';
import { scan } from '../core/scan.js';
import { TaveroError } from '../core/errors.js';
import { DEFAULT_VIEWPORTS } from '../core/types.js';
import { hintFor } from '../cli/format.js';

export const RULES = ['buttons', 'cards', 'colors', 'scales'] as const;
export const SEVERITIES = ['high', 'medium', 'info'] as const;
export const TOKEN_KINDS = ['color', 'radius', 'spacing', 'font-size', 'font-weight', 'font-family', 'shadow', 'other'] as const;
export const VIEWPORTS = ['mobile', 'tablet', 'desktop'] as const;

export interface ToolContext { projectDir: string; out?: string; state: { scanning: boolean; devServers: Map<string, () => void> } }
export interface ToolExtra { signal: AbortSignal; progress: (done: number, total: number | null, message: string) => Promise<void> }
export type ToolOutput = { data: object; next: string } | { text: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ToolDef { name: string; title: string; description: string; input: z.ZodRawShape; run: (args: any, ctx: ToolContext, extra: ToolExtra) => Promise<ToolOutput> }

const limit = z.number().int().min(1).max(200).optional().describe('rows per page (default 20, max 200)');
const page = z.number().int().min(1).optional().describe('page number, from 1');
const load = (ctx: ToolContext) => loadScan(ctx.projectDir, ctx.out);

export const TOOLS: ToolDef[] = [
  {
    name: 'tavero_context', title: 'Design-system brief',
    description: 'Compact Markdown brief of this React app\'s design system: stack, tokens, the canonical button/icon-button/card components with files and props, dominant radius/spacing/typography, and open problems. Call it BEFORE writing or changing UI, then reuse the components and tokens it names instead of inventing styles.',
    input: { budget: z.number().int().min(200).max(8000).optional().describe('approximate token budget, default 1500') },
    run: async (a, ctx) => ({ text: `${(await load(ctx)).regenerateContext(a.budget ?? 1500)}\n\nnext: tavero_findings lists the open consistency problems.` }),
  },
  {
    name: 'tavero_findings', title: 'List findings',
    description: 'UI consistency problems of the latest scan, worst first: distinct button and card styles, colors outside the tokens, Tailwind defaults, hardcoded literals, off-scale radius/spacing/typography. Each row has a stable id, severity, rule, title and evidence count; evidence is not included. Filter by rule or severity; paginate with limit/page. Open one with tavero_finding. A human may have triaged findings in the Tavero panel: `decision.status` fix means confirmed work (listed first), findings marked accepted are hidden, `decision.note` is a message to you.',
    input: { rule: z.enum(RULES).optional(), severity: z.enum(SEVERITIES).optional(), decision: z.enum(['none', 'fix', 'reopened']).optional().describe('human decision; fix = a human confirmed it'), includeAccepted: z.boolean().optional().describe('also list findings a human marked as intended'), limit, page },
    run: async (a, ctx) => {
      const p = (await load(ctx)).findings({ rule: a.rule, severity: a.severity, decision: a.decision, includeAccepted: a.includeAccepted, limit: a.limit ?? 20, page: a.page ?? 1 });
      return { data: p, next: p.items.length ? `open one with tavero_finding {"id": "${p.items[0].id}"}` : 'no findings match these filters' };
    },
  },
  {
    name: 'tavero_finding', title: 'One finding with evidence',
    description: 'One finding with paged evidence rows: current value, `expected` (the project token or canonical component to use instead, or a note that no close token exists and one should be added), component, file:line, route/viewport and a crop image path. Rows valued "literal … in source" are where the value is written (often CSS); the other rows are where it renders (the component JSX). Fix the code using `expected`, then rescan only the affected routes with tavero_scan (routes + rules) and confirm with tavero_diff.',
    input: { id: z.string().describe('finding id from tavero_findings, e.g. f_2d0ccc6aa1'), evidenceLimit: limit, evidencePage: page },
    run: async (a, ctx) => {
      const s = await load(ctx);
      const f = findingView(s, a.id, { evidenceLimit: a.evidenceLimit ?? 20, evidencePage: a.evidencePage ?? 1 });
      const routes = [...new Set(f.evidence.map((e) => e.route).filter((r): r is string => !!r))].slice(0, 5);
      const call = { url: s.meta.url, ...(routes.length ? { routes } : {}), rules: [f.rule] };
      return { data: f, next: `after fixing, rescan: tavero_scan ${JSON.stringify(call)}; then tavero_diff` };
    },
  },
  {
    name: 'tavero_components', title: 'List components',
    description: 'React components seen in the latest scan with instance counts, pages and source file:line. Search by name or file with `query`; sort by instances (default) or name; `unresolved` lists components without a source file.',
    input: { query: z.string().optional(), sort: z.enum(['instances', 'name']).optional(), unresolved: z.boolean().optional(), limit, page },
    run: async (a, ctx) => {
      const p = (await load(ctx)).components({ query: a.query, sort: a.sort, unresolvedOnly: a.unresolved, limit: a.limit ?? 20, page: a.page ?? 1 });
      return { data: p, next: p.items.length ? `details with tavero_component {"idOrName": "${p.items[0].name}"}` : 'nothing matches; try a shorter query' };
    },
  },
  {
    name: 'tavero_component', title: 'Component details',
    description: 'One component by id or name: source file:line, prop names, instance count, which pages and viewports render it, and crop image paths.',
    input: { idOrName: z.string() },
    run: async (a, ctx) => ({ data: componentView(await load(ctx), a.idOrName), next: 'crop images per viewport with tavero_show' }),
  },
  {
    name: 'tavero_show', title: 'Crop image paths',
    description: 'Absolute paths of PNG crops showing how a component actually renders, optionally for one viewport. Open them with your image/file reader to see the component.',
    input: { idOrName: z.string(), viewport: z.enum(VIEWPORTS).optional() },
    run: async (a, ctx) => {
      const v = showView(await load(ctx), a.idOrName, a.viewport);
      return { data: v, next: v.crops.length ? 'open a path with your image reader' : 'no crops: scans crop the most used components per page only' };
    },
  },
  {
    name: 'tavero_tokens', title: 'Design tokens',
    description: 'Design tokens found in the app (CSS custom properties and Tailwind theme): name, kind, raw and resolved value, source file:line. Use these names instead of literal colors and sizes.',
    input: { kind: z.enum(TOKEN_KINDS).optional(), limit: z.number().int().min(1).max(200).optional().describe('rows per page (default 200)'), page },
    run: async (a, ctx) => ({ data: (await load(ctx)).tokens({ kind: a.kind, limit: a.limit ?? 200, page: a.page ?? 1 }), next: 'reference tokens by name in code' }),
  },
  {
    name: 'tavero_diff', title: 'Diff two scans',
    description: 'Findings that are new, resolved or unchanged (with changed stats) between the previous and the latest scan, by stable id. A finding is fixed when it is listed under resolved. After a partial rescan, `note` says how many routes were not rescanned and may still carry the finding.',
    input: { from: z.string().optional().describe('older scan folder name; default: the one before `to`'), to: z.string().optional().describe('newer scan folder name; default: latest') },
    run: async (a, ctx) => {
      const d = await diffView(ctx.projectDir, ctx.out, a.from, a.to);
      return { data: d, next: d.findings.resolved.length ? `${d.findings.resolved.length} finding(s) resolved${d.note ? '; ' + d.note : ''}` : 'nothing resolved yet; recheck with tavero_finding' };
    },
  },
  {
    name: 'tavero_scan', title: 'Scan the running app',
    description: 'Crawl the app in a real browser at mobile/tablet/desktop widths (plus one dark-theme pass at desktop width when the project styles a dark theme), map every element to its React component and file:line, and recompute findings. A full scan takes minutes; after a code fix pass only the affected `routes` and the finding\'s `rules` (seconds) — findings on other routes are carried over. Needs the dev server url (it is started with `npm run dev` if nothing answers and kept running for later scans). Then call tavero_diff.',
    input: {
      url: z.string().url().describe('dev server url, e.g. http://localhost:5173'),
      routes: z.array(z.string().startsWith('/')).min(1).optional().describe('only these routes; omit for all routes'),
      rules: z.array(z.enum(RULES)).min(1).optional().describe('recompute only these rules'),
      viewports: z.array(z.enum(VIEWPORTS)).min(1).optional().describe('default: all three'),
    },
    run: async (a, ctx, extra) => {
      if (ctx.state.scanning) throw new TaveroError('scan-running', 'a scan is already running', 1);
      ctx.state.scanning = true;
      try {
        const res = await scan({
          projectDir: ctx.projectDir, out: ctx.out, url: a.url, routes: a.routes, rules: a.rules,
          viewports: a.viewports ? DEFAULT_VIEWPORTS.filter((v) => (a.viewports as string[]).includes(v.name)) : undefined,
          keepDevServer: true, signal: extra.signal,
          log: (line) => process.stderr.write(line + '\n'),
          onPage: (p) => { void extra.progress(p.done, p.total, p.line); },
        });
        if (res.devServer.launched) ctx.state.devServers.set(new URL(a.url).origin, res.devServer.stop);
        const v = scanView(res);
        return { data: v, next: v.diff ? 'see what changed with tavero_diff' : 'see open problems with tavero_findings' };
      } finally {
        ctx.state.scanning = false;
      }
    },
  },
];

const HINTS: Record<string, string> = {
  'no-scan': 'No scan yet; call tavero_scan with the dev server url first.',
  'unknown-finding': 'Unknown finding id; list ids with tavero_findings.',
  'unknown-component': 'Unknown component; search with tavero_components {"query": "..."}.',
  'no-previous-scan': 'Need two scans to diff; call tavero_scan again first.',
  'scan-running': 'A scan is already running; wait for it to finish.',
  'cancelled': 'The scan was cancelled; nothing was written.',
};

export function toResult(out: ToolOutput): CallToolResult {
  if ('text' in out) return { content: [{ type: 'text', text: out.text }] };
  const body = { ...out.data, next: out.next } as Record<string, unknown>;
  return { content: [{ type: 'text', text: JSON.stringify(body, null, 2) }], structuredContent: body };
}

export function errorResult(e: unknown): CallToolResult {
  const err = e as { code?: string; message?: string };
  const message = err.message ?? String(e);
  const hint = (err.code && HINTS[err.code]) ?? hintFor(message);
  return { isError: true, content: [{ type: 'text', text: hint ? `${hint} (${message})` : message }] };
}
