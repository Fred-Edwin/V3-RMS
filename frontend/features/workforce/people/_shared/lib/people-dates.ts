/**
 * Date words for the People screens. The API sends Nairobi calendar dates as `YYYY-MM-DD`; these read the parts of the string and
 * never build a local-time `Date`, so a device in another zone shows the same day. Pure and tested.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

interface Parts {
  year: number;
  month: number;
  day: number;
}

function partsOf(date: string): Parts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

const weekdayOf = ({ year, month, day }: Parts): string => WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()] ?? '';

/** "14 Oct" */
export function formatDayMonth(date: string): string {
  const p = partsOf(date);
  return p ? `${p.day} ${MONTHS[p.month - 1] ?? ''}` : date;
}

/** "Mon 5 Oct" */
export function formatWeekdayDayMonth(date: string): string {
  const p = partsOf(date);
  return p ? `${weekdayOf(p)} ${p.day} ${MONTHS[p.month - 1] ?? ''}` : date;
}

/** "Mon 5 Oct 2026" */
export function formatFullDate(date: string): string {
  const p = partsOf(date);
  return p ? `${weekdayOf(p)} ${p.day} ${MONTHS[p.month - 1] ?? ''} ${p.year}` : date;
}

/** "14 Jul 2026" */
export function formatDayMonthYear(date: string): string {
  const p = partsOf(date);
  return p ? `${p.day} ${MONTHS[p.month - 1] ?? ''} ${p.year}` : date;
}

/** Whole days from `from` to `to` (negative when `to` is earlier). Calendar days, so a clock change never moves it. */
export function daysBetween(from: string, to: string): number {
  const a = partsOf(from);
  const b = partsOf(to);
  if (!a || !b) return 0;
  return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86_400_000);
}

/** The Nairobi calendar day for an instant. Nairobi is UTC+3 all year. */
export function nairobiDay(now: Date = new Date()): string {
  return new Date(now.getTime() + 3 * 3_600_000).toISOString().slice(0, 10);
}

/** Adds calendar days to a `YYYY-MM-DD` string. */
export function addDays(date: string, days: number): string {
  const p = partsOf(date);
  if (!p) return date;
  return new Date(Date.UTC(p.year, p.month - 1, p.day + days)).toISOString().slice(0, 10);
}

/** "KES 28,000" from a money string. Thousands separators, the cents only when there are some. */
export function formatKes(amount: string | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') return '';
  const [whole = '0', cents] = amount.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `KES ${grouped}${cents && Number(cents) !== 0 ? `.${cents.padEnd(2, '0')}` : ''}`;
}
