import type { PrepStation, PrepTicketDetail } from './order';

export interface ServerToClientEvents {
  'joined:branch': (payload: { room: string }) => void;
  'error:join:branch': (payload: { message: string }) => void;
  'joined:station': (payload: { room: string; station: PrepStation }) => void;
  'error:join:station': (payload: { message: string }) => void;
  'joined:user': (payload: { room: string }) => void;
  'error:join:user': (payload: { message: string }) => void;
  'order:new': (payload: PrepTicketDetail) => void;
  'order:claimed': (payload: {
    orderId: string;
    ticketId: string;
    station: PrepStation;
    dailyNumber: number;
    claimedBy: { id: string; name: string };
  }) => void;
  'order:ready': (payload: {
    orderId: string;
    ticketId: string;
    station: PrepStation;
    dailyNumber: number;
  }) => void;
  'order:all_ready': (payload: { orderId: string; dailyNumber: number }) => void;
  'order:paid': (payload: { orderId: string; dailyNumber: number }) => void;
  'order:modified': (payload: PrepTicketDetail) => void;
  'order:cancelled': (payload: { orderId: string }) => void;
  'order:closed': (payload: { orderId: string }) => void;
  'order:force_cancelled': (payload: { orderId: string }) => void;
  'ticket:rejected': (payload: {
    orderId: string;
    ticketId: string;
    station: PrepStation;
    reason: string;
  }) => void;
  'ticket:unclaimed': (payload: {
    orderId: string;
    ticketId: string;
    station: PrepStation;
  }) => void;
  'incident:new': (payload: {
    id: string;
    type: string;
    orderId?: string;
    actor: { id: string; name: string };
    details: Record<string, unknown>;
    createdAt: string;
  }) => void;
  'order:auth_pending': (payload: {
    orderId: string;
    dailyNumber: number;
    authRequestId: string;
  }) => void;
  'order:auth_resolved': (payload: {
    orderId: string;
    dailyNumber: number;
    approved: boolean;
  }) => void;
  'order:auth_bypassed': (payload: {
    orderId: string;
    dailyNumber: number;
    houseAccountId: string;
  }) => void;
  'order:staff_discount_pending': (payload: {
    orderId: string;
    dailyNumber: number;
    authRequestId: string;
    originalAmount: string;
    discountAmount: string;
  }) => void;
  'order:staff_discount_resolved': (payload: {
    orderId: string;
    dailyNumber: number;
    approved: boolean;
    discountedTotal?: string;
  }) => void;
  'order:customer_discount_pending': (payload: {
    orderId: string;
    dailyNumber: number;
    authRequestId: string;
    discountName: string;
    originalAmount: string;
    discountAmount: string;
  }) => void;
  'order:customer_discount_resolved': (payload: {
    orderId: string;
    dailyNumber: number;
    approved: boolean;
    discountedTotal?: string;
  }) => void;
  'comms:dm_received': (payload: {
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
  }) => void;
  'comms:broadcast_received': (payload: {
    broadcastId: string;
    subject: string;
    senderName: string;
    requiresAck: boolean;
    createdAt: string;
  }) => void;
  'comms:notice_received': (payload: {
    noticeId: string;
    subject: string;
    issuerName: string;
    createdAt: string;
  }) => void;
  'comms:typing_start': (payload: { conversationId: string; userId: string; userName: string }) => void;
  'comms:typing_stop': (payload: { conversationId: string; userId: string }) => void;
  'comms:message_read': (payload: { messageId: string; conversationId: string; readAt: string }) => void;
  'comms:broadcast_read': (payload: { broadcastId: string; userId: string; userName: string; readAt: string }) => void;
  'comms:broadcast_acknowledged': (payload: { broadcastId: string; userId: string; userName: string; acknowledgedAt: string }) => void;
  'comms:notice_acknowledged': (payload: { noticeId: string; userId: string; userName: string; acknowledgedAt: string }) => void;
}

export interface ClientToServerEvents {
  'join:branch': (payload: { organizationId: string }) => void;
  'join:station': (payload: { organizationId: string; station: PrepStation }) => void;
  'join:user': (payload: { userId: string }) => void;
  'comms:typing_start': (payload: { conversationId: string }) => void;
  'comms:typing_stop': (payload: { conversationId: string }) => void;
}
