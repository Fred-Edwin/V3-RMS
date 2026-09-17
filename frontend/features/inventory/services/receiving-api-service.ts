/**
 * Inventory Milestone Two (Receiving & Supplier AP) — real backend
 * implementation of the frozen contract (`../types/receiving`, mirroring
 * `backend/src/modules/inventory/receiving-validators.ts`). S5 only wires
 * the endpoints S3 shipped (purchasing summary/history, expected deliveries,
 * last-price) — goods receipts, supplier invoices, and supplier payments
 * come with S6+.
 *
 * Same token-reading convention as `inventory-api-service.ts`.
 */
import { apiClient } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';
import type {
  CreateExpectedDeliveryInput,
  ExpectedDeliverySummary,
  ListExpectedDeliveriesQuery,
  PurchasingHistoryRow,
  PurchasingSummary,
} from '../types/receiving';

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

// ─── Purchasing hub ─────────────────────────────────────────────────────────

export async function getPurchasingSummary(): Promise<PurchasingSummary> {
  return apiClient.get<PurchasingSummary>('/inventory/purchasing/summary', token());
}

export interface PurchasingHistoryQuery {
  search?: string;
  supplierId?: string;
  status?: string;
  from?: string;
  to?: string;
  limit?: number;
}

export async function getPurchasingHistory(query: PurchasingHistoryQuery = {}): Promise<PurchasingHistoryRow[]> {
  return apiClient.get<PurchasingHistoryRow[]>(`/inventory/purchasing/history${toQueryString(query)}`, token());
}

// ─── Expected deliveries ────────────────────────────────────────────────────

export async function listExpectedDeliveries(
  query: ListExpectedDeliveriesQuery = {}
): Promise<ExpectedDeliverySummary[]> {
  return apiClient.get<ExpectedDeliverySummary[]>(`/inventory/expected-deliveries${toQueryString(query)}`, token());
}

export async function createExpectedDelivery(
  input: CreateExpectedDeliveryInput
): Promise<ExpectedDeliverySummary> {
  return apiClient.post<ExpectedDeliverySummary>('/inventory/expected-deliveries', input, token());
}

export async function cancelExpectedDelivery(id: string): Promise<ExpectedDeliverySummary> {
  return apiClient.post<ExpectedDeliverySummary>(`/inventory/expected-deliveries/${id}/cancel`, {}, token());
}

// ─── Items ──────────────────────────────────────────────────────────────────

export async function getLastPrice(itemId: string): Promise<{ unitPrice: string; asOf: string } | null> {
  return apiClient.get<{ unitPrice: string; asOf: string } | null>(`/inventory/items/${itemId}/last-price`, token());
}
