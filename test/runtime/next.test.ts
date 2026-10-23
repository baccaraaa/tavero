import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { startMiniNext, MINI_NEXT_URL, MINI_NEXT_DIR } from '../helpers/miniNext.js';
import { scan } from '../../src/core/scan.js';
import { DEFAULT_VIEWPORTS, type Component, type RouteEntry, type Token, type Finding } from '../../src/core/types.js';

let stop: () => void;
beforeAll(async () => { stop = await startMiniNext(); });
afterAll(() => stop());

describe('scan on a Next app', () => {
  it('discovers app routes, resolves client components through source maps and server components through the static index', async () => {
    const out = mkdtempSync(join(tmpdir(), 'tavero-next-'));
    const res = await scan({ projectDir: MINI_NEXT_DIR, url: MINI_NEXT_URL, out, viewports: [DEFAULT_VIEWPORTS[2]] });
    expect(res.meta.project.framework).toBe('next');
    expect(res.warnings.filter((w) => /build error/i.test(w))).toEqual([]);

    const routes = JSON.parse(readFileSync(join(res.dir, 'routes.json'), 'utf8')) as RouteEntry[];
    expect(routes.map((r) => [r.path, r.source, r.status])).toEqual([['/', 'next', 'ok'], ['/about', 'next', 'ok']]);

    const components = JSON.parse(readFileSync(join(res.dir, 'components.json'), 'utf8')) as Component[];
    const button = components.find((c) => c.name === 'Button')!;
    expect(button).toMatchObject({ file: 'app/components/Button.tsx', resolved: 'stack', instances: 2, pages: ['/'] });
    expect(button.line).toBeGreaterThan(0);
    expect(button.props.sort()).toEqual(['onClick', 'variant']);
    const counter = components.find((c) => c.name === 'Counter')!;
    expect(counter).toMatchObject({ file: 'app/components/Counter.tsx', resolved: 'stack' });
    const hero = components.find((c) => c.name === 'Hero')!;
    expect(hero).toMatchObject({ file: 'app/components/Hero.tsx', resolved: 'static', pages: ['/', '/about'] });

    const tokens = JSON.parse(readFileSync(join(res.dir, 'tokens.json'), 'utf8')) as Token[];
    expect(tokens.find((t) => t.name === '--color-brand')).toMatchObject({ kind: 'color', resolved: '#3366ff', source: { file: 'app/globals.css', line: 2 } });

    const findings = JSON.parse(readFileSync(join(res.dir, 'findings.json'), 'utf8')) as Finding[];
    const raw = findings.find((f) => f.rule === 'buttons' && f.key === 'raw')!;
    // the raw <button> sits in server-component markup: its owner is the Home page, found through React's component info
    expect(raw.evidence[0]).toMatchObject({ value: 'Raw button', component: 'Home' });
    expect(findings.find((f) => f.rule === 'colors' && f.key === 'off:#ee5544')).toBeTruthy();
  });
});
