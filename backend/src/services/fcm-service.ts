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
    siteId: string,
    payload: NewOrderPushPayload,
  ): Promise<void> => {
    try {
      if (!firebaseMessaging || !env.VAPID_KEY) {
        return;
      }

      const tokens = await authRepository.findFcmTokensByStation(siteId, payload.station);
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
      logger.warn({ error, siteId, orderId: payload.orderId }, 'Failed to send new order FCM push');
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
    siteId: string,
    staleCount: number,
  ): Promise<void> => {
    try {
      if (!firebaseMessaging || !env.VAPID_KEY) {
        return;
      }

      const tokens = await authRepository.findFcmTokensByRole(siteId, ['MANAGER', 'DIRECTOR']);
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
            tag: `stale-orders-${siteId}`,
          },
          fcmOptions: {
            link: '/app/orders',
          },
        },
      });
    } catch (error) {
      logger.warn({ error, siteId }, 'Failed to send stale orders FCM push');
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
    siteId: string,
    payload: { orderId: string; dailyNumber: number; amount: string },
  ): Promise<void> => {
    try {
      if (!firebaseMessaging || !env.VAPID_KEY) {
        return;
      }

      const tokens = await authRepository.findFcmTokensByRole(siteId, ['MANAGER']);
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
      logger.warn({ error, siteId }, 'Failed to send house account auth push to managers');
    }
  },

  /**
   * Sends an approval request push to every active DIRECTOR when a waiter requests
   * a staff discount on their own READY order. Directors are system-level (no
   * organizationId), so recipients are resolved by role alone. Fire-and-forget —
   * must never block or fail staff-discount request creation.
   */
  sendStaffDiscountAuthPushToDirectors: async (
    payload: {
      orderId: string;
      dailyNumber: number;
      requesterName: string;
      originalAmount: string;
      discountedAmount: string;
    },
  ): Promise<void> => {
    try {
      if (!firebaseMessaging || !env.VAPID_KEY) {
        return;
      }

      const tokens = await authRepository.findDirectorFcmTokens();
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
                title: 'Staff discount needs approval',
                body: `${payload.requesterName} · Order #${payload.dailyNumber} · KES ${payload.originalAmount} → KES ${payload.discountedAmount}`,
                icon: '/android-chrome-192x192.png',
                badge: '/android-chrome-192x192.png',
                tag: `staff-discount-auth-${payload.orderId}`,
                renotify: true,
              },
              fcmOptions: { link: '/app/director' },
            },
            data: { type: 'staff_discount_auth', orderId: payload.orderId },
          }),
        ),
      );
    } catch (error) {
      logger.warn({ error, orderId: payload.orderId }, 'Failed to send staff discount auth push to directors');
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

  // ─── Internal Communications ───────────────────────────────────────────

  /**
   * Notifies a single staff member that they received a new DM.
   * Fire-and-forget.
   */
  sendDirectMessagePush: async (
    recipientId: string,
    payload: { conversationId: string; senderName: string; preview: string },
  ): Promise<void> => {
    try {
      if (!firebaseMessaging || !env.VAPID_KEY) return;
      const token = await authRepository.findFcmToken(recipientId);
      if (!token) return;
      await firebaseMessaging.send({
        token,
        webpush: {
          headers: { Urgency: 'normal' },
          notification: {
            title: `Message from ${payload.senderName}`,
            body: payload.preview,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            tag: `dm-${payload.conversationId}`,
            renotify: true,
          },
          fcmOptions: { link: '/app/inbox' },
        },
        data: { conversationId: payload.conversationId, type: 'dm' },
      });
    } catch (error) {
      logger.warn({ error, recipientId }, 'Failed to send DM FCM push');
    }
  },

  /**
   * Notifies multiple recipients that a broadcast was sent.
   * Batches in groups of 500 (FCM multicast limit).
   * Fire-and-forget.
   */
  sendBroadcastPush: async (
    recipientIds: string[],
    payload: { broadcastId: string; subject: string; senderName: string },
  ): Promise<void> => {
    try {
      if (!firebaseMessaging || !env.VAPID_KEY || recipientIds.length === 0) return;
      // Fetch all tokens at once
      const users = await Promise.all(recipientIds.map((id) => authRepository.findFcmToken(id)));
      const tokens = users.filter((t): t is string => t !== null);
      if (tokens.length === 0) return;
      // Batch into chunks of 500
      const BATCH = 500;
      for (let i = 0; i < tokens.length; i += BATCH) {
        const batch = tokens.slice(i, i + BATCH);
        await firebaseMessaging.sendEachForMulticast({
          tokens: batch,
          webpush: {
            headers: { Urgency: 'normal' },
            notification: {
              title: `Announcement: ${payload.subject}`,
              body: `From ${payload.senderName}`,
              icon: '/favicon.ico',
              badge: '/favicon.ico',
              tag: `broadcast-${payload.broadcastId}`,
            },
            fcmOptions: { link: '/app/inbox' },
          },
          data: { broadcastId: payload.broadcastId, type: 'broadcast' },
        });
      }
    } catch (error) {
      logger.warn({ error, payload }, 'Failed to send broadcast FCM push');
    }
  },

  /**
   * Tells the hub Accountant(s) a cheque payment method was added to a supplier.
   * Fire-and-forget — never blocks or fails the request.
   */
  sendChequeMethodAddedPush: async (
    recipientIds: string[],
    payload: { supplierId: string; supplierName: string; addedByName: string; reason: string },
  ): Promise<void> => {
    try {
      if (!firebaseMessaging || !env.VAPID_KEY || recipientIds.length === 0) return;
      const users = await Promise.all(recipientIds.map((id) => authRepository.findFcmToken(id)));
      const tokens = users.filter((t): t is string => t !== null);
      if (tokens.length === 0) return;
      await firebaseMessaging.sendEachForMulticast({
        tokens,
        webpush: {
          headers: { Urgency: 'normal' },
          notification: {
            title: `Cheque method added — ${payload.supplierName}`,
            body: `${payload.addedByName}: ${payload.reason}`,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            tag: `supplier-cheque-${payload.supplierId}`,
          },
          fcmOptions: { link: `/app/inventory/suppliers/${payload.supplierId}` },
        },
        data: { supplierId: payload.supplierId, type: 'supplier-cheque-method-added' },
      });
    } catch (error) {
      logger.warn({ error, payload }, 'Failed to send cheque-method-added FCM push');
    }
  },

  /** A supplier's payment details were added or changed (any kind but a cheque add) — pushes to the hub's Accountant(s). */
  sendPayMethodChangedPush: async (
    recipientIds: string[],
    payload: { supplierId: string; supplierName: string; changedByName: string; summary: string; reason: string },
  ): Promise<void> => {
    try {
      if (!firebaseMessaging || !env.VAPID_KEY || recipientIds.length === 0) return;
      const users = await Promise.all(recipientIds.map((id) => authRepository.findFcmToken(id)));
      const tokens = users.filter((t): t is string => t !== null);
      if (tokens.length === 0) return;
      await firebaseMessaging.sendEachForMulticast({
        tokens,
        webpush: {
          headers: { Urgency: 'normal' },
          notification: {
            title: `Payment details changed — ${payload.supplierName}`,
            body: `${payload.changedByName}: ${payload.summary}. ${payload.reason}`,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            tag: `supplier-pay-method-${payload.supplierId}`,
          },
          fcmOptions: { link: `/app/inventory/suppliers/${payload.supplierId}` },
        },
        data: { supplierId: payload.supplierId, type: 'supplier-pay-method-changed' },
      });
    } catch (error) {
      logger.warn({ error, payload }, 'Failed to send pay-method-changed FCM push');
    }
  },

  /**
   * Sends a 24h reminder to a staff member who has not acknowledged a formal notice.
   * Fire-and-forget.
   */
  sendFormalNoticePush: async (
    recipientId: string,
    payload: { noticeId: string; subject: string },
  ): Promise<void> => {
    try {
      if (!firebaseMessaging || !env.VAPID_KEY) return;
      const token = await authRepository.findFcmToken(recipientId);
      if (!token) return;
      await firebaseMessaging.send({
        token,
        webpush: {
          headers: { Urgency: 'high' },
          notification: {
            title: 'Action required: Formal Notice',
            body: `Please acknowledge: ${payload.subject}`,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            tag: `notice-${payload.noticeId}`,
            renotify: true,
          },
          fcmOptions: { link: '/app/inbox' },
        },
        data: { noticeId: payload.noticeId, type: 'formal_notice' },
      });
    } catch (error) {
      logger.warn({ error, recipientId }, 'Failed to send formal notice FCM push');
    }
  },

  /**
   * Sends a 48h escalation push to directors/HR when a formal notice is still unacknowledged.
   * Fire-and-forget.
   */
  sendFormalNoticeEscalationPush: async (
    directorTokens: string[],
    payload: { noticeId: string; subject: string; recipientName: string },
  ): Promise<void> => {
    try {
      if (!firebaseMessaging || !env.VAPID_KEY || directorTokens.length === 0) return;
      await firebaseMessaging.sendEachForMulticast({
        tokens: directorTokens,
        webpush: {
          headers: { Urgency: 'high' },
          notification: {
            title: 'Escalation: Unacknowledged Notice (48h)',
            body: `${payload.recipientName} has not acknowledged: ${payload.subject}`,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            tag: `notice-escalation-${payload.noticeId}`,
            renotify: true,
          },
          fcmOptions: { link: '/app/inbox' },
        },
        data: { noticeId: payload.noticeId, type: 'notice_escalation' },
      });
    } catch (error) {
      logger.warn({ error, payload }, 'Failed to send formal notice escalation FCM push');
    }
  },

  /** Notifies management (manager/HR/director) of a new leave request. Fire-and-forget. */
  sendLeaveRequestPush: async (
    recipientId: string,
    payload: { requesterName: string; leaveType: string; dateRange: string; requestId: string },
  ): Promise<void> => {
    try {
      const token = await authRepository.findFcmToken(recipientId);
      if (!firebaseMessaging || !env.VAPID_KEY || !token) return;
      await firebaseMessaging.send({
        token,
        webpush: {
          headers: { Urgency: 'high' },
          notification: {
            title: 'New Leave Request',
            body: `${payload.leaveType} leave request for ${payload.dateRange}`,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            tag: `leave-request-${payload.requestId}`,
          },
          fcmOptions: { link: '/app/hr/leave' },
        },
        data: { requestId: payload.requestId, type: 'leave_request' },
      });
    } catch (error) {
      logger.warn({ error, payload }, 'Failed to send leave request FCM push');
    }
  },

  /** Notifies a staff member of a leave approval or rejection. Fire-and-forget. */
  sendLeaveDecisionPush: async (
    recipientId: string,
    payload: { decision: 'APPROVED' | 'REJECTED'; leaveType: string; reviewerName: string; comment?: string },
  ): Promise<void> => {
    try {
      const token = await authRepository.findFcmToken(recipientId);
      if (!firebaseMessaging || !env.VAPID_KEY || !token) return;
      const isApproved = payload.decision === 'APPROVED';
      await firebaseMessaging.send({
        token,
        webpush: {
          headers: { Urgency: 'high' },
          notification: {
            title: isApproved ? 'Leave Approved' : 'Leave Request Declined',
            body: isApproved
              ? `Your ${payload.leaveType} leave has been approved`
              : `Your ${payload.leaveType} leave was not approved${payload.comment ? `: ${payload.comment}` : ''}`,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            tag: `leave-decision-${Date.now()}`,
          },
          fcmOptions: { link: '/app/hr/my-leave' },
        },
        data: { type: 'leave_decision', decision: payload.decision },
      });
    } catch (error) {
      logger.warn({ error, payload }, 'Failed to send leave decision FCM push');
    }
  },

  /** Notifies a staff member of a disciplinary action. Fire-and-forget. */
  sendDisciplinaryNoticePush: async (
    recipientId: string,
    payload: { actionTaken: string; issuedBy: string },
  ): Promise<void> => {
    try {
      const token = await authRepository.findFcmToken(recipientId);
      if (!firebaseMessaging || !env.VAPID_KEY || !token) return;
      await firebaseMessaging.send({
        token,
        webpush: {
          headers: { Urgency: 'high' },
          notification: {
            title: 'HR Notice',
            body: `A ${payload.actionTaken} has been recorded on your file. Please check your HR profile.`,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            tag: `disciplinary-${Date.now()}`,
          },
          fcmOptions: { link: '/app/hr/my-leave' },
        },
        data: { type: 'disciplinary_notice' },
      });
    } catch (error) {
      logger.warn({ error, payload }, 'Failed to send disciplinary notice FCM push');
    }
  },

  // ==========================================================================
  // PHASE 2 — Requisition / Dispatch (D-16, D-18)
  // ==========================================================================

  /** Notifies the branch's Managers a requisition is awaiting their approval. Fire-and-forget. */
  sendRequisitionSubmittedPush: async (
    siteId: string,
    payload: { requisitionId: string; departmentTag: string },
  ): Promise<void> => {
    try {
      if (!firebaseMessaging || !env.VAPID_KEY) return;
      const tokens = await authRepository.findFcmTokensByRole(siteId, ['MANAGER']);
      if (tokens.length === 0) return;

      await firebaseMessaging.sendEachForMulticast({
        tokens,
        webpush: {
          headers: { Urgency: 'high' },
          notification: {
            title: 'Requisition awaiting approval',
            body: `${payload.departmentTag} has submitted a requisition for your approval`,
            icon: '/android-chrome-192x192.png',
            badge: '/android-chrome-192x192.png',
            tag: `requisition-submitted-${payload.requisitionId}`,
          },
          fcmOptions: { link: '/app/branch/requisitions' },
        },
        data: { type: 'requisition_submitted', requisitionId: payload.requisitionId },
      });
    } catch (error) {
      logger.warn({ error, payload }, 'Failed to send requisition submitted FCM push');
    }
  },

  /** Notifies the Department Head their requisition was approved or rejected. Fire-and-forget. */
  sendRequisitionDecisionPush: async (
    departmentHeadId: string,
    payload: { requisitionId: string; decision: 'APPROVED' | 'REJECTED'; reason?: string },
  ): Promise<void> => {
    try {
      const token = await authRepository.findFcmToken(departmentHeadId);
      if (!firebaseMessaging || !env.VAPID_KEY || !token) return;

      const body =
        payload.decision === 'APPROVED'
          ? 'Your requisition was approved and is on its way to the Central Store'
          : `Your requisition was rejected${payload.reason ? `: ${payload.reason}` : ''}`;

      await firebaseMessaging.send({
        token,
        webpush: {
          headers: { Urgency: 'high' },
          notification: {
            title: payload.decision === 'APPROVED' ? 'Requisition approved' : 'Requisition rejected',
            body,
            icon: '/android-chrome-192x192.png',
            badge: '/android-chrome-192x192.png',
            tag: `requisition-decision-${payload.requisitionId}`,
          },
          fcmOptions: { link: '/app/requisitions' },
        },
        data: { type: 'requisition_decision', requisitionId: payload.requisitionId, decision: payload.decision },
      });
    } catch (error) {
      logger.warn({ error, payload }, 'Failed to send requisition decision FCM push');
    }
  },

  /** Notifies a Department Head their section was bounced back by the Branch Manager. Fire-and-forget. */
  sendRequisitionSectionReturnedPush: async (
    departmentHeadId: string,
    payload: { requisitionId: string; departmentTag: string; returnedNote: string },
  ): Promise<void> => {
    try {
      const token = await authRepository.findFcmToken(departmentHeadId);
      if (!firebaseMessaging || !env.VAPID_KEY || !token) return;

      await firebaseMessaging.send({
        token,
        webpush: {
          headers: { Urgency: 'high' },
          notification: {
            title: 'Section returned',
            body: `Your ${payload.departmentTag} section was returned: ${payload.returnedNote}`,
            icon: '/android-chrome-192x192.png',
            badge: '/android-chrome-192x192.png',
            tag: `requisition-returned-${payload.requisitionId}`,
          },
          fcmOptions: { link: '/app/requisitions' },
        },
        data: { type: 'requisition_section_returned', requisitionId: payload.requisitionId },
      });
    } catch (error) {
      logger.warn({ error, payload }, 'Failed to send requisition section returned FCM push');
    }
  },

  /** Notifies a Department Head the Branch Manager is waiting on their not-yet-started section. Fire-and-forget. */
  sendRequisitionNudgePush: async (
    departmentHeadId: string,
    payload: { requisitionId: string; departmentTag: string },
  ): Promise<void> => {
    try {
      const token = await authRepository.findFcmToken(departmentHeadId);
      if (!firebaseMessaging || !env.VAPID_KEY || !token) return;

      await firebaseMessaging.send({
        token,
        webpush: {
          headers: { Urgency: 'high' },
          notification: {
            title: 'Requisition waiting on you',
            body: `Your ${payload.departmentTag} section still needs to be filled`,
            icon: '/android-chrome-192x192.png',
            badge: '/android-chrome-192x192.png',
            tag: `requisition-nudge-${payload.requisitionId}`,
          },
          fcmOptions: { link: '/app/requisitions' },
        },
        data: { type: 'requisition_nudge', requisitionId: payload.requisitionId },
      });
    } catch (error) {
      logger.warn({ error, payload }, 'Failed to send requisition nudge FCM push');
    }
  },

  /** Notifies the Department Head a dispatch is on the way. Fire-and-forget. */
  sendDispatchInTransitPush: async (
    departmentHeadId: string,
    payload: { dispatchId: string; deliveryNoteNumber: string | null },
  ): Promise<void> => {
    try {
      const token = await authRepository.findFcmToken(departmentHeadId);
      if (!firebaseMessaging || !env.VAPID_KEY || !token) return;

      await firebaseMessaging.send({
        token,
        webpush: {
          headers: { Urgency: 'high' },
          notification: {
            title: 'Delivery on the way',
            body: `A delivery from the Central Store is in transit${payload.deliveryNoteNumber ? ` (${payload.deliveryNoteNumber})` : ''}`,
            icon: '/android-chrome-192x192.png',
            badge: '/android-chrome-192x192.png',
            tag: `dispatch-in-transit-${payload.dispatchId}`,
          },
          fcmOptions: { link: '/app/inventory/receive' },
        },
        data: { type: 'dispatch_in_transit', dispatchId: payload.dispatchId },
      });
    } catch (error) {
      logger.warn({ error, payload }, 'Failed to send dispatch in-transit FCM push');
    }
  },

  /** Notifies the Central Store roles a delivery was received with a variance. Fire-and-forget. */
  sendReceiptVariancePush: async (
    hubSiteId: string,
    payload: { dispatchId: string; itemCount: number },
  ): Promise<void> => {
    try {
      if (!firebaseMessaging || !env.VAPID_KEY) return;
      const tokens = await authRepository.findFcmTokensByRole(hubSiteId, [
        'STORE_MANAGER',
        'STORE_ATTENDANT',
      ]);
      if (tokens.length === 0) return;

      await firebaseMessaging.sendEachForMulticast({
        tokens,
        webpush: {
          headers: { Urgency: 'normal' },
          notification: {
            title: 'Delivery variance recorded',
            body: `${payload.itemCount} line(s) on a received delivery did not match what was dispatched`,
            icon: '/android-chrome-192x192.png',
            badge: '/android-chrome-192x192.png',
            tag: `dispatch-variance-${payload.dispatchId}`,
          },
          fcmOptions: { link: '/app/inventory/dispatches' },
        },
        data: { type: 'dispatch_variance', dispatchId: payload.dispatchId },
      });
    } catch (error) {
      logger.warn({ error, payload }, 'Failed to send receipt variance FCM push');
    }
  },

  /** Notifies the Central Store's Store Manager(s) a daily count awaits verification. Fire-and-forget. */
  sendCountSubmittedPush: async (
    hubSiteId: string,
    payload: { countId: string; reference: string; counterName: string; countedLines: number },
  ): Promise<void> => {
    try {
      if (!firebaseMessaging || !env.VAPID_KEY) return;
      const tokens = await authRepository.findFcmTokensByRole(hubSiteId, ['STORE_MANAGER']);
      if (tokens.length === 0) return;

      await firebaseMessaging.sendEachForMulticast({
        tokens,
        webpush: {
          headers: { Urgency: 'normal' },
          notification: {
            title: 'Daily count awaiting verification',
            body: `${payload.counterName} submitted ${payload.reference} · ${payload.countedLines} items counted`,
            icon: '/android-chrome-192x192.png',
            badge: '/android-chrome-192x192.png',
            tag: `count-submitted-${payload.countId}`,
          },
          fcmOptions: { link: '/app/inventory/stock/counts' },
        },
        data: { type: 'count_submitted', countId: payload.countId },
      });
    } catch (error) {
      logger.warn({ error, payload }, 'Failed to send count submitted FCM push');
    }
  },

  /** Notifies Directors a verified count has lines at or above the Director alert amount. Fire-and-forget. */
  sendCountDirectorAlertPush: async (payload: {
    countId: string;
    reference: string;
    alertLineCount: number;
    largestValueKes: string;
  }): Promise<void> => {
    try {
      if (!firebaseMessaging || !env.VAPID_KEY) return;
      const tokens = await authRepository.findDirectorFcmTokens();
      if (tokens.length === 0) return;

      await Promise.allSettled(
        tokens.map((token) =>
          firebaseMessaging!.send({
            token,
            webpush: {
              headers: { Urgency: 'high' },
              notification: {
                title: 'Large stock variance',
                body: `${payload.reference} · ${payload.alertLineCount} line(s) at or above the alert amount · largest KES ${payload.largestValueKes}`,
                icon: '/android-chrome-192x192.png',
                badge: '/android-chrome-192x192.png',
                tag: `count-director-alert-${payload.countId}`,
              },
              fcmOptions: { link: '/app/director' },
            },
            data: { type: 'count_director_alert', countId: payload.countId },
          }),
        ),
      );
    } catch (error) {
      logger.warn({ error, payload }, 'Failed to send count director alert FCM push');
    }
  },

  /** Branch day close — a signed line at or above the company-wide alert amount (plan §3). */
  sendBranchDayDirectorAlertPush: async (payload: {
    dayId: string;
    reference: string;
    branchName: string;
    alertLineCount: number;
    largestValueKes: string;
  }): Promise<void> => {
    try {
      if (!firebaseMessaging || !env.VAPID_KEY) return;
      const tokens = await authRepository.findDirectorFcmTokens();
      if (tokens.length === 0) return;

      await Promise.allSettled(
        tokens.map((token) =>
          firebaseMessaging!.send({
            token,
            webpush: {
              headers: { Urgency: 'high' },
              notification: {
                title: 'Large branch stock gap',
                body: `${payload.branchName} · ${payload.reference} · ${payload.alertLineCount} line(s) at or above the alert amount · largest KES ${payload.largestValueKes}`,
                icon: '/android-chrome-192x192.png',
                badge: '/android-chrome-192x192.png',
                tag: `branch-day-director-alert-${payload.dayId}`,
              },
              fcmOptions: { link: '/app/director' },
            },
            data: { type: 'branch_day_director_alert', dayId: payload.dayId },
          }),
        ),
      );
    } catch (error) {
      logger.warn({ error, payload }, 'Failed to send branch day director alert FCM push');
    }
  },

  /** Next-morning opening — an overnight variance at or above the branch's alert amount (plan §3). */
  sendOvernightVarianceAlertPush: async (
    siteId: string,
    payload: { dayId: string; departmentName: string; alertLineCount: number; largestValueKes: string },
  ): Promise<void> => {
    try {
      if (!firebaseMessaging || !env.VAPID_KEY) return;
      const tokens = await authRepository.findFcmTokensByRole(siteId, ['MANAGER']);
      if (tokens.length === 0) return;

      await firebaseMessaging.sendEachForMulticast({
        tokens,
        webpush: {
          headers: { Urgency: 'high' },
          notification: {
            title: 'Overnight stock variance',
            body: `${payload.departmentName} · ${payload.alertLineCount} line(s) differ from last night's close · largest KES ${payload.largestValueKes}`,
            icon: '/android-chrome-192x192.png',
            badge: '/android-chrome-192x192.png',
            tag: `overnight-variance-${payload.dayId}-${payload.departmentName}`,
          },
          fcmOptions: { link: '/app/branch/day' },
        },
        data: { type: 'overnight_variance_alert', dayId: payload.dayId },
      });
    } catch (error) {
      logger.warn({ error, payload }, 'Failed to send overnight variance FCM push');
    }
  },

};
