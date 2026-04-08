import { apiClient } from '@/lib/apiClient';
import type { HouseAccountAuthRequest, AuthDecision } from '@/types/houseAccountAuth';

export const houseAccountAuthService = {
  listPending: (token: string): Promise<HouseAccountAuthRequest[]> =>
    apiClient.get<HouseAccountAuthRequest[]>('/house-auth', token),

  getById: (authRequestId: string, token: string): Promise<HouseAccountAuthRequest> =>
    apiClient.get<HouseAccountAuthRequest>(`/house-auth/${authRequestId}`, token),

  getPendingByOrderId: (orderId: string, token: string): Promise<HouseAccountAuthRequest> =>
    apiClient.get<HouseAccountAuthRequest>(`/orders/${orderId}/house-auth`, token),

  resolve: (
    authRequestId: string,
    decision: AuthDecision,
    token: string,
  ): Promise<HouseAccountAuthRequest> =>
    apiClient.post<HouseAccountAuthRequest>(
      `/house-auth/${authRequestId}/resolve`,
      { decision },
      token,
    ),

  override: (
    authRequestId: string,
    decision: AuthDecision,
    token: string,
  ): Promise<HouseAccountAuthRequest> =>
    apiClient.post<HouseAccountAuthRequest>(
      `/house-auth/${authRequestId}/override`,
      { decision },
      token,
    ),

  forceExpire: (authRequestId: string, token: string): Promise<void> =>
    apiClient.post<void>(`/house-auth/${authRequestId}/force-expire`, {}, token),
};
