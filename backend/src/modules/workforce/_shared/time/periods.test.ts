import { describe, expect, it } from 'vitest';
import { isInPeriod, periodContaining, periodsBetween, type PeriodRule } from './periods';
import { parseNairobiDate } from './nairobi-time';

const d = parseNairobiDate;
const fourWeeks: PeriodRule = { kind: 'FIXED_WEEKS', weeks: 4, anchorDate: '2026-09-21' };
const month: PeriodRule = { kind: 'CALENDAR_MONTH' };

describe('FIXED_WEEKS periods', () => {
  it('4 weeks from Mon 21 Sep 2026 is 21 Sep to 18 Oct, then 19 Oct to 15 Nov', () => {
    expect(periodContaining(d('2026-10-01'), fourWeeks)).toEqual({ start: '2026-09-21', end: '2026-10-18', label: '21 Sep to 18 Oct 2026' });
    expect(periodContaining(d('2026-10-19'), fourWeeks)).toMatchObject({ start: '2026-10-19', end: '2026-11-15' });
  });

  it('works backwards before the anchor', () => {
    expect(periodContaining(d('2026-09-20'), fourWeeks)).toMatchObject({ start: '2026-08-24', end: '2026-09-20' });
  });

  it('labels a period that crosses a year with both years', () => {
    expect(periodContaining(d('2026-12-30'), fourWeeks).label).toBe('14 Dec 2026 to 10 Jan 2027');
  });

  it('periodsBetween spans three periods', () => {
    const periods = periodsBetween(d('2026-10-01'), d('2026-11-20'), fourWeeks);
    expect(periods.map((p) => p.start)).toEqual(['2026-09-21', '2026-10-19', '2026-11-16']);
  });
});

describe('CALENDAR_MONTH periods', () => {
  it('February in a leap year', () => {
    expect(periodContaining(d('2028-02-10'), month)).toEqual({ start: '2028-02-01', end: '2028-02-29', label: 'February 2028' });
  });
  it('October 2026', () => {
    expect(periodContaining(d('2026-10-31'), month)).toMatchObject({ start: '2026-10-01', end: '2026-10-31', label: 'October 2026' });
  });
  it('periodsBetween across a year end', () => {
    expect(periodsBetween(d('2026-12-15'), d('2027-01-02'), month).map((p) => p.label)).toEqual(['December 2026', 'January 2027']);
  });
});

describe('isInPeriod', () => {
  const period = periodContaining(d('2026-10-01'), fourWeeks);
  it('includes both edges and excludes the days around them', () => {
    expect(isInPeriod(d('2026-09-21'), period)).toBe(true);
    expect(isInPeriod(d('2026-10-18'), period)).toBe(true);
    expect(isInPeriod(d('2026-09-20'), period)).toBe(false);
    expect(isInPeriod(d('2026-10-19'), period)).toBe(false);
  });
});
