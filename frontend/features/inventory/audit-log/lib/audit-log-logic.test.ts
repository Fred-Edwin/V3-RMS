import { describe, expect, it } from 'vitest';

import { periodSentence, periodStart, whenLabel } from './audit-log-logic';

const now = new Date(2026, 9, 3, 13, 30);

describe('audit log period', () => {
  it('starts today at local midnight, a week or a month back, or never', () => {
    expect(new Date(periodStart('TODAY', now) as string).getTime()).toBe(new Date(2026, 9, 3).getTime());
    expect(new Date(periodStart('7D', now) as string).getTime()).toBe(new Date(2026, 8, 27).getTime());
    expect(new Date(periodStart('30D', now) as string).getTime()).toBe(new Date(2026, 8, 4).getTime());
    expect(periodStart('ANY', now)).toBeUndefined();
  });
  it('says what is shown', () => {
    expect(periodSentence('TODAY', now)).toContain('today, Sat 3 Oct 2026');
    expect(periodSentence('ANY', now)).toBe('Showing everything on record.');
  });
});

describe('whenLabel', () => {
  it('drops the date for today only', () => {
    expect(whenLabel(new Date(2026, 9, 3, 11, 5).toISOString(), now)).toBe('11:05');
    expect(whenLabel(new Date(2026, 9, 2, 16, 20).toISOString(), now)).toBe('2 Oct 16:20');
  });
});
