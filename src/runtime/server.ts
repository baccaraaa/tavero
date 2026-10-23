import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createWriteStream, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { TaveroError } from '../core/errors.js';

export async function isUp(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(3000) });
    return r.status < 500;
  } catch { return false; }
}

/** Kill whatever listens on a port we own (ports Tavero launched on). Returns killed pids. */
export function killPort(port: number): string[] {
  const pids = new Set<string>();
  if (process.platform === 'win32') {
    const out = spawnSync('netstat', ['-ano'], { encoding: 'utf8' }).stdout ?? '';
    for (const line of out.split(/\r?\n/)) {
      const m = line.match(/^\s*TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)/);
      if (m && Number(m[1]) === port) pids.add(m[2]);
    }
    for (const pid of pids) spawnSync('taskkill', ['/pid', pid, '/T', '/F'], { stdio: 'ignore' });
  } else {
    // listeners only: a plain `lsof -ti :port` also lists clients connected to the port (e.g. the test runner itself)
    const out = spawnSync('lsof', ['-ti', `TCP:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8' }).stdout ?? '';
    for (const pid of out.split(/\s+/).filter(Boolean)) { pids.add(pid); spawnSync('kill', ['-9', pid], { stdio: 'ignore' }); }
  }
  return [...pids];
}

export async function attachOrLaunch(opts: { url: string; projectDir: string; devScript: string | null; logPath: string; timeoutMs?: number }): Promise<{ launched: boolean; stop: () => void }> {
  if (await isUp(opts.url)) return { launched: false, stop: () => {} };
  if (!opts.devScript) throw new TaveroError('dev-server', `${opts.url} is not responding and the project has no "dev" script to launch`, 2);
  const port = Number(new URL(opts.url).port) || 80;
  mkdirSync(dirname(opts.logPath), { recursive: true });
  const log = createWriteStream(opts.logPath);
  const child: ChildProcess = spawn('npm', ['run', 'dev', '--', '--port', String(port)], {
    cwd: opts.projectDir,
    shell: true,
    env: { ...process.env, BROWSER: 'none', FORCE_COLOR: '0', CI: '1', PORT: String(port) },
  });
  child.stdout?.pipe(log);
  child.stderr?.pipe(log);
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (child.pid) {
      if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      else spawnSync('kill', ['-9', String(child.pid)], { stdio: 'ignore' });
    }
    killPort(port);
  };
  process.once('exit', stop);
  const timeout = opts.timeoutMs ?? 240_000;
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await isUp(opts.url)) return { launched: true, stop };
    await new Promise((r) => setTimeout(r, 1000));
  }
  stop();
  throw new TaveroError('dev-server', `dev server did not answer on ${opts.url} within ${Math.round(timeout / 1000)}s; see ${opts.logPath}`, 2);
}
