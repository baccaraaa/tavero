import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { startMiniVite, MINI_VITE_URL, MINI_VITE_DIR } from '../helpers/miniVite.js';
import { scan } from '../../src/core/scan.js';
import { DEFAULT_VIEWPORTS, type Finding } from '../../src/core/types.js';

let stop: () => void;
beforeAll(async () => { stop = await startMiniVite(); });
afterAll(() => stop());

describe('findings end to end', () => {
  it('finds the deliberate drift in the mini app', async () => {
    const out = mkdtempSync(join(tmpdir(), 'tavero-e2e-'));
    const res = await scan({ projectDir: MINI_VITE_DIR, url: MINI_VITE_URL, out, routes: ['/'], viewports: [DEFAULT_VIEWPORTS[2]] });
    const findings = JSON.parse(readFileSync(join(res.dir, 'findings.json'), 'utf8')) as Finding[];
    const byKey = (rule: string, key: string) => findings.find((f) => f.rule === rule && f.key === key);
    // buttons: primary, ghost, danger, pill, raw → five text styles; the raw <button> is owned by Home
    expect(byKey('buttons', 'variants:text')).toMatchObject({ severity: 'high', stats: { variants: 5 } });
    expect(byKey('buttons', 'raw')).toMatchObject({ stats: { samples: 1 } });
    expect(byKey('buttons', 'raw')!.evidence[0]).toMatchObject({ component: 'Home', value: 'Raw button', file: 'src/pages/Home.tsx', line: 13 }); // the source line, not the line in Vite's transformed module
    // cards: Card and the inline raw card
    expect(byKey('cards', 'variants')).toMatchObject({ severity: 'medium', stats: { variants: 2 }, preliminary: true });
    expect(byKey('cards', 'raw')!.evidence[0]).toMatchObject({ component: 'Home' });
    // colors: brand is a token; #ee5544 is off-palette; the Tailwind defaults are flagged as defaults
    expect(byKey('colors', 'off:#3366ff')).toBeUndefined();
    expect(byKey('colors', 'off:#ee5544')).toBeTruthy();
    for (const hex of ['#10b981', '#e5e7eb', '#d1d5db']) expect(byKey('colors', `default:${hex}`), hex).toBeTruthy();
    expect(byKey('colors', 'hardcoded:#10b981')!.evidence[0].file).toBe('src/index.css');
    expect(byKey('colors', 'hardcoded:#ee5544')).toBeTruthy();
    // scales: only --radius-card (12px) is declared, no Tailwind
    expect(byKey('scales', 'radius')).toMatchObject({ severity: 'medium' });
    expect(byKey('scales', 'radius')!.evidence.map((e) => e.value)).toEqual(['4px', '6px', '8px', '999px']);
    expect(res.meta.stats.findings.high).toBeGreaterThanOrEqual(1);
    const context = readFileSync(join(res.dir, 'context.md'), 'utf8');
    expect(context).toContain('Action button is Button from src/components/Button.tsx');
    expect(context).toContain('buttons: ');
  });
});
