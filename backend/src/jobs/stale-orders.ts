import type { Queue } from 'bullmq';
import { getTodayDateOnly } from '../utils/date-only';
import { logger } from '../utils/logger';
import { orderRepository } from '../repositories/order-repository';
import { reportRepository } from '../repositories/report-repository';
import { incidentService } from '../services/incident-service';
import { fcmService } from '../services/fcm-service';

// Flag all orders left in a non-terminal status from previous days across all active
// organisations. Logs an ORDER_STALE incident per order (for manager audit trail) and
// sends a push notification to all MANAGER/DIRECTOR staff so they can review and cancel
// any orders that should no longer be fulfilled.
// Runs nightly at 00:05 Nairobi time — same window as the stale clock-out job.
export const flagStaleOrders = async (): Promise<number> => {
  const today = getTodayDateOnly();
  const organizations = await reportRepository.listActiveOrganizations();

  let totalFlagged = 0;
  for (const org of organizations) {
    const staleOrders = await orderRepository.findStaleOrders(org.id, today);
    if (staleOrders.length === 0) continue;

    for (const order of staleOrders) {
      incidentService.log({
        organizationId: org.id,
        orderId: order.id,
        type: 'ORDER_STALE',
        // actorId intentionally omitted — this incident is system-generated
        details: {
          dailyNumber: order.dailyNumber,
          status: order.status,
          orderDate: order.orderDate.toISOString().split('T')[0],
          itemCount: order._count.items,
        },
      });
    }

    await fcmService.sendStaleOrdersPush(org.id, staleOrders.length);

    logger.info(
      { organizationId: org.id, orgName: org.name, staleCount: staleOrders.length },
      'Nightly stale orders: flagged unclosed orders and notified managers',
    );

    totalFlagged += staleOrders.length;
  }

  logger.info({ totalFlagged }, 'Nightly stale orders job completed');
  return totalFlagged;
};

export const ensureStaleOrdersSchedule = async (queue: Queue): Promise<void> => {
  await queue.add(
    'stale-orders.schedule',
    {},
    {
      repeat: {
        // 00:05 Nairobi time — just after midnight, same as stale-clock-out
        pattern: '5 0 * * *',
        tz: 'Africa/Nairobi',
      },
      jobId: 'stale-orders.schedule',
      removeOnComplete: true,
      removeOnFail: 100,
    },
  );
};
