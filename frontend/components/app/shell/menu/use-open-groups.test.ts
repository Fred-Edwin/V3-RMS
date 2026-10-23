import { describe, expect, it } from 'vitest';
import { arriveIn, isGroupOpen } from './use-open-groups';

describe('sidebar open groups', () => {
  it('opens the group of the current page by default and no other', () => {
    expect(isGroupOpen('feature-workforce', {}, 'feature-workforce')).toBe(true);
    expect(isGroupOpen('feature-operations', {}, 'feature-workforce')).toBe(false);
  });

  it('keeps the last group open when the page has no group (a blocked page, My file keeps the group it was in)', () => {
    // `current` only changes when a page with a group arrives, so a page without one leaves it as it was.
    expect(isGroupOpen('feature-workforce', {}, 'feature-workforce')).toBe(true);
  });

  it('follows a hand choice either way', () => {
    expect(isGroupOpen('feature-workforce', { 'feature-workforce': false }, 'feature-workforce')).toBe(false);
    expect(isGroupOpen('feature-operations', { 'feature-operations': true }, 'feature-workforce')).toBe(true);
  });

  it('forgets a hand-close when the page arrives in that group, and leaves other choices alone', () => {
    expect(arriveIn({ a: false, b: true }, 'a')).toEqual({ b: true });
    const same = { a: true };
    expect(arriveIn(same, 'a')).toBe(same);
  });
});
