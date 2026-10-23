import { describe, it, expect } from 'vitest';
import { hex, px, normalizeShadow, firstFamily, normalizeStyles, deltaE, nearColor } from '../../src/rules/normalize.js';

describe('normalize', () => {
  it('hex handles rgb, rgba, oklch, transparent', () => {
    expect(hex('rgb(51, 102, 255)')).toBe('#3366ff');
    expect(hex('rgba(0, 0, 0, 0.5)')).toBe('#00000080');
    expect(hex('rgba(0, 0, 0, 0)')).toBeNull();
    expect(hex('transparent')).toBeNull();
    expect(hex('oklch(0.623 0.214 259.815)')).toBe('#2b7fff');
    expect(hex('nonsense')).toBeNull();
  });
  it('px rounds and tolerates non-lengths', () => {
    expect(px('12.4px')).toBe(12);
    expect(px('12.6px')).toBe(13);
    expect(px('normal')).toBe(0);
    expect(px('')).toBe(0);
  });
  it('shadow normalizes to dx dy blur spread hex entries', () => {
    expect(normalizeShadow('none')).toBe('none');
    expect(normalizeShadow('rgba(0, 0, 0, 0.1) 0px 1px 2px 0px')).toBe('0 1 2 0 #0000001a');
    expect(normalizeShadow('rgb(0, 0, 0) 0px 4px 6px -1px, rgb(0, 0, 0) 0px 2px 4px -2px')).toBe('0 4 6 -1 #000000, 0 2 4 -2 #000000');
    expect(normalizeShadow('rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 10px 15px -3px')).toBe('0 10 15 -3 #0000001a');
    expect(normalizeShadow('rgba(0, 0, 0, 0) 0px 0px 0px 0px')).toBe('none');
  });
  it('firstFamily strips quotes', () => {
    expect(firstFamily('"Geist Variable", ui-sans-serif, system-ui')).toBe('Geist Variable');
    expect(firstFamily('Arial, sans-serif')).toBe('Arial');
  });
  it('normalizeStyles builds the record', () => {
    const n = normalizeStyles({
      'background-color': 'rgb(51, 102, 255)', color: 'rgb(255, 255, 255)',
      'border-top-width': '1px', 'border-top-style': 'solid', 'border-top-color': 'rgb(229, 231, 235)',
      'border-top-left-radius': '6px', 'border-top-right-radius': '6px', 'border-bottom-left-radius': '6px', 'border-bottom-right-radius': '6px',
      'padding-top': '8px', 'padding-right': '14px', 'padding-bottom': '8px', 'padding-left': '14px', gap: 'normal',
      'font-size': '14px', 'font-weight': '700', 'line-height': '20px', 'font-family': 'Arial, sans-serif', 'box-shadow': 'none',
      height: '36.5px', display: 'inline-block', position: 'static',
    });
    expect(n).toEqual({
      bg: '#3366ff', color: '#ffffff', borderWidth: 1, borderStyle: 'solid', borderColor: '#e5e7eb',
      radius: [6, 6, 6, 6], paddingY: 8, paddingX: 14, padding: [8, 14, 8, 14], gap: 0,
      fontSize: 14, fontWeight: 700, lineHeight: 20, fontFamily: 'Arial', shadow: 'none', height: 37, display: 'inline-block', position: 'static',
    });
    expect(normalizeStyles({ 'line-height': 'normal', 'font-weight': 'bold' }).lineHeight).toBeNull();
    expect(normalizeStyles({ 'font-weight': 'bold' }).fontWeight).toBe(700);
  });
  it('ΔE2000', () => {
    expect(deltaE('#000000', '#000000')).toBe(0);
    expect(deltaE('#6b7280', '#6b7281')).toBeLessThan(1);
    expect(nearColor('#6b7280', '#6b7580')).toBe(true); // ΔE ≈ 2.7
    expect(nearColor('#6b7280', '#6b7a80')).toBe(false); // ΔE ≈ 7
    expect(nearColor('#6b7280', '#ff0000')).toBe(false);
  });
});
