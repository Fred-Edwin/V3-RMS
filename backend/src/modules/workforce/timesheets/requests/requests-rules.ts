import type { TimeRequestKind, UserRole } from '@prisma/client';
import { daysBetween, nairobiDateOf } from '../../_shared/time/nairobi-time';

/** Chapter 9: no answer for this many days and the request moves to HR. */
export const ESCALATE_AFTER_DAYS = 3;

/** A report may be about a day this far back (a month and a half covers a whole pay period). */
export const REPORT_WINDOW_DAYS = 45;

export const CLOCK_KINDS: readonly TimeRequestKind[] = ['CLOCK_TIME_WRONG', 'WORKED_NOT_RECORDED', 'CLOCKED_OUT_BY_MISTAKE'];
export const isClockKind = (kind: TimeRequestKind): boolean => CLOCK_KINDS.includes(kind);

export type ApproverRole = Extract<UserRole, 'MANAGER' | 'STORE_MANAGER' | 'HR_MANAGER'>;

/**
 * Who a request first waits on. "Pay questions about deductions go to HR. Everything else goes to your Branch Manager"
 * (Chapter 9): the Store Manager at the hub. A manager's own request goes to HR (nobody answers their own).
 */
export function firstApprover(kind: TimeRequestKind, requesterRole: UserRole): ApproverRole {
  if (kind === 'PAY_OTHER') return 'HR_MANAGER';
  if (requesterRole === 'MANAGER' || requesterRole === 'STORE_MANAGER') return 'HR_MANAGER';
  return requesterRole === 'STORE_ATTENDANT' ? 'STORE_MANAGER' : 'MANAGER';
}

/** Whole Nairobi calendar days since the request was made; escalation is due at `ESCALATE_AFTER_DAYS`. Idempotent: the caller marks it once. */
export const waitingDays = (createdAt: Date, now: Date): number => daysBetween(nairobiDateOf(createdAt), nairobiDateOf(now));
export const escalationDue = (createdAt: Date, now: Date): boolean => waitingDays(createdAt, now) >= ESCALATE_AFTER_DAYS;

/**
 * A cheap first cut for the database: three calendar days apart always means more than two days elapsed. The exact test is
 * `escalationDue` on each candidate.
 */
export const escalationCut = (now: Date): Date => new Date(now.getTime() - (ESCALATE_AFTER_DAYS - 1) * 24 * 3_600_000);
