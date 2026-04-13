import { apiClient } from '@/lib/apiClient';
import { ApiError, type ApiResponseEnvelope } from '@/types/api';
import { env } from '@/lib/env';
import type {
  DirectConversationRecord,
  DirectMessageRecord,
  BroadcastRecord,
  BroadcastRecipientStatusRecord,
  FormalNoticeRecord,
  FormalNoticeRecipientStatusRecord,
  PaginationMeta,
} from '@/types/comms';

// ── Direct Conversations ─────────────────────────────────────────────────────

export const commsService = {
  getConversations: (
    token: string,
    query?: { limit?: number; cursor?: string },
  ): Promise<{ conversations: DirectConversationRecord[]; nextCursor: string | null }> => {
    const params = new URLSearchParams();
    if (query?.limit) params.set('limit', String(query.limit));
    if (query?.cursor) params.set('cursor', query.cursor);
    const qs = params.toString();
    return apiClient.get(`/comms/conversations${qs ? `?${qs}` : ''}`, token);
  },

  getOrCreateConversation: (
    token: string,
    recipientId: string,
  ): Promise<DirectConversationRecord> => {
    return apiClient.post('/comms/conversations', { recipientId }, token);
  },

  getMessages: (
    token: string,
    conversationId: string,
    query?: { limit?: number; before?: string },
  ): Promise<DirectMessageRecord[]> => {
    const params = new URLSearchParams();
    if (query?.limit) params.set('limit', String(query.limit));
    if (query?.before) params.set('before', query.before);
    const qs = params.toString();
    return apiClient.get(`/comms/conversations/${conversationId}/messages${qs ? `?${qs}` : ''}`, token);
  },

  sendMessage: (
    token: string,
    conversationId: string,
    body: { bodyHtml: string; attachmentUrl?: string; attachmentName?: string },
  ): Promise<DirectMessageRecord> => {
    return apiClient.post(`/comms/conversations/${conversationId}/messages`, body, token);
  },

  markMessageRead: (token: string, messageId: string): Promise<void> => {
    return apiClient.patch(`/comms/messages/${messageId}/read`, {}, token);
  },

  deleteMessage: (token: string, messageId: string): Promise<void> => {
    return apiClient.delete(`/comms/messages/${messageId}`, token);
  },

  uploadDmImage: async (
    token: string,
    conversationId: string,
    file: File,
  ): Promise<{ imageUrl: string }> => {
    const formData = new FormData();
    formData.append('image', file);
    const response = await fetch(`${env.apiUrl}/comms/conversations/${conversationId}/upload-image`, {
      method: 'POST',
      credentials: 'include',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const payload = (await response.json()) as ApiResponseEnvelope<{ imageUrl: string }>;
    if (!response.ok) {
      throw new ApiError(
        payload.error?.message ?? 'Image upload failed',
        response.status,
        payload.error?.code ?? 'UPLOAD_ERROR',
        payload.error?.details,
      );
    }
    return payload.data as { imageUrl: string };
  },

  // ── Broadcasts ─────────────────────────────────────────────────────────────

  getBroadcasts: async (
    token: string,
    query?: { page?: number; perPage?: number },
  ): Promise<{ data: BroadcastRecord[]; pagination: PaginationMeta }> => {
    const params = new URLSearchParams();
    if (query?.page) params.set('page', String(query.page));
    if (query?.perPage) params.set('perPage', String(query.perPage));
    const qs = params.toString();
    const envelope = await apiClient.getWithEnvelope<BroadcastRecord[]>(`/comms/broadcasts${qs ? `?${qs}` : ''}`, token);
    return { data: envelope.data ?? [], pagination: envelope.pagination as PaginationMeta };
  },

  sendBroadcast: (
    token: string,
    body: {
      scope: 'COMPANY' | 'BRANCH' | 'ROLE_GROUP';
      targetBranchId?: string;
      targetRole?: string;
      subject: string;
      bodyHtml: string;
      attachmentUrl?: string;
      attachmentName?: string;
      requiresAck: boolean;
    },
  ): Promise<BroadcastRecord> => {
    return apiClient.post('/comms/broadcasts', body, token);
  },

  getBroadcastDetail: (token: string, broadcastId: string): Promise<BroadcastRecord> => {
    return apiClient.get(`/comms/broadcasts/${broadcastId}`, token);
  },

  markBroadcastRead: (token: string, broadcastId: string): Promise<void> => {
    return apiClient.patch(`/comms/broadcasts/${broadcastId}/read`, {}, token);
  },

  acknowledgeBroadcast: (token: string, broadcastId: string): Promise<void> => {
    return apiClient.patch(`/comms/broadcasts/${broadcastId}/acknowledge`, {}, token);
  },

  getBroadcastStatus: (
    token: string,
    broadcastId: string,
  ): Promise<BroadcastRecipientStatusRecord[]> => {
    return apiClient.get(`/comms/broadcasts/${broadcastId}/status`, token);
  },

  // ── Formal Notices ─────────────────────────────────────────────────────────

  getNotices: async (
    token: string,
    query?: { page?: number; perPage?: number },
  ): Promise<{ data: FormalNoticeRecord[]; pagination: PaginationMeta }> => {
    const params = new URLSearchParams();
    if (query?.page) params.set('page', String(query.page));
    if (query?.perPage) params.set('perPage', String(query.perPage));
    const qs = params.toString();
    const envelope = await apiClient.getWithEnvelope<FormalNoticeRecord[]>(`/comms/notices${qs ? `?${qs}` : ''}`, token);
    return { data: envelope.data ?? [], pagination: envelope.pagination as PaginationMeta };
  },

  issueNotice: (
    token: string,
    body: {
      targetBranchId?: string;
      targetRole?: string;
      subject: string;
      bodyHtml: string;
      attachmentUrl?: string;
      attachmentName?: string;
    },
  ): Promise<FormalNoticeRecord> => {
    return apiClient.post('/comms/notices', body, token);
  },

  getNoticeDetail: (token: string, noticeId: string): Promise<FormalNoticeRecord> => {
    return apiClient.get(`/comms/notices/${noticeId}`, token);
  },

  acknowledgeNotice: (token: string, noticeId: string): Promise<void> => {
    return apiClient.patch(`/comms/notices/${noticeId}/acknowledge`, {}, token);
  },

  getNoticeStatus: (
    token: string,
    noticeId: string,
  ): Promise<FormalNoticeRecipientStatusRecord[]> => {
    return apiClient.get(`/comms/notices/${noticeId}/status`, token);
  },
};
