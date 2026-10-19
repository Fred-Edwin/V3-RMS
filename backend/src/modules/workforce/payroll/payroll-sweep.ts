import { AppError } from '../../../utils/errors';
import { logger } from '../../../utils/logger';
import { monthKey as monthKeyOfDate, nairobiToday, type NairobiDate } from '../_shared/time/nairobi-time';
import { calculateMonth } from './calculate/calculate-service';
import { inputsRepository } from './calculate/inputs-repository';
import { computeEstimate } from './estimate/estimate-service';
import { monthHasEnded, monthWindow, previousMonthKey } from './months/month-calendar';
import { monthsRepository } from './months/months-repository';
import { loadSiteRows } from './sites/site-rows';

/** Months still being prepared are looked at again for a few months back; an older month that never started is not started by a job. */
const LOOK_BACK_MONTHS = 3;

const recentKeys = (today: NairobiDate): string[] => {
  const keys: string[] = [];
  let key = monthKeyOfDate(today);
  for (let i = 0; i <= LOOK_BACK_MONTHS; i += 1) {
    keys.push(key);
    key = previousMonthKey(key);
  }
  return keys;
};

export interface PayrollSweepResult {
  created: number;
  calculated: number;
  waiting: number;
  failed: number;
}

/**
 * The job that runs every few minutes (E1, P5). For each recent month that has ended: make its row once a site on the new system
 * exists, and calculate it as soon as every such site has approved and the Accountant has confirmed the tables. It never touches a
 * month that is already calculated, and a month that is not ready simply waits. One company's failure does not stop the others.
 */
export async function sweepPayroll(now: Date = new Date()): Promise<PayrollSweepResult> {
  const result: PayrollSweepResult = { created: 0, calculated: 0, waiting: 0, failed: 0 };
  const today = nairobiToday(now);
  for (const companyId of await monthsRepository.activeCompanyIds()) {
    for (const key of recentKeys(today)) {
      const window = monthWindow(key);
      if (!monthHasEnded(window, today)) continue;
      try {
        const existing = await monthsRepository.find(companyId, key);
        if (existing && existing.state !== 'WAITING') continue;
        const sites = (await loadSiteRows(companyId, window, today, now)).filter((s) => s.timesheetState !== 'NOT_ON_NEW_SYSTEM');
        if (sites.length === 0) continue;
        if (!existing) {
          await monthsRepository.ensure(companyId, key);
          result.created += 1;
        }
        await calculateMonth({ companyId, monthKey: key, trigger: 'SYSTEM', actor: null, now });
        result.calculated += 1;
      } catch (error) {
        if (error instanceof AppError && ['WAITING_FOR_SITES', 'TABLES_NOT_CONFIRMED', 'NO_SITES_ON_NEW_PAYROLL'].includes(error.code)) result.waiting += 1;
        else {
          result.failed += 1;
          logger.error({ err: error, companyId, month: key }, 'payroll sweep failed for a month');
        }
      }
    }
  }
  return result;
}

/** The nightly job (00:30 Nairobi): the Director's estimate for the running month and for every month that is waiting (P28). */
export async function refreshEstimates(now: Date = new Date()): Promise<{ computed: number; failed: number }> {
  const out = { computed: 0, failed: 0 };
  const today = nairobiToday(now);
  for (const companyId of await monthsRepository.activeCompanyIds()) {
    const keys = new Set<string>([monthKeyOfDate(today)]);
    for (const m of await monthsRepository.allKeys(companyId)) if (m.state === 'WAITING') keys.add(m.monthKey);
    const switched = await inputsRepository.switchedSites(companyId);
    if (switched.length === 0 && keys.size === 1) continue;
    for (const key of keys) {
      try {
        await computeEstimate(companyId, key, now);
        out.computed += 1;
      } catch (error) {
        out.failed += 1;
        logger.error({ err: error, companyId, month: key }, 'payroll estimate failed for a month');
      }
    }
  }
  return out;
}
