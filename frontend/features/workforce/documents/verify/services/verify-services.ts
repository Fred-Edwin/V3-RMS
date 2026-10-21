import { apiClient } from '@/lib/apiClient';
import { env } from '@/lib/env';
import { useAuthStore } from '@/store/authStore';

import type { SignedInAnswer, VerifyAnswer } from '../types/verify-types';

const query = (h: string | null): string => (h ? `?h=${encodeURIComponent(h)}` : '');
const path = (kind: string, number: string): string => `${encodeURIComponent(kind)}/${encodeURIComponent(number)}`;

/**
 * The public check. No sign-in, no cookies, no stored copy: it works for anyone holding a printed page. A 429 still carries the answer
 * (`RATE_LIMITED`); only a network failure or an unreadable reply throws.
 */
export async function checkPublic(kind: string, number: string, h: string | null): Promise<VerifyAnswer> {
  const response = await fetch(`${env.apiUrl}/verify/${path(kind, number)}${query(h)}`, { method: 'GET', cache: 'no-store', credentials: 'omit' });
  const payload = (await response.json()) as { success: boolean; data?: VerifyAnswer };
  if (!payload.data) throw new Error('No answer');
  return payload.data;
}

/** The signed-in check: the same verdict plus the signer, the Open button and who may read the type. Writes `document.verified`. */
export const checkSignedIn = (kind: string, number: string, h: string | null): Promise<SignedInAnswer> =>
  apiClient.get(`/workforce/documents/verify/${path(kind, number)}${query(h)}`, useAuthStore.getState().accessToken ?? undefined);

/** "Tell the ...": once per person, number and day on the server; the same key replays. */
export const reportMismatch = (kind: string, number: string, h: string, idempotencyKey: string): Promise<{ told: boolean; role: string }> =>
  apiClient.post(`/workforce/documents/verify/${path(kind, number)}/report`, { h, idempotencyKey }, useAuthStore.getState().accessToken ?? undefined);
