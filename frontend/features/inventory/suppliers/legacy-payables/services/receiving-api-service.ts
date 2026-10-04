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
  CreateGoodsReceiptInput,
  CreateSupplierInvoiceInput,
  CreateSupplierPaymentInput,
  ExpectedDeliveryDetail,
  ExpectedDeliverySummary,
  GoodsReceiptDetail,
  ListExpectedDeliveriesQuery,
  ListGoodsReceiptsQuery,
  PurchasingHistoryRow,
  PurchasingSummary,
  RecentSupplierItem,
  ReverseSupplierPaymentInput,
  SignGoodsReceiptInput,
  SupplierApDetail,
  SupplierInvoice,
  SupplierPayment,
  UpdateGoodsReceiptInput,
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

// ─── Receiving history (2026-09-18, S6) ────────────────────────────────────
// Attendant-safe sibling of getPurchasingHistory above — same union row
// shape, but reachable by STORE_ATTENDANT (money/AP fields omitted
// server-side) and with a real cursor.

export interface ReceivingHistoryQuery {
  search?: string;
  supplierId?: string;
  status?: string;
  from?: string;
  to?: string;
  limit?: number;
  cursor?: string;
}

export async function getReceivingHistory(query: ReceivingHistoryQuery = {}): Promise<PurchasingHistoryRow[]> {
  return apiClient.get<PurchasingHistoryRow[]>(`/inventory/receiving/history${toQueryString(query)}`, token());
}

// ─── Expected deliveries ────────────────────────────────────────────────────

export async function listExpectedDeliveries(
  query: ListExpectedDeliveriesQuery = {}
): Promise<ExpectedDeliverySummary[]> {
  return apiClient.get<ExpectedDeliverySummary[]>(`/inventory/expected-deliveries${toQueryString(query)}`, token());
}

export async function getExpectedDelivery(id: string): Promise<ExpectedDeliveryDetail> {
  return apiClient.get<ExpectedDeliveryDetail>(`/inventory/expected-deliveries/${id}`, token());
}

export async function createExpectedDelivery(
  input: CreateExpectedDeliveryInput
): Promise<ExpectedDeliverySummary> {
  return apiClient.post<ExpectedDeliverySummary>('/inventory/expected-deliveries', input, token());
}

export async function cancelExpectedDelivery(id: string): Promise<ExpectedDeliverySummary> {
  return apiClient.post<ExpectedDeliverySummary>(`/inventory/expected-deliveries/${id}/cancel`, {}, token());
}

// ─── Goods receipts ─────────────────────────────────────────────────────────

export async function listGoodsReceipts(query: ListGoodsReceiptsQuery = {}): Promise<GoodsReceiptDetail[]> {
  return apiClient.get<GoodsReceiptDetail[]>(`/inventory/goods-receipts${toQueryString(query)}`, token());
}

export async function getGoodsReceipt(id: string): Promise<GoodsReceiptDetail> {
  return apiClient.get<GoodsReceiptDetail>(`/inventory/goods-receipts/${id}`, token());
}

export async function createGoodsReceipt(input: CreateGoodsReceiptInput): Promise<GoodsReceiptDetail> {
  return apiClient.post<GoodsReceiptDetail>('/inventory/goods-receipts', input, token());
}

export async function updateGoodsReceipt(id: string, input: UpdateGoodsReceiptInput): Promise<GoodsReceiptDetail> {
  return apiClient.patch<GoodsReceiptDetail>(`/inventory/goods-receipts/${id}`, input, token());
}

export async function signGoodsReceipt(id: string, input: SignGoodsReceiptInput): Promise<GoodsReceiptDetail> {
  return apiClient.post<GoodsReceiptDetail>(`/inventory/goods-receipts/${id}/sign`, input, token());
}

// ─── Items ──────────────────────────────────────────────────────────────────

export async function getLastPrice(itemId: string): Promise<{ unitPrice: string; asOf: string } | null> {
  return apiClient.get<{ unitPrice: string; asOf: string } | null>(`/inventory/items/${itemId}/last-price`, token());
}

// ─── Suppliers ──────────────────────────────────────────────────────────────

export async function getRecentSupplierItems(supplierId: string, limit = 8): Promise<RecentSupplierItem[]> {
  return apiClient.get<RecentSupplierItem[]>(
    `/inventory/suppliers/${supplierId}/recent-items${toQueryString({ limit })}`,
    token()
  );
}

// ─── What we owe (Supplier AP) — S7/S8 ──────────────────────────────────────

export async function getSupplierApDetail(supplierId: string): Promise<SupplierApDetail> {
  return apiClient.get<SupplierApDetail>(`/inventory/ap/suppliers/${supplierId}`, token());
}

export async function createSupplierInvoice(input: CreateSupplierInvoiceInput): Promise<SupplierInvoice> {
  return apiClient.post<SupplierInvoice>('/inventory/supplier-invoices', input, token());
}

export async function createSupplierPayment(input: CreateSupplierPaymentInput): Promise<SupplierPayment> {
  return apiClient.post<SupplierPayment>('/inventory/supplier-payments', input, token());
}

export async function reverseSupplierPayment(id: string, input: ReverseSupplierPaymentInput): Promise<SupplierPayment> {
  return apiClient.post<SupplierPayment>(`/inventory/supplier-payments/${id}/reverse`, input, token());
}
