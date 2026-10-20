import type { NairobiDate } from '../../_shared/time/nairobi-time';
import type { LeaveRules, LeaveTypeRule, RulesAt } from '../leave.types';
import { leaveYearOf, monthFirst, yearStart } from './leave-days';

export const typeRuleOf = (rules: LeaveRules, code: string): LeaveTypeRule | undefined => rules.leaveTypes.find((type) => type.code === code);

/** `daysPerYear` of the type, else the default policy figure, else 0 (L7). */
export const perYearOf = (rules: LeaveRules, type: LeaveTypeRule): number => type.daysPerYear ?? rules.defaultPolicy[type.code] ?? 0;

/** A type with no days to count: unpaid leave has no balance and no limit. */
export const isLimited = (type: LeaveTypeRule): boolean => type.paid;

export interface EntitlementInput {
  code: string;
  year: number;
  /** The person's first day of work (Nairobi date). */
  startDate: NairobiDate;
  /** Their exit day, if they have one. */
  exitDate: NairobiDate | null;
  /** The day the balance is read for; only MONTHLY accrual depends on it. */
  asOf: NairobiDate;
  rulesAt: RulesAt;
  /**
   * The month an OPENING ledger entry replaced the entitlement (the legacy carry). In that year an up-front grant is zero (the opening
   * is the grant) and monthly credits only count for the months after it.
   */
  openingMonth?: number | null;
}

/** First month of the year the person is employed, and whether they were there on the 1st (a joiner on the 1st gets that month). */
function joinPosition(startDate: NairobiDate, year: number): { month: number; onFirst: boolean } | null {
  const startYear = leaveYearOf(startDate);
  if (startYear > year) return null;
  if (startYear < year) return { month: 1, onFirst: true };
  return { month: Number(startDate.slice(5, 7)), onFirst: startDate.slice(8, 10) === '01' };
}

/**
 * Days the rules grant for one type in one year, whole days only (L7, owner decision O1).
 * - The accrual mode is read ONCE, from the rules in force on the grant date (1 January, or the start date for a joiner), so a
 *   later change of mode never double-credits a year; it applies from the next one.
 * - UP_FRONT: the full figure at the start of the year; a joiner who starts mid-year gets it prorated by the whole months left
 *   (the start month counts only when they start on the 1st), rounded down.
 * - MONTHLY: `perMonthDays` on the 1st of each month from the month after the start month to the exit month, each month read from
 *   the rules of that month, rounded down at the end.
 * - PER_EVENT: nothing until HR adds days.
 */
export function entitlementFor(input: EntitlementInput): number {
  const joined = joinPosition(input.startDate, input.year);
  if (!joined) return 0;
  const grantDate = leaveYearOf(input.startDate) === input.year ? input.startDate : yearStart(input.year);
  const grantType = typeRuleOf(input.rulesAt(grantDate), input.code);
  if (!grantType || grantType.accrual === 'PER_EVENT') return 0;
  const exitYear = input.exitDate ? leaveYearOf(input.exitDate) : null;
  if (exitYear !== null && exitYear < input.year) return 0;

  if (grantType.accrual === 'UP_FRONT') {
    if (input.openingMonth != null) return 0;
    const perYear = perYearOf(input.rulesAt(grantDate), grantType);
    if (joined.month === 1 && joined.onFirst) return Math.floor(perYear);
    const monthsLeft = 12 - joined.month + (joined.onFirst ? 1 : 0);
    return Math.floor((perYear * monthsLeft) / 12);
  }

  const lastMonth = Math.min(leaveYearOf(input.asOf) > input.year ? 12 : leaveYearOf(input.asOf) < input.year ? 0 : Number(input.asOf.slice(5, 7)), exitYear === input.year ? Number((input.exitDate as NairobiDate).slice(5, 7)) : 12);
  const startedBefore = leaveYearOf(input.startDate) < input.year;
  const firstMonth = Math.max(startedBefore ? 1 : joined.month + 1, (input.openingMonth ?? 0) + 1);
  let total = 0;
  for (let month = firstMonth; month <= lastMonth; month += 1) {
    const type = typeRuleOf(input.rulesAt(monthFirst(input.year, month)), input.code);
    total += type?.accrual === 'MONTHLY' ? (type.perMonthDays ?? 0) : 0;
  }
  return Math.floor(total);
}
