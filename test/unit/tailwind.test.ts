import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { evalCommonJs, detectTailwind, isTailwindDefault } from '../../src/static/tailwind.js';
import { join } from 'node:path';
import { makeTmpProject } from '../helpers/tmp.js';
import { detectProject } from '../../src/project/detect.js';

const palette = createRequire(import.meta.url)('../../src/rules/tailwind-palette.json') as { v3: Record<string, string>; v4: Record<string, string> };

describe('tailwind', () => {
  it('palette has both generations', () => {
    expect(palette.v3['blue-500']).toBe('#3b82f6');
    expect(palette.v4['blue-500']).toBe('#2b7fff');
    expect(isTailwindDefault('#3b82f6')).toBe('blue-500');
    expect(isTailwindDefault('#2b7fff')).toBe('blue-500');
    expect(isTailwindDefault('#3366ff')).toBeNull();
  });
  it('reads version and a plain v3 config theme (best effort)', async () => {
    const p = makeTmpProject({
      'package.json': JSON.stringify({ dependencies: { vite: '5' } }),
      'node_modules/tailwindcss/package.json': JSON.stringify({ name: 'tailwindcss', version: '3.4.17' }),
      'node_modules/tailwindcss/resolveConfig.js': 'module.exports = (c) => ({ theme: { colors: { brand: { 500: "#3366ff" }, white: "#fff" }, borderRadius: { lg: "0.5rem", full: "9999px" }, spacing: { 1: "0.25rem" }, fontSize: { base: ["1rem", { lineHeight: "1.5rem" }] }, boxShadow: { sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)" } } });',
      'tailwind.config.js': 'module.exports = { theme: { extend: {} } };',
      'src/x.tsx': '',
    });
    const project = await detectProject(p.dir);
    const tw = await detectTailwind(project);
    expect(tw.version).toBe(3);
    expect(tw.theme).toEqual({ colors: { 'brand-500': '#3366ff', white: '#ffffff' }, radius: ['0.5rem', '9999px'], spacing: ['0.25rem'], fontSize: ['1rem'], shadow: ['0 1px 2px 0 rgb(0 0 0 / 0.05)'] });
    p.cleanup();
  });
  it('falls back to require for a CommonJS config inside a "type": "module" package', async () => {
    const p = makeTmpProject({
      'package.json': JSON.stringify({ type: 'module', dependencies: { vite: '5' } }),
      'node_modules/tailwindcss/package.json': JSON.stringify({ name: 'tailwindcss', version: '3.4.17' }),
      'node_modules/tailwindcss/resolveConfig.js': 'module.exports = (c) => ({ theme: { colors: c.theme.extend.colors, borderRadius: {}, spacing: {}, fontSize: {}, boxShadow: {} } });',
      'tailwind.config.js': 'module.exports = { theme: { extend: { colors: { lp: "#2d4deb" } } } };',
      'src/x.tsx': '',
    });
    const tw = await detectTailwind(await detectProject(p.dir));
    expect(tw.warnings).toEqual([]);
    expect(tw.theme?.colors).toEqual({ lp: '#2d4deb' });
    p.cleanup();
  });
  it('evaluates a CommonJS config itself, with require and __dirname, without Node treating it as ESM', () => {
    const p = makeTmpProject({ 'plugins/brand.cjs': 'module.exports = { brand: "#3366ff" };' });
    const file = join(p.dir, 'tailwind.config.js');
    const cfg = evalCommonJs('const b = require("./plugins/brand.cjs"); module.exports = { dir: __dirname, theme: { extend: { colors: b } } };', file) as { dir: string; theme: { extend: { colors: Record<string, string> } } };
    expect(cfg.theme.extend.colors).toEqual({ brand: '#3366ff' });
    expect(cfg.dir).toBe(p.dir);
    p.cleanup();
  });
  it('v4 reports version only; no tailwind reports null', async () => {
    const p = makeTmpProject({ 'package.json': JSON.stringify({ dependencies: { vite: '5' } }), 'node_modules/tailwindcss/package.json': JSON.stringify({ version: '4.1.0' }), 'src/x.tsx': '' });
    expect((await detectTailwind(await detectProject(p.dir))).version).toBe(4);
    p.cleanup();
    const q = makeTmpProject({ 'package.json': JSON.stringify({ dependencies: { vite: '5' } }), 'src/x.tsx': '' });
    expect((await detectTailwind(await detectProject(q.dir))).version).toBeNull();
    q.cleanup();
  });
});
