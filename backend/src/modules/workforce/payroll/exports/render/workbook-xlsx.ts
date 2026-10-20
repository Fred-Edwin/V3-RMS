import ExcelJS from 'exceljs';
import { longDay } from '../../../timesheets/exports/export-format';
import { groupByDepartment, type PayrollModel } from '../export-model';
import { tableTotals } from './summary-pdf';

const NAVY = 'FF14284B';
const HEADER_FILL = 'FFDCE4F2';
const MONEY = '#,##0.00';

/** Cell A1: the banner that says what the file is (E8). */
export const bannerOf = (model: PayrollModel): string =>
  model.draft ? 'Working copy, draft, not approved' : `Working copy of ${model.documentNumber}, approved ${model.approved?.at ? longDay(model.approved.at.toISOString().slice(0, 10)) : model.end}${model.corrections > 0 ? ` · Revision ${model.revision}, includes ${model.corrections} correction${model.corrections === 1 ? '' : 's'} after approval` : ''}`;

export function headerRow(row: ExcelJS.Row): void {
  row.font = { bold: true, color: { argb: NAVY } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
  row.border = { bottom: { style: 'thin', color: { argb: NAVY } } };
}

/** A real number: Excel keeps the cents and the user can add it up. Text money never reaches a cell. */
export const num = (value: string): number => Number(value);

/** A total row of live SUM formulas under the data, bold with a thick top rule. */
export function totalRow(ws: ExcelJS.Worksheet, first: number, last: number, label: string, sumColumns: readonly number[]): void {
  const row = ws.getRow(last + 1);
  row.getCell(1).value = label;
  for (const c of sumColumns) {
    const letter = ws.getColumn(c).letter;
    row.getCell(c).value = { formula: `SUM(${letter}${first}:${letter}${last})`, result: 0 };
    row.getCell(c).numFmt = MONEY;
  }
  row.font = { bold: true };
  row.border = { top: { style: 'thick', color: { argb: NAVY } } };
}

function registerSheet(wb: ExcelJS.Workbook, model: PayrollModel): void {
  const ws = wb.addWorksheet('Register', { views: [{ state: 'frozen', xSplit: 1, ySplit: 2 }] });
  const heads = ['Person', 'Department', 'Site', 'Basic', 'Overtime', 'Gross', ...model.tables.map((t) => t.name), 'Other deductions', 'Net pay'];
  ws.mergeCells(1, 1, 1, heads.length);
  ws.getCell('A1').value = bannerOf(model);
  ws.getCell('A1').font = { bold: true, color: { argb: NAVY } };
  ws.columns = heads.map((_, i) => ({ width: i === 0 ? 28 : i < 3 ? 18 : 14 }));
  const head = ws.getRow(2);
  head.values = heads;
  headerRow(head);
  let r = 3;
  for (const group of groupByDepartment(model.people)) {
    for (const p of group.people) {
      const row = ws.getRow(r);
      row.values = [p.name, p.department ?? '', p.siteName, num(p.basic), num(p.overtime), num(p.gross), ...model.tables.map((t) => num(p.tables[t.key] ?? '0')), num(p.other), num(p.net)];
      for (let c = 4; c <= heads.length; c += 1) row.getCell(c).numFmt = MONEY;
      r += 1;
    }
  }
  totalRow(ws, 3, r - 1, 'Total', Array.from({ length: heads.length - 3 }, (_, i) => i + 4));
  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: Math.max(2, r - 1), column: heads.length } };
}

function summarySheet(wb: ExcelJS.Workbook, model: PayrollModel): void {
  const ws = wb.addWorksheet('Summary', { views: [{ state: 'frozen', ySplit: 2 }] });
  ws.mergeCells('A1:F1');
  ws.getCell('A1').value = bannerOf(model);
  ws.getCell('A1').font = { bold: true, color: { argb: NAVY } };
  ws.columns = [{ width: 28 }, { width: 10 }, { width: 16 }, { width: 18 }, { width: 18 }, { width: 16 }];
  const head = ws.getRow(2);
  head.values = ['Site', 'People', 'Gross', 'Tax and statutory', 'Other deductions', 'Net pay'];
  headerRow(head);
  model.bySite.forEach((s, i) => {
    const row = ws.getRow(3 + i);
    row.values = [s.name, s.people, num(s.gross), num(s.taxStatutory), num(s.other), num(s.net)];
    for (let c = 3; c <= 6; c += 1) row.getCell(c).numFmt = MONEY;
  });
  const last = 2 + model.bySite.length;
  totalRow(ws, 3, last, 'Total', [2, 3, 4, 5, 6]);
  const gap = last + 3;
  ws.getRow(gap).values = ['Tax and statutory, by type', '', 'Employee', 'Employer'];
  headerRow(ws.getRow(gap));
  tableTotals(model).forEach((t, i) => {
    const row = ws.getRow(gap + 1 + i);
    row.values = [t.name, '', num(t.employee), t.employer ? num(t.employer) : null];
    row.getCell(3).numFmt = MONEY;
    row.getCell(4).numFmt = MONEY;
  });
}

function casualSheet(wb: ExcelJS.Workbook, model: PayrollModel): void {
  const ws = wb.addWorksheet('Casual pay');
  ws.getCell('A1').value = bannerOf(model);
  ws.getCell('A1').font = { bold: true, color: { argb: NAVY } };
  ws.getCell('A3').value = 'No casual pay sheets in the new system yet. Casual pay is a memo and is never part of a payslip, this register or the bank file.';
}

function bankSheet(wb: ExcelJS.Workbook, model: PayrollModel): void {
  if (!model.bank) return;
  const ws = wb.addWorksheet('Bank file', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = model.bank.header.map((_, i) => ({ width: i === 1 || i === 2 ? 24 : 16 }));
  const head = ws.getRow(1);
  head.values = [...model.bank.header];
  headerRow(head);
  model.bank.rows.forEach((cells, i) => {
    const row = ws.getRow(2 + i);
    row.values = cells.map((c, col) => (col === 5 ? num(c) : c));
    row.getCell(6).numFmt = MONEY;
  });
  totalRow(ws, 2, 1 + model.bank.rows.length, 'Total', [6]);
}

/**
 * `Payroll-2026-09.xlsx` (E8): Summary, Register, Statutory-free working copy, Casual pay and, for the Accountant only, the Bank file.
 * The statutory detail has its own workbook. Real numbers with live SUMs, filters and frozen headers; no macros, no links.
 */
export async function renderWorkbook(model: PayrollModel): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Wendo RMS';
  wb.created = model.exportedAt;
  wb.title = `Payroll ${model.monthLabel}`;
  summarySheet(wb, model);
  registerSheet(wb, model);
  statutorySheet(wb, model);
  casualSheet(wb, model);
  bankSheet(wb, model);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

function statutorySheet(wb: ExcelJS.Workbook, model: PayrollModel): void {
  const ws = wb.addWorksheet('Statutory', { views: [{ state: 'frozen', xSplit: 1, ySplit: 2 }] });
  ws.mergeCells('A1:J1');
  ws.getCell('A1').value = bannerOf(model);
  ws.getCell('A1').font = { bold: true, color: { argb: NAVY } };
  ws.columns = [{ width: 28 }, { width: 18 }, { width: 16 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }];
  const head = ws.getRow(2);
  head.values = ['Person', 'Table', 'Base', 'Rate', 'Employee', 'Employer', 'KRA PIN', 'NSSF number', 'SHA number'];
  headerRow(head);
  let r = 3;
  for (const p of [...model.payslips].sort((a, b) => a.employeeName.localeCompare(b.employeeName, 'en'))) {
    for (const t of model.tables) {
      const own = p.lines.filter((l) => l.tableCode === t.key);
      const employee = own.find((l) => l.share === 'EMPLOYEE');
      const employer = own.find((l) => l.share === 'EMPLOYER');
      if (!employee && !employer) continue;
      const row = ws.getRow(r);
      row.values = [p.employeeName, t.name, employee?.baseAmount ? num(employee.baseAmount) : null, employee?.rate ?? '', employee ? num(employee.amount) : 0, employer ? num(employer.amount) : 0, p.ids?.kraPin ?? '', p.ids?.nssfNumber ?? '', p.ids?.shaNumber ?? ''];
      for (const c of [3, 5, 6]) row.getCell(c).numFmt = MONEY;
      r += 1;
    }
  }
  totalRow(ws, 3, r - 1, 'Total', [5, 6]);
  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: Math.max(2, r - 1), column: 9 } };
}
