import type { NeedsYouRow } from '../types/needs-you-types';

/**
 * The words and colours of the Needs you card (6b N1, N3). Pure, so they are tested without a browser.
 * Times are shown on Nairobi's clock, whatever the device says.
 */
const NAIROBI = 'Africa/Nairobi';
const DAY_MS = 86_400_000;

const dayKey = (d: Date): string => new Intl.DateTimeFormat('en-CA', { timeZone: NAIROBI }).format(d);
const clock = (d: Date): string => new Intl.DateTimeFormat('en-GB', { timeZone: NAIROBI, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);

/** Whole Nairobi calendar days between two moments (a row from 23:50 yesterday is 1 day old at 00:10). */
export function calendarDaysBetween(from: Date, to: Date): number {
  const a = Date.parse(dayKey(from));
  const b = Date.parse(dayKey(to));
  return Math.max(0, Math.round((b - a) / DAY_MS));
}

/** "Today 09:02", "Yesterday", "3 days", "13 days": the SINCE column. */
export function sinceWords(since: string, now: Date): string {
  const at = new Date(since);
  const days = calendarDaysBetween(at, now);
  if (days === 0) return `Today ${clock(at)}`;
  if (days === 1) return 'Yesterday';
  return `${days} days`;
}

export type SinceTone = 'default' | 'warning' | 'error';

/** Neutral today, amber from yesterday, red after 3 days (SD18). */
export function sinceTone(since: string, now: Date): SinceTone {
  const days = calendarDaysBetween(new Date(since), now);
  if (days > 3) return 'error';
  return days >= 1 ? 'warning' : 'default';
}

/** The kind label in capitals is drawn by the table; this is the spoken one. */
export function rowName(row: Pick<NeedsYouRow, 'kind' | 'text' | 'isNew' | 'since'>, now: Date): string {
  return `${kindLabel(row.kind)}, ${row.text}, since ${sinceWords(row.since, now)}${row.isNew ? ', new' : ''}`;
}

const KIND_LABEL: Record<string, string> = {
  overtime: 'Overtime',
  'clock-fix': 'Clock fix',
  'shift-closed': 'Shift closed',
  month: 'Month',
  'casual-pay': 'Casual pay',
  leave: 'Leave',
  appeal: 'Appeal',
  payroll: 'Payroll',
  tables: 'Tables',
  p9: 'P9',
  security: 'Security',
  'head-office-month': 'Head office month',
};

/** The KIND column. The server's kind is a slug; an unknown one is shown capitalised, never hidden. */
export function kindLabel(kind: string): string {
  const known = KIND_LABEL[kind];
  if (known) return known;
  const spaced = kind.replace(/[-_]+/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const WHERE: ReadonlyArray<[string, string]> = [
  ['/app/workforce/timesheets', 'Timesheets'],
  ['/app/workforce/requests', 'Requests'],
  ['/app/workforce/today', 'Today board'],
  ['/app/workforce/casuals', 'Casual pay'],
  ['/app/workforce/payroll', 'Payroll'],
  ['/app/workforce/rules', 'Rules'],
  ['/app/workforce/my-payslips', 'Payslips'],
  ['/app/workforce/security', 'Security alerts'],
  ['/app/workforce/leave', 'Leave'],
  ['/app/workforce/conduct', 'Conduct'],
];

/** The WHERE YOU DECIDE column: the name of the page the row opens. */
export function whereLabel(opens: string): string {
  return WHERE.find(([prefix]) => opens === prefix || opens.startsWith(`${prefix}/`) || opens.startsWith(`${prefix}?`))?.[1] ?? 'Open';
}

/** A menu badge number: 99 and above read "99+". */
export const badgeText = (count: number): string => (count > 99 ? '99+' : String(count));

/** What a screen reader hears for a badge. */
export const badgeSpoken = (label: string, count: number): string => `${label}, ${count} waiting`;

/** The kinds present in a list, each with its count, in the order they first appear (the Kind chip bar above 25 rows). */
export function kindCounts(rows: readonly Pick<NeedsYouRow, 'kind'>[]): Array<{ kind: string; count: number }> {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.kind, (counts.get(row.kind) ?? 0) + 1);
  return Array.from(counts, ([kind, count]) => ({ kind, count }));
}

/** The card's title and the polite live-region text. */
export const cardTitle = (total: number): string => `Needs you · ${total}`;
export const liveText = (total: number): string => `Needs you: ${total}`;

/** The footer line under the table. */
export function footerWords(shown: number, total: number): string {
  return `Showing ${shown} of ${total} · each row opens its page · a request nobody answers for 3 days moves to HR`;
}

/** Search matches the kind, the text and the site. */
export function matchesSearch(row: Pick<NeedsYouRow, 'kind' | 'text' | 'siteName'>, term: string): boolean {
  const needle = term.trim().toLowerCase();
  if (needle === '') return true;
  return `${row.kind} ${row.text} ${row.siteName ?? ''}`.toLowerCase().includes(needle);
}

/**
 * Where a row's link goes. The server's `opens` is a guess for four kinds, so each is checked against the real routes here and fixed
 * in one place (listed in decisions-6a-frontend.md). Every other link is used as the server sent it.
 */
export function opensFor(row: Pick<NeedsYouRow, 'kind' | 'text' | 'opens'>): string {
  const { opens } = row;
  if (opens.startsWith('/app/workforce/casual?')) return '/app/workforce/casuals/approve';
  if (opens === '/app/workforce/rules/statutory') return '/app/workforce/rules?tab=statutory';
  if (opens === '/app/workforce/payslips/p9') {
    const year = /\b(20\d{2})\b/.exec(row.text)?.[1];
    return year ? `/app/workforce/my-payslips/p9/${year}` : '/app/workforce/my-payslips/history';
  }
  return opens;
}
