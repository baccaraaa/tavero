import { describe, it, expect } from 'vitest';
import { declared, toPx } from '../../src/rules/declared.js';
import type { StaticInfo, Token } from '../../src/core/types.js';

const tok = (name: string, kind: Token['kind'], value: string, resolved = value): Token => ({ id: name, name, kind, value, resolved, theme: 'light', source: { source: 'runtime' } });
const noStatic: StaticInfo = { tailwind: { version: null, theme: null }, hardcodedColors: {}, warnings: [] };

describe('declared', () => {
  it('toPx', () => {
    expect(toPx('12px')).toBe(12);
    expect(toPx('0.5rem')).toBe(8);
    expect(toPx('1.125rem')).toBe(18);
    expect(toPx('auto')).toBeNull();
  });
  it('palette and scales from tokens only', () => {
    const d = declared([tok('--lp-accent', 'color', '221 83% 53%', '#2d4deb'), tok('--radius', 'radius', '0.5rem'), tok('--space-4', 'spacing', '16px'), tok('--text-lg', 'font-size', '1.125rem'), tok('--shadow-card', 'shadow', '0 1px 2px rgba(0,0,0,0.1)')], noStatic);
    expect([...d.palette.entries()]).toEqual([['#2d4deb', '--lp-accent']]);
    expect(d.hasOwnColors).toBe(true);
    expect([...d.scales.radius]).toEqual(['8']);
    expect([...d.scales.padding]).toEqual(['16']);
    expect([...d.scales.gap]).toEqual(['16']);
    expect([...d.scales.fontSize]).toEqual(['18']);
    expect([...d.scales.fontWeight]).toEqual(['100', '200', '300', '400', '500', '600', '700', '800', '900']);
    expect([...d.scales.shadow]).toEqual(['0 1 2 0 #0000001a']);
  });
  it('adds Tailwind defaults and non-default theme colors when Tailwind is present', () => {
    const st: StaticInfo = { tailwind: { version: 3, theme: { colors: { 'blue-500': '#3b82f6', 'brand-500': '#3366ff' }, radius: ['0.5rem', '9999px'], spacing: ['0.25rem'], fontSize: ['1rem'], shadow: [] } }, hardcodedColors: {}, warnings: [] };
    const d = declared([], st);
    expect(d.palette.get('#3366ff')).toBe('brand-500');
    expect(d.palette.has('#3b82f6')).toBe(false);
    expect(d.hasOwnColors).toBe(true);
    expect(d.scales.radius.has('8')).toBe(true);
    expect(d.scales.radius.has('9999')).toBe(true);
    expect(d.scales.radius.has('12')).toBe(true);
    expect(d.scales.padding.has('4')).toBe(true);
    expect(d.scales.padding.has('384')).toBe(true);
    expect(d.scales.fontSize.has('16')).toBe(true);
    expect(d.tailwindVersion).toBe(3);
    expect(declared([], { ...noStatic, tailwind: { version: 4, theme: null } }).scales.radius.has('24')).toBe(true);
    expect(declared([], noStatic).scales.radius.size).toBe(0);
    expect(declared([], noStatic).hasOwnColors).toBe(false);
  });
});
