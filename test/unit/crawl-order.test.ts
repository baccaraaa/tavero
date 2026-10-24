import { describe, it, expect } from 'vitest';
import { crawlOrder } from '../../src/core/scan.js';
import { DEFAULT_VIEWPORTS } from '../../src/core/types.js';

describe('crawlOrder', () => {
  it('discovers links at the widest viewport first: phone layouts hide the navigation behind a menu button', () => {
    expect(crawlOrder(DEFAULT_VIEWPORTS).map((v) => v.name)).toEqual(['desktop', 'tablet', 'mobile']);
  });
  it('does not reorder the caller\'s list', () => {
    const vps = [...DEFAULT_VIEWPORTS];
    crawlOrder(vps);
    expect(vps.map((v) => v.name)).toEqual(['mobile', 'tablet', 'desktop']);
  });
});
