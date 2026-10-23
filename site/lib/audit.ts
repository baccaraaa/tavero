import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Written by scripts/audit.ts: the Tavero scan of this site. Absent until the first audit. */
export interface Audit { high: number; medium: number; info: number; pages: number; at: string }

export function readAudit(): Audit | null {
  try { return JSON.parse(readFileSync(join(process.cwd(), 'generated', 'audit.json'), 'utf8')) as Audit; } catch { return null; }
}
