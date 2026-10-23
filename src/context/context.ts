import type { Component, Finding, ScaleCounts, ScanMeta, StaticInfo, StyleSample, Token } from '../core/types.js';
import type { CanonicalByRole } from '../core/decisions.js';

const SEV = { high: 0, medium: 1, info: 2 } as const;
const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);

function top(entries: Array<[string, { count: number }]>, n: number): Array<[string, number]> {
  return entries.sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0])).slice(0, n).map(([k, v]) => [k, v.count]);
}

/**
 * Compact design-system context for an agent (spec §13): stack, tokens, canonical
 * components per role, observed conventions, open problems. Shrinks in two steps
 * (fewer tokens, fewer competitors/typography lines) until it fits the budget.
 */
export function buildContext(input: { meta: ScanMeta; components: Component[]; tokens: Token[]; samples: StyleSample[]; findings: Finding[]; scales: ScaleCounts; staticInfo: StaticInfo; budgetTokens?: number; canonical?: CanonicalByRole }): string {
  const budget = (input.budgetTokens ?? 1500) * 4;
  const byId = new Map(input.components.map((c) => [c.id, c]));

  const build = (level: number): string => {
    const lines: string[] = [];
    const tw = input.staticInfo.tailwind.version;
    const tokenFile = input.tokens[0] && 'file' in input.tokens[0].source ? ` declared in ${input.tokens[0].source.file}` : '';
    lines.push('# Design system context', '', '## Stack');
    lines.push(`${input.meta.project.framework === 'vite' ? 'Vite' : 'Next'}, React, ${tw ? `Tailwind ${tw}` : 'no Tailwind'}; tokens are CSS custom properties${tokenFile}. Scan of ${input.meta.stats.pages} page(s), ${input.meta.stats.components} components.`, '');

    if (level < 3) {
      const colors = input.tokens.filter((t) => t.kind === 'color').slice(0, level >= 2 ? 4 : 12);
      const others = (kind: Token['kind'], n: number) => input.tokens.filter((t) => t.kind === kind).slice(0, n);
      lines.push('## Tokens');
      if (colors.length) { lines.push('| token | value |', '|---|---|'); for (const t of colors) lines.push(`| ${t.name} | ${t.resolved} |`); }
      for (const [kind, label] of [['radius', 'Radius'], ['spacing', 'Spacing'], ['font-size', 'Font sizes'], ['font-family', 'Fonts'], ['shadow', 'Shadows']] as const) {
        const list = others(kind, level >= 2 ? 2 : 6);
        if (list.length) lines.push(`${label}: ${list.map((t) => `${t.name}=${t.resolved.replace(/\s+/g, ' ').slice(0, 40)}`).join(', ')}`);
      }
    }

    lines.push('', '## Canonical components');
    for (const [role, label] of [['button-text', 'Action button'], ['button-icon', 'Icon button'], ['card', 'Card']] as const) {
      // a human-chosen canonical (tavero ui) wins over the automatic ranking
      const chosen = input.canonical?.[role];
      if (chosen) {
        lines.push(`${label} is ${chosen.label} from ${chosen.file ?? 'unknown file'}${chosen.allowed.length ? `; also allowed: ${chosen.allowed.join('; ')}.` : '.'}`);
        continue;
      }
      // rank by samples, then by distinct routes. Overlay samples (cookie banners, modals) are skipped: they sit on
      // every page and would win. Routes are only a tie-breaker: shell elements (a topbar button) are also on every
      // route and would beat the real action button if breadth came first.
      const stats = new Map<string, { routes: Set<string>; samples: number }>();
      for (const s of input.samples) {
        if (s.role !== role || !s.componentId || s.inOverlay) continue;
        const st = stats.get(s.componentId) ?? { routes: new Set<string>(), samples: 0 };
        st.routes.add(s.route); st.samples++;
        stats.set(s.componentId, st);
      }
      const ranked = [...stats.entries()].sort((a, b) => b[1].samples - a[1].samples || b[1].routes.size - a[1].routes.size);
      if (!ranked.length) continue;
      const main = byId.get(ranked[0][0]);
      if (!main) continue;
      const rest = ranked.slice(1, level >= 1 ? 2 : 4).map(([id, st]) => { const c = byId.get(id); return c ? `${c.name} from ${c.file} (${st.samples} sample${st.samples === 1 ? '' : 's'} on ${st.routes.size} route${st.routes.size === 1 ? '' : 's'})` : null; }).filter(Boolean);
      lines.push(`${label} is ${main.name} from ${main.file}${main.props.length ? ` (props: ${main.props.join(', ')})` : ''}${rest.length ? `; also seen: ${rest.join('; ')}.` : '.'}`);
    }

    if (level < 3) {
      lines.push('', '## Conventions');
      const radius = top(Object.entries(input.scales.radius), 1);
      const radiusTotal = Object.values(input.scales.radius).reduce((n, e) => n + e.count, 0);
      if (radius.length) lines.push(`Dominant radius ${radius[0][0]}px (${pct(radius[0][1], radiusTotal)}%).`);
      const pad = top(Object.entries(input.scales.padding), 3);
      if (pad.length) lines.push(`Common paddings: ${pad.map(([v]) => `${v}px`).join(', ')}.`);
      const typo = top(Object.entries(input.scales.typography), level >= 2 ? 1 : 4);
      const typoTotal = Object.values(input.scales.typography).reduce((n, e) => n + e.count, 0);
      if (typo.length) lines.push(`Typography: ${typo.map(([k, n]) => { const [s, w, lh] = k.split('/'); return `${s}px/${w}/${lh === 'n' ? 'normal' : lh + 'px'} (${pct(n, typoTotal)}%)`; }).join(', ')}.`);
    }

    lines.push('', '## Open problems');
    for (const rule of ['buttons', 'cards', 'colors', 'scales'] as const) {
      const fs = input.findings.filter((f) => f.rule === rule && f.severity !== 'info');
      if (!fs.length) continue;
      const worst = [...fs].sort((a, b) => SEV[a.severity] - SEV[b.severity])[0];
      lines.push(`${rule}: ${fs.length} finding${fs.length === 1 ? '' : 's'}, worst ${worst.id} (${worst.severity}) ${worst.title}`);
    }
    lines.push('', 'Run `tavero findings` for the list and `tavero finding <id>` for evidence.');
    return lines.join('\n');
  };

  let md = build(0);
  for (let level = 1; level <= 3 && md.length > budget; level++) md = build(level);
  return md;
}
