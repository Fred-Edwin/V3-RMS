import { describe, expect, it } from 'vitest';
import type { PayslipData, PayslipLine } from '../reads/payslip-model';
import { p9Rows, p9Totals, p9Values } from './p9-model';

// Invented round numbers, not tax tables: the code only adds and subtracts what the payslip stored.
const line = (code: string, kind: PayslipLine['kind'], amount: string, over: Partial<PayslipLine> = {}): PayslipLine => ({ code, label: code, kind, amount, share: kind === 'MEMO' ? 'EMPLOYER' : 'EMPLOYEE', taxable: kind === 'EARNING', workingText: '', baseAmount: null, bandsUsed: null, ...over });
const slip = (monthKey: string, over: Partial<PayslipData> = {}): PayslipData => ({
  id: monthKey, monthKey, version: 1, number: 'PS-1', gross: '50000.00', net: '38000.00', taxablePay: '48000.00', incomeTax: '6000.00', correctedAt: null,
  lines: [
    line('BASIC', 'EARNING', '50000.00'),
    line('PENSION', 'STATUTORY', '2000.00'),
    line('PAYE', 'STATUTORY', '6000.00', { bandsUsed: [{ from: '0', to: '24000', ratePercent: '10', amount: '2400.00' }, { from: '24000', to: null, ratePercent: '20', amount: '9600.00' }] }),
  ],
  ...over,
});

describe('a month on the card', () => {
  it('reads gross, taxable pay and PAYE from the payslip and derives the rest from its lines', () => {
    expect(p9Values(slip('2026-01'))).toEqual({ gross: '50000.00', contributions: '2000.00', taxable: '48000.00', taxCharged: '12000.00', relief: '6000.00', paye: '6000.00' });
  });

  it('a payslip with no bands shows tax charged equal to PAYE and no relief', () => {
    const flat = slip('2026-01', { lines: [line('BASIC', 'EARNING', '50000.00'), line('PAYE', 'STATUTORY', '6000.00')] });
    expect(p9Values(flat)).toMatchObject({ taxCharged: '6000.00', relief: '0.00' });
  });

  it('non-taxable earnings are not counted as contributions', () => {
    const withAllowance = slip('2026-01', { gross: '52000.00', lines: [line('BASIC', 'EARNING', '50000.00'), line('ALLOW', 'EARNING', '2000.00', { taxable: false }), line('PAYE', 'STATUTORY', '6000.00')] });
    expect(p9Values(withAllowance).contributions).toBe('2000.00'); // taxable earnings 50,000 − taxable pay 48,000
  });

  it('never shows negative contributions or relief', () => {
    const odd = slip('2026-01', { taxablePay: '51000.00', lines: [line('BASIC', 'EARNING', '50000.00'), line('PAYE', 'STATUTORY', '6000.00', { bandsUsed: [{ from: '0', to: null, ratePercent: '10', amount: '5000.00' }] })] });
    const v = p9Values(odd);
    expect(v.contributions).toBe('0.00');
    expect(v.relief).toBe('0.00');
  });
});

describe('the twelve rows and the totals', () => {
  it('only paid months carry figures; the others stay empty; the totals add the paid months', () => {
    const rows = p9Rows(
      [{ monthKey: '2026-06', state: 'NOT_EMPLOYED' }, { monthKey: '2026-07', state: 'PAYSLIP' }, { monthKey: '2026-08', state: 'PAYSLIP' }],
      new Map([['2026-07', slip('2026-07')], ['2026-08', slip('2026-08', { gross: '51000.00' })]]),
    );
    expect(rows[0]?.values).toBeNull();
    const totals = p9Totals(rows);
    expect(totals.gross).toBe('101000.00');
    expect(totals.paye).toBe('12000.00');
  });
});
