import { describe, expect, it } from 'vitest';
import { payChangeMonthRange, payChangeWhere } from './employees-pay-filter';

describe('Pay change lists on Employees', () => {
  it('counts "this month" from the 1st to 31 days later, the same range the Accountant card uses', () => {
    const { from, to } = payChangeMonthRange(new Date('2026-10-22T00:00:00Z'));
    expect(from.toISOString().slice(0, 10)).toBe('2026-10-01');
    expect(to.toISOString().slice(0, 10)).toBe('2026-11-01');
  });

  it('"waiting" is only pending changes; "month" is pending or approved starting in the range', () => {
    expect(payChangeWhere('waiting', new Date('2026-10-22T00:00:00Z'))).toEqual({ payChanges: { some: { status: 'PENDING' } } });
    const month = payChangeWhere('month', new Date('2026-10-22T00:00:00Z'));
    expect(JSON.stringify(month)).toContain('"in":["PENDING","APPROVED"]');
  });
});
