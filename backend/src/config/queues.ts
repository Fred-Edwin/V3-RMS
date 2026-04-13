import IORedis from 'ioredis';
import { Queue } from 'bullmq';
import { env } from './env';

export const bullMqConnection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

export const notificationQueue = new Queue('notifications', {
  connection: bullMqConnection,
});

export const reportQueue = new Queue('reports', {
  connection: bullMqConnection,
});

export const authQueue = new Queue('auth', {
  connection: bullMqConnection,
});

export const commsQueue = new Queue('comms', {
  connection: bullMqConnection,
});
