import { describe, it, expect } from 'vitest';
import { darkThemeRule } from '../../src/rules/dark.js';
import type { PageRecord, ThemeProbe, Token } from '../../src/core/types.js';

const page = (over: Partial<PageRecord>): PageRecord => ({ route: '/', viewport: 'desktop', status: 'ok', docSize: [1440, 900], crawledAt: '', links: [], instances: [], samples: [], colors: {}, scales: { radius: {}, padding: {}, gap: {}, fontSize: {}, fontWeight: {}, shadow: {}, typography: {} }, ...over });
const P = (k: string, o: Partial<ThemeProbe>): ThemeProbe => ({ k, bg: null, fg: null, pbg: null, a: 10000, c: 'Card', f: 'src/Card.tsx:3:5', ...o });
const tok = (name: string, resolved: string): Token => ({ id: name, name, kind: 'color', value: resolved, resolved, theme: 'light', source: { file: 'src/tokens.css', line: 1 } });

const light = page({ pageBg: '#ffffff', probe: [
  P('0.1', { bg: '#ffffff', a: 40000 }),
  P('0.2', { fg: '#111111', pbg: '#ffffff', c: 'Title', f: 'src/Title.tsx:4:3' }),
  P('0.3', { bg: '#3366ff', c: 'Button', f: 'src/Button.tsx:2:1' }),
  P('0.4', { bg: '#ffffff', a: 40000, c: 'Panel', f: 'src/Panel.tsx:9:1' }),
] });
const dark = page({ viewport: 'dark', theme: 'dark', pageBg: '#0a0a0a', darkTokens: { '--card': 'oklch(0.205 0 0)', '--white': '#fff' }, probe: [
  P('0.1', { bg: '#ffffff', a: 40000 }),                                   // stayed white: a forgotten dark: or a literal
  P('0.2', { fg: '#111111', pbg: '#0a0a0a', c: 'Title', f: 'src/Title.tsx:4:3' }), // dark text on the dark page
  P('0.3', { bg: '#3366ff', c: 'Button', f: 'src/Button.tsx:2:1' }),       // a brand color may stay: not a finding
  P('0.4', { bg: '#171717', a: 40000, c: 'Panel', f: 'src/Panel.tsx:9:1' }), // switched: fine
] });

describe('darkThemeRule', () => {
  it('finds light backgrounds and dark text that do not change in the dark theme, and suggests the theme token', () => {
    const { findings } = darkThemeRule([light, dark], [tok('--white', '#ffffff'), tok('--card', '#ffffff'), tok('--brand', '#3366ff')]);
    const byKey = Object.fromEntries(findings.map((f) => [f.key, f]));
    expect(Object.keys(byKey).sort()).toEqual(['dark:dark-text', 'dark:light-bg']);
    expect(byKey['dark:light-bg']).toMatchObject({ rule: 'colors', severity: 'medium' });
    expect(byKey['dark:light-bg'].title).toMatch(/dark theme/);
    expect(byKey['dark:light-bg'].evidence[0]).toMatchObject({ route: '/', viewport: 'dark', component: 'Card', file: 'src/Card.tsx', line: 3, value: 'background #ffffff in both themes' });
    expect(byKey['dark:light-bg'].evidence[0].expected).toBe('--card (light #ffffff, dark #171717)'); // --white is white in both themes
    expect(byKey['dark:dark-text'].evidence[0]).toMatchObject({ component: 'Title', value: 'text #111111 on #0a0a0a' });
  });
  it('reports routes where the dark theme could not be switched on, and finds nothing there', () => {
    const notDark = { ...dark, route: '/x', pageBg: '#ffffff' };
    const lightX = { ...light, route: '/x' };
    const { findings, notApplied } = darkThemeRule([lightX, notDark], []);
    expect(findings).toEqual([]);
    expect(notApplied).toEqual(['/x']);
  });
  it('finds colors used only in the dark theme that are no token in either theme', () => {
    const d = { ...dark, colors: { '#2b2b40': { bg: 3, color: 0, border: 0, examples: [{ route: '/', viewport: 'dark', component: 'Sidebar', file: 'src/Sidebar.tsx:7:3' }] }, '#171717': { bg: 2, color: 0, border: 0, examples: [] }, '#3b3b3b': { bg: 2, color: 0, border: 0, examples: [] } } };
    const { findings } = darkThemeRule([light, d], [tok('--card', '#ffffff')]);
    const off = findings.filter((f) => f.key.startsWith('dark:off:'));
    expect(off.map((f) => f.key)).toEqual(['dark:off:#2b2b40']); // #171717 is --card in the dark theme; #3b3b3b is the browser's dark input field
    expect(off[0].evidence[0]).toMatchObject({ component: 'Sidebar', file: 'src/Sidebar.tsx', line: 7 });
  });
});
