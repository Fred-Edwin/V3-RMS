import type { WasteReversalReason } from '../../_shared/types/waste-contract';

const NAIROBI = 'Africa/Nairobi';

const REASON_SHORT: Record<WasteReversalReason, string> = { WRONG_ITEM: 'wrong item', WRONG_QUANTITY: 'wrong quantity', OTHER: 'other' };
/** The reason as it reads in the desktop chip: "Reversed 09:12 · wrong item". */
export const reversalReasonShort = (reason: WasteReversalReason): string => REASON_SHORT[reason];

/** "Wed 7 Oct" style helpers over a Nairobi `YYYY-MM-DD`. */
const at = (ymd: string): Date => new Date(`${ymd}T12:00:00+03:00`);
const long = (ymd: string): string => new Intl.DateTimeFormat('en-GB', { timeZone: NAIROBI, weekday: 'long', day: 'numeric', month: 'long' }).format(at(ymd));
const dayMonth = (ymd: string): string => new Intl.DateTimeFormat('en-GB', { timeZone: NAIROBI, day: 'numeric', month: 'long' }).format(at(ymd));
const dayOnly = (ymd: string): string => new Intl.DateTimeFormat('en-GB', { timeZone: NAIROBI, day: 'numeric' }).format(at(ymd));
const monthOf = (ymd: string): string => new Intl.DateTimeFormat('en-GB', { timeZone: NAIROBI, month: 'long' }).format(at(ymd));

/**
 * The date part of the page subtitle (spec gap G21): "Wednesday 7 October" for one day, "1 to 7 October" for a range in one month,
 * "28 September to 4 October" across two months.
 */
export function rangeLabel(from: string, to: string): string {
  if (from === to) return long(from);
  if (monthOf(from) === monthOf(to)) return `${dayOnly(from)} to ${dayMonth(to)}`;
  return `${dayMonth(from)} to ${dayMonth(to)}`;
}

/** "7 Oct 14:20" for the facts table, from an ISO time. */
export function dayClock(iso: string): string {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat('en-GB', { timeZone: NAIROBI, day: 'numeric', month: 'short' }).format(d);
  const clock = new Intl.DateTimeFormat('en-GB', { timeZone: NAIROBI, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return `${day} ${clock}`;
}
