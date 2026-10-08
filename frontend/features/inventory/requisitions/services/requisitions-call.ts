/**
 * The one HTTP seam of the requisitions services. A plain `apiClient` call, except a signing write also sends the
 * `Idempotency-Key` header (contract §4), which `apiClient` cannot carry. A failed call throws the same `ApiError` the rest of the
 * app throws, so screens map it with `headErrorMessage`.
 */
import { apiClient } from '@/lib/apiClient';
import { env } from '@/lib/env';
import { useAuthStore } from '@/store/authStore';
import { ApiError, type ApiResponseEnvelope } from '@/types/api';
import { IDEMPOTENCY_HEADER } from '../_shared/types/requisitions-contract';

export type CallMethod = 'GET' | 'POST' | 'PUT' | 'PATCH';

const BASE = '/inventory/requisitions';
const token = (): string | undefined => useAuthStore.getState().accessToken ?? undefined;

/** Query string with empty values dropped; booleans go as "true" or "false". */
export function queryString(params: object | undefined): string {
  if (!params) return '';
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

async function withKey<T>(method: 'POST' | 'PUT' | 'PATCH', path: string, body: unknown, key: string): Promise<T> {
  const accessToken = token();
  const response = await fetch(`${env.apiUrl}${BASE}${path}`, {
    method,
    cache: 'no-store',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      [IDEMPOTENCY_HEADER]: key,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body ?? {}),
  });
  const payload = (await response.json()) as ApiResponseEnvelope<T>;
  if (!response.ok) {
    throw new ApiError(payload.error?.message ?? 'Request failed', response.status, payload.error?.code ?? 'UNKNOWN_ERROR', payload.error?.details);
  }
  return payload.data as T;
}

export async function callRequisitions<T>(method: CallMethod, path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
  if (idempotencyKey && method !== 'GET') return withKey<T>(method, path, body, idempotencyKey);
  const url = `${BASE}${path}`;
  if (method === 'GET') return apiClient.get<T>(url, token());
  if (method === 'POST') return apiClient.post<T>(url, body ?? {}, token());
  if (method === 'PUT') return apiClient.put<T>(url, body ?? {}, token());
  return apiClient.patch<T>(url, body ?? {}, token());
}
