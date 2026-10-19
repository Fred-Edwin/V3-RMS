import type { DayRow, OvertimeRow, RequestRow } from '../../timesheets.types';
import { dayNeed, requestNeed } from '../rules/needs-you';

export type DayResultKey =
  | 'REST'
  | 'ON_ROTA'
  | 'LATE'
  | 'LEFT_EARLY'
  | 'OVERTIME_TO_DECIDE'
  | 'OVERTIME_APPROVED'
  | 'OVERTIME_APPROVED_PART'
  | 'OVERTIME_NOT_APPROVED'
  | 'CLOCK_OUT_MISSING'
  | 'ABSENT'
  | 'REQUEST_WAITING'
  | 'EDITED';

/** The calendar swatch: worked on the rota, late, overtime to decide, rest day, or something else the manager should look at. */
export type GlanceKind = 'WORKED' | 'LATE' | 'OVERTIME_TO_DECIDE' | 'REST' | 'ABSENT' | 'NEEDS_LOOK';

export interface DayResult {
  resultKey: DayResultKey;
  glance: GlanceKind;
  /** The day needs the manager before the month can be approved. */
  needsLook: boolean;
}

/**
 * Rule: one word per day, the most urgent first (a missing clock-out, overtime waiting, a request waiting, absence, lateness,
 * leaving early, an edit by a manager). A date with no stored day is a rest day.
 */
export function dayResult(day: DayRow | null, item: OvertimeRow | null, requests: readonly Pick<RequestRow, 'state' | 'waitingOnRole' | 'escalatedAt'>[]): DayResult {
  if (!day) return { resultKey: 'REST', glance: 'REST', needsLook: false };
  const clockFix = dayNeed(day) === 'CLOCK_OUT_FIX';
  const lookAt = dayNeed(day) === 'DAY_LOOK';
  const overtimeWaiting = item?.status === 'PENDING';
  const asking = requests.some((r) => requestNeed(r) === 'WITH_MANAGER');
  const needsLook = clockFix || lookAt || overtimeWaiting || asking;
  if (clockFix) return { resultKey: 'CLOCK_OUT_MISSING', glance: 'NEEDS_LOOK', needsLook };
  if (overtimeWaiting) return { resultKey: 'OVERTIME_TO_DECIDE', glance: 'OVERTIME_TO_DECIDE', needsLook };
  if (item && item.decidedById !== null) {
    const key = item.status === 'APPROVED_PART' ? 'OVERTIME_APPROVED_PART' : item.status === 'DECLINED' ? 'OVERTIME_NOT_APPROVED' : 'OVERTIME_APPROVED';
    return { resultKey: key, glance: 'WORKED', needsLook };
  }
  if (asking) return { resultKey: 'REQUEST_WAITING', glance: 'NEEDS_LOOK', needsLook };
  if (day.reasons.includes('ABSENT')) return { resultKey: 'ABSENT', glance: 'ABSENT', needsLook };
  if (lookAt) return { resultKey: 'ON_ROTA', glance: 'NEEDS_LOOK', needsLook };
  if (day.minutesLate > 0) return { resultKey: 'LATE', glance: 'LATE', needsLook };
  if (day.reasons.includes('LEFT_EARLY')) return { resultKey: 'LEFT_EARLY', glance: 'WORKED', needsLook };
  if (day.reasons.includes('EDITED')) return { resultKey: 'EDITED', glance: 'WORKED', needsLook };
  return { resultKey: day.scheduledMinutes === 0 && day.workedMinutes === 0 ? 'REST' : 'ON_ROTA', glance: day.scheduledMinutes === 0 && day.workedMinutes === 0 ? 'REST' : 'WORKED', needsLook };
}
