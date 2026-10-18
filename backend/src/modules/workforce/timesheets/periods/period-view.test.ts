import { describe, expect, it } from 'vitest';
import type { NairobiDate } from '../../_shared/time/nairobi-time';
import type { DayRow, OvertimeRow } from '../timesheets.types';
import { filterRows, personRows, summarise } from './period-view';

const person = (id: string, name: string, dept: string) => ({ id, name, departmentId: dept, department: { name: dept === 'svc' ? 'Service' : 'Kitchen' } });
const day = (employeeId: string, date: string, extra: Partial<DayRow> = {}): DayRow => ({
  id: `${employeeId}-${date}`, periodId: 'p', employeeId, shiftDate: date as NairobiDate, status: 'AUTO_APPROVED', reasons: [], scheduledMinutes: 480, workedMinutes: 480,
  minutesLate: 0, minutesAfterGrace: 0, leftEarlyMinutes: 0, afterEndMinutes: 0, evidenceHash: 'h', lateExcused: false, decidedById: null, decidedAt: null, decisionReason: null, carriedFromPeriodId: null, ...extra,
});
const item = (employeeId: string, extra: Partial<OvertimeRow> = {}): OvertimeRow => ({
  id: `o-${employeeId}`, periodId: 'p', employeeId, shiftDate: '2026-10-08' as NairobiDate, rawMinutes: 40, serviceTailMinutes: 0, autoMinutes: 0, needsMinutes: 40, authorisedMinutes: 0,
  status: 'PENDING', evidence: { openWorkAtEnd: false, ordersTaken: 0, ticketsCleared: 0, openOrdersAtEnd: 0 },
  limits: { weeklyCapMinutes: null, weekMinutes: 40, overCapMinutes: 0, branchBudgetMinutes: null, branchUsedMinutes: 40, insideAllowance: true }, decidedById: null, decidedAt: null, decisionReason: null, ...extra,
});

const days = [
  { day: day('a', '2026-10-05'), person: person('a', 'Amina Hassan', 'svc') },
  { day: day('a', '2026-10-06'), person: person('a', 'Amina Hassan', 'svc') },
  { day: day('c', '2026-10-05', { status: 'NEEDS_LOOK', reasons: ['LATE'], minutesLate: 25, minutesAfterGrace: 20, workedMinutes: 455 }), person: person('c', 'Cynthia Wairimu', 'svc') },
  { day: day('e', '2026-10-05', { status: 'NEEDS_LOOK', reasons: ['ABSENT'], workedMinutes: 0 }), person: person('e', 'Esther Mwende', 'kit') },
  { day: day('d', '2026-10-05', { status: 'APPROVED', reasons: ['LATE'], minutesLate: 12, minutesAfterGrace: 7, decidedById: 'mgr' }), person: person('d', 'Dan Kiprop', 'kit') },
];
const items = [item('c', { status: 'PENDING' }), item('d', { status: 'APPROVED', needsMinutes: 40, authorisedMinutes: 40, decidedById: 'mgr' })];
const rows = personRows(days, items);

describe('the period at a glance', () => {
  it('puts the people who need a look first, then by name', () => {
    expect(rows.map((r) => r.name)).toEqual(['Cynthia Wairimu', 'Esther Mwende', 'Amina Hassan', 'Dan Kiprop']);
  });

  it('gives each person their totals and a status that follows their days', () => {
    expect(rows.find((r) => r.name === 'Amina Hassan')).toMatchObject({ plannedMinutes: 960, workedMinutes: 960, status: 'AUTO_APPROVED', needsLookDays: 0 });
    expect(rows.find((r) => r.name === 'Cynthia Wairimu')).toMatchObject({ status: 'NEEDS_LOOK', lateDays: 1, overtimePendingMinutes: 40 });
    expect(rows.find((r) => r.name === 'Esther Mwende')).toMatchObject({ absentDays: 1 });
    expect(rows.find((r) => r.name === 'Dan Kiprop')).toMatchObject({ status: 'APPROVED', overtimeAuthorisedMinutes: 40 });
  });

  it('summarises hours, lateness, absences and what is waiting', () => {
    expect(summarise(rows, days, items)).toMatchObject({ people: 4, autoApprovedDays: 2, needsLookDays: 2, needsLookPeople: 2, absentDays: 1, pendingOvertimeItems: 1, overtimeAuthorisedMinutes: 40 });
  });
});

describe('search and filters', () => {
  it('searches a name as you type', () => {
    expect(filterRows(rows, 'ALL', 'cyn', undefined, null).map((r) => r.name)).toEqual(['Cynthia Wairimu']);
  });

  it('"Needs a look" includes someone whose only open item is overtime', () => {
    expect(filterRows(rows, 'NEEDS_LOOK', undefined, undefined, null).map((r) => r.name)).toEqual(['Cynthia Wairimu', 'Esther Mwende']);
  });

  it('"Late" lists people with a day past the grace', () => {
    expect(filterRows(rows, 'LATE', undefined, undefined, null).map((r) => r.name)).toEqual(['Cynthia Wairimu', 'Dan Kiprop']);
  });

  it('a department head sees only their departments, however they search', () => {
    expect(filterRows(rows, 'ALL', undefined, undefined, ['kit']).map((r) => r.name)).toEqual(['Esther Mwende', 'Dan Kiprop']);
    expect(filterRows(rows, 'ALL', 'Amina', undefined, ['kit'])).toEqual([]);
  });
});
