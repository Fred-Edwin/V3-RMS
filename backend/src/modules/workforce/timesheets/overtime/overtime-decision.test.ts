import { describe, expect, it } from 'vitest';
import { overtimeDecisionBody } from './overtime-validators';
import { decisionOutcome, nextOvertime, partRange } from './overtime-plan';

const pending = { needsMinutes: 35, autoMinutes: 0 };

describe('part-approved overtime (D3)', () => {
  it('approve all grants every minute that needed a decision', () => {
    expect(decisionOutcome(pending, 'APPROVE_ALL')).toEqual({ status: 'APPROVED', authorisedMinutes: 35, grantedMinutes: 35 });
  });
  it('the service tail that was covered by itself stays authorised either way', () => {
    const withTail = { needsMinutes: 35, autoMinutes: 20 };
    expect(decisionOutcome(withTail, 'APPROVE_ALL')).toMatchObject({ authorisedMinutes: 55 });
    expect(decisionOutcome(withTail, 'DECLINE')).toEqual({ status: 'DECLINED', authorisedMinutes: 20, grantedMinutes: 0 });
    expect(decisionOutcome(withTail, 'APPROVE_PART', 15)).toEqual({ status: 'APPROVED_PART', authorisedMinutes: 35, grantedMinutes: 15 });
  });
  it('part moves in steps of 5 from 5 up to the extra minus 5', () => {
    expect(partRange(35)).toEqual({ min: 5, max: 30 });
    expect(partRange(37)).toEqual({ min: 5, max: 30 });
    expect(partRange(10)).toEqual({ min: 5, max: 5 });
    expect(partRange(9)).toBeNull();
    expect(decisionOutcome(pending, 'APPROVE_PART', 20)).toEqual({ status: 'APPROVED_PART', authorisedMinutes: 20, grantedMinutes: 20 });
    expect(decisionOutcome(pending, 'APPROVE_PART', 5)).not.toBeNull();
    expect(decisionOutcome(pending, 'APPROVE_PART', 30)).not.toBeNull();
  });
  it('refuses a part outside the range, off the step, or missing', () => {
    for (const minutes of [0, 3, 4, 17, 31, 35, 40, -5]) expect(decisionOutcome(pending, 'APPROVE_PART', minutes)).toBeNull();
    expect(decisionOutcome(pending, 'APPROVE_PART')).toBeNull();
    expect(decisionOutcome({ needsMinutes: 5, autoMinutes: 0 }, 'APPROVE_PART', 5)).toBeNull(); // 5 minutes cannot be split
  });
  it('keeps a part answer while the minutes are the same, and asks again when they changed', () => {
    const stored = { status: 'APPROVED_PART' as const, rawMinutes: 35, needsMinutes: 35, authorisedMinutes: 20 };
    const figures = { rawMinutes: 35, serviceTailMinutes: 0, autoMinutes: 0, needsMinutes: 35, openWorkAtEnd: false };
    expect(nextOvertime(stored, figures)).toEqual({ status: 'APPROVED_PART', authorisedMinutes: 20, clearDecision: false });
    expect(nextOvertime(stored, { ...figures, rawMinutes: 50, needsMinutes: 50 })).toMatchObject({ status: 'PENDING', clearDecision: true });
  });
});

describe('the overtime decision body', () => {
  const base = { pin: '1234', version: 3 };
  it('accepts all with no reason, part with minutes and a reason, none with a reason', () => {
    expect(overtimeDecisionBody.safeParse({ ...base, decision: 'APPROVE_ALL' }).success).toBe(true);
    expect(overtimeDecisionBody.safeParse({ ...base, decision: 'APPROVE_PART', approvedMinutes: 20, reason: 'Only the rush' }).success).toBe(true);
    expect(overtimeDecisionBody.safeParse({ ...base, decision: 'DECLINE', reason: 'No activity recorded' }).success).toBe(true);
  });
  it('needs five characters of reason for part or none, minutes only for part, a 4 digit PIN and the version', () => {
    expect(overtimeDecisionBody.safeParse({ ...base, decision: 'DECLINE', reason: 'no' }).success).toBe(false);
    expect(overtimeDecisionBody.safeParse({ ...base, decision: 'APPROVE_PART', reason: 'Only the rush' }).success).toBe(false);
    expect(overtimeDecisionBody.safeParse({ ...base, decision: 'APPROVE_ALL', approvedMinutes: 10 }).success).toBe(false);
    expect(overtimeDecisionBody.safeParse({ ...base, decision: 'APPROVE_ALL', pin: '12a4' }).success).toBe(false);
    expect(overtimeDecisionBody.safeParse({ decision: 'APPROVE_ALL', pin: '1234' }).success).toBe(false);
    expect(overtimeDecisionBody.safeParse({ ...base, decision: 'DECLINE', reason: 'x'.repeat(281) }).success).toBe(false);
  });
});
