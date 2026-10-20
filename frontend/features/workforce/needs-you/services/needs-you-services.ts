import { apiClient } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';

import type { NeedsYouCounts, NeedsYouList, OverdueList } from '../types/needs-you-types';

const token = (): string | undefined => useAuthStore.getState().accessToken ?? undefined;
const BASE = '/workforce/needs-you';

/** A random key for one press, so a double tap is one reminder. */
export const newKey = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

export const needsYouReads = {
  list: (): Promise<NeedsYouList> => apiClient.get(BASE, token()),
  counts: (): Promise<NeedsYouCounts> => apiClient.get(`${BASE}/counts`, token()),
  overdue: (): Promise<OverdueList> => apiClient.get(`${BASE}/overdue`, token()),
};

export const needsYouWrites = {
  /** Home was opened: older rows stop being "New". */
  seen: (): Promise<{ seen: true }> => apiClient.post(`${BASE}/seen`, {}, token()),
  undo: (rowId: string): Promise<{ undone: true }> => apiClient.post(`${BASE}/${encodeURIComponent(rowId)}/undo`, {}, token()),
  remind: (rowId: string): Promise<{ reminded: true }> => apiClient.post(`${BASE}/${encodeURIComponent(rowId)}/remind`, { idempotencyKey: newKey() }, token()),
};
