import type { AccessSubject } from '../../_shared/workforce-access';
import { refreshPeriod } from '../assemble/assemble-service';
import { timesheetDaysRepository } from '../days/timesheet-days-repository';
import { overtimeRepository } from '../overtime/overtime-repository';
import { filterRows, personRows, summarise, type PeriodSummary } from '../periods/period-view';
import { periodsRepository } from '../periods/periods-repository';
import { periodForViewer } from '../periods/periods-service';
import type { OvertimeRow, PeriodRow } from '../timesheets.types';

export interface ReportRow {
  employeeId: string;
  name: string;
  departmentName: string | null;
  plannedMinutes: number;
  workedMinutes: number;
  lateMinutes: number;
  absentDays: number;
  overtimeAuthorisedMinutes: number;
  /** "Decided by": what happened to this person's period, in the order it happened. Codes, not wording. */
  notes: { code: 'APPROVED_BY_SYSTEM' | 'OVERTIME_DECIDED' | 'DAY_DECIDED' | 'OPEN_MOVES_ON'; by: string | null; minutes?: number; date?: string }[];
}

export interface TimesheetReport {
  number: string; // TSH-0007
  site: string;
  period: PeriodRow;
  summary: PeriodSummary;
  rows: ReportRow[];
  closed: { at: string; automatically: boolean; by: string | null } | null;
  /** The manager's signature (PIN) and, later, payroll's receipt (slice 6). */
  signatures: { signedBy: { name: string; role: string; at: string } | null; receivedByPayroll: null };
  /** Nothing in this report is money: pay is decided by payroll from these minutes. */
  carriedOnDays: number;
  carriedOnOvertime: number;
}

const code = (n: number): string => `TSH-${String(n).padStart(4, '0')}`;

/**
 * The timesheet as one landscape report (TSH-0007, Chapter 8 step 5): the same figures as the screen, one row per person,
 * what is still open and where it moved. Readable by everyone who can read timesheets, within their scope (a head sees
 * their departments). The manager signs it separately with their PIN (`signReport`). Hours only; no pay figure.
 */
export async function periodReport(subject: AccessSubject, id: string, now: Date = new Date()): Promise<TimesheetReport> {
  const { period: found, viewer } = await periodForViewer(subject, id);
  await refreshPeriod(found, now);
  const period = (await periodsRepository.find(found.siteId, found.id)) ?? found;
  const [days, items, rangeDays, rangeItems, site] = await Promise.all([
    timesheetDaysRepository.allInPeriod(period.id, period.siteId),
    overtimeRepository.allInPeriod(period.id, period.siteId),
    timesheetDaysRepository.inRange(period.siteId, period.start, period.end),
    overtimeRepository.inRange(period.siteId, period.start, period.end),
    periodsRepository.siteName(period.siteId),
  ]);
  const scoped = filterRows(personRows(days, items), 'ALL', undefined, undefined, viewer.departmentIds);
  const visible = new Set(scoped.map((row) => row.employeeId));
  const carriedDays = rangeDays.filter((d) => d.periodId !== period.id && visible.has(d.employeeId));
  const carriedItems = rangeItems.filter((i) => i.periodId !== period.id && visible.has(i.employeeId));
  const named = await periodsRepository.people(
    [...new Set([...items.map((i) => i.decidedById), ...days.map(({ day }) => day.decidedById), period.closedById, period.signedById].filter((v): v is string => v !== null))],
  );
  const nameOf = (userId: string | null): string | null => (userId ? (named.get(userId)?.name ?? null) : null);

  const rows: ReportRow[] = scoped.map((row) => {
    const mine = days.filter(({ person }) => person.id === row.employeeId).map(({ day }) => day);
    const notes: ReportRow['notes'] = [];
    if (mine.some((d) => d.status === 'AUTO_APPROVED')) notes.push({ code: 'APPROVED_BY_SYSTEM', by: null });
    for (const d of mine.filter((x) => x.status === 'APPROVED' && x.decidedById)) notes.push({ code: 'DAY_DECIDED', by: nameOf(d.decidedById), date: d.shiftDate });
    for (const item of items.filter((i) => i.employeeId === row.employeeId && i.decidedById)) notes.push(overtimeNote(item, nameOf(item.decidedById)));
    if (carriedDays.some((d) => d.employeeId === row.employeeId) || carriedItems.some((i) => i.employeeId === row.employeeId)) notes.push({ code: 'OPEN_MOVES_ON', by: null });
    return { employeeId: row.employeeId, name: row.name, departmentName: row.departmentName, plannedMinutes: row.plannedMinutes, workedMinutes: row.workedMinutes, lateMinutes: row.lateMinutes, absentDays: row.absentDays, overtimeAuthorisedMinutes: row.overtimeAuthorisedMinutes, notes };
  });

  const signer = period.signedById ? named.get(period.signedById) : null;
  return {
    number: code(period.reportNumber),
    site,
    period,
    summary: summarise(scoped, days.filter(({ person }) => visible.has(person.id)), items.filter((i) => visible.has(i.employeeId))),
    rows,
    closed: period.closedAt ? { at: period.closedAt.toISOString(), automatically: period.closeKind === 'AUTO', by: nameOf(period.closedById) } : null,
    signatures: { signedBy: signer && period.signedAt ? { name: signer.name, role: signer.role, at: period.signedAt.toISOString() } : null, receivedByPayroll: null },
    carriedOnDays: carriedDays.length,
    carriedOnOvertime: carriedItems.length,
  };
}

const overtimeNote = (item: OvertimeRow, by: string | null): ReportRow['notes'][number] => ({ code: 'OVERTIME_DECIDED', by, minutes: item.authorisedMinutes, date: item.shiftDate });
