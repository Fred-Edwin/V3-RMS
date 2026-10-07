/**
 * Fixture mode only: a fixed "now" (Tue 13 Oct 2026, 11:20 Nairobi) that keeps moving while the page is open, and the text helpers the
 * fixture handlers share. The strings mirror what the real server sends ("Today 07:42", "6 days ago", KES with a plain minus).
 */
import { ApiError } from '@/types/api';

const BASE = Date.parse('2026-10-13T08:20:00.000Z');
const STARTED = typeof performance !== 'undefined' ? performance.now() : 0;

export const fixtureNow = (): number => BASE + Math.round((typeof performance !== 'undefined' ? performance.now() : 0) - STARTED);
export const nowIso = (): string => new Date(fixtureNow()).toISOString();
export const isoAgo = (hours: number): string => new Date(fixtureNow() - hours * 3_600_000).toISOString();

const NAIROBI_OFFSET_MS = 3 * 3_600_000;
const nairobi = (iso: string): Date => new Date(Date.parse(iso) + NAIROBI_OFFSET_MS);
const pad = (n: number): string => String(n).padStart(2, '0');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const hhmm = (iso: string): string => {
  const d = nairobi(iso);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};
export const dayMonth = (iso: string): string => {
  const d = nairobi(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};
export const dayMonthClock = (iso: string): string => `${dayMonth(iso)} ${hhmm(iso)}`;
export const nairobiDay = (iso: string): string => nairobi(iso).toISOString().slice(0, 10);
export const isToday = (iso: string): boolean => nairobiDay(iso) === nairobiDay(nowIso());

export function dayDiff(iso: string): number {
  return Math.round((Date.parse(`${nairobiDay(nowIso())}T00:00:00Z`) - Date.parse(`${nairobiDay(iso)}T00:00:00Z`)) / 86_400_000);
}

/** "Today", "Yesterday", "6 days ago", "Never counted". */
export function lastCountedText(iso: string | null): string {
  if (!iso) return 'Never counted';
  const d = dayDiff(iso);
  if (d <= 0) return 'Today';
  if (d === 1) return 'Yesterday';
  return `${d} days ago`;
}

/** "Today 07:42", "Mon 12 Oct 16:10". */
export function signedText(iso: string): string {
  if (isToday(iso)) return `Today ${hhmm(iso)}`;
  const d = nairobi(iso);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${hhmm(iso)}`;
}

/** "Tue 13 Oct" */
export function weekdayDayMonth(iso: string): string {
  const d = nairobi(iso);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** Decimal as the wire carries it: no trailing zeros. */
export const qty = (n: number): string => String(Math.round(n * 10_000) / 10_000);
/** KES with two decimals and a plain minus. */
export const kes = (n: number): string => (Math.round(n * 100) / 100).toFixed(2);
export const kesWhole = (n: number): string => `${n < 0 ? '−' : ''}KES ${Math.abs(Math.round(n)).toLocaleString('en-KE')}`;

export function fail(status: number, code: string, message: string): never {
  throw new ApiError(message, status, code);
}

export function paginate<T>(rows: T[], query: URLSearchParams): { slice: T[]; page: { page: number; pageSize: number; total: number } } {
  const pageSize = Number(query.get('pageSize') ?? query.get('perPage') ?? 50) || 50;
  const requested = Math.max(1, Number(query.get('page') ?? 1) || 1);
  const page = Math.min(requested, Math.max(1, Math.ceil(rows.length / pageSize)));
  return { slice: rows.slice((page - 1) * pageSize, page * pageSize), page: { page, pageSize, total: rows.length } };
}

export const norm = (s: string): string => s.toLowerCase();
