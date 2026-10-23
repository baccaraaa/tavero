import { describe, it, expect } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { exportUi } from '../../src/ui/export.js';
import { makeTmpProject } from '../helpers/tmp.js';
import { writeScanFixture } from '../helpers/scanFixture.js';
describe('ui export', () => {
  it('writes a static read-only panel with relative links and its crops', async () => {
    const p = makeTmpProject({}); writeScanFixture(p.dir);
    const dir = mkdtempSync(join(tmpdir(), 'tavero-export-'));
    const r = await exportUi({ projectDir: p.dir, dir });
    expect(r.pages).toBeGreaterThanOrEqual(7);
    const index = readFileSync(join(dir, 'index.html'), 'utf8');
    expect(index).toContain('href="f-f_btn.html"');
    expect(index).toContain('href="assets/tokens.css"');
    expect(index).not.toMatch(/href="\/|src="\//);
    expect(index).not.toContain('data-action=');
    expect(index).not.toContain('tavero-token');
    expect(index).toContain('In your project these decisions are made in');
    expect(existsSync(join(dir, 'f-f_col.html'))).toBe(true);
    expect(readFileSync(join(dir, 'f-f_btn.html'), 'utf8')).toContain('src="files/s1/crops/c_aaa/mobile__root__0.png"');
    expect(existsSync(join(dir, 'files', 's1', 'crops', 'c_aaa', 'mobile__root__0.png'))).toBe(true);
    expect(readdirSync(join(dir, 'assets'))).toEqual(expect.arrayContaining(['tokens.css', 'style.css', 'fonts']));
    p.cleanup();
  });
});
