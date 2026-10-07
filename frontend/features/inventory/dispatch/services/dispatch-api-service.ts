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
  ConfirmDeliveryInput,
  DeliveryNote,
  DeliveryRow,
  DepartmentTag,
  DiscrepancyDetail,
  DiscrepancyPage,
  DiscrepancyRow,
  DispatchQueueRow,
  FulfilDepartmentInput,
  FulfilDetail,
  ListDeliveriesQuery,
  ListDiscrepanciesQuery,
  ListDispatchQueueQuery,
  ResolveDiscrepancyInput,
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

// --- Deliveries / confirm (C4/C5, Session B) --------------------------------

export async function listDeliveries(query: ListDeliveriesQuery = {}): Promise<DeliveryRow[]> {
  return apiClient.get<DeliveryRow[]>(`/deliveries${toQueryString(query)}`, token());
}

export async function getDeliveryDetail(dispatchId: string): Promise<DeliveryRow> {
  return apiClient.get<DeliveryRow>(`/deliveries/${dispatchId}`, token());
}

export async function getDeliveryNoteForBranch(dispatchId: string): Promise<DeliveryNote> {
  return apiClient.get<DeliveryNote>(`/deliveries/${dispatchId}/delivery-note`, token());
}

export async function confirmDelivery(dispatchId: string, input: ConfirmDeliveryInput): Promise<DeliveryNote> {
  return apiClient.post<DeliveryNote>(`/deliveries/${dispatchId}/confirm`, input, token());
}

export async function confirmDeliveryOnBehalf(dispatchId: string, input: ConfirmDeliveryInput): Promise<DeliveryNote> {
  return apiClient.post<DeliveryNote>(`/deliveries/${dispatchId}/confirm-on-behalf`, input, token());
}

// --- Discrepancy (C6/C7, Session B) -----------------------------------------

export async function listDiscrepancies(query: ListDiscrepanciesQuery = {}): Promise<DiscrepancyRow[]> {
  return apiClient.get<DiscrepancyRow[]>(`/discrepancies${toQueryString(query)}`, token());
}

/** One page of the discrepancy list with the total that matches the status and search (the shared table's list). */
export async function listDiscrepancyPage(query: ListDiscrepanciesQuery): Promise<DiscrepancyPage> {
  const envelope = await apiClient.getWithEnvelope<DiscrepancyRow[]>(`/discrepancies${toQueryString(query)}`, token());
  const rows = envelope.data ?? [];
  return { rows, total: envelope.pagination?.total ?? rows.length };
}

export async function getDiscrepancy(id: string): Promise<DiscrepancyDetail> {
  return apiClient.get<DiscrepancyDetail>(`/discrepancies/${id}`, token());
}

export async function resolveDiscrepancy(id: string, input: ResolveDiscrepancyInput): Promise<DiscrepancyDetail> {
  return apiClient.post<DiscrepancyDetail>(`/discrepancies/${id}/resolve`, input, token());
}
