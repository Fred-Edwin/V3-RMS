import { describe, expect, it } from 'vitest';
import type { PayChangeRow } from '../../../_shared/types/people-types';
import { askedAgo, overlappingChange, payDifference, payNowSince } from '../pay-difference';

const row = (over: Partial<PayChangeRow>): PayChangeRow => ({
  id: 'c', employeeId: 'e', employeeName: 'Joy Chebet', amount: '22500.00', effectiveFrom: '2026-01-01', startsInFuture: false, reason: 'HIRING', status: 'APPROVED',
  requestedByName: null, requestedByPosition: null, requestedBySite: null, requestedOn: '2026-01-01', decidedByName: null, decidedOn: null, decisionNote: null, ...over,
});

describe('pay difference', () => {
  it('shows the amount and a percentage to one decimal', () => {
    expect(payDifference('22500.00', '26250')).toEqual({ amount: '+ KES 3,750', percent: '16.7% more', direction: 'up' });
    expect(payDifference('20000', '19000')).toEqual({ amount: '− KES 1,000', percent: '5% less', direction: 'down' });
  });
  it('has nothing to compare against with no pay now', () => {
    expect(payDifference(null, '26250')).toBeNull();
  });
});

describe('pay now and overlap', () => {
  const history = [row({ id: 'a' }), row({ id: 'b', amount: '26000.00', effectiveFrom: '2026-11-01', startsInFuture: true })];
  it('finds the pay in force and since when', () => {
    expect(payNowSince(history, '2026-10-22')).toEqual({ amount: '22500.00', since: '2026-01-01' });
  });
  it('warns when the new day is on or before an agreed future change', () => {
    expect(overlappingChange(history, '2026-10-30')?.id).toBe('b');
    expect(overlappingChange(history, '2026-11-02')).toBeNull();
  });
  it('says how long ago', () => {
    expect(askedAgo('2026-10-22', '2026-10-22')).toBe('today');
    expect(askedAgo('2026-10-19', '2026-10-22')).toBe('3 days ago');
  });
});
