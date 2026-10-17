import { formatFullDate, formatWeekdayDayMonth } from '../../_shared/lib/people-dates';

/** Small label helpers for the hire screens. */

export const formatFullDateOrNone = (date: string | null): string => (date ? formatFullDate(date) : 'None for a casual');

/** "Starts Mon 5 Oct". */
export const startsOn = (date: string): string => `Starts ${formatWeekdayDayMonth(date)}`;
