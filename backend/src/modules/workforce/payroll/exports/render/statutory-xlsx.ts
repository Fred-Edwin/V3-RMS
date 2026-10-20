import ExcelJS from 'exceljs';
import type { PayrollModel, TableColumn } from '../export-model';
import { bannerOf, headerRow, num, totalRow } from './workbook-xlsx';

const MONEY = '#,##0.00';
const safeSheetName = (name: string, taken: Set<string>): string => {
  const base = name.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 28) || 'Table';
  let candidate = base;
  for (let n = 2; taken.has(candidate.toLowerCase()); n += 1) candidate = `${base.slice(0, 25)} ${n}`;
  taken.add(candidate.toLowerCase());
  return candidate;
};

function tableSheet(wb: ExcelJS.Workbook, model: PayrollModel, table: TableColumn, name: string): number {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', xSplit: 1, ySplit: 2 }] });
  ws.mergeCells('A1:I1');
  ws.getCell('A1').value = `${table.name} · ${bannerOf(model)}`;
  ws.getCell('A1').font = { bold: true };
  ws.columns = [{ width: 28 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }];
  const head = ws.getRow(2);
  head.values = ['Person', 'Employee number', 'KRA PIN', 'NSSF number', 'SHA number', 'Base', 'Rate', 'Employee', 'Employer'];
  headerRow(head);
  let r = 3;
  for (const p of [...model.payslips].sort((a, b) => a.employeeName.localeCompare(b.employeeName, 'en'))) {
    const own = p.lines.filter((l) => l.tableCode === table.key);
    const employee = own.find((l) => l.share === 'EMPLOYEE');
    const employer = own.find((l) => l.share === 'EMPLOYER');
    if (!employee && !employer) continue;
    const row = ws.getRow(r);
    row.values = [p.employeeName, p.employeeNumber, p.ids?.kraPin ?? '', p.ids?.nssfNumber ?? '', p.ids?.shaNumber ?? '', employee?.baseAmount ? num(employee.baseAmount) : null, employee?.rate ?? '', employee ? num(employee.amount) : 0, employer ? num(employer.amount) : 0];
    for (const c of [6, 8, 9]) row.getCell(c).numFmt = MONEY;
    r += 1;
  }
  totalRow(ws, 3, r - 1, 'Total', [8, 9]);
  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: Math.max(2, r - 1), column: 9 } };
  return r - 3;
}

/** `Statutory-2026-09.xlsx` (S9): an index sheet, then one sheet per table with a row per person, for filing. */
export async function renderStatutory(model: PayrollModel): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Wendo RMS';
  wb.created = model.exportedAt;
  wb.title = `Statutory schedules ${model.monthLabel}`;
  const index = wb.addWorksheet('Index');
  index.mergeCells('A1:C1');
  index.getCell('A1').value = bannerOf(model);
  index.getCell('A1').font = { bold: true };
  index.columns = [{ width: 30 }, { width: 14 }, { width: 14 }];
  const head = index.getRow(2);
  head.values = ['Table', 'Sheet', 'People'];
  headerRow(head);
  const taken = new Set<string>(['index']);
  model.tables.forEach((table, i) => {
    const name = safeSheetName(table.name, taken);
    const people = tableSheet(wb, model, table, name);
    index.getRow(3 + i).values = [table.name, name, people];
  });
  if (model.tables.length === 0) index.getCell('A3').value = 'No statutory tables were set up for this month.';
  return Buffer.from(await wb.xlsx.writeBuffer());
}
