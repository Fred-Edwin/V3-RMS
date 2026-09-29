import { describe, expect, it } from 'vitest';

import { getItemFormErrors, normalizeDecimalInput, validateOptionalPositiveDecimal } from './item-form-validation';

describe('validateOptionalPositiveDecimal', () => {
  it.each(['', '  ', '25', '12.5', '0.25', '12345678', '1.2345'])('accepts %j', (value) => {
    expect(validateOptionalPositiveDecimal(value)).toBeNull();
  });

  it.each(['0', '0.0', '-3', '-0.5'])('rejects %j as not greater than 0', (value) => {
    expect(validateOptionalPositiveDecimal(value)).toBe('Enter a number greater than 0.');
  });

  it.each(['abc', '1 bag = 25 kg', '25 kg', '1,5', '1.23456', '123456789', '.5', '2.'])(
    'rejects %j with a format message (never silently dropped)',
    (value) => {
      expect(validateOptionalPositiveDecimal(value)).toMatch(/Enter a number like 25 or 12\.5/);
    },
  );
});

describe('normalizeDecimalInput', () => {
  it('trims trailing zeros the API adds, keeping the same number', () => {
    expect(normalizeDecimalInput('25.0000')).toBe('25');
    expect(normalizeDecimalInput('12.5000')).toBe('12.5');
    expect(normalizeDecimalInput('120.0500')).toBe('120.05');
    expect(normalizeDecimalInput('0.5000')).toBe('0.5');
  });

  it('leaves whole numbers and blanks alone', () => {
    expect(normalizeDecimalInput('100')).toBe('100');
    expect(normalizeDecimalInput('10')).toBe('10');
    expect(normalizeDecimalInput(null)).toBe('');
    expect(normalizeDecimalInput(undefined)).toBe('');
  });

  it('round-trips through validation for every value the API can hand back', () => {
    for (const apiValue of ['25.0000', '12.5000', '0.0001', '99999999', '1.2000']) {
      expect(validateOptionalPositiveDecimal(normalizeDecimalInput(apiValue))).toBeNull();
    }
  });
});

describe('getItemFormErrors', () => {
  it('reports each invalid field and nothing for valid or empty ones', () => {
    expect(getItemFormErrors({ conversion: '25', packSize: '' })).toEqual({});
    expect(getItemFormErrors({ conversion: '-3', packSize: 'x' })).toEqual({
      conversion: 'Enter a number greater than 0.',
      packSize: expect.stringMatching(/Enter a number like/),
    });
  });
});
