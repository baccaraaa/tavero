import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { detectProject } from '../../src/project/detect.js';
import { makeTmpProject } from '../helpers/tmp.js';

describe('detectProject', () => {
  it('detects a Vite project with src root, tailwind config and css entry', async () => {
    const p = makeTmpProject({
      'package.json': JSON.stringify({ scripts: { dev: 'vite' }, devDependencies: { vite: '^5' }, dependencies: { react: '^19' } }),
      'tailwind.config.js': 'module.exports = {}',
      'src/index.css': '@tailwind base;\n@tailwind components;',
      'src/other.css': '.x{}',
      'src/App.tsx': '',
    });
    const info = await detectProject(p.dir);
    expect(info.framework).toBe('vite');
    expect(info.srcRoots).toEqual([join(p.dir, 'src')]);
    expect(info.tailwindConfig).toBe(join(p.dir, 'tailwind.config.js'));
    expect(info.cssEntries).toEqual([join(p.dir, 'src', 'index.css'), join(p.dir, 'src', 'other.css')]);
    expect(info.devScript).toBe('vite');
    p.cleanup();
  });
  it('detects Next with app/ and components/ roots and Tailwind 4 css import', async () => {
    const p = makeTmpProject({
      'package.json': JSON.stringify({ dependencies: { next: '16.0.0', react: '19' } }),
      'app/globals.css': '@import "tailwindcss";',
      'app/page.tsx': '',
      'components/x.tsx': '',
    });
    const info = await detectProject(p.dir);
    expect(info.framework).toBe('next');
    expect(info.srcRoots).toEqual([join(p.dir, 'app'), join(p.dir, 'components')]);
    expect(info.cssEntries).toEqual([join(p.dir, 'app', 'globals.css')]);
    expect(info.tailwindConfig).toBeNull();
    p.cleanup();
  });
  it('falls back to a config file when the framework lives in a parent workspace', async () => {
    const p = makeTmpProject({ 'package.json': JSON.stringify({ private: true }), 'vite.config.ts': 'export default {}', 'src/x.tsx': '' });
    expect((await detectProject(p.dir)).framework).toBe('vite');
    p.cleanup();
  });
  it('throws on unsupported projects', async () => {
    const p = makeTmpProject({ 'package.json': JSON.stringify({ dependencies: { express: '4' } }) });
    await expect(detectProject(p.dir)).rejects.toMatchObject({ code: 'unsupported-project' });
    p.cleanup();
  });
});
