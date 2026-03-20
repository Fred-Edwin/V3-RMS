import { Worker } from 'bullmq';
import { bullMqConnection, notificationQueue, reportQueue } from '../config/queues';
import { ensureShiftReminderSchedule, enqueueTomorrowShiftReminderDispatchJobs } from './shift-reminder';
import { ensureDailyReportSchedule, precomputeDailyReports } from './daily-report';
import { ensureStaleClockOutSchedule, closeStaleClockRecords } from './stale-clock-out';
import { ensureStaleOrdersSchedule, flagStaleOrders } from './stale-orders';
import { ensureReadyOrderReminderSchedule, sendReadyOrderReminders } from './ready-order-reminder';
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

    if (job.name === 'stale-clock-out.schedule') {
      const totalClosed = await closeStaleClockRecords();
      logger.info({ jobId: job.id, totalClosed }, 'Stale clock-out schedule executed');
      return;
    }

    if (job.name === 'stale-orders.schedule') {
      const totalFlagged = await flagStaleOrders();
      logger.info({ jobId: job.id, totalFlagged }, 'Stale orders schedule executed');
      return;
    }

    if (job.name === 'ready-order-reminder.schedule') {
      const totalNotified = await sendReadyOrderReminders();
      logger.info({ jobId: job.id, totalNotified }, 'Ready order reminder schedule executed');
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
    void ensureStaleClockOutSchedule(reportQueue).catch((error) => {
      logger.error({ error }, 'Failed to register stale clock-out schedule');
    });
    void ensureStaleOrdersSchedule(reportQueue).catch((error) => {
      logger.error({ error }, 'Failed to register stale orders schedule');
    });
    void ensureReadyOrderReminderSchedule(reportQueue).catch((error) => {
      logger.error({ error }, 'Failed to register ready order reminder schedule');
    });
    logger.info('BullMQ workers started');
  }
};
