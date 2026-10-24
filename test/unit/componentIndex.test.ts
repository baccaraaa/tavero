import { describe, it, expect } from 'vitest';
import { buildComponentIndex, collisions } from '../../src/static/componentIndex.js';
import { makeTmpProject } from '../helpers/tmp.js';

describe('buildComponentIndex', () => {
  it('finds function, arrow, memo and forwardRef components with file and line', async () => {
    const p = makeTmpProject({
      'src/a/Button.tsx': `import React from 'react';\nexport function Button(props: {}) { return null; }\nconst helper = () => 1;\nexport const IconButton = React.forwardRef((p, ref) => null);\n`,
      'src/b/Card.tsx': `export default function Card() { return null }\nexport const Row = ({ x }: { x: number }) => null;\nconst Memoed = memo(function Inner() { return null });\n`,
      'src/b/Card2.tsx': `export const Row = () => null;\n`,
      'src/types.d.ts': `export declare function Button(): void;\n`,
      'node_modules/x/index.tsx': `export function Evil() {}`,
    });
    const index = await buildComponentIndex(p.dir, [`${p.dir}/src`]);
    expect(index.get('Button')).toEqual([{ file: 'src/a/Button.tsx', line: 2 }]);
    expect(index.get('IconButton')).toEqual([{ file: 'src/a/Button.tsx', line: 4 }]);
    expect(index.get('Card')).toEqual([{ file: 'src/b/Card.tsx', line: 1 }]);
    expect(index.get('Row')?.map((x) => x.file).sort()).toEqual(['src/b/Card.tsx', 'src/b/Card2.tsx']);
    expect(index.get('Memoed')).toEqual([{ file: 'src/b/Card.tsx', line: 3 }]);
    expect(index.get('helper')).toBeUndefined();
    expect(index.get('Evil')).toBeUndefined();
    expect(collisions(index)).toEqual([{ name: 'Row', files: ['src/b/Card.tsx', 'src/b/Card2.tsx'] }]);
    p.cleanup();
  });
  it('indexes default-exported functions whatever their case: Next pages are often "export default function page()"', async () => {
    const p = makeTmpProject({ 'src/app/unauthorized/page.tsx': ['import Link from "next/link";', 'export default function page() {', '  return null;', '}', ''].join('\n') });
    const index = await buildComponentIndex(p.dir, [`${p.dir}/src`]);
    expect(index.get('page')).toEqual([{ file: 'src/app/unauthorized/page.tsx', line: 2 }]);
    p.cleanup();
  });
});
