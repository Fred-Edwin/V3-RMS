import { logger } from '../../../utils/logger';
import { switchRepository } from '../attendance/switch/switch-repository';
import { currentPeriodFresh, refreshPeriod } from './assemble/assemble-service';
import { periodsRepository } from './periods/periods-repository';
import { escalateStaleRequests } from './requests/escalation-service';

/**
 * The scheduled task (every ten minutes). Nothing closes by itself any more (Segment 1A): it brings every switched branch's
 * current month up to date, refreshes the months that have ended and are waiting for approval (so the manager sees the last
 * days complete), and moves requests that have waited 3 days to HR. An approved month is never touched. Idempotent: each step
 * writes only what changed and claims what it moves, so two servers at once do no harm.
 */
export async function sweepTimesheets(now: Date = new Date()): Promise<{ refreshed: number; escalated: number }> {
  let refreshed = 0;
  for (const siteId of await switchRepository.enabledSiteIds()) {
    try {
      await currentPeriodFresh(siteId, now);
    } catch (error) {
      logger.error({ err: error, siteId }, 'timesheet refresh failed');
    }
  }
  for (const period of await periodsRepository.openPeriods()) {
    try {
      await refreshPeriod(period, now);
      refreshed += 1;
    } catch (error) {
      logger.error({ err: error, periodId: period.id }, 'timesheet month refresh failed');
    }
  }
  const { escalated } = await escalateStaleRequests(now);
  return { refreshed, escalated };
}
