import { apiClient } from '@/lib/apiClient';
import type { CustomerDiscountAuthRequest } from '@/types/discount';

export type CustomerDiscountDecision = 'APPROVED' | 'REJECTED';

export const customerDiscountAuthService = {
  listPending: (token: string): Promise<CustomerDiscountAuthRequest[]> =>
    apiClient.get<CustomerDiscountAuthRequest[]>('/customer-discount-auth', token),

  getById: (authRequestId: string, token: string): Promise<CustomerDiscountAuthRequest> =>
    apiClient.get<CustomerDiscountAuthRequest>(`/customer-discount-auth/${authRequestId}`, token),

  getPendingByOrderId: (orderId: string, token: string): Promise<CustomerDiscountAuthRequest> =>
    apiClient.get<CustomerDiscountAuthRequest>(`/orders/${orderId}/customer-discount-auth`, token),

  override: (
    authRequestId: string,
    decision: CustomerDiscountDecision,
    token: string,
  ): Promise<CustomerDiscountAuthRequest> =>
    apiClient.post<CustomerDiscountAuthRequest>(
      `/customer-discount-auth/${authRequestId}/override`,
      { decision },
      token,
    ),
};
