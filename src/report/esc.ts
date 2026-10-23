import { isAbsolute, relative } from 'node:path';

export const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
/** Crop paths are stored absolute by the scanner; pages refer to them relative to the scan folder. */
export const rel = (dir: string, p: string): string => (isAbsolute(p) ? relative(dir, p) : p).replace(/\\/g, '/');
