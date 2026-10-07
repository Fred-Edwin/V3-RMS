/**
 * The Prep rebuild's one HTTP service (docs/API_CONTRACT.md §33), typed against the frozen contract mirror. Slices 1, 3 and 4 add
 * their endpoints here. The old `services/prep-api-service.ts` is a temporary adapter for the old History and detail pages.
 */
import { apiClient } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';
import type {
  CancelInput,
  CancelPreview,
  CheckInput,
  CheckResult,
  CorrectInput,
  OutputsResponse,
  PrepAgainResponse,
  RecordInput,
  RunDetail,
  RunsList,
  RunsQuery,
} from '../types/prep-contract';

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
  /** #10 */
  getRun: (id: string): Promise<RunDetail> => apiClient.get<RunDetail>(`${BASE}/runs/${id}`, token()),
  /** #11 Correct a run: returns the NEW run. The same idempotency key returns the same new run. */
  correctRun: (id: string, input: CorrectInput): Promise<RunDetail> => apiClient.post<RunDetail>(`${BASE}/runs/${id}/correct`, input, token()),
  /** #12 Cancel a run. A repeat is 409 RUN_NOT_OPEN. */
  cancelRun: (id: string, input: CancelInput): Promise<RunDetail> => apiClient.post<RunDetail>(`${BASE}/runs/${id}/cancel`, input, token()),
  /** #13 What cancelling would do to stock (managers; needs `restock.read`). */
  cancelPreview: (id: string): Promise<CancelPreview> => apiClient.get<CancelPreview>(`${BASE}/runs/${id}/cancel-preview`, token()),
};
