/**
 * Branch day close — Milestone Six, Session 3. Real backend implementation of
 * the frozen contract (`../types/branch-day`).
 */
import { apiClient } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';
import type {
  BranchDayToday,
  BranchThresholds,
  CloseResult,
  DayDocument,
  DepartmentDayDetail,
  DepartmentTag,
  ReopenResult,
  SaveDepartmentLinesInput,
  SaveLinesResult,
} from '../types/branch-day';

function token(): string | undefined {
  return useAuthStore.getState().accessToken ?? undefined;
}

export async function getToday(): Promise<BranchDayToday> {
  return apiClient.get<BranchDayToday>('/branch-day/today', token());
}

export async function getDepartment(dayId: string, tag: DepartmentTag): Promise<DepartmentDayDetail> {
  return apiClient.get<DepartmentDayDetail>(`/branch-day/${dayId}/departments/${tag}`, token());
}

export async function saveDepartmentLines(dayId: string, tag: DepartmentTag, input: SaveDepartmentLinesInput): Promise<SaveLinesResult> {
  return apiClient.put<SaveLinesResult>(`/branch-day/${dayId}/departments/${tag}/lines`, input, token());
}

export async function closeDay(dayId: string, pin: string): Promise<CloseResult> {
  return apiClient.post<CloseResult>(`/branch-day/${dayId}/close`, { pin }, token());
}

export async function reopenDay(dayId: string, reason: string): Promise<ReopenResult> {
  return apiClient.post<ReopenResult>(`/branch-day/${dayId}/reopen`, { reason }, token());
}

export async function getDayDocument(dayId: string): Promise<DayDocument> {
  return apiClient.get<DayDocument>(`/branch-day/${dayId}/document`, token());
}

export async function getBranchThresholds(): Promise<BranchThresholds> {
  return apiClient.get<BranchThresholds>('/inventory/thresholds', token());
}

export async function saveBranchThresholds(input: { reasonRequiredKes: number; overnightAlertKes: number }): Promise<BranchThresholds> {
  return apiClient.put<BranchThresholds>('/inventory/thresholds', input, token());
}
