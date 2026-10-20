import { apiClient } from '@/lib/apiClient';
import { env } from '@/lib/env';
import { useAuthStore } from '@/store/authStore';
import { ApiError, type ApiResponseEnvelope } from '@/types/api';

import type {
  AdjustBody,
  AdjustPreview,
  AdjustResult,
  ApplicationDetail,
  ApproveResult,
  AskBody,
  AwayPerson,
  BalanceDrawer,
  BalancesPage,
  BalancesQuery,
  CalendarView,
  CancelReason,
  DeclineReason,
  FileBlob,
  MineQuery,
  MyOverview,
  MyRow,
  Page,
  Preview,
  PreviewBody,
  RequestsPage,
  RequestsQuery,
  RotaPanel,
  WriteResult,
} from '../types/leave-types';

/** One function per Leave endpoint the screens use (API_CONTRACT §45). Every write carries an `Idempotency-Key` the screen made for that intent. */
const BASE = '/workforce/leave';
const token = (): string | undefined => useAuthStore.getState().accessToken ?? undefined;

export function query(params: Record<string, string | number | boolean | undefined>): string {
  const pairs = Object.entries(params).filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined && entry[1] !== '' && entry[1] !== false);
  return pairs.length === 0 ? '' : `?${pairs.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&')}`;
}

const keyed = (key: string): Record<string, string> => ({ 'Idempotency-Key': key });

export const leaveReads = {
  /** M1: the cards, the waiting strip and the types that can be asked for. A casual worker gets `casual: true` and no cards. */
  overview: (year?: number): Promise<MyOverview> => apiClient.get(`${BASE}/me/overview${query({ year })}`, token()),
  /** M2 */
  mine: (q: MineQuery): Promise<Page<MyRow>> => apiClient.get(`${BASE}/me/applications${query({ year: q.year, status: q.status?.join(','), type: q.type, page: q.page, rows: q.rows })}`, token()),
  /** M3 */
  detail: (id: string): Promise<ApplicationDetail> => apiClient.get(`${BASE}/applications/${id}`, token()),
  /** D1 */
  requests: (q: RequestsQuery): Promise<RequestsPage> => apiClient.get(`${BASE}/requests${query({ tab: q.tab, site: q.site, dept: q.dept, q: q.q, page: q.page, rows: q.rows })}`, token()),
  /** D2 */
  rota: (id: string): Promise<RotaPanel> => apiClient.get(`${BASE}/applications/${id}/rota`, token()),
  /** B1 */
  balances: (q: BalancesQuery, year?: number): Promise<BalancesPage> =>
    apiClient.get(`${BASE}/balances${query({ site: q.site, dept: q.dept, filter: q.filter, q: q.q, year, leavers: q.leavers, page: q.page, rows: q.rows })}`, token()),
  /** B2 */
  drawer: (employeeId: string, year?: number): Promise<BalanceDrawer> => apiClient.get(`${BASE}/balances/${employeeId}${query({ year })}`, token()),
  /** C1 */
  calendar: (site: string | undefined, dept: string | undefined, from: string | undefined): Promise<CalendarView> => apiClient.get(`${BASE}/calendar${query({ site, dept, from })}`, token()),
  /** N1 */
  badge: (): Promise<{ count: number }> => apiClient.get(`${BASE}/badge`, token()),
  away: (from: string, to: string, site?: string): Promise<{ count: number; people: AwayPerson[] }> => apiClient.get(`${BASE}/away${query({ from, to, site })}`, token()),
};

export const leaveWrites = {
  /** M4: no side effects. */
  preview: (body: PreviewBody): Promise<Preview> => apiClient.post(`${BASE}/applications/preview`, body, token()),
  /** M5 */
  ask: (body: AskBody, key: string): Promise<WriteResult> => apiClient.post(`${BASE}/applications`, body, token(), keyed(key)),
  /** M6 by the person: no body, no PIN. */
  cancelOwn: (id: string, key: string): Promise<WriteResult> => apiClient.post(`${BASE}/applications/${id}/cancel`, {}, token(), keyed(key)),
  /** M6 by a manager: a reason and a PIN. */
  cancelApproved: (id: string, body: { reasonCode: CancelReason; note?: string; pin: string }, key: string): Promise<WriteResult> => apiClient.post(`${BASE}/applications/${id}/cancel`, body, token(), keyed(key)),
  /** D3 */
  approve: (id: string, body: { pin: string; expectedVersion: number }, key: string): Promise<ApproveResult> => apiClient.post(`${BASE}/applications/${id}/approve`, body, token(), keyed(key)),
  /** D4: no PIN. */
  decline: (id: string, body: { reasonCode: DeclineReason; note?: string; expectedVersion: number }, key: string): Promise<WriteResult> => apiClient.post(`${BASE}/applications/${id}/decline`, body, token(), keyed(key)),
  /** B3 */
  adjustPreview: (body: { employeeId: string; typeCode: string; add?: number }): Promise<AdjustPreview> => apiClient.post(`${BASE}/balances/adjust/preview`, body, token()),
  adjust: (body: AdjustBody, key: string): Promise<AdjustResult> => apiClient.post(`${BASE}/balances/adjust`, body, token(), keyed(key)),
};

const filenameOf = (response: Response, fallback: string): string => /filename="?([^";]+)"?/.exec(response.headers.get('content-disposition') ?? '')?.[1] ?? fallback;

/** S2: the slip as the stored A4 file. The bytes stay in memory only; the caller saves or draws them and drops them. */
export async function slipFile(id: string, fallbackName: string): Promise<FileBlob> {
  let response: Response;
  try {
    response = await fetch(`${env.apiUrl}${BASE}/applications/${id}/slip.pdf`, {
      cache: 'no-store',
      credentials: 'include',
      headers: { ...(token() ? { Authorization: `Bearer ${token()}` } : {}) },
    });
  } catch {
    throw new ApiError('No connection. Try again when you have signal.', 0, 'NETWORK');
  }
  if (!response.ok) {
    let payload: ApiResponseEnvelope<unknown> | null = null;
    try {
      payload = (await response.json()) as ApiResponseEnvelope<unknown>;
    } catch {
      payload = null;
    }
    throw new ApiError(payload?.error?.message ?? 'Request failed', response.status, payload?.error?.code ?? 'UNKNOWN_ERROR', payload?.error?.details);
  }
  return { blob: await response.blob(), filename: filenameOf(response, fallbackName) };
}
