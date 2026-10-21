import { describe, expect, it } from 'vitest';

import { markOf, markSpoken, markText, sumMark } from './attention';

describe('the sidebar attention marks', () => {
  it('draws nothing when nothing waits', () => {
    expect(markOf(0, false)).toBeNull();
    expect(markOf(undefined, true)).toBeNull();
    expect(sumMark([])).toBeNull();
    expect(sumMark([{ count: 0 }, {}])).toBeNull();
  });

  it('shows the number, and 99+ over 99', () => {
    expect(markText(3)).toBe('3');
    expect(markText(99)).toBe('99');
    expect(markText(100)).toBe('99+');
  });

  it('is amber unless something is overdue', () => {
    expect(markOf(3, false)).toEqual({ count: 3, urgent: false });
    expect(markOf(3, true)).toEqual({ count: 3, urgent: true });
  });

  it('sums a closed feature, and is urgent when any link with something waiting is', () => {
    expect(sumMark([{ count: 3 }, { count: 2 }])).toEqual({ count: 5, urgent: false });
    expect(sumMark([{ count: 3 }, { count: 2, urgent: true }])).toEqual({ count: 5, urgent: true });
    // an urgent flag on a link with nothing waiting does not count
    expect(sumMark([{ count: 0, urgent: true }, { count: 4 }])).toEqual({ count: 4, urgent: false });
  });

  it('says it aloud for a screen reader', () => {
    expect(markSpoken({ count: 2, urgent: true })).toBe('2 waiting, overdue');
    expect(markSpoken({ count: 120, urgent: false })).toBe('99+ waiting');
  });
});
