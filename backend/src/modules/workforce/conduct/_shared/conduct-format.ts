import { isoWeekday, nairobiClockOf, nairobiDateOf, parseNairobiDate } from '../../_shared/time/nairobi-time';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** "Fri 9 Oct" for the Nairobi day an instant falls on. */
export function shortDay(instant: Date): string {
  const date = nairobiDateOf(instant);
  return `${DAYS[isoWeekday(parseNairobiDate(date)) - 1]} ${Number(date.slice(8, 10))} ${MONTHS[Number(date.slice(5, 7)) - 1]}`;
}

/** "Fri 9 Oct, 16:42" in Nairobi time. */
export const shortDayTime = (instant: Date): string => `${shortDay(instant)}, ${nairobiClockOf(instant)}`;

/** "9 Apr 2027" for a Nairobi date column. */
export function dayMonthYear(value: Date): string {
  const date = value.toISOString().slice(0, 10);
  return `${Number(date.slice(8, 10))} ${MONTHS[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`;
}
