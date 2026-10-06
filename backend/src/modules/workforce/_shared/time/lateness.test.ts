import { describe, expect, it } from 'vitest';
import { assertNoOvernight, computeLateness, shiftInstants } from './lateness';
import { parseClockTime, parseNairobiDate } from './nairobi-time';
import type { ShiftWindow } from './time-types';

const shift = (start: string, end: string, date = '2026-10-06'): ShiftWindow => ({
  date: parseNairobiDate(date),
  startTime: parseClockTime(start),
  endTime: parseClockTime(end),
  unpaidBreakMinutes: 0,
});

describe('computeLateness', () => {
  const morning = shift('06:00', '14:00');

  it('a 06:05 clock-in on a 06:00 shift is 5 minutes late, whatever the server zone', () => {
    const result = computeLateness(morning, new Date('2026-10-06T03:05:00Z'), { graceMinutes: 0 });
    expect(result.minutesLate).toBe(5);
  });

  it('grace 5: 5 minutes late is recorded but does not count', () => {
    const result = computeLateness(morning, new Date('2026-10-06T03:05:00Z'), { graceMinutes: 5 });
    expect(result).toEqual({ minutesLate: 5, countsAsLate: false, minutesAfterGrace: 0, earlyMinutes: 0 });
  });

  it('grace 4: counts, with 1 minute after grace', () => {
    const result = computeLateness(morning, new Date('2026-10-06T03:05:00Z'), { graceMinutes: 4 });
    expect(result).toMatchObject({ countsAsLate: true, minutesAfterGrace: 1 });
  });

  it('grace 0: counts, 5 after grace', () => {
    const result = computeLateness(morning, new Date('2026-10-06T03:05:00Z'), { graceMinutes: 0 });
    expect(result).toMatchObject({ countsAsLate: true, minutesAfterGrace: 5 });
  });

  it('floors: 06:00:59 is 0 late', () => {
    expect(computeLateness(morning, new Date('2026-10-06T03:00:59Z'), { graceMinutes: 0 }).minutesLate).toBe(0);
  });

  it('early arrival is 15 early and 0 late', () => {
    const result = computeLateness(morning, new Date('2026-10-06T02:45:00Z'), { graceMinutes: 0 });
    expect(result).toMatchObject({ minutesLate: 0, earlyMinutes: 15, countsAsLate: false });
  });

  it('a clock-in after the shift end is computed, not a crash', () => {
    expect(computeLateness(morning, new Date('2026-10-06T12:00:00Z'), { graceMinutes: 5 }).minutesLate).toBe(540);
  });

  it('works for an afternoon and a late shift', () => {
    expect(computeLateness(shift('14:00', '22:00'), new Date('2026-10-06T11:07:00Z'), { graceMinutes: 5 })).toMatchObject({
      minutesLate: 7,
      countsAsLate: true,
      minutesAfterGrace: 2,
    });
    expect(computeLateness(shift('22:00', '23:59'), new Date('2026-10-06T19:10:00Z'), { graceMinutes: 5 }).minutesLate).toBe(10);
  });
});

describe('assertNoOvernight', () => {
  it('throws for 18:00 to 02:00, equal times and an end of 00:00', () => {
    expect(() => assertNoOvernight(shift('18:00', '02:00'))).toThrow();
    expect(() => assertNoOvernight(shift('09:00', '09:00'))).toThrow();
    expect(() => assertNoOvernight(shift('18:00', '00:00'))).toThrow();
  });

  it('accepts 22:00 to 23:59', () => {
    expect(() => assertNoOvernight(shift('22:00', '23:59'))).not.toThrow();
  });
});

describe('shiftInstants', () => {
  it('gives the UTC instants of the Nairobi start and end', () => {
    const { start, end } = shiftInstants(shift('06:00', '14:00'));
    expect(start.toISOString()).toBe('2026-10-06T03:00:00.000Z');
    expect(end.toISOString()).toBe('2026-10-06T11:00:00.000Z');
  });
});
