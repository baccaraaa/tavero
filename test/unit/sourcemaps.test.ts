import { describe, it, expect } from 'vitest';
import { classifySource } from '../../src/runtime/sourcemaps.js';

describe('classifySource', () => {
  const win = { projectDir: 'C:\\Coding\\app', baseUrl: 'http://localhost:3000' };
  const lin = { projectDir: '/home/runner/work/app', baseUrl: 'http://localhost:3000' };
  it('strips file:// URLs on Windows and Linux down to project-relative paths', () => {
    expect(classifySource('file:///C:/Coding/app/app/components/Button.tsx', win)).toEqual({ path: 'app/components/Button.tsx', app: true });
    expect(classifySource('file:///home/runner/work/app/app/components/Button.tsx', lin)).toEqual({ path: 'app/components/Button.tsx', app: true });
    expect(classifySource('/home/runner/work/app/src/x.tsx', lin)).toEqual({ path: 'src/x.tsx', app: true });
  });
  it('handles Turbopack [project] sources and dev-server URLs', () => {
    expect(classifySource('[project]/src/components/Card.tsx', win)).toEqual({ path: 'src/components/Card.tsx', app: true });
    expect(classifySource('turbopack://[project]/src/components/Card.tsx', lin)).toEqual({ path: 'src/components/Card.tsx', app: true });
    expect(classifySource('http://localhost:3000/src/App.tsx', win)).toEqual({ path: 'src/App.tsx', app: true });
  });
  it('marks library and bundler paths as not app code', () => {
    expect(classifySource('[project]/node_modules/react-dom/cjs/react-dom.development.js', win).app).toBe(false);
    expect(classifySource('file:///home/runner/work/app/node_modules/next/dist/client/link.js', lin).app).toBe(false);
    expect(classifySource('/@vite/client', win).app).toBe(false);
  });
});
