import { apiClient } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';

import type { NotificationPage, NotificationQuery } from '../types/notification-types';

const token = (): string | undefined => useAuthStore.getState().accessToken ?? undefined;
const BASE = '/workforce/notifications';

/** The query string of the list: only the filters that are set are sent. */
export function listQueryString(query: NotificationQuery): string {
  const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize), unread: String(query.unreadOnly) });
  if (query.area) params.set('area', query.area);
  if (query.q.trim()) params.set('q', query.q.trim());
  return params.toString();
}

export const notificationReads = {
  list: (query: NotificationQuery): Promise<NotificationPage> => apiClient.get(`${BASE}?${listQueryString(query)}`, token()),
  unreadCount: (): Promise<{ unread: number }> => apiClient.get(`${BASE}/unread-count`, token()),
};

export const notificationWrites = {
  read: (ids: readonly string[]): Promise<{ marked: number; unread: number }> => apiClient.post(`${BASE}/read`, { ids }, token()),
  readAll: (): Promise<{ marked: number; unread: number }> => apiClient.post(`${BASE}/read-all`, {}, token()),
};
