import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

/** Spawns `tavero mcp` from the source tree and connects an SDK client over stdio. */
export async function connectMcp(dir: string, out: string): Promise<{ client: Client; errors: Error[]; close: () => Promise<void> }> {
  const transport = new StdioClientTransport({
    command: 'npx', args: ['tsx', 'src/cli/index.ts', 'mcp', '--dir', dir, '--out', out],
    env: Object.fromEntries(Object.entries(process.env).filter((e): e is [string, string] => typeof e[1] === 'string')),
    stderr: 'pipe',
  });
  const errors: Error[] = [];
  transport.onerror = (e) => errors.push(e); // a non-JSON line on stdout surfaces here
  const client = new Client({ name: 'tavero-test', version: '0.0.0' });
  client.onerror = (e) => errors.push(e);
  await client.connect(transport);
  return { client, errors, close: () => client.close() };
}

export const text = (r: { content?: unknown }): string => ((r.content as Array<{ type: string; text?: string }>) ?? []).map((c) => c.text ?? '').join('\n');
