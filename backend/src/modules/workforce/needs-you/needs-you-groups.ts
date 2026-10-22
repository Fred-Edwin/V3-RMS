import { nairobiToday } from '../_shared/time/nairobi-time';
import type { NeedsYouRow } from './needs-you-types';
import { DAY_MS, OVERDUE_DAYS } from './needs-you-scope';

/**
 * How Home groups and orders the Needs you rows (Paper 1.1 to 1.12): "Pay changes · 2", the kind chips of the See all list, and
 * overdue first. Pure, so the wording and the order are tested without a database.
 */

export interface KindGroup {
  key: string;
  label: string;
}

const GROUPS: Record<string, KindGroup> = {
  leave: { key: 'leave', label: 'Leave' },
  overtime: { key: 'timesheets', label: 'Timesheets' },
  'clock-fix': { key: 'timesheets', label: 'Timesheets' },
  'shift-closed': { key: 'timesheets', label: 'Timesheets' },
  month: { key: 'timesheets', label: 'Timesheets' },
  'casual-pay': { key: 'casual', label: 'Casual pay' },
  payroll: { key: 'payroll', label: 'Payroll' },
  tables: { key: 'payroll', label: 'Payroll' },
  p9: { key: 'payroll', label: 'Payroll' },
  security: { key: 'security', label: 'Security' },
  'conduct-sign': { key: 'conduct', label: 'Conduct' },
  'conduct-record': { key: 'conduct', label: 'Conduct' },
  'conduct-appeal': { key: 'conduct', label: 'Conduct' },
  'conduct-notice': { key: 'conduct', label: 'Conduct' },
  'pay-change': { key: 'pay-changes', label: 'Pay changes' },
  'attention-hiring': { key: 'hiring', label: 'Hiring' },
  'attention-probation': { key: 'probation', label: 'Probation' },
  'attention-no-head': { key: 'departments', label: 'Departments' },
};

const OTHER: KindGroup = { key: 'other', label: 'Other' };

export const groupOf = (kind: string): KindGroup => GROUPS[kind] ?? OTHER;

/** A probation decision whose date has passed is overdue at once (Paper: they lead the list); everything else after 3 days waiting. */
export function isOverdue(row: Pick<NeedsYouRow, 'kind' | 'since'>, now: Date): boolean {
  // The probation row's `since` is the end date itself (a date column), so it compares as a Nairobi day.
  if (row.kind === 'attention-probation') return row.since.slice(0, 10) < nairobiToday(now);
  return now.getTime() - new Date(row.since).getTime() > OVERDUE_DAYS * DAY_MS;
}

export type MarkedRow = NeedsYouRow & { overdue: boolean };

/** Overdue first (probation decisions ahead of the rest of the overdue), then the oldest first, then by id for a stable order. */
export function orderForHome(rows: readonly NeedsYouRow[], now: Date): MarkedRow[] {
  const marked = rows.map((r) => ({ ...r, overdue: isOverdue(r, now) }));
  const rank = (r: MarkedRow): number => (r.overdue ? (r.kind === 'attention-probation' ? 0 : 1) : 2);
  return marked.sort((a, b) => rank(a) - rank(b) || a.since.localeCompare(b.since) || a.id.localeCompare(b.id));
}

/** What each group says on Home (Paper 1.1): the sentence for several, the button, and where it opens. */
const SUMMARY: Record<string, { many: (n: number) => string; action: string }> = {
  leave: { many: (n) => `${n} leave requests to decide`, action: 'Decide' },
  timesheets: { many: (n) => `${n} timesheet items to check`, action: 'Review' },
  casual: { many: (n) => `${n} casual pay sheets to approve`, action: 'Review' },
  payroll: { many: (n) => `${n} payroll steps waiting`, action: 'Open' },
  security: { many: (n) => `${n} security alerts open`, action: 'Look' },
  conduct: { many: (n) => `${n} conduct items waiting`, action: 'Open' },
  'pay-changes': { many: (n) => `${n} pay changes waiting for the Director`, action: 'Review' },
  hiring: { many: (n) => `${n} files to finish`, action: 'Finish file' },
  probation: { many: (n) => `${n} probation decisions to take`, action: 'Decide' },
  departments: { many: (n) => `${n} departments without a head`, action: 'Assign heads' },
  other: { many: (n) => `${n} requests waiting`, action: 'Open' },
};

export const OVERDUE_KEY = 'overdue';

/** The button on a row of the See all list. */
export const actionOf = (kind: string): string => (SUMMARY[groupOf(kind).key] ?? (SUMMARY['other'] as (typeof SUMMARY)[string])).action;

/** How a role reads in "Waiting for ...": HR, never "hr manager". */
const WAITING_ON: Record<string, string> = {
  HR_MANAGER: 'HR',
  DIRECTOR: 'the Director',
  ACCOUNTANT: 'the Accountant',
  MANAGER: 'the Branch Manager',
  STORE_MANAGER: 'the Store Manager',
  SYSTEM_ADMIN: 'the System Admin',
};

/** The grey second line of a row: who it waits on, and for how long. The server's `text` is the first line. */
export function lineOf(row: Pick<NeedsYouRow, 'since' | 'waitingOnRole'>, now: Date): string {
  const days = Math.max(0, Math.floor((now.getTime() - new Date(row.since).getTime()) / DAY_MS));
  const who = WAITING_ON[row.waitingOnRole] ?? row.waitingOnRole.toLowerCase().split('_').join(' ');
  return `Waiting for ${who}${days > 0 ? `, ${days} ${days === 1 ? 'day' : 'days'}` : ', since today'}.`;
}

export interface HomeSummaryRow {
  key: string;
  /** "Pay changes · 2" for the Kind column. */
  kindLabel: string;
  count: number;
  title: string;
  line: string;
  action: string;
  opens: string;
  /** The oldest item's date. */
  since: string;
  overdue: boolean;
}

const daysOld = (iso: string, now: Date): number => Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / DAY_MS));

/**
 * The rows of Home's Needs you table (Paper 1.1): one row per kind, with a count, and every overdue item together in a first
 * "Overdue" row. Several items become one sentence ("2 pay changes waiting for the Director") and "The oldest is 2 days old.";
 * a single item keeps its own words. `rows` are already ordered by `orderForHome`.
 */
export function summariseForHome(rows: readonly MarkedRow[], now: Date, limit: number): { summary: HomeSummaryRow[]; kinds: number } {
  const buckets = new Map<string, { label: string; rows: MarkedRow[] }>();
  const put = (key: string, label: string, row: MarkedRow): void => {
    const b = buckets.get(key);
    if (b) b.rows.push(row);
    else buckets.set(key, { label, rows: [row] });
  };
  for (const row of rows) {
    if (row.overdue) put(OVERDUE_KEY, 'Overdue', row);
    else put(groupOf(row.kind).key, groupOf(row.kind).label, row);
  }
  const summary = [...buckets.entries()].map(([key, b]): HomeSummaryRow => {
    const oldest = [...b.rows].sort((x, y) => x.since.localeCompare(y.since))[0] as MarkedRow;
    const first = b.rows[0] as MarkedRow;
    const kindGroup = groupOf(first.kind);
    const spec = SUMMARY[key === OVERDUE_KEY ? kindGroup.key : key] ?? (SUMMARY['other'] as (typeof SUMMARY)[string]);
    const one = b.rows.length === 1;
    const sameTarget = b.rows.every((r) => r.opens.split('?')[0] === first.opens.split('?')[0]);
    return {
      key,
      kindLabel: `${b.label} · ${b.rows.length}`,
      count: b.rows.length,
      title: one ? first.text : key === OVERDUE_KEY ? `${b.rows.length} requests are overdue` : spec.many(b.rows.length),
      line: one ? (first.siteName ?? `Waiting ${daysOld(first.since, now)} days`) : `The oldest is ${daysOld(oldest.since, now)} days old.`,
      action: spec.action,
      opens: one || sameTarget ? first.opens : `/app/workforce/needs-you?group=${key}`,
      since: oldest.since,
      overdue: key === OVERDUE_KEY,
    };
  });
  // Overdue first (it is built first, because `rows` start with the overdue ones), then the groups in the order their oldest item waits.
  return { summary: summary.slice(0, limit), kinds: summary.length };
}

export interface GroupCount extends KindGroup {
  count: number;
}

/** The chips: one per group present, in the order the rows first meet them. */
export function groupCounts(rows: readonly NeedsYouRow[]): GroupCount[] {
  const counts = new Map<string, GroupCount>();
  for (const row of rows) {
    const g = groupOf(row.kind);
    const found = counts.get(g.key);
    if (found) found.count += 1;
    else counts.set(g.key, { ...g, count: 1 });
  }
  return [...counts.values()];
}
