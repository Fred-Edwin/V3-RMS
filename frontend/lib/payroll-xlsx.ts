/**
 * Payroll register — formatted Excel (.xlsx) builder.
 *
 * The Full Register is a human-readable internal record, so unlike the bank
 * file it benefits from real spreadsheet formatting: bold/frozen header row,
 * KES number formatting with thousands separators, shaded branch section and
 * subtotal rows, a grand-total row, and sensible column widths. Producing a
 * true workbook (rather than a CSV) also removes Excel's "possible data loss"
 * banner and stops Excel from silently reinterpreting values.
 *
 * The bank file stays CSV (see payroll-csv.ts) — the bank's import parser
 * needs raw, decoration-free CSV and must not change.
 *
 * One async, browser-touching surface: buildPayrollRegisterWorkbook returns a
 * Blob. Everything else (column layout, totals) is pure and unit-testable.
 */

import ExcelJS from 'exceljs';

import type { PayrollExportRow } from './payroll-csv';

/** Excel number format for money: thousands separators, 2 dp, blank for zero
 *  so the sheet isn't a wall of "0.00". */
const MONEY_FMT = '#,##0.00;(#,##0.00);""';

const BRAND_GREEN = 'FF1F6E43';
const HEADER_BG = 'FF1F6E43';
const HEADER_FG = 'FFFFFFFF';
const BRANCH_BG = 'FFE7F0EA'; // light green section band
const SUBTOTAL_BG = 'FFF1EFEC'; // warm grey
const GRAND_BG = 'FFEAD9B0'; // warm gold

/** Column definitions in display order. `money: true` columns get the KES format
 *  and right alignment; the rest are left text. */
interface ColumnDef {
  header: string;
  key: keyof PayrollExportRow | 'ncnsNote';
  width: number;
  money?: boolean;
}

const COLUMNS: ColumnDef[] = [
  { header: 'Employee Name', key: 'name', width: 24 },
  { header: 'Role', key: 'role', width: 16 },
  { header: 'Gross Salary', key: 'grossPay', width: 14, money: true },
  { header: 'PAYE', key: 'paye', width: 12, money: true },
  { header: 'SHA (NHIF)', key: 'sha', width: 12, money: true },
  { header: 'NSSF Tier 1', key: 'nssfTier1', width: 12, money: true },
  { header: 'NSSF Tier 2', key: 'nssfTier2', width: 12, money: true },
  { header: 'Housing Levy', key: 'housingLevy', width: 13, money: true },
  { header: 'N.C.N.S / Deductions', key: 'ncnsAmount', width: 16, money: true },
  { header: 'Deduction Note', key: 'ncnsNote', width: 22 },
  { header: 'Advance', key: 'advance', width: 12, money: true },
  { header: 'Incentives', key: 'incentives', width: 12, money: true },
  { header: 'Overtime', key: 'overtime', width: 12, money: true },
  { header: 'Allowances', key: 'allowances', width: 13, money: true },
  { header: 'Total Deductions', key: 'totalDeductions', width: 15, money: true },
  { header: 'Net Salary', key: 'netSalary', width: 14, money: true },
  { header: 'KRA PIN', key: 'kraPIN', width: 16 },
  { header: 'SHIF / NHIF Number', key: 'shifNhifNumber', width: 18 },
  { header: 'NSSF Number', key: 'nssfNumber', width: 16 },
  { header: 'Bank', key: 'bankName', width: 18 },
  { header: 'Account Number', key: 'accountNumber', width: 18 },
];

const COL_COUNT = COLUMNS.length;
/** Money columns participate in subtotals/grand total, keyed by row field. */
const MONEY_KEYS = COLUMNS.filter((c) => c.money).map((c) => c.key) as Array<keyof PayrollExportRow>;

const sortByBranch = (rows: PayrollExportRow[]): PayrollExportRow[] =>
  rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const cmp = a.row.branchName.localeCompare(b.row.branchName);
      return cmp !== 0 ? cmp : a.index - b.index;
    })
    .map((entry) => entry.row);

const groupByBranch = (rows: PayrollExportRow[]): Array<[string, PayrollExportRow[]]> => {
  const groups = new Map<string, PayrollExportRow[]>();
  for (const row of sortByBranch(rows)) {
    const existing = groups.get(row.branchName);
    if (existing) existing.push(row);
    else groups.set(row.branchName, [row]);
  }
  return Array.from(groups.entries());
};

type MoneyTotals = Record<keyof PayrollExportRow, number>;

const sumMoney = (rows: PayrollExportRow[]): Partial<MoneyTotals> => {
  const totals: Partial<MoneyTotals> = {};
  for (const key of MONEY_KEYS) {
    totals[key] = rows.reduce((acc, row) => acc + (Number(row[key]) || 0), 0);
  }
  return totals;
};

/**
 * Build the formatted payroll register workbook as a downloadable Blob.
 * Pure aside from instantiating the workbook; no DOM access.
 */
export const buildPayrollRegisterWorkbook = async (
  rows: PayrollExportRow[],
  payPeriodLabel: string,
  generatedLabel: string,
  scopeLabel: string,
): Promise<Blob> => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Wendo RMS';
  wb.created = new Date();
  const ws = wb.addWorksheet('Payroll Register', {
    views: [{ state: 'frozen', ySplit: 5 }], // freeze title block + header row
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  ws.columns = COLUMNS.map((c) => ({ width: c.width }));

  const lastColLetter = ws.getColumn(COL_COUNT).letter;
  const mergeAcross = (rowNum: number) => ws.mergeCells(`A${rowNum}:${lastColLetter}${rowNum}`);

  // ── Title block (rows 1–4) ───────────────────────────────────────
  const titleRow = ws.addRow(['Wendo Coffee Bistro — Payroll Register']);
  mergeAcross(titleRow.number);
  titleRow.getCell(1).font = { bold: true, size: 15, color: { argb: BRAND_GREEN } };
  titleRow.height = 22;

  const periodRow = ws.addRow([`Pay Period: ${payPeriodLabel}  ·  ${scopeLabel}  ·  Currency: KES`]);
  mergeAcross(periodRow.number);
  periodRow.getCell(1).font = { size: 11, color: { argb: 'FF57534E' } };

  const genRow = ws.addRow([`Generated: ${generatedLabel}`]);
  mergeAcross(genRow.number);
  genRow.getCell(1).font = { size: 10, italic: true, color: { argb: 'FF8A8A8A' } };

  ws.addRow([]); // spacer (row 4)

  // ── Header row (row 5) ───────────────────────────────────────────
  const headerRow = ws.addRow(COLUMNS.map((c) => c.header));
  headerRow.height = 20;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: HEADER_FG }, size: 10.5 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF14502F' } } };
  });

  // ── Helpers for body styling ─────────────────────────────────────
  const applyMoneyFormat = (rowNum: number) => {
    COLUMNS.forEach((col, idx) => {
      if (!col.money) return;
      const cell = ws.getCell(rowNum, idx + 1);
      cell.numFmt = MONEY_FMT;
      cell.alignment = { horizontal: 'right' };
    });
  };

  const fillRow = (rowNum: number, argb: string) => {
    for (let c = 1; c <= COL_COUNT; c += 1) {
      ws.getCell(rowNum, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
    }
  };

  const boldRow = (rowNum: number) => {
    for (let c = 1; c <= COL_COUNT; c += 1) {
      const cell = ws.getCell(rowNum, c);
      cell.font = { bold: true, ...(cell.font ?? {}) };
    }
  };

  // ── Body: branch sections ────────────────────────────────────────
  const groups = groupByBranch(rows);

  for (const [branchName, branchRows] of groups) {
    // Branch section band.
    const bandRow = ws.addRow([branchName]);
    mergeAcross(bandRow.number);
    bandRow.getCell(1).font = { bold: true, size: 11.5, color: { argb: BRAND_GREEN } };
    fillRow(bandRow.number, BRANCH_BG);
    bandRow.height = 18;

    for (const row of branchRows) {
      const dataRow = ws.addRow([
        row.name,
        row.role,
        row.grossPay,
        row.paye,
        row.sha,
        row.nssfTier1,
        row.nssfTier2,
        row.housingLevy,
        row.ncnsAmount,
        row.ncnsNote,
        row.advance,
        row.incentives,
        row.overtime,
        row.allowances,
        row.totalDeductions,
        row.netSalary,
        row.kraPIN ?? '',
        row.shifNhifNumber ?? '',
        row.nssfNumber ?? '',
        row.bankName ?? '',
        row.accountNumber ?? '',
      ]);
      applyMoneyFormat(dataRow.number);
    }

    const subtotals = sumMoney(branchRows);
    const subRow = ws.addRow([`Subtotal — ${branchName} (${branchRows.length} staff)`]);
    // Write subtotal money values into their proper columns.
    COLUMNS.forEach((col, idx) => {
      if (col.money) {
        ws.getCell(subRow.number, idx + 1).value = subtotals[col.key as keyof PayrollExportRow] ?? 0;
      }
    });
    applyMoneyFormat(subRow.number);
    fillRow(subRow.number, SUBTOTAL_BG);
    boldRow(subRow.number);
    subRow.getCell(1).alignment = { horizontal: 'left' };

    ws.addRow([]); // spacer between branches
  }

  // ── Grand total ──────────────────────────────────────────────────
  const grand = sumMoney(rows);
  const grandRow = ws.addRow([`GRAND TOTAL (${rows.length} staff)`]);
  COLUMNS.forEach((col, idx) => {
    if (col.money) {
      ws.getCell(grandRow.number, idx + 1).value = grand[col.key as keyof PayrollExportRow] ?? 0;
    }
  });
  applyMoneyFormat(grandRow.number);
  fillRow(grandRow.number, GRAND_BG);
  boldRow(grandRow.number);
  grandRow.getCell(1).font = { bold: true, size: 11.5, color: { argb: 'FF5C4A12' } };
  grandRow.height = 20;

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
};

/** Trigger a client-side download of a Blob. */
export const downloadBlob = (filename: string, blob: Blob): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
