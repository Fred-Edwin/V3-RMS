import { describe, expect, it } from 'vitest';
import {
  CARRIED_FIELDS,
  carryForwardValues,
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
