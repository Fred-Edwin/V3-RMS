import { describe, expect, it } from 'vitest';
import { calculatePayslip } from '../engine/calculate-payslip';
import type { EngineRules, PersonInput, TableRule } from '../engine/engine.types';
import { applyCorrection, currentValues } from './apply-correction';
import { diffPayslips, isNoChange, totalsOf } from './correction-diff';
import { correctBody, correctionChange } from './correction-validators';

// Invented tables only; nothing here is a real rate.
const rate: TableRule = { code: 'NSSF', name: 'Alpha', kind: 'RATE', base: 'GROSS', reducesTaxable: false, isIncomeTax: false, bands: [{ from: '0', to: null, ratePercent: '6', flatAmount: null }], employerRatePercent: null, reliefMonthly: null, floorAmount: null, ceilingAmount: null };
const rules: EngineRules = {
  tables: [rate],
  multipliers: { ordinaryDay: '1.5', restDay: '2', publicHoliday: '2' },
  lateness: { policy: 'FROM_FIRST_MINUTE', afterLatesPerMonth: null, deductionCapPercentOfPay: null },
  unpaidDayDivisor: 30,
  versions: [{ ruleKey: 'STATUTORY', version: 1, effectiveFrom: '2026-01-01' }],
};
const person = (over: Partial<PersonInput> = {}): PersonInput => ({
  employeeId: 'e1', name: 'Joy Chebet', siteId: 's1', payType: 'MONTHLY_SALARY', daysInMonth: 30,
  basisSegments: [{ amount: '30000.00', days: 30 }], amountInForce: '30000.00', overtimeEligible: true, standardWeekHours: '48', standardDayHours: '8',
  workedMinutes: 9600, overtimeAuthorisedMinutes: { ordinaryDay: 0, restDay: 0, publicHoliday: 0 }, holidayWorkedMinutes: 0,
  lateDays: [30, 20, 10], absentDays: 0, leaveDays: 0, adjustments: [], timesheetDocument: 'TSH-0001', ...over,
});

const lines = (p: PersonInput) => calculatePayslip(p, rules);

describe('applyCorrection', () => {
  it('takes late days back from the latest, never adds one', () => {
    expect(applyCorrection(person(), { kind: 'LATE_DAYS', changes: { lateDaysCounted: 2 } }).lateDays).toEqual([30, 20]);
    expect(() => applyCorrection(person(), { kind: 'LATE_DAYS', changes: { lateDaysCounted: 4 } })).toThrow(/can only go down/);
  });

  it('refuses more absent days than the month has, and basic for a daily-rate person', () => {
    expect(() => applyCorrection(person({ daysInMonth: 28 }), { kind: 'UNPAID_ABSENCE', changes: { absentDays: 29 } })).toThrow(/more days/);
    expect(() => applyCorrection(person({ payType: 'DAILY_RATE' }), { kind: 'BASIC', changes: { amount: '1000.00' } })).toThrow(/monthly salary/);
  });

  it('replaces the basic across every segment of the month', () => {
    const next = applyCorrection(person({ basisSegments: [{ amount: '30000.00', days: 10 }, { amount: '32000.00', days: 20 }] }), { kind: 'BASIC', changes: { amount: '31000.00' } });
    expect(next.basisSegments).toEqual([{ amount: '31000.00', days: 10 }, { amount: '31000.00', days: 20 }]);
    expect(next.amountInForce).toBe('31000.00');
  });

  it('adds a line with a fresh id, removes one by id, and refuses an id that is not on the payslip', () => {
    const added = applyCorrection(person(), { kind: 'EXTRA_LINE', changes: { add: [{ type: 'ALLOWANCE', label: 'Meal', amount: '500.00', taxable: true }], removeIds: [] } });
    expect(added.adjustments).toHaveLength(1);
    expect(added.adjustments[0]?.id).toMatch(/^correction-/);
    const removed = applyCorrection(added, { kind: 'EXTRA_LINE', changes: { add: [], removeIds: [added.adjustments[0]?.id ?? ''] } });
    expect(removed.adjustments).toHaveLength(0);
    expect(() => applyCorrection(person(), { kind: 'EXTRA_LINE', changes: { add: [], removeIds: ['nope'] } })).toThrow(/not on this payslip/);
  });

  it('does not change the stored input it was given', () => {
    const before = person();
    applyCorrection(before, { kind: 'LATE_DAYS', changes: { lateDaysCounted: 0 } });
    expect(before.lateDays).toEqual([30, 20, 10]);
    expect(currentValues(before).lateDaysCounted).toBe(3);
  });
});

describe('a correction recomputes the whole payslip with the same rules', () => {
  it('excusing late days raises the net by exactly the lateness taken back, and the statutory line follows', () => {
    const was = lines(person());
    const next = lines(applyCorrection(person(), { kind: 'LATE_DAYS', changes: { lateDaysCounted: 0 } }));
    const diff = diffPayslips({ lines: was.lines, totals: totalsOf(was) }, { lines: next.lines, totals: totalsOf(next) });
    expect(Number(next.net)).toBeGreaterThan(Number(was.net));
    expect(diff.lines.map((l) => l.code)).toContain('LATENESS');
    expect(diff.lines.some((l) => l.code === 'NSSF' || l.label === 'Alpha')).toBe(true);
    expect(diff.netChange).toBe((Math.round((Number(next.net) - Number(was.net)) * 100) / 100).toFixed(2));
    expect(isNoChange(diff)).toBe(false);
  });

  it('a correction that changes nothing is recognised', () => {
    const was = lines(person());
    const same = lines(applyCorrection(person(), { kind: 'UNPAID_ABSENCE', changes: { absentDays: 0 } }));
    expect(isNoChange(diffPayslips({ lines: was.lines, totals: totalsOf(was) }, { lines: same.lines, totals: totalsOf(same) }))).toBe(true);
  });

  it('lists an added line as a new row and a removed one as a gone row', () => {
    const base = person();
    const withLine = applyCorrection(base, { kind: 'EXTRA_LINE', changes: { add: [{ type: 'ALLOWANCE', label: 'Meal', amount: '500.00', taxable: false }], removeIds: [] } });
    const a = lines(base);
    const b = lines(withLine);
    const up = diffPayslips({ lines: a.lines, totals: totalsOf(a) }, { lines: b.lines, totals: totalsOf(b) });
    expect(up.lines.find((l) => l.label === 'Meal')).toMatchObject({ now: null, corrected: '500.00' });
    const down = diffPayslips({ lines: b.lines, totals: totalsOf(b) }, { lines: a.lines, totals: totalsOf(a) });
    expect(down.lines.find((l) => l.label === 'Meal')).toMatchObject({ now: '500.00', corrected: null });
  });
});

describe('correction validators', () => {
  const ok = { reason: 'One late day was excused by the manager', pin: '1234', expectedVersion: 1, idempotencyKey: 'key-12345678', change: { kind: 'LATE_DAYS', changes: { lateDaysCounted: 2 } } };

  it('accepts a good body', () => expect(correctBody.safeParse(ok).success).toBe(true));
  it('needs a reason of 5 to 280 characters with no amounts in it', () => {
    expect(correctBody.safeParse({ ...ok, reason: 'no' }).success).toBe(false);
    expect(correctBody.safeParse({ ...ok, reason: 'x'.repeat(281) }).success).toBe(false);
    expect(correctBody.safeParse({ ...ok, reason: 'Paid 12500 too little' }).success).toBe(false);
  });
  it('needs a 4 digit PIN, a version and a key; refuses extra fields', () => {
    expect(correctBody.safeParse({ ...ok, pin: '12' }).success).toBe(false);
    expect(correctBody.safeParse({ ...ok, expectedVersion: 0 }).success).toBe(false);
    expect(correctBody.safeParse({ ...ok, idempotencyKey: 'short' }).success).toBe(false);
    expect(correctBody.safeParse({ ...ok, net: '5' }).success).toBe(false);
  });
  it('each kind carries only its own fields', () => {
    expect(correctionChange.safeParse({ kind: 'LATE_DAYS', changes: { absentDays: 1 } }).success).toBe(false);
    expect(correctionChange.safeParse({ kind: 'UNPAID_ABSENCE', changes: { absentDays: 1.25 } }).success).toBe(false);
    expect(correctionChange.safeParse({ kind: 'BASIC', changes: { amount: '0' } }).success).toBe(false);
    expect(correctionChange.safeParse({ kind: 'OVERTIME', changes: { ordinaryDay: 60, restDay: 0, publicHoliday: 0 } }).success).toBe(true);
  });
});
