import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string; bin: Record<string, string>; files: string[]; scripts: Record<string, string>; engines: Record<string, string>; keywords: string[] };

describe('package', () => {
  it('ships the CLI, the built engine, the collector and the agent docs', () => {
    expect(pkg.bin).toEqual({ tavero: 'bin/tavero.js' });
    expect(readFileSync('bin/tavero.js', 'utf8').startsWith('#!/usr/bin/env node')).toBe(true);
    expect(pkg.files).toEqual(expect.arrayContaining(['dist', 'bin', 'SKILL.md', 'docs/AGENTS.snippet.md']));
    expect(pkg.scripts.build).toContain('copy-assets');
    expect(readFileSync('scripts/copy-assets.mjs', 'utf8')).toContain('inspect.browser.js');
    expect(readFileSync('scripts/copy-assets.mjs', 'utf8')).toContain('src/ui/client.js');
    expect(pkg.engines.node).toBe('>=20');
    expect(pkg.scripts.prepublishOnly).toContain('build');
    expect(pkg.keywords).toEqual(expect.arrayContaining(['react', 'design-system', 'ai-agent']));
  });
  it('CHANGELOG has an entry for the current version', () => {
    expect(readFileSync('CHANGELOG.md', 'utf8')).toContain(`## ${pkg.version}`);
  });
});
