// kept for the branch-day refactor: delete when branch day is redone
import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { isDirectorAlert, lineVarianceValue, isReasonRequired, lineVariance, shortName } from './count-calc';

const D = (v: number) => new Prisma.Decimal(v);

describe('count calc', () => {
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
    // Receiving used to store the per-bag price (12,000) here, valuing the same gap at 12,000.
    expect(lineVarianceValue(D(-1), D(480))!.toString()).toBe('-480');
    expect(isDirectorAlert(D(-1), D(480), 5000)).toBe(false);
  });

  it('shortName', () => {
    expect(shortName('Joseph Mwangi')).toBe('J. Mwangi');
    expect(shortName('Cher')).toBe('Cher');
  });
});
