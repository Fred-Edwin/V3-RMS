/**
 * Inventory Milestone Three (Prep) — real backend implementation of the
 * frozen contract (`../types/prep`, mirroring
 * `backend/src/modules/inventory/prep-validators.ts`).
 *
 * Same token-reading convention as `receiving-api-service.ts`.
 */
import { apiClient } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';
import type {
  CreatePrepRunInput,
  ListPrepRunsQuery,
  PrepRunDetail,
  PrepRunSummary,
  PrepSummary,
  PrepSummaryQuery,
  TypicalYield,
} from '../types/prep';

function token(): string | undefined {
  return useAuthStore.getState().accessToken ?? undefined;
}

function toQueryString(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

// ─── Prep runs ──────────────────────────────────────────────────────────────

export async function listPrepRuns(query: ListPrepRunsQuery = {}): Promise<PrepRunSummary[]> {
  return apiClient.get<PrepRunSummary[]>(`/inventory/prep/runs${toQueryString(query)}`, token());
}

export async function getPrepRun(id: string): Promise<PrepRunDetail> {
  return apiClient.get<PrepRunDetail>(`/inventory/prep/runs/${id}`, token());
}

export async function createPrepRun(input: CreatePrepRunInput): Promise<PrepRunDetail> {
  return apiClient.post<PrepRunDetail>('/inventory/prep/runs', input, token());
}

export async function getPrepSummary(query: PrepSummaryQuery = {}): Promise<PrepSummary> {
  return apiClient.get<PrepSummary>(`/inventory/prep/summary${toQueryString(query)}`, token());
}

export async function getTypicalYield(outputItemId: string): Promise<TypicalYield> {
  return apiClient.get<TypicalYield>(`/inventory/items/${outputItemId}/typical-yield`, token());
}
