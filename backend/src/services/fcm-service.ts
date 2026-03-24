import { authRepository } from '../repositories/auth-repository';
import { firebaseMessaging } from '../config/firebase';
import { env } from '../config/env';
import { logger } from '../utils/logger';

interface NewOrderPushPayload {
  orderId: string;
  dailyNumber: number;
  station: 'KITCHEN' | 'BARISTA' | 'PIZZA' | 'PASTRY';
}

interface OrderReadyPushPayload {
  orderId: string;
  dailyNumber: number;
}

interface OrderForceCancelledPushPayload {
  orderId: string;
  dailyNumber: number;
}

interface ShiftReminderPushPayload {
  shiftName: string;
  startTime: string;
  date: string;
}

export const fcmService = {
  /**
   * Sends a push notification to all active CHEF/KITCHEN_DISPLAY (or BARISTA/
   * BARISTA_DISPLAY) staff at a branch when a new order arrives.
   * Runs fire-and-forget — does not block order creation.
   */
  sendNewOrderPush: async (
    organizationId: string,
    payload: NewOrderPushPayload,
  ): Promise<void> => {
    try {
      if (!firebaseMessaging || !env.VAPID_KEY) {
        return;
      }

      const tokens = await authRepository.findFcmTokensByStation(organizationId, payload.station);
      if (tokens.length === 0) {
        return;
      }

      const stationLabels: Record<string, string> = {
        KITCHEN: 'Kitchen', PIZZA: 'Pizza', PASTRY: 'Pastry', BARISTA: 'Barista',
      };
      const stationLabel = stationLabels[payload.station] ?? payload.station;
      const link =
        payload.station === 'KITCHEN' || payload.station === 'PIZZA' || payload.station === 'PASTRY'
          ? '/app/kitchen'
          : '/app/barista';

      // sendEachForMulticast sends one message per token and handles
      // per-token failures gracefully — invalid tokens don't fail the batch.
      await firebaseMessaging.sendEachForMulticast({
        tokens,
        webpush: {
          headers: { Urgency: 'high' },
          notification: {
            title: `New Order #${payload.dailyNumber}`,
            body: `A new order has arrived at the ${stationLabel} station`,
            icon: '/android-chrome-192x192.png',
            badge: '/android-chrome-192x192.png',
            tag: `new-order-${payload.orderId}-${payload.station}`,
            renotify: true,
          },
          fcmOptions: { link },
        },
        data: {
          orderId: payload.orderId,
          station: payload.station,
        },
      });
    } catch (error) {
      logger.warn({ error, organizationId, orderId: payload.orderId }, 'Failed to send new order FCM push');
    }
  },

  sendOrderReadyPush: async (waiterId: string, payload: OrderReadyPushPayload): Promise<void> => {
    try {
      if (!firebaseMessaging) {
        return;
      }

      if (!env.VAPID_KEY) {
        return;
      }

      const fcmToken = await authRepository.findFcmToken(waiterId);
      if (!fcmToken) {
        return;
      }

      await firebaseMessaging.send({
        token: fcmToken,
        webpush: {
          headers: {
            Urgency: 'high',
          },
          notification: {
            title: 'Order Ready',
            body: `Order #${payload.dailyNumber} is ready for collection`,
            icon: '/favicon.ico',
          },
          fcmOptions: {
            link: '/app/orders',
          },
        },
        data: {
          orderId: payload.orderId,
        },
      });
    } catch (error) {
      logger.warn({ error, waiterId, orderId: payload.orderId }, 'Failed to send order ready FCM push');
    }
  },

  sendOrderForceCancelledPush: async (waiterId: string, payload: OrderForceCancelledPushPayload): Promise<void> => {
    try {
      if (!firebaseMessaging) {
        return;
      }

      if (!env.VAPID_KEY) {
        return;
      }

      const fcmToken = await authRepository.findFcmToken(waiterId);
      if (!fcmToken) {
        return;
      }

      await firebaseMessaging.send({
        token: fcmToken,
        webpush: {
          headers: {
            Urgency: 'high',
          },
          notification: {
            title: 'Order Cancelled',
            body: `Order #${payload.dailyNumber} was cancelled by a manager`,
            icon: '/favicon.ico',
          },
          fcmOptions: {
            link: '/app/orders',
          },
        },
        data: {
          orderId: payload.orderId,
        },
      });
    } catch (error) {
      logger.warn({ error, waiterId, orderId: payload.orderId }, 'Failed to send force cancel FCM push');
    }
  },

  /**
   * Sends a push notification to all active MANAGER/DIRECTOR staff at a branch
   * when stale (unclosed) orders from the previous day are detected.
   * Runs fire-and-forget — does not block the background job.
   */
  sendStaleOrdersPush: async (
    organizationId: string,
    staleCount: number,
  ): Promise<void> => {
    try {
      if (!firebaseMessaging || !env.VAPID_KEY) {
        return;
      }

      const tokens = await authRepository.findFcmTokensByRole(organizationId, ['MANAGER', 'DIRECTOR']);
      if (tokens.length === 0) {
        return;
      }

      await firebaseMessaging.sendEachForMulticast({
        tokens,
        webpush: {
          headers: { Urgency: 'normal' },
          notification: {
            title: 'Unclosed Orders Detected',
            body: `${staleCount} order${staleCount > 1 ? 's were' : ' was'} left open from yesterday`,
            icon: '/android-chrome-192x192.png',
            badge: '/android-chrome-192x192.png',
            tag: `stale-orders-${organizationId}`,
          },
          fcmOptions: {
            link: '/app/orders',
          },
        },
      });
    } catch (error) {
      logger.warn({ error, organizationId }, 'Failed to send stale orders FCM push');
    }
  },

  sendReadyOrderReminderPush: async (waiterId: string, count: number): Promise<void> => {
    try {
      if (!firebaseMessaging || !env.VAPID_KEY) {
        return;
      }

      const fcmToken = await authRepository.findFcmToken(waiterId);
      if (!fcmToken) {
        return;
      }

      await firebaseMessaging.send({
        token: fcmToken,
        webpush: {
          headers: { Urgency: 'normal' },
          notification: {
            title: 'Orders awaiting payment',
            body: `${count} order${count > 1 ? 's are' : ' is'} ready and waiting to be closed`,
            icon: '/android-chrome-192x192.png',
            badge: '/android-chrome-192x192.png',
            tag: `ready-reminder-${waiterId}`,
            renotify: true,
          },
          fcmOptions: { link: '/app/orders?status=READY' },
        },
      });
    } catch (error) {
      logger.warn({ error, waiterId }, 'Failed to send ready order reminder FCM push');
    }
  },

  /**
   * Sends a push notification to a specific FCM token with a custom title and body.
   * Used for inventory notifications (dispatch, discrepancy alerts).
   */
  sendGenericPush: async (fcmToken: string, payload: { title: string; body: string }): Promise<void> => {
    try {
      if (!firebaseMessaging || !env.VAPID_KEY) {
        return;
      }

      await firebaseMessaging.send({
        token: fcmToken,
        webpush: {
          headers: { Urgency: 'normal' },
          notification: {
            title: payload.title,
            body: payload.body,
            icon: '/android-chrome-192x192.png',
          },
        },
      });
    } catch (error) {
      logger.warn({ error, payload }, 'Failed to send generic FCM push');
    }
  },

  sendShiftReminderPush: async (userId: string, payload: ShiftReminderPushPayload): Promise<void> => {
    try {
      if (!firebaseMessaging) {
        return;
      }

      if (!env.VAPID_KEY) {
        return;
      }

      const fcmToken = await authRepository.findFcmToken(userId);
      if (!fcmToken) {
        return;
      }

      await firebaseMessaging.send({
        token: fcmToken,
        webpush: {
          headers: {
            Urgency: 'normal',
          },
          notification: {
            title: 'Shift Reminder',
            body: `You have a ${payload.shiftName} shift tomorrow at ${payload.startTime}`,
            icon: '/favicon.ico',
          },
          fcmOptions: {
            link: '/app/shifts',
          },
        },
        data: {
          shiftDate: payload.date,
          shiftName: payload.shiftName,
        },
      });
    } catch (error) {
      logger.warn({ error, userId, payload }, 'Failed to send shift reminder FCM push');
    }
  },
};
