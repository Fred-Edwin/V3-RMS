import type { RuleValues } from '../rules/rules-schemas';
import type { NairobiDate } from '../_shared/time/nairobi-time';
import type { DeciderRole } from './leave.constants';

export type LeaveRules = RuleValues['LEAVE'];
export type LeaveTypeRule = LeaveRules['leaveTypes'][number];

export type LeaveStatusCode = 'WAITING' | 'APPROVED' | 'DECLINED' | 'CANCELLED';
export type LeaveStageCode = 'MANAGER' | 'HR' | 'DIRECTOR';

/** What a type looked like when the request was asked (L22): later Rules changes never rewrite an old request. */
export interface TypeSnapshot {
  code: string;
  label: string;
  paid: boolean;
  approvedBy: 'MANAGER' | 'HR';
  requiresReason: boolean;
  sickNoteAfterDays: number | null;
  accrual: 'UP_FRONT' | 'MONTHLY' | 'PER_EVENT';
}

/** Rules in force on a date. Preloaded (one lookup per distinct date) so the pure engine stays synchronous. */
export type RulesAt = (date: NairobiDate) => LeaveRules;

/** The slice of an application the balance maths needs. Dates are Nairobi dates. */
export interface CountedApplication {
  start: NairobiDate;
  end: NairobiDate;
  days: number;
  unpaidTailDays: number;
}

export interface LedgerLine {
  kind: 'OPENING' | 'CARRY_OVER' | 'ADJUSTMENT';
  days: number;
  asOf: NairobiDate;
}

export type BarTone = 'GREEN' | 'AMBER' | 'RED' | 'NONE';

export interface TypeBalance {
  typeCode: string;
  label: string;
  paid: boolean;
  /** Whole days; null when the type has no limit (unpaid types). */
  perYear: number | null;
  credited: number;
  taken: number;
  booked: number;
  left: number;
  tone: BarTone;
  /** How it arrives, for the card text: "builds 1.75 a month" or null. */
  builds: { perMonth: number } | null;
}

/** Who decides, worked out from the person and the type (spec section 5). */
export interface Routing {
  role: DeciderRole;
  stage: LeaveStageCode;
}
