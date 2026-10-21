/** The Director's payslip-openings digest (6a A9): who opened other people's payslips, per day. Never whose, never an amount. */

export interface DigestRow {
  openerId: string;
  name: string;
  role: string;
  day: string;
  count: number;
  firstAt: string | null;
  lastAt: string | null;
  /** A hint for the card, not a rule: over 150 payslips in a day. */
  many: boolean;
}

export interface DigestDay {
  day: string;
  rows: DigestRow[];
}

export const DIGEST_COPY = {
  title: 'Payslip openings',
  subtitle: 'Who opened other people’s payslips. Never whose, never an amount.',
  error: 'We could not load the payslip openings.',
  many: 'Many',
} as const;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function nairobiDay(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function addDay(day: string, n: number): string {
  return new Date(new Date(`${day}T00:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);
}

/** The mono day heading: TODAY, YESTERDAY, "Mon 12 Oct". */
export function dayHeading(day: string, today: string): string {
  if (day === today) return 'TODAY';
  if (day === addDay(today, -1)) return 'YESTERDAY';
  const d = new Date(`${day}T00:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "12 payslips". */
export const countWords = (n: number): string => `${n} ${n === 1 ? 'payslip' : 'payslips'}`;

/** "09:12 to 11:40" in Nairobi time; one time when the first and last are the same minute; null for a day counted before spans were kept. */
export function spanWords(firstAt: string | null, lastAt: string | null): string | null {
  if (!firstAt || !lastAt) return null;
  const clock = (iso: string): string => new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Nairobi', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
  const a = clock(firstAt);
  const b = clock(lastAt);
  return a === b ? a : `${a} to ${b}`;
}

/** Newest day first, each day's busiest opener first; a day with no rows is dropped. */
export function orderDays(days: readonly DigestDay[]): DigestDay[] {
  return days
    .filter((d) => d.rows.length > 0)
    .map((d) => ({ day: d.day, rows: [...d.rows].sort((a, b) => b.count - a.count) }))
    .sort((a, b) => (a.day < b.day ? 1 : -1));
}

/** The Audit log opened on that opener and that day: `event=payslips` is the Payslip access group. */
export const logLink = (row: Pick<DigestRow, 'openerId' | 'day'>): string => `/app/workforce/audit-log?event=payslips&actor=${row.openerId}&from=${row.day}&to=${row.day}`;
