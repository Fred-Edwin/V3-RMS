import type { Queue } from 'bullmq';
import { sweepConduct, type ConductSweepReport } from '../modules/workforce';
import { logger } from '../utils/logger';

export const CONDUCT_SWEEP_JOB = 'conduct.sweep';

/**
 * Once a night: a notice past its end date becomes Ended, an appeal past its 7 days tells the Director once, and a witness who has
 * not answered after 3 days is reported. Only branches whose new clock is on have notices, so for every other branch this does nothing.
 */
export const runConductSweepJob = async (): Promise<ConductSweepReport> => {
  const result = await sweepConduct();
  if (result.ended + result.directorTold + result.witnessesUnconfirmed > 0) logger.info(result, 'Conduct sweep');
  return result;
};

// 00:10 Nairobi time, every day.
export const ensureConductSweepSchedule = async (queue: Queue): Promise<void> => {
  await queue.add(
    CONDUCT_SWEEP_JOB,
    {},
    {
      repeat: { pattern: '10 0 * * *', tz: 'Africa/Nairobi' },
      jobId: CONDUCT_SWEEP_JOB,
      removeOnComplete: true,
      removeOnFail: 100,
    },
  );
};
