import { describe, it, expect } from 'vitest';
import { findHardcodedColors, findTokenRefs } from '../../src/static/hardcodedColors.js';
import { makeTmpProject } from '../helpers/tmp.js';
import { parseColor } from '../../src/static/tokens.js';

describe('findHardcodedColors', () => {
  it('finds hex, rgb, hsl literals and Tailwind arbitrary values, skipping token declarations', async () => {
    const p = makeTmpProject({
      'src/a.tsx': `const s = { color: '#FF0000' };\nexport const X = () => <div className="bg-[#3366ff] text-[rgb(1,2,3)] border-[hsl(222 47% 11%)]" style={{ background: 'rgba(0,0,0,0.5)' }} />;\n`,
      'src/b.css': `:root { --lp-accent: 221 83% 53%; }\n.x { color: #ff0000; box-shadow: 0 0 0 1px rgb(229 231 235); }\n.y { background: hsl(var(--lp-bg)); border-color: hsl(var(--lp-border) / 0.3); }\n`,
      'src/tokens.css': `:root { --c: #123456; }\n`,
    });
    const out = await findHardcodedColors(p.dir, [`${p.dir}/src`], new Set(['src/tokens.css']));
    expect(out['#ff0000']).toEqual([{ file: 'src/a.tsx', line: 1 }, { file: 'src/b.css', line: 2 }]);
    expect(out['#3366ff']).toEqual([{ file: 'src/a.tsx', line: 2 }]);
    expect(out['#010203']).toEqual([{ file: 'src/a.tsx', line: 2 }]);
    expect(out['#0f1729']).toEqual([{ file: 'src/a.tsx', line: 2 }]);
    expect(out['#00000080']).toEqual([{ file: 'src/a.tsx', line: 2 }]);
    expect(out['#e5e7eb']).toEqual([{ file: 'src/b.css', line: 2 }]);
    expect(out['#123456']).toBeUndefined();
    p.cleanup();
  });
  it('reads .ts/.js class maps and Tailwind arbitrary values with underscores for spaces', async () => {
    const p = makeTmpProject({
      'src/tones.ts': "export const TONE = { violet: 'bg-[hsl(265_70%_58%/0.13)] text-[hsl(265_60%_52%)]', blue: 'bg-[hsl(var(--lp-accent)/0.12)]' };\n",
      'src/legacy.js': "export const c = 'text-[#0a0b0c]';\n",
    });
    const out = await findHardcodedColors(p.dir, [`${p.dir}/src`], new Set());
    expect(out[parseColor('hsl(265 70% 58% / 0.13)')!]).toEqual([{ file: 'src/tones.ts', line: 1 }]);
    expect(out[parseColor('hsl(265 60% 52%)')!]).toEqual([{ file: 'src/tones.ts', line: 1 }]);
    expect(out['#0a0b0c']).toEqual([{ file: 'src/legacy.js', line: 1 }]);
    expect(Object.keys(out)).toHaveLength(3); // hsl(var(--token)) stays a token reference
    p.cleanup();
  });
  it('lists which tokens each source file references', async () => {
    const p = makeTmpProject({
      'src/tones.ts': "export const T = 'bg-[hsl(var(--ds-c-green)/0.1)] text-[hsl(var(--ds-c-green-fg))]';",
      'src/a.css': '.x { color: hsl(var(--lp-text)); border-color: var(--lp-border); }',
      'src/plain.tsx': 'export const X = 1;',
    });
    const refs = await findTokenRefs(p.dir, [`${p.dir}/src`]);
    expect(refs).toEqual({ 'src/a.css': ['--lp-border', '--lp-text'], 'src/tones.ts': ['--ds-c-green', '--ds-c-green-fg'] });
    p.cleanup();
  });
});
