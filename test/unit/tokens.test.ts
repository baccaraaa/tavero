import { describe, it, expect } from 'vitest';
import { classifyToken, parseColor, findTokenDeclarations, buildTokens } from '../../src/static/tokens.js';
import { makeTmpProject } from '../helpers/tmp.js';

describe('tokens', () => {
  it('parses colors including bare HSL triplets', () => {
    expect(parseColor('#fff')).toBe('#ffffff');
    expect(parseColor('rgb(51, 102, 255)')).toBe('#3366ff');
    expect(parseColor('rgba(0,0,0,0.5)')).toBe('#00000080');
    expect(parseColor('222 47% 11%')).toBe('#0f1729');
    expect(parseColor('12px')).toBeNull();
    expect(parseColor('hsl(var(--x)')).toBeNull();
    expect(parseColor('rgb(')).toBeNull();
    expect(parseColor('0 0% 100%')).toBe('#ffffff');
  });
  it('classifies by name and value', () => {
    expect(classifyToken('--lp-bg', '222 47% 11%')).toBe('color');
    expect(classifyToken('--color-brand', '#36f')).toBe('color');
    expect(classifyToken('--radius', '0.5rem')).toBe('radius');
    expect(classifyToken('--lp-radius', '12px')).toBe('radius');
    expect(classifyToken('--spacing-4', '1rem')).toBe('spacing');
    expect(classifyToken('--font-display', 'Geist, sans-serif')).toBe('font-family');
    expect(classifyToken('--text-lg', '1.125rem')).toBe('font-size');
    expect(classifyToken('--font-weight-bold', '700')).toBe('font-weight');
    expect(classifyToken('--shadow-card', '0 1px 2px rgba(0,0,0,.1)')).toBe('shadow');
    expect(classifyToken('--lp-shadow-card', '220 20% 30%')).toBe('color'); // a shadow *color* stored as an HSL triplet
    expect(classifyToken('--ds-ease-out', 'cubic-bezier(0,0,.2,1)')).toBe('other');
  });
  it('finds first declaration line per variable, following relative @import', async () => {
    const p = makeTmpProject({
      'src/index.css': `@import "./tokens.css";\n@tailwind base;\n:root { --radius: 8px; }\n.dark { --lp-bg: 0 0% 0%; }\n`,
      'src/tokens.css': `:root {\n  --lp-bg: 222 47% 11%;\n  --lp-accent: 221 83% 53%;\n}\n`,
    });
    const map = await findTokenDeclarations([`${p.dir}/src/index.css`], p.dir);
    expect(map.get('--lp-bg')).toEqual({ file: 'src/tokens.css', line: 2 });
    expect(map.get('--lp-accent')).toEqual({ file: 'src/tokens.css', line: 3 });
    expect(map.get('--radius')).toEqual({ file: 'src/index.css', line: 3 });
    p.cleanup();
  });
  it('assembles tokens: dedupe by name, skip --tw-, resolve values, attach sources', () => {
    const decls = [
      { name: '--lp-bg', value: '222 47% 11%', selector: ':root', href: null },
      { name: '--lp-bg', value: '0 0% 100%', selector: '.dark', href: null },
      { name: '--tw-ring-inset', value: ' ', selector: ':root', href: null },
      { name: '--radius', value: '0.5rem', selector: ':root', href: null },
    ];
    const values = { '--lp-bg': '222 47% 11%', '--radius': '0.5rem' };
    const declMap = new Map([['--lp-bg', { file: 'src/tokens.css', line: 2 }]]);
    const tokens = buildTokens(decls, values, declMap);
    expect(tokens.map((t) => t.name)).toEqual(['--lp-bg', '--radius']);
    expect(tokens[0]).toMatchObject({ id: '--lp-bg', kind: 'color', value: '222 47% 11%', resolved: '#0f1729', theme: 'light', source: { file: 'src/tokens.css', line: 2 } });
    expect(tokens[1]).toMatchObject({ kind: 'radius', resolved: '0.5rem', source: { source: 'runtime' } });
  });
});
