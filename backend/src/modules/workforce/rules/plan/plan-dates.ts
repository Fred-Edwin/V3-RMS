import { ConflictError, ValidationError } from '../../../../utils/errors';
import { addDays, fromDateColumn, isoWeekday, monthKey, parseNairobiDate, type NairobiDate } from '../../_shared/time/nairobi-time';
import type { RuleGroupCode } from '../rules-schemas';
import { policyOf } from '../rules-values';
import { approvedMonths } from './plan-months';

/** The furthest ahead a rule may be scheduled. A typo like 2062 would otherwise sit in the timeline for ever. */
export const MAX_DAYS_AHEAD = 730;

const firstOfNextMonth = (today: NairobiDate): NairobiDate => {
  const [year, month] = monthKey(today).split('-').map(Number) as [number, number];
  const next = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;
  return parseNairobiDate(next);
};

/** D10: a change to pay starts on the first of next month so one month never mixes two rules; everything else starts today. */
export const defaultStartFor = (group: RuleGroupCode, changedFields: string[], today: NairobiDate): NairobiDate => {
  const policy = policyOf(group);
  return changedFields.some((field) => policy[field]?.nextMonth === true) ? firstOfNextMonth(today) : today;
};

/**
 * The earliest day this group may start. Everything starts today or later; only STATUTORY may start on a past day, and
 * never inside a month that is already approved (D3, D11). A live version later than that pushes the earliest day forward
 * (one timeline per scope, D9).
 */
export const earliestStartFor = async (companyId: string, group: RuleGroupCode, today: NairobiDate, latestLiveFrom: Date | null, now: Date): Promise<NairobiDate> => {
  const floor = group === 'STATUTORY' ? await approvedMonths().firstOpenMonthStart(companyId, now) : today;
  const latest = latestLiveFrom ? fromDateColumn(latestLiveFrom) : null;
  return latest && latest > floor ? latest : floor;
};

export interface StartRuleInput {
  group: RuleGroupCode;
  effectiveFrom: NairobiDate;
  today: NairobiDate;
  floor: NairobiDate; // the group's own floor, before the timeline
  latestLive: { version: number; effectiveFrom: Date } | null;
}

/** Throws the specific error the dialog shows under the date. */
export const assertStartAllowed = ({ group, effectiveFrom, today, floor, latestLive }: StartRuleInput): void => {
  if (effectiveFrom < floor) {
    if (group === 'STATUTORY') throw new ValidationError('That day is inside a month that is already approved. An approved month never changes.', 'RULE_MONTH_APPROVED');
    throw new ValidationError('A rule cannot start in the past', 'RULE_BACKDATED');
  }
  if (effectiveFrom > addDays(today, MAX_DAYS_AHEAD)) throw new ValidationError('That day is too far ahead. Choose a day within two years.', 'RULE_DATE_TOO_FAR');
  if (latestLive && effectiveFrom < fromDateColumn(latestLive.effectiveFrom)) {
    const startsOn = fromDateColumn(latestLive.effectiveFrom);
    throw new ConflictError(`Version ${latestLive.version} already starts on ${startsOn}. Choose that day or later, or withdraw version ${latestLive.version} first.`, 'RULE_FUTURE_VERSION_EXISTS', {
      version: latestLive.version,
      effectiveFrom: startsOn,
      withdrawable: startsOn > today,
    });
  }
};

/** A new week start must itself start on the new first day ("Pick a Sunday"), so no rota week is cut in two. */
export const assertWeekStartDay = (effectiveFrom: NairobiDate, weekStartsOn: number): void => {
  if (isoWeekday(effectiveFrom) !== weekStartsOn) {
    const names = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    throw new ValidationError(`Pick a ${names[weekStartsOn] ?? 'matching day'}`, 'RULE_DATE_NOT_WEEK_START');
  }
};
