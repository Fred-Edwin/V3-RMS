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
   * Sends an authorization request push to all active managers at a branch.
   * Used so managers are notified even when the app is in the background.
   */
  sendHouseAccountAuthPushToManagers: async (
    organizationId: string,
    payload: { orderId: string; dailyNumber: number; amount: string },
  ): Promise<void> => {
    try {
      if (!firebaseMessaging || !env.VAPID_KEY) {
        return;
      }

      const tokens = await authRepository.findFcmTokensByRole(organizationId, ['MANAGER']);
      if (tokens.length === 0) {
        return;
      }

      await Promise.allSettled(
        tokens.map((token) =>
          firebaseMessaging!.send({
            token,
            webpush: {
              headers: { Urgency: 'high' },
              notification: {
                title: `House Account Charge Pending — Order #${payload.dailyNumber}`,
                body: `KES ${payload.amount} awaiting your approval on the dashboard.`,
                icon: '/android-chrome-192x192.png',
                badge: '/android-chrome-192x192.png',
                tag: `house-auth-manager-${payload.orderId}`,
                renotify: true,
              },
              fcmOptions: { link: '/app/manage/dashboard' },
            },
            data: { orderId: payload.orderId },
          }),
        ),
      );
    } catch (error) {
      logger.warn({ error, organizationId }, 'Failed to send house account auth push to managers');
    }
  },

  /**
   * Sends an authorization request push to the house account holder.
   * The holder taps the notification to approve or reject the charge.
   */
  sendHouseAccountAuthPush: async (
    holderId: string,
    payload: { orderId: string; dailyNumber: number; amount: string; authRequestId: string },
  ): Promise<void> => {
    try {
      if (!firebaseMessaging || !env.VAPID_KEY) {
        return;
      }

      const fcmToken = await authRepository.findFcmToken(holderId);
      if (!fcmToken) {
        return;
      }

      await firebaseMessaging.send({
        token: fcmToken,
        webpush: {
          headers: { Urgency: 'high' },
          notification: {
            title: `Charge Request — Order #${payload.dailyNumber}`,
            body: `KES ${payload.amount} is being charged to your house account. Tap to approve or reject.`,
            icon: '/android-chrome-192x192.png',
            badge: '/android-chrome-192x192.png',
            tag: `house-auth-${payload.authRequestId}`,
            renotify: true,
          },
          fcmOptions: {
            link: `/app/house-account/authorize?requestId=${payload.authRequestId}`,
          },
        },
        data: {
          orderId: payload.orderId,
          authRequestId: payload.authRequestId,
        },
      });
    } catch (error) {
      logger.warn({ error, holderId, orderId: payload.orderId }, 'Failed to send house account auth FCM push');
    }
  },

  /**
   * Notifies the waiter of the authorization outcome (approved, rejected, or timed out).
   */
  sendAuthResolutionPush: async (
    waiterId: string,
    payload: { dailyNumber: number; approved: boolean; reason?: string },
  ): Promise<void> => {
    try {
      if (!firebaseMessaging || !env.VAPID_KEY) {
        return;
      }

      const fcmToken = await authRepository.findFcmToken(waiterId);
      if (!fcmToken) {
        return;
      }

      const approved = payload.approved;
      await firebaseMessaging.send({
        token: fcmToken,
        webpush: {
          headers: { Urgency: 'high' },
          notification: {
            title: approved ? 'House Account Approved' : 'House Account Rejected',
            body: approved
              ? `Order #${payload.dailyNumber} has been approved and closed.`
              : `Order #${payload.dailyNumber} was rejected — please collect payment another way.`,
            icon: '/android-chrome-192x192.png',
            badge: '/android-chrome-192x192.png',
            tag: `house-auth-resolution-${payload.dailyNumber}`,
          },
          fcmOptions: { link: '/app/orders' },
        },
      });
    } catch (error) {
      logger.warn({ error, waiterId }, 'Failed to send auth resolution FCM push');
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
