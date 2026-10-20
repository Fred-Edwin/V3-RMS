import { deviceHeader } from './device-id';
import { env } from './env';
import { ApiError, type ApiResponseEnvelope } from '@/types/api';

/** The browser event the Workforce session gate raises (`SESSION_ENDED`, `PHONE_REMOVED`, `PASSWORD_RESET_REQUIRED`). */
export const SESSION_GATE_EVENT = 'workforce:session-gate';
const SESSION_GATE_CODES: readonly string[] = ['SESSION_ENDED', 'PHONE_REMOVED', 'PASSWORD_RESET_REQUIRED'];

const request = async <T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  token?: string,
  extraHeaders?: Record<string, string>,
): Promise<T> => {
  const response = await fetch(`${env.apiUrl}${path}`, {
    method,
    cache: 'no-store',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      // Every Workforce call says which phone it is (the server uses it for the phone list and the payslip code).
      ...(path.startsWith('/workforce') ? deviceHeader() : {}),
      ...extraHeaders,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = (await response.json()) as ApiResponseEnvelope<T>;

  if (!response.ok) {
    const err = new ApiError(
      payload.error?.message ?? 'Request failed',
      response.status,
      payload.error?.code ?? 'UNKNOWN_ERROR',
      payload.error?.details,
    );
    // Log the real error details so they appear in the browser console
    console.error(`[apiClient] ${method} ${path} → ${response.status}`, payload.error ?? payload);
    // Workforce session gate (Segment 6a): the app shell listens and signs the person in again, asks the phone question or shows the reset.
    if (SESSION_GATE_CODES.includes(err.code) && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(SESSION_GATE_EVENT, { detail: { code: err.code } }));
    }
    throw err;
  }

  return payload.data as T;
};

const requestEnvelope = async <T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  token?: string,
): Promise<ApiResponseEnvelope<T>> => {
  const response = await fetch(`${env.apiUrl}${path}`, {
    method,
    cache: 'no-store',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = (await response.json()) as ApiResponseEnvelope<T>;

  if (!response.ok) {
    throw new ApiError(
      payload.error?.message ?? 'Request failed',
      response.status,
      payload.error?.code ?? 'UNKNOWN_ERROR',
      payload.error?.details,
    );
  }

  return payload;
};

export const apiClient = {
  get: <T>(path: string, token?: string): Promise<T> => request<T>('GET', path, undefined, token),
  getWithEnvelope: <T>(path: string, token?: string): Promise<ApiResponseEnvelope<T>> =>
    requestEnvelope<T>('GET', path, undefined, token),
  post: <T>(path: string, body: unknown, token?: string, headers?: Record<string, string>): Promise<T> =>
    request<T>('POST', path, body, token, headers),
  postWithEnvelope: <T>(path: string, body: unknown, token?: string): Promise<ApiResponseEnvelope<T>> =>
    requestEnvelope<T>('POST', path, body, token),
  put: <T>(path: string, body: unknown, token?: string): Promise<T> =>
    request<T>('PUT', path, body, token),
  patch: <T>(path: string, body: unknown, token?: string, headers?: Record<string, string>): Promise<T> =>
    request<T>('PATCH', path, body, token, headers),
  delete: <T>(path: string, token?: string, body?: unknown): Promise<T> =>
    request<T>('DELETE', path, body, token),
};
