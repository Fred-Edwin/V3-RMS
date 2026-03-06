import { authRepository } from '../repositories/auth-repository';
import { firebaseMessaging } from '../config/firebase';
import { env } from '../config/env';
import { logger } from '../utils/logger';

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
