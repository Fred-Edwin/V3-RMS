/**
 * The one seam the Counting, Stock and Waste services call through (`callApi`): a plain `apiClient` call. (Until the back ends
 * were merged it could answer from in-memory fixtures; those handlers are gone, the fixtures JSON stays for the contract tests.)
 */
import { apiClient } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';

export type HttpMethod = 'GET' | 'POST' | 'PUT';

const token = (): string | undefined => useAuthStore.getState().accessToken ?? undefined;

export function queryString(params: object | undefined): string {
  if (!params) return '';
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' || value === false) continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

/** Makes a `callApi` for one service under `base`. */
export function makeCallApi(base: string) {
  return async function callApi<T>(method: HttpMethod, path: string, body?: unknown, _signal?: AbortSignal): Promise<T> {
    const url = `${base}${path}`;
    if (method === 'GET') return apiClient.get<T>(url, token());
    if (method === 'POST') return apiClient.post<T>(url, body ?? {}, token());
    return apiClient.put<T>(url, body ?? {}, token());
  };
}
