/**
 * Inventory Milestone Six, Session 2 — Central Store counting + thresholds.
 * Real backend implementation of the frozen contract (`../types/count`).
 */
import { apiClient } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';
import type {
  ApproveCountResult,
  AttendantCountView,
  AttendantSaveResult,
  AttendantSubmitResult,
  CountKind,
  CountList,
  CountPrint,
  DecideLineInput,
  ReturnCountResult,
  SaveCountLinesInput,
  SpotCountInput,
  SpotCountResult,
  Thresholds,
  VerifierCountView,
} from '../types/count';

function token(): string | undefined {
  return useAuthStore.getState().accessToken ?? undefined;
}

// --- Attendant ---------------------------------------------------------------

export async function getTodaysCount(): Promise<AttendantCountView> {
  return apiClient.get<AttendantCountView>('/inventory/counts/today', token());
}

export async function saveCountLines(countId: string, input: SaveCountLinesInput): Promise<AttendantSaveResult> {
  return apiClient.put<AttendantSaveResult>(`/inventory/counts/${countId}/lines`, input, token());
}

export async function submitCount(countId: string, pin: string): Promise<AttendantSubmitResult> {
  return apiClient.post<AttendantSubmitResult>(`/inventory/counts/${countId}/submit`, { pin }, token());
}

export async function getAttendantCount(countId: string): Promise<AttendantCountView> {
  return apiClient.get<AttendantCountView>(`/inventory/counts/${countId}`, token());
}

// --- Store Manager -------------------------------------------------------------

export async function listCounts(kind?: CountKind, limit = 30): Promise<CountList> {
  const qs = new URLSearchParams({ limit: String(limit) });
  if (kind) qs.set('kind', kind);
  return apiClient.get<CountList>(`/inventory/counts?${qs.toString()}`, token());
}

export async function getVerifierCount(countId: string): Promise<VerifierCountView> {
  return apiClient.get<VerifierCountView>(`/inventory/counts/${countId}`, token());
}

export async function decideCountLine(countId: string, lineId: string, input: DecideLineInput): Promise<VerifierCountView> {
  return apiClient.patch<VerifierCountView>(`/inventory/counts/${countId}/lines/${lineId}`, input, token());
}

export async function returnCount(countId: string, note?: string): Promise<ReturnCountResult> {
  const trimmed = note?.trim();
  return apiClient.post<ReturnCountResult>(`/inventory/counts/${countId}/return`, trimmed ? { note: trimmed } : {}, token());
}

export async function approveCount(countId: string, pin: string): Promise<ApproveCountResult> {
  return apiClient.post<ApproveCountResult>(`/inventory/counts/${countId}/approve`, { pin }, token());
}

export async function createSpotCount(input: SpotCountInput): Promise<SpotCountResult> {
  return apiClient.post<SpotCountResult>('/inventory/spot-counts', input, token());
}

export async function getCountPrint(countId: string): Promise<CountPrint> {
  return apiClient.get<CountPrint>(`/inventory/counts/${countId}/print`, token());
}

// --- Thresholds -------------------------------------------------------------------

export async function getThresholds(): Promise<Thresholds> {
  return apiClient.get<Thresholds>('/inventory/thresholds', token());
}

export async function saveThresholds(reasonRequiredKes: number): Promise<Thresholds> {
  return apiClient.put<Thresholds>('/inventory/thresholds', { reasonRequiredKes }, token());
}
