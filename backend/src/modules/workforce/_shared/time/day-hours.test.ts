import { describe, expect, it } from 'vitest';
import { computeDayHours, resolveClockPairs } from './day-hours';
import { parseClockTime, parseNairobiDate } from './nairobi-time';
import type { ClockEventFact, ClockPair, ShiftWindow } from './time-types';

const shift = (start: string, end: string, unpaidBreakMinutes = 0): ShiftWindow => ({
  date: parseNairobiDate('2026-10-06'),
  startTime: parseClockTime(start),
  endTime: parseClockTime(end),
  unpaidBreakMinutes,
});
const z = (hhmm: string) => new Date(`2026-10-06T${hhmm}:00Z`); // UTC; 03:00Z is 06:00 Nairobi
const pair = (clockIn: string, clockOut: string | null, closedBy: 'OUT' | 'AUTO_OUT' | null = clockOut ? 'OUT' : null): ClockPair => ({
  clockIn: z(clockIn),
  clockOut: clockOut ? z(clockOut) : null,
  closedBy,
});
const rules = (roundingMinutes: 0 | 1 | 5 | 10 | 15 | 30 = 0, roundingMode: 'NEAREST' | 'DOWN' | 'UP' = 'NEAREST', graceMinutes = 5) => ({
  attendance: { roundingMinutes, roundingMode },
  lateness: { graceMinutes },
});
const NOW = z('12:00');

const ev = (id: string, type: ClockEventFact['type'], at: string, extra: Partial<ClockEventFact> = {}): ClockEventFact => ({
  id,
  type,
  occurredAt: z(at),
  correctsEventId: null,
  voidsCorrected: false,
  ...extra,
});

describe('resolveClockPairs', () => {
  it('pairs an IN with its OUT', () => {
    const { pairs, unmatched } = resolveClockPairs([ev('a', 'IN', '03:00'), ev('b', 'OUT', '11:00')]);
    expect(pairs).toEqual([{ clockIn: z('03:00'), clockOut: z('11:00'), closedBy: 'OUT' }]);
    expect(unmatched).toEqual([]);
  });

  it('undo of an OUT (void correction) leaves the shift open', () => {
    const { pairs } = resolveClockPairs([ev('a', 'IN', '03:00'), ev('b', 'OUT', '11:00'), ev('c', 'CORRECTION', '11:01', { correctsEventId: 'b', voidsCorrected: true })]);
    expect(pairs).toEqual([{ clockIn: z('03:00'), clockOut: null, closedBy: null }]);
  });

  it('a corrected IN time replaces the old one', () => {
    const { pairs } = resolveClockPairs([ev('a', 'IN', '03:20'), ev('b', 'OUT', '11:00'), ev('c', 'CORRECTION', '03:05', { correctsEventId: 'a' })]);
    expect(pairs[0]?.clockIn).toEqual(z('03:05'));
  });

  it('a later correction beats an earlier one', () => {
    const { pairs } = resolveClockPairs([
      ev('a', 'IN', '03:20'),
      ev('b', 'OUT', '11:00'),
      ev('c', 'CORRECTION', '03:10', { correctsEventId: 'a' }),
      ev('d', 'CORRECTION', '03:02', { correctsEventId: 'a' }),
    ]);
    expect(pairs[0]?.clockIn).toEqual(z('03:02'));
  });

  it('an orphan OUT is unmatched', () => {
    const { pairs, unmatched } = resolveClockPairs([ev('b', 'OUT', '11:00')]);
    expect(pairs).toEqual([]);
    expect(unmatched.map((e) => e.id)).toEqual(['b']);
  });

  it('a duplicate event id counts once', () => {
    const { pairs } = resolveClockPairs([ev('a', 'IN', '03:00'), ev('a', 'IN', '03:00'), ev('b', 'OUT', '11:00')]);
    expect(pairs).toHaveLength(1);
  });

  it('two segments in one shift', () => {
    const { pairs } = resolveClockPairs([ev('a', 'IN', '03:00'), ev('b', 'OUT', '06:00'), ev('c', 'IN', '07:00'), ev('d', 'AUTO_OUT', '11:00')]);
    expect(pairs).toHaveLength(2);
    expect(pairs[1]?.closedBy).toBe('AUTO_OUT');
  });
});

describe('computeDayHours', () => {
  it('a normal day with a 30 minute break', () => {
    const day = computeDayHours(shift('06:00', '14:00', 30), [pair('03:00', '11:00')], NOW, rules());
    expect(day).toMatchObject({ status: 'CLOSED', scheduledMinutes: 450, workedMinutes: 450, breakMinutes: 30, afterEndMinutes: 0, leftEarlyMinutes: 0 });
    expect(day.lateness).toMatchObject({ minutesLate: 0 });
  });

  it('early arrival is not counted', () => {
    const day = computeDayHours(shift('06:00', '14:00', 30), [pair('02:45', '11:00')], NOW, rules());
    expect(day.workedMinutes).toBe(450);
    expect(day.lateness?.earlyMinutes).toBe(15);
  });

  it('stay-on time goes to afterEndMinutes, not workedMinutes', () => {
    const day = computeDayHours(shift('06:00', '14:00', 30), [pair('03:00', '11:20')], NOW, rules());
    expect(day.workedMinutes).toBe(450);
    expect(day.afterEndMinutes).toBe(20);
  });

  it('stay-on past midnight belongs to the shift date', () => {
    const late = shift('22:00', '23:59');
    const day = computeDayHours(late, [{ clockIn: new Date('2026-10-06T19:00:00Z'), clockOut: new Date('2026-10-06T21:40:00Z'), closedBy: 'OUT' }], NOW, rules());
    expect(day.shiftDate).toBe('2026-10-06');
    expect(day.afterEndMinutes).toBe(41);
    expect(day.workedMinutes).toBe(119);
  });

  it('leaving early', () => {
    const day = computeDayHours(shift('06:00', '14:00', 30), [pair('03:00', '10:30')], NOW, rules());
    expect(day.leftEarlyMinutes).toBe(30);
    expect(day.workedMinutes).toBe(420);
  });

  it('a break longer than the time worked takes only what was worked', () => {
    const day = computeDayHours(shift('06:00', '14:00', 60), [pair('03:00', '03:20')], NOW, rules());
    expect(day.breakMinutes).toBe(20);
    expect(day.workedMinutes).toBe(0);
  });

  it('adds the segments of one shift and skips the gap', () => {
    const day = computeDayHours(shift('06:00', '14:00'), [pair('03:00', '06:00'), pair('07:00', '11:00')], NOW, rules());
    expect(day.workedMinutes).toBe(420);
  });

  describe('rounding', () => {
    const run = (minutes: 5 | 15 | 30, mode: 'NEAREST' | 'DOWN' | 'UP', out: string, s = shift('06:00', '14:00')) =>
      computeDayHours(s, [pair('03:00', out)], NOW, rules(minutes, mode)).workedMinutes;

    it('NEAREST, DOWN and UP at 5 minutes (473 worked)', () => {
      expect(run(5, 'NEAREST', '10:53')).toBe(475);
      expect(run(5, 'DOWN', '10:53')).toBe(470);
      expect(run(5, 'UP', '10:53')).toBe(475);
    });

    it('NEAREST, DOWN and UP at 15 minutes (470 worked)', () => {
      expect(run(15, 'NEAREST', '10:50')).toBe(465);
      expect(run(15, 'DOWN', '10:50')).toBe(465);
      expect(run(15, 'UP', '10:50')).toBe(480);
    });

    it('never goes above the scheduled minutes', () => {
      const s = shift('06:00', '14:00', 20); // scheduled 460
      expect(run(30, 'UP', '10:55', s)).toBe(460);
    });
  });

  it('an open pair counts up to now and marks the day OPEN', () => {
    const day = computeDayHours(shift('06:00', '14:00'), [pair('03:00', null)], z('05:00'), rules());
    expect(day).toMatchObject({ status: 'OPEN', workedMinutes: 120, lastClockOut: null });
  });

  it('a pair closed by AUTO_OUT marks the day AUTO_CLOSED', () => {
    const day = computeDayHours(shift('06:00', '14:00'), [pair('03:00', '11:00', 'AUTO_OUT')], NOW, rules());
    expect(day.status).toBe('AUTO_CLOSED');
  });

  it('no clock at all: zero worked, lateness null', () => {
    const day = computeDayHours(shift('06:00', '14:00', 30), [], NOW, rules());
    expect(day).toMatchObject({ status: 'NO_CLOCK', workedMinutes: 0, scheduledMinutes: 450, lateness: null, firstClockIn: null });
  });

  it('lateness uses the first clock-in and the grace rule', () => {
    const day = computeDayHours(shift('06:00', '14:00'), [pair('03:08', '11:00')], NOW, rules(0, 'NEAREST', 5));
    expect(day.lateness).toMatchObject({ minutesLate: 8, countsAsLate: true, minutesAfterGrace: 3 });
    expect(day.workedMinutes).toBe(472);
  });

  it('refuses an overnight shift', () => {
    expect(() => computeDayHours(shift('18:00', '02:00'), [], NOW, rules())).toThrow();
  });
});
