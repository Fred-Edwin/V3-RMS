import type { Queue } from 'bullmq';
import { logger } from '../utils/logger';
import { runPeopleScheduler } from '../modules/workforce';

export const PEOPLE_SCHEDULER_JOB = 'people.scheduler';

/** The daily People tasks (start days, exits, moves, pay changes, old drafts). Returns how many rows changed in all. */
export const runPeopleSchedulerJob = async (): Promise<number> => {
  const reports = await runPeopleScheduler();
  const total = reports.reduce((sum, r) => sum + r.changed, 0);
  logger.info({ reports }, 'People scheduler completed');
  return total;
};

// 00:05 Nairobi, the same slot as the stale clock-out: just after midnight, once the previous day is over.
export const ensurePeopleSchedulerSchedule = async (queue: Queue): Promise<void> => {
  await queue.add(
    PEOPLE_SCHEDULER_JOB,
    {},
    {
      repeat: { pattern: '5 0 * * *', tz: 'Africa/Nairobi' },
      jobId: PEOPLE_SCHEDULER_JOB,
      removeOnComplete: true,
      removeOnFail: 100,
    },
  );
};
