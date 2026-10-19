import { describe, expect, it } from 'vitest';
import { nextOvertime, overtimeLimits } from './overtime-plan';

const figures = { rawMinutes: 40, serviceTailMinutes: 15, autoMinutes: 15, needsMinutes: 25, openWorkAtEnd: true };

describe('overtime limits', () => {
  it('inside the weekly cap and no budget is inside the allowance', () => {
    expect(overtimeLimits({ weekMinutes: 90, needsMinutes: 25, branchUsedMinutes: 500, rules: { weeklyCapMinutes: 120, branchBudgetMinutesPerPeriod: null } })).toMatchObject({ overCapMinutes: 0, insideAllowance: true });
  });

  it('over the weekly cap is flagged by how much and leaves the head\'s allowance', () => {
    expect(overtimeLimits({ weekMinutes: 150, needsMinutes: 25, branchUsedMinutes: 0, rules: { weeklyCapMinutes: 120, branchBudgetMinutesPerPeriod: null } })).toMatchObject({ overCapMinutes: 30, insideAllowance: false });
  });

  it('over the branch budget leaves the allowance even when the person is under the cap', () => {
    expect(overtimeLimits({ weekMinutes: 30, needsMinutes: 25, branchUsedMinutes: 601, rules: { weeklyCapMinutes: 120, branchBudgetMinutesPerPeriod: 600 } })).toMatchObject({ overCapMinutes: 0, insideAllowance: false });
  });

  it('no cap and no budget means no limit', () => {
    expect(overtimeLimits({ weekMinutes: 9999, needsMinutes: 25, branchUsedMinutes: 9999, rules: { weeklyCapMinutes: null, branchBudgetMinutesPerPeriod: null } }).insideAllowance).toBe(true);
  });
});

describe('overtime item state', () => {
  it('waits for a person when minutes need a decision, authorising only the service tail meanwhile', () => {
    expect(nextOvertime(null, figures)).toEqual({ status: 'PENDING', authorisedMinutes: 15, clearDecision: false });
  });

  it('is authorised by itself when the service tail covers it all', () => {
    expect(nextOvertime(null, { ...figures, rawMinutes: 12, autoMinutes: 12, needsMinutes: 0 })).toMatchObject({ status: 'AUTO_AUTHORISED', authorisedMinutes: 12 });
  });

  it('keeps an answer while the minutes are the same, and asks again when they changed', () => {
    const approved = { status: 'APPROVED' as const, rawMinutes: 40, needsMinutes: 25, authorisedMinutes: 40 };
    expect(nextOvertime(approved, figures)).toEqual({ status: 'APPROVED', authorisedMinutes: 40, clearDecision: false });
    expect(nextOvertime(approved, { ...figures, rawMinutes: 50, needsMinutes: 35 })).toEqual({ status: 'PENDING', authorisedMinutes: 15, clearDecision: true });
  });

  it('a declined item stays declined while nothing changed', () => {
    expect(nextOvertime({ status: 'DECLINED', rawMinutes: 40, needsMinutes: 25, authorisedMinutes: 15 }, figures)).toMatchObject({ status: 'DECLINED', authorisedMinutes: 15 });
  });
});
