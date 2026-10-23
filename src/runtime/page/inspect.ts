import { readFileSync } from 'node:fs';
import type { Page } from 'playwright';
import type { RawPage } from '../../core/types.js';

export interface InspectOptions { maxOwners: number; maxFrames: number; styleProps: string[] }

export const DEFAULT_STYLE_PROPS = [
  'background-color', 'color', 'border-top-width', 'border-top-style', 'border-top-color',
  'border-top-left-radius', 'border-top-right-radius', 'border-bottom-left-radius', 'border-bottom-right-radius',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'gap',
  'font-size', 'font-weight', 'line-height', 'font-family', 'box-shadow', 'height', 'display', 'position', 'overflow-x',
];

/** The browser-side collector, kept as plain JS so it can be evaluated as a string without a bundler. */
export const INSPECT_SOURCE: string = readFileSync(new URL('./inspect.browser.js', import.meta.url), 'utf8');

export async function inspect(page: Page, opts: Partial<InspectOptions> = {}): Promise<RawPage> {
  const o: InspectOptions = { maxOwners: 8, maxFrames: 8, styleProps: DEFAULT_STYLE_PROPS, ...opts };
  return (await page.evaluate(`(${INSPECT_SOURCE})(${JSON.stringify(o)})`)) as RawPage;
}
