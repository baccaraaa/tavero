// Reference content for the docs, taken from the tool itself so it never drifts: CLI help, MCP tools, client configs.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { TOOLS } from '../../src/mcp/tools.js';
import { CLIENTS, clientConfig } from '../../src/mcp/config.js';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

export interface Reference {
  cli: Array<{ command: string; help: string }>;
  tools: Array<{ name: string; title: string; description: string; params: string[] }>;
  configs: Array<{ client: string; file: string; text: string }>;
}

/** `tavero <args>` from the built CLI when asked, else from the sources (tests run without a build). */
function tavero(args: string[], useDist: boolean): string {
  const r = useDist
    ? spawnSync(process.execPath, [join(ROOT, 'bin', 'tavero.js'), ...args], { cwd: ROOT, encoding: 'utf8' })
    : spawnSync('npx', ['tsx', 'src/cli/index.ts', ...args], { cwd: ROOT, encoding: 'utf8', shell: true });
  // the --dir default is the current directory of whoever builds the site; never publish it
  return (r.stdout ?? '').replaceAll(JSON.stringify(process.cwd()).slice(1, -1), '.').replaceAll(process.cwd(), '.').trim();
}

export function genReference(o: { write?: boolean; useDist?: boolean } = {}): Reference {
  const top = tavero(['--help'], !!o.useDist);
  const commands = [...(top.split(/^Commands:/m)[1] ?? '').matchAll(/^\s{2}([a-z]+)\b/gm)].map((m) => m[1]).filter((c) => c !== 'help');
  const ref: Reference = {
    cli: commands.map((command) => ({ command, help: tavero([command, '--help'], !!o.useDist) })),
    tools: TOOLS.map((t) => ({ name: t.name, title: t.title, description: t.description, params: Object.keys(t.input) })),
    configs: CLIENTS.map((client) => ({ client, ...clientConfig(client, { cwd: '/your/app', platform: 'linux' }) })),
  };
  if (o.write) {
    mkdirSync(join(ROOT, 'site', 'generated'), { recursive: true });
    writeFileSync(join(ROOT, 'site', 'generated', 'reference.json'), JSON.stringify({ ...ref, global: top }, null, 2) + '\n');
  }
  return ref;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const r = genReference({ write: true, useDist: true });
  console.log(`reference: ${r.cli.length} commands, ${r.tools.length} tools, ${r.configs.length} client configs`);
}
