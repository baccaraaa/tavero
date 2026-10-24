import { describe, it, expect } from 'vitest';
import { parseTanstackRouteTree } from '../../src/runtime/routes/tanstack.js';

const TREE = `
import { Route as rootRouteImport } from './routes/__root'
export interface FileRoutesByFullPath {
  '/': typeof AuthenticatedIndexRoute
  '/settings': typeof AuthenticatedSettingsRouteRouteWithChildren
  '/sign-in': typeof authSignInRoute
  '/errors/$error': typeof AuthenticatedErrorsErrorRoute
  '/files/$': typeof FilesSplatRoute
  '/settings/account': typeof AuthenticatedSettingsAccountRoute
  '/apps/': typeof AuthenticatedAppsIndexRoute
  '/settings/': typeof AuthenticatedSettingsIndexRoute
}
export interface FileRoutesByTo {
  '/other': typeof OtherRoute
}
`;

describe('parseTanstackRouteTree', () => {
  it('reads the full paths of the generated route tree, without trailing slashes or duplicates', () => {
    const r = parseTanstackRouteTree(TREE);
    expect(r.routes).toEqual(['/', '/apps', '/settings', '/settings/account', '/sign-in']);
  });
  it('skips params and splats with a reason', () => {
    const r = parseTanstackRouteTree(TREE);
    expect(r.skipped.map((s) => s.path)).toEqual(['/errors/$error', '/files/$']);
  });
  it('finds nothing in other files', () => {
    expect(parseTanstackRouteTree('export const x = 1').routes).toEqual([]);
  });
});
