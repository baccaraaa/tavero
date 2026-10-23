import { mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { chromium } from 'playwright';
import { TaveroError } from '../core/errors.js';

const LOGIN_PATH = /(^|\/)(login|signin|sign-in|auth|register|signup|sign-up|forgot-password|reset-password|verify-email)(\/|$|\?)/i;

export function sessionPath(outDir: string): string {
  return join(outDir, 'session.json');
}

export async function loadSessionPath(outDir: string): Promise<string | null> {
  const p = sessionPath(outDir);
  try { await stat(p); return p; } catch { return null; }
}

/** A protected route that landed on a login-like URL or shows a password field is unauthenticated. */
export function isUnauthenticated(input: { route: string; finalUrl: string; hasPasswordInput: boolean }): boolean {
  if (LOGIN_PATH.test(input.route)) return false;
  let finalPath = input.finalUrl;
  try { const u = new URL(input.finalUrl); finalPath = u.pathname + u.search; } catch { /* keep raw */ }
  if (LOGIN_PATH.test(finalPath)) return true;
  return input.hasPasswordInput;
}

function waitForEnterStdin(): Promise<void> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question('Log in in the opened browser window, then press Enter here to save the session… ', () => { rl.close(); resolve(); });
  });
}

/**
 * Persist a logged-in session (cookies + localStorage) for later scans.
 * Interactive: a headed browser, the human logs in and presses Enter.
 * Headless (spec §5): with email + password the form is filled and submitted,
 * and the session is saved once the page leaves the login route.
 */
export async function login(opts: { url: string; outDir: string; email?: string; password?: string; waitForEnter?: () => Promise<void>; headless?: boolean }): Promise<string> {
  await mkdir(opts.outDir, { recursive: true });
  const scripted = !!(opts.email && opts.password);
  const browser = await chromium.launch({ headless: opts.headless ?? scripted });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  try {
    await page.goto(opts.url, { waitUntil: 'load', timeout: 120_000 });
    if (scripted) {
      // SPA login pages render their form after load; wait for the fields before giving up
      await page.locator('#email, input[type="email"], input[type="password"]').first().waitFor({ state: 'visible', timeout: 30_000 }).catch(() => {});
      const emailField = (await page.locator('#email').count()) ? page.locator('#email') : page.locator('input[type="email"]').first();
      const passwordField = page.locator('input[type="password"]').first();
      if (!(await emailField.count()) || !(await passwordField.count())) throw new TaveroError('login-failed', `no email/password form found at ${page.url()}`, 1);
      await emailField.fill(opts.email!);
      await passwordField.fill(opts.password!);
      const startPath = new URL(page.url()).pathname;
      await page.locator('button[type="submit"]').first().click();
      try {
        await page.waitForURL((u) => !LOGIN_PATH.test(u.pathname) && u.pathname !== startPath, { timeout: 30_000 });
      } catch {
        throw new TaveroError('login-failed', `still on ${page.url()} after submitting the form; check the credentials or log in interactively with tavero login --url`, 1);
      }
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    } else {
      await (opts.waitForEnter ?? waitForEnterStdin)();
    }
    const path = sessionPath(opts.outDir);
    await context.storageState({ path });
    return path;
  } finally {
    await browser.close();
  }
}
