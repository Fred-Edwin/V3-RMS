import { describe, expect, it } from 'vitest';
import { addDays, clockText, daysAgoText, daysBetweenDays, dayEndInstant, dayStartInstant, fullDayText, nairobiDay, shortDayText, startOfNairobiDay, weekdayDayText } from './nairobi-time';

describe('nairobi-time', () => {
  it('reads 21:30 UTC as the next Nairobi day', () => {
    expect(nairobiDay(new Date('2026-10-12T21:30:00Z'))).toBe('2026-10-13');
    expect(nairobiDay(new Date('2026-10-12T20:59:59Z'))).toBe('2026-10-12');
  });

  it('starts a Nairobi day at 21:00 UTC the day before and ends it 24 hours later', () => {
    expect(dayStartInstant('2026-10-13').toISOString()).toBe('2026-10-12T21:00:00.000Z');
    expect(dayEndInstant('2026-10-13').toISOString()).toBe('2026-10-13T21:00:00.000Z');
    expect(startOfNairobiDay(new Date('2026-10-13T08:00:00Z')).toISOString()).toBe('2026-10-12T21:00:00.000Z');
  });

  it('adds days across a month end', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-10-01', -29)).toBe('2026-09-02');
  });

  it('writes days as words', () => {
    expect(shortDayText('2026-10-13')).toBe('13 Oct');
    expect(weekdayDayText('2026-10-13')).toBe('Tue 13 Oct');
    expect(fullDayText('2026-10-13')).toBe('Tue 13 Oct 2026');
    expect(daysBetweenDays('2026-09-14', '2026-10-13')).toBe(29);
  });

  it('says how long ago in whole Nairobi days', () => {
    const now = new Date('2026-10-13T11:20:00Z');
    expect(daysAgoText(new Date('2026-10-13T03:00:00Z'), now)).toBe('Today');
    expect(daysAgoText(new Date('2026-10-12T20:50:00Z'), now)).toBe('Yesterday'); // 23:50 Nairobi last night
    expect(daysAgoText(new Date('2026-10-01T05:00:00Z'), now)).toBe('12 days ago');
  });

  it('writes the Nairobi clock', () => {
    expect(clockText(new Date('2026-10-13T11:20:00Z'))).toBe('14:20');
  });
});
