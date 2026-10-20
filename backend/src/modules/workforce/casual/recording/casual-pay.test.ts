import { describe, expect, it } from 'vitest';
import { casualDayPay, payWorking, sumAmounts } from './casual-pay';

describe('casual day pay (PD22)', () => {
  it('a full 8 hour day is exactly the day rate', () => {
    expect(casualDayPay('900', 480)).toBe('900.00');
    expect(casualDayPay('900.00', 480)).toBe('900.00');
  });

  it('a shorter day pays rate × hours ÷ 8', () => {
    expect(casualDayPay('900', 240)).toBe('450.00'); // 4 h
    expect(casualDayPay('800', 360)).toBe('600.00'); // 6 h
  });

  it('hours over 8 pay one eighth of the rate each', () => {
    expect(casualDayPay('900', 540)).toBe('1013.00'); // 9 h = 900 + 112.50 = 1012.50, half up
    expect(casualDayPay('800', 600)).toBe('1000.00'); // 10 h = 800 + 2 × 100
  });

  it('rounds half up to the whole shilling', () => {
    expect(casualDayPay('900', 1)).toBe('2.00'); // 1.875 -> 2
    expect(casualDayPay('900', 15)).toBe('28.00'); // 28.125 -> 28
    expect(casualDayPay('1', 240)).toBe('1.00'); // 0.5 -> 1 (half up)
    expect(casualDayPay('1', 239)).toBe('0.00'); // 0.498 -> 0
  });

  it('a 16 hour day is twice the day rate', () => {
    expect(casualDayPay('900', 960)).toBe('1800.00');
  });

  it('a rate with cents is rounded the same way', () => {
    expect(casualDayPay('899.50', 480)).toBe('900.00'); // 899.50 -> 900 (half up)
    expect(casualDayPay('899.49', 480)).toBe('899.00');
  });

  it('refuses a minute count that is not a positive whole number', () => {
    expect(() => casualDayPay('900', 0)).toThrow(RangeError);
    expect(() => casualDayPay('900', -5)).toThrow(RangeError);
    expect(() => casualDayPay('900', 7.5)).toThrow(RangeError);
  });

  it('shows the working', () => {
    expect(payWorking('900', 480)).toBe('8 h × KES 900 ÷ 8 = 900');
    expect(payWorking('900.00', 270)).toBe('4.5 h × KES 900 ÷ 8 = 506');
  });

  it('adds amounts without a float', () => {
    expect(sumAmounts(['900.00', '1013.00', '0.00'])).toBe('1913.00');
    expect(sumAmounts([])).toBe('0.00');
  });
});
