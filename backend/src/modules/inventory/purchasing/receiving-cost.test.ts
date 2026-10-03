import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { costPerUsageUnit } from './receiving-cost';

const D = (v: string | number) => new Prisma.Decimal(v);

describe('costPerUsageUnit', () => {
  it('converts a per-bag price to per-kg (4 bags x 25 kg at 12,000 -> 480)', () => {
    expect(costPerUsageUnit(D(12000), D(4), D(100)).toString()).toBe('480');
  });

  it('is the price itself when there is no conversion (buy qty == usage qty)', () => {
    expect(costPerUsageUnit(D(85), D(6), D(6)).toString()).toBe('85');
  });

  it('rounds to 4 decimal places', () => {
    expect(costPerUsageUnit(D(2200), D(4), D(48)).toString()).toBe('183.3333');
  });

  it('falls back to the price on a zero quantity rather than dividing by zero', () => {
    expect(costPerUsageUnit(D(100), D(0), D(0)).toString()).toBe('100');
  });
});
