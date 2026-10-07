import { roleLabel } from '@/components/app/shell/role-label';
import { apiClient } from '@/lib/apiClient';
import { env } from '@/lib/env';
import { useAuthStore } from '@/store/authStore';
import { ApiError, type ApiResponseEnvelope } from '@/types/api';
import type { AppRole } from '@/types/auth';
import type { FileDocument, FileRef } from '../types';
import type { PurchasingService } from './purchasing-service';

const BASE = '/inventory/purchasing';
const token = (): string | undefined => useAuthStore.getState().accessToken ?? undefined;

/** `?a=1&b=2` from the defined, non-empty values, or an empty string. */
function qs(params: Record<string, string | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, value);
  }
  const text = query.toString();
  return text ? `?${text}` : '';
}

/** Throws the server's own error (message, code, details) so the shared loaders and sheets show what the API said. */
async function failFrom(response: Response): Promise<never> {
  const payload = (await response.json().catch(() => ({}))) as ApiResponseEnvelope<unknown>;
  throw new ApiError(payload.error?.message ?? 'Request failed', response.status, payload.error?.code ?? 'UNKNOWN_ERROR', payload.error?.details);
}

/** The two calls the shared client cannot make: a multipart upload, and a DELETE that answers 204 with no body. */
async function send(method: 'POST' | 'DELETE', path: string, body?: FormData): Promise<Response> {
  const t = token();
  const response = await fetch(`${env.apiUrl}${path}`, {
    method,
    cache: 'no-store',
    credentials: 'include',
    headers: t ? { Authorization: `Bearer ${t}` } : {},
    body,
  });
  if (!response.ok) await failFrom(response);
  return response;
}

/**
 * The HTTP implementation of `PurchasingService` (docs/API_CONTRACT.md §31 and §31.9). The wire shapes are the types in
 * `../types`, so nothing is mapped here: one line per operation. Screens never import this file, only the hook that supplies it.
 */
export function createPurchasingApiService(): PurchasingService {
  const get = <T>(path: string): Promise<T> => apiClient.get<T>(`${BASE}${path}`, token());
  const post = <T>(path: string, body: unknown = {}): Promise<T> => apiClient.post<T>(`${BASE}${path}`, body, token());

  return {
    getSummary: () => get('/summary'),
    getNeedsRestocking: (q = {}) => get(`/needs-restocking${qs({ group: q.group, supplierId: q.supplierId, q: q.q, sort: q.sort })}`),
    listOrders: (q = {}) => get(`/orders${qs({ stage: q.stage, supplierId: q.supplierId, raisedBy: q.raisedBy, q: q.q })}`),
    getOrder: (id) => get(`/orders/${id}`),
    getLpo: (id) => get(`/orders/${id}/lpo`),
    getWhatsapp: (id) => get(`/orders/${id}/whatsapp`),
    getCatalog: (q) => get(`/catalog${qs({ supplierId: q.supplierId, q: q.q, filter: q.filter })}`),

    createOrder: (input) => post('/orders', input),
    updateOrder: (id, input) => apiClient.patch(`${BASE}/orders/${id}`, input, token()),
    discardOrder: async (id) => {
      await send('DELETE', `${BASE}/orders/${id}`);
    },
    submitOrder: (id) => post(`/orders/${id}/submit`),
    approveOrder: (id, pin) => post(`/orders/${id}/approve`, { pin }),
    returnOrder: (id, note) => post(`/orders/${id}/return`, { note }),
    sendOrder: (id, via) => post(`/orders/${id}/send`, { via }),
    cancelOrder: (id, input) => post(`/orders/${id}/cancel`, input),

    recordDeposit: (id, input) => post(`/orders/${id}/deposits`, input),
    upload: async (file) => {
      const form = new FormData();
      form.append('file', file);
      const payload = (await (await send('POST', `${BASE}/uploads`, form)).json()) as ApiResponseEnvelope<FileRef>;
      return payload.data as FileRef;
    },
    getFileUrl: (fileId) => get(`/uploads/${fileId}/url`),
    receiveOrder: (id, input) => post(`/orders/${id}/receive`, input),

    addInvoice: (orderId, input) => post(`/orders/${orderId}/invoice`, input),
    settleDispute: (invoiceId, input) => post(`/invoices/${invoiceId}/settle-dispute`, input),
    voidInvoice: (invoiceId, input) => post(`/invoices/${invoiceId}/void`, input),
    recordPayment: (invoiceId, input) => post(`/invoices/${invoiceId}/payments`, input),
    reversePayment: (paymentId, input) => post(`/payments/${paymentId}/reverse`, input),
    getPaymentAdvice: (paymentId) => get(`/payments/${paymentId}/advice`),

    getSupplierPurchasing: (supplierId) => get(`/suppliers/${supplierId}/orders`),
    getSupplierStatement: (supplierId, range = {}) => get(`/suppliers/${supplierId}/statement${qs({ from: range.from, to: range.to })}`),
    getAuditLog: async () => {
      // Purchasing and Payments rows come from the one Audit log, newest first (the server caps a page at 100).
      const rows = await Promise.all(
        (['PURCHASING', 'PAYMENTS'] as const).map((area) => apiClient.get<AuditPage>(`/inventory/audit-log${qs({ area, perPage: '100' })}`, token()))
      );
      return rows
        .flatMap((page) => page.entries)
        .flatMap((e) =>
          e.purchasing
            ? [
                {
                  id: e.id,
                  at: e.at,
                  actor: { id: e.actor.id, name: e.actor.name, role: roleLabel(e.actor.role as AppRole | undefined) },
                  action: e.purchasing.action,
                  area: e.area === 'PAYMENTS' ? ('Payments' as const) : ('Purchasing' as const),
                  document: e.purchasing.document,
                  detail: e.purchasing.detail,
                  what: e.what,
                  orderId: e.purchasing.orderId,
                  orderReference: e.purchasing.orderReference,
                  supplierName: e.purchasing.supplierName,
                },
              ]
            : []
        )
        .sort((a, b) => b.at.localeCompare(a.at));
    },
    addDocument: (orderId, input) => post<FileDocument>(`/orders/${orderId}/documents`, input),
  };
}

/** The part of `GET /inventory/audit-log` (§30.12) this service reads. */
interface AuditPage {
  entries: Array<{
    id: string;
    at: string;
    actor: { id: string; name: string; role?: string };
    area: string;
    what: string;
    purchasing?: { action: string; document: string | null; detail: string; orderId: string; orderReference: string | null; supplierName: string };
  }>;
}
