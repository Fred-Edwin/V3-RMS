import { env } from './env';
import { ApiError, type ApiResponseEnvelope } from '@/types/api';

const request = async <T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  token?: string,
): Promise<T> => {
  const response = await fetch(`${env.apiUrl}${path}`, {
    method,
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
    );
  }

  return payload.data as T;
};

export const apiClient = {
  get: <T>(path: string, token?: string): Promise<T> => request<T>('GET', path, undefined, token),
  post: <T>(path: string, body: unknown, token?: string): Promise<T> =>
    request<T>('POST', path, body, token),
  patch: <T>(path: string, body: unknown, token?: string): Promise<T> =>
    request<T>('PATCH', path, body, token),
  delete: <T>(path: string, token?: string): Promise<T> =>
    request<T>('DELETE', path, undefined, token),
};
