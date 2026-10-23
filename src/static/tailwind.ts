import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import type { ProjectInfo, TailwindTheme } from '../core/types.js';
import { parseColor } from './tokens.js';

export type { TailwindTheme };

/**
 * Runs a CommonJS config file (`module.exports = …`) ourselves. Plain Node treats a `.js` file inside a
 * `"type": "module"` package as ESM even through require(), so such configs fail to load outside tsx.
 */
export function evalCommonJs(code: string, file: string): unknown {
  const filename = resolve(file);
  const mod = { exports: {} as unknown };
  const req = createRequire(filename);
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  new Function('module', 'exports', 'require', '__filename', '__dirname', code)(mod, mod.exports, req, filename, dirname(filename));
  return mod.exports;
}

const palette = createRequire(import.meta.url)('../rules/tailwind-palette.json') as { v3: Record<string, string>; v4: Record<string, string> };
const byHex = new Map<string, string>();
// only hue-shade entries (blue-500); black/white/transparent are universal, not "Tailwind defaults"
for (const gen of [palette.v3, palette.v4]) for (const [name, hex] of Object.entries(gen)) if (/-\d+$/.test(name) && !byHex.has(hex)) byHex.set(hex, name);

/** Name of the Tailwind default hue-shade color matching this hex exactly, or null. */
export function isTailwindDefault(hex: string): string | null {
  return byHex.get(hex.toLowerCase()) ?? null;
}

function flattenColors(obj: unknown, prefix: string, out: Record<string, string>): void {
  if (typeof obj === 'string') { const h = parseColor(obj); if (h) out[prefix] = h; return; }
  if (obj && typeof obj === 'object') for (const [k, v] of Object.entries(obj as Record<string, unknown>)) flattenColors(v, prefix ? `${prefix}-${k}` : k, out);
}
const values = (obj: unknown): string[] => (obj && typeof obj === 'object' ? Object.values(obj as Record<string, unknown>).map((v) => (Array.isArray(v) ? String(v[0]) : String(v))) : []);

/** Tailwind major version from the project's node_modules; for v3 a best-effort resolved theme. */
export async function detectTailwind(project: ProjectInfo): Promise<{ version: 3 | 4 | null; theme: TailwindTheme | null; warnings: string[] }> {
  const warnings: string[] = [];
  let version: 3 | 4 | null = null;
  try {
    const pkg = JSON.parse(await readFile(join(project.dir, 'node_modules', 'tailwindcss', 'package.json'), 'utf8')) as { version: string };
    const major = Number(pkg.version.split('.')[0]);
    version = major >= 4 ? 4 : major === 3 ? 3 : null;
  } catch { return { version: null, theme: null, warnings }; }
  if (version !== 3 || !project.tailwindConfig) return { version, theme: null, warnings };
  try {
    const require = createRequire(join(project.dir, 'package.json'));
    const resolveConfig = require('tailwindcss/resolveConfig') as (c: unknown) => { theme: Record<string, unknown> };
    let cfg: unknown;
    try {
      const mod = (await import(pathToFileURL(project.tailwindConfig).href)) as { default?: unknown };
      cfg = mod.default ?? mod;
    } catch {
      // a CommonJS config inside a "type": "module" package cannot be imported (nor required by plain Node); run it as CommonJS
      cfg = evalCommonJs(readFileSync(project.tailwindConfig, 'utf8'), project.tailwindConfig);
    }
    const theme = resolveConfig(cfg).theme;
    const colors: Record<string, string> = {};
    flattenColors(theme.colors, '', colors);
    return { version, theme: { colors, radius: values(theme.borderRadius), spacing: values(theme.spacing), fontSize: values(theme.fontSize), shadow: values(theme.boxShadow) }, warnings };
  } catch (e) {
    warnings.push(`tailwind config could not be resolved (${String((e as Error).message).slice(0, 120)}); using runtime tokens and default scales only`);
    return { version, theme: null, warnings };
  }
}
