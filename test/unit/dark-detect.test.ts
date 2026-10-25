import { describe, it, expect } from 'vitest';
import { detectDarkTheme } from '../../src/static/darkTheme.js';
import { makeTmpProject } from '../helpers/tmp.js';

describe('detectDarkTheme', () => {
  it('finds class, data-attribute and media-query dark themes in CSS', async () => {
    const p = makeTmpProject({
      'a.css': ':root { --bg: #fff; }\n.dark { --bg: #000; }\n',
      'b.css': '[data-theme="dark"] { --bg: #000; }\n',
      'c.css': '@media (prefers-color-scheme: dark) { :root { --bg: #000; } }\n',
      'd.css': '@import "tailwindcss";\n@custom-variant dark (&:is(.dark *));\n',
      'e.css': ':root { --bg: #fff; }\n.darker-text { color: #333; }\n',
    });
    for (const f of ['a', 'b', 'c', 'd']) expect((await detectDarkTheme([`${p.dir}/${f}.css`], null)).has, f).toBe(true);
    expect((await detectDarkTheme([`${p.dir}/e.css`], null)).has).toBe(false);
    p.cleanup();
  });
  it('finds darkMode in a Tailwind 3 config', async () => {
    const p = makeTmpProject({ 'tailwind.config.js': "module.exports = { darkMode: 'class', content: [] };\n", 'x.css': '@tailwind base;\n' });
    expect((await detectDarkTheme([`${p.dir}/x.css`], `${p.dir}/tailwind.config.js`)).has).toBe(true);
    p.cleanup();
  });
});
