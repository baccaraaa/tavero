import { copyFileSync, mkdirSync } from 'node:fs';
// files tsc does not emit: the in-page collector (plain JS read as text), the Tailwind palette (required at runtime),
// and the panel's assets (shared design tokens and self-hosted fonts). With --ui-only, only the panel assets are
// copied next to the sources so tests and tsx runs serve them too.
const uiOnly = process.argv.includes('--ui-only');
const FONTS = [
  ['@fontsource/onest', 'onest-latin-400-normal.woff2'], ['@fontsource/onest', 'onest-latin-500-normal.woff2'], ['@fontsource/onest', 'onest-latin-600-normal.woff2'],
  ['@fontsource/ibm-plex-mono', 'ibm-plex-mono-latin-400-normal.woff2'], ['@fontsource/ibm-plex-mono', 'ibm-plex-mono-latin-500-normal.woff2'],
];
function uiAssets(dir) {
  mkdirSync(`${dir}/fonts`, { recursive: true });
  copyFileSync('design/tokens.css', `${dir}/tokens.css`);
  for (const [pkg, f] of FONTS) copyFileSync(`node_modules/${pkg}/files/${f}`, `${dir}/fonts/${f}`);
}
uiAssets('src/ui');
if (!uiOnly) {
  mkdirSync('dist/runtime/page', { recursive: true });
  copyFileSync('src/runtime/page/inspect.browser.js', 'dist/runtime/page/inspect.browser.js');
  mkdirSync('dist/rules', { recursive: true });
  copyFileSync('src/rules/tailwind-palette.json', 'dist/rules/tailwind-palette.json');
  mkdirSync('dist/ui', { recursive: true });
  copyFileSync('src/ui/client.js', 'dist/ui/client.js');
  copyFileSync('src/ui/style.css', 'dist/ui/style.css');
  uiAssets('dist/ui');
}
console.log(uiOnly ? 'copied panel assets into src/ui' : 'copied inspect.browser.js, tailwind-palette.json, ui assets');
