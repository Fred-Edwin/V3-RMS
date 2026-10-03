import { apiClient } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';
import type { AuditLogPage, AuditLogParams } from '../types/audit-log';

const token = (): string | undefined => useAuthStore.getState().accessToken ?? undefined;

export function getAuditLog(params: AuditLogParams = {}): Promise<AuditLogPage> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  const qs = query.toString();
  return apiClient.get<AuditLogPage>(`/inventory/audit-log${qs ? `?${qs}` : ''}`, token());
}
