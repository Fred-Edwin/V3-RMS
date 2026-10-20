import { isoWeekday, nairobiClockOf, nairobiDateOf, parseNairobiDate } from '../../_shared/time/nairobi-time';
import type { NotifyData } from '../notification-types';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** '2026-09' becomes 'September 2026'. Anything else is shown as it came (a notification never fails on a odd value). */
export function monthName(key: string | null): string {
  const match = key ? /^(\d{4})-(\d{2})$/.exec(key) : null;
  const month = match ? MONTHS[Number(match[2]) - 1] : undefined;
  return match && month ? `${month} ${match[1]}` : (key ?? 'the month');
}

/** '2026-10-26' becomes 'Mon 26 Oct'. */
export function dayLabel(date: string | null): string {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return date ?? 'that day';
  const month = MONTHS[Number(date.slice(5, 7)) - 1];
  return `${DAYS[isoWeekday(parseNairobiDate(date)) - 1]} ${Number(date.slice(8, 10))} ${month?.slice(0, 3) ?? ''}`.trim();
}

/** 'Today 14:05' for an ISO instant in Nairobi time; the clock alone when it is not today. */
export function clockLabel(iso: string | null, now: Date = new Date()): string {
  const at = iso ? new Date(iso) : null;
  if (!at || Number.isNaN(at.getTime())) return 'just now';
  return nairobiDateOf(at) === nairobiDateOf(now) ? nairobiClockOf(at) : `${dayLabel(nairobiDateOf(at))} ${nairobiClockOf(at)}`;
}

export const text = (data: NotifyData, key: string, fallback: string): string => {
  const value = data[key];
  return typeof value === 'string' && value.trim() !== '' ? value : typeof value === 'number' ? String(value) : fallback;
};

export const num = (data: NotifyData, key: string): number | null => (typeof data[key] === 'number' ? (data[key] as number) : null);

/** '{Name}, {Role}' for a record that names a person; the role alone when there is no name. */
export const roleLabel = (role: string | null): string =>
  (role ?? '').split('_').map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(' ').replace('Hr ', 'HR ').trim() || 'A colleague';

export const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;
