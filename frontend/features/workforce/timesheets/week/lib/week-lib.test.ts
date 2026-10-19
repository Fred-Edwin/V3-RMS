import { describe, expect, it } from 'vitest';

import type { Day, Overtime, PersonPeriod } from '../../_shared/types/timesheet-types';
import { DECLINE_REASONS, evidenceLines, limitLines, partMinutes, reasonNeeded } from '../../overtime/lib/overtime-view';
import { dayRange, dayStatus, defaultWeekIndex, systemLine, weeksWithDays } from './week-view';

const day = (shiftDate: string, over: Partial<Day> = {}): Day => ({ id: shiftDate, periodId: 'p', employeeId: 'e', shiftDate, status: 'AUTO_APPROVED', reasons: [], scheduledMinutes: 480, workedMinutes: 480, minutesLate: 0, minutesAfterGrace: 0, leftEarlyMinutes: 0, afterEndMinutes: 0, lateExcused: false, decidedById: null, decidedAt: null, decisionReason: null, carriedFromPeriodId: null, ...over });

const person = (days: Day[]): PersonPeriod => ({
  period: { id: 'p', organizationId: 's', start: '2026-10-01', end: '2026-10-31', label: 'October 2026', cutoffAt: '', state: 'OPEN', reportNumber: 1, closeKind: null, closedAt: null, closedById: null, signedById: null, signedAt: null, reopenedAt: null, reopenedById: null, reopenReason: null },
  person: { id: 'e', name: 'Cynthia', departmentName: 'Barista' },
  days,
  weeks: [
    { weekStart: '2026-09-28', status: 'AUTO_APPROVED', scheduledMinutes: 960, workedMinutes: 960, partWeek: true },
    { weekStart: '2026-10-05', status: 'NEEDS_LOOK', scheduledMinutes: 960, workedMinutes: 960, partWeek: false },
    { weekStart: '2026-10-12', status: 'AUTO_APPROVED', scheduledMinutes: 0, workedMinutes: 0, partWeek: false },
  ],
  overtime: [],
  requests: [],
});

describe('a person’s weeks', () => {
  const days = [day('2026-10-02'), day('2026-10-01'), day('2026-10-06', { status: 'NEEDS_LOOK' }), day('2026-10-07')];
  const weeks = weeksWithDays(person(days));

  it('puts each day in its Monday-to-Sunday week, in order, and drops weeks with no days', () => {
    expect(weeks.map((w) => [w.week.weekStart, w.days.map((d) => d.shiftDate)])).toEqual([
      ['2026-09-28', ['2026-10-01', '2026-10-02']],
      ['2026-10-05', ['2026-10-06', '2026-10-07']],
    ]);
    expect(weeks[0]?.week.partWeek).toBe(true);
  });

  it('opens on the first week with something to decide, else the latest that has started', () => {
    expect(defaultWeekIndex(weeks, '2026-10-19')).toBe(1);
    const quiet = weeksWithDays(person([day('2026-10-01'), day('2026-10-06')]));
    expect(defaultWeekIndex(quiet, '2026-10-06')).toBe(1);
    expect(defaultWeekIndex(quiet, '2026-10-02')).toBe(0);
  });
});

describe('a day’s clock range', () => {
  it('reads the clock-in and clock-out in Nairobi time, an open shift with dots, and nothing when the API sent none', () => {
    expect(dayRange(day('2026-10-05', { clockIn: '2026-10-05T11:02:00.000Z', clockOut: '2026-10-05T19:01:00.000Z' }))).toBe('14:02 → 22:01');
    expect(dayRange(day('2026-10-05', { clockIn: '2026-10-05T11:02:00.000Z', clockOut: null }))).toBe('14:02 → …');
    expect(dayRange(day('2026-10-05'))).toBeNull();
    expect(dayRange(day('2026-10-05', { clockIn: null, clockOut: null }))).toBeNull();
  });
});

describe('what a day says', () => {
  it('says approved by the system, with the minutes late when they were past the grace', () => {
    expect(dayStatus(day('2026-10-01')).text).toBe('Approved by the system');
    expect(dayStatus(day('2026-10-01', { minutesLate: 5, minutesAfterGrace: 5 })).text).toBe('Approved · 5 min late, recorded');
    expect(dayStatus(day('2026-10-01', { status: 'NEEDS_LOOK' }))).toEqual({ text: 'Needs you', tone: 'warning' });
  });

  it('counts the days the system approved for the green line', () => {
    expect(systemLine([day('a'), day('b'), day('c', { status: 'NEEDS_LOOK' })])).toBe('2 of 3 days matched the rota and were approved by the system. Nothing for you to approve there.');
    expect(systemLine([day('a', { status: 'NEEDS_LOOK' })])).toBeNull();
  });
});

const item = (over: Partial<Overtime> = {}): Overtime => ({
  id: 'o',
  periodId: 'p',
  employeeId: 'e',
  shiftDate: '2026-10-07',
  rawMinutes: 90,
  serviceTailMinutes: 20,
  autoMinutes: 20,
  needsMinutes: 70,
  authorisedMinutes: 20,
  status: 'PENDING',
  evidence: { openWorkAtEnd: true, ordersTaken: 3, ticketsCleared: 2, openOrdersAtEnd: 3 },
  limits: { weeklyCapMinutes: 2880, weekMinutes: 2490, overCapMinutes: 0, branchBudgetMinutes: 600, branchUsedMinutes: 245, insideAllowance: true },
  decidedById: null,
  decidedAt: null,
  decisionReason: null,
  ...over,
});

describe('the overtime decision', () => {
  it('writes the evidence as counts and the limits as the rules stand, with no money', () => {
    const lines = [...evidenceLines(item()), ...limitLines(item())].join('\n');
    expect(lines).toContain('Work was open at the shift end: 3 orders');
    expect(lines).toContain('Their week: 41 h 30 of the 48 h limit');
    expect(lines).toContain('Branch overtime this month: 4 h 05 of 10 h');
    expect(lines).not.toMatch(/KES|Ksh|pay rate/i);
  });

  it('offers about half as "approve part", only when there is enough to split', () => {
    expect(partMinutes(90)).toBe(45);
    expect(partMinutes(70)).toBe(35);
    expect(partMinutes(8)).toBeNull();
  });

  it('asks for a reason to decline, or to authorise above the limit, and for none inside it', () => {
    expect(reasonNeeded('DECLINE', true)).toBe('decline');
    expect(reasonNeeded('ALL', false)).toBe('over-limit');
    expect(reasonNeeded('PART', true)).toBeNull();
    expect(DECLINE_REASONS.length).toBeGreaterThan(5);
  });
});
