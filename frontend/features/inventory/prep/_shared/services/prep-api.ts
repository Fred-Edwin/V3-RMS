/**
 * The Prep rebuild's one HTTP service (docs/API_CONTRACT.md §33), typed against the frozen contract mirror. Slices 1, 3 and 4 add
 * their endpoints here.
 */
import { apiClient } from '@/lib/apiClient';
import { env } from '@/lib/env';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/types/api';
import type { CheckInput, CheckResult, NeedsLookCount, NeedsLookList, OutputsResponse, PrepAgainResponse, RecordInput, RunDetail, RunsList, RunsQuery, RunsSummary } from '../types/prep-contract';

const token = (): string | undefined => useAuthStore.getState().accessToken ?? undefined;

const queryString = (params: object): string => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '' && value !== false) search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
};

const BASE = '/inventory/prep';

export const prepApi = {
  /** #4 Every live prepped item, for "Something else". */
  outputs: (): Promise<OutputsResponse> => apiClient.get<OutputsResponse>(`${BASE}/outputs`, token()),
  /** #5 The 3 most-made outputs. */
  prepAgain: (): Promise<PrepAgainResponse> => apiClient.get<PrepAgainResponse>(`${BASE}/prep-again`, token()),
  /** #6 The live yield check; writes nothing. */
  check: (input: CheckInput): Promise<CheckResult> => apiClient.post<CheckResult>(`${BASE}/runs/check`, input, token()),
  /** #7 Record the run. The same idempotency key returns the same run. */
  record: (input: RecordInput): Promise<RunDetail> => apiClient.post<RunDetail>(`${BASE}/runs`, input, token()),
  /** #8 */
  listRuns: (query: RunsQuery = {}): Promise<RunsList> => apiClient.get<RunsList>(`${BASE}/runs${queryString(query)}`, token()),
  /** #9 The manager's KPI strip. prep.read_flags: never call it for an Attendant. */
  runsSummary: (): Promise<RunsSummary> => apiClient.get<RunsSummary>(`${BASE}/runs/summary`, token()),
  /** #10 */
  getRun: (id: string): Promise<RunDetail> => apiClient.get<RunDetail>(`${BASE}/runs/${id}`, token()),
  /** #14 The queue behind the band. prep.read_flags. */
  needsLook: (query: { page?: number; perPage?: number } = {}): Promise<NeedsLookList> =>
    apiClient.get<NeedsLookList>(`${BASE}/needs-a-look${queryString(query)}`, token()),
  /** #15 The sidebar badge. prep.read_flags. */
  needsLookCount: (): Promise<NeedsLookCount> => apiClient.get<NeedsLookCount>(`${BASE}/needs-a-look/count`, token()),
  /** #16 Mark reviewed. Safe to repeat: a reviewed run comes back unchanged. prep.review. */
  reviewRun: (id: string): Promise<RunDetail> => apiClient.post<RunDetail>(`${BASE}/runs/${id}/review`, {}, token()),
  /** #17 The History table as a CSV file for these filters (no paging). prep.read_flags. */
  exportRuns: async (query: Omit<RunsQuery, 'page' | 'perPage'> = {}): Promise<{ blob: Blob; fileName: string }> => {
    const token_ = token();
    const response = await fetch(`${env.apiUrl}${BASE}/runs/export${queryString(query)}`, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'include',
      headers: token_ ? { Authorization: `Bearer ${token_}` } : {},
    });
    if (!response.ok) {
      // An error comes back as the usual JSON envelope, not a file.
      const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string; code?: string; details?: unknown } };
      throw new ApiError(payload.error?.message ?? 'Request failed', response.status, payload.error?.code ?? 'UNKNOWN_ERROR', payload.error?.details);
    }
    const disposition = response.headers.get('Content-Disposition') ?? '';
    const fileName = /filename="?([^";]+)"?/i.exec(disposition)?.[1] ?? 'prep-history.csv';
    return { blob: await response.blob(), fileName };
  },
};
