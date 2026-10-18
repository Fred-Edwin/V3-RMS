import type { OvertimeStatus, TimeRequestKind, TimeRequestState, TimesheetPeriodState, TimesheetStatus } from '@prisma/client';
import type { NairobiDate } from '../_shared/time/nairobi-time';

/** Why a day needs a person. The screens own the wording; the codes are stored on the day. */
export const DAY_REASONS = [
  'LATE',
  'LEFT_EARLY',
  'ABSENT',
  'EDITED',
  'AUTO_CLOSED',
  'OPEN_SHIFT',
  'PHONE_CLOCK',
  'UNSCHEDULED',
  'OVERTIME',
  'CHANGED_AFTER_APPROVAL',
] as const;
export type DayReason = (typeof DAY_REASONS)[number];

/** What a day looks like to the engine before it is stored. */
export interface DayAssessment {
  status: Extract<TimesheetStatus, 'MATCHED' | 'AUTO_APPROVED' | 'NEEDS_LOOK'>;
  reasons: DayReason[];
  /** Every shift on the day is over, so the day can be approved. */
  final: boolean;
  scheduledMinutes: number;
  workedMinutes: number;
  minutesLate: number;
  minutesAfterGrace: number;
  leftEarlyMinutes: number;
  afterEndMinutes: number;
  overtime: OvertimeFigures | null;
  evidenceHash: string;
}

/** The overtime a day holds, summed over its shifts. */
export interface OvertimeFigures {
  rawMinutes: number;
  serviceTailMinutes: number;
  autoMinutes: number;
  needsMinutes: number;
  openWorkAtEnd: boolean;
}

export interface OvertimeLimits {
  weeklyCapMinutes: number | null;
  weekMinutes: number; // the person's raw overtime in that week, this day included
  overCapMinutes: number;
  branchBudgetMinutes: number | null;
  branchUsedMinutes: number; // authorised or waiting, this branch, this period
  /** A department head may decide it only when it is inside the allowance (the cap and the budget). */
  insideAllowance: boolean;
}

export interface DayRow {
  id: string;
  periodId: string;
  employeeId: string;
  shiftDate: NairobiDate;
  status: TimesheetStatus;
  reasons: DayReason[];
  scheduledMinutes: number;
  workedMinutes: number;
  minutesLate: number;
  minutesAfterGrace: number;
  leftEarlyMinutes: number;
  afterEndMinutes: number;
  evidenceHash: string;
  lateExcused: boolean;
  decidedById: string | null;
  decidedAt: Date | null;
  decisionReason: string | null;
  carriedFromPeriodId: string | null;
}

export interface OvertimeRow {
  id: string;
  periodId: string;
  employeeId: string;
  shiftDate: NairobiDate;
  rawMinutes: number;
  serviceTailMinutes: number;
  autoMinutes: number;
  needsMinutes: number;
  authorisedMinutes: number;
  status: OvertimeStatus;
  evidence: { openWorkAtEnd: boolean; ordersTaken: number; ticketsCleared: number; openOrdersAtEnd: number };
  limits: OvertimeLimits;
  decidedById: string | null;
  decidedAt: Date | null;
  decisionReason: string | null;
}

export interface PeriodRow {
  id: string;
  siteId: string;
  start: NairobiDate;
  end: NairobiDate;
  label: string;
  cutoffAt: Date;
  state: TimesheetPeriodState;
  reportNumber: number;
  closeKind: 'AUTO' | 'EARLY' | null;
  closedAt: Date | null;
  closedById: string | null;
  signedById: string | null;
  signedAt: Date | null;
  reopenedAt: Date | null;
  reopenedById: string | null;
  reopenReason: string | null;
}

export interface RequestRow {
  id: string;
  siteId: string;
  employeeId: string;
  kind: TimeRequestKind;
  shiftDate: NairobiDate;
  state: TimeRequestState;
  note: string;
  recorded: Record<string, unknown>;
  requested: Record<string, unknown>;
  waitingOnRole: string;
  waitingOnUserId: string | null;
  escalatedAt: Date | null;
  decidedById: string | null;
  decidedAt: Date | null;
  decisionReason: string | null;
  answerAfter: Record<string, unknown> | null;
  appliedEventId: string | null;
  createdAt: Date;
}
