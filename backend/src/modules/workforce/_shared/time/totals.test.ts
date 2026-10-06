import { describe, expect, it } from 'vitest';
import { deductibleLateness, periodTotals, weeklyTotals, type LateDay } from './totals';
import { parseNairobiDate } from './nairobi-time';
import { periodContaining } from './periods';
import type { DayHours } from './time-types';

const d = parseNairobiDate;
const day = (date: string, over: Partial<DayHours> = {}): DayHours => ({
  shiftDate: d(date),
  status: 'CLOSED',
  scheduledMinutes: 480,
  firstClockIn: null,
  lastClockOut: null,
  workedMinutes: 480,
  breakMinutes: 0,
  leftEarlyMinutes: 0,
  afterEndMinutes: 0,
  lateness: { minutesLate: 0, countsAsLate: false, minutesAfterGrace: 0, earlyMinutes: 0 },
  ...over,
});
const lateDay = (over: Partial<DayHours> = {}) => ({ lateness: { minutesLate: 10, countsAsLate: true, minutesAfterGrace: 5, earlyMinutes: 0 }, ...over });

describe('weeklyTotals', () => {
  it('adds a five day week', () => {
    const days = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'].map((date) => day(date, { afterEndMinutes: 10 }));
    expect(weeklyTotals(days, 1)).toEqual([
      { weekStart: '2026-10-05', weekEnd: '2026-10-11', partial: false, scheduledMinutes: 2400, workedMinutes: 2400, afterEndMinutes: 50, lateDays: 0, absentDays: 0 },
    ]);
  });

  it('counts absent days and late days; OPEN days are skipped', () => {
    const days = [
      day('2026-10-05', lateDay()),
      day('2026-10-06', { status: 'NO_CLOCK', workedMinutes: 0, lateness: null }),
      day('2026-10-07', { status: 'OPEN', workedMinutes: 100 }),
    ];
    expect(weeklyTotals(days, 1)[0]).toMatchObject({ scheduledMinutes: 960, workedMinutes: 480, lateDays: 1, absentDays: 1 });
  });

  it('two shifts in a day are two days that add up', () => {
    expect(weeklyTotals([day('2026-10-05', { workedMinutes: 240 }), day('2026-10-05', { workedMinutes: 200 })], 1)[0]?.workedMinutes).toBe(440);
  });

  it('splits weeks by the week start rule', () => {
    const days = [day('2026-10-10'), day('2026-10-11'), day('2026-10-12')];
    expect(weeklyTotals(days, 1).map((w) => w.weekStart)).toEqual(['2026-10-05', '2026-10-12']);
    expect(weeklyTotals(days, 7).map((w) => w.weekStart)).toEqual(['2026-10-04', '2026-10-11']);
  });
});

describe('periodTotals', () => {
  it('cuts a week at the period boundary and marks it partial', () => {
    const period = { start: d('2026-10-07'), end: d('2026-10-20'), label: 'x' };
    const days = ['2026-10-05', '2026-10-07', '2026-10-13', '2026-10-21'].map((date) => day(date));
    const total = periodTotals(days, period, 1);
    expect(total.workedMinutes).toBe(960);
    expect(total.weeks.map((w) => [w.weekStart, w.partial])).toEqual([
      ['2026-10-05', true],
      ['2026-10-12', false],
    ]);
  });

  it('a full 4-week period has no partial week', () => {
    const period = periodContaining(d('2026-10-01'), { kind: 'FIXED_WEEKS', weeks: 4, anchorDate: '2026-09-21' });
    expect(periodTotals([day('2026-09-21'), day('2026-10-18')], period, 1).weeks.every((w) => !w.partial)).toBe(true);
  });
});

describe('deductibleLateness', () => {
  const late = (date: string, over: Partial<LateDay> = {}): LateDay => ({ shiftDate: d(date), countsAsLate: true, minutesAfterGrace: 5, excused: false, madeUpMinutes: 0, ...over });
  const minutesOf = (result: ReturnType<typeof deductibleLateness>) => result.map((r) => r.chargeableMinutes);

  it('RECORD_ONLY charges nothing', () => {
    expect(minutesOf(deductibleLateness([late('2026-10-05'), late('2026-10-06')], { policy: 'RECORD_ONLY', afterLatesPerMonth: null }))).toEqual([0, 0]);
  });

  it('FROM_FIRST_MINUTE charges the minutes after grace', () => {
    expect(minutesOf(deductibleLateness([late('2026-10-05'), late('2026-10-06', { minutesAfterGrace: 9 })], { policy: 'FROM_FIRST_MINUTE', afterLatesPerMonth: null }))).toEqual([5, 9]);
  });

  it('AFTER_N_LATES: the 4th late in a calendar month is charged and the count restarts next month', () => {
    const days = ['2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06', '2026-10-30', '2026-11-02'].map((date) => late(date));
    expect(minutesOf(deductibleLateness(days, { policy: 'AFTER_N_LATES', afterLatesPerMonth: 3 }))).toEqual([0, 0, 0, 5, 5, 0]);
  });

  it('excused days are free and do not count toward N', () => {
    const days = [late('2026-10-01', { excused: true }), late('2026-10-02'), late('2026-10-05'), late('2026-10-06')];
    expect(minutesOf(deductibleLateness(days, { policy: 'AFTER_N_LATES', afterLatesPerMonth: 2 }))).toEqual([0, 0, 0, 5]);
  });

  it('a fully made-up day is free and does not count toward N; a part made-up day is charged the rest', () => {
    const days = [late('2026-10-01', { madeUpMinutes: 5 }), late('2026-10-02'), late('2026-10-05', { madeUpMinutes: 2 })];
    expect(minutesOf(deductibleLateness(days, { policy: 'AFTER_N_LATES', afterLatesPerMonth: 1 }))).toEqual([0, 0, 3]);
    expect(minutesOf(deductibleLateness(days, { policy: 'FROM_FIRST_MINUTE', afterLatesPerMonth: null }))).toEqual([0, 5, 3]);
  });

  it('days that do not count as late are never charged', () => {
    expect(minutesOf(deductibleLateness([late('2026-10-01', { countsAsLate: false, minutesAfterGrace: 0 })], { policy: 'FROM_FIRST_MINUTE', afterLatesPerMonth: null }))).toEqual([0]);
  });
});
