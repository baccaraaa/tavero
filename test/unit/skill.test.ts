import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { TOOLS } from '../../src/mcp/tools.js';

function helpCommands(): Set<string> {
  const r = spawnSync('npx', ['tsx', 'src/cli/index.ts', '--help'], { encoding: 'utf8', shell: true });
  const section = r.stdout.split(/^Commands:/m)[1] ?? '';
  return new Set([...section.matchAll(/^\s{2}([a-z]+)\b/gm)].map((m) => m[1]).filter((c) => c !== 'help'));
}
const toolsIn = (t: string): Set<string> => new Set([...t.matchAll(/\btavero_[a-z]+\b/g)].map((m) => m[0]));
const mentioned = (text: string): Set<string> => new Set([...text.matchAll(/\btavero ([a-z]+)\b/g)].map((m) => m[1]));

describe('agent documentation', () => {
  const commands = helpCommands();
  const skill = readFileSync('SKILL.md', 'utf8');
  const snippet = readFileSync('docs/AGENTS.snippet.md', 'utf8');
  it('SKILL.md has frontmatter and mentions every CLI command, and only real ones', () => {
    expect(skill).toMatch(/^---\r?\nname: tavero\r?\ndescription: .+\r?\n---\r?\n/);
    expect(commands.size).toBeGreaterThanOrEqual(10);
    for (const c of mentioned(skill)) expect(commands, `unknown command "tavero ${c}" in SKILL.md`).toContain(c);
    for (const c of commands) expect(mentioned(skill), `SKILL.md does not mention "tavero ${c}"`).toContain(c);
  });
  it('AGENTS snippet is short and uses only real commands', () => {
    expect(snippet.split('\n').filter((l) => l.trim()).length).toBeLessThanOrEqual(12);
    for (const c of mentioned(snippet)) expect(commands, `unknown command "tavero ${c}" in snippet`).toContain(c);
    expect(mentioned(snippet)).toContain('context');
    expect(mentioned(snippet)).toContain('findings');
  });
  it('SKILL.md and the snippet name exactly the MCP tools that exist', () => {
    const live = new Set(TOOLS.map((t) => t.name));
    for (const n of toolsIn(skill)) expect(live, `unknown tool ${n} in SKILL.md`).toContain(n);
    for (const n of live) expect(toolsIn(skill), `SKILL.md does not mention ${n}`).toContain(n);
    for (const n of toolsIn(snippet)) expect(live, `unknown tool ${n} in snippet`).toContain(n);
    expect(toolsIn(snippet)).toContain('tavero_context');
  });
  it('both files ship in the package', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { files: string[] };
    expect(pkg.files).toEqual(expect.arrayContaining(['SKILL.md', 'docs/AGENTS.snippet.md']));
  });
});
