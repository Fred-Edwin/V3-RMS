import type { PrepStation } from '@prisma/client';
import type { PrepTicketRecord } from '../types/order.types';
import { inventoryBadgesBridge } from './inventory-badges-bridge';
import { branchRoomName, getSocketServer, inventoryAllSitesRoom, stationRoomName, userRoomName } from './socket';

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

export interface ChequeMethodAddedPayload {
  supplierId: string;
  supplierName: string;
  addedByName: string;
  reason: string;
}

export interface PayMethodChangedPayload {
  supplierId: string;
  supplierName: string;
  changedByName: string;
  /** "Added M-Pesa Paybill" · "Changed the account number on the bank transfer". */
  summary: string;
  reason: string;
}

/** `inventory:badges`: carries no counts, only "something changed here"; the screen refetches R2. */
export interface InventoryBadgesPayload {
  siteId: string;
  reason: string;
}

/** This process's own clients: the site's room, and the room of everyone who reads every site (the Director, the hub roles). */
export const emitInventoryBadgesLocal = (payload: InventoryBadgesPayload): void => {
  getSocketServer().to([branchRoomName(payload.siteId), inventoryAllSitesRoom]).emit('inventory:badges', payload);
};

export interface RequisitionSubmittedPayload {
  requisitionId: string;
  departmentTag: string;
}

export interface RequisitionDecisionPayload {
  requisitionId: string;
  decision: 'APPROVED' | 'REJECTED';
}

export interface RequisitionSectionReturnedPayload {
  requisitionId: string;
  departmentTag: string;
  returnedNote: string;
}

export interface RequisitionNudgePayload {
  requisitionId: string;
  departmentTag: string;
}

const emitToStations = (
  siteId: string,
  stations: PrepStation[],
  eventName: string,
  payload: unknown,
): void => {
  const io = getSocketServer();
  const uniqueStations = [...new Set(stations)];

  uniqueStations.forEach((station) => {
    io.to(stationRoomName(siteId, station)).emit(eventName, payload);
  });
};

export const socketService = {
  emitNewOrder: (siteId: string, tickets: PrepTicketRecord[]): void => {
    const io = getSocketServer();
    tickets.forEach((ticket) => {
      io.to(stationRoomName(siteId, ticket.station)).emit('order:new', ticket);
    });
  },

  emitOrderClaimed: (siteId: string, waiterId: string, payload: OrderClaimedPayload): void => {
    const io = getSocketServer();
    io.to(userRoomName(waiterId)).emit('order:claimed', payload);
    io.to(stationRoomName(siteId, payload.station)).emit('order:claimed', payload);
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

  /** A cheque payment method was added to a supplier — notifies the hub's Accountant(s). */
  emitChequeMethodAdded: (userId: string, payload: ChequeMethodAddedPayload): void => {
    const io = getSocketServer();
    io.to(userRoomName(userId)).emit('supplier:cheque-method-added', payload);
  },

  /** A supplier's payment details were added or changed — notifies the hub's Accountant(s). */
  emitPayMethodChanged: (userId: string, payload: PayMethodChangedPayload): void => {
    const io = getSocketServer();
    io.to(userRoomName(userId)).emit('supplier:pay-method-changed', payload);
  },

  /** A department head submits their section — notifies the branch's Manager(s). */
  emitRequisitionSubmitted: (userId: string, payload: RequisitionSubmittedPayload): void => {
    const io = getSocketServer();
    io.to(userRoomName(userId)).emit('requisition:submitted', payload);
  },

  /** The requisition is approved (or, in future, rejected) — notifies the heads who submitted. */
  emitRequisitionDecision: (userId: string, payload: RequisitionDecisionPayload): void => {
    const io = getSocketServer();
    io.to(userRoomName(userId)).emit('requisition:decision', payload);
  },

  /** A manager bounces a section back to its head. */
  emitRequisitionSectionReturned: (userId: string, payload: RequisitionSectionReturnedPayload): void => {
    const io = getSocketServer();
    io.to(userRoomName(userId)).emit('requisition:section-returned', payload);
  },

  /** A manager nudges a head to fill their not-yet-started section. */
  emitRequisitionNudge: (userId: string, payload: RequisitionNudgePayload): void => {
    const io = getSocketServer();
    io.to(userRoomName(userId)).emit('requisition:nudge', payload);
  },

  /** Inventory badge nudge (the one notification layer, `inventory/_shared/notify.ts`): open screens refetch their badge counts. */
  emitInventoryBadges: (siteId: string, payload: InventoryBadgesPayload): void => {
    emitInventoryBadgesLocal({ ...payload, siteId });
    // The worker has no browsers of its own: tell the other processes too (a no-op for the one that hears itself).
    void inventoryBadgesBridge.publish({ ...payload, siteId });
  },

  emitOrderClosed: (siteId: string, stations: PrepStation[], payload: OrderClosedPayload): void => {
    emitToStations(siteId, stations, 'order:closed', payload);
  },

  emitOrderModified: (siteId: string, tickets: PrepTicketRecord[]): void => {
    const io = getSocketServer();
    tickets.forEach((ticket) => {
      io.to(stationRoomName(siteId, ticket.station)).emit('order:modified', ticket);
    });
  },

  emitOrderCancelled: (siteId: string, stations: PrepStation[], payload: { orderId: string }): void => {
    emitToStations(siteId, stations, 'order:cancelled', payload);
  },

  emitOrderForceCancelled: (
    siteId: string,
    stations: PrepStation[],
    waiterId: string,
    payload: { orderId: string; dailyNumber: number; cancelledBy: string },
  ): void => {
    emitToStations(siteId, stations, 'order:force_cancelled', payload);
    const io = getSocketServer();
    // Notify the waiter who owns the order
    io.to(userRoomName(waiterId)).emit('order:force_cancelled', payload);
    // Also broadcast to the branch room so managers (who are not in station rooms)
    // receive the event and can remove the order from their active list
    io.to(branchRoomName(siteId)).emit('order:force_cancelled', payload);
  },

  emitOrderCancellationPending: (
    waiterId: string,
    siteId: string,
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
    io.to(branchRoomName(siteId)).emit('order:cancellation_pending', payload);
  },

  emitOrderCancellationResolved: (
    waiterId: string,
    siteId: string,
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
    io.to(branchRoomName(siteId)).emit('order:cancellation_resolved', payload);
  },

  emitTicketRejected: (
    siteId: string,
    waiterId: string,
    payload: { orderId: string; ticketId: string; station: PrepStation; dailyNumber: number; reason: string },
  ): void => {
    const io = getSocketServer();
    io.to(userRoomName(waiterId)).emit('ticket:rejected', payload);
    io.to(stationRoomName(siteId, payload.station)).emit('ticket:rejected', payload);
  },

  emitTicketReverted: (
    siteId: string,
    payload: { orderId: string; ticketId: string; station: PrepStation; dailyNumber: number },
  ): void => {
    const io = getSocketServer();
    io.to(stationRoomName(siteId, payload.station)).emit('ticket:unclaimed', payload);
  },

  emitTicketUnclaimed: (
    siteId: string,
    waiterId: string,
    payload: { orderId: string; ticketId: string; station: PrepStation; dailyNumber: number },
  ): void => {
    const io = getSocketServer();
    io.to(userRoomName(waiterId)).emit('ticket:unclaimed', payload);
    io.to(stationRoomName(siteId, payload.station)).emit('ticket:unclaimed', payload);
  },

  emitModificationRequested: (
    siteId: string,
    stations: PrepStation[],
    payload: { requestId: string; orderId: string; dailyNumber: number; description: string; requestedBy: { id: string; name: string } },
  ): void => {
    emitToStations(siteId, stations, 'modification:requested', payload);
  },

  emitModificationReviewed: (
    waiterId: string,
    payload: { requestId: string; orderId: string; status: string; reviewNote: string | null },
  ): void => {
    const io = getSocketServer();
    io.to(userRoomName(waiterId)).emit('modification:reviewed', payload);
  },

  emitIncident: (siteId: string, payload: unknown): void => {
    const io = getSocketServer();
    io.to(branchRoomName(siteId)).emit('incident:new', payload);
  },

  /**
   * Emits to the branch room when a house account payment bypasses authorization
   * (account holder has no FCM token). Managers can see this in real time.
   */
  emitAuthBypassed: (
    siteId: string,
    payload: { orderId: string; dailyNumber: number; houseAccountId: string },
  ): void => {
    const io = getSocketServer();
    io.to(branchRoomName(siteId)).emit('order:auth_bypassed', payload);
  },

  /** Notifies the waiter's session that a house account auth is pending (order locked),
   *  and broadcasts the status change to the branch room so managers/directors update too. */
  emitAuthPending: (
    waiterId: string,
    siteId: string,
    payload: { orderId: string; dailyNumber: number; authRequestId: string },
  ): void => {
    const io = getSocketServer();
    io.to(userRoomName(waiterId)).emit('order:auth_pending', payload);
    io.to(branchRoomName(siteId)).emit('order:auth_pending', payload);
  },

  /** Notifies the waiter and all branch members that the authorization was resolved. */
  emitAuthResolved: (
    waiterId: string,
    siteId: string,
    payload: { orderId: string; dailyNumber: number; approved: boolean },
  ): void => {
    const io = getSocketServer();
    io.to(userRoomName(waiterId)).emit('order:auth_resolved', payload);
    io.to(branchRoomName(siteId)).emit('order:auth_resolved', payload);
  },

  /** Notifies the waiter that a staff discount approval is pending, and broadcasts to branch so
   *  managers see the order card update immediately. Staff discounts are approved by DIRECTORS
   *  only, and directors have no branch room, so we also fan out to every online director. */
  emitStaffDiscountAuthPending: (
    waiterId: string,
    siteId: string,
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
    io.to(branchRoomName(siteId)).emit('order:staff_discount_pending', payload);
    // Directors have no branch room — deliver to every online director so the
    // approval card on their dashboard updates in real time.
    void io.fetchSockets().then((sockets) => {
      for (const s of sockets) {
        const auth = (s.data as { auth?: { role?: string } }).auth;
        if (auth?.role === 'DIRECTOR') {
          s.emit('order:staff_discount_pending', payload);
        }
      }
    });
  },

  /** Notifies the waiter and all branch members that the staff discount was approved or rejected,
   *  plus every online director so their approval card drops the resolved row. */
  emitStaffDiscountAuthResolved: (
    waiterId: string,
    siteId: string,
    payload: { orderId: string; dailyNumber: number; approved: boolean; discountedTotal?: string },
  ): void => {
    const io = getSocketServer();
    io.to(userRoomName(waiterId)).emit('order:staff_discount_resolved', payload);
    io.to(branchRoomName(siteId)).emit('order:staff_discount_resolved', payload);
    void io.fetchSockets().then((sockets) => {
      for (const s of sockets) {
        const auth = (s.data as { auth?: { role?: string } }).auth;
        if (auth?.role === 'DIRECTOR') {
          s.emit('order:staff_discount_resolved', payload);
        }
      }
    });
  },

  /** Notifies the waiter that a customer discount approval is pending, and broadcasts to branch
   *  so managers see the pending request immediately. */
  emitCustomerDiscountAuthPending: (
    waiterId: string,
    siteId: string,
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
    io.to(branchRoomName(siteId)).emit('order:customer_discount_pending', payload);
  },

  /** Notifies the waiter and all branch members that the customer discount was approved or rejected. */
  emitCustomerDiscountAuthResolved: (
    waiterId: string,
    siteId: string,
    payload: { orderId: string; dailyNumber: number; approved: boolean; discountedTotal?: string },
  ): void => {
    const io = getSocketServer();
    io.to(userRoomName(waiterId)).emit('order:customer_discount_resolved', payload);
    io.to(branchRoomName(siteId)).emit('order:customer_discount_resolved', payload);
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
    siteId: string,
    payload: {
      broadcastId: string;
      subject: string;
      senderName: string;
      requiresAck: boolean;
      createdAt: string;
    },
  ): void => {
    const io = getSocketServer();
    io.to(branchRoomName(siteId)).emit('comms:broadcast_received', payload);
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
    siteId: string,
    payload: {
      noticeId: string;
      subject: string;
      issuerName: string;
      createdAt: string;
    },
  ): void => {
    const io = getSocketServer();
    io.to(branchRoomName(siteId)).emit('comms:notice_received', payload);
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
