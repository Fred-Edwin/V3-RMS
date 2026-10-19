import { describe, expect, it } from 'vitest';

import { approveBlock, approveWords, notYetReason } from './approve-view';

const month = (over: Record<string, unknown> = {}) => ({
  monthKey: '2026-09',
  state: 'TO_APPROVE' as const,
  needsYou: { clockOutFixes: 0, overtimeDecisions: 0, requestsWithManager: 0, daysToLookAt: 0, requestsWithHr: 0, total: 0 },
  kpis: { workedMinutes: 100, plannedMinutes: 100, headcount: 3, overtime: { recordedMinutes: 0, approvedMinutes: 0, partNotApprovedMinutes: 0, toDecideMinutes: 0 }, lateCount: 0, absentDays: 0 },
  ...over,
});

describe('why Approve cannot be used', () => {
  it('lets a month that has ended and has nothing open be signed', () => {
    expect(approveBlock(month())).toBeNull();
  });
  it('blocks with the count while things are undecided', () => {
    expect(approveBlock(month({ needsYou: { ...month().needsYou, total: 3 } }))).toBe('Decide the 3 things first.');
    expect(approveBlock(month({ needsYou: { ...month().needsYou, total: 1 } }))).toBe('Decide the 1 thing first.');
  });
  it('blocks an open month, an approved month and a month with nobody in it', () => {
    expect(approveBlock(month({ state: 'OPEN' }))).toBe('September has not ended yet.');
    expect(approveBlock(month({ state: 'APPROVED' }))).toBe('This month is already approved.');
    expect(approveBlock(month({ kpis: { ...month().kpis, headcount: 0 } }))).toBe('Nobody worked in September, so there is nothing to approve.');
  });
});

describe('the words', () => {
  it('maps the server codes to the spec sentences and passes any other through', () => {
    expect(approveWords('INVALID_PIN', '')).toBe('That PIN is not right.');
    expect(approveWords('CHANGED_UNDERNEATH', '')).toContain('Something changed while you were looking.');
    expect(approveWords('OTHER', 'The server says no.')).toBe('The server says no.');
  });
  it('gives the date reason for the open month', () => {
    expect(notYetReason('October', '2026-10-31', '2026-11-01')).toBe('October ends on 31 Oct. You can approve from 1 Nov.');
  });
});
