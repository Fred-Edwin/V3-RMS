import { Worker } from 'bullmq';
import { bullMqConnection, notificationQueue, reportQueue } from '../config/queues';
import { ensureShiftReminderSchedule, enqueueTomorrowShiftReminderDispatchJobs } from './shift-reminder';
import { ensureDailyReportSchedule, precomputeDailyReports } from './daily-report';
import { fcmService } from '../services/fcm-service';
import { logger } from '../utils/logger';

export const notificationWorker = new Worker(
  'notifications',
  async (job) => {
    if (job.name === 'shift.reminder.schedule') {
      const queuedCount = await enqueueTomorrowShiftReminderDispatchJobs(notificationQueue);
      logger.info({ jobId: job.id, queuedCount }, 'Shift reminder schedule executed');
      return;
    }

    if (job.name === 'shift.reminder.dispatch') {
      const data = job.data as {
        userId: string;
        shiftName: string;
        startTime: string;
        date: string;
      };

      await fcmService.sendShiftReminderPush(data.userId, {
        shiftName: data.shiftName,
        startTime: data.startTime,
        date: data.date,
      });
      return;
    }

    logger.info({ jobId: job.id, name: job.name }, 'Notification job placeholder received');
  },
  {
    connection: bullMqConnection,
    autorun: false,
  },
);

export const reportWorker = new Worker(
  'reports',
  async (job) => {
    if (job.name === 'daily-report.schedule') {
      const completedCount = await precomputeDailyReports();
      logger.info({ jobId: job.id, completedCount }, 'Daily report schedule executed');
      return;
    }

    logger.info({ jobId: job.id, name: job.name }, 'Report job placeholder received');
  },
  {
    connection: bullMqConnection,
    autorun: false,
  },
);

export const startWorkers = (): void => {
  if (process.env.START_BULLMQ_WORKERS === 'true') {
    notificationWorker.run();
    reportWorker.run();
    void ensureShiftReminderSchedule(notificationQueue).catch((error) => {
      logger.error({ error }, 'Failed to register shift reminder schedule');
    });
    void ensureDailyReportSchedule(reportQueue).catch((error) => {
      logger.error({ error }, 'Failed to register daily report schedule');
    });
    logger.info('BullMQ workers started');
  }
};
