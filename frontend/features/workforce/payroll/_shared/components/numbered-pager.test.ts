import { describe, expect, it } from 'vitest';

import { pageWindow, rangeWords } from './numbered-pager';

describe('numbered pager', () => {
  it('shows every page when there are few', () => {
    expect(pageWindow(2, 3)).toEqual([1, 2, 3]);
  });
  it('folds the middle of a long list', () => {
    expect(pageWindow(1, 20)).toEqual([1, 2, null, 20]);
    expect(pageWindow(10, 20)).toEqual([1, null, 9, 10, 11, null, 20]);
    expect(pageWindow(20, 20)).toEqual([1, null, 19, 20]);
  });
  it('says the range', () => {
    expect(rangeWords(1, 50, 86)).toBe('Showing 1 to 50 of 86');
    expect(rangeWords(2, 50, 86)).toBe('Showing 51 to 86 of 86');
    expect(rangeWords(1, 50, 0)).toBe('Nothing to show');
  });
});
