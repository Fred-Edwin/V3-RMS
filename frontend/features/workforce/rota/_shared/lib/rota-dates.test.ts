import { describe, expect, it } from 'vitest';

import { addDays, columnHead, isPastDay, longDay, mondayOf, needsReasonOn, nairobiToday, printedDay, printedStamp, weekDates, weekLabel, weekLongRange, weekPhoneRange, weekShortRange } from './rota-dates';

describe('Rota dates', () => {
  it('finds the Monday of any day', () => {
    expect(mondayOf('2026-10-12')).toBe('2026-10-12');
    expect(mondayOf('2026-10-18')).toBe('2026-10-12');
    expect(mondayOf('2026-10-19')).toBe('2026-10-19');
    expect(mondayOf('2026-01-01')).toBe('2025-12-29');
  });
  it('lists the seven days and steps across months', () => {
    expect(weekDates('2026-09-28')).toEqual(['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
    expect(addDays('2026-02-27', 2)).toBe('2026-03-01');
  });
  it('writes the words Paper draws', () => {
    expect(columnHead('2026-10-12')).toBe('MON 12');
    expect(weekLabel('2026-10-12')).toBe('Mon 12 to Sun 18 October 2026');
    expect(weekShortRange('2026-10-12')).toBe('12 to 18 October');
    expect(weekShortRange('2026-09-28')).toBe('28 September to 4 October');
    expect(weekPhoneRange('2026-10-12')).toBe('Mon 12 to Sun 18 Oct');
    expect(longDay('2026-10-17')).toBe('Saturday 17 October');
    expect(weekLongRange('2026-10-12')).toBe('Monday 12 to Sunday 18 October 2026');
    expect(weekLongRange('2026-09-28')).toBe('Monday 28 September to Sunday 4 October 2026');
  });
  it('reads "today" in Nairobi time, which is three hours ahead of UTC', () => {
    expect(nairobiToday(new Date('2026-10-17T22:30:00Z'))).toBe('2026-10-18');
    expect(nairobiToday(new Date('2026-10-17T20:30:00Z'))).toBe('2026-10-17');
  });
  it('asks for a reason on today and tomorrow only, and refuses the past', () => {
    expect(needsReasonOn('2026-10-12', '2026-10-12')).toBe(true);
    expect(needsReasonOn('2026-10-13', '2026-10-12')).toBe(true);
    expect(needsReasonOn('2026-10-14', '2026-10-12')).toBe(false);
    expect(needsReasonOn('2026-10-11', '2026-10-12')).toBe(false);
    expect(isPastDay('2026-10-11', '2026-10-12')).toBe(true);
    expect(isPastDay('2026-10-12', '2026-10-12')).toBe(false);
  });
  it('writes the printed stamp in Nairobi time', () => {
    expect(printedDay('2026-10-09T13:40:00Z')).toBe('9 October 2026');
    expect(printedStamp('2026-10-09T13:40:00Z')).toBe('9 Oct 2026, 16:40');
  });
});
