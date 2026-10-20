import type { KeyValueRow, WorkforceKpiCell } from '../../../_shared';
import { dayMonthYear, monthYear, shortDay } from '../../_shared/lib/conduct-dates';
import { deskTone, plural } from '../../_shared/lib/conduct-words';
import type { DeskDetail, DeskFilter, DeskList } from '../../_shared/types/conduct-types';

/**
 * The words and rules of the desk list and its detail panel (spec S8, S12), as pure functions the tests can pin. Nothing here reads a role:
 * what a person may do comes from `detail.actions`, which the server fills from the access table.
 */
export const FILTER_VALUES: ReadonlySet<string> = new Set(['active', 'appealed', 'ended']);

/** The chip filter's value for the shared table: Active is the default, so it is the empty value. */
export const chipValue = (filter: DeskFilter): string => (filter === 'active' ? '' : filter);
export const filterOf = (value: string | undefined): DeskFilter => (value === 'appealed' || value === 'ended' ? value : 'active');

export const KPI_SUBTITLE = 'a notice is signed, kept on the file, and ends by itself';

export function kpiCells(counts: DeskList['counts'], next: DeskList['nextEnding'], onAppeals: () => void): WorkforceKpiCell[] {
  return [
    { key: 'active', label: 'ACTIVE NOTICES', value: String(counts.active), detail: 'across the people listed' },
    { key: 'written', label: 'WRITTEN WARNINGS', value: String(counts.written), detail: 'the rest are verbal notes' },
    { key: 'ending', label: 'ENDING IN 30 DAYS', value: String(counts.endingIn30), detail: next ? `next: ${next.jobLabel}, ${next.date}` : 'nothing ends soon' },
    { key: 'appeals', label: 'APPEALS WITH HR', value: String(counts.appealsWithHr), detail: 'HR decides, never the issuer', actionable: counts.appealsWithHr > 0, onSelect: counts.appealsWithHr > 0 ? onAppeals : undefined },
  ];
}

/** Chip counts for the shared table, keyed by the chip filter's value. */
export const chipCounts = (counts: DeskList['counts']): Record<string, Record<string, number>> => ({ status: { '': counts.active, appealed: counts.appealed, ended: counts.ended } });

export const EMPTY_COPY: Record<DeskFilter, { title: string; line: string }> = {
  active: { title: 'No active notices', line: 'Issue a warning when one is needed.' },
  appealed: { title: 'No appeals', line: 'HR decides them, never the issuer.' },
  ended: { title: 'Nothing has ended yet', line: 'A notice that ends by itself stays on the list, marked as ended.' },
};

/** "Late 5 times in September 2026" or the manager's own line when the notice has no timesheet facts. */
export function whatHappened(d: DeskDetail): string {
  if (!d.facts) return d.verbalLine ?? d.ownLine;
  const noun = d.facts.kind === 'LATENESS' ? 'late' : 'absent';
  return `${noun === 'late' ? 'Late' : 'Absent'} ${plural(d.facts.count, 'time')} in ${monthYear(d.facts.monthKey)}`;
}

export function detailRows(d: DeskDetail): KeyValueRow[] {
  const rows: KeyValueRow[] = [{ label: 'What happened', value: whatHappened(d) }];
  if (d.facts) rows.push({ label: 'Evidence from timesheets', value: `${d.facts.minutes} min in total`, mono: true });
  rows.push(
    { label: 'Signed', value: d.signedLine, tone: d.status === 'ISSUED' || d.status === 'GIVEN_NOT_SIGNED' ? 'warning' : 'default' },
    { label: 'Appeal', value: d.appealLine },
    { label: 'Ends by itself on', value: `${d.validUntil} · ${plural(d.months, 'month')}`, mono: true }
  );
  if (d.witness && d.witness.state === 'NOT_CONFIRMED') rows.push({ label: 'Witness', value: 'Not confirmed', tone: 'warning' });
  if (d.witness && d.witness.state === 'DECLINED') rows.push({ label: 'Witness', value: 'Did not confirm', tone: 'warning' });
  return rows;
}

export type RecordButton = { show: false } | { show: true; enabled: boolean; reason: string | null };

/** "Record that it was not signed": shown to the issuer or HR; waits for the sign limit unless the person has no login (spec S11). */
export function recordButton(d: DeskDetail, now: Date): RecordButton {
  if (!d.actions.canRecordNotSigned) return { show: false };
  if (d.actions.recordableFrom && new Date(d.actions.recordableFrom) > now) return { show: true, enabled: false, reason: `You can record this from ${shortDay(d.actions.recordableFrom)}.` };
  return { show: true, enabled: true, reason: null };
}

/** The grey line that stands in for the buttons on an appealed notice the reader cannot decide. */
export const withHrLine = (d: DeskDetail): string | null => (d.status === 'APPEALED' && d.appeal && !d.actions.canDecide ? `With HR since ${shortDay(d.appeal.appealedAt)}` : null);

/** The title of the detail panel: "Dan Kiprop · Written warning". */
export const panelTitle = (d: DeskDetail): string => d.title;

/** "WRN-0004 · issued Thu 20 Aug 2026 by Faith Njeri, Branch Manager" (the mono line under the title). */
export const panelSubline = (d: DeskDetail): string => `${d.number ? `${d.number} · ` : ''}issued ${shortDay(d.issuedAt)} ${dayMonthYear(d.issuedAt).split(' ').pop()} by ${d.issuerLabel}`;

/** The status word and its tone for the table. */
export const rowStatus = (word: string, status: Parameters<typeof deskTone>[0]) => ({ word, tone: deskTone(status) });

/** Whether this detail is an appeal the reader should see in the appeal layout (HR and the Director read it, others get the plain panel). */
export const showsAppealLayout = (d: DeskDetail, readsAll: boolean): boolean => d.status === 'APPEALED' && d.appeal !== null && (d.actions.canDecide || readsAll);
