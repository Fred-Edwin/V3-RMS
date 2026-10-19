import type { OvertimeStatus } from '@prisma/client';
import type { OvertimeRules } from '../../rules/rules-schemas';
import type { OvertimeFigures, OvertimeLimits, OvertimeRow } from '../timesheets.types';

/**
 * Rule (proposal 5.5): a weekly cap per person and a budget per branch, both from the OVERTIME rules. Over either, a
 * department head may not decide it; the Branch or Store Manager and HR can. `weekMinutes` is the person's raw overtime
 * for the whole week including this day; `branchUsedMinutes` is everything authorised or waiting in the period.
 * Feeds on: overtime.weeklyCapMinutes, overtime.branchBudgetMinutesPerPeriod.
 */
export function overtimeLimits(args: {
  weekMinutes: number;
  needsMinutes: number;
  branchUsedMinutes: number;
  rules: Pick<OvertimeRules, 'weeklyCapMinutes' | 'branchBudgetMinutesPerPeriod'>;
}): OvertimeLimits {
  const { weekMinutes, branchUsedMinutes, rules } = args;
  const cap = rules.weeklyCapMinutes;
  const budget = rules.branchBudgetMinutesPerPeriod;
  const overCapMinutes = cap === null ? 0 : Math.max(0, weekMinutes - cap);
  const insideBudget = budget === null || branchUsedMinutes <= budget;
  return {
    weeklyCapMinutes: cap,
    weekMinutes,
    overCapMinutes,
    branchBudgetMinutes: budget,
    branchUsedMinutes,
    insideAllowance: overCapMinutes === 0 && insideBudget,
  };
}

export interface DecisionOutcome {
  status: Extract<OvertimeStatus, 'APPROVED' | 'APPROVED_PART' | 'DECLINED'>;
  authorisedMinutes: number;
  /** What the manager granted out of the minutes that needed a decision. */
  grantedMinutes: number;
}

/** Steps of the "approve part" stepper (D3): 5 minutes, from 5 up to the extra minus 5. */
export const PART_STEP = 5;
export const partRange = (needsMinutes: number): { min: number; max: number } | null => (needsMinutes >= 2 * PART_STEP ? { min: PART_STEP, max: Math.floor((needsMinutes - PART_STEP) / PART_STEP) * PART_STEP } : null);

/**
 * Rule (D3): approve all grants every minute that needed a decision; part grants a multiple of 5 minutes between 5 and the extra
 * minus 5 (the rest is "not approved" and never deleted); none grants nothing. The minutes the service tail already covered
 * stay authorised either way. Returns null when the part is not allowed.
 */
export function decisionOutcome(item: Pick<OvertimeRow, 'needsMinutes' | 'autoMinutes'>, decision: 'APPROVE_ALL' | 'APPROVE_PART' | 'DECLINE', approvedMinutes?: number): DecisionOutcome | null {
  if (decision === 'APPROVE_ALL') return { status: 'APPROVED', authorisedMinutes: item.autoMinutes + item.needsMinutes, grantedMinutes: item.needsMinutes };
  if (decision === 'DECLINE') return { status: 'DECLINED', authorisedMinutes: item.autoMinutes, grantedMinutes: 0 };
  const range = partRange(item.needsMinutes);
  if (!range || approvedMinutes === undefined || approvedMinutes < range.min || approvedMinutes > range.max || approvedMinutes % PART_STEP !== 0) return null;
  return { status: 'APPROVED_PART', authorisedMinutes: item.autoMinutes + approvedMinutes, grantedMinutes: approvedMinutes };
}

export interface NextOvertime {
  status: OvertimeStatus;
  authorisedMinutes: number;
  /** The old decision no longer applies because the minutes changed. */
  clearDecision: boolean;
}

/**
 * What the item should read after the minutes were worked out again. Fully covered by the service tail: authorised by
 * itself. A person's answer (approved or declined) stays only while the minutes are the same.
 */
export function nextOvertime(stored: Pick<OvertimeRow, 'status' | 'rawMinutes' | 'needsMinutes' | 'authorisedMinutes'> | null, figures: OvertimeFigures): NextOvertime {
  const decided = stored !== null && (stored.status === 'APPROVED' || stored.status === 'APPROVED_PART' || stored.status === 'DECLINED');
  if (decided && stored.rawMinutes === figures.rawMinutes && stored.needsMinutes === figures.needsMinutes) {
    return { status: stored.status, authorisedMinutes: stored.authorisedMinutes, clearDecision: false };
  }
  return { status: figures.needsMinutes > 0 ? 'PENDING' : 'AUTO_AUTHORISED', authorisedMinutes: figures.autoMinutes, clearDecision: decided };
}
