import type { NairobiDate } from '../../_shared/time/nairobi-time';
import type { DayRow, OvertimeRow, RequestRow } from '../timesheets.types';
import type { PersonFacts } from './people-rows';

/** Small builders for the month tests. Not used by any production code. */
export const day = (date: string, extra: Partial<DayRow> = {}, employeeId = 'e1'): DayRow => ({
  id: `d-${employeeId}-${date}`,
  periodId: 'p1',
  employeeId,
  shiftDate: date as NairobiDate,
  status: 'AUTO_APPROVED',
  reasons: [],
  scheduledMinutes: 480,
  workedMinutes: 480,
  minutesLate: 0,
  minutesAfterGrace: 0,
  leftEarlyMinutes: 0,
  afterEndMinutes: 0,
  evidenceHash: 'h',
  lateExcused: false,
  decidedById: null,
  decidedAt: null,
  decisionReason: null,
  carriedFromPeriodId: null,
  ...extra,
});

export const item = (date: string, extra: Partial<OvertimeRow> = {}, employeeId = 'e1'): OvertimeRow => ({
  id: `o-${employeeId}-${date}`,
  periodId: 'p1',
  employeeId,
  shiftDate: date as NairobiDate,
  rawMinutes: 35,
  serviceTailMinutes: 0,
  autoMinutes: 0,
  needsMinutes: 35,
  authorisedMinutes: 0,
  status: 'PENDING',
  evidence: { openWorkAtEnd: false, ordersTaken: 0, ticketsCleared: 0, openOrdersAtEnd: 0 },
  limits: { weeklyCapMinutes: 2880, weekMinutes: 35, overCapMinutes: 0, branchBudgetMinutes: null, branchUsedMinutes: 35, insideAllowance: true },
  decidedById: null,
  decidedAt: null,
  decisionReason: null,
  version: 0,
  headNote: null,
  ...extra,
});

export const request = (date: string, extra: Partial<RequestRow> = {}, employeeId = 'e1'): RequestRow => ({
  id: `r-${employeeId}-${date}`,
  siteId: 's1',
  employeeId,
  kind: 'CLOCK_TIME_WRONG',
  shiftDate: date as NairobiDate,
  state: 'WAITING',
  note: 'x',
  recorded: {},
  requested: {},
  waitingOnRole: 'MANAGER',
  waitingOnUserId: null,
  escalatedAt: null,
  decidedById: null,
  decidedAt: null,
  decisionReason: null,
  answerAfter: null,
  appliedEventId: null,
  createdAt: new Date('2026-09-10T10:00:00Z'),
  ...extra,
});

export const person = (id: string, name: string, department: string | null = 'Barista'): PersonFacts => ({ id, name, departmentId: department ? `dep-${department}` : null, department: department ? { name: department } : null });
