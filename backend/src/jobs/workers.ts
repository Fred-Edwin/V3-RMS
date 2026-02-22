import { Worker } from 'bullmq';
import { bullMqConnection } from '../config/queues';
import { logger } from '../utils/logger';

export const notificationWorker = new Worker(
  'notifications',
  async (job) => {
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
    logger.info('BullMQ workers started');
  }
};
