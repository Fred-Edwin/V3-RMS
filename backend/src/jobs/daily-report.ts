import type { Queue } from 'bullmq';
import { parseDateOnly } from '../utils/date-only';
import { logger } from '../utils/logger';
import { reportRepository } from '../repositories/report-repository';
import { reportService } from '../services/report-service';

const REPORT_CACHE_TTL_SECONDS = 172_800;

const nairobiDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Africa/Nairobi',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const getNairobiDateString = (date: Date = new Date()): string => {
  const parts = nairobiDateFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error('Failed to format Nairobi date');
  }

  return `${year}-${month}-${day}`;
};

export const precomputeDailyReports = async (): Promise<number> => {
  const dateString = getNairobiDateString();
  const date = parseDateOnly(dateString);
  const organizations = await reportRepository.listActiveOrganizations();

  if (organizations.length === 0) {
    logger.info({ date: dateString }, 'No active organizations found for daily report precomputation');
    return 0;
  }

  let completedCount = 0;
  for (const organization of organizations) {
    await reportService.precomputeDailySummaryForOrganization(
      organization.id,
      date,
      REPORT_CACHE_TTL_SECONDS,
    );
    completedCount += 1;
  }

  logger.info({ date: dateString, completedCount }, 'Daily report precomputation completed');
  return completedCount;
};

export const ensureDailyReportSchedule = async (queue: Queue): Promise<void> => {
  await queue.add(
    'daily-report.schedule',
    {},
    {
      repeat: {
        pattern: '0 23 * * *',
        tz: 'Africa/Nairobi',
      },
      jobId: 'daily-report.schedule',
      removeOnComplete: true,
      removeOnFail: 100,
    },
  );
};

