import { posix, win32 } from 'node:path';

export const CLIENTS = ['claude', 'cursor', 'codex', 'gemini', 'antigravity', 'vscode', 'windsurf'] as const;
export type McpClientName = typeof CLIENTS[number];

const json = (o: unknown) => JSON.stringify(o, null, 2) + '\n';

/** Config snippet for one MCP client (formats checked against each client's docs on 2026-10-22). Prints only; writes nothing. */
export function clientConfig(client: McpClientName, opts: { dir?: string; cwd: string; platform: NodeJS.Platform }): { file: string; text: string } {
  const isWin = opts.platform === 'win32';
  const global = client === 'windsurf';
  const dir = global ? (isWin ? win32 : posix).resolve(opts.cwd, opts.dir ?? '.').replace(/\\/g, '/') : opts.dir;
  const args = ['-y', 'tavero', 'mcp', ...(dir ? ['--dir', dir] : [])];
  switch (client) {
    case 'claude': return { file: '.mcp.json', text: json({ mcpServers: { tavero: { type: 'stdio', command: 'npx', args } } }) };
    case 'cursor': return { file: '.cursor/mcp.json', text: json({ mcpServers: { tavero: { type: 'stdio', command: 'npx', args } } }) };
    case 'vscode': return { file: '.vscode/mcp.json', text: json({ servers: { tavero: { type: 'stdio', command: 'npx', args } } }) };
    case 'gemini': return { file: '.gemini/settings.json', text: json({ mcpServers: { tavero: { command: 'npx', args, timeout: 900000 } } }) };
    case 'antigravity': return { file: '.agents/mcp_config.json', text: json({ mcpServers: { tavero: { command: 'npx', args } } }) };
    case 'windsurf': return { file: isWin ? '%USERPROFILE%\\.codeium\\windsurf\\mcp_config.json' : '~/.codeium/windsurf/mcp_config.json', text: json({ mcpServers: { tavero: { command: 'npx', args } } }) };
    case 'codex': {
      // Codex is a native binary: on Windows `npx` is a .cmd shim it may not resolve, so go through cmd
      const [command, cargs] = isWin ? ['cmd', ['/c', 'npx', ...args]] : ['npx', args];
      return {
        file: '.codex/config.toml (trusted project) or ~/.codex/config.toml',
        text: `[mcp_servers.tavero]\ncommand = ${JSON.stringify(command)}\nargs = [${(cargs as string[]).map((x) => JSON.stringify(x)).join(', ')}]\nstartup_timeout_sec = 60\ntool_timeout_sec = 900\n`,
      };
    }
  }
}
