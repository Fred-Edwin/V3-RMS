/**
 * Suppliers — real backend (API_CONTRACT.md §27–§30). Reads the access token via
 * `useAuthStore.getState()` like the other inventory services.
 */
import { apiClient } from '@/lib/apiClient';
import { env } from '@/lib/env';
import { useAuthStore } from '@/store/authStore';
import { ApiError, type ApiResponseEnvelope } from '@/types/api';
import type { Paginated } from '../../types';
import type {
  CreatePayMethodBody,
  CreateSupplierBody,
  ListSuppliersParams,
  PutSupplierLineBody,
  SupplierCatalogLine,
  SupplierCatalogSummary,
  SupplierContact,
  SupplierContactBody,
  SupplierDetail,
  SupplierDocument,
  SupplierDownload,
  SupplierListRow,
  SupplierListSummary,
  SupplierPackMismatch,
  SupplierPayMethod,
  SupplierPayMethodChange,
  SupplierPayMethodDetail,
  SupplierStatus,
  SupplierSummary,
  SupplierTimelineEntry,
  UpdatePayMethodBody,
  UpdateSupplierBody,
  UploadSupplierDocumentInput,
} from '../types/supplier';

const token = (): string | undefined => useAuthStore.getState().accessToken ?? undefined;

function toQueryString(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

const base = (supplierId: string) => `/inventory/suppliers/${supplierId}`;

// ─── Suppliers ──────────────────────────────────────────────────────────────

export async function listSupplierRows(params: ListSuppliersParams = {}): Promise<Paginated<SupplierListRow>> {
  const envelope = await apiClient.getWithEnvelope<SupplierListRow[]>(`/inventory/suppliers${toQueryString(params)}`, token());
  return {
    data: envelope.data ?? [],
    pagination: envelope.pagination ?? { total: 0, page: 1, perPage: 20, totalPages: 1 },
  };
}

export const getSupplierListSummary = (): Promise<SupplierListSummary> =>
  apiClient.get<SupplierListSummary>('/inventory/suppliers/summary', token());

export const getSupplierDetail = (id: string): Promise<SupplierDetail> => apiClient.get<SupplierDetail>(base(id), token());

/** A 409 `DUPLICATE_SUPPLIER` carries `details.matches`; resend with `confirmDuplicate: true` to proceed. */
export const createSupplierRecord = (body: CreateSupplierBody): Promise<SupplierDetail> =>
  apiClient.post<SupplierDetail>('/inventory/suppliers', body, token());

export const updateSupplierRecord = (id: string, body: UpdateSupplierBody): Promise<SupplierDetail> =>
  apiClient.patch<SupplierDetail>(base(id), body, token());

export const getSupplierSummary = (id: string): Promise<SupplierSummary> =>
  apiClient.get<SupplierSummary>(`${base(id)}/summary`, token());

export const getSupplierCatalogSummary = (id: string): Promise<SupplierCatalogSummary> =>
  apiClient.get<SupplierCatalogSummary>(`${base(id)}/catalog-summary`, token());

export const changeSupplierStatus = (id: string, status: SupplierStatus, reason?: string): Promise<SupplierDetail> =>
  apiClient.patch<SupplierDetail>(`${base(id)}/status`, { status, ...(reason ? { reason } : {}) }, token());

// ─── Contacts ───────────────────────────────────────────────────────────────

export const listSupplierContacts = (id: string): Promise<SupplierContact[]> => apiClient.get<SupplierContact[]>(`${base(id)}/contacts`, token());

export const createSupplierContact = (id: string, body: SupplierContactBody): Promise<SupplierContact> =>
  apiClient.post<SupplierContact>(`${base(id)}/contacts`, body, token());

export const updateSupplierContact = (id: string, contactId: string, body: Partial<SupplierContactBody>): Promise<SupplierContact> =>
  apiClient.patch<SupplierContact>(`${base(id)}/contacts/${contactId}`, body, token());

export const deleteSupplierContact = async (id: string, contactId: string): Promise<void> => {
  await apiClient.delete<void>(`${base(id)}/contacts/${contactId}`, token());
};

// ─── Payment methods ────────────────────────────────────────────────────────

export const listSupplierPayMethods = (id: string): Promise<SupplierPayMethod[]> =>
  apiClient.get<SupplierPayMethod[]>(`${base(id)}/payment-methods`, token());

/** The only call that returns the full account number: the "Show" action. */
export const getSupplierPayMethod = (id: string, methodId: string): Promise<SupplierPayMethodDetail> =>
  apiClient.get<SupplierPayMethodDetail>(`${base(id)}/payment-methods/${methodId}`, token());

export const createSupplierPayMethod = (id: string, body: CreatePayMethodBody): Promise<SupplierPayMethod> =>
  apiClient.post<SupplierPayMethod>(`${base(id)}/payment-methods`, body, token());

export const updateSupplierPayMethod = (id: string, methodId: string, body: UpdatePayMethodBody): Promise<SupplierPayMethod> =>
  apiClient.patch<SupplierPayMethod>(`${base(id)}/payment-methods/${methodId}`, body, token());

export const deleteSupplierPayMethod = async (id: string, methodId: string): Promise<void> => {
  await apiClient.delete<void>(`${base(id)}/payment-methods/${methodId}`, token());
};

export const listSupplierPayMethodHistory = (id: string): Promise<SupplierPayMethodChange[]> =>
  apiClient.get<SupplierPayMethodChange[]>(`${base(id)}/payment-methods/history`, token());

// ─── Catalog ────────────────────────────────────────────────────────────────

export const listSupplierCatalog = (id: string): Promise<SupplierCatalogLine[]> =>
  apiClient.get<SupplierCatalogLine[]>(`${base(id)}/items`, token());

export const listSupplierPackMismatches = (id: string): Promise<SupplierPackMismatch[]> =>
  apiClient.get<SupplierPackMismatch[]>(`${base(id)}/pack-mismatches`, token());

/**
 * Add several / edit one line. Upserts on the line key `(supplier, item, buy unit, pack size)`; with `lineId` it edits that line
 * (§28.3). Used one call per ticked item by "Add several items".
 */
export const putSupplierLine = (id: string, inventoryItemId: string, body: PutSupplierLineBody): Promise<SupplierCatalogLine> =>
  apiClient.put<SupplierCatalogLine>(`${base(id)}/items/${inventoryItemId}`, body, token());

export const confirmSupplierPreferred = (id: string, inventoryItemId: string, lineId: string): Promise<SupplierCatalogLine> =>
  putSupplierLine(id, inventoryItemId, { lineId, isPreferred: true });

// ─── Documents ──────────────────────────────────────────────────────────────

export const listSupplierDocuments = (id: string, limit = 200): Promise<SupplierTimelineEntry[]> =>
  apiClient.get<SupplierTimelineEntry[]>(`${base(id)}/documents?limit=${limit}`, token());

export const getSupplierDocumentDownload = (id: string, docId: string): Promise<SupplierDownload> =>
  apiClient.get<SupplierDownload>(`${base(id)}/documents/${docId}/download`, token());

/** multipart/form-data, so it bypasses the JSON-only `apiClient` (the browser sets the boundary). */
export async function uploadSupplierDocument(id: string, input: UploadSupplierDocumentInput): Promise<SupplierDocument> {
  const form = new FormData();
  form.append('file', input.file);
  form.append('docType', input.docType);
  if (input.docDate) form.append('docDate', input.docDate);
  if (input.note) form.append('note', input.note);
  const accessToken = token();
  const response = await fetch(`${env.apiUrl}${base(id)}/documents`, {
    method: 'POST',
    credentials: 'include',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    body: form,
  });
  const payload = (await response.json()) as ApiResponseEnvelope<SupplierDocument>;
  if (!response.ok) {
    throw new ApiError(payload.error?.message ?? 'Upload failed', response.status, payload.error?.code ?? 'UNKNOWN_ERROR', payload.error?.details);
  }
  return payload.data as SupplierDocument;
}

export const deleteSupplierDocument = async (id: string, docId: string): Promise<void> => {
  await apiClient.delete<void>(`${base(id)}/documents/${docId}`, token());
};
