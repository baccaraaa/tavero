import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { attachOrLaunch } from '../../src/runtime/server.js';

export const MINI_VITE_URL = 'http://localhost:5177';
export const MINI_VITE_DIR = resolve('test/apps/mini-vite');

export async function startMiniVite(): Promise<() => void> {
  const h = await attachOrLaunch({ url: MINI_VITE_URL, projectDir: MINI_VITE_DIR, devScript: 'vite', logPath: join(tmpdir(), 'tavero-mini-vite.log'), timeoutMs: 120_000 });
  return h.stop;
}
