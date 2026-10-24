import { readFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import postcss from 'postcss';
import { parse as parseCuloriColor, formatHex, formatHex8 } from 'culori';
import type { RawTokenDecl, Token, TokenKind } from '../core/types.js';

const BARE_HSL = /^\s*(-?[\d.]+)(?:deg)?\s+(-?[\d.]+)%\s+(-?[\d.]+)%\s*$/;
const LENGTH = /^[\d.]+(px|rem|em)$/;

/** Normalize any CSS color (including bare HSL triplets used via hsl(var(--x))) to lowercase hex. */
export function parseColor(value: string): string | null {
  const v = value.trim();
  const m = v.match(BARE_HSL);
  let c;
  try { c = parseCuloriColor(m ? `hsl(${m[1]} ${m[2]}% ${m[3]}%)` : v); }
  catch { return null; } // culori throws on fragments like "hsl(var(--x)"
  if (!c) return null;
  const alpha = c.alpha ?? 1;
  return alpha >= 1 ? formatHex(c) : formatHex8(c);
}

export function classifyToken(name: string, value: string): TokenKind {
  const n = name.toLowerCase();
  const v = value.trim();
  const looksLikeShadow = /^-?[\d.]+(px|rem)?\s+-?[\d.]+(px|rem)?\s+[\d.]+/.test(v) && /rgba?\(|#|hsla?\(/.test(v);
  if ((/shadow/.test(n) && !BARE_HSL.test(v)) || looksLikeShadow) return 'shadow';
  if (/weight/.test(n) || (/font/.test(n) && /^\d{3}$/.test(v))) return 'font-weight';
  if (/font-size|text-|^--text$|size/.test(n) && LENGTH.test(v)) return 'font-size';
  if (/font|family/.test(n) && !/^[\d.]+(px|rem|em)?$/.test(v)) return 'font-family';
  if (/radius|rounded/.test(n)) return 'radius';
  if (/spacing|space|gap|padding|margin|inset/.test(n)) return 'spacing';
  if (parseColor(v)) return 'color';
  if (LENGTH.test(v)) return 'spacing';
  return 'other';
}

export type DeclMap = Map<string, { file: string; line: number; value?: string }>;

const VAR = /var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*(?:\([^()]*\))?[^()]*))?\)/;

/**
 * A source-declared value with var() substituted and a simple calc() (px/rem terms, + and -, × or ÷ by a number)
 * evaluated to px. null when a variable is unknown or the expression is beyond that.
 */
export function resolveStaticValue(value: string, lookup: (name: string) => string | undefined, depth = 0): string | null {
  let v = value.trim();
  for (let m = v.match(VAR); m; m = v.match(VAR)) {
    const sub = lookup(m[1]) ?? m[2]?.trim();
    if (sub === undefined || depth > 8) return null;
    const inner = resolveStaticValue(sub, lookup, depth + 1);
    if (inner === null) return null;
    v = v.replace(m[0], inner);
  }
  const calc = v.match(/^calc\((.*)\)$/);
  if (!calc) return v;
  const terms = calc[1].match(/[+-]?\s*[\d.]+(?:px|rem)?(?:\s*[*/]\s*[\d.]+)?/g);
  if (!terms || terms.join('').replace(/\s/g, '') !== calc[1].replace(/\s/g, '')) return null;
  let px = 0;
  for (const t of terms) {
    const m = t.replace(/\s/g, '').match(/^([+-]?)([\d.]+)(px|rem)?(?:([*/])([\d.]+))?$/);
    if (!m) return null;
    let n = Number(m[2]) * (m[3] === 'rem' ? 16 : 1);
    if (m[4] === '*') n *= Number(m[5]);
    if (m[4] === '/') n /= Number(m[5]);
    px += m[1] === '-' ? -n : n;
  }
  return `${Math.round(px * 100) / 100}px`;
}

/** First declaration (file:line, value) of every CSS custom property reachable from the entries via relative @import. */
export async function findTokenDeclarations(cssEntries: string[], projectDir: string): Promise<DeclMap> {
  const map: DeclMap = new Map();
  const seen = new Set<string>();
  async function visit(file: string): Promise<void> {
    if (seen.has(file)) return;
    seen.add(file);
    let text: string;
    try { text = await readFile(file, 'utf8'); } catch { return; }
    let root: postcss.Root;
    try { root = postcss.parse(text, { from: file }); } catch { return; }
    const rel = relative(projectDir, file).replace(/\\/g, '/');
    const imports: string[] = [];
    root.walkAtRules('import', (rule) => {
      const m = rule.params.match(/^\s*(?:url\()?["']?([^"')]+)["']?\)?/);
      if (m && /^\.{1,2}\//.test(m[1])) imports.push(join(dirname(file), m[1]));
    });
    // @import comes first in the cascade, so imported files declare "first"
    for (const imp of imports) await visit(imp);
    root.walkDecls((decl) => {
      if (!decl.prop.startsWith('--') || map.has(decl.prop)) return;
      map.set(decl.prop, { file: rel, line: decl.source?.start?.line ?? 0, value: decl.value });
    });
  }
  for (const entry of cssEntries) await visit(entry);
  return map;
}

export function buildTokens(decls: RawTokenDecl[], values: Record<string, string>, declMap: DeclMap): Token[] {
  const out: Token[] = [];
  const seen = new Set<string>();
  for (const d of decls) {
    if (seen.has(d.name) || d.name.startsWith('--tw-')) continue;
    seen.add(d.name);
    const kind = classifyToken(d.name, d.value);
    const runtimeValue = values[d.name] ?? d.value;
    const resolved = kind === 'color' ? (parseColor(runtimeValue) ?? runtimeValue) : runtimeValue;
    const src = declMap.get(d.name);
    out.push({ id: d.name, name: d.name, kind, value: d.value, resolved, theme: 'light', source: src ? { file: src.file, line: src.line } : { source: 'runtime' } });
  }
  // declared in source but absent at runtime: Tailwind 4 inlines @theme inline values into its utilities
  const lookup = (name: string) => values[name] ?? declMap.get(name)?.value;
  for (const [name, src] of declMap) {
    if (seen.has(name) || name.startsWith('--tw-') || src.value === undefined) continue;
    const resolved = resolveStaticValue(src.value, lookup);
    if (resolved === null) continue;
    seen.add(name);
    const kind = classifyToken(name, resolved);
    out.push({ id: name, name, kind, value: src.value, resolved: kind === 'color' ? (parseColor(resolved) ?? resolved) : resolved, theme: 'light', source: { file: src.file, line: src.line } });
  }
  return out;
}
