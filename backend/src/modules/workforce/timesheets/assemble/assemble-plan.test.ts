import { describe, expect, it } from 'vitest';
import { addDays, instantAt, parseClockTime, parseNairobiDate, type NairobiDate } from '../../_shared/time/nairobi-time';
import { buildEntryDay } from '../../attendance/days/day-model';
import type { AttendanceRuleSet, EntryRow, EventRow, PersonDay, PersonRow } from '../../attendance/attendance.types';
import { RULE_DEFAULTS } from '../../rules/rules-defaults';
import type { DayWrite } from '../days/timesheet-days-repository';
import type { OvertimeWrite } from '../overtime/overtime-repository';
import type { DayRow, OvertimeRow } from '../timesheets.types';
import { planTimesheet, type PlanInput, type PlanRules } from './assemble-plan';

const RULES: AttendanceRuleSet = { attendance: RULE_DEFAULTS.ATTENDANCE, lateness: { ...RULE_DEFAULTS.LATENESS, graceMinutes: 5 } };
const PLAN_RULES: PlanRules = { graceMinutes: 5, makeUpSameDay: false, serviceTailMinutes: 15, weeklyCapMinutes: 120, branchBudgetMinutesPerPeriod: null };
const MONDAY = parseNairobiDate('2026-10-05');
const TODAY = parseNairobiDate('2026-10-12');
const person: PersonRow = { id: 'p1', name: 'Amina Hassan', userId: 'u1', siteId: 's1', departmentId: 'd1', departmentName: 'Service', tracksTime: true };

let seq = 0;
const stamp = (date: NairobiDate, clock: string) => instantAt(date, parseClockTime(clock));
const ev = (date: NairobiDate, type: EventRow['type'], clock: string): EventRow => {
  seq += 1;
  return {
    id: `ev${seq}`, employeeId: 'p1', rotaEntryId: `e-${date}`, shiftDate: date, type, source: 'PHONE', occurredAt: stamp(date, clock), serverAt: stamp(date, clock),
    createdAt: new Date(stamp(date, clock).getTime() + seq), clientEventId: null, correctsEventId: null, voidsCorrected: false, skewFlagged: false,
    reasonCode: null, reason: null, recordedById: null,
  };
};
const personDay = (date: NairobiDate, inAt: string, outAt: string): PersonDay => {
  const entry: EntryRow = { id: `e-${date}`, employeeId: 'p1', date, templateName: 'Morning', colour: 'BLUE', startTime: '06:00', endTime: '14:00', unpaidBreakMinutes: 0 };
  const entryDay = buildEntryDay(entry, [ev(date, 'IN', inAt), ev(date, 'OUT', outAt)], null, RULES, stamp(TODAY, '12:00'));
  return { person, date, entries: [entryDay], unscheduled: [] };
};

// Mon to Fri on time, Tue 20 minutes late, Thu 40 minutes over.
const week: PersonDay[] = [
  personDay(MONDAY, '05:58', '14:01'),
  personDay(addDays(MONDAY, 1), '06:20', '14:00'),
  personDay(addDays(MONDAY, 2), '06:00', '14:02'),
  personDay(addDays(MONDAY, 3), '06:00', '14:40'),
  personDay(addDays(MONDAY, 4), '05:55', '14:00'),
];

const base = (extra: Partial<PlanInput> = {}): PlanInput => ({
  periodId: 'per1', siteId: 's1', today: TODAY, weekStartsOn: 1, days: week, evidence: new Map(), storedDays: [], storedOvertime: [], rules: PLAN_RULES, ...extra,
});

const storedOf = (w: DayWrite, extra: Partial<DayRow> = {}): DayRow => ({
  id: `d-${w.shiftDate}`, periodId: w.periodId, employeeId: w.employeeId, shiftDate: w.shiftDate, status: w.status, reasons: w.reasons,
  scheduledMinutes: w.scheduledMinutes, workedMinutes: w.workedMinutes, minutesLate: w.minutesLate, minutesAfterGrace: w.minutesAfterGrace,
  leftEarlyMinutes: w.leftEarlyMinutes, afterEndMinutes: w.afterEndMinutes, evidenceHash: w.evidenceHash, lateExcused: false,
  decidedById: null, decidedAt: null, decisionReason: null, carriedFromPeriodId: null, ...extra,
});
const itemOf = (w: OvertimeWrite, extra: Partial<OvertimeRow> = {}): OvertimeRow => ({
  id: 'o1', periodId: w.periodId, employeeId: w.employeeId, shiftDate: w.shiftDate, rawMinutes: w.rawMinutes, serviceTailMinutes: w.serviceTailMinutes,
  autoMinutes: w.autoMinutes, needsMinutes: w.needsMinutes, authorisedMinutes: w.authorisedMinutes, status: w.status, evidence: w.evidence, limits: w.limits,
  decidedById: null, decidedAt: null, decisionReason: null, version: 0, headNote: null, ...extra,
});

describe('planTimesheet: a week with one late day and one overtime day', () => {
  const plan = planTimesheet(base());
  const byDate = Object.fromEntries(plan.days.map((d) => [d.shiftDate, d]));

  it('approves the three matching days by itself and leaves two exceptions for a person', () => {
    expect(plan.newlyAutoApproved).toBe(3);
    expect(byDate['2026-10-05']?.status).toBe('AUTO_APPROVED');
    expect(byDate['2026-10-06']).toMatchObject({ status: 'NEEDS_LOOK', reasons: ['LATE'], minutesLate: 20 });
    expect(byDate['2026-10-08']).toMatchObject({ status: 'NEEDS_LOOK', reasons: ['OVERTIME'] });
  });

  it('opens one pending overtime item with the minutes, the evidence and the limits', () => {
    expect(plan.overtime).toHaveLength(1);
    expect(plan.overtime[0]).toMatchObject({ shiftDate: '2026-10-08', rawMinutes: 40, needsMinutes: 40, authorisedMinutes: 0, status: 'PENDING' });
    expect(plan.overtime[0]?.limits).toMatchObject({ weeklyCapMinutes: 120, weekMinutes: 40, overCapMinutes: 0, insideAllowance: true });
  });

  it('rolls the days into one week that needs a look', () => {
    expect(plan.weeks).toHaveLength(1);
    expect(plan.weeks[0]).toMatchObject({ weekStart: '2026-10-05', status: 'NEEDS_LOOK', scheduledMinutes: 5 * 480 });
  });

  it('is repeatable: running it over what it just produced changes nothing', () => {
    const again = planTimesheet(base({ storedDays: plan.days.map((d) => storedOf(d)), storedOvertime: plan.overtime.map((o) => itemOf(o)) }));
    expect(again.days).toEqual([]);
    expect(again.overtime).toEqual([]);
    expect(again.newlyAutoApproved).toBe(0);
    expect(again.weeks).toEqual([]);
  });

  it('answering the overtime settles that day and the week closes out once the late day is decided too', () => {
    const decidedAt = new Date('2026-10-12T09:00:00Z');
    const overtime = itemOf(plan.overtime[0]!, { status: 'APPROVED', authorisedMinutes: 40, decidedById: 'mgr', decidedAt, decisionReason: null });
    const stored = plan.days.map((d) => storedOf(d, d.shiftDate === '2026-10-06' ? { status: 'APPROVED', decidedById: 'mgr', decidedAt, decisionReason: 'Bus broke down' } : {}));
    const settled = planTimesheet(base({ storedDays: stored, storedOvertime: [overtime] }));
    const thursday = settled.days.find((d) => d.shiftDate === '2026-10-08');
    expect(thursday).toMatchObject({ status: 'APPROVED', reasons: [] });
    expect(settled.weeks[0]?.status).toBe('APPROVED');
  });

  it('a person decision on the late day is kept while nothing under it changes', () => {
    const decidedAt = new Date('2026-10-12T09:00:00Z');
    const stored = plan.days.map((d) => storedOf(d, d.shiftDate === '2026-10-06' ? { status: 'APPROVED', decidedById: 'mgr', decidedAt, decisionReason: null } : {}));
    const again = planTimesheet(base({ storedDays: stored, storedOvertime: [itemOf(plan.overtime[0]!)] }));
    expect(again.days).toEqual([]);
  });

  it('a limit: more overtime than the weekly cap is flagged and a head may not decide it', () => {
    const capped = planTimesheet(base({ rules: { ...PLAN_RULES, weeklyCapMinutes: 30 } }));
    expect(capped.overtime[0]?.limits).toMatchObject({ overCapMinutes: 10, insideAllowance: false });
  });

  it('service tail: open work at the end lets the first 15 minutes through without a person', () => {
    const evidence = new Map([[`e-2026-10-08`, { openWorkAtEnd: true, ordersTaken: 3, ticketsCleared: 2, openOrdersAtEnd: 1 }]]);
    const tail = planTimesheet(base({ evidence }));
    expect(tail.overtime[0]).toMatchObject({ autoMinutes: 15, needsMinutes: 25, authorisedMinutes: 15, status: 'PENDING' });
    expect(tail.overtime[0]?.evidence).toMatchObject({ ordersTaken: 3, openWorkAtEnd: true });
  });

  it('a part week: overtime on days in the neighbouring period counts towards the weekly cap but is never written', () => {
    // Thu 8 Oct is this period's last day; Fri 9 Oct belongs to the next period and had 100 minutes over.
    const thursday = week.filter((d) => d.date === '2026-10-08');
    const neighbour = [personDay(addDays(MONDAY, 4), '06:00', '15:40')];
    const withNeighbour = planTimesheet(base({ days: thursday, neighbourDays: neighbour, rules: { ...PLAN_RULES, weeklyCapMinutes: 120 } }));
    expect(withNeighbour.overtime).toHaveLength(1);
    expect(withNeighbour.overtime[0]).toMatchObject({ shiftDate: '2026-10-08', rawMinutes: 40 });
    expect(withNeighbour.overtime[0]?.limits).toMatchObject({ weekMinutes: 140, overCapMinutes: 20, insideAllowance: false });
    expect(withNeighbour.days.map((d) => d.shiftDate)).toEqual(['2026-10-08']);
    const alone = planTimesheet(base({ days: thursday, rules: { ...PLAN_RULES, weeklyCapMinutes: 120 } }));
    expect(alone.overtime[0]?.limits).toMatchObject({ weekMinutes: 40, overCapMinutes: 0 });
  });

  it('nothing is invented for a day with no rota and no clock', () => {
    expect(planTimesheet(base({ days: [] })).days).toEqual([]);
  });
});
