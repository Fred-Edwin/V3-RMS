import type { NairobiDate } from '../../_shared/time/nairobi-time';

export interface ApprovedDay {
  shiftDate: NairobiDate;
  workedMinutes: number;
  scheduledMinutes: number;
  minutesLate: number;
  minutesAfterGrace: number;
  lateExcused: boolean;
}

export interface AuthorisedOvertime {
  shiftDate: NairobiDate;
  authorisedMinutes: number;
}

export interface OvertimeSplit {
  ordinaryDay: number;
  restDay: number;
  publicHoliday: number;
}

/**
 * The late days the Lateness rule counts, in date order, each with its minutes late. A day is counted when the person was late
 * beyond the grace period and nobody excused it. (The grace period is already applied in `minutesAfterGrace`.)
 */
export const countedLateDays = (days: readonly ApprovedDay[]): number[] =>
  [...days]
    .sort((a, b) => (a.shiftDate < b.shiftDate ? -1 : 1))
    .filter((day) => day.minutesAfterGrace > 0 && !day.lateExcused)
    .map((day) => day.minutesLate);

/**
 * Authorised overtime by the type of the day it was worked (E4): a public holiday from the Holidays list, a rest day when the person
 * had nothing scheduled that day, otherwise an ordinary day. The door `getApprovedHours` stays the total: whatever it counts and the
 * items do not explain is paid as ordinary overtime, and an item the door does not count is never paid.
 */
export function splitOvertime(items: readonly AuthorisedOvertime[], days: readonly ApprovedDay[], holidays: ReadonlySet<string>, doorTotal: number): OvertimeSplit {
  const split: OvertimeSplit = { ordinaryDay: 0, restDay: 0, publicHoliday: 0 };
  const scheduled = new Map(days.map((day) => [day.shiftDate, day.scheduledMinutes]));
  for (const item of items) {
    if (holidays.has(item.shiftDate)) split.publicHoliday += item.authorisedMinutes;
    else if (scheduled.get(item.shiftDate) === 0) split.restDay += item.authorisedMinutes;
    else split.ordinaryDay += item.authorisedMinutes;
  }
  const explained = split.ordinaryDay + split.restDay + split.publicHoliday;
  if (explained < doorTotal) split.ordinaryDay += doorTotal - explained;
  if (explained > doorTotal) {
    let excess = explained - doorTotal;
    for (const key of ['ordinaryDay', 'restDay', 'publicHoliday'] as const) {
      const cut = Math.min(split[key], excess);
      split[key] -= cut;
      excess -= cut;
    }
  }
  return split;
}

/** Minutes worked on public holidays, not counting the overtime already paid on those days (it would be paid twice). */
export function holidayWorkedMinutes(days: readonly ApprovedDay[], items: readonly AuthorisedOvertime[], holidays: ReadonlySet<string>): number {
  let minutes = 0;
  for (const day of days) {
    if (!holidays.has(day.shiftDate)) continue;
    const overtime = items.filter((item) => item.shiftDate === day.shiftDate).reduce((total, item) => total + item.authorisedMinutes, 0);
    minutes += Math.max(0, day.workedMinutes - overtime);
  }
  return minutes;
}
