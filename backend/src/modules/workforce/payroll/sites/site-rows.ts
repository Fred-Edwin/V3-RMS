import type { NairobiDate } from '../../_shared/time/nairobi-time';
import { inputsRepository } from '../calculate/inputs-repository';
import type { MonthWindow } from '../months/month-calendar';
import { monthsRepository } from '../months/months-repository';
import { classifySites, type SiteFacts, type SiteRow } from './site-status';
import { sitesRepository } from './sites-repository';

/**
 * Every active site of the company in this month: on the new system (and approved or not) or still on the old payslips.
 * Read fresh each time: while the month waits, a site's approval is the 1A timesheet month itself.
 */
export async function loadSiteRows(companyId: string, window: MonthWindow, today: NairobiDate, now: Date): Promise<SiteRow[]> {
  const [sites, switched, ever, headcounts, reminders] = await Promise.all([
    sitesRepository.activeSites(companyId),
    inputsRepository.switchedSites(companyId),
    inputsRepository.sitesEverInPayroll(companyId, window.monthKey),
    sitesRepository.headcounts(companyId, window),
    monthsRepository.lastReminders(companyId, window.monthKey),
  ]);
  const periods = await inputsRepository.periods(sites.map((s) => s.id), window);
  const switchedBy = new Map(switched.map((s) => [s.siteId, s.enabledAt]));
  const periodBy = new Map(periods.map((p) => [p.siteId, p]));
  const facts: SiteFacts[] = sites.map((site) => {
    const period = periodBy.get(site.id);
    return {
      siteId: site.id,
      name: site.name,
      switchedOnAt: switchedBy.get(site.id) ?? null,
      everInPayroll: ever.includes(site.id),
      period: period ? { state: period.state, approvedAt: period.approvedAt, approvedById: period.approvedById, documentNumber: period.documentNumber } : null,
      headcount: headcounts.get(site.id) ?? 0,
    };
  });
  return classifySites(facts, window, today, reminders, now);
}
