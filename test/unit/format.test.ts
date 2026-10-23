import { describe, it, expect } from 'vitest';
import { table, pagedFooter, truncate, hintFor } from '../../src/cli/format.js';

describe('hintFor', () => {
  it('points at playwright install when the browser is missing', () => {
    expect(hintFor("browserType.launch: Executable doesn't exist at C:\\ms-playwright\\chromium-1228\\chrome.exe")).toBe('hint: run `npx playwright install chromium` once; Tavero drives Chromium through Playwright');
    expect(hintFor('something else')).toBeNull();
  });
});

describe('format', () => {
  it('aligns columns', () => {
    const out = table(['id', 'name', 'n'], [['c_1', 'Button', '10'], ['c_22', 'Card', '4']]);
    expect(out.split('\n')).toEqual(['id    name    n', 'c_1   Button  10', 'c_22  Card    4']);
  });
  it('footer tells how to get more', () => {
    expect(pagedFooter({ total: 45, page: 1, limit: 20 })).toBe('… 25 more, use --page 2');
    expect(pagedFooter({ total: 45, page: 3, limit: 20 })).toBe('');
    expect(pagedFooter({ total: 5, page: 1, limit: 20 })).toBe('');
  });
  it('truncates with an ellipsis', () => {
    expect(truncate('abcdef', 4)).toBe('abc…');
    expect(truncate('abc', 4)).toBe('abc');
  });
});
