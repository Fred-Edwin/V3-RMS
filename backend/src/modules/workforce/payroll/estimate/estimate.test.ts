import { describe, expect, it } from 'vitest';
import { estimateMonth, type EstimateInput, type EstimatePerson } from './estimate';

const person = (over: Partial<EstimatePerson> = {}): EstimatePerson => ({
  employeeId: 'e1',
  siteId: 's1',
  payType: 'MONTHLY_SALARY',
  monthSegments: [{ amount: '30000', days: 31 }],
  toDateSegments: [{ amount: '30000', days: 19 }],
  amountInForce: '30000',
  standardWeekHours: '48',
  overtimeEligible: true,
  authorisedOvertimeMinutes: 0,
  undecidedOvertimeMinutes: 0,
  absentDaysToDate: 0,
  ...over,
});

const input = (people: EstimatePerson[], over: Partial<EstimateInput> = {}): EstimateInput => ({
  daysInMonth: 31,
  daysElapsed: 19,
  unpaidDayDivisor: 30,
  ordinaryMultiplier: '1.5',
  people,
  lastMonthGross: new Map(),
  ...over,
});

describe('estimateMonth', () => {
  it('earns by days employed so far and expects the whole month', () => {
    const out = estimateMonth(input([person()]));
    expect(out.earnedSoFar).toBe('18387.10'); // 30,000 × 19 ÷ 31
    expect(out.expectedGross).toBe('30000.00');
    expect(out.bySite).toEqual([{ siteId: 's1', people: 1, earned: '18387.10', expected: '30000.00', vsLast: null }]);
  });

  it('prorates a joiner and a leaver inside the month', () => {
    const joiner = person({ employeeId: 'j', monthSegments: [{ amount: '31000', days: 10 }], toDateSegments: [{ amount: '31000', days: 0 }] });
    const leaver = person({ employeeId: 'l', monthSegments: [{ amount: '31000', days: 15 }], toDateSegments: [{ amount: '31000', days: 15 }] });
    const out = estimateMonth(input([joiner, leaver]));
    expect(out.expectedGross).toBe('25000.00'); // 31,000 × 10 ÷ 31 + 31,000 × 15 ÷ 31
    expect(out.earnedSoFar).toBe('15000.00');
  });

  it('adds authorised overtime and scales it to the month, minus unpaid absence so far', () => {
    const out = estimateMonth(input([person({ authorisedOvertimeMinutes: 600, absentDaysToDate: 1 })]));
    // 10 h × (30,000 ÷ 208) × 1.5 = 2,163.46 so far; ×31÷19 = 3,529.86 for the month; absence 1,000
    expect(out.earnedSoFar).toBe('19550.56'); // 18,387.10 + 2,163.46 − 1,000
    expect(out.expectedGross).toBe('32529.86'); // 30,000 + 3,529.86 − 1,000
  });

  it('values overtime still to decide in the callout and keeps it out of the totals', () => {
    const out = estimateMonth(input([person({ undecidedOvertimeMinutes: 135 })]));
    expect(out.toDecideOvertime).toEqual({ minutes: 135, value: '486.78' }); // 2.25 h × 144.2308 × 1.5
    expect(out.expectedGross).toBe('30000.00');
  });

  it('counts a person with no pay profile, leaves out a daily-rate person, and does not divide by zero on day 1', () => {
    const none = person({ employeeId: 'n', amountInForce: null, monthSegments: [] });
    const daily = person({ employeeId: 'd', payType: 'DAILY_RATE' });
    const out = estimateMonth(input([none, daily, person({ authorisedOvertimeMinutes: 60 })], { daysElapsed: 0 }));
    expect(out.missingProfiles).toBe(1);
    expect(out.notEstimated).toBe(1);
    expect(out.expectedGross).toBe('30000.00');
  });

  it('compares with last month only for sites that were on the new system, keeping the sign', () => {
    const a = person({ siteId: 'a' });
    const b = person({ employeeId: 'b', siteId: 'b' });
    const out = estimateMonth(input([a, b], { lastMonthGross: new Map([['a', '29900.00']]) }));
    expect(out.bySite.find((s) => s.siteId === 'a')?.vsLast).toBe('100.00');
    expect(out.bySite.find((s) => s.siteId === 'b')?.vsLast).toBeNull();
    expect(out.vsLastMonth).toEqual({ amount: '100.00', percent: '0.3' });
    const down = estimateMonth(input([a], { lastMonthGross: new Map([['a', '30100.00']]) }));
    expect(down.vsLastMonth).toEqual({ amount: '-100.00', percent: '-0.3' });
    expect(estimateMonth(input([a])).vsLastMonth).toBeNull();
  });
});
