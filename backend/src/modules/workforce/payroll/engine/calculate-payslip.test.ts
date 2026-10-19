import { describe, expect, it } from 'vitest';
import { calculatePayslip } from './calculate-payslip';
import type { AdjustmentInput, EngineRules, PersonInput, TableRule } from './engine.types';
import { parseCents } from './money';

// Every table here is invented for the test. Nothing is a real rate, band or relief.
const table = (over: Partial<TableRule> & Pick<TableRule, 'code' | 'name'>): TableRule => ({
  kind: 'RATE',
  base: 'GROSS',
  reducesTaxable: false,
  isIncomeTax: false,
  bands: [{ from: '0', to: null, ratePercent: '6', flatAmount: null }],
  employerRatePercent: null,
  reliefMonthly: null,
  floorAmount: null,
  ceilingAmount: null,
  ...over,
});

const ALPHA = table({ code: 'NSSF', name: 'Alpha', reducesTaxable: true, employerRatePercent: '6' });
const BETA = table({ code: 'SHA', name: 'Beta', bands: [{ from: '0', to: null, ratePercent: '2.5', flatAmount: null }] });
const GAMMA = table({
  code: 'PAYE',
  name: 'Gamma',
  kind: 'BANDS',
  base: 'TAXABLE',
  isIncomeTax: true,
  reliefMonthly: '2000',
  bands: [
    { from: '0', to: '24000', ratePercent: '10', flatAmount: null },
    { from: '24000', to: '32333', ratePercent: '25', flatAmount: null },
    { from: '32333', to: null, ratePercent: '30', flatAmount: null },
  ],
});

const rules = (over: Partial<EngineRules> = {}): EngineRules => ({
  tables: [],
  multipliers: { ordinaryDay: '1.5', restDay: '2', publicHoliday: '2' },
  lateness: { policy: 'RECORD_ONLY', afterLatesPerMonth: null, deductionCapPercentOfPay: null },
  unpaidDayDivisor: 30,
  versions: [{ ruleKey: 'STATUTORY', version: 4, effectiveFrom: '2026-02-01' }],
  ...over,
});

const person = (over: Partial<PersonInput> = {}): PersonInput => ({
  employeeId: 'e1',
  name: 'Joy Chebet',
  siteId: 's1',
  payType: 'MONTHLY_SALARY',
  daysInMonth: 30,
  basisSegments: [{ amount: '30000', days: 30 }],
  amountInForce: '30000',
  overtimeEligible: true,
  standardWeekHours: '48',
  standardDayHours: '8',
  workedMinutes: 0,
  overtimeAuthorisedMinutes: { ordinaryDay: 0, restDay: 0, publicHoliday: 0 },
  holidayWorkedMinutes: 0,
  lateDays: [],
  absentDays: 0,
  leaveDays: 0,
  adjustments: [],
  timesheetDocument: 'TSH-0009',
  ...over,
});

const adjustment = (over: Partial<AdjustmentInput>): AdjustmentInput => ({ id: 'a1', kind: 'ALLOWANCE', label: 'Allowance', amount: '1000', taxable: true, reason: 'Agreed with the Director', ...over });
const line = (slip: ReturnType<typeof calculatePayslip>, code: string) => slip.lines.find((l) => l.code === code);

describe('calculatePayslip: statutory tables read their data, never a name', () => {
  const slip = calculatePayslip(person(), rules({ tables: [ALPHA, BETA, GAMMA] }));

  it('works rate tables, then the taxable-pay table after the allowable deduction', () => {
    expect(line(slip, 'STATUTORY:NSSF')?.amount).toBe('1800.00');
    expect(line(slip, 'STATUTORY:SHA')?.amount).toBe('750.00');
    expect(slip.taxablePay).toBe('28200.00'); // 30,000 less Alpha, which is allowable
    // 24,000 × 10% + 4,200 × 25% = 3,450, less relief 2,000
    expect(line(slip, 'STATUTORY:PAYE')?.amount).toBe('1450.00');
    expect(line(slip, 'STATUTORY:PAYE')?.workingText).toBe('first 24,000 × 10% + next 4,200 × 25% = 3,450 − relief 2,000 = 1,450');
  });

  it('puts the employee shares on the net and the employer share only on the memo line', () => {
    expect(slip.net).toBe('26000.00'); // 30,000 − 1,800 − 750 − 1,450
    expect(slip.employerShare).toBe('1800.00');
    const memo = line(slip, 'EMPLOYER:NSSF');
    expect(memo?.kind).toBe('MEMO');
    expect(memo?.share).toBe('EMPLOYER');
  });

  it('shows the working a payslip prints, whole shillings', () => {
    const joy = calculatePayslip(person({ basisSegments: [{ amount: '28303', days: 30 }], amountInForce: '28303' }), rules({ tables: [ALPHA] }));
    expect(line(joy, 'STATUTORY:NSSF')?.amount).toBe('1698.18');
    expect(line(joy, 'STATUTORY:NSSF')?.workingText).toBe('28,303 × 6% = 1,698');
  });

  it('floor and ceiling limit a rate table, and a nil base takes nothing', () => {
    const limited = table({ code: 'OTHER', name: 'Capped', floorAmount: '500', ceilingAmount: '1000' });
    expect(line(calculatePayslip(person(), rules({ tables: [limited] })), 'STATUTORY:OTHER:capped')?.amount).toBe('1000.00');
    expect(line(calculatePayslip(person({ basisSegments: [{ amount: '5000', days: 30 }], amountInForce: '5000' }), rules({ tables: [limited] })), 'STATUTORY:OTHER:capped')?.amount).toBe('500.00');
    const nobody = calculatePayslip(person({ basisSegments: [], amountInForce: null }), rules({ tables: [limited] }));
    expect(line(nobody, 'STATUTORY:OTHER:capped')?.amount).toBe('0.00');
  });

  it('personal relief never takes tax below zero', () => {
    const small = calculatePayslip(person({ basisSegments: [{ amount: '15000', days: 30 }], amountInForce: '15000' }), rules({ tables: [GAMMA] }));
    expect(line(small, 'STATUTORY:PAYE')?.amount).toBe('0.00'); // 1,500 tax − 2,000 relief
  });

  it('a table the Accountant orders first still reads taxable pay after the allowable ones', () => {
    const reordered = calculatePayslip(person(), rules({ tables: [GAMMA, ALPHA] }));
    expect(line(reordered, 'STATUTORY:PAYE')?.amount).toBe('1450.00');
    expect(reordered.lines.filter((l) => l.kind === 'STATUTORY').map((l) => l.tableCode)).toEqual(['PAYE', 'NSSF']); // the Accountant's order is kept
  });
});

describe('calculatePayslip: basic pay', () => {
  it('prorates a joiner or a leaver by calendar days', () => {
    const joiner = calculatePayslip(person({ basisSegments: [{ amount: '30000', days: 19 }] }), rules());
    expect(joiner.basic).toBe('19000.00');
    expect(line(joiner, 'BASIC')?.workingText).toBe('30,000 × 19 of 30 days');
  });

  it('splits the month at a pay change', () => {
    const changed = calculatePayslip(person({ basisSegments: [{ amount: '30000', days: 10 }, { amount: '36000', days: 20 }] }), rules());
    expect(changed.basic).toBe('34000.00'); // (30,000 × 10 + 36,000 × 20) ÷ 30
  });

  it('pays a daily-rate person for approved hours only', () => {
    const daily = calculatePayslip(person({ payType: 'DAILY_RATE', basisSegments: [{ amount: '1000', days: 30 }], amountInForce: '1000', workedMinutes: 4800 }), rules());
    expect(daily.basic).toBe('10000.00'); // 80 h × (1,000 ÷ 8)
  });

  it('gives a person with no pay profile an empty payslip and the reason', () => {
    const none = calculatePayslip(person({ basisSegments: [], amountInForce: null }), rules({ tables: [ALPHA] }));
    expect(none.problems).toContain('NO_PAY_PROFILE');
    expect(none.gross).toBe('0.00');
    expect(none.net).toBe('0.00');
  });
});

describe('calculatePayslip: overtime and holiday pay', () => {
  it('pays only authorised minutes, by the day type multiplier', () => {
    const slip = calculatePayslip(person({ overtimeAuthorisedMinutes: { ordinaryDay: 665, restDay: 0, publicHoliday: 0 } }), rules());
    expect(line(slip, 'OVERTIME_ORDINARY')?.amount).toBe('2397.84'); // 11.0833 h × (30,000 ÷ 208 = 144.2308) × 1.5
    expect(slip.overtimePay).toBe('2397.84');
    expect(line(slip, 'OVERTIME_ORDINARY')?.source).toEqual({ type: 'TIMESHEET', ruleKey: 'OVERTIME', reference: 'TSH-0009' });
    const rest = calculatePayslip(person({ overtimeAuthorisedMinutes: { ordinaryDay: 0, restDay: 60, publicHoliday: 0 } }), rules());
    expect(line(rest, 'OVERTIME_REST_DAY')?.amount).toBe('288.46'); // 144.2308 × 2
  });

  it('pays nothing to a person who is not overtime eligible', () => {
    const slip = calculatePayslip(person({ overtimeEligible: false, overtimeAuthorisedMinutes: { ordinaryDay: 600, restDay: 0, publicHoliday: 0 } }), rules());
    expect(slip.overtimePay).toBe('0.00');
  });

  it('flags a missing hours basis or multiplier instead of guessing', () => {
    const noHours = calculatePayslip(person({ standardWeekHours: null, overtimeAuthorisedMinutes: { ordinaryDay: 60, restDay: 0, publicHoliday: 0 } }), rules());
    expect(noHours.problems).toContain('NO_HOURS_BASIS');
    const noRate = calculatePayslip(person({ overtimeAuthorisedMinutes: { ordinaryDay: 60, restDay: 0, publicHoliday: 0 } }), rules({ multipliers: { ordinaryDay: null, restDay: null, publicHoliday: null } }));
    expect(noRate.problems).toContain('NO_OVERTIME_RATE');
  });

  it('pays hours worked on a public holiday at the confirmed holiday multiplier', () => {
    const slip = calculatePayslip(person({ holidayWorkedMinutes: 480 }), rules());
    expect(line(slip, 'HOLIDAY_PAY')?.amount).toBe('2307.69'); // 8 h × 144.2308 × 2
  });
});

describe('calculatePayslip: absence and lateness', () => {
  it('takes unpaid days at basic ÷ the divisor, and approved leave is never unpaid', () => {
    const slip = calculatePayslip(person({ absentDays: 2, leaveDays: 5 }), rules());
    expect(line(slip, 'UNPAID_ABSENCE')?.amount).toBe('2000.00');
    expect(slip.gross).toBe('28000.00');
    expect(calculatePayslip(person({ absentDays: 1 }), rules({ unpaidDayDivisor: 26 })).unpaidAbsence).toBe('1153.85');
  });

  it('record-only lateness deducts nothing', () => {
    expect(calculatePayslip(person({ lateDays: [10, 20, 30, 40] }), rules()).latenessDeduction).toBe('0.00');
  });

  it('after N late days deducts from the Nth day on, at the hourly rate', () => {
    const slip = calculatePayslip(person({ lateDays: [10, 12, 15, 20] }), rules({ lateness: { policy: 'AFTER_N_LATES', afterLatesPerMonth: 3, deductionCapPercentOfPay: 2 } }));
    expect(line(slip, 'LATENESS')?.amount).toBe('84.13'); // 35 min × 144.2308 ÷ 60
    expect(line(slip, 'LATENESS')?.workingText).toContain('deducted from day 3 on');
    expect(slip.latenessCapHit).toBe(false);
  });

  it('from the first minute counts every late day, and the cap stops it at a share of basic', () => {
    const slip = calculatePayslip(person({ lateDays: [600] }), rules({ lateness: { policy: 'FROM_FIRST_MINUTE', afterLatesPerMonth: null, deductionCapPercentOfPay: 2 } }));
    expect(line(slip, 'LATENESS')?.amount).toBe('600.00'); // 2% of 30,000, not 1,442.31
    expect(slip.latenessCapHit).toBe(true);
  });
});

describe('calculatePayslip: adjustments and sums', () => {
  const slip = calculatePayslip(
    person({
      absentDays: 1,
      overtimeAuthorisedMinutes: { ordinaryDay: 125, restDay: 0, publicHoliday: 0 },
      adjustments: [
        adjustment({ id: 'a1', kind: 'ALLOWANCE', amount: '1500.50', taxable: true }),
        adjustment({ id: 'a2', kind: 'INCENTIVE', label: 'Bonus', amount: '800', taxable: false }),
        adjustment({ id: 'a3', kind: 'ADVANCE_REPAID', label: 'Advance', amount: '2000' }),
      ],
    }),
    rules({ tables: [ALPHA, BETA, GAMMA] }),
  );

  it('earnings adjustments join gross, deduction adjustments come off after tax', () => {
    expect(line(slip, 'ALLOWANCE')?.amount).toBe('1500.50');
    expect(line(slip, 'ADVANCE_REPAID')?.kind).toBe('DEDUCTION');
    expect(slip.otherDeductions).toBe('2000.00');
  });

  it('a non-taxable line is left out of taxable pay', () => {
    const gross = parseCents(slip.gross);
    expect(parseCents(slip.taxablePay)).toBe(gross - 80000n - parseCents(line(slip, 'STATUTORY:NSSF')?.amount ?? '0'));
  });

  it('gross, deductions and net are sums of the stored lines, so a payslip adds up', () => {
    const sum = (kinds: string[], filter: (code: string) => boolean = () => true) =>
      slip.lines.filter((l) => kinds.includes(l.kind) && filter(l.code)).reduce((total, l) => total + parseCents(l.amount), 0n);
    const earnings = sum(['EARNING']);
    const payDeductions = sum(['DEDUCTION'], (code) => code === 'UNPAID_ABSENCE' || code === 'LATENESS');
    expect(parseCents(slip.gross)).toBe(earnings - payDeductions);
    expect(parseCents(slip.net)).toBe(parseCents(slip.gross) - sum(['STATUTORY']) - sum(['DEDUCTION'], (code) => code === 'ADVANCE_REPAID'));
  });

  it('can end negative, which the review blocks', () => {
    const negative = calculatePayslip(person({ adjustments: [adjustment({ kind: 'OTHER_DEDUCTION', amount: '40000' })] }), rules());
    expect(negative.net).toBe('-10000.00');
  });
});
