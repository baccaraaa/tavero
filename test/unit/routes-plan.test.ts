import { describe, it, expect } from 'vitest';
import { normalizeLink, collapseDynamic, RouteQueue, planRoutes, writeRoutesFile } from '../../src/runtime/routes/index.js';
import { makeTmpProject } from '../helpers/tmp.js';
import { detectProject } from '../../src/project/detect.js';

describe('route planning', () => {
  it('normalizeLink keeps same-origin paths only, strips hash/query/trailing slash', () => {
    const b = 'http://localhost:5173';
    expect(normalizeLink('http://localhost:5173/a/b/?x=1#y', b)).toBe('/a/b');
    expect(normalizeLink('http://localhost:5173/', b)).toBe('/');
    expect(normalizeLink('https://example.com/x', b)).toBeNull();
    expect(normalizeLink('mailto:a@b.c', b)).toBeNull();
    expect(normalizeLink('http://localhost:5173/file.pdf', b)).toBeNull();
  });
  it('collapseDynamic replaces ids, uuids and long digit-bearing segments', () => {
    expect(collapseDynamic('/resumes/12')).toBe('/resumes/:param');
    expect(collapseDynamic('/u/3f2504e0-4f89-11d3-9a0c-0305e82c3301')).toBe('/u/:param');
    expect(collapseDynamic('/posts/how-to-win-2026-edition')).toBe('/posts/:param');
    expect(collapseDynamic('/dashboard/resumes')).toBe('/dashboard/resumes');
  });
  it('RouteQueue dedupes by collapsed pattern and caps', () => {
    const q = new RouteQueue(3);
    expect(q.add('/a', 'cli', 0)).toBe(true);
    expect(q.add('/items/1', 'crawl', 1)).toBe(true);
    expect(q.add('/items/2', 'crawl', 1)).toBe(false);
    expect(q.add('/b', 'crawl', 1)).toBe(true);
    expect(q.add('/c', 'crawl', 1)).toBe(false);
    expect(q.next()?.path).toBe('/a');
    expect(q.entries().map((e) => e.path)).toEqual(['/a', '/items/1', '/b']);
    q.setStatus('/a', 'ok');
    expect(q.entries()[0].status).toBe('ok');
  });
  it('planRoutes prefers cli, then routes.json, then discovery', async () => {
    const p = makeTmpProject({
      'package.json': JSON.stringify({ dependencies: { next: '16' } }),
      'app/page.tsx': '',
      'app/about/page.tsx': '',
    });
    const project = await detectProject(p.dir);
    const out = `${p.dir}/.tavero`;
    let plan = await planRoutes({ cliRoutes: ['/x'], project, outDir: out });
    expect(plan.queue.entries().map((e) => [e.path, e.source])).toEqual([['/x', 'cli']]);
    plan = await planRoutes({ project, outDir: out });
    expect(plan.queue.entries().map((e) => e.path)).toEqual(['/', '/about']);
    await writeRoutesFile(out, [{ path: '/custom', source: 'routes.json', status: 'pending' }]);
    plan = await planRoutes({ project, outDir: out });
    expect(plan.queue.entries().map((e) => e.path)).toEqual(['/custom']);
    p.cleanup();
  });
});
