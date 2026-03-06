import { apiClient } from '@/lib/apiClient';

export interface ModificationRequest {
  id: string;
  organizationId: string;
  orderId: string;
  requestedBy: { id: string; name: string };
  description: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewedBy: { id: string; name: string } | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
}

export const modificationRequestService = {
  create: (orderId: string, description: string, accessToken: string): Promise<ModificationRequest> => {
    return apiClient.post<ModificationRequest>(
      `/orders/${orderId}/modification-requests`,
      { description },
      accessToken,
    );
  },

  getByOrder: (orderId: string, accessToken: string): Promise<ModificationRequest[]> => {
    return apiClient.get<ModificationRequest[]>(
      `/orders/${orderId}/modification-requests`,
      accessToken,
    );
  },

  review: (
    requestId: string,
    status: 'APPROVED' | 'REJECTED',
    reviewNote: string | undefined,
    accessToken: string,
  ): Promise<ModificationRequest> => {
    return apiClient.patch<ModificationRequest>(
      `/modification-requests/${requestId}/review`,
      { status, reviewNote },
      accessToken,
    );
  },
};
