import { apiClient } from '@/lib/apiClient';

export interface StaffTransfer {
  id: string;
  userId: string;
  fromOrganizationId: string;
  toOrganizationId: string;
  notes: string | null;
  transferredAt: string;
  authorizedById: string;
  fromOrganization: { id: string; name: string };
  toOrganization: { id: string; name: string };
  authorizedBy: { id: string; name: string; role: string };
  user?: { id: string; name: string; role: string };
}

export interface CreateTransferInput {
  userId: string;
  toOrganizationId: string;
  notes?: string;
}

export const staffTransferService = {
  async createTransfer(input: CreateTransferInput, token: string): Promise<StaffTransfer> {
    const data = await apiClient.post<{ transfer: StaffTransfer }>('/staff/transfers', input, token);
    return data.transfer;
  },

  async getTransferHistory(userId: string, token: string): Promise<StaffTransfer[]> {
    const data = await apiClient.get<{ transfers: StaffTransfer[] }>(`/staff/${userId}/transfers`, token);
    return data.transfers;
  },
};
