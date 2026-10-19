import { describe, expect, it } from 'vitest';
import type { EngineRules, PersonInput } from '../engine/engine.types';
import type { PersonFacts } from '../engine/review-flags';
import { computeRun, LEFT_OUT_TEXT } from './compute-run';
import type { LoadedPerson } from './load-inputs';

const rules: EngineRules = {
  tables: [{ code: 'NSSF', name: 'Alpha', kind: 'RATE', base: 'GROSS', reducesTaxable: false, isIncomeTax: false, bands: [{ from: '0', to: null, ratePercent: '6', flatAmount: null }], employerRatePercent: '6', reliefMonthly: null, floorAmount: null, ceilingAmount: null }],
  multipliers: { ordinaryDay: '1.5', restDay: '2', publicHoliday: '2' },
  lateness: { policy: 'RECORD_ONLY', afterLatesPerMonth: null, deductionCapPercentOfPay: null },
  unpaidDayDivisor: 30,
  versions: [],
};
const facts = (over: Partial<PersonFacts> = {}): PersonFacts => ({
  leftOut: false, hasPayProfile: true, payoutMethod: 'BANK', hasBankAccount: true, joinedThisMonth: false, firstPayrollMonth: false, leftThisMonth: false, employedDays: 30, daysInMonth: 30,
  lastMonthNet: null, missingIds: [], timesheetDays: 20, lateDayCount: 0, lateMinutes: 0, absentDays: 0, bankChangedSinceLastMonth: false, duplicateAccount: false, movedBetweenSystems: false, leftOutEarlier: false, adjustmentCount: 0, ...over,
});
const person = (id: string, siteId: string, amount: string | null, over: Partial<PersonFacts> = {}): LoadedPerson => {
  const input: PersonInput = {
    employeeId: id, name: `Person ${id}`, siteId, payType: 'MONTHLY_SALARY', daysInMonth: 30, basisSegments: amount ? [{ amount, days: 30 }] : [], amountInForce: amount,
    overtimeEligible: false, standardWeekHours: '48', standardDayHours: '8', workedMinutes: 0, overtimeAuthorisedMinutes: { ordinaryDay: 0, restDay: 0, publicHoliday: 0 },
    holidayWorkedMinutes: 0, lateDays: [], absentDays: 0, leaveDays: 0, adjustments: [], timesheetDocument: 'TSH-0001',
  };
  return { input, facts: facts({ hasPayProfile: amount !== null, ...over }), siteName: siteId, department: 'Service', employeeNumber: id, payoutMethod: 'BANK', bankFingerprint: null };
};
const bySite = new Map([['a', rules], ['b', rules]]);

describe('computeRun', () => {
  it('makes a payslip per person, totals by site, and nothing to review for an ordinary month', () => {
    const run = computeRun([person('p1', 'a', '30000'), person('p2', 'a', '20000'), person('p3', 'b', '10000')], bySite, new Map());
    expect(run.headcount).toBe(3);
    expect(run.reviews).toEqual([]);
    expect(run.totals.total).toMatchObject({ people: 3, gross: '60000.00', taxStatutory: '3600.00', net: '56400.00', employerShare: '3600.00' });
    expect(run.totals.bySite['a']).toMatchObject({ people: 2, net: '47000.00' });
    expect(run.disagreements).toEqual([]);
  });

  it('turns a missing pay profile into a blocking line and still counts the month', () => {
    const run = computeRun([person('p1', 'a', null), person('p2', 'a', '30000')], bySite, new Map());
    expect(run.blocking).toBe(1);
    expect(run.reviews[0]).toMatchObject({ kind: 'MISSING_PAY_PROFILE', severity: 'BLOCK', employeeName: 'Person p1' });
  });

  it('leaves a chosen person out: no payslip, a ticked line that says so, and they are not in the totals', () => {
    const run = computeRun([person('p1', 'a', '30000'), person('p2', 'a', null)], bySite, new Map([['p2', { byId: 'hr1' }]]));
    expect(run.headcount).toBe(1);
    expect(run.blocking).toBe(0);
    expect(run.reviews).toEqual([expect.objectContaining({ employeeId: 'p2', kind: 'LEFT_OUT', text: LEFT_OUT_TEXT, checkedById: 'hr1' })]);
    expect(run.totals.total.people).toBe(1);
  });

  it('is the same on a second run with the same inputs', () => {
    const people = [person('p1', 'a', '31111.11'), person('p2', 'b', '45678.9')];
    const first = computeRun(people, bySite, new Map());
    const second = computeRun(people, bySite, new Map());
    expect(second.totals).toEqual(first.totals);
    expect(second.payslips.map((p) => p.slip.net)).toEqual(first.payslips.map((p) => p.slip.net));
  });

  it('fails loudly rather than guess when a site has no rules', () => {
    expect(() => computeRun([person('p1', 'zzz', '30000')], bySite, new Map())).toThrow('No rules for site zzz');
  });
});
