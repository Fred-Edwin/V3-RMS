import type { Queue } from 'bullmq';
import { sweepTimesheets } from '../modules/workforce';
import { logger } from '../utils/logger';

export const TIMESHEETS_SWEEP_JOB = 'timesheets.sweep';

/**
 * Closes timesheet periods whose cut-off has passed (Nairobi time) and moves time requests that have waited 3 days to HR.
 * Only branches whose new clock is switched on have either, so for every other branch this does nothing.
 */
export const runTimesheetsSweepJob = async (): Promise<{ closed: number; escalated: number }> => {
  const result = await sweepTimesheets();
  if (result.closed > 0 || result.escalated > 0) logger.info(result, 'Timesheets sweep');
  return result;
};

// Every ten minutes: a period closes within ten minutes of its cut-off, and a request moves on its third day.
export const ensureTimesheetsSweepSchedule = async (queue: Queue): Promise<void> => {
  await queue.add(
    TIMESHEETS_SWEEP_JOB,
    {},
    {
      repeat: { pattern: '*/10 * * * *', tz: 'Africa/Nairobi' },
      jobId: TIMESHEETS_SWEEP_JOB,
      removeOnComplete: true,
      removeOnFail: 100,
    },
  );
};
