/**
 * Inventory Milestone Five (Dispatch & Branch Receiving), Session A — real
 * backend implementation of the frozen contract (`../types`, mirroring
 * `backend/src/modules/dispatch/dispatch-validators.ts`).
 *
 * Same token-reading convention as `requisitions-api-service.ts`.
 */
import { apiClient } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';
import type {
  DeliveryNote,
  DepartmentTag,
  DispatchQueueRow,
  FulfilDepartmentInput,
  FulfilDetail,
  ListDispatchQueueQuery,
} from '../types';

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

export async function listDispatchQueue(query: ListDispatchQueueQuery = {}): Promise<DispatchQueueRow[]> {
  return apiClient.get<DispatchQueueRow[]>(`/dispatch/queue${toQueryString(query)}`, token());
}

export async function getFulfilDetail(requisitionId: string): Promise<FulfilDetail> {
  return apiClient.get<FulfilDetail>(`/dispatch/${requisitionId}/fulfil`, token());
}

export async function fulfilDepartment(
  requisitionId: string,
  departmentTag: DepartmentTag,
  input: FulfilDepartmentInput,
): Promise<DeliveryNote> {
  return apiClient.post<DeliveryNote>(`/dispatch/${requisitionId}/fulfil/${departmentTag}`, input, token());
}

export async function getDeliveryNote(dispatchId: string): Promise<DeliveryNote> {
  return apiClient.get<DeliveryNote>(`/dispatch/${dispatchId}/delivery-note`, token());
}
