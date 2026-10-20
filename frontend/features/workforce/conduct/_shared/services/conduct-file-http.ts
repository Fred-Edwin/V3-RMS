import { env } from '@/lib/env';
import { useAuthStore } from '@/store/authStore';
import { ApiError, type ApiResponseEnvelope } from '@/types/api';

import type { FileBlob } from '../types/conduct-types';

/**
 * The one door for a letter's bytes. `apiClient` only returns JSON, and a notice is a PDF. A failed call keeps the server's own code, so
 * the screen can tell "no letter" (a verbal note) from a download that failed. No signal is a status of 0, as everywhere else.
 */
async function failure(response: Response): Promise<ApiError> {
  let payload: ApiResponseEnvelope<unknown> | null = null;
  try {
    payload = (await response.json()) as ApiResponseEnvelope<unknown>;
  } catch {
    payload = null;
  }
  return new ApiError(payload?.error?.message ?? 'Request failed', response.status, payload?.error?.code ?? 'UNKNOWN_ERROR', payload?.error?.details);
}

const filenameOf = (response: Response, fallback: string): string => /filename="?([^";]+)"?/.exec(response.headers.get('content-disposition') ?? '')?.[1] ?? fallback;

export async function conductFile(path: string, fallbackName: string, body?: unknown): Promise<FileBlob> {
  const token = useAuthStore.getState().accessToken;
  let response: Response;
  try {
    response = await fetch(`${env.apiUrl}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      cache: 'no-store',
      credentials: 'include',
      headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('No signal. Your notice needs a connection to open.', 0, 'NETWORK');
  }
  if (!response.ok) throw await failure(response);
  return { blob: await response.blob(), filename: filenameOf(response, fallbackName) };
}
