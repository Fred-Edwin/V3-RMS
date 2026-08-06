/**
 * Payroll CSV builders.
 *
 * Two distinct outputs from the same source rows:
 *
 *  1. Bank file  — STRICT, machine-uploadable. One header row then clean data
 *     rows only: no title, blank, or subtotal lines (the bank's import system
 *     parses line-by-line and rejects decorative rows). Amounts are raw decimals
 *     with no thousands separators (a comma would collide with the CSV delimiter).
 *     Rows are sorted/grouped by branch via a Branch column so the file is still
 *     "arranged by branch" without breaking the parser. Staff with no usable bank
 *     account or a zero net are excluded and reported back to the caller.
 *
 *  2. Full register — human-readable internal record. Branch section labels,
 *     every payroll column, a subtotal per branch, and a grand total row.
 *
 * Pure functions only (string in/out) so they are trivially unit-testable; the
 * single browser-touching helper (downloadCsv) is isolated at the bottom.
 */

export interface PayrollExportRow {
  branchName: string;
  name: string;
  role: string;
  kraPIN: string | null;
  shifNhifNumber: string | null;
  nssfNumber: string | null;
  bankName: string | null;
  accountNumber: string | null;
  grossPay: number;
  paye: number;
  sha: number;
  nssfTier1: number;
  nssfTier2: number;
  housingLevy: number;
  ncnsAmount: number;
  ncnsNote: string;
  advance: number;
  incentives: number;
  overtime: number;
  allowances: number;
  totalDeductions: number;
  netSalary: number;
}

/** Escape a single CSV field per RFC 4180: quote when it contains comma, quote,
 *  or newline; double any embedded quotes. */
export const csvField = (value: string | number | null | undefined): string => {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const csvRow = (fields: Array<string | number | null | undefined>): string =>
  fields.map(csvField).join(',');

/** Raw decimal string for machine import — always 2 dp, no thousands separators. */
const money = (value: number): string => (Number.isFinite(value) ? value : 0).toFixed(2);

/** Stable, branch-grouped ordering: by branch name, then by the order rows
 *  already arrive in (caller pre-sorts by role then name). */
const sortByBranch = (rows: PayrollExportRow[]): PayrollExportRow[] =>
  rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const branchCmp = a.row.branchName.localeCompare(b.row.branchName);
      return branchCmp !== 0 ? branchCmp : a.index - b.index;
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

// ── Bank file (strict) ──────────────────────────────────────────────

const BANK_HEADER = ['Branch', 'Employee Name', 'KRA PIN', 'Bank', 'Account Number', 'Net Salary'];

export interface BankFileResult {
  /** CSV text ready to download. Empty string if no payable rows. */
  csv: string;
  /** Names of staff omitted because they lack a bank account or have zero/negative net. */
  excluded: string[];
  /** Count of rows actually written to the file. */
  includedCount: number;
}

export const buildBankFileCsv = (rows: PayrollExportRow[]): BankFileResult => {
  const excluded: string[] = [];
  const payable = sortByBranch(rows).filter((row) => {
    const hasAccount = Boolean(row.accountNumber && row.accountNumber.trim());
    const hasNet = row.netSalary > 0;
    if (!hasAccount || !hasNet) {
      excluded.push(row.name);
      return false;
    }
    return true;
  });

  if (payable.length === 0) {
    return { csv: '', excluded, includedCount: 0 };
  }

  const lines = [
    csvRow(BANK_HEADER),
    ...payable.map((row) =>
      csvRow([
        row.branchName,
        row.name,
        row.kraPIN ?? '',
        row.bankName ?? '',
        row.accountNumber ?? '',
        money(row.netSalary),
      ]),
    ),
  ];

  return { csv: lines.join('\r\n'), excluded, includedCount: payable.length };
};

// ── Full register (human-readable) ──────────────────────────────────

const REGISTER_HEADER = [
  'Branch',
  'Employee Name',
  'Role',
  'Gross Salary',
  'PAYE',
  'SHA (NHIF)',
  'NSSF Tier 1',
  'NSSF Tier 2',
  'Housing Levy',
  'N.C.N.S / Deductions',
  'Deduction Note',
  'Advance',
  'Incentives',
  'Overtime',
  'Allowances',
  'Total Deductions',
  'Net Salary',
  'KRA PIN',
  'SHIF / NHIF Number',
  'NSSF Number',
  'Bank',
  'Account Number',
];

interface RegisterTotals {
  grossPay: number;
  paye: number;
  sha: number;
  nssfTier1: number;
  nssfTier2: number;
  housingLevy: number;
  ncnsAmount: number;
  advance: number;
  incentives: number;
  overtime: number;
  allowances: number;
  totalDeductions: number;
  netSalary: number;
}

const emptyTotals = (): RegisterTotals => ({
  grossPay: 0, paye: 0, sha: 0, nssfTier1: 0, nssfTier2: 0, housingLevy: 0,
  ncnsAmount: 0, advance: 0, incentives: 0, overtime: 0, allowances: 0,
  totalDeductions: 0, netSalary: 0,
});

const addToTotals = (totals: RegisterTotals, row: PayrollExportRow): void => {
  totals.grossPay += row.grossPay;
  totals.paye += row.paye;
  totals.sha += row.sha;
  totals.nssfTier1 += row.nssfTier1;
  totals.nssfTier2 += row.nssfTier2;
  totals.housingLevy += row.housingLevy;
  totals.ncnsAmount += row.ncnsAmount;
  totals.advance += row.advance;
  totals.incentives += row.incentives;
  totals.overtime += row.overtime;
  totals.allowances += row.allowances;
  totals.totalDeductions += row.totalDeductions;
  totals.netSalary += row.netSalary;
};

const totalsRow = (label: string, totals: RegisterTotals): string =>
  csvRow([
    '',
    label,
    '',
    money(totals.grossPay),
    money(totals.paye),
    money(totals.sha),
    money(totals.nssfTier1),
    money(totals.nssfTier2),
    money(totals.housingLevy),
    money(totals.ncnsAmount),
    '',
    money(totals.advance),
    money(totals.incentives),
    money(totals.overtime),
    money(totals.allowances),
    money(totals.totalDeductions),
    money(totals.netSalary),
    '', '', '', '', '',
  ]);

export const buildPayrollRegisterCsv = (
  rows: PayrollExportRow[],
  payPeriodLabel: string,
  generatedLabel: string,
): string => {
  const lines: string[] = [
    csvRow([`Wendo Coffee Bistro — Payroll Register`]),
    csvRow([`Pay Period: ${payPeriodLabel}`]),
    csvRow([`Generated: ${generatedLabel}`]),
    '',
    csvRow(REGISTER_HEADER),
  ];

  const grandTotals = emptyTotals();
  const groups = groupByBranch(rows);

  for (const [branchName, branchRows] of groups) {
    const branchTotals = emptyTotals();
    // Branch section label (own line, first column).
    lines.push(csvRow([branchName]));
    for (const row of branchRows) {
      lines.push(
        csvRow([
          '',
          row.name,
          row.role,
          money(row.grossPay),
          money(row.paye),
          money(row.sha),
          money(row.nssfTier1),
          money(row.nssfTier2),
          money(row.housingLevy),
          money(row.ncnsAmount),
          row.ncnsNote,
          money(row.advance),
          money(row.incentives),
          money(row.overtime),
          money(row.allowances),
          money(row.totalDeductions),
          money(row.netSalary),
          row.kraPIN ?? '',
          row.shifNhifNumber ?? '',
          row.nssfNumber ?? '',
          row.bankName ?? '',
          row.accountNumber ?? '',
        ]),
      );
      addToTotals(branchTotals, row);
      addToTotals(grandTotals, row);
    }
    lines.push(totalsRow(`Subtotal — ${branchName} (${branchRows.length} staff)`, branchTotals));
    lines.push('');
  }

  const totalStaff = rows.length;
  lines.push(totalsRow(`GRAND TOTAL (${totalStaff} staff)`, grandTotals));

  return lines.join('\r\n');
};

// ── Browser download (isolated side-effect) ─────────────────────────

/** Trigger a client-side download of CSV text. Prepends a UTF-8 BOM so Excel
 *  renders the “Ksh” / em-dash characters correctly. */
export const downloadCsv = (filename: string, csv: string): void => {
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/** Build a filesystem-safe filename slug from a label, e.g. "June 2026" → "June-2026". */
export const csvFilenameSlug = (label: string): string =>
  label.trim().replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '');
