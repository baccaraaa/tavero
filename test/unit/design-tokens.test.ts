import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
const css = readFileSync('design/tokens.css', 'utf8');
describe('design tokens', () => {
  it('declares the spec tokens once', () => {
    for (const v of ['--ink:#141414', '--ink-2:#4a4a4a', '--ink-3:#6f6f6f', '--line:#e3e3e3', '--line-2:#d0d0d0', '--wash:#f7f7f6', '--paper:#ffffff', '--accent:#1f5bd8', '--high:#b42318', '--medium:#9a5b06', '--info:#4a5565', '--r-lg:12px', '--r-md:8px', '--r-sm:6px'])
      expect(css.replace(/\s+/g, '')).toContain(v + ';');
    for (const [i, px] of [4, 8, 12, 16, 24, 32, 48, 72, 112].entries()) expect(css.replace(/\s+/g, '')).toContain(`--s-${i + 1}:${px}px;`);
  });
  it('the panel stylesheet uses only token variables for color', () => {
    const panel = readFileSync('src/ui/style.css', 'utf8');
    expect(panel.match(/#[0-9a-f]{3,8}\b/gi) ?? []).toEqual([]);
  });
});
