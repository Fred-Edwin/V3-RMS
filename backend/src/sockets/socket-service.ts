import type { PrepStation } from '@prisma/client';
import type { PrepTicketRecord } from '../types/order.types';
import { branchRoomName, getSocketServer, stationRoomName, userRoomName } from './socket';

export interface OrderClaimedPayload {
  orderId: string;
  ticketId: string;
  station: PrepStation;
  dailyNumber: number;
  claimedBy: {
    id: string;
    name: string;
  };
}

export interface OrderReadyPayload {
  orderId: string;
  ticketId: string;
  station: PrepStation;
  dailyNumber: number;
}

export interface OrderAllReadyPayload {
  orderId: string;
  dailyNumber: number;
}

export interface OrderPaidPayload {
  orderId: string;
  dailyNumber: number;
}

export interface OrderClosedPayload {
  orderId: string;
  dailyNumber: number;
}

const emitToStations = (
  organizationId: string,
  stations: PrepStation[],
  eventName: string,
  payload: unknown,
): void => {
  const io = getSocketServer();
  const uniqueStations = [...new Set(stations)];

  uniqueStations.forEach((station) => {
    io.to(stationRoomName(organizationId, station)).emit(eventName, payload);
  });
};

export const socketService = {
  emitNewOrder: (organizationId: string, tickets: PrepTicketRecord[]): void => {
    const io = getSocketServer();
    tickets.forEach((ticket) => {
      io.to(stationRoomName(organizationId, ticket.station)).emit('order:new', ticket);
    });
  },

  emitOrderClaimed: (organizationId: string, waiterId: string, payload: OrderClaimedPayload): void => {
    const io = getSocketServer();
    io.to(userRoomName(waiterId)).emit('order:claimed', payload);
    io.to(stationRoomName(organizationId, payload.station)).emit('order:claimed', payload);
  },

  emitOrderReady: (waiterId: string, payload: OrderReadyPayload): void => {
    const io = getSocketServer();
    io.to(userRoomName(waiterId)).emit('order:ready', payload);
  },

  emitOrderAllReady: (waiterId: string, payload: OrderAllReadyPayload): void => {
    const io = getSocketServer();
    io.to(userRoomName(waiterId)).emit('order:all_ready', payload);
  },

  emitOrderPaid: (waiterId: string, payload: OrderPaidPayload): void => {
    const io = getSocketServer();
    io.to(userRoomName(waiterId)).emit('order:paid', payload);
  },

  emitOrderClosed: (organizationId: string, stations: PrepStation[], payload: OrderClosedPayload): void => {
    emitToStations(organizationId, stations, 'order:closed', payload);
  },

  emitOrderModified: (organizationId: string, tickets: PrepTicketRecord[]): void => {
    const io = getSocketServer();
    tickets.forEach((ticket) => {
      io.to(stationRoomName(organizationId, ticket.station)).emit('order:modified', ticket);
    });
  },

  emitOrderCancelled: (organizationId: string, stations: PrepStation[], payload: { orderId: string }): void => {
    emitToStations(organizationId, stations, 'order:cancelled', payload);
  },

  emitOrderForceCancelled: (
    organizationId: string,
    stations: PrepStation[],
    waiterId: string,
    payload: { orderId: string; dailyNumber: number; cancelledBy: string },
  ): void => {
    emitToStations(organizationId, stations, 'order:force_cancelled', payload);
    const io = getSocketServer();
    // Notify the waiter who owns the order
    io.to(userRoomName(waiterId)).emit('order:force_cancelled', payload);
    // Also broadcast to the branch room so managers (who are not in station rooms)
    // receive the event and can remove the order from their active list
    io.to(branchRoomName(organizationId)).emit('order:force_cancelled', payload);
  },

  emitOrderCancellationPending: (
    waiterId: string,
    organizationId: string,
    payload: {
      orderId: string;
      dailyNumber: number;
      authRequestId: string;
      requestedById: string;
      reason: string;
    },
  ): void => {
    const io = getSocketServer();
    io.to(userRoomName(waiterId)).emit('order:cancellation_pending', payload);
    io.to(branchRoomName(organizationId)).emit('order:cancellation_pending', payload);
  },

  emitOrderCancellationResolved: (
    waiterId: string,
    organizationId: string,
    payload: {
      orderId: string;
      dailyNumber: number;
      authRequestId: string;
      approved: boolean;
      restoredStatus?: string;
    },
  ): void => {
    const io = getSocketServer();
    io.to(userRoomName(waiterId)).emit('order:cancellation_resolved', payload);
    io.to(branchRoomName(organizationId)).emit('order:cancellation_resolved', payload);
  },

  emitTicketRejected: (
    organizationId: string,
    waiterId: string,
    payload: { orderId: string; ticketId: string; station: PrepStation; dailyNumber: number; reason: string },
  ): void => {
    const io = getSocketServer();
    io.to(userRoomName(waiterId)).emit('ticket:rejected', payload);
    io.to(stationRoomName(organizationId, payload.station)).emit('ticket:rejected', payload);
  },

  emitTicketUnclaimed: (
    organizationId: string,
    waiterId: string,
    payload: { orderId: string; ticketId: string; station: PrepStation; dailyNumber: number },
  ): void => {
    const io = getSocketServer();
    io.to(userRoomName(waiterId)).emit('ticket:unclaimed', payload);
    io.to(stationRoomName(organizationId, payload.station)).emit('ticket:unclaimed', payload);
  },

  emitModificationRequested: (
    organizationId: string,
    stations: PrepStation[],
    payload: { requestId: string; orderId: string; dailyNumber: number; description: string; requestedBy: { id: string; name: string } },
  ): void => {
    emitToStations(organizationId, stations, 'modification:requested', payload);
  },

  emitModificationReviewed: (
    waiterId: string,
    payload: { requestId: string; orderId: string; status: string; reviewNote: string | null },
  ): void => {
    const io = getSocketServer();
    io.to(userRoomName(waiterId)).emit('modification:reviewed', payload);
  },

  emitIncident: (organizationId: string, payload: unknown): void => {
    const io = getSocketServer();
    io.to(branchRoomName(organizationId)).emit('incident:new', payload);
  },

  /**
   * Emits to the branch room when a house account payment bypasses authorization
   * (account holder has no FCM token). Managers can see this in real time.
   */
  emitAuthBypassed: (
    organizationId: string,
    payload: { orderId: string; dailyNumber: number; houseAccountId: string },
  ): void => {
    const io = getSocketServer();
    io.to(branchRoomName(organizationId)).emit('order:auth_bypassed', payload);
  },

  /** Notifies the waiter's session that a house account auth is pending (order locked),
   *  and broadcasts the status change to the branch room so managers/directors update too. */
  emitAuthPending: (
    waiterId: string,
    organizationId: string,
    payload: { orderId: string; dailyNumber: number; authRequestId: string },
  ): void => {
    const io = getSocketServer();
    io.to(userRoomName(waiterId)).emit('order:auth_pending', payload);
    io.to(branchRoomName(organizationId)).emit('order:auth_pending', payload);
  },

  /** Notifies the waiter and all branch members that the authorization was resolved. */
  emitAuthResolved: (
    waiterId: string,
    organizationId: string,
    payload: { orderId: string; dailyNumber: number; approved: boolean },
  ): void => {
    const io = getSocketServer();
    io.to(userRoomName(waiterId)).emit('order:auth_resolved', payload);
    io.to(branchRoomName(organizationId)).emit('order:auth_resolved', payload);
  },

  /** Notifies the waiter that a staff discount approval is pending, and broadcasts to branch so
   *  managers see the order card update immediately. */
  emitStaffDiscountAuthPending: (
    waiterId: string,
    organizationId: string,
    payload: {
      orderId: string;
      dailyNumber: number;
      authRequestId: string;
      originalAmount: string;
      discountAmount: string;
    },
  ): void => {
    const io = getSocketServer();
    io.to(userRoomName(waiterId)).emit('order:staff_discount_pending', payload);
    io.to(branchRoomName(organizationId)).emit('order:staff_discount_pending', payload);
  },

  /** Notifies the waiter and all branch members that the staff discount was approved or rejected. */
  emitStaffDiscountAuthResolved: (
    waiterId: string,
    organizationId: string,
    payload: { orderId: string; dailyNumber: number; approved: boolean; discountedTotal?: string },
  ): void => {
    const io = getSocketServer();
    io.to(userRoomName(waiterId)).emit('order:staff_discount_resolved', payload);
    io.to(branchRoomName(organizationId)).emit('order:staff_discount_resolved', payload);
  },

  /** Notifies the waiter that a customer discount approval is pending, and broadcasts to branch
   *  so managers see the pending request immediately. */
  emitCustomerDiscountAuthPending: (
    waiterId: string,
    organizationId: string,
    payload: {
      orderId: string;
      dailyNumber: number;
      authRequestId: string;
      discountName: string;
      originalAmount: string;
      discountAmount: string;
    },
  ): void => {
    const io = getSocketServer();
    io.to(userRoomName(waiterId)).emit('order:customer_discount_pending', payload);
    io.to(branchRoomName(organizationId)).emit('order:customer_discount_pending', payload);
  },

  /** Notifies the waiter and all branch members that the customer discount was approved or rejected. */
  emitCustomerDiscountAuthResolved: (
    waiterId: string,
    organizationId: string,
    payload: { orderId: string; dailyNumber: number; approved: boolean; discountedTotal?: string },
  ): void => {
    const io = getSocketServer();
    io.to(userRoomName(waiterId)).emit('order:customer_discount_resolved', payload);
    io.to(branchRoomName(organizationId)).emit('order:customer_discount_resolved', payload);
  },

  // ─── Internal Communications ─────────────────────────────────────────────

  /** Delivers a new DM in real-time to the recipient's personal room. */
  emitNewDirectMessage: (
    recipientUserId: string,
    payload: {
      conversationId: string;
      message: {
        id: string;
        senderId: string;
        senderName: string;
        bodyHtml: string;
        attachmentUrl: string | null;
        attachmentName: string | null;
        createdAt: string;
      };
    },
  ): void => {
    const io = getSocketServer();
    io.to(userRoomName(recipientUserId)).emit('comms:dm_received', payload);
  },

  /** Notifies the original sender that their message has been read. */
  emitMessageRead: (
    senderUserId: string,
    payload: { messageId: string; conversationId: string; readAt: string },
  ): void => {
    const io = getSocketServer();
    io.to(userRoomName(senderUserId)).emit('comms:message_read', payload);
  },

  /** Delivers a new broadcast to all connected staff in a branch room,
   *  plus any system-level users (DIRECTOR, HR_MANAGER) who are online. */
  emitNewBroadcast: (
    organizationId: string,
    payload: {
      broadcastId: string;
      subject: string;
      senderName: string;
      requiresAck: boolean;
      createdAt: string;
    },
  ): void => {
    const io = getSocketServer();
    io.to(branchRoomName(organizationId)).emit('comms:broadcast_received', payload);
    // Also deliver to system-level roles (DIRECTOR, HR_MANAGER) who have no branch room
    void io.fetchSockets().then((sockets) => {
      for (const s of sockets) {
        const auth = (s.data as { auth?: { role?: string } }).auth;
        if (auth?.role === 'DIRECTOR' || auth?.role === 'HR_MANAGER') {
          s.emit('comms:broadcast_received', payload);
        }
      }
    });
  },

  /** Delivers a new formal notice to all connected staff in a branch room,
   *  plus any system-level users (DIRECTOR, HR_MANAGER) who are online. */
  emitNewFormalNotice: (
    organizationId: string,
    payload: {
      noticeId: string;
      subject: string;
      issuerName: string;
      createdAt: string;
    },
  ): void => {
    const io = getSocketServer();
    io.to(branchRoomName(organizationId)).emit('comms:notice_received', payload);
    // Also deliver to system-level roles (DIRECTOR, HR_MANAGER) who have no branch room
    void io.fetchSockets().then((sockets) => {
      for (const s of sockets) {
        const auth = (s.data as { auth?: { role?: string } }).auth;
        if (auth?.role === 'DIRECTOR' || auth?.role === 'HR_MANAGER') {
          s.emit('comms:notice_received', payload);
        }
      }
    });
  },

  /** Delivers a new formal notice to a single user's socket room (for individual notices),
   *  plus any DIRECTOR / HR_MANAGER who are online so they see it in their inbox. */
  emitNewFormalNoticeToUser: (
    userId: string,
    payload: {
      noticeId: string;
      subject: string;
      issuerName: string;
      createdAt: string;
    },
  ): void => {
    const io = getSocketServer();
    io.to(userRoomName(userId)).emit('comms:notice_received', payload);
    // Also notify system-level roles (DIRECTOR, HR_MANAGER) who are not in any branch room
    void io.fetchSockets().then((sockets) => {
      for (const s of sockets) {
        const auth = (s.data as { auth?: { role?: string; userId?: string } }).auth;
        if (
          (auth?.role === 'DIRECTOR' || auth?.role === 'HR_MANAGER') &&
          auth?.userId !== userId // don't double-emit if the issuer is themselves
        ) {
          s.emit('comms:notice_received', payload);
        }
      }
    });
  },

  /** Notifies the broadcast sender that a recipient has read their broadcast. */
  emitBroadcastRead: (
    senderUserId: string,
    payload: { broadcastId: string; userId: string; userName: string; readAt: string },
  ): void => {
    const io = getSocketServer();
    io.to(userRoomName(senderUserId)).emit('comms:broadcast_read', payload);
  },

  /** Notifies the broadcast sender that a recipient has acknowledged their broadcast. */
  emitBroadcastAcknowledged: (
    senderUserId: string,
    payload: { broadcastId: string; userId: string; userName: string; acknowledgedAt: string },
  ): void => {
    const io = getSocketServer();
    io.to(userRoomName(senderUserId)).emit('comms:broadcast_acknowledged', payload);
  },

  /** Notifies the notice issuer that a recipient has acknowledged their formal notice. */
  emitNoticeAcknowledged: (
    issuerUserId: string,
    payload: { noticeId: string; userId: string; userName: string; acknowledgedAt: string },
  ): void => {
    const io = getSocketServer();
    io.to(userRoomName(issuerUserId)).emit('comms:notice_acknowledged', payload);
  },
};
