import { formatQty } from '../../../requisitions/lib/qty';
import { shortDateText } from '../../../requisitions/lib/time';

export { timeText } from '../../../requisitions/lib/time';

/** A figure as a person reads it: "27.50" → "27.5". */
export const figureText = formatQty;

/** "Wed 7 Oct" from a Nairobi day ("2026-10-07"). Noon UTC keeps the day whatever the zone. */
export const dayText = (date: string): string => shortDateText(`${date}T09:00:00.000Z`);

/** "Tuesday" in Nairobi, from an ISO time. */
export const weekdayText = (iso: string): string => new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Nairobi', weekday: 'long' }).format(new Date(iso));

/** The subtitle line under a phone title: "Barista · Wed 7 Oct · DAY-NYR-0044". */
export const dayLine = (department: string, date: string, tail: string): string => `${department} · ${dayText(date)} · ${tail}`;

/** "1 less than last night" / "2 more than last night" from the signed difference. */
export const differenceText = (difference: string): string => {
  const n = Number(difference);
  return `${formatQty(Math.abs(n))} ${n < 0 ? 'less' : 'more'} than last night`;
};

/** "−1" with the true minus sign (Paper B2b). */
export const signedText = (difference: string): string => {
  const n = Number(difference);
  return `${n < 0 ? '−' : '+'}${formatQty(Math.abs(n))}`;
};

/** The signer's title as Paper words it: "Barista Department Head", or "Barista Member" for a member (spec gap G33). */
export const signedByText = (department: string, isHead: boolean): string => `${department} ${isHead ? 'Department Head' : 'Member'}`;

export const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;
