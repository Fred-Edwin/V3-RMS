import { addDays, daysBetween, eachDay, type NairobiDate } from '../../_shared/time/nairobi-time';
import type { CountedApplication } from '../leave.types';

/** Every calendar day from the first to the last, inclusive (L6). Sundays and public holidays count. */
export const countDays = (start: NairobiDate, end: NairobiDate): number => daysBetween(start, end) + 1;

export const leaveYearOf = (date: NairobiDate): number => Number(date.slice(0, 4));

export const yearStart = (year: number): NairobiDate => `${String(year).padStart(4, '0')}-01-01` as NairobiDate;
export const yearEnd = (year: number): NairobiDate => `${String(year).padStart(4, '0')}-12-31` as NairobiDate;
export const monthFirst = (year: number, month: number): NairobiDate => `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01` as NairobiDate;

/** A request may not cross 31 December (L10). */
export const crossesYear = (start: NairobiDate, end: NairobiDate): boolean => leaveYearOf(start) !== leaveYearOf(end);

/** The day the person is back at work. */
export const returnDate = (end: NairobiDate): NairobiDate => addDays(end, 1);

/** Do two inclusive ranges share a day? */
export const overlaps = (a: { start: NairobiDate; end: NairobiDate }, b: { start: NairobiDate; end: NairobiDate }): boolean => a.start <= b.end && b.start <= a.end;

/**
 * The days of a request that come off the balance: the first `days - unpaidTailDays` days. The unpaid tail is the LAST days of the
 * range (L12), so a request cut by "today" splits cleanly into taken and booked.
 */
export const balanceDaysOf = (application: CountedApplication): NairobiDate[] => eachDay(application.start, application.end).slice(0, application.days - application.unpaidTailDays);

/** Days of the request that fall in a given leave year, for the balance days only. */
export const balanceDaysInYear = (application: CountedApplication, year: number): NairobiDate[] => balanceDaysOf(application).filter((day) => leaveYearOf(day) === year);

/** How the same request splits at `today`: days on or before today are taken, later ones are booked (spec section 3). */
export function takenAndBooked(applications: readonly CountedApplication[], year: number, today: NairobiDate): { taken: number; booked: number } {
  let taken = 0;
  let booked = 0;
  for (const application of applications) {
    for (const day of balanceDaysInYear(application, year)) {
      if (day <= today) taken += 1;
      else booked += 1;
    }
  }
  return { taken, booked };
}
