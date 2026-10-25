import { readFile } from 'node:fs/promises';

// .dark / html.dark selectors, [data-theme=dark], the media query, Tailwind 4's @custom-variant dark
const CSS_SIGNS: Array<[RegExp, string]> = [
  [/(^|[\s,>+~(])(?:html|:root)?\.dark\b(?![-\w])/m, '.dark class'],
  [/\[data-(?:theme|mode|color-scheme)=["']?dark["']?\]/, 'data-theme="dark"'],
  [/prefers-color-scheme\s*:\s*dark/, 'prefers-color-scheme: dark'],
  [/@custom-variant\s+dark\b/, 'Tailwind dark variant'],
];

/** Whether the project styles a dark theme, from its CSS entries (with relative @imports) and Tailwind 3 config. */
export async function detectDarkTheme(cssEntries: string[], tailwindConfig: string | null): Promise<{ has: boolean; how: string[] }> {
  const how = new Set<string>();
  for (const file of cssEntries) {
    let text: string;
    try { text = await readFile(file, 'utf8'); } catch { continue; }
    for (const [re, label] of CSS_SIGNS) if (re.test(text)) how.add(label);
  }
  if (tailwindConfig) {
    try { if (/darkMode\s*:/.test(await readFile(tailwindConfig, 'utf8'))) how.add('Tailwind darkMode'); } catch { /* unreadable config */ }
  }
  return { has: how.size > 0, how: [...how] };
}
