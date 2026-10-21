import { apiClient } from '@/lib/apiClient';
import { deviceId } from '@/lib/device-id';
import { useAuthStore } from '@/store/authStore';

import type { AnswerResult, RecordAnswer, RecordCard, RecordPage, RecordQuery } from '../types/my-record-types';

const token = (): string | undefined => useAuthStore.getState().accessToken ?? undefined;
const BASE = '/workforce/audit/me';

export const recordReads = {
  list: (q: RecordQuery): Promise<RecordPage> => {
    const p = new URLSearchParams({ event: q.event, from: q.from, to: q.to, page: String(q.page), pageSize: String(q.pageSize) });
    return apiClient.get(`${BASE}?${p.toString()}`, token());
  },
  one: (id: string): Promise<RecordCard> => apiClient.get(`${BASE}/${id}`, token()),
};

export const recordWrites = {
  /** One answer per entry; the same key replays the same result. "This wasn't me" also signs every phone out on the server. */
  answer: (id: string, answer: RecordAnswer, idempotencyKey: string): Promise<AnswerResult> =>
    apiClient.post(`${BASE}/${id}/answer`, { answer, idempotencyKey, ...(answer === 'NOT_ME' ? { deviceId: deviceId() } : {}) }, token()),
};
