import { Worker } from 'bullmq';
import { bullMqConnection, notificationQueue, reportQueue, authQueue, commsQueue } from '../config/queues';
import { ensureShiftReminderSchedule, enqueueTomorrowShiftReminderDispatchJobs } from './shift-reminder';
import { ensureDailyReportSchedule, precomputeDailyReports } from './daily-report';
import { ensureStaleClockOutSchedule, closeStaleClockRecords } from './stale-clock-out';
import { ensureStaleOrdersSchedule, flagStaleOrders } from './stale-orders';
import { ensureReadyOrderReminderSchedule, sendReadyOrderReminders } from './ready-order-reminder';
import { URGENT_ESCALATION_JOB, ensureUrgentEscalationSchedule, escalateUrgentRequisitions } from './requisition-urgent-escalation';
import { ensureInventoryDeliverySchedule, runInventoryDeliveryJob } from './inventory-delivery-jobs';
import { INVENTORY_NOTICE_JOB, inventoryNotify, type HeldNotice } from '../modules/inventory/_shared/notify';
import { AUTH_TIMEOUT_JOB_NAME } from './house-account-auth-timeout';
import { checkFormalNoticeReminders, ensureFormalNoticeReminderSchedule } from './formal-notice-reminders';
import type { HouseAuthTimeoutJobData } from './house-account-auth-timeout';
import { fcmService } from '../services/fcm-service';
import { COUNT_DIRECTOR_ALERT_JOB, countNotify, type DirectorAlertJob } from '../modules/inventory/counting/_shared/count-notify';
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

    // A Director alert held for quiet hours (22:00 to 05:00 Nairobi) goes out at 05:00 (Counting rebuild).
    if (job.name === COUNT_DIRECTOR_ALERT_JOB) {
      await countNotify.dispatchDirectorAlertJob(job.data as DirectorAlertJob);
      return;
    }

    // An inventory push held for quiet hours goes out at 05:00 (the one notification layer, inventory/_shared/notify.ts).
    if (job.name === INVENTORY_NOTICE_JOB) {
      await inventoryNotify.dispatchHeld(job.data as HeldNotice);
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

    // Block 2: the 2-hour "Waiting for the branch" nudge and the 24-hour then daily discrepancy reminder (idempotent claims).
    if (await runInventoryDeliveryJob(job.name)) return;

    if (job.name === URGENT_ESCALATION_JOB) {
      const escalated = await escalateUrgentRequisitions();
      if (escalated > 0) logger.info({ jobId: job.id, escalated }, 'Urgent requisition escalation executed');
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

export const authWorker = new Worker(
  'auth',
  async (job) => {
    if (job.name === AUTH_TIMEOUT_JOB_NAME) {
      const data = job.data as HouseAuthTimeoutJobData;
      // Import lazily to avoid circular dependency (service → workers → service)
      const { houseAccountAuthService } = await import('../services/house-account-auth-service');
      await houseAccountAuthService.handleTimeout(data.authRequestId);
      logger.info({ jobId: job.id, authRequestId: data.authRequestId }, 'House account auth timeout processed');
      return;
    }

    logger.info({ jobId: job.id, name: job.name }, 'Auth job placeholder received');
  },
  {
    connection: bullMqConnection,
    autorun: false,
  },
);

export const commsWorker = new Worker(
  'comms',
  async (job) => {
    if (job.name === 'formal-notice-reminders.schedule') {
      await checkFormalNoticeReminders();
      logger.info({ jobId: job.id }, 'Formal notice reminders job completed');
      return;
    }

    logger.info({ jobId: job.id, name: job.name }, 'Comms job placeholder received');
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
    authWorker.run();
    commsWorker.run();
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
    void ensureUrgentEscalationSchedule(reportQueue).catch((error) => {
      logger.error({ error }, 'Failed to register urgent requisition escalation schedule');
    });
    void ensureInventoryDeliverySchedule(reportQueue).catch((error) => {
      logger.error({ error }, 'Failed to register the delivery waiting and discrepancy reminder schedule');
    });
    void ensureReadyOrderReminderSchedule(reportQueue).catch((error) => {
      logger.error({ error }, 'Failed to register ready order reminder schedule');
    });
    void ensureFormalNoticeReminderSchedule(commsQueue).catch((error) => {
      logger.error({ error }, 'Failed to register formal notice reminder schedule');
    });
    logger.info('BullMQ workers started');
  }
};
