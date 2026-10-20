/**
 * Money, dates and small words for the Payroll screens. Money arrives as text with two decimals and is never turned into a float:
 * the shilling part is cut from the text and the cents round half up (the spec's display rule; Excel and the bank file keep the cents).
 */

const NAIROBI = 'Africa/Nairobi';

/** The shilling part is read from the text (a payroll amount has at most 12 digits, far inside what a number holds exactly). */
function split(amount: string): { negative: boolean; whole: number; cents: number } {
  const text = amount.trim();
  const negative = text.startsWith('-');
  const [wholePart = '0', fraction = ''] = (negative ? text.slice(1) : text).split('.');
  const cents = Number((fraction + '00').slice(0, 2));
  return { negative, whole: Number(wholePart === '' ? '0' : wholePart), cents };
}

/** "3,168,500" from "3168500.49"; "0" for nothing; a minus sign for a negative. */
export function kes(amount: string | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') return '0';
  const { negative, whole, cents } = split(amount);
  const rounded = cents >= 50 ? whole + 1 : whole;
  const text = String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return rounded === 0 ? '0' : negative ? `-${text}` : text;
}

/** "+205" or "-205" (a plus for a gain), used for the change columns. A zero change is "0". */
export function kesSigned(amount: string | null | undefined): string {
  const text = kes(amount);
  if (text === '0') return '0';
  return text.startsWith('-') ? text : `+${text}`;
}

/** "KES 3,168,500", for lines that name the currency in the value. */
export const kesLabel = (amount: string | null | undefined): string => `KES ${kes(amount)}`;

/** True when the text is a zero amount. */
export const isZero = (amount: string | null | undefined): boolean => kes(amount) === '0';

const parts = (iso: string, options: Intl.DateTimeFormatOptions): string => new Intl.DateTimeFormat('en-GB', { timeZone: NAIROBI, ...options }).format(new Date(iso));

/** "19 Oct" */
export const dayMonth = (iso: string): string => parts(iso, { day: 'numeric', month: 'short' });
/** "Fri 23 Oct" */
export const weekdayDayMonth = (iso: string): string => parts(iso, { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '');
/** "19 Oct, 12:05" */
export const dayMonthTime = (iso: string): string => `${dayMonth(iso)}, ${parts(iso, { hour: '2-digit', minute: '2-digit', hour12: false })}`;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "September" from "2026-09". */
export function monthName(monthKey: string): string {
  const index = Number(monthKey.slice(5, 7)) - 1;
  return MONTHS[index] ?? monthKey;
}

/** "1 Oct" from "2026-10-01" (a calendar day, no time zone maths). */
export function dayOfDate(date: string): string {
  const [, month, day] = date.split('-');
  return `${Number(day)} ${MONTHS[Number(month) - 1]?.slice(0, 3) ?? ''}`;
}

export const plural = (n: number, one: string, many: string = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

/** "86 people" / "1 person". */
export const people = (n: number): string => plural(n, 'person', 'people');

/** "41 h 05" from minutes. */
export const hoursOf = (minutes: number): string => `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;

/** A new idempotency key for one attempt at one act. The dialog keeps it until the act is answered. */
export const newKey = (): string => crypto.randomUUID();
