import ExcelJS from 'exceljs';
import { decidedText } from '../approval/decided-by';
import { longDay } from './export-format';
import { groupByDepartment, type DailyRow, type ExportModel } from './export-model';

const NAVY = 'FF14284B';
const HEADER_FILL = 'FFEEF1F7';
const hours = (minutes: number): number => minutes / 60;
const HOURS = '0.00';

const headerStyle = (row: ExcelJS.Row): void => {
  row.font = { bold: true, color: { argb: NAVY } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
  row.border = { bottom: { style: 'thin', color: { argb: NAVY } } };
};

const banner = (model: ExportModel): string =>
  model.draft ? 'Working copy, draft, not approved' : `Working copy of ${model.documentNumber}, approved ${longDay(model.approvedAt?.toISOString().slice(0, 10) ?? model.end)}`;

/** A clock string "HH:MM" as an Excel time of day (a fraction of 24 hours), so the cell is a real time. */
const timeOfDay = (clock: string | null): number | null => {
  if (!clock) return null;
  const [h, m] = clock.split(':').map(Number) as [number, number];
  return (h * 60 + m) / 1440;
};

function timesheetSheet(wb: ExcelJS.Workbook, model: ExportModel): void {
  const ws = wb.addWorksheet('Timesheet', { views: [{ state: 'frozen', xSplit: 1, ySplit: 2 }] });
  ws.mergeCells('A1:I1');
  ws.getCell('A1').value = banner(model) + (model.scopeNote ? ` · ${model.scopeNote}` : '');
  ws.getCell('A1').font = { bold: true, color: { argb: NAVY } };
  ws.columns = [
    { key: 'person', width: 28 },
    { key: 'department', width: 18 },
    { key: 'planned', width: 13 },
    { key: 'worked', width: 13 },
    { key: 'overtime', width: 14 },
    { key: 'late', width: 12 },
    { key: 'absent', width: 11 },
    { key: 'leave', width: 10 },
    { key: 'decided', width: 70 },
  ];
  const head = ws.getRow(2);
  head.values = ['Person', 'Department', 'Planned (h)', 'Worked (h)', 'Overtime (h)', 'Late (min)', 'Absent (d)', 'Leave (d)', 'Decided by'];
  headerStyle(head);
  for (const col of [3, 4, 5, 6, 7, 8]) head.getCell(col).alignment = { horizontal: 'right' };
  let r = 3;
  for (const group of groupByDepartment(model.people)) {
    for (const p of group.people) {
      const row = ws.getRow(r);
      row.values = [p.name, p.department ?? '', hours(p.plannedMinutes), hours(p.workedMinutes), hours(p.overtimeAuthorisedMinutes), p.lateMinutes, p.absentDays, p.leaveDays, decidedText(p.decided)];
      for (const col of [3, 4, 5]) row.getCell(col).numFmt = HOURS;
      row.getCell(9).alignment = { wrapText: true, vertical: 'top' };
      r += 1;
    }
  }
  const last = r - 1;
  const total = ws.getRow(r);
  const sums = [
    hours(model.totals.plannedMinutes),
    hours(model.totals.workedMinutes),
    hours(model.totals.overtimeApprovedMinutes),
    model.totals.lateMinutes,
    model.totals.absentDays,
    0,
  ];
  total.getCell(1).value = 'Total';
  ['C', 'D', 'E', 'F', 'G', 'H'].forEach((letter, i) => {
    total.getCell(letter).value = { formula: `SUM(${letter}3:${letter}${Math.max(last, 3)})`, result: sums[i] ?? 0 };
    if (i < 3) total.getCell(letter).numFmt = HOURS;
  });
  total.font = { bold: true };
  total.border = { top: { style: 'medium', color: { argb: NAVY } } };
  ws.autoFilter = `A2:I${Math.max(last, 2)}`;
}

function dailySheet(wb: ExcelJS.Workbook, rows: readonly DailyRow[]): void {
  const ws = wb.addWorksheet('Daily hours', { views: [{ state: 'frozen', xSplit: 1, ySplit: 1 }] });
  ws.columns = [
    { header: 'Person', key: 'person', width: 28 },
    { header: 'Department', key: 'department', width: 18 },
    { header: 'Date', key: 'date', width: 12, style: { numFmt: 'yyyy-mm-dd' } },
    { header: 'Planned in', key: 'plannedIn', width: 11, style: { numFmt: 'hh:mm' } },
    { header: 'Planned out', key: 'plannedOut', width: 11, style: { numFmt: 'hh:mm' } },
    { header: 'Clock in', key: 'clockIn', width: 10, style: { numFmt: 'hh:mm' } },
    { header: 'Clock out', key: 'clockOut', width: 10, style: { numFmt: 'hh:mm' } },
    { header: 'Worked (h)', key: 'worked', width: 12, style: { numFmt: HOURS } },
    { header: 'Overtime (h)', key: 'overtime', width: 13, style: { numFmt: HOURS } },
    { header: 'Late (min)', key: 'late', width: 11 },
    { header: 'Result', key: 'result', width: 30 },
    { header: 'Decision', key: 'decision', width: 60 },
  ];
  headerStyle(ws.getRow(1));
  for (const d of rows) {
    ws.addRow({
      person: d.person,
      department: d.department ?? '',
      date: new Date(`${d.date}T00:00:00Z`),
      plannedIn: timeOfDay(d.plannedIn),
      plannedOut: timeOfDay(d.plannedOut),
      clockIn: timeOfDay(d.clockIn),
      clockOut: timeOfDay(d.clockOut),
      worked: hours(d.workedMinutes),
      overtime: hours(d.overtimeMinutes),
      late: d.lateMinutes,
      result: d.result,
      decision: d.decision,
    });
  }
  ws.autoFilter = { from: 'A1', to: { row: 1, column: 12 } };
}

function summarySheet(wb: ExcelJS.Workbook, model: ExportModel): void {
  const ws = wb.addWorksheet('Summary', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: 'Department', key: 'department', width: 24 },
    { header: 'People', key: 'people', width: 10 },
    { header: 'Planned (h)', key: 'planned', width: 13, style: { numFmt: HOURS } },
    { header: 'Worked (h)', key: 'worked', width: 13, style: { numFmt: HOURS } },
    { header: 'Overtime (h)', key: 'overtime', width: 14, style: { numFmt: HOURS } },
    { header: 'Late (min)', key: 'late', width: 11 },
    { header: 'Absent (d)', key: 'absent', width: 11 },
    { header: 'Leave (d)', key: 'leave', width: 10 },
  ];
  headerStyle(ws.getRow(1));
  for (const group of groupByDepartment(model.people)) {
    const sum = (pick: (p: (typeof group.people)[number]) => number): number => group.people.reduce((total, p) => total + pick(p), 0);
    ws.addRow({ department: group.department, people: group.people.length, planned: hours(sum((p) => p.plannedMinutes)), worked: hours(sum((p) => p.workedMinutes)), overtime: hours(sum((p) => p.overtimeAuthorisedMinutes)), late: sum((p) => p.lateMinutes), absent: sum((p) => p.absentDays), leave: sum((p) => p.leaveDays) });
  }
  const gap = ws.rowCount + 2;
  ws.getRow(gap).values = ['Rules used', 'Version', 'From'];
  headerStyle(ws.getRow(gap));
  model.rules.forEach((rule, i) => {
    ws.getRow(gap + 1 + i).values = [rule.key === 'LATENESS' ? 'Lateness' : 'Overtime', rule.siteVersion ? `${rule.version} (site ${rule.siteVersion})` : String(rule.version), rule.effectiveFrom ?? 'default'];
  });
}

/** The working copy: three sheets, real numbers, live SUM formulas, filters and frozen headers. Never signed; no macros, no links. */
export async function renderXlsx(model: ExportModel): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Wendo RMS';
  wb.created = model.exportedAt;
  wb.title = `Timesheet ${model.siteName} ${model.monthLabel}`;
  timesheetSheet(wb, model);
  dailySheet(wb, model.daily);
  summarySheet(wb, model);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
