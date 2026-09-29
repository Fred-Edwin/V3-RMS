/**
 * Central Store team management — a Store Manager's own attendants.
 * Real backend only (no mock): `/staff` routes, scoped server-side to
 * hub-org `STORE_ATTENDANT` accounts.
 */
import { apiClient } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';
import type { AddAttendantInput, TeamMember } from '../types/team';

function token(): string | undefined {
  return useAuthStore.getState().accessToken ?? undefined;
}

export async function listTeam(): Promise<TeamMember[]> {
  return apiClient.get<TeamMember[]>('/staff', token());
}

export async function addAttendant(input: AddAttendantInput): Promise<TeamMember> {
  return apiClient.post<TeamMember>('/staff', { ...input, role: 'STORE_ATTENDANT' }, token());
}

export async function resetAttendantPassword(id: string, temporaryPassword: string): Promise<void> {
  await apiClient.patch(`/staff/${id}/reset-password`, { temporaryPassword }, token());
}

export async function resetAttendantPin(id: string): Promise<void> {
  await apiClient.patch(`/staff/${id}/reset-pin`, {}, token());
}

export async function setAttendantActive(id: string, isActive: boolean): Promise<void> {
  await apiClient.patch(`/staff/${id}/${isActive ? 'reactivate' : 'deactivate'}`, {}, token());
}
