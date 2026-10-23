import { describe, it, expect } from 'vitest';
import { aggregate, pageFileName } from '../../src/core/derive/aggregate.js';
import type { PageRecord } from '../../src/core/types.js';

const scales = () => ({ radius: {}, padding: {}, gap: {}, fontSize: {}, fontWeight: {}, shadow: {}, typography: {} });
const page = (route: string, viewport: string, over: Partial<PageRecord> = {}): PageRecord => ({
  route, viewport, status: 'ok', docSize: [1440, 900], crawledAt: 'x', links: [], instances: [], samples: [], colors: {}, scales: scales(), ...over,
});
const inst = (id: string, cid: string, name: string, route: string, viewport: string, props: string[] = []) => ({
  id, componentId: cid, route, viewport, rect: { x: 0, y: 0, w: 1, h: 1 }, hosts: 1, key: id, name, file: `src/${name}.tsx`, line: 1, resolved: 'stack' as const, props,
});

describe('aggregate', () => {
  it('merges components, counts and examples across pages', () => {
    const pages = [
      page('/', 'mobile', {
        instances: [inst('i1', 'c_a', 'Button', '/', 'mobile', ['variant']), inst('i2', 'c_a', 'Button', '/', 'mobile', ['size'])],
        colors: { '#000000': { bg: 1, color: 2, border: 0, examples: [{ route: '/', viewport: 'mobile', component: 'Button', file: null }] } },
        scales: { ...scales(), radius: { '6': { count: 2, examples: [] } } },
      }),
      page('/x', 'mobile', {
        instances: [inst('i3', 'c_a', 'Button', '/x', 'mobile'), inst('i4', 'c_b', 'Card', '/x', 'mobile')],
        colors: { '#000000': { bg: 0, color: 1, border: 1, examples: [{ route: '/x', viewport: 'mobile', component: 'Card', file: null }] } },
        scales: { ...scales(), radius: { '6': { count: 1, examples: [] }, '12': { count: 1, examples: [] } } },
      }),
    ];
    const out = aggregate(pages, { declMap: new Map() });
    expect(out.components.map((c) => [c.id, c.instances, c.pages, c.props])).toEqual([['c_a', 3, ['/', '/x'], ['size', 'variant']], ['c_b', 1, ['/x'], []]]);
    expect(out.instances).toHaveLength(4);
    expect(Object.keys(out.instances[0])).not.toContain('key');
    expect(out.colors['#000000']).toMatchObject({ bg: 1, color: 3, border: 1 });
    expect(out.colors['#000000'].examples).toHaveLength(2);
    expect(out.scales.radius).toMatchObject({ '6': { count: 3 }, '12': { count: 1 } });
    expect(out.tokens).toEqual([]);
  });
  it('takes tokens from the first page that has them', () => {
    const pages = [page('/', 'mobile'), page('/x', 'mobile', { tokens: { decls: [{ name: '--a', value: '#fff', selector: ':root', href: null }], values: { '--a': '#fff' } } })];
    expect(aggregate(pages, { declMap: new Map() }).tokens.map((t) => t.name)).toEqual(['--a']);
  });
  it('pageFileName', () => {
    expect(pageFileName('mobile', '/dashboard/resumes')).toBe('mobile__dashboard_resumes.json');
  });
});
