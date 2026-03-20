import type { Queue } from 'bullmq';
import { getTodayDateOnly } from '../utils/date-only';
import { logger } from '../utils/logger';
import { orderRepository } from '../repositories/order-repository';
import { reportRepository } from '../repositories/report-repository';
import { fcmService } from '../services/fcm-service';

// Sends FCM push notifications to waiters who have orders that have been sitting
// in READY status for more than 30 minutes without payment being recorded.
// Runs every hour between 06:00 and 22:00 Nairobi time.
export const sendReadyOrderReminders = async (): Promise<number> => {
  const today = getTodayDateOnly();
  const idleSince = new Date(Date.now() - 30 * 60 * 1000);
  const organizations = await reportRepository.listActiveOrganizations();

  let totalNotified = 0;
  for (const org of organizations) {
    const idleOrders = await orderRepository.findIdleReadyOrders(org.id, idleSince, today);
    if (idleOrders.length === 0) continue;

    // Group by waiter so each waiter gets a single consolidated notification
    const byWaiter = new Map<string, number>();
    for (const order of idleOrders) {
      byWaiter.set(order.createdById, (byWaiter.get(order.createdById) ?? 0) + 1);
    }

    for (const [waiterId, count] of byWaiter) {
      await fcmService.sendReadyOrderReminderPush(waiterId, count);
    }

    logger.info(
      { organizationId: org.id, orgName: org.name, waitersNotified: byWaiter.size, idleOrderCount: idleOrders.length },
      'Ready order reminders sent to waiters',
    );

    totalNotified += byWaiter.size;
  }

  logger.info({ totalNotified }, 'Ready order reminder job completed');
  return totalNotified;
};

export const ensureReadyOrderReminderSchedule = async (queue: Queue): Promise<void> => {
  await queue.add(
    'ready-order-reminder.schedule',
    {},
    {
      repeat: {
        // Every hour between 06:00 and 22:00 Nairobi time
        pattern: '0 6-22 * * *',
        tz: 'Africa/Nairobi',
      },
      jobId: 'ready-order-reminder.schedule',
      removeOnComplete: true,
      removeOnFail: 100,
    },
  );
};
