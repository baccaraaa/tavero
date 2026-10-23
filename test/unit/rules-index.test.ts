import { describe, it, expect } from 'vitest';
import { runRules } from '../../src/rules/index.js';
import type { RuleInput } from '../../src/core/types.js';

const empty: RuleInput = {
  samples: [],
  colors: { '#1a9f6e': { bg: 1, color: 0, border: 0, examples: [] } },
  scales: { radius: {}, padding: {}, gap: {}, fontSize: {}, fontWeight: {}, shadow: {}, typography: {} },
  tokens: [{ id: '--a', name: '--a', kind: 'color', value: '#000', resolved: '#000000', theme: 'light', source: { source: 'runtime' } }],
  staticInfo: { tailwind: { version: null, theme: null }, hardcodedColors: {}, warnings: [] },
  components: [],
  instances: [],
};

describe('runRules', () => {
  it('runs all rules sorted by severity, and a subset on request', () => {
    const all = runRules(empty);
    expect(new Set(all.map((f) => f.rule))).toEqual(new Set(['colors', 'scales']));
    const sev = all.map((f) => f.severity);
    expect(sev.indexOf('info')).toBeGreaterThan(sev.lastIndexOf('medium'));
    expect(runRules(empty, ['scales']).every((f) => f.rule === 'scales')).toBe(true);
  });
});
