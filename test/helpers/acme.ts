import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { attachOrLaunch } from '../../src/runtime/server.js';

export const ACME_URL = 'http://localhost:5180';
export const ACME_DIR = resolve('demo/acme');

export async function startAcme(): Promise<() => void> {
  const h = await attachOrLaunch({ url: ACME_URL, projectDir: ACME_DIR, devScript: 'vite', logPath: join(tmpdir(), 'tavero-acme.log'), timeoutMs: 120_000 });
  return h.stop;
}
