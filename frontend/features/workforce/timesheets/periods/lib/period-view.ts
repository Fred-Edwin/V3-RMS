import type { WorkforceKpiCell } from '../../../_shared';
import { hm, hmWords, wholeHours } from '../../_shared/lib/timesheet-words';
import type { PeriodView, PersonRow } from '../../_shared/types/timesheet-types';

/** The Timesheets page's numbers and words (Paper Chapter 8, step 1). Pure. */

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** The four numbers under the title. "Needs you" is the one cell you act on; it shows the people with something to decide. */
export function kpiCells(view: PeriodView, onNeedsYou?: () => void): WorkforceKpiCell[] {
  const { summary, counts } = view;
  return [
    { key: 'auto', label: 'APPROVED BY ITSELF', value: plural(summary.autoApprovedDays, 'day', 'days'), detail: 'matched the rota' },
    {
      key: 'needs',
      label: 'NEEDS YOU',
      value: String(counts.needsLook),
      detail: counts.needsLook === 0 ? 'nothing to decide' : summary.pendingOvertimeItems > 0 ? 'overtime, closed shifts, fixes' : 'closed shifts, fixes',
      actionable: counts.needsLook > 0,
      onSelect: counts.needsLook > 0 ? onNeedsYou : undefined,
    },
    { key: 'late', label: 'LATE, RECORDED', value: String(summary.lateDays), detail: 'for payroll, nothing to approve' },
    { key: 'hours', label: 'HOURS WORKED', value: wholeHours(summary.workedMinutes), detail: `plan was ${wholeHours(summary.plannedMinutes)}` },
  ];
}

/** What the "what needs you" cell says for one person: the days to look at and the overtime waiting, or that the system took care of it. */
export function needsLine(row: PersonRow): { text: string; needs: boolean } {
  const parts: string[] = [];
  if (row.needsLookDays > 0) parts.push(plural(row.needsLookDays, 'day to look at', 'days to look at'));
  if (row.overtimePendingMinutes > 0) parts.push(`overtime ${hmWords(row.overtimePendingMinutes)}`);
  if (parts.length > 0) return { text: parts.join(' · '), needs: true };
  if (row.lateDays > 0) return { text: `Late ${plural(row.lateDays, 'day', 'days')}, recorded for payroll`, needs: false };
  if (row.absentDays > 0) return { text: `${plural(row.absentDays, 'day', 'days')} not in`, needs: false };
  return { text: 'Nothing. Approved by the system', needs: false };
}

export const filterCounts = (view: PeriodView | null): Record<string, Record<string, number>> | undefined =>
  view ? { filter: { '': view.counts.needsLook, LATE: view.counts.late, ALL: view.counts.all } } : undefined;

/** The URL's chip value to the API's filter: the first chip ("Needs a look") is the clean address. */
export const apiFilterOf = (chip: string | undefined): 'NEEDS_LOOK' | 'LATE' | 'ALL' => (chip === 'LATE' ? 'LATE' : chip === 'ALL' ? 'ALL' : 'NEEDS_LOOK');

/** "Showing 5 of 31 that need you or were late": the line under the table. */
export const footerLine = (view: PeriodView): string => `${view.people.rows.length} of ${view.people.total} shown · ${view.counts.all} people this month`;

/** Planned and worked as the table prints them. */
export const hoursCell = (minutes: number): string => hm(minutes);

/** Can the manager close this period now? Only on its last day or after, and only while it is open. */
export function canCloseNow(period: { state: string; end: string }, today: string): boolean {
  return period.state === 'OPEN' && today >= period.end;
}
