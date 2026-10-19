import { describe, expect, it } from 'vitest';
import { calculatePayslip } from './calculate-payslip';
import type { EngineRules, PersonInput } from './engine.types';
import { reviewFlags, type PersonFacts } from './review-flags';

const rules: EngineRules = {
  tables: [],
  multipliers: { ordinaryDay: '1.5', restDay: '2', publicHoliday: '2' },
  lateness: { policy: 'FROM_FIRST_MINUTE', afterLatesPerMonth: null, deductionCapPercentOfPay: null },
  unpaidDayDivisor: 30,
  versions: [],
};

const person = (over: Partial<PersonInput> = {}): PersonInput => ({
  employeeId: 'e1',
  name: 'Esther Mwende',
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
  timesheetDocument: null,
  ...over,
});

const facts = (over: Partial<PersonFacts> = {}): PersonFacts => ({
  leftOut: false,
  hasPayProfile: true,
  payoutMethod: 'BANK',
  hasBankAccount: true,
  joinedThisMonth: false,
  firstPayrollMonth: false,
  leftThisMonth: false,
  employedDays: 30,
  daysInMonth: 30,
  lastMonthNet: '30000.00',
  missingIds: [],
  timesheetDays: 20,
  lateDayCount: 0,
  lateMinutes: 0,
  absentDays: 0,
  bankChangedSinceLastMonth: false,
  duplicateAccount: false,
  movedBetweenSystems: false,
  leftOutEarlier: false,
  adjustmentCount: 0,
  ...over,
});

const kinds = (f: PersonFacts, p: PersonInput) => reviewFlags(f, calculatePayslip(p, rules)).map((x) => `${x.severity}:${x.kind}`);

describe('reviewFlags', () => {
  it('has nothing to say about an ordinary month', () => {
    expect(kinds(facts(), person())).toEqual([]);
  });

  it('blocks a negative net, a missing pay profile, a missing bank account and a person moved between systems', () => {
    expect(kinds(facts(), person({ adjustments: [{ id: 'a', kind: 'OTHER_DEDUCTION', label: 'Loan', amount: '40000', taxable: false, reason: 'Loan repayment' }] }))).toContain('BLOCK:NEGATIVE_NET');
    expect(kinds(facts({ hasPayProfile: false }), person({ basisSegments: [], amountInForce: null }))).toContain('BLOCK:MISSING_PAY_PROFILE');
    expect(kinds(facts({ hasBankAccount: false }), person())).toContain('BLOCK:MISSING_BANK');
    expect(kinds(facts({ hasBankAccount: false, payoutMethod: 'MPESA' }), person())).not.toContain('BLOCK:MISSING_BANK');
    expect(kinds(facts({ movedBetweenSystems: true }), person())).toContain('BLOCK:MOVED_BETWEEN_SYSTEMS');
  });

  it('asks HR to tick unpaid absence, lateness and the cap', () => {
    const all = reviewFlags(facts({ absentDays: 1, lateDayCount: 2, lateMinutes: 90 }), calculatePayslip(person({ absentDays: 1, lateDays: [40, 50] }), { ...rules, lateness: { ...rules.lateness, deductionCapPercentOfPay: 0.5 } }));
    expect(all.map((f) => f.kind)).toEqual(expect.arrayContaining(['UNPAID_ABSENCE', 'LATENESS_DEDUCTION', 'LATENESS_CAP_HIT']));
    expect(all.every((f) => f.severity === 'TICK')).toBe(true);
    expect(all.find((f) => f.kind === 'UNPAID_ABSENCE')?.text).toBe('1 day deducted, KES 1,000');
  });

  it('flags a net more than 25% away from last month, either way, and not exactly 25%', () => {
    expect(kinds(facts({ lastMonthNet: '20000.00' }), person())).toContain('TICK:BIG_CHANGE'); // +50%
    expect(kinds(facts({ lastMonthNet: '45000.00' }), person())).toContain('TICK:BIG_CHANGE'); // −33%
    expect(kinds(facts({ lastMonthNet: '24000.00' }), person())).not.toContain('TICK:BIG_CHANGE'); // +25% exactly
    expect(kinds(facts({ lastMonthNet: null }), person())).not.toContain('TICK:BIG_CHANGE');
  });

  it('does not compare a first payroll month with a previous one, and says it is new', () => {
    const out = kinds(facts({ firstPayrollMonth: true, lastMonthNet: '1000.00' }), person());
    expect(out).toContain('TICK:NEW_JOINER');
    expect(out).not.toContain('TICK:BIG_CHANGE');
  });

  it('flags a joiner, a leaver, overtime above half of basic, missing ids, no days, changed or shared bank and arrears', () => {
    const out = kinds(
      facts({ joinedThisMonth: true, leftThisMonth: true, missingIds: ['KRA PIN'], timesheetDays: 0, bankChangedSinceLastMonth: true, duplicateAccount: true, leftOutEarlier: true, adjustmentCount: 1 }),
      person({ overtimeAuthorisedMinutes: { ordinaryDay: 6000, restDay: 0, publicHoliday: 0 } }),
    );
    expect(out).toEqual(
      expect.arrayContaining(['TICK:NEW_JOINER', 'TICK:LEAVER', 'TICK:OVERTIME_HIGH', 'TICK:MISSING_ID', 'TICK:NO_TIMESHEET_DAYS', 'TICK:BANK_DETAILS_CHANGED', 'TICK:DUPLICATE_ACCOUNT', 'TICK:ARREARS', 'TICK:ADJUSTMENT']),
    );
  });

  it('puts blocks before ticks and says nothing about a person already left out', () => {
    const out = kinds(facts({ hasBankAccount: false, missingIds: ['NSSF number'] }), person());
    expect(out[0]).toBe('BLOCK:MISSING_BANK');
    expect(kinds(facts({ leftOut: true, hasBankAccount: false }), person())).toEqual([]);
  });
});
