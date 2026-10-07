/**
 * The one seam the Counting, Stock and Waste services call through (`callApi`). With `NEXT_PUBLIC_SCW_FIXTURES=1` it answers from the
 * in-memory fixture handler the sub-module supplies; with the flag off it is a plain `apiClient` call. Nothing above the services
 * knows which. The flag is inlined at build time, so the fixture modules are not in a production bundle.
 */
import { apiClient } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';

export type HttpMethod = 'GET' | 'POST' | 'PUT';

/** What a fixture handler receives: the method, the path under the service base (with its query string) and the JSON body. */
export interface FixtureRequest {
  method: HttpMethod;
  path: string;
  query: URLSearchParams;
  body: unknown;
}

export type FixtureHandler = (request: FixtureRequest) => unknown;

export const USE_FIXTURES = process.env.NEXT_PUBLIC_SCW_FIXTURES === '1';

const token = (): string | undefined => useAuthStore.getState().accessToken ?? undefined;

/** A short wait so skeletons and pending states are visible and testable while the data is local. */
const FIXTURE_LATENCY_MS = 220;

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

/** Makes a `callApi` for one service. `loadFixtures` is only called when the flag is on. */
export function makeCallApi(base: string, loadFixtures: () => Promise<FixtureHandler>) {
  let handler: Promise<FixtureHandler> | null = null;
  return async function callApi<T>(method: HttpMethod, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    if (USE_FIXTURES) {
      handler ??= loadFixtures();
      const answer = await handler;
      await new Promise((resolve) => setTimeout(resolve, FIXTURE_LATENCY_MS));
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const [pathOnly = '', qs = ''] = path.split('?');
      return structuredClone(answer({ method, path: pathOnly, query: new URLSearchParams(qs), body })) as T;
    }
    const url = `${base}${path}`;
    if (method === 'GET') return apiClient.get<T>(url, token());
    if (method === 'POST') return apiClient.post<T>(url, body ?? {}, token());
    return apiClient.put<T>(url, body ?? {}, token());
  };
}
