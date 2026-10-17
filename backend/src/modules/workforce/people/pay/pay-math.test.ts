import { describe, expect, it } from 'vitest';
import { fromCents, hourlyEquivalent, toCents } from './pay-math';

describe('pay maths', () => {
  it('moves between money strings and cents without floats', () => {
    expect(toCents('28000')).toBe(2800000n);
    expect(toCents('28000.5')).toBe(2800050n);
    expect(toCents('0.07')).toBe(7n);
    expect(fromCents(2800050n)).toBe('28000.50');
    expect(fromCents(7n)).toBe('0.07');
    expect(() => toCents('12.345')).toThrow(RangeError);
    expect(() => toCents('-5')).toThrow(RangeError);
  });

  it('monthly: amount / (week hours x 52 / 12), half up', () => {
    // 28,000 / (48 x 52 / 12 = 208) = 134.6153...
    expect(hourlyEquivalent('MONTHLY_SALARY', '28000', '48', null)).toBe('134.62');
    // 20,800 / 208 = 100 exactly
    expect(hourlyEquivalent('MONTHLY_SALARY', '20800', '48', null)).toBe('100.00');
    // 7.5-hour decimals work: 30,000 / (45.5 x 52 / 12 = 197.1666) = 152.16...
    expect(hourlyEquivalent('MONTHLY_SALARY', '30000', '45.5', null)).toBe('152.16');
  });

  it('daily: amount / day hours', () => {
    expect(hourlyEquivalent('DAILY_RATE', '1200', null, '8')).toBe('150.00');
    expect(hourlyEquivalent('DAILY_RATE', '1000', null, '7.5')).toBe('133.33');
  });

  it('is null until the hours (or the amount) are set', () => {
    expect(hourlyEquivalent('MONTHLY_SALARY', '28000', null, '8')).toBeNull();
    expect(hourlyEquivalent('DAILY_RATE', '1200', '48', null)).toBeNull();
    expect(hourlyEquivalent('MONTHLY_SALARY', null, '48', null)).toBeNull();
    expect(hourlyEquivalent('MONTHLY_SALARY', '28000', '0', null)).toBeNull();
  });
});
