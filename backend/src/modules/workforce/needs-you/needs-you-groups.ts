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
