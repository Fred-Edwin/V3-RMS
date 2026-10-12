import { describe, expect, it } from 'vitest';

import { farFromCount } from './correction-guard';

describe('a correction far from the count', () => {
  it('flags more than five times the count', () => {
    expect(farFromCount(8, 101234)).toBe(true);
    expect(farFromCount(8, 41)).toBe(true);
    expect(farFromCount(8, 40)).toBe(false);
    expect(farFromCount(8, 7)).toBe(false);
  });
  it('flags a change of more than KES 100,000 when the value is known', () => {
    // 10 units worth KES 50,000 = KES 5,000 each: +15 units is KES 75,000, +30 units is KES 150,000.
    expect(farFromCount(10, 25, '50000')).toBe(false);
    expect(farFromCount(10, 40, '50000')).toBe(true);
    expect(farFromCount(40, 70, '200000')).toBe(true);
  });
  it('does not guess from a count of zero', () => {
    expect(farFromCount(0, 500)).toBe(false);
    expect(farFromCount(0, 500, '0')).toBe(false);
  });
});
