import { apiClient } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';

import type { NotificationPage } from '../types/notification-types';

const token = (): string | undefined => useAuthStore.getState().accessToken ?? undefined;
const BASE = '/workforce/notifications';

export const notificationReads = {
  list: (page: number, pageSize: number, unreadOnly: boolean): Promise<NotificationPage> =>
    apiClient.get(`${BASE}?page=${page}&pageSize=${pageSize}&unread=${unreadOnly}`, token()),
  unreadCount: (): Promise<{ unread: number }> => apiClient.get(`${BASE}/unread-count`, token()),
};

export const notificationWrites = {
  read: (ids: readonly string[]): Promise<{ marked: number; unread: number }> => apiClient.post(`${BASE}/read`, { ids }, token()),
  readAll: (): Promise<{ marked: number; unread: number }> => apiClient.post(`${BASE}/read-all`, {}, token()),
};
