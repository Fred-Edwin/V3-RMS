import { describe, expect, it } from 'vitest';
import {
  CARRIED_FIELDS,
  carryForwardValues,
  isAllZeroSource,
  isBlankMoney,
  priorPeriod,
  type CarryForwardSource,
} from './payroll-carry-forward';

describe('priorPeriod', () => {
  it('returns the immediately preceding month by default', () => {
    expect(priorPeriod('2026-07')).toBe('2026-06');
  });

  it('rolls back across a year boundary', () => {
    expect(priorPeriod('2026-01')).toBe('2025-12');
  });

  it('supports looking back multiple months', () => {
    expect(priorPeriod('2026-07', 3)).toBe('2026-04');
    expect(priorPeriod('2026-02', 3)).toBe('2025-11');
  });
});

describe('carryForwardValues', () => {
  const prior: CarryForwardSource = {
    grossPay: '80000.00',
    paye: '12000.00',
    sha: '2200.00',
    nssfTier1: '480.00',
    nssfTier2: '1740.00',
    housingLevy: '1200.00',
    allowances: '5000.00',
  };

  it('carries recurring items forward unchanged', () => {
    const result = carryForwardValues(prior);
    for (const field of CARRIED_FIELDS) {
      expect(result[field]).toBe(prior[field] ?? '');
    }
  });

  it('blanks variable, month-specific items', () => {
    const result = carryForwardValues(prior);
    expect(result.overtime).toBe('');
    expect(result.advance).toBe('');
    expect(result.incentives).toBe('');
    expect(result.ncnsAmount).toBe('');
    expect(result.ncnsNote).toBe('');
  });

  it('treats a missing allowance as blank rather than "null"', () => {
    const result = carryForwardValues({ ...prior, allowances: null });
    expect(result.allowances).toBe('');
  });
});

describe('isBlankMoney', () => {
  it('treats empty, whitespace, null and undefined as blank', () => {
    expect(isBlankMoney('')).toBe(true);
    expect(isBlankMoney('   ')).toBe(true);
    expect(isBlankMoney(null)).toBe(true);
    expect(isBlankMoney(undefined)).toBe(true);
  });

  it('treats zero-valued strings as blank', () => {
    expect(isBlankMoney('0')).toBe(true);
    expect(isBlankMoney('0.00')).toBe(true);
    expect(isBlankMoney('-0')).toBe(true);
  });

  it('treats a real figure as not blank', () => {
    expect(isBlankMoney('80000.00')).toBe(false);
    expect(isBlankMoney('0.01')).toBe(false);
  });
});

describe('isAllZeroSource', () => {
  const zeroed: CarryForwardSource = {
    grossPay: '0.00',
    paye: '0.00',
    sha: '0.00',
    nssfTier1: '0.00',
    nssfTier2: '0.00',
    housingLevy: '0.00',
    allowances: '0.00',
  };

  it('is true for a payslip left all-zero (e.g. published then reverted)', () => {
    expect(isAllZeroSource(zeroed)).toBe(true);
  });

  it('is false as soon as one recurring field has a real figure', () => {
    expect(isAllZeroSource({ ...zeroed, grossPay: '80000.00' })).toBe(false);
  });
});
