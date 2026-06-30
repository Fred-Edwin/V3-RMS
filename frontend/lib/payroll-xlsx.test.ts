import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';

import type { PayrollExportRow } from './payroll-csv';
import { buildPayrollRegisterWorkbook } from './payroll-xlsx';

const makeRow = (overrides: Partial<PayrollExportRow>): PayrollExportRow => ({
  branchName: 'Nyeri Town',
  name: 'Jane Doe',
  role: 'Waiter',
  kraPIN: 'A001234567X',
  bankName: 'Equity',
  accountNumber: '1234567890',
  grossPay: 50000,
  paye: 5000,
  sha: 1375,
  nssfTier1: 480,
  nssfTier2: 0,
  housingLevy: 750,
  ncnsAmount: 0,
  ncnsNote: '',
  advance: 0,
  incentives: 0,
  overtime: 0,
  allowances: 0,
  totalDeductions: 7605,
  netSalary: 42395,
  ...overrides,
});

/** Re-open the generated workbook so we can assert on real cell values. */
const readBack = async (blob: Blob): Promise<ExcelJS.Worksheet> => {
  const buffer = await blob.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  return wb.worksheets[0];
};

/** Collect every cell's text down column A, to find label rows. */
const colA = (ws: ExcelJS.Worksheet): string[] => {
  const out: string[] = [];
  ws.eachRow((row) => out.push(String(row.getCell(1).value ?? '')));
  return out;
};

describe('buildPayrollRegisterWorkbook', () => {
  it('produces a single sheet with the title block and KES currency note', async () => {
    const blob = await buildPayrollRegisterWorkbook(
      [makeRow({})],
      'June 2026',
      '30 June 2026 at 08:56',
      'All Branches',
    );
    const ws = await readBack(blob);
    expect(ws.name).toBe('Payroll Register');
    const a = colA(ws);
    expect(a[0]).toContain('Wendo Coffee Bistro');
    expect(a[1]).toContain('June 2026');
    expect(a[1]).toContain('Currency: KES');
    expect(a[1]).toContain('All Branches');
    expect(a[2]).toContain('Generated:');
  });

  it('keeps money cells as real numbers (not pre-formatted strings)', async () => {
    const blob = await buildPayrollRegisterWorkbook([makeRow({ grossPay: 50000 })], 'June 2026', 'x', 'Nyeri Town');
    const ws = await readBack(blob);
    // Find the data row by the employee name in column A.
    let netCellValue: unknown;
    ws.eachRow((row) => {
      if (row.getCell(1).value === 'Jane Doe') {
        netCellValue = row.getCell(16).value; // Net Salary column
      }
    });
    expect(netCellValue).toBe(42395);
  });

  it('groups by branch (A–Z), with a subtotal per branch and a grand total', async () => {
    const rows = [
      makeRow({ branchName: 'Town', name: 'Zoe', netSalary: 10000 }),
      makeRow({ branchName: 'Annex', name: 'Amos', netSalary: 20000 }),
      makeRow({ branchName: 'Annex', name: 'Beth', netSalary: 30000 }),
    ];
    const ws = await readBack(await buildPayrollRegisterWorkbook(rows, 'June 2026', 'x', 'All Branches'));
    const a = colA(ws);

    const annexIdx = a.findIndex((v) => v === 'Annex');
    const townIdx = a.findIndex((v) => v === 'Town');
    expect(annexIdx).toBeGreaterThan(-1);
    expect(townIdx).toBeGreaterThan(annexIdx); // Annex before Town (A–Z)

    expect(a.some((v) => v.startsWith('Subtotal — Annex (2 staff)'))).toBe(true);
    expect(a.some((v) => v.startsWith('Subtotal — Town (1 staff)'))).toBe(true);
    expect(a.some((v) => v.startsWith('GRAND TOTAL (3 staff)'))).toBe(true);
  });

  it('sums the net salary correctly in the grand total row', async () => {
    const rows = [
      makeRow({ name: 'A', netSalary: 1000 }),
      makeRow({ name: 'B', netSalary: 2500 }),
    ];
    const ws = await readBack(await buildPayrollRegisterWorkbook(rows, 'June 2026', 'x', 'Nyeri Town'));
    let grandNet: unknown;
    ws.eachRow((row) => {
      if (String(row.getCell(1).value ?? '').startsWith('GRAND TOTAL')) {
        grandNet = row.getCell(16).value;
      }
    });
    expect(grandNet).toBe(3500);
  });
});
