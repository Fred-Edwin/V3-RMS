import { busyEnded, busyStarted } from './busy-signal';
import { deviceHeader } from './device-id';
import { env } from './env';
import { ApiError, type ApiResponseEnvelope } from '@/types/api';

/** The browser event the Workforce session gate raises (`SESSION_ENDED`, `PHONE_REMOVED`, `PASSWORD_RESET_REQUIRED`). */
export const SESSION_GATE_EVENT = 'workforce:session-gate';
const SESSION_GATE_CODES: readonly string[] = ['SESSION_ENDED', 'PHONE_REMOVED', 'PASSWORD_RESET_REQUIRED'];

const BUSY_RETRIES = 3;
const BUSY_WAIT_MS = 1500;

const request = async <T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  token?: string,
  extraHeaders?: Record<string, string>,
): Promise<T> => {
  const send = (): Promise<Response> =>
    fetch(`${env.apiUrl}${path}`, {
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

  let response = await send();
  // "The system is busy, trying again" (finding 46): a read that hits the rate limit waits and retries on its own, up to three times.
  // Writes are never retried, so nothing is done twice.
  if (method === 'GET' && response.status === 429) {
    busyStarted();
    try {
      for (let attempt = 1; response.status === 429 && attempt <= BUSY_RETRIES; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, BUSY_WAIT_MS * attempt));
        response = await send();
      }
    } finally {
      busyEnded();
    }
  }

  const payload = (await response.json()) as ApiResponseEnvelope<T>;

  if (!response.ok) {
    const err = new ApiError(
      response.status === 429 ? 'The system is busy. Wait a moment and try again.' : (payload.error?.message ?? 'Request failed'),
      response.status,
      payload.error?.code ?? 'UNKNOWN_ERROR',
      payload.error?.details,
      payload.error?.reference,
    );
    // Only a server fault is logged as an error. A 4xx (a 404 "not on your list", a refusal) is an expected answer the screen shows
    // as a state, so it stays out of the console (finding 50).
    if (response.status >= 500) console.error(`[apiClient] ${method} ${path} → ${response.status}`, payload.error ?? payload);
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

/**
 * Identical reads that are in flight at the same moment share one call (finding 28): the shell asks for the same four numbers
 * from several components at once, and opening a pay card asked twice and wrote the audit entry twice. The entry is removed the
 * moment the call settles, so a later read (after a save, say) always asks again.
 */
const inFlight = new Map<string, Promise<unknown>>();
const sharedGet = <T>(path: string, token?: string): Promise<T> => {
  const key = `${token ?? ''}|${path}`;
  const running = inFlight.get(key);
  if (running) return running as Promise<T>;
  const call = request<T>('GET', path, undefined, token).finally(() => inFlight.delete(key));
  inFlight.set(key, call);
  return call;
};

export const apiClient = {
  get: <T>(path: string, token?: string): Promise<T> => sharedGet<T>(path, token),
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
