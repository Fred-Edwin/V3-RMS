import { describe, expect, it } from 'vitest';

import { addDays, daysBetween, formatDayMonth, formatDayMonthYear, formatFullDate, formatKes, formatWeekdayDayMonth, nairobiDay } from './people-dates';

describe('People date words', () => {
  it('writes the day and month as Paper does', () => {
    expect(formatDayMonth('2026-10-14')).toBe('14 Oct');
    expect(formatWeekdayDayMonth('2026-10-05')).toBe('Mon 5 Oct');
    expect(formatFullDate('2026-10-05')).toBe('Mon 5 Oct 2026');
    expect(formatDayMonthYear('2026-07-14')).toBe('14 Jul 2026');
  });
  it('gives the text back when it is not a date', () => {
    expect(formatDayMonth('soon')).toBe('soon');
  });
  it('counts calendar days across a month end', () => {
    expect(daysBetween('2026-10-31', '2026-11-07')).toBe(7);
    expect(daysBetween('2026-11-07', '2026-10-31')).toBe(-7);
    expect(addDays('2026-10-31', 7)).toBe('2026-11-07');
  });
  it('uses the Nairobi day, not the device day, around midnight', () => {
    expect(nairobiDay(new Date('2026-10-03T21:30:00Z'))).toBe('2026-10-04');
    expect(nairobiDay(new Date('2026-10-03T20:59:00Z'))).toBe('2026-10-03');
  });
  it('writes money with separators and cents only when there are some', () => {
    expect(formatKes('28000')).toBe('KES 28,000');
    expect(formatKes('1200.5')).toBe('KES 1,200.50');
    expect(formatKes('1200.00')).toBe('KES 1,200');
    expect(formatKes(null)).toBe('');
  });
});
