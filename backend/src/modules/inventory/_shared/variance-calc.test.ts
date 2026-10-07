import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import {
  isDirectorAlert,
  isReasonRequired,
  isRepeatShortfall,
  judgeLine,
  lineVariance,
  lineVarianceValue,
  shortName,
  shortStreak,
} from './variance-calc';

const D = (v: number | string) => new Prisma.Decimal(v);

// The old count-calc cases, ported.
describe('variance calc (ported from count-calc)', () => {
  it('variance is counted − expected, null when either side is missing', () => {
    expect(lineVariance(D(18), D(27))!.toString()).toBe('-9');
    expect(lineVariance(null, D(27))).toBeNull();
  });

  it('reason is required at or above the threshold on |value|; never for a zero variance; 0 = always', () => {
    expect(isReasonRequired(D(-9), D(90), 500)).toBe(true); // 810
    expect(isReasonRequired(D(-5), D(100), 500)).toBe(true); // exactly 500
    expect(isReasonRequired(D(-4), D(100), 500)).toBe(false); // 400
    expect(isReasonRequired(D(3), D(200), 500)).toBe(true); // overage counts too (600)
    expect(isReasonRequired(D(0), D(200), 0)).toBe(false);
    expect(isReasonRequired(D(-1), D(1), 0)).toBe(true);
  });

  it('a 1 kg gap at the per-usage-unit cost (KES 480/kg) is valued at 480 and does not alert the Director', () => {
    expect(lineVarianceValue(D(-1), D(480))!.toString()).toBe('-480');
    expect(isDirectorAlert(D(-1), D(480), 5000)).toBe(false);
    expect(isDirectorAlert(D(-11), D(480), 5000)).toBe(true); // 5,280
  });

  it('shortName', () => {
    expect(shortName('Joseph Mwangi')).toBe('J. Mwangi');
    expect(shortName('Cher')).toBe('Cher');
  });
});

describe('judgeLine (contract §5.4): range KES 500, at most 5 %', () => {
  const judge = (counted: number | null, expected: number, unitCost: number, rangeKes = 500, rangePercent = 5) =>
    judgeLine({ counted: counted === null ? null : D(counted), expected: D(expected), unitCost: D(unitCost), rangeKes, rangePercent });

  // [name, counted, expected, unitCost, result]
  const table: [string, number | null, number, number, string][] = [
    ['no number (skipped) is NOT_COUNTED', null, 10, 100, 'NOT_COUNTED'],
    ['no number and no stock is still NOT_COUNTED', null, 0, 100, 'NOT_COUNTED'],
    ['the same figure MATCHES', 10, 10, 100, 'MATCHES'],
    ['a zero count of nothing MATCHES', 0, 0, 100, 'MATCHES'],
    ['small gap, small value: WITHIN_RANGE', 99, 100, 50, 'WITHIN_RANGE'], // 1 %, KES 50
    ['short and over by value only: EXCEEDS', 90, 100, 100, 'EXCEEDS'], // 10 %, KES 1,000
    ['over the percent but inside the KES: EXCEEDS (Paper step 13, "Over 5%")', 94, 100, 1, 'EXCEEDS'], // 6 %, KES 6
    ['inside the percent but over the KES: EXCEEDS', 995, 1000, 200, 'EXCEEDS'], // 0.5 %, KES 1,000
    ['overage is judged the same way as shortage', 120, 100, 100, 'EXCEEDS'], // 20 %, KES 2,000
    ['a tie on the percent is within range', 95, 100, 1, 'WITHIN_RANGE'], // exactly 5 %, KES 5
    ['a tie on the KES is within range', 99, 100, 500, 'WITHIN_RANGE'], // 1 %, exactly KES 500
    ['one cent over the KES tie exceeds', 99, 100, 500.01, 'EXCEEDS'],
    ['expected 0 and a number: any difference exceeds', 1, 0, 1, 'EXCEEDS'],
    ['expected below 0 and a number: any difference exceeds', 2, -3, 1, 'EXCEEDS'],
    ['expected 0 and a zero-cost item still exceeds (no percent exists)', 1, 0, 0, 'EXCEEDS'],
    ['a free item inside the percent is within range', 99, 100, 0, 'WITHIN_RANGE'],
  ];

  for (const [name, counted, expected, unitCost, result] of table) {
    it(name, () => {
      expect(judge(counted, expected, unitCost).result).toBe(result);
    });
  }

  it('returns difference, value (2 dp) and percent (2 dp)', () => {
    const j = judge(90, 120, 33.3333);
    expect(j.difference!.toString()).toBe('-30');
    expect(j.value!.toString()).toBe('-1000');
    expect(j.percent!.toString()).toBe('25');
    const k = judge(97, 98, 7.777);
    expect(k.value!.toString()).toBe('-7.78');
    expect(k.percent!.toString()).toBe('1.02');
  });

  it('NOT_COUNTED has no figures; expected ≤ 0 has no percent', () => {
    expect(judge(null, 10, 100)).toMatchObject({ difference: null, value: null, percent: null });
    expect(judge(2, 0, 100).percent).toBeNull();
  });

  it('judges against whatever settings are passed in (a Decimal percent too)', () => {
    expect(judge(90, 100, 1, 500, 10).result).toBe('WITHIN_RANGE'); // exactly 10 %
    expect(judge(90, 100, 1, 500, 9.99).result).toBe('EXCEEDS');
    expect(
      judgeLine({ counted: D(90), expected: D(100), unitCost: D(1), rangeKes: 5, rangePercent: D('10.00') }).result,
    ).toBe('EXCEEDS'); // KES 10 over a KES 5 range
  });
});

describe('shortStreak', () => {
  const ds = (...values: number[]) => values.map((v) => D(v));

  it('counts consecutive short counts, newest first, this one included', () => {
    expect(shortStreak(ds(-2), true)).toBe(1);
    expect(shortStreak(ds(-2, -1, -5), true)).toBe(3);
    expect(shortStreak(ds(-2, -1, 0, -5), true)).toBe(2);
    expect(shortStreak(ds(-2, 3, -5, -5), true)).toBe(1);
  });

  it('is 0 when this count is not short (matched or over)', () => {
    expect(shortStreak(ds(0, -1, -1), true)).toBe(0);
    expect(shortStreak(ds(2, -1, -1), true)).toBe(0);
    expect(shortStreak([], true)).toBe(0);
  });

  it('is 0 when the repeat-shortfall setting is off', () => {
    expect(shortStreak(ds(-2, -1, -5), false)).toBe(0);
  });

  it('a streak of 3 or more is a repeat shortfall', () => {
    expect(isRepeatShortfall(2)).toBe(false);
    expect(isRepeatShortfall(3)).toBe(true);
    expect(isRepeatShortfall(7)).toBe(true);
  });
});
