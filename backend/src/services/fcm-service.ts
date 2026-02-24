import { authRepository } from '../repositories/auth-repository';
import { firebaseMessaging } from '../config/firebase';
import { env } from '../config/env';
import { logger } from '../utils/logger';

interface OrderReadyPushPayload {
  orderId: string;
  dailyNumber: number;
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
};
