import { describe, expect, it } from 'vitest';
import { assertMayDecide, outcomesFor, planDecision, type DecisionFacts } from './decision-rules';

const notice = (extra: Partial<DecisionFacts> = {}): DecisionFacts => ({ status: 'APPEALED', level: 'WRITTEN_WARNING', issuerId: 'mgr', issuerRole: 'Branch Manager', personUserId: 'staff', ...extra });

describe('assertMayDecide', () => {
  it('HR decides a notice a manager issued', () => {
    expect(() => assertMayDecide({ id: 'hr', role: 'HR_MANAGER' }, notice())).not.toThrow();
  });

  it('the Director decides a notice HR issued, and only that', () => {
    expect(() => assertMayDecide({ id: 'dir', role: 'DIRECTOR' }, notice({ issuerRole: 'HR', issuerId: 'hr' }))).not.toThrow();
    expect(() => assertMayDecide({ id: 'dir', role: 'DIRECTOR' }, notice())).toThrowError(expect.objectContaining({ statusCode: 403, code: 'NOT_DECIDER' }));
    expect(() => assertMayDecide({ id: 'hr2', role: 'HR_MANAGER' }, notice({ issuerRole: 'HR', issuerId: 'hr' }))).toThrowError(expect.objectContaining({ code: 'NOT_DECIDER' }));
  });

  it('nobody decides a notice they issued or one about themself', () => {
    expect(() => assertMayDecide({ id: 'hr', role: 'HR_MANAGER' }, notice({ issuerId: 'hr' }))).toThrowError(expect.objectContaining({ statusCode: 403, code: 'SELF_DECISION' }));
    expect(() => assertMayDecide({ id: 'staff', role: 'HR_MANAGER' }, notice())).toThrowError(expect.objectContaining({ code: 'SELF_DECISION' }));
  });

  it('a manager or a system admin never decides', () => {
    expect(() => assertMayDecide({ id: 'x', role: 'MANAGER' }, notice())).toThrowError(expect.objectContaining({ code: 'NOT_DECIDER' }));
  });
});

describe('planDecision', () => {
  it('keep, reduce and withdraw an appealed notice', () => {
    expect(planDecision(notice(), 'KEEP')).toEqual({ move: 'KEEP', next: 'KEPT', targetLevel: null, viaAppeal: true });
    expect(planDecision(notice(), 'REDUCE_TO_VERBAL')).toEqual({ move: 'REDUCE', next: 'REPLACED', targetLevel: 'VERBAL_NOTE', viaAppeal: true });
    expect(planDecision(notice(), 'WITHDRAW')).toEqual({ move: 'WITHDRAW', next: 'WITHDRAWN', targetLevel: null, viaAppeal: true });
  });

  it('a final warning can be reduced to written or verbal; a written one only to verbal', () => {
    expect(planDecision(notice({ level: 'FINAL_WRITTEN_WARNING' }), 'REDUCE_TO_WRITTEN').targetLevel).toBe('WRITTEN_WARNING');
    expect(() => planDecision(notice({ level: 'WRITTEN_WARNING' }), 'REDUCE_TO_WRITTEN')).toThrowError(expect.objectContaining({ statusCode: 422, code: 'REDUCE_NOT_POSSIBLE' }));
    expect(() => planDecision(notice({ level: 'VERBAL_NOTE' }), 'REDUCE_TO_VERBAL')).toThrowError(expect.objectContaining({ code: 'REDUCE_NOT_POSSIBLE' }));
  });

  it('HR changing a notice with no appeal has no Keep (C19)', () => {
    const live = notice({ status: 'SIGNED' });
    expect(() => planDecision(live, 'KEEP')).toThrowError(expect.objectContaining({ statusCode: 409, code: 'NOTHING_TO_DECIDE' }));
    expect(planDecision(live, 'WITHDRAW')).toMatchObject({ next: 'WITHDRAWN', viaAppeal: false });
    expect(planDecision(live, 'REDUCE_TO_VERBAL')).toMatchObject({ next: 'REPLACED', viaAppeal: false });
  });

  it('a second decision on a settled notice answers ALREADY_DECIDED', () => {
    for (const status of ['REPLACED', 'WITHDRAWN'] as const) {
      expect(() => planDecision(notice({ status }), 'WITHDRAW')).toThrowError(expect.objectContaining({ statusCode: 409, code: 'ALREADY_DECIDED' }));
    }
  });

  it('an ended notice can only be withdrawn', () => {
    expect(planDecision(notice({ status: 'ENDED' }), 'WITHDRAW').next).toBe('WITHDRAWN');
    expect(() => planDecision(notice({ status: 'ENDED' }), 'REDUCE_TO_VERBAL')).toThrowError(expect.objectContaining({ code: 'INVALID_TRANSITION' }));
  });
});

describe('outcomesFor', () => {
  it('lists what the dialog offers', () => {
    expect(outcomesFor({ status: 'APPEALED', level: 'FINAL_WRITTEN_WARNING' })).toEqual(['KEEP', 'REDUCE_TO_WRITTEN', 'REDUCE_TO_VERBAL', 'WITHDRAW']);
    expect(outcomesFor({ status: 'APPEALED', level: 'WRITTEN_WARNING' })).toEqual(['KEEP', 'REDUCE_TO_VERBAL', 'WITHDRAW']);
    expect(outcomesFor({ status: 'SIGNED', level: 'WRITTEN_WARNING' })).toEqual(['REDUCE_TO_VERBAL', 'WITHDRAW']);
    expect(outcomesFor({ status: 'ENDED', level: 'WRITTEN_WARNING' })).toEqual(['WITHDRAW']);
    expect(outcomesFor({ status: 'WITHDRAWN', level: 'WRITTEN_WARNING' })).toEqual([]);
  });
});
