import { describe, expect, it } from 'vitest';
import { calculatePayslip } from './calculate-payslip';
import type { EngineRules, PersonInput } from './engine.types';
import { formatCents, formatPercent, formatWhole, mulDiv, parseCents, parseRate, percentOf, roundDiv } from './money';
import { hashInputs, monthTotals, totalsDisagree } from './month-totals';

const rules: EngineRules = {
  tables: [
    { code: 'NSSF', name: 'Alpha', kind: 'RATE', base: 'GROSS', reducesTaxable: false, isIncomeTax: false, bands: [{ from: '0', to: null, ratePercent: '6', flatAmount: null }], employerRatePercent: null, reliefMonthly: null, floorAmount: null, ceilingAmount: null },
  ],
  multipliers: { ordinaryDay: '1.5', restDay: '2', publicHoliday: '2' },
  lateness: { policy: 'RECORD_ONLY', afterLatesPerMonth: null, deductionCapPercentOfPay: null },
  unpaidDayDivisor: 30,
  versions: [],
};
const person = (id: string, amount: string): PersonInput => ({
  employeeId: id,
  name: id,
  siteId: 's',
  payType: 'MONTHLY_SALARY',
  daysInMonth: 30,
  basisSegments: [{ amount, days: 30 }],
  amountInForce: amount,
  overtimeEligible: false,
  standardWeekHours: '48',
  standardDayHours: '8',
  workedMinutes: 0,
  overtimeAuthorisedMinutes: { ordinaryDay: 0, restDay: 0, publicHoliday: 0 },
  holidayWorkedMinutes: 0,
  lateDays: [],
  absentDays: 0,
  leaveDays: 0,
  adjustments: [],
  timesheetDocument: null,
});

describe('monthTotals', () => {
  const rows = [
    { siteId: 'a', payslip: calculatePayslip(person('p1', '28303'), rules) },
    { siteId: 'a', payslip: calculatePayslip(person('p2', '31111.11'), rules) },
    { siteId: 'b', payslip: calculatePayslip(person('p3', '50000'), rules) },
  ];

  it('adds stored per-person figures by site and in total, and they agree', () => {
    const { total, bySite } = monthTotals(rows);
    expect(total.people).toBe(3);
    expect(bySite.get('a')?.people).toBe(2);
    // 28,303 × 6% = 1,698.18 and 31,111.11 × 6% = 1,866.67 (each rounded on its own line, then added)
    expect(bySite.get('a')?.taxStatutory).toBe('3564.85');
    expect(total.net).toBe(formatCents([...bySite.values()].reduce((sum, row) => sum + parseCents(row.net), 0n)));
    expect(totalsDisagree(rows)).toEqual([]);
  });

  it('reports a payslip whose figures were changed away from its lines', () => {
    const tampered = rows.map((row, index) => (index === 0 ? { ...row, payslip: { ...row.payslip, net: '1.00' } } : row));
    expect(totalsDisagree(tampered).length).toBeGreaterThan(0);
  });
});

describe('hashInputs', () => {
  it('is the same for the same inputs in any key order, and different when one value changes', () => {
    expect(hashInputs({ a: 1, b: [1, 2], c: { x: 'y' } })).toBe(hashInputs({ c: { x: 'y' }, b: [1, 2], a: 1 }));
    expect(hashInputs({ a: 1 })).not.toBe(hashInputs({ a: 2 }));
  });
});

describe('money', () => {
  it('rounds half up on the size of the number', () => {
    expect(roundDiv(25n, 10n)).toBe(3n);
    expect(roundDiv(-25n, 10n)).toBe(-3n);
    expect(roundDiv(24n, 10n)).toBe(2n);
    expect(mulDiv(1n, 1n, 2n)).toBe(1n);
  });
  it('works a percentage once, from the exact rate', () => {
    expect(formatCents(percentOf(parseCents('28303'), '2.75'))).toBe('778.33');
    expect(parseRate('32.5')).toBe(325000n);
  });
  it('writes money and percentages the way a payslip does', () => {
    expect(formatWhole(parseCents('1698.18'))).toBe('1,698');
    expect(formatWhole(parseCents('1234567.50'))).toBe('1,234,568');
    expect(formatWhole(parseCents('-2500.00'))).toBe('-2,500');
    expect(formatPercent('6.0000')).toBe('6%');
    expect(formatPercent('32.50')).toBe('32.5%');
    expect(() => parseCents('12.345')).toThrow();
  });
});
