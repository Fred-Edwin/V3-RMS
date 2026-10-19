import { getEffectiveRules, type EffectiveRules } from '../../rules';
import { unmetReadiness } from '../calculate/inclusion';
import type { SiteRow } from '../sites/site-status';
import type { MonthWindow } from './month-calendar';

export interface WaitingBanner {
  kind: 'SITES' | 'TABLES';
  title: string;
  body: string;
  waitingFor: string;
  missing: { group: string; role: string }[];
}

/**
 * What a WAITING month is waiting for (S1): first the sites that have not approved, then, once every site has, the Accountant's
 * confirmation of the tables. Null when nothing is missing (the system is about to calculate).
 */
export async function waitingBanner(rows: readonly SiteRow[], window: MonthWindow, monthLabel: string): Promise<WaitingBanner | null> {
  const on = rows.filter((r) => r.timesheetState !== 'NOT_ON_NEW_SYSTEM');
  const waiting = on.filter((r) => r.timesheetState !== 'APPROVED');
  if (waiting.length > 0) {
    const names = waiting.map((r) => r.name).join(' and ');
    return { kind: 'SITES', title: `Payroll is waiting for ${names}`, body: `${monthLabel} is calculated when every site has approved its timesheets.`, waitingFor: `for ${waiting.length} of ${on.length} sites to approve`, missing: [] };
  }
  if (on.length === 0) return null;
  const rulesBySite = new Map<string, EffectiveRules>();
  for (const site of on) rulesBySite.set(site.siteId, await getEffectiveRules(site.siteId, window.last));
  const problems = unmetReadiness(rulesBySite, window);
  if (problems.length === 0) return null;
  return {
    kind: 'TABLES',
    title: 'Payroll is waiting for the tax tables',
    body: `Every site has approved ${monthLabel}. The Accountant must confirm the tax tables in Rules, Statutory before the month can be calculated.`,
    waitingFor: problems[0]?.message ?? 'Waiting for the Accountant',
    missing: problems.map((p) => ({ group: p.group, role: p.role })),
  };
}
