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
  const decided = stored !== null && (stored.status === 'APPROVED' || stored.status === 'DECLINED');
  if (decided && stored.rawMinutes === figures.rawMinutes && stored.needsMinutes === figures.needsMinutes) {
    return { status: stored.status, authorisedMinutes: stored.authorisedMinutes, clearDecision: false };
  }
  return { status: figures.needsMinutes > 0 ? 'PENDING' : 'AUTO_AUTHORISED', authorisedMinutes: figures.autoMinutes, clearDecision: decided };
}
