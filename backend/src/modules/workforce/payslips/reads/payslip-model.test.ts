import { describe, expect, it } from 'vitest';
import { employerLines, last4, latestPerMonth, maskNumber, monthSection, yearSection, yearTotals, type PayslipData, type PayslipLine } from './payslip-model';

const line = (code: string, kind: PayslipLine['kind'], amount: string, share: string | null = null, working = ''): PayslipLine => ({ code, label: code, kind, amount, share, taxable: kind === 'EARNING', workingText: working, baseAmount: null, bandsUsed: null });
const slip = (monthKey: string, version: number, over: Partial<PayslipData> & { lines: PayslipLine[] }): PayslipData => ({ id: `${monthKey}-${version}`, monthKey, version, number: 'PS-0001', gross: '0.00', net: '0.00', taxablePay: '0.00', incomeTax: '0.00', correctedAt: null, ...over });

const sept = slip('2026-09', 1, {
  gross: '45190.00',
  net: '34860.00',
  lines: [line('BASIC', 'EARNING', '45000.00'), line('OT', 'EARNING', '190.00', null, '35 min × KES 216.35 an hour × 1.5'), line('PAYE', 'STATUTORY', '7329.00', 'EMPLOYEE'), line('NSSF', 'STATUTORY', '1080.00', 'EMPLOYEE'), line('SHA', 'STATUTORY', '1243.00', 'EMPLOYEE'), line('NSSF_ER', 'MEMO', '1080.00', 'EMPLOYER'), line('LATE', 'DEDUCTION', '0.00'), line('HOUSING', 'STATUTORY', '678.00', 'EMPLOYEE')],
});

describe('a month in blocks', () => {
  it('earned and taken off, the employer share left out of what was taken', () => {
    const s = monthSection(sept, null);
    expect(s.earnings.map((l) => l.key)).toEqual(['BASIC', 'OT']);
    expect(s.deductions.map((l) => l.key)).toEqual(['PAYE', 'NSSF', 'SHA', 'LATE', 'HOUSING']);
    expect(s.gross).toBe('45190.00');
    expect(s.totalDeductions).toBe('10330.00'); // 45,190 − 34,860, the figure of the Paper sample
    expect(s.net).toBe('34860.00');
    expect(employerLines(sept).map((l) => l.key)).toEqual(['NSSF_ER']);
  });

  it('carries the working text beside the line', () => {
    expect(monthSection(sept, null).earnings[1]?.working).toBe('35 min × KES 216.35 an hour × 1.5');
  });

  it('version 2 marks the lines that changed as "corrected from"', () => {
    const v1 = slip('2026-09', 1, { gross: '31000.00', net: '27940.00', lines: [line('BASIC', 'EARNING', '31000.00'), line('LATE', 'DEDUCTION', '410.00')] });
    const v2 = slip('2026-09', 2, { gross: '31000.00', net: '28145.00', lines: [line('BASIC', 'EARNING', '31000.00'), line('LATE', 'DEDUCTION', '205.00')] });
    const s = monthSection(v2, v1);
    expect(s.deductions[0]).toMatchObject({ key: 'LATE', amount: '205.00', correctedFrom: '410.00' });
    expect(s.earnings[0]?.correctedFrom).toBeNull();
  });
});

describe('year to date', () => {
  const aug = slip('2026-08', 1, { gross: '45000.00', net: '35000.00', lines: [line('BASIC', 'EARNING', '45000.00'), line('PAYE', 'STATUTORY', '7000.00', 'EMPLOYEE'), line('NSSF', 'STATUTORY', '1000.00', 'EMPLOYEE'), line('SHA', 'STATUTORY', '1200.00', 'EMPLOYEE'), line('HOUSING', 'STATUTORY', '800.00', 'EMPLOYEE')] });

  it('adds each line and the totals across the months', () => {
    const y = yearSection([aug, sept]);
    expect(y.earnings.find((l) => l.key === 'BASIC')?.amount).toBe('90000.00');
    expect(y.deductions.find((l) => l.key === 'PAYE')?.amount).toBe('14329.00');
    expect(y.gross).toBe('90190.00');
    expect(y.net).toBe('69860.00');
    expect(y.totalDeductions).toBe('20330.00');
  });

  it('has no working lines', () => {
    expect(yearSection([aug, sept]).earnings.every((l) => l.working === null)).toBe(true);
  });

  it('the year card is earned, taken off, net', () => {
    expect(yearTotals([aug, sept])).toEqual({ earned: '90190.00', takenOff: '20330.00', net: '69860.00' });
  });

  it('a person who joined mid-year starts at the joining month (only the months given are added)', () => {
    expect(yearTotals([sept]).earned).toBe('45190.00');
  });
});

describe('versions and masks', () => {
  it('keeps the latest version of each month, in month order', () => {
    const rows = [slip('2026-09', 1, { lines: [] }), slip('2026-08', 1, { lines: [] }), slip('2026-09', 2, { lines: [] })];
    expect(latestPerMonth(rows).map((r) => `${r.monthKey}/v${r.version}`)).toEqual(['2026-08/v1', '2026-09/v2']);
  });

  it('only the last four digits of an account leave the server', () => {
    expect(last4('0123456789124412')).toBe('4412');
    expect(last4('12')).toBeNull();
    expect(last4(null)).toBeNull();
  });

  it('masks tax and social security numbers', () => {
    expect(maskNumber('A001234567Z')).toBe('A00•••••••Z');
    expect(maskNumber(null)).toBe('Not on file');
  });
});
