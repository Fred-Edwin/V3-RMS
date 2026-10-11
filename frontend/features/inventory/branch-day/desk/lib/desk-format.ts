/**
 * Formatting for the Branch day desktop screens, in the words Paper draws: "6:20 pm", "Wednesday 7 October", "Wed 7 Oct", "50,060".
 * Every time is shown in Nairobi (contract §16 gap 17: the back end sends ISO times and dates as Nairobi days).
 */

const NAIROBI = 'Africa/Nairobi';
const MINUS = '−';

const nf0 = new Intl.NumberFormat('en-KE', { maximumFractionDigits: 0 });
const nfq = new Intl.NumberFormat('en-KE', { maximumFractionDigits: 4 });

const parts = (iso: string, options: Intl.DateTimeFormatOptions): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat('en-GB', { timeZone: NAIROBI, ...options }).formatToParts(new Date(iso))) out[p.type] = p.value;
  return out;
};

/** "6:20 pm" */
export function clock12(iso: string): string {
  const p = parts(iso, { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${p.hour}:${p.minute} ${(p.dayPeriod ?? '').toLowerCase()}`;
}

/** The Nairobi day of an ISO time, as `YYYY-MM-DD`. */
export function nairobiDay(iso: string): string {
  const p = parts(iso, { year: 'numeric', month: '2-digit', day: '2-digit' });
  return `${p.year}-${p.month}-${p.day}`;
}

const dayParts = (day: string): Record<string, string> => parts(`${day}T12:00:00+03:00`, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** "Wednesday 7 October" for a Nairobi day (`YYYY-MM-DD`). */
export function longDay(day: string): string {
  const p = dayParts(day);
  return `${p.weekday} ${p.day} ${p.month}`;
}

/** "Wednesday 7 October 2026" */
export function longDayYear(day: string): string {
  const p = dayParts(day);
  return `${p.weekday} ${p.day} ${p.month} ${p.year}`;
}

/** "Wed 7 Oct" */
export function shortDay(day: string): string {
  const p = parts(`${day}T12:00:00+03:00`, { weekday: 'short', day: 'numeric', month: 'short' });
  return `${p.weekday} ${p.day} ${p.month}`;
}

/** "Thu 8 Oct, 9:15 am" from an ISO time. */
export function shortDayClock(iso: string): string {
  return `${shortDay(nairobiDay(iso))}, ${clock12(iso)}`;
}

/** "Thu 9:14 am" (Activity's WHEN column). */
export function weekdayClock(iso: string): string {
  const p = parts(iso, { weekday: 'short' });
  return `${p.weekday} ${clock12(iso)}`;
}

/** Whole shillings with thousands separators: "50,060". Null or undefined reads "–". */
export function kes(value: string | null | undefined): string {
  if (value === null || value === undefined) return '–';
  const n = Number(value);
  return Number.isFinite(n) ? nf0.format(Math.round(n)) : value;
}

/** A quantity as Paper draws it: no trailing zeros, the real minus. */
export function qty(value: string | null | undefined): string {
  if (value === null || value === undefined) return '–';
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return `${n < 0 ? MINUS : ''}${nfq.format(Math.abs(n))}`;
}

/** "−3 bags" / "+2 bags": a signed ledger quantity with its unit; "1 bag" when it is exactly one. */
export function signedUnits(value: string, unit: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  const one = Math.abs(n) === 1 && unit.endsWith('s') && !unit.endsWith('ss') ? unit.slice(0, -1) : unit;
  return `${n < 0 ? MINUS : n > 0 ? '+' : ''}${nfq.format(Math.abs(n))} ${one}`;
}

/** "5 of 8 counted" style helper: "1 item", "8 items". */
export const itemsText = (n: number): string => `${n} ${n === 1 ? 'item' : 'items'}`;
