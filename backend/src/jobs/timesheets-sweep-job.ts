import type { Queue } from 'bullmq';
import { sweepTimesheets } from '../modules/workforce';
import { logger } from '../utils/logger';

export const TIMESHEETS_SWEEP_JOB = 'timesheets.sweep';

/**
 * Brings the open months of switched branches up to date and moves time requests that have waited 3 days to HR. Nothing closes
 * by itself (Segment 1A). Only branches whose new clock is switched on have months or requests, so for every other branch this
 * does nothing.
 */
export const runTimesheetsSweepJob = async (): Promise<{ refreshed: number; escalated: number }> => {
  const result = await sweepTimesheets();
  if (result.escalated > 0) logger.info(result, 'Timesheets sweep');
  return result;
};

// Every ten minutes: the days refresh, and a request moves on its third day.
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
