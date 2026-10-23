import { describe, it, expect } from 'vitest';
import { hashId, componentId, instanceId, routeSlug } from '../../src/core/ids.js';

describe('ids', () => {
  it('hashId is deterministic and prefixed', () => {
    expect(hashId('c', 'a')).toBe(hashId('c', 'a'));
    expect(hashId('c', 'a')).toMatch(/^c_[0-9a-f]{10}$/);
    expect(hashId('c', 'a')).not.toBe(hashId('c', 'b'));
  });
  it('componentId uses file#name and tolerates missing file', () => {
    expect(componentId('src/A.tsx', 'A')).toBe(hashId('c', 'src/A.tsx#A'));
    expect(componentId(null, 'A')).toBe(hashId('c', '?#A'));
  });
  it('instanceId is stable per route/viewport/component/ordinal', () => {
    expect(instanceId('/x', 'mobile', 'c_1', 3)).toBe(hashId('i', '/x|mobile|c_1|3'));
  });
  it('routeSlug', () => {
    expect(routeSlug('/')).toBe('root');
    expect(routeSlug('/dashboard/resumes/analysis')).toBe('dashboard_resumes_analysis');
    expect(routeSlug('/a-b/c.d')).toBe('a_b_c_d');
  });
});
