import { nairobiDateOf, type NairobiDate } from '../../_shared/time/nairobi-time';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const ordinal = (n: number): string => {
  const tail = n % 100;
  if (tail >= 11 && tail <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
};

/** "9 October 2026" from a Nairobi date. */
export function longDate(date: NairobiDate): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** "9 October 2026" for the Nairobi day an instant falls on. */
export const longDateOf = (instant: Date): string => longDate(nairobiDateOf(instant));

/** "September 2026" from "2026-09". */
export function monthYear(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number) as [number, number];
  return `${MONTHS[m - 1]} ${y}`;
}

/** "the 2nd, 9th, 16th, 23rd and 30th" from Nairobi dates in one month. */
export function datesLong(dates: readonly NairobiDate[]): string {
  const days = dates.map((date) => ordinal(Number(date.slice(8, 10))));
  if (days.length === 0) return '';
  if (days.length === 1) return `the ${days[0]}`;
  return `the ${days.slice(0, -1).join(', ')} and ${days[days.length - 1]}`;
}

/** Plain text only: control characters and line breaks become single spaces, runs of spaces collapse, the ends are trimmed. */
export const plainText = (value: string): string =>
  value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s{2,}/g, ' ').trim();

/** Replaces each {blank}; a blank with no value stays visible so a missing fact is noticed in tests. */
export function fillBlanks(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in values ? String(values[key]) : whole));
}

export const firstNameOf = (fullName: string): string => fullName.trim().split(/\s+/)[0] ?? fullName;
