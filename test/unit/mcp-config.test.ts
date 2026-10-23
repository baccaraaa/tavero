import { describe, it, expect } from 'vitest';
import { CLIENTS, clientConfig } from '../../src/mcp/config.js';

const posix = { cwd: '/home/u/app', platform: 'linux' as const };
const win = { cwd: 'C:\\Coding\\app', platform: 'win32' as const };

describe('clientConfig', () => {
  it('Claude Code: project .mcp.json with npx -y and an optional --dir', () => {
    expect(clientConfig('claude', { ...posix, dir: 'frontend' })).toEqual({
      file: '.mcp.json',
      text: JSON.stringify({ mcpServers: { tavero: { type: 'stdio', command: 'npx', args: ['-y', 'tavero', 'mcp', '--dir', 'frontend'] } } }, null, 2) + '\n',
    });
    expect(clientConfig('claude', win).text).toContain('"command": "npx"');
  });
  it('Codex: TOML with long timeouts; cmd /c on native Windows', () => {
    expect(clientConfig('codex', posix)).toEqual({
      file: '.codex/config.toml (trusted project) or ~/.codex/config.toml',
      text: '[mcp_servers.tavero]\ncommand = "npx"\nargs = ["-y", "tavero", "mcp"]\nstartup_timeout_sec = 60\ntool_timeout_sec = 900\n',
    });
    expect(clientConfig('codex', win).text).toBe('[mcp_servers.tavero]\ncommand = "cmd"\nargs = ["/c", "npx", "-y", "tavero", "mcp"]\nstartup_timeout_sec = 60\ntool_timeout_sec = 900\n');
  });
  it('VS Code uses `servers`; Gemini gets a timeout; Antigravity uses .agents', () => {
    expect(JSON.parse(clientConfig('vscode', posix).text)).toEqual({ servers: { tavero: { type: 'stdio', command: 'npx', args: ['-y', 'tavero', 'mcp'] } } });
    expect(clientConfig('vscode', posix).file).toBe('.vscode/mcp.json');
    expect(JSON.parse(clientConfig('gemini', posix).text)).toEqual({ mcpServers: { tavero: { command: 'npx', args: ['-y', 'tavero', 'mcp'], timeout: 900000 } } });
    expect(clientConfig('antigravity', posix).file).toBe('.agents/mcp_config.json');
    expect(clientConfig('cursor', posix).file).toBe('.cursor/mcp.json');
  });
  it('Windsurf is global only, so --dir is always absolute', () => {
    expect(JSON.parse(clientConfig('windsurf', posix).text).mcpServers.tavero.args).toEqual(['-y', 'tavero', 'mcp', '--dir', '/home/u/app']);
    expect(JSON.parse(clientConfig('windsurf', { ...win, dir: 'frontend' }).text).mcpServers.tavero.args).toEqual(['-y', 'tavero', 'mcp', '--dir', 'C:/Coding/app/frontend']);
    expect(clientConfig('windsurf', win).file).toBe('%USERPROFILE%\\.codeium\\windsurf\\mcp_config.json');
    expect(clientConfig('windsurf', posix).file).toBe('~/.codeium/windsurf/mcp_config.json');
  });
  it('every client produces a parseable config on both platforms', () => {
    for (const c of CLIENTS) for (const p of [posix, win]) {
      const { text } = clientConfig(c, p);
      if (c === 'codex') expect(text).toMatch(/^\[mcp_servers\.tavero\]\n/);
      else expect(() => JSON.parse(text), `${c} ${p.platform}`).not.toThrow();
    }
  });
});
