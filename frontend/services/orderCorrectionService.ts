import { apiClient } from '@/lib/apiClient';
import type {
  ListOrderCorrectionsQuery,
  OrderCorrectionAuditEntry,
  OrderCorrectionDetail,
  OrderCorrectionListResponse,
} from '@/types/orderCorrection';

const buildQuery = (params: Record<string, string | number | undefined>): string => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
};

export const orderCorrectionService = {
  listOrders: (query: ListOrderCorrectionsQuery, token: string): Promise<OrderCorrectionListResponse> => {
    const qs = buildQuery(query as Record<string, string | number | undefined>);
    return apiClient.getWithEnvelope<OrderCorrectionListResponse>(
      `/admin/order-corrections${qs}`,
      token,
    ).then((env) => env.data as OrderCorrectionListResponse);
  },

  getOrderDetail: (orderId: string, token: string): Promise<OrderCorrectionDetail> =>
    apiClient.get<OrderCorrectionDetail>(`/admin/order-corrections/${orderId}`, token),

  getAuditLog: (orderId: string, token: string): Promise<OrderCorrectionAuditEntry[]> =>
    apiClient.get<OrderCorrectionAuditEntry[]>(`/admin/order-corrections/${orderId}/audit-log`, token),

  correctMpesaCode: (
    orderId: string,
    body: { mpesaCode: string; reason: string },
    token: string,
  ): Promise<void> =>
    apiClient.patch(`/admin/order-corrections/${orderId}/mpesa-code`, body, token),

  correctPaymentMethod: (
    orderId: string,
    body: { paymentMethod: string; reason: string },
    token: string,
  ): Promise<void> =>
    apiClient.patch(`/admin/order-corrections/${orderId}/payment-method`, body, token),

  forceOrderReady: (
    orderId: string,
    body: { reason: string },
    token: string,
  ): Promise<void> =>
    apiClient.post(`/admin/order-corrections/${orderId}/force-ready`, body, token),

  revertAwaitingAuth: (
    orderId: string,
    body: { reason: string },
    token: string,
  ): Promise<void> =>
    apiClient.post(`/admin/order-corrections/${orderId}/revert-auth`, body, token),

  removeOrderItem: (
    orderId: string,
    itemId: string,
    body: { reason: string },
    token: string,
  ): Promise<void> =>
    apiClient.patch(`/admin/order-corrections/${orderId}/items/${itemId}/remove`, body, token),

  revertRejectedTicket: (
    orderId: string,
    ticketId: string,
    body: { reason: string },
    token: string,
  ): Promise<void> =>
    apiClient.post(`/admin/order-corrections/${orderId}/tickets/${ticketId}/revert-rejected`, body, token),

  adjustOrderTotal: (
    orderId: string,
    body: { newTotal: number; reason: string },
    token: string,
  ): Promise<void> =>
    apiClient.patch(`/admin/order-corrections/${orderId}/total`, body, token),
};
