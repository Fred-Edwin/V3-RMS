export type BroadcastScope = 'COMPANY' | 'BRANCH' | 'ROLE_GROUP';

export interface ConversationParticipant {
  id: string;
  name: string;
  role: string;
}

export interface DirectMessageRecord {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  bodyHtml: string;
  attachmentUrl: string | null;
  attachmentName: string | null;
  readAt: string | null;
  createdAt: string;
  isDeleted: boolean;
}

export interface DirectConversationRecord {
  id: string;
  organizationId: string;
  otherParticipant: ConversationParticipant;
  lastMessage: DirectMessageRecord | null;
  unreadCount: number;
  updatedAt: string;
}

export interface BroadcastRecord {
  id: string;
  organizationId: string;
  sender: { id: string; name: string };
  scope: BroadcastScope;
  targetRole: string | null;
  subject: string;
  bodyHtml: string;
  attachmentUrl: string | null;
  attachmentName: string | null;
  requiresAck: boolean;
  totalRecipients: number;
  readCount: number;
  ackCount: number;
  myReadAt: string | null;
  myAcknowledgedAt: string | null;
  createdAt: string;
}

export interface BroadcastRecipientStatusRecord {
  userId: string;
  userName: string;
  readAt: string | null;
  acknowledgedAt: string | null;
}

export interface FormalNoticeRecord {
  id: string;
  organizationId: string;
  issuer: { id: string; name: string };
  subject: string;
  bodyHtml: string;
  attachmentUrl: string | null;
  attachmentName: string | null;
  totalRecipients: number;
  ackCount: number;
  myAcknowledgedAt: string | null;
  isRecipient: boolean;
  createdAt: string;
}

export interface FormalNoticeRecipientStatusRecord {
  userId: string;
  userName: string;
  acknowledgedAt: string | null;
}

export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

// ── Socket payload types (mirrors ServerToClientEvents) ─────────────────────

export interface NewDirectMessagePayload {
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
}

export interface NewBroadcastPayload {
  broadcastId: string;
  subject: string;
  senderName: string;
  requiresAck: boolean;
  createdAt: string;
}

export interface NewFormalNoticePayload {
  noticeId: string;
  subject: string;
  issuerName: string;
  createdAt: string;
}

export interface TypingPayload {
  conversationId: string;
  userId: string;
  userName: string;
}
