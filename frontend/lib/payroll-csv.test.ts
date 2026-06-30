import { describe, expect, it } from 'vitest';
import {
  buildBankFileCsv,
  buildPayrollRegisterCsv,
  csvField,
  csvFilenameSlug,
  type PayrollExportRow,
} from './payroll-csv';

/** Minimal row factory — supply only the fields a test cares about. */
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

/** Split CSV text into rows of fields, good enough for assertions on simple data. */
const parse = (csv: string): string[][] =>
  csv.split('\r\n').map((line) => line.split(','));

describe('csvField', () => {
  it('leaves plain values untouched', () => {
    expect(csvField('Equity')).toBe('Equity');
    expect(csvField(42)).toBe('42');
  });

  it('quotes and escapes fields containing commas, quotes, or newlines', () => {
    expect(csvField('Doe, Jane')).toBe('"Doe, Jane"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField('line1\nline2')).toBe('"line1\nline2"');
  });

  it('renders null/undefined as empty string', () => {
    expect(csvField(null)).toBe('');
    expect(csvField(undefined)).toBe('');
  });
});

describe('csvFilenameSlug', () => {
  it('replaces non-word runs with single dashes and trims', () => {
    expect(csvFilenameSlug('June 2026')).toBe('June-2026');
    expect(csvFilenameSlug('  All Branches  ')).toBe('All-Branches');
    expect(csvFilenameSlug('Nyeri / Town')).toBe('Nyeri-Town');
  });
});

describe('buildBankFileCsv', () => {
  it('produces a header plus one clean data row per payable employee', () => {
    const result = buildBankFileCsv([makeRow({ name: 'Jane Doe', netSalary: 42395 })]);
    const rows = parse(result.csv);

    expect(rows[0]).toEqual(['Branch', 'Employee Name', 'KRA PIN', 'Bank', 'Account Number', 'Net Salary']);
    expect(rows[1]).toEqual(['Nyeri Town', 'Jane Doe', 'A001234567X', 'Equity', '1234567890', '42395.00']);
    expect(result.includedCount).toBe(1);
    expect(result.excluded).toEqual([]);
  });

  it('formats net pay as a raw 2dp decimal with no thousands separators', () => {
    const result = buildBankFileCsv([makeRow({ netSalary: 1234567.5 })]);
    expect(result.csv).toContain('1234567.50');
    expect(result.csv).not.toContain('1,234,567');
  });

  it('excludes staff with no account number and reports them', () => {
    const result = buildBankFileCsv([
      makeRow({ name: 'Has Account', accountNumber: '1234567890', netSalary: 1000 }),
      makeRow({ name: 'No Account', accountNumber: null, netSalary: 1000 }),
      makeRow({ name: 'Blank Account', accountNumber: '   ', netSalary: 1000 }),
    ]);
    expect(result.includedCount).toBe(1);
    expect(result.excluded).toEqual(['No Account', 'Blank Account']);
    expect(result.csv).toContain('Has Account');
    expect(result.csv).not.toContain('No Account');
  });

  it('excludes staff with zero or negative net pay', () => {
    const result = buildBankFileCsv([
      makeRow({ name: 'Zero Net', netSalary: 0 }),
      makeRow({ name: 'Negative Net', netSalary: -500 }),
      makeRow({ name: 'Payable', netSalary: 100 }),
    ]);
    expect(result.excluded).toEqual(['Zero Net', 'Negative Net']);
    expect(result.includedCount).toBe(1);
  });

  it('returns an empty csv when no one is payable', () => {
    const result = buildBankFileCsv([makeRow({ accountNumber: null, netSalary: 0 })]);
    expect(result.csv).toBe('');
    expect(result.includedCount).toBe(0);
  });

  it('groups rows by branch (sorted) while keeping incoming order within a branch', () => {
    const result = buildBankFileCsv([
      makeRow({ branchName: 'Westlands', name: 'W First' }),
      makeRow({ branchName: 'Nyeri Town', name: 'N First' }),
      makeRow({ branchName: 'Westlands', name: 'W Second' }),
      makeRow({ branchName: 'Nyeri Town', name: 'N Second' }),
    ]);
    const names = parse(result.csv).slice(1).map((r) => r[1]);
    // Nyeri Town sorts before Westlands; original order preserved within each.
    expect(names).toEqual(['N First', 'N Second', 'W First', 'W Second']);
  });

  it('quotes a branch or name that contains a comma', () => {
    const result = buildBankFileCsv([makeRow({ name: 'Doe, Jane' })]);
    expect(result.csv).toContain('"Doe, Jane"');
  });
});

describe('buildPayrollRegisterCsv', () => {
  const rows = [
    makeRow({ branchName: 'Westlands', name: 'W One', grossPay: 100, netSalary: 80, totalDeductions: 20 }),
    makeRow({ branchName: 'Nyeri Town', name: 'N One', grossPay: 200, netSalary: 150, totalDeductions: 50 }),
    makeRow({ branchName: 'Nyeri Town', name: 'N Two', grossPay: 300, netSalary: 250, totalDeductions: 50 }),
  ];

  it('includes a title, pay period, and generated header block', () => {
    const csv = buildPayrollRegisterCsv(rows, 'June 2026', '30 June 2026 at 14:00');
    expect(csv).toContain('Wendo Coffee Bistro — Payroll Register');
    expect(csv).toContain('Pay Period: June 2026');
    expect(csv).toContain('Generated: 30 June 2026 at 14:00');
  });

  it('emits a branch label, a subtotal per branch, and a grand total', () => {
    const csv = buildPayrollRegisterCsv(rows, 'June 2026', 'now');

    // Branch sections appear, sorted alphabetically (Nyeri before Westlands).
    const nyeriIdx = csv.indexOf('Subtotal — Nyeri Town (2 staff)');
    const westIdx = csv.indexOf('Subtotal — Westlands (1 staff)');
    expect(nyeriIdx).toBeGreaterThan(-1);
    expect(westIdx).toBeGreaterThan(-1);
    expect(nyeriIdx).toBeLessThan(westIdx);

    expect(csv).toContain('GRAND TOTAL (3 staff)');
  });

  it('computes subtotals and grand total correctly', () => {
    const csv = buildPayrollRegisterCsv(rows, 'June 2026', 'now');
    const lines = csv.split('\r\n');

    const nyeriSubtotal = lines.find((l) => l.includes('Subtotal — Nyeri Town'))!;
    // Nyeri gross = 200 + 300 = 500; net = 150 + 250 = 400.
    expect(nyeriSubtotal).toContain('500.00');
    expect(nyeriSubtotal).toContain('400.00');

    const grand = lines.find((l) => l.includes('GRAND TOTAL'))!;
    // Grand gross = 100 + 200 + 300 = 600; net = 80 + 150 + 250 = 480.
    expect(grand).toContain('600.00');
    expect(grand).toContain('480.00');
  });

  it('handles an empty row set with a zeroed grand total', () => {
    const csv = buildPayrollRegisterCsv([], 'June 2026', 'now');
    expect(csv).toContain('GRAND TOTAL (0 staff)');
  });
});
