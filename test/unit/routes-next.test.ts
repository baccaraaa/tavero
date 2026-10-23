import { describe, it, expect } from 'vitest';
import { discoverNextRoutes } from '../../src/runtime/routes/next.js';
import { makeTmpProject } from '../helpers/tmp.js';

describe('discoverNextRoutes', () => {
  it('derives static routes from app/, strips groups and slots, skips dynamic', async () => {
    const p = makeTmpProject({
      'package.json': '{}',
      'src/app/page.tsx': '',
      'src/app/(marketing)/pricing/page.tsx': '',
      'src/app/blog/[slug]/page.tsx': '',
      'src/app/@modal/x/page.tsx': '',
      'src/app/account/settings/page.jsx': '',
      'src/app/api/route.ts': '',
    });
    const r = await discoverNextRoutes(p.dir);
    expect(r.routes).toEqual(['/', '/account/settings', '/pricing', '/x']);
    expect(r.skipped).toEqual([{ path: '/blog/[slug]', reason: 'dynamic segment needs an example; add it to routes.json or --routes' }]);
    p.cleanup();
  });
  it('supports pages/ and excludes _app, _document, api', async () => {
    const p = makeTmpProject({ 'package.json': '{}', 'pages/index.tsx': '', 'pages/about.tsx': '', 'pages/_app.tsx': '', 'pages/api/x.ts': '', 'pages/posts/[id].tsx': '' });
    const r = await discoverNextRoutes(p.dir);
    expect(r.routes).toEqual(['/', '/about']);
    expect(r.skipped.map((s) => s.path)).toEqual(['/posts/[id]']);
    p.cleanup();
  });
});
