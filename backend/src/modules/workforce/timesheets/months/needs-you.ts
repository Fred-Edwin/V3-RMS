import type { DayReason, DayRow, OvertimeRow, RequestRow } from '../timesheets.types';

/** A shift left open or closed by the phone: the manager fixes the clock-out. */
const CLOCK_FIX_REASONS: readonly DayReason[] = ['OPEN_SHIFT', 'AUTO_CLOSED'];
/** Other reasons that still need a person's eyes before the hours are signed (D2). Late, left early, absent and edited never block. */
const LOOK_REASONS: readonly DayReason[] = ['PHONE_CLOCK', 'UNSCHEDULED', 'CHANGED_AFTER_APPROVAL'];

export type NeedsKind = 'CLOCK_OUT_FIX' | 'OVERTIME' | 'REQUEST' | 'DAY_LOOK';

export interface NeedsYouCounts {
  clockOutFixes: number;
  overtimeDecisions: number;
  requestsWithManager: number;
  daysToLookAt: number;
  /** Not blocking: the request is with HR, the dialog only lists it. */
  requestsWithHr: number;
}

/** What blocks approval (D2 a, b, c). */
export const blockingTotal = (counts: NeedsYouCounts): number => counts.clockOutFixes + counts.overtimeDecisions + counts.requestsWithManager + counts.daysToLookAt;

const undecided = (day: Pick<DayRow, 'status'>): boolean => day.status === 'NEEDS_LOOK' || day.status === 'HELD';

/**
 * The kind of blocking exception a day is, or null. A held day always blocks (the manager held it back). A day that needs a look
 * blocks only for the reasons that are about the clock itself; its overtime is the overtime item's business.
 * Rule D2. Feeds on: nothing in the Rules store (late and absence are facts; pay is payroll's).
 */
export function dayNeed(day: Pick<DayRow, 'status' | 'reasons'>): NeedsKind | null {
  if (!undecided(day)) return null;
  if (day.reasons.some((reason) => CLOCK_FIX_REASONS.includes(reason))) return 'CLOCK_OUT_FIX';
  if (day.status === 'HELD' || day.reasons.some((reason) => LOOK_REASONS.includes(reason))) return 'DAY_LOOK';
  return null;
}

/** A request the manager still has to answer (D2 c). One already moved up to HR does not block. */
export const requestNeed = (request: Pick<RequestRow, 'state' | 'waitingOnRole' | 'escalatedAt'>): 'WITH_MANAGER' | 'WITH_HR' | null => {
  if (request.state !== 'WAITING') return null;
  return request.escalatedAt !== null || request.waitingOnRole === 'HR_MANAGER' ? 'WITH_HR' : 'WITH_MANAGER';
};

export const overtimeNeed = (item: Pick<OvertimeRow, 'status'>): boolean => item.status === 'PENDING';

export function needsYou(days: readonly Pick<DayRow, 'status' | 'reasons'>[], items: readonly Pick<OvertimeRow, 'status'>[], requests: readonly Pick<RequestRow, 'state' | 'waitingOnRole' | 'escalatedAt'>[]): NeedsYouCounts {
  const kinds = days.map(dayNeed);
  const asks = requests.map(requestNeed);
  return {
    clockOutFixes: kinds.filter((k) => k === 'CLOCK_OUT_FIX').length,
    daysToLookAt: kinds.filter((k) => k === 'DAY_LOOK').length,
    overtimeDecisions: items.filter(overtimeNeed).length,
    requestsWithManager: asks.filter((a) => a === 'WITH_MANAGER').length,
    requestsWithHr: asks.filter((a) => a === 'WITH_HR').length,
  };
}

/** Days that need a person but not for a blocking reason (only late, left early, absent or edited): the month approves them with it. */
export const settledWithMonth = (day: Pick<DayRow, 'status' | 'reasons'>): boolean => day.status === 'NEEDS_LOOK' && dayNeed(day) === null;
