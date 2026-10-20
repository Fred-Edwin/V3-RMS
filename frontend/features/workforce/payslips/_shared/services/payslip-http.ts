import { env } from '@/lib/env';
import { useAuthStore } from '@/store/authStore';
import { ApiError, type ApiResponseEnvelope } from '@/types/api';

import { deviceId } from '../lib/device-id';
import { clearSession, currentToken, touchSession } from '../lib/unlock-session';
import type { FileBlob } from '../types/payslip-types';

/**
 * The one door for payslip calls. `apiClient` cannot add headers to a read or return a file, and a payslip read needs two: the phone's
 * own id and the unlock token (API_CONTRACT §42). A refusal with `UNLOCK_REQUIRED` closes the unlock in memory so the screen goes back
 * to the code; it is a 403, so the app does not treat it as signed out.
 */
interface CallOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  /** Send the unlock token. Reads that show pay need it; the list, unlock and lock do not. */
  unlock?: boolean;
}

function headers(options: CallOptions, json: boolean): Record<string, string> {
  const state = useAuthStore.getState();
  const token = options.unlock ? currentToken(state.user?.id ?? null) : null;
  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...(state.accessToken ? { Authorization: `Bearer ${state.accessToken}` } : {}),
    'x-device-id': deviceId(),
    ...(token ? { 'x-payslip-unlock': token } : {}),
  };
}

async function send(path: string, options: CallOptions): Promise<Response> {
  try {
    return await fetch(`${env.apiUrl}${path}`, {
      method: options.method ?? 'GET',
      cache: 'no-store',
      credentials: 'include',
      headers: headers(options, options.body !== undefined),
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError('No signal. Your payslips need a connection to open.', 0, 'NETWORK');
  }
}

async function failure(response: Response): Promise<ApiError> {
  let payload: ApiResponseEnvelope<unknown> | null = null;
  try {
    payload = (await response.json()) as ApiResponseEnvelope<unknown>;
  } catch {
    payload = null;
  }
  const code = payload?.error?.code ?? 'UNKNOWN_ERROR';
  if (code === 'UNLOCK_REQUIRED') clearSession();
  return new ApiError(payload?.error?.message ?? 'Request failed', response.status, code, payload?.error?.details);
}

export async function payslipJson<T>(path: string, options: CallOptions = {}): Promise<T> {
  const response = await send(path, options);
  if (!response.ok) throw await failure(response);
  if (options.unlock) touchSession();
  const payload = (await response.json()) as ApiResponseEnvelope<T>;
  return payload.data as T;
}

const filenameOf = (response: Response, fallback: string): string => /filename="?([^";]+)"?/.exec(response.headers.get('content-disposition') ?? '')?.[1] ?? fallback;

/** A stored PDF. The bytes are kept in memory only; the caller makes an object URL and revokes it. */
export async function payslipFile(path: string, fallbackName: string): Promise<FileBlob> {
  const response = await send(path, { unlock: true });
  if (!response.ok) throw await failure(response);
  touchSession();
  return { blob: await response.blob(), filename: filenameOf(response, fallbackName) };
}

/** A file for a person who does not use the staff code (HR, the Accountant): no unlock header. */
export async function openFile(path: string, fallbackName: string, method: 'GET' | 'POST' = 'GET'): Promise<FileBlob> {
  const response = await send(path, method === 'POST' ? { method, body: {} } : {});
  if (!response.ok) throw await failure(response);
  return { blob: await response.blob(), filename: filenameOf(response, fallbackName) };
}
