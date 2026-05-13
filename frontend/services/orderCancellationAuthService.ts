import { apiClient } from '@/lib/apiClient';
import type {
  OrderCancellationAuthRequest,
  OrderCancellationDecision,
} from '@/types/orderCancellationAuth';

export const orderCancellationAuthService = {
  listPending: (token: string): Promise<OrderCancellationAuthRequest[]> =>
    apiClient.get<OrderCancellationAuthRequest[]>('/order-cancellation-auth', token),

  getById: (authRequestId: string, token: string): Promise<OrderCancellationAuthRequest> =>
    apiClient.get<OrderCancellationAuthRequest>(`/order-cancellation-auth/${authRequestId}`, token),

  getPendingByOrderId: (orderId: string, token: string): Promise<OrderCancellationAuthRequest> =>
    apiClient.get<OrderCancellationAuthRequest>(`/orders/${orderId}/cancellation-auth`, token),

  override: (
    authRequestId: string,
    decision: OrderCancellationDecision,
    token: string,
    resolutionNote?: string,
  ): Promise<OrderCancellationAuthRequest> =>
    apiClient.post<OrderCancellationAuthRequest>(
      `/order-cancellation-auth/${authRequestId}/override`,
      { decision, resolutionNote },
      token,
    ),
};
