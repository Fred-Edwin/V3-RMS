import { describe, expect, it } from 'vitest';
import { RULE_DEFAULTS } from '../../rules/rules-defaults';
import { eachDay, instantAt, parseClockTime, parseNairobiDate, type NairobiDate } from '../../_shared/time/nairobi-time';
import type { AttendanceRuleSet, DayData, EntryRow, EventRow, PersonRow } from '../attendance.types';
import { buildLast30, buildMonth, filterRows, monthBounds, type MonthInput } from './time-tab-view';

const RULES: AttendanceRuleSet = { attendance: RULE_DEFAULTS.ATTENDANCE, lateness: { ...RULE_DEFAULTS.LATENESS, graceMinutes: 5 } };
const d = (value: string): NairobiDate => parseNairobiDate(value);
const at = (date: string, clock: string) => instantAt(d(date), parseClockTime(clock));
const TODAY = d('2026-10-24'); // a Saturday
const NOW = at('2026-10-24', '10:12');
const person: PersonRow = { id: 'p1', name: 'Amina Hassan', userId: 'u1', siteId: 's1', departmentId: 'svc', departmentName: 'Service', positionName: null, tracksTime: true };

const entry = (date: string): EntryRow => ({ id: `e-${date}`, employeeId: 'p1', date: d(date), templateName: 'Morning', colour: 'BLUE', startTime: '06:00', endTime: '14:00', unpaidBreakMinutes: 0 });
let seq = 0;
const tap = (date: string, type: 'IN' | 'OUT', clock: string): EventRow => {
  seq += 1;
  return {
    id: `ev${seq}`, employeeId: 'p1', rotaEntryId: `e-${date}`, shiftDate: d(date), type, source: 'PHONE', occurredAt: at(date, clock), serverAt: at(date, clock),
    createdAt: new Date(at(date, clock).getTime() + seq), clientEventId: null, correctsEventId: null, voidsCorrected: false, skewFlagged: false,
    reasonCode: null, reason: null, recordedById: null,
  };
};

// Sat 24 open since 06:00 (4 h 12 m so far) | Fri 23 in 06:12 (late) out 14:00 | Thu 22 never clocked | Wed 21 on leave | Tue 20 free
// Mon 19 on time, 85 minutes of approved overtime | Sat 10 rostered before the clock was switched on (nothing proved) | Mon 26 rostered ahead
const data: DayData = {
  entries: ['2026-10-24', '2026-10-23', '2026-10-22', '2026-10-21', '2026-10-19', '2026-10-08', '2026-10-26'].map(entry),
  events: [tap('2026-10-24', 'IN', '06:00'), tap('2026-10-23', 'IN', '06:12'), tap('2026-10-23', 'OUT', '14:00'), tap('2026-10-19', 'IN', '05:58'), tap('2026-10-19', 'OUT', '15:25')],
  answers: [],
};
const everyDay = eachDay(d('2026-09-01'), d('2026-10-31'));
const input: MonthInput = {
  person, month: '2026-10', today: TODAY, now: NOW, data,
  rulesByDay: new Map(everyDay.map((day) => [day, RULES] as const)),
  leaveDays: new Set([d('2026-10-21')]),
  overtimeByDay: new Map([[d('2026-10-19'), 85]]),
  trackedFrom: d('2026-10-10'),
  employed: { from: d('2026-10-05'), to: null },
};
const month = buildMonth(input);
const rowOf = (date: string) => month.rows.find((r) => r.date === date);

describe('a person\'s month on the Time tab', () => {
  it('finds the first and last day of the month', () => {
    expect(monthBounds('2026-10')).toEqual({ first: '2026-10-01', last: '2026-10-31' });
    expect(monthBounds('2028-02').last).toBe('2028-02-29');
  });

  it('lists days newest first and leaves out what proves nothing', () => {
    expect(month.rows.map((r) => r.date).slice(0, 6)).toEqual(['2026-10-26', '2026-10-24', '2026-10-23', '2026-10-22', '2026-10-21', '2026-10-20']);
    expect(rowOf('2026-10-27')).toBeUndefined(); // a free day that has not come
    expect(rowOf('2026-10-08')).toBeUndefined(); // rostered before the clock was on: not "absent"
  });

  it('marks today open with the minutes so far', () => {
    expect(rowOf('2026-10-24')).toMatchObject({ kind: 'ON_SHIFT', clockedOutAt: null, soFarMinutes: 252 });
  });

  it('marks a late day, an absent day, leave, a day off and a day ahead', () => {
    expect(rowOf('2026-10-23')).toMatchObject({ kind: 'WORKED', late: true, minutesLate: 12, minutesAfterGrace: 7 });
    expect(rowOf('2026-10-22')).toMatchObject({ kind: 'ABSENT', workedMinutes: 0 });
    expect(rowOf('2026-10-21')?.kind).toBe('ON_LEAVE');
    expect(rowOf('2026-10-20')?.kind).toBe('DAY_OFF');
    expect(rowOf('2026-10-26')?.kind).toBe('UPCOMING');
  });

  it('shows approved overtime on its day and totals it for the month', () => {
    expect(rowOf('2026-10-19')).toMatchObject({ kind: 'WORKED', late: false, overtimeApprovedMinutes: 85 });
    expect(month.summary.overtimeApprovedMinutes).toBe(85);
  });

  it('shows no days before the person started or after they left', () => {
    expect(month.rows.some((r) => r.date < '2026-10-05')).toBe(false);
    const left = buildMonth({ ...input, employed: { from: d('2026-10-05'), to: d('2026-10-20') } });
    expect(left.rows.find((r) => r.date === '2026-10-20')?.kind).toBe('DAY_OFF');
    expect(left.rows.find((r) => r.date === '2026-10-21')).toBeUndefined();
  });

  it('adds up the five summary figures', () => {
    expect(month.summary).toMatchObject({ daysWorked: 3, rosteredDays: 5, lateDays: 1, lateMinutes: 7, absentDays: 1 });
    expect(month.summary.workedMinutes).toBeGreaterThan(900);
  });

  it('counts each filter chip and filters the rows', () => {
    expect(month.counts).toEqual({ all: month.rows.length, late: 1, overtime: 1, absent: 1 });
    expect(filterRows(month.rows, 'late').map((r) => r.date)).toEqual(['2026-10-23']);
    expect(filterRows(month.rows, 'overtime').map((r) => r.date)).toEqual(['2026-10-19']);
    expect(filterRows(month.rows, 'absent').map((r) => r.date)).toEqual(['2026-10-22']);
    expect(filterRows(month.rows, 'all')).toHaveLength(month.rows.length);
  });

  it('shows no absences at all while the clock is off', () => {
    const off = buildMonth({ ...input, trackedFrom: null });
    expect(off.summary.absentDays).toBe(0);
    expect(off.rows.find((r) => r.date === '2026-10-22')).toBeUndefined();
    expect(off.rows.find((r) => r.date === '2026-10-23')?.kind).toBe('WORKED'); // days with a clock stay
  });

  it('works out the last 30 days including today', () => {
    const last30 = buildLast30(input, d('2026-09-25'));
    expect(last30).toEqual({ lateDays: 1, lateMinutes: 7, shiftsWorked: 3, shiftsOnTime: 2 });
  });
});
