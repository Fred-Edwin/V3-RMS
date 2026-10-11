import type { Queue } from 'bullmq';
import { sendDeliveryDueNotices } from '../modules/inventory/purchasing/attendant/due-notices';
import { logger } from '../utils/logger';

/** Purchasing notification map rows 24 and 25: the 08:00 Nairobi run that tells the Store Attendants about deliveries due or late. */
export const PURCHASING_DUE_JOB = 'purchasing-due-notices.schedule';

export const ensurePurchasingDueSchedule = async (queue: Queue): Promise<void> => {
  await queue.add(PURCHASING_DUE_JOB, {}, { repeat: { pattern: '0 8 * * *', tz: 'Africa/Nairobi' }, jobId: PURCHASING_DUE_JOB, removeOnComplete: true, removeOnFail: 100 });
};

export const runPurchasingDueJob = async (name: string): Promise<boolean> => {
  if (name !== PURCHASING_DUE_JOB) return false;
  const told = await sendDeliveryDueNotices();
  if (told.dueToday > 0 || told.overdue > 0) logger.info(told, 'Purchasing deliveries due or overdue: Store Attendants told');
  return true;
};
