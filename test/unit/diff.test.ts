import { describe, it, expect } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { diffScans, formatDiff } from '../../src/core/diff.js';
import { makeTmpProject } from '../helpers/tmp.js';

function scanDir(root: string, name: string, findings: unknown[], components: unknown[]) {
  const d = join(root, name);
  mkdirSync(d, { recursive: true });
  writeFileSync(join(d, 'findings.json'), JSON.stringify(findings));
  writeFileSync(join(d, 'components.json'), JSON.stringify(components));
  return d;
}
const F = (id: string, stats: Record<string, number>) => ({ id, rule: 'buttons', key: id, severity: 'medium', title: `t ${id}`, summary: '', stats, evidence: [] });
const C = (id: string) => ({ id, name: id, file: null, line: null, resolved: 'none', instances: 1, pages: [], props: [] });

describe('diffScans', () => {
  it('classifies findings and components', async () => {
    const p = makeTmpProject({});
    const a = scanDir(p.dir, 'a', [F('f_1', { variants: 5 }), F('f_2', { total: 1 }), F('f_3', { x: 1 })], [C('c_1'), C('c_2')]);
    const b = scanDir(p.dir, 'b', [F('f_1', { variants: 3 }), F('f_3', { x: 1 }), F('f_4', { y: 2 })], [C('c_1'), C('c_3')]);
    const d = await diffScans(a, b);
    expect(d.findings.new.map((f) => f.id)).toEqual(['f_4']);
    expect(d.findings.resolved.map((f) => f.id)).toEqual(['f_2']);
    expect(d.findings.unchanged).toEqual([{ id: 'f_1', title: 't f_1', statsChanged: { variants: [5, 3] } }, { id: 'f_3', title: 't f_3', statsChanged: {} }]);
    expect(d.components.added.map((c) => c.id)).toEqual(['c_3']);
    expect(d.components.removed.map((c) => c.id)).toEqual(['c_2']);
    expect(formatDiff(d)).toBe('diff vs a: +1 new, -1 resolved, 2 unchanged (1 changed stats); components +1 -1');
    expect(formatDiff(d, { staleRoutes: 7 })).toBe('diff vs a: +1 new, -1 resolved, 2 unchanged (1 changed stats); components +1 -1 — partial rescan: stats changed only on the rescanned routes; 7 stale route(s) may still carry findings, run a full scan to resolve');
    p.cleanup();
  });
});
