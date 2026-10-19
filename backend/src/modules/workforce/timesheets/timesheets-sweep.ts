import { escalateStaleRequests } from './requests/escalation-service';
import { sweepPeriods } from './periods/close-service';

/**
 * The scheduled task (every ten minutes): close the periods whose cut-off has passed in Nairobi time, and move requests that
 * have waited 3 days to HR. Only branches whose new clock is on have periods or requests, so for every other branch this
 * does nothing. Safe to run twice at once: each step claims what it moves.
 */
export async function sweepTimesheets(now: Date = new Date()): Promise<{ closed: number; escalated: number }> {
  const { closed } = await sweepPeriods(now);
  const { escalated } = await escalateStaleRequests(now);
  return { closed, escalated };
}
