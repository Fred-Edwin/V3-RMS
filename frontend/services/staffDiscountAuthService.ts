import { apiClient } from '@/lib/apiClient';
import type { StaffDiscountAuthRequest, StaffDiscountDecision } from '@/types/staffDiscountAuth';

export const staffDiscountAuthService = {
  listPending: (token: string): Promise<StaffDiscountAuthRequest[]> =>
    apiClient.get<StaffDiscountAuthRequest[]>('/staff-discount-auth', token),

  getById: (authRequestId: string, token: string): Promise<StaffDiscountAuthRequest> =>
    apiClient.get<StaffDiscountAuthRequest>(`/staff-discount-auth/${authRequestId}`, token),

  getPendingByOrderId: (orderId: string, token: string): Promise<StaffDiscountAuthRequest> =>
    apiClient.get<StaffDiscountAuthRequest>(`/orders/${orderId}/staff-discount-auth`, token),

  override: (
    authRequestId: string,
    decision: StaffDiscountDecision,
    token: string,
  ): Promise<StaffDiscountAuthRequest> =>
    apiClient.post<StaffDiscountAuthRequest>(
      `/staff-discount-auth/${authRequestId}/override`,
      { decision },
      token,
    ),

  /** Requester withdraws their own still-pending request. */
  withdraw: (authRequestId: string, token: string): Promise<StaffDiscountAuthRequest> =>
    apiClient.post<StaffDiscountAuthRequest>(
      `/staff-discount-auth/${authRequestId}/withdraw`,
      {},
      token,
    ),
};
