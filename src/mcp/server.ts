import { createRequire } from 'node:module';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { TOOLS, errorResult, toResult, type ToolContext, type ToolExtra } from './tools.js';

const VERSION = (createRequire(import.meta.url)('../../package.json') as { version: string }).version;

export function createContext(projectDir: string, out?: string): ToolContext {
  return { projectDir, out, state: { scanning: false, devServers: new Map() } };
}

export function createServer(ctx: ToolContext): McpServer {
  const server = new McpServer({ name: 'tavero', version: VERSION });
  for (const t of TOOLS) {
    server.registerTool(t.name, { title: t.title, description: t.description, inputSchema: t.input }, async (args, extra) => {
      const token = extra._meta?.progressToken;
      const tx: ToolExtra = {
        signal: extra.signal,
        progress: async (done, total, message) => {
          if (token === undefined) return;
          await extra.sendNotification({ method: 'notifications/progress', params: { progressToken: token, progress: done, ...(total ? { total } : {}), message } });
        },
      };
      try { return toResult(await t.run(args, ctx, tx)); } catch (e) { return errorResult(e); }
    });
  }
  return server;
}

/** Stops every dev server this process launched. */
export function shutdown(ctx: ToolContext): void {
  for (const stop of ctx.state.devServers.values()) { try { stop(); } catch { /* already gone */ } }
  ctx.state.devServers.clear();
}

export async function runStdio(ctx: ToolContext): Promise<void> {
  // stdout belongs to JSON-RPC; anything printed by us or a library goes to stderr
  console.log = console.info = console.debug = (...a: unknown[]) => console.error(...a);
  const server = createServer(ctx);
  let closing = false;
  const close = () => { if (closing) return; closing = true; shutdown(ctx); process.exit(0); };
  // Claude Code on Windows closes stdin, then kills the tree 300 ms later: stop dev servers on stdin end
  process.stdin.on('end', close);
  process.stdin.on('close', close);
  server.server.onclose = close;
  process.once('SIGINT', close);
  process.once('SIGTERM', close);
  await server.connect(new StdioServerTransport());
}
