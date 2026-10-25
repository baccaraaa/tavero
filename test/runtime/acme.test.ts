import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { startAcme, ACME_URL, ACME_DIR } from '../helpers/acme.js';
import { scan } from '../../src/core/scan.js';
import type { Finding } from '../../src/core/types.js';
let stop: () => void;
beforeAll(async () => { stop = await startAcme(); });
afterAll(() => stop());
describe('Acme demo app', () => {
  it('shows believable drift on every rule, with the intended components found', async () => {
    const out = mkdtempSync(join(tmpdir(), 'tavero-acme-'));
    const res = await scan({ projectDir: ACME_DIR, url: ACME_URL, out });
    expect(res.meta.routes.map((r) => r.path).sort()).toEqual(['/', '/billing', '/projects', '/reports', '/settings', '/team']);
    const f = JSON.parse(readFileSync(join(res.dir, 'findings.json'), 'utf8')) as Finding[];
    const key = (rule: string, k: string) => f.find((x) => x.rule === rule && x.key === k);
    expect(key('buttons', 'variants:text')!.stats.variants).toBeGreaterThanOrEqual(5);
    // page markup writes its own buttons: Upgrade (Billing), Invite (Team), Download CSV (Reports), Delete (Settings)
    expect(new Set(key('buttons', 'raw')!.evidence.map((e) => e.component))).toEqual(new Set(['Billing', 'Team', 'Reports', 'Settings']));
    expect(key('cards', 'variants')!.stats.variants).toBeGreaterThanOrEqual(3);
    expect(f.filter((x) => x.rule === 'colors' && x.key.startsWith('off:')).length).toBeGreaterThanOrEqual(3);
    expect(f.some((x) => x.rule === 'colors' && x.evidence.some((e) => e.file === 'src/tones.ts'))).toBe(true);
    expect(key('scales', 'radius')!.severity).not.toBe('info');
    const ctx = readFileSync(join(res.dir, 'context.md'), 'utf8');
    expect(ctx).toContain('Action button is Button from src/components/Button.tsx');
    expect(ctx).toContain('Card is Card from src/components/Card.tsx');
    // the dark theme: the project cards keep their literal white, the plan name its literal dark text
    expect(res.meta.themes).toEqual(['dark']);
    expect(res.warnings.join(' ')).not.toContain('did not switch on');
    const lightBg = key('colors', 'dark:light-bg')!;
    expect(lightBg.evidence.some((e) => e.value.startsWith('background #ffffff in both themes') && e.file === 'src/pages/Projects.tsx')).toBe(true);
    const darkText = key('colors', 'dark:dark-text')!;
    expect(darkText.evidence.some((e) => e.value.startsWith('text #1d2433') && e.file === 'src/pages/Billing.tsx')).toBe(true);
    // tokens switch with the theme: the sidebar and the cards built on --acme-surface are not reported
    expect(lightBg.evidence.some((e) => e.component === 'Sidebar' || e.component === 'Card')).toBe(false);
  });
});
