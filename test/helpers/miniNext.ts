import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { attachOrLaunch } from '../../src/runtime/server.js';

export const MINI_NEXT_URL = 'http://localhost:5178';
export const MINI_NEXT_DIR = resolve('test/apps/mini-next');

export async function startMiniNext(): Promise<() => void> {
  const h = await attachOrLaunch({ url: MINI_NEXT_URL, projectDir: MINI_NEXT_DIR, devScript: 'next dev', logPath: join(tmpdir(), 'tavero-mini-next.log'), timeoutMs: 240_000 });
  return h.stop;
}
