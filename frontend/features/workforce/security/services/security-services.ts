import { apiClient } from '@/lib/apiClient';
import { deviceId } from '@/lib/device-id';
import { useAuthStore } from '@/store/authStore';

import type { AlertCounts, AlertList, AlertQuery, AlertRow, Phone, PhoneSeen } from '../types/security-types';

const token = (): string | undefined => useAuthStore.getState().accessToken ?? undefined;
const BASE = '/workforce/security';

/** A random key for one press, so a double tap is one answer. */
export const newKey = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

export const phoneWrites = {
  /** Called once after sign-in: records this phone and says whether to ask "Is this your phone?". */
  seen: (): Promise<PhoneSeen> => apiClient.post(`${BASE}/phones/me/current/seen`, { deviceId: deviceId() }, token()),
  confirm: (id: string): Promise<Phone> => apiClient.post(`${BASE}/phones/me/${id}/confirm`, {}, token()),
};

export const alertReads = {
  list: (q: AlertQuery): Promise<AlertList> => {
    const params = new URLSearchParams({ page: String(q.page), pageSize: String(q.pageSize) });
    if (q.status) params.set('status', q.status);
    if (q.kind) params.set('kind', q.kind);
    return apiClient.get(`${BASE}/alerts?${params.toString()}`, token());
  },
  counts: (): Promise<AlertCounts> => apiClient.get(`${BASE}/alerts/counts`, token()),
};

export const alertWrites = {
  clear: (id: string, note: string, idempotencyKey: string): Promise<AlertRow> => apiClient.post(`${BASE}/alerts/${id}/clear`, { note, idempotencyKey }, token()),
  start: (): Promise<{ alertsStarted: true; at: string }> => apiClient.post(`${BASE}/alerts/start`, {}, token()),
};

export const sessionReads = {
  state: (): Promise<{ mustChangePassword: boolean }> => apiClient.get(`${BASE}/state`, token()),
};

export const sessionWrites = {
  /** "Yes, this wasn't me": every session ends and a new password and code are needed. */
  wasntMe: (idempotencyKey: string, entryId?: string): Promise<{ alreadyDone: boolean }> =>
    apiClient.post(`${BASE}/wasnt-me`, { deviceId: deviceId(), idempotencyKey, ...(entryId ? { entryId } : {}) }, token()),
  resetPassword: (newPassword: string, confirm: string): Promise<{ reset: true }> => apiClient.post(`${BASE}/reset-password`, { newPassword, confirm }, token()),
};
