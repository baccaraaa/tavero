import type { Evidence, Finding, RuleInput } from '../core/types.js';
import { declared } from './declared.js';
import { deltaE } from './normalize.js';
import { isTailwindDefault } from '../static/tailwind.js';
import { findingId } from './common.js';

const base6 = (hex: string) => hex.slice(0, 7);
/** ΔE2000 below which the nearest token is offered as the fix. */
const CLOSE_TOKEN_DE = 10;
type Cat = 'token' | 'tailwind-default' | 'off-palette' | 'ua-default';
/** Chromium user-agent defaults: text, links (unvisited, visited, active), button face, control borders, placeholder. */
const UA_DEFAULTS = new Set(['#000000', '#0000ee', '#551a8b', '#ee0000', '#efefef', '#f0f0f0', '#767676', '#e9e9ed', '#757575']);

/** Token family = first name segment: --ds-c-green-base → ds. */
const familyOf = (name: string): string => name.replace(/^--/, '').split('-')[0];
const fileOf = (loc: string | null | undefined): string | null => (loc ? loc.replace(/:\d+(:\d+)?$/, '') : null);

type Near = { hex: string; name: string; d: number; why?: string };

function nearest(hex: string, palette: Map<string, string>): Near | null {
  let best: { hex: string; name: string; d: number } | null = null;
  for (const [ph, name] of palette) {
    const d = deltaE(base6(hex), ph);
    if (!best || d < best.d) best = { hex: ph, name, d };
  }
  return best;
}

/**
 * The token to suggest for a color: the nearest one from the token family the color's files already use
 * (when it is close), else the global nearest. Mixing families in one component (a resume-builder token next
 * to dashboard tokens) is a fix an agent should not be steered into.
 */
function suggest(hex: string, files: string[], palette: Map<string, string>, refs: Record<string, string[]> | undefined, global: Near | null): Near | null {
  if (!refs) return global;
  const counts = new Map<string, { n: number; file: string }>();
  for (const f of files) for (const name of refs[f] ?? []) {
    const fam = familyOf(name);
    const c = counts.get(fam) ?? { n: 0, file: f };
    c.n++; counts.set(fam, c);
  }
  for (const [fam, { file }] of [...counts.entries()].sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0]))) {
    const inFamily = new Map([...palette].filter(([, name]) => familyOf(name) === fam));
    const n = nearest(hex, inFamily);
    if (!n || n.d >= CLOSE_TOKEN_DE) continue;
    if (global && n.name === global.name) return global;
    return { ...n, why: `${file} already uses --${fam}-*` };
  }
  return global;
}

/** Spec §11 "colors": off-palette colors, Tailwind defaults, near pairs, hardcoded literals. */
export function colorsRule(input: RuleInput): Finding[] {
  const out: Finding[] = [];
  const d = declared(input.tokens, input.staticInfo);
  // alpha variants (#rrggbbaa) are the same design decision as their base color: one finding per base
  type Group = { base: string; bg: number; color: number; border: number; variants: string[]; examples: Evidence[] };
  const groups = new Map<string, Group>();
  for (const [hex, counts] of Object.entries(input.colors).sort((a, b) => a[0].localeCompare(b[0]))) {
    const base = base6(hex);
    const g = groups.get(base) ?? { base, bg: 0, color: 0, border: 0, variants: [], examples: [] };
    g.bg += counts.bg; g.color += counts.color; g.border += counts.border; g.variants.push(hex);
    const prop = counts.bg ? 'background' : counts.color ? 'text' : 'border';
    for (const e of counts.examples.slice(0, 3)) g.examples.push({ route: e.route, viewport: e.viewport, component: e.component, file: e.file, value: `${prop} ${hex}` });
    groups.set(base, g);
  }
  const used = [...groups.values()].sort((a, b) => (b.bg + b.color + b.border) - (a.bg + a.color + a.border) || a.base.localeCompare(b.base));
  const cats = new Map<string, { cat: Cat; near: ReturnType<typeof nearest> }>();
  for (const g of used) {
    const n = nearest(g.base, d.palette);
    // a browser default is only one when no source writes it and it renders without alpha
    const written = Object.keys(input.staticInfo.hardcodedColors).some((h) => base6(h) === g.base);
    const ua = UA_DEFAULTS.has(g.base) && !written && g.variants.every((v) => v.length === 7);
    const cat: Cat = n && n.d < 2 ? 'token' : ua ? 'ua-default' : isTailwindDefault(g.base) ? 'tailwind-default' : 'off-palette';
    cats.set(g.base, { cat, near: n });
  }
  const offCount = [...cats.values()].filter((c) => c.cat === 'off-palette').length;
  const offSeverity = offCount >= 10 ? 'high' : 'medium';
  for (const g of used) {
    const { cat, near: globalNear } = cats.get(g.base)!;
    const files = [...new Set([...Object.entries(input.staticInfo.hardcodedColors).filter(([h]) => base6(h) === g.base).flatMap(([, ps]) => ps.map((p) => p.file)), ...g.examples.map((e) => fileOf(e.file)).filter((f): f is string => !!f)])];
    const near = suggest(g.base, files, d.palette, input.staticInfo.tokenRefs, globalNear);
    const why = near?.why ? `; ${near.why}` : '';
    const total = g.bg + g.color + g.border;
    const variants = g.variants.length > 1 ? ` (${g.variants.length} alpha variants)` : '';
    // a token is a fix only when it is close; a far one (white for a green button) would mislead an agent
    const close = !!near && near.d < CLOSE_TOKEN_DE;
    const expected = near ? (close ? `${near.name} ${near.hex} (ΔE ${near.d.toFixed(1)}${why})` : `no close token (nearest ${near.name} ${near.hex}, ΔE ${near.d.toFixed(1)}); add a token`) : undefined;
    // where the literal is written comes first: the render rows point at the component, the literal may live in CSS
    // literals are matched by base color: a literal with alpha may be recorded with or without it, and render as another alpha
    const literalRows: Evidence[] = Object.entries(input.staticInfo.hardcodedColors).filter(([hex]) => base6(hex) === g.base).sort().flatMap(([hex, places]) => places.map((p) => ({ file: p.file, line: p.line, value: `literal ${hex} in source`, expected })));
    const evidence: Evidence[] = [...literalRows.slice(0, 5), ...g.examples.map((e) => ({ ...e, expected }))];
    const nearText = near ? (close ? ` Nearest token ${near.name} ${near.hex} (ΔE ${near.d.toFixed(1)}${why}).` : ` No close token: the nearest, ${near.name} ${near.hex}, is ΔE ${near.d.toFixed(1)} away; add a token for this color.`) : '';
    const stats = { bg: g.bg, color: g.color, border: g.border, total, variants: g.variants.length };
    if (cat === 'off-palette') {
      const key = `off:${g.base}`;
      out.push({
        id: findingId('colors', key), rule: 'colors', key, severity: offSeverity,
        title: `Color ${g.base}${variants} is not a project token`,
        summary: `Used ${total} time(s): ${g.bg} background, ${g.color} text, ${g.border} border.${nearText}`,
        stats, evidence,
      });
    } else if (cat === 'tailwind-default' && d.hasOwnColors) {
      const key = `default:${g.base}`;
      const name = isTailwindDefault(g.base);
      out.push({
        id: findingId('colors', key), rule: 'colors', key, severity: 'medium',
        title: `Tailwind default ${name} (${g.base})${variants} used instead of a project token`,
        summary: `Used ${total} time(s). The project declares its own colors; default palette values do not follow the theme.`,
        stats, evidence,
      });
    }
  }
  const nonToken = used.filter((g) => { const c = cats.get(g.base)!.cat; return c !== 'token' && c !== 'ua-default'; });
  for (let i = 0; i < nonToken.length; i++) {
    for (let j = i + 1; j < nonToken.length; j++) {
      const a = nonToken[i], b = nonToken[j];
      const dist = deltaE(a.base, b.base);
      if (dist >= 3) continue;
      const [x, y] = a.base < b.base ? [a, b] : [b, a];
      const key = `near:${x.base}:${y.base}`;
      out.push({
        id: findingId('colors', key), rule: 'colors', key, severity: 'medium',
        title: `${x.base} and ${y.base} are almost the same color (ΔE ${dist.toFixed(1)})`,
        summary: 'Two non-token colors that differ less than the eye can tell; pick one.',
        stats: { deltaE: Number(dist.toFixed(2)) },
        evidence: [...x.examples.slice(0, 2).map((e) => ({ ...e, value: x.base })), ...y.examples.slice(0, 2).map((e) => ({ ...e, value: y.base }))],
      });
    }
  }
  // browser defaults: unstyled elements (a bare <button>, a link without a color) — one info finding, never off-palette
  const uaGroups = used.filter((g) => cats.get(g.base)!.cat === 'ua-default');
  if (uaGroups.length) {
    const total = uaGroups.reduce((n, g) => n + g.bg + g.color + g.border, 0);
    out.push({
      id: findingId('colors', 'ua-defaults'), rule: 'colors', key: 'ua-defaults', severity: 'info',
      title: `${uaGroups.length} browser-default color${uaGroups.length === 1 ? '' : 's'} on unstyled elements`,
      summary: `No source writes ${uaGroups.map((g) => g.base).join(', ')}; the browser paints them on elements without styles (${total} use(s)). Style those elements with project tokens or the shared components.`,
      stats: { colors: uaGroups.length, total },
      evidence: uaGroups.flatMap((g) => g.examples),
    });
  }
  // hardcoded literals: one finding per color that is actually rendered in this scan, plus one project-wide summary
  const rendered = new Set(Object.keys(input.colors).map(base6));
  const literals = Object.entries(input.staticInfo.hardcodedColors).sort();
  let inScope = 0;
  for (const [hex, places] of literals) {
    if (!rendered.has(base6(hex))) continue;
    inScope++;
    const key = `hardcoded:${hex}`;
    const n = nearest(hex, d.palette);
    const expected = n && n.d < 2 ? n.name : undefined;
    out.push({
      id: findingId('colors', key), rule: 'colors', key, severity: 'medium',
      title: `Hardcoded color ${hex} in ${places.length} place(s)`,
      summary: expected ? `Matches token ${expected}; reference the token instead of the literal.` : 'Literal color in source with no matching token.',
      stats: { places: places.length },
      evidence: places.map((p) => ({ file: p.file, line: p.line, value: hex, expected })),
    });
  }
  if (literals.length) {
    const totalPlaces = literals.reduce((n, [, p]) => n + p.length, 0);
    const top = [...literals].sort((a, b) => b[1].length - a[1].length).slice(0, 10);
    out.push({
      id: findingId('colors', 'hardcoded'), rule: 'colors', key: 'hardcoded', severity: 'info',
      title: `${literals.length} hardcoded color literals in ${totalPlaces} place(s) across the project`,
      summary: `${inScope} of them are rendered on the scanned pages and have their own findings; the rest live in code outside this scan.`,
      stats: { colors: literals.length, places: totalPlaces, rendered: inScope },
      evidence: top.map(([hex, places]) => ({ file: places[0].file, line: places[0].line, value: `${hex} × ${places.length}` })),
    });
  }
  return out;
}
