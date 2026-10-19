import { describe, expect, it } from 'vitest';
import { assertNotPreparer, preparerIds, type PreparerFacts } from './preparers';

const none: PreparerFacts = { sentById: null, runByIds: [], checkedByIds: [], adjustmentByIds: [], leftOutByIds: [] };

describe('the approver is never a preparer (E1, P20)', () => {
  it('lets someone who did nothing approve, including when the system calculated', () => {
    expect(() => assertNotPreparer('acc1', { ...none, sentById: 'hr1', runByIds: [null, 'hr1'], checkedByIds: ['hr1', 'hr2'] })).not.toThrow();
  });

  it.each([
    ['sent it', { sentById: 'acc1' }],
    ['recalculated it', { runByIds: [null, 'acc1'] }],
    ['ticked a line', { checkedByIds: ['hr1', 'acc1'] }],
    ['added a line', { adjustmentByIds: ['acc1'] }],
    ['removed a line', { adjustmentByIds: [null, 'acc1'] }],
    ['left someone out', { leftOutByIds: ['acc1'] }],
  ] as const)('refuses a person who %s', (_what, over) => {
    expect(() => assertNotPreparer('acc1', { ...none, ...over })).toThrowError(expect.objectContaining({ statusCode: 403, code: 'SELF_APPROVAL' }));
  });

  it('lists every preparer once and ignores the system', () => {
    expect([...preparerIds({ sentById: 'hr1', runByIds: [null, 'hr1', 'hr2'], checkedByIds: ['hr2', null], adjustmentByIds: [], leftOutByIds: ['hr3'] })].sort()).toEqual(['hr1', 'hr2', 'hr3']);
  });
});
