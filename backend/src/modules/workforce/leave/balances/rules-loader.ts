import { nairobiToday, type NairobiDate } from '../../_shared/time/nairobi-time';
import { getEffectiveRuleGroup } from '../../rules/rules-service';
import { leaveYearOf, monthFirst, yearStart } from '../engine/leave-days';
import type { LeaveRules, RulesAt } from '../leave.types';

/** The dates whose rules a balance reads: 1 January, the first of each month up to the day asked, and any extra (a joiner's start). */
export function datesNeeded(year: number, asOf: NairobiDate, extras: readonly NairobiDate[] = []): NairobiDate[] {
  const lastMonth = leaveYearOf(asOf) > year ? 12 : leaveYearOf(asOf) < year ? 1 : Number(asOf.slice(5, 7));
  const dates = new Set<NairobiDate>([yearStart(year), ...extras.filter((date) => leaveYearOf(date) === year)]);
  for (let month = 1; month <= lastMonth; month += 1) dates.add(monthFirst(year, month));
  return [...dates].sort();
}

/**
 * Loads the LEAVE rules in force on each date (a site override included) once, then answers synchronously. A date that was not
 * loaded gets the latest loaded date before it, else the earliest, so the engine never throws on a date it did not ask for.
 */
export async function loadRulesAt(siteId: string, dates: readonly NairobiDate[]): Promise<RulesAt> {
  const unique = [...new Set(dates)].sort();
  const loaded = await Promise.all(unique.map(async (date) => [date, (await getEffectiveRuleGroup(siteId, date, 'LEAVE')).values as LeaveRules] as const));
  const byDate = new Map(loaded);
  return (date) => {
    const exact = byDate.get(date);
    if (exact) return exact;
    const before = unique.filter((d) => d <= date).pop();
    return byDate.get(before ?? (unique[0] as NairobiDate)) as LeaveRules;
  };
}

/** The rules in force today, for the type list, the minimum cover and the unpaid divisor. */
export async function rulesToday(siteId: string, now: Date): Promise<LeaveRules> {
  return (await getEffectiveRuleGroup(siteId, nairobiToday(now), 'LEAVE')).values as LeaveRules;
}
