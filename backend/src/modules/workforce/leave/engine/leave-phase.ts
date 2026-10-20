import type { NairobiDate } from '../../_shared/time/nairobi-time';
import type { LeaveStatusCode } from '../leave.types';

/** Booked, on leave and taken are DERIVED from the dates, never stored (spec section 4). */
export type LeavePhase = 'WAITING' | 'BOOKED' | 'ON_LEAVE' | 'TAKEN' | 'DECLINED' | 'CANCELLED';

export function phaseOf(application: { status: LeaveStatusCode; start: NairobiDate; end: NairobiDate }, today: NairobiDate): LeavePhase {
  if (application.status === 'WAITING') return 'WAITING';
  if (application.status === 'DECLINED') return 'DECLINED';
  if (application.status === 'CANCELLED') return 'CANCELLED';
  if (application.end < today) return 'TAKEN';
  if (application.start > today) return 'BOOKED';
  return 'ON_LEAVE';
}

/** The person may cancel while waiting, or while approved and not started (L23). */
export const personMayCancel = (application: { status: LeaveStatusCode; start: NairobiDate }, today: NairobiDate): boolean =>
  application.status === 'WAITING' || (application.status === 'APPROVED' && application.start > today);

/** A manager (or HR) may cancel an approved request that has not started; a leave in progress or finished cannot be cancelled. */
export const managerMayCancel = (application: { status: LeaveStatusCode; start: NairobiDate }, today: NairobiDate): boolean => application.status === 'APPROVED' && application.start > today;
