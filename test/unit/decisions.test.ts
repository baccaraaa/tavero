import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { applyDecisions, canonicalByRole, clearDecision, loadDecisions, saveDecision, variantLabel, type Decisions } from '../../src/core/decisions.js';
import type { Finding } from '../../src/core/types.js';

const variants = (): Finding => ({
  id: 'f_btn', rule: 'buttons', key: 'variants:text', severity: 'high', title: '3 text button styles', summary: 's', stats: { variants: 3, samples: 50 },
  evidence: [
    { variantId: 'v_a', component: 'DashButton', file: 'src/DashButton.tsx', line: 50, value: 'bg #2d4deb, radius 9999 — 23 instance(s) via DashButton on 4 page(s)' },
    { variantId: 'v_b', component: 'ProfileAuthMethods', file: 'src/Profile.tsx', line: 249, value: 'bg #ffffff, border 1px #e8eaed — 21 instance(s) via ProfileAuthMethods on 1 page(s)' },
    { variantId: 'v_c', component: 'ResumeCard', file: 'src/ResumeCard.tsx', line: 88, value: 'bg #21252b0d — 6 instance(s) via ResumeCard on 2 page(s)' },
  ],
});
const color = (places = 2): Finding => ({ id: 'f_col', rule: 'colors', key: 'off:#d92626', severity: 'high', title: 'Color #d92626 is not a project token', summary: 's', stats: { total: 4 }, evidence: Array.from({ length: places }, (_, i) => ({ value: `literal #d92626 in source`, file: `src/x${i}.css`, line: 1 })) });
const scales = (): Finding => ({ id: 'f_sc', rule: 'scales', key: 'radius', severity: 'medium', title: 'radius', summary: 's', stats: {}, evidence: [] });
const D = (findings: Decisions['findings']): Decisions => ({ version: 1, findings });
const at = '2026-10-23T10:00:00.000Z';

describe('applyDecisions', () => {
  it('fix moves a finding first; accepted hides it until it grows; note is attached', () => {
    const out = applyDecisions([variants(), color(), scales()], D({
      f_sc: { status: 'fix', at, places: 0, note: 'radius 12 everywhere' },
      f_col: { status: 'accepted', reason: 'brand red for errors', at, places: 2 },
    }));
    expect(out.map((f) => f.id)).toEqual(['f_sc', 'f_btn']);
    expect(out[0].decision).toEqual({ status: 'fix', note: 'radius 12 everywhere' });
    const all = applyDecisions([color()], D({ f_col: { status: 'accepted', reason: 'brand red', at, places: 2 } }), { includeHidden: true });
    expect(all[0].decision).toMatchObject({ status: 'accepted', reason: 'brand red' });
    const grown = applyDecisions([color(3)], D({ f_col: { status: 'accepted', reason: 'brand red', at, places: 2 } }));
    expect(grown.map((f) => f.id)).toEqual(['f_col']);
    expect(grown[0].decision).toMatchObject({ status: 'reopened', reason: 'brand red' });
  });
  it('canonical marks primary and allowed variants, points the rest at them, and resolves when nothing is left', () => {
    const [f] = applyDecisions([variants()], D({ f_btn: { status: null, canonical: { primary: 'v_a', allowed: ['v_b'] }, at, places: 3 } }));
    expect(f.evidence.map((e) => e.canonical ?? null)).toEqual(['primary', 'allowed', null]);
    expect(f.evidence[2].expected).toBe('DashButton (bg #2d4deb, radius 9999) or ProfileAuthMethods (bg #ffffff, border 1px #e8eaed)');
    expect(f.evidence[0].expected).toBeUndefined();
    expect(f.stats.variants).toBe(2);
    expect(f.decision).toMatchObject({ status: null, canonical: { primary: 'v_a', allowed: ['v_b'] } });
    const done = applyDecisions([variants()], D({ f_btn: { status: null, canonical: { primary: 'v_a', allowed: ['v_b', 'v_c'] }, at, places: 3 } }));
    expect(done).toEqual([]);
    expect(applyDecisions([variants()], D({ f_btn: { status: null, canonical: { primary: 'v_a', allowed: ['v_b', 'v_c'] }, at, places: 3 } }), { includeHidden: true })[0].decision?.status).toBe('resolved');
  });
  it('uses human names for canonical variants in expected and in the per-role canonical', () => {
    const [f] = applyDecisions([variants()], D({ f_btn: { status: null, canonical: { primary: 'v_a', allowed: ['v_b'], names: { v_a: 'primary', v_b: 'outline' } }, at, places: 3 } }));
    expect(f.evidence[2].expected).toBe('DashButton "primary" (bg #2d4deb, radius 9999) or ProfileAuthMethods "outline" (bg #ffffff, border 1px #e8eaed)');
    expect(canonicalByRole([f])['button-text']).toMatchObject({ component: 'DashButton', label: 'DashButton "primary" (bg #2d4deb, radius 9999)', allowed: ['ProfileAuthMethods "outline" (bg #ffffff, border 1px #e8eaed)'] });
    expect(variantLabel(variants().evidence[0], 'main')).toBe('DashButton "main" (bg #2d4deb, radius 9999)');
  });
  it('a canonical whose primary variant disappeared keeps the finding unchanged', () => {
    const [f] = applyDecisions([variants()], D({ f_btn: { status: null, canonical: { primary: 'v_gone', allowed: [] }, at, places: 3 } }));
    expect(f.evidence.every((e) => !e.canonical && !e.expected)).toBe(true);
  });
  it('labels a variant by its component and signature', () => {
    expect(variantLabel(variants().evidence[0])).toBe('DashButton (bg #2d4deb, radius 9999)');
  });
});

describe('decisions file', () => {
  it('saves, merges, clears atomically and reports a broken file', async () => {
    const out = mkdtempSync(join(tmpdir(), 'tavero-dec-'));
    expect(await loadDecisions(out)).toEqual({ version: 1, findings: {} });
    await saveDecision(out, 'f_1', { status: 'accepted', reason: 'ok' }, 2);
    await saveDecision(out, 'f_1', { note: 'see design doc' }, 2);
    const d = await loadDecisions(out);
    expect(d.findings.f_1).toMatchObject({ status: 'accepted', reason: 'ok', note: 'see design doc', places: 2 });
    expect(Date.parse(d.findings.f_1.at)).toBeGreaterThan(0);
    expect(readdirSync(out)).toEqual(['decisions.json']); // no temp file left behind
    await Promise.all([saveDecision(out, 'f_2', { status: 'fix' }, 1), saveDecision(out, 'f_3', { status: 'fix' }, 1)]);
    expect(Object.keys((await loadDecisions(out)).findings).sort()).toEqual(['f_1', 'f_2', 'f_3']);
    await clearDecision(out, 'f_1');
    expect(JSON.parse(readFileSync(join(out, 'decisions.json'), 'utf8')).findings.f_1).toBeUndefined();
    writeFileSync(join(out, 'decisions.json'), '{ broken');
    await expect(loadDecisions(out)).rejects.toMatchObject({ code: 'bad-decisions' });
  });
});
