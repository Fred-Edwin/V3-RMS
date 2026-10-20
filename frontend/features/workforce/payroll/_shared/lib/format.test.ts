import { describe, expect, it } from 'vitest';

import { dayMonth, dayOfDate, isZero, kes, kesSigned, monthName, people } from './format';

describe('money', () => {
  it('shows whole shillings with thousands separators', () => {
    expect(kes('3168500.00')).toBe('3,168,500');
    expect(kes('934120.49')).toBe('934,120');
    expect(kes('934120.50')).toBe('934,121');
  });
  it('shows zero and nothing as 0', () => {
    expect(kes('0.00')).toBe('0');
    expect(kes(null)).toBe('0');
    expect(isZero('0.20')).toBe(true);
  });
  it('keeps the sign and adds a plus for a gain', () => {
    expect(kes('-205.00')).toBe('-205');
    expect(kesSigned('205.00')).toBe('+205');
    expect(kesSigned('-205.00')).toBe('-205');
    expect(kesSigned('0.00')).toBe('0');
  });
  it('does not lose digits on a very large amount', () => {
    expect(kes('12345678901234.99')).toBe('12,345,678,901,235');
  });
});

describe('words', () => {
  it('names a month and a day', () => {
    expect(monthName('2026-09')).toBe('September');
    expect(dayOfDate('2026-10-01')).toBe('1 Oct');
    expect(dayMonth('2026-10-19T09:05:00.000Z')).toBe('19 Oct');
  });
  it('counts people', () => {
    expect(people(1)).toBe('1 person');
    expect(people(86)).toBe('86 people');
  });
});
