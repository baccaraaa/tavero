export function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

export function table(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)));
  const line = (cells: string[]) => cells.map((c, i) => (i === cells.length - 1 ? c : c.padEnd(widths[i]))).join('  ').replace(/\s+$/, '');
  return [line(headers), ...rows.map(line)].join('\n');
}

export function pagedFooter(p: { total: number; page: number; limit: number }): string {
  const shown = Math.min(p.total, p.page * p.limit);
  return shown < p.total ? `… ${p.total - shown} more, use --page ${p.page + 1}` : '';
}

export function emit(opts: { json: boolean }, data: unknown, text: () => string): void {
  process.stdout.write((opts.json ? JSON.stringify(data, null, 2) : text()) + '\n');
}

/** Text output stays small: 20 rows by default, never more than 200. */
export function clampLimit(n: unknown, fallback = 20): number {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return fallback;
  return Math.min(v, 200);
}

/** Actionable second line for known failure texts; null when there is nothing to add. */
export function hintFor(message: string): string | null {
  if (/Executable doesn't exist/.test(message)) return 'hint: run `npx playwright install chromium` once; Tavero drives Chromium through Playwright';
  return null;
}
