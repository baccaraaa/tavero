import type { AttributedElement, AttributedInstance, ColorCounts, CountEntry, CountExample, NormalizedStyles, PageInstance, PageRecord, RawTokenDecl, Role, RouteStatus, ScaleCounts, StyleSample, Viewport } from '../types.js';
import { SCALE_PROPS } from '../types.js';
import { componentId, hashId, instanceId } from '../ids.js';
import { normalizeStyles } from '../../rules/normalize.js';
import { classifyRole } from '../../rules/roles.js';

const MAX_EXAMPLES = 5;

function bump(map: Record<string, CountEntry>, key: string, ex: CountExample): void {
  const e = map[key] ?? (map[key] = { count: 0, examples: [] });
  e.count++;
  if (e.examples.length < MAX_EXAMPLES) e.examples.push(ex);
}

function bumpColor(colors: ColorCounts, hex: string, prop: 'bg' | 'color' | 'border', ex: CountExample): void {
  const c = colors[hex] ?? (colors[hex] = { bg: 0, color: 0, border: 0, examples: [] });
  c[prop]++;
  if (c.examples.length < MAX_EXAMPLES) c.examples.push(ex);
}

function inside(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean {
  return a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h && a.w * a.h < b.w * b.h;
}

export function emptyScales(): ScaleCounts {
  return Object.fromEntries([...SCALE_PROPS, 'typography'].map((k) => [k, {}])) as ScaleCounts;
}

const fileOf = (loc: string | null) => (loc ? loc.replace(/:\d+:\d+$/, '') : null);
const lineOf = (loc: string | null) => { const m = loc?.match(/:(\d+):\d+$/); return m ? Number(m[1]) : null; };

/** One crawled page → its record: instances with ids, role samples, color and scale counts. Pure. */
export function derivePage(input: {
  route: string; viewport: Viewport; status: RouteStatus; reason?: string; docSize: [number, number];
  elements: AttributedElement[]; instances: AttributedInstance[]; crops: Map<string, string>; links: string[];
  tokens?: { decls: RawTokenDecl[]; values: Record<string, string> };
}): PageRecord {
  const { route, viewport } = input;
  const vp = viewport.name;
  const ordinals = new Map<string, number>();
  const instances: PageInstance[] = input.instances.map((inst) => {
    const cid = componentId(inst.file, inst.name);
    const ord = ordinals.get(cid) ?? 0;
    ordinals.set(cid, ord + 1);
    return { id: instanceId(route, vp, cid, ord), componentId: cid, route, viewport: vp, rect: inst.rect, hosts: inst.hosts, crop: input.crops.get(inst.key), key: inst.key, name: inst.name, file: inst.file, line: inst.line, resolved: inst.resolved, props: inst.props };
  });
  const byKey = new Map(instances.map((i) => [i.key, i]));

  const samples: StyleSample[] = [];
  const colors: ColorCounts = {};
  const scales = emptyScales();
  const roleOrdinal = new Map<Role, number>();

  for (const el of input.elements) {
    // React rendered it but no app component owns it (devtools toggles, third-party widgets): nothing to fix in the app
    if (el.f && !el.a) continue;
    // outside React entirely: only the page itself counts; the rest was mounted by another framework or a script
    if (!el.f && el.t !== 'body' && el.t !== 'html') continue;
    // entirely above or left of the page, e.g. a skip link waiting for focus
    if (el.r[1] + el.r[3] <= 0 || el.r[0] + el.r[2] <= 0) continue;
    const n: NormalizedStyles = normalizeStyles(el.styles);
    const inst = el.aid ? byKey.get(el.aid) : undefined;
    const ex: CountExample = { route, viewport: vp, component: el.a, file: el.al };
    const isText = el.text !== '';

    if (n.bg) bumpColor(colors, n.bg, 'bg', ex);
    if (isText && n.color) bumpColor(colors, n.color, 'color', ex);
    if (n.borderWidth > 0 && n.borderColor) bumpColor(colors, n.borderColor, 'border', ex);
    for (const r of new Set(n.radius)) if (r > 0) bump(scales.radius, String(r), ex);
    for (const p of new Set(n.padding)) if (p > 0) bump(scales.padding, String(p), ex);
    if (n.gap > 0) bump(scales.gap, String(n.gap), ex);
    if (isText) {
      bump(scales.fontSize, String(n.fontSize), ex);
      bump(scales.fontWeight, String(n.fontWeight), ex);
      bump(scales.typography, `${n.fontSize}/${n.fontWeight}/${n.lineHeight ?? 'n'}`, ex);
    }
    if (n.shadow !== 'none') bump(scales.shadow, n.shadow, ex);

    const role = classifyRole(el, n, viewport);
    if (!role) continue;
    const ord = roleOrdinal.get(role) ?? 0;
    roleOrdinal.set(role, ord + 1);
    samples.push({
      id: hashId('s', `${route}|${vp}|${role}|${ord}`),
      route, viewport: vp, role,
      componentId: inst?.componentId ?? (el.a ? componentId(fileOf(el.al), el.a) : null),
      componentName: el.a,
      file: fileOf(el.al),
      line: lineOf(el.al),
      hops: el.ah,
      rect: { x: el.r[0], y: el.r[1], w: el.r[2], h: el.r[3] },
      text: el.text, styles: n, parentBg: el.parentBg, children: el.children, nested: false, inOverlay: el.inOverlay,
    });
  }
  const cards = samples.filter((s) => s.role === 'card');
  for (const c of cards) c.nested = cards.some((o) => o !== c && inside(c.rect, o.rect));

  return { route, viewport: vp, status: input.status, reason: input.reason, docSize: input.docSize, crawledAt: new Date().toISOString(), links: input.links, instances, samples, colors, scales, tokens: input.tokens };
}
