import type { Queue } from 'bullmq';
import { getTodayDateOnly } from '../utils/date-only';
import { logger } from '../utils/logger';
import { clockRecordRepository } from '../repositories/clock-record-repository';
import { reportRepository } from '../repositories/report-repository';

// Close all open clock records from previous days across all active organisations.
// Runs nightly at 00:05 Nairobi time so that staff who forget to clock out never
// block themselves (or each other) from clocking in the next morning.
export const closeStaleClockRecords = async (): Promise<number> => {
  const todayStartUtc = getTodayDateOnly();
  const sites = await reportRepository.listActiveSites();

  let totalClosed = 0;
  for (const org of sites) {
    const closed = await clockRecordRepository.closeStaleOpenRecords(org.id, todayStartUtc);
    if (closed > 0) {
      logger.info(
        { siteId: org.id, closed },
        'Nightly stale clock-out: closed open records from previous day',
      );
    }
    totalClosed += closed;
  }

  logger.info({ totalClosed }, 'Nightly stale clock-out job completed');
  return totalClosed;
};

export const ensureStaleClockOutSchedule = async (queue: Queue): Promise<void> => {
  await queue.add(
    'stale-clock-out.schedule',
    {},
    {
      repeat: {
        // 00:05 Nairobi time — just after midnight so any legitimate late shifts have ended
        pattern: '5 0 * * *',
        tz: 'Africa/Nairobi',
      },
      jobId: 'stale-clock-out.schedule',
      removeOnComplete: true,
      removeOnFail: 100,
    },
  );
};
