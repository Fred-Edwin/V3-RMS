import { ConflictError } from '../../../../utils/errors';
import type { NairobiDate } from '../../_shared/time/nairobi-time';
import { getEffectiveRules, type EffectiveRules } from '../../rules';
import { previousMonthKey, type MonthWindow } from '../months/month-calendar';
import { loadSiteRows } from '../sites/site-rows';
import { inputsRepository } from './inputs-repository';
import { holidaysInMonth, payReadiness, type ReadinessProblem } from './rules-to-engine';

export interface FirstRunPlan {
  siteIds: string[];
  siteNames: Map<string, string>;
  rulesBySite: Map<string, EffectiveRules>;
  monthSites: { siteId: string; periodId: string; timesheetNumber: number; approvedAt: Date; approvedById: string; headcount: number }[];
  firstMonthSiteIds: string[];
  tablesVersion: number | null;
  tablesConfirmed: { confirmedById: string; confirmedAt: Date } | null;
}

/** The unmet confirmations of every site's rules, with duplicates removed (the statutory tables are the same for all). */
export const unmetReadiness = (rulesBySite: ReadonlyMap<string, EffectiveRules>, window: MonthWindow): ReadinessProblem[] => {
  const seen = new Map<string, ReadinessProblem>();
  for (const rules of rulesBySite.values()) for (const problem of payReadiness(rules, holidaysInMonth(rules, window).size > 0)) seen.set(problem.group, problem);
  return [...seen.values()];
};

/**
 * Decides who is in the month (E10) the first time it is calculated. Calculation never starts before every site on the new system
 * has approved its timesheets, and never before the Accountant has confirmed the tables (E1, E3). Both refusals say what is missing.
 */
export async function planFirstRun(companyId: string, window: MonthWindow, today: NairobiDate, now: Date): Promise<FirstRunPlan> {
  const rows = await loadSiteRows(companyId, window, today, now);
  const included = rows.filter((row) => row.timesheetState !== 'NOT_ON_NEW_SYSTEM');
  if (included.length === 0) throw new ConflictError('No site is on the new system for this month yet.', 'NO_SITES_ON_NEW_PAYROLL');
  const waiting = included.filter((row) => row.timesheetState !== 'APPROVED');
  if (waiting.length > 0) throw new ConflictError(`Payroll is waiting for ${waiting.map((w) => w.name).join(' and ')}.`, 'WAITING_FOR_SITES', { sites: waiting.map((w) => ({ siteId: w.siteId, name: w.name })) });

  const siteIds = included.map((row) => row.siteId);
  const rulesBySite = new Map<string, EffectiveRules>();
  for (const id of siteIds) rulesBySite.set(id, await getEffectiveRules(id, window.last));
  const problems = unmetReadiness(rulesBySite, window);
  if (problems.length > 0) throw new ConflictError(problems.map((p) => p.message).join(' '), 'TABLES_NOT_CONFIRMED', { problems });

  const periods = await inputsRepository.periods(siteIds, window);
  const monthSites = included.map((row) => {
    const period = periods.find((p) => p.siteId === row.siteId);
    if (!period?.approvedAt || !period.approvedById || period.documentNumber === null) throw new ConflictError(`${row.name}'s timesheet month is not approved.`, 'WAITING_FOR_SITES');
    return { siteId: row.siteId, periodId: period.id, timesheetNumber: period.documentNumber, approvedAt: period.approvedAt, approvedById: period.approvedById, headcount: row.headcount };
  });
  const before = new Set(await inputsRepository.sitesEverInPayroll(companyId, previousMonthKey(window.monthKey)));
  const statutory = rulesBySite.get(siteIds[0] ?? '')?.STATUTORY;
  const tablesVersion = statutory?.companyVersion ?? null;
  return {
    siteIds,
    siteNames: new Map(included.map((row) => [row.siteId, row.name])),
    rulesBySite,
    monthSites,
    firstMonthSiteIds: siteIds.filter((id) => !before.has(id)),
    tablesVersion,
    tablesConfirmed: tablesVersion === null ? null : await inputsRepository.statutoryConfirmation(companyId, tablesVersion),
  };
}
