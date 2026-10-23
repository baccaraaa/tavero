// Usage: node scripts/gen-tailwind-palette.mjs <path-to-tailwindcss-v3-package> <path-to-tailwindcss-v4-package>
// Reads v3 `colors.js` and v4 `theme.css`, writes src/rules/tailwind-palette.json with lowercase hex values.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parse, formatHex } from 'culori';

const [v3dir, v4dir] = process.argv.slice(2);
if (!v3dir || !v4dir) { console.error('usage: node scripts/gen-tailwind-palette.mjs <tailwind-v3-dir> <tailwind-v4-dir>'); process.exit(2); }
const require = createRequire(import.meta.url);
const out = { v3: {}, v4: {} };
const v3 = require(resolve(v3dir, 'colors'));
for (const [name, val] of Object.entries(v3)) {
  if (typeof val === 'string') { const c = parse(val); if (c) out.v3[name] = formatHex(c); }
  else if (val && typeof val === 'object') for (const [shade, hex] of Object.entries(val)) { const c = parse(hex); if (c) out.v3[`${name}-${shade}`] = formatHex(c); }
}
const css = readFileSync(join(resolve(v4dir), 'theme.css'), 'utf8');
for (const m of css.matchAll(/--color-([a-z]+(?:-[0-9]+)?):\s*([^;]+);/g)) { const c = parse(m[2].trim()); if (c) out.v4[m[1]] = formatHex(c); }
writeFileSync('src/rules/tailwind-palette.json', JSON.stringify(out, null, 1));
console.log(`v3 ${Object.keys(out.v3).length} colors, v4 ${Object.keys(out.v4).length} colors`);
