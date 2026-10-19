import { dayMonth, monthOf, plainName } from '../../_shared/lib/timesheet-words';
import type { Report, ReportNote, ReportRow } from '../../_shared/types/timesheet-types';

/** The words and the file of the timesheet report (Paper Chapter 8, step 5). Hours only: nothing in it is money. Pure. */

/** "Overtime approved by Faith Njeri", "Approved by the system", "Clock-out fix open, moves to next period". */
export function noteWords(note: ReportNote): string {
  const by = note.by ? plainName(note.by) : 'a manager';
  switch (note.code) {
    case 'APPROVED_BY_SYSTEM':
      return 'Approved by the system';
    case 'OVERTIME_DECIDED':
      return note.minutes && note.minutes > 0 ? `Overtime ${colonHours(note.minutes)} approved by ${by}` : `Overtime declined by ${by}`;
    case 'DAY_DECIDED':
      return `${note.date ? `${dayMonth(note.date)} ` : 'Day '}approved by ${by}`;
    default:
      return 'Something open moves to next month';
  }
}

/** All of a person's notes on one line. */
export const decidedBy = (row: ReportRow): string => {
  const unique = Array.from(new Set(row.notes.map(noteWords)));
  return unique.length === 0 ? '' : unique.join('; ');
};

/** "5:40" style for the printed table: hours and minutes with a colon, as Paper prints them. */
export const colonHours = (minutes: number): string => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;

export const statusLine = (report: Report): string => {
  const { period, closed } = report;
  if (period.state === 'OPEN') return 'OPEN · NOT CLOSED YET';
  if (period.state === 'CLOSING') return 'CLOSING NOW';
  return closed ? 'CLOSED · READY FOR PAYROLL' : 'CLOSED';
};

const cell = (value: string | number): string => `"${String(value).replace(/"/g, '""')}"`;

/** The report as a CSV an Accountant or HR opens in a spreadsheet: one row per person, hours as h:mm. */
export function reportCsv(report: Report): string {
  const head = ['Person', 'Department', 'Planned (h:mm)', 'Worked (h:mm)', 'Late (min)', 'Absent days', 'Overtime authorised (h:mm)', 'Decided by'];
  const lines = report.rows.map((r) => [r.name, r.departmentName ?? '', colonHours(r.plannedMinutes), colonHours(r.workedMinutes), r.lateMinutes, r.absentDays, colonHours(r.overtimeAuthorisedMinutes), decidedBy(r)].map(cell).join(','));
  return [`${cell(`${report.number} · ${report.organization} · ${monthOf(report.period)}`)}`, head.map(cell).join(','), ...lines].join('\r\n');
}

export const csvName = (report: Report): string => `${report.number}-${report.period.start.slice(0, 7)}.csv`;
