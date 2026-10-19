import type { NairobiDate } from '../../../_shared/time/nairobi-time';
import type { DayRow } from '../../timesheets.types';

export interface SoFar {
  workedMinutes: number;
  plannedMinutes: number;
  /** The last day the figures run to: yesterday, or today when today's shifts are all closed. */
  throughDate: NairobiDate;
}

/**
 * Rule (D18): the open month "so far". Worked and planned are summed over the days before today, plus today's day only when
 * every shift on it is over (a day that still has an open shift, or has not matched yet, is left out, so the number does not
 * move every second and never counts work nobody has closed). Computed in the read, never stored.
 */
export function soFar(days: readonly Pick<DayRow, 'shiftDate' | 'status' | 'reasons' | 'workedMinutes' | 'scheduledMinutes'>[], today: NairobiDate): SoFar {
  let workedMinutes = 0;
  let plannedMinutes = 0;
  for (const day of days) {
    if (day.shiftDate > today) continue;
    if (day.shiftDate === today && !dayIsOver(day)) continue;
    workedMinutes += day.workedMinutes;
    plannedMinutes += day.scheduledMinutes;
  }
  return { workedMinutes, plannedMinutes, throughDate: today };
}

/** Today's day counts once nothing on it is still running: it matched and finished, or it was decided, or it has no open shift. */
const dayIsOver = (day: Pick<DayRow, 'status' | 'reasons'>): boolean => {
  if (day.status === 'MATCHED') return false;
  return !day.reasons.includes('OPEN_SHIFT');
};
