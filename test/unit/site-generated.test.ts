import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { genReference } from '../../site/scripts/gen-reference.js';
import { TOOLS } from '../../src/mcp/tools.js';
import { CLIENTS } from '../../src/mcp/config.js';
describe('site reference is generated from the tool', () => {
  it('covers every CLI command, MCP tool and client config', () => {
    const r = genReference({ write: false });
    const help = spawnSync('npx', ['tsx', 'src/cli/index.ts', '--help'], { encoding: 'utf8', shell: true }).stdout;
    const commands = [...help.split(/^Commands:/m)[1].matchAll(/^\s{2}([a-z]+)\b/gm)].map((m) => m[1]).filter((c) => c !== 'help');
    expect(r.cli.map((c) => c.command).sort()).toEqual(commands.sort());
    expect(r.tools.map((t) => t.name)).toEqual(TOOLS.map((t) => t.name));
    expect(r.configs.map((c) => c.client)).toEqual([...CLIENTS]);
    expect(r.cli.find((c) => c.command === 'scan')!.help).toContain('--routes');
  });
});
