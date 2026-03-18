import { apiClient } from '@/lib/apiClient';

export interface HouseAccount {
  id: string;
  userId: string;
  creditLimit: string | null;
  currentBalance: string;
  isActive: boolean;
  grantedById: string;
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string; email: string; role: string };
  grantedBy: { id: string; name: string };
}

export interface HouseAccountDropdownItem {
  id: string;
  userName: string;
  currentBalance: string;
  creditLimit: string | null;
}

export interface CreateHouseAccountInput {
  userId: string;
  creditLimit?: string | null;
}

export interface UpdateHouseAccountInput {
  creditLimit?: string | null;
  isActive?: boolean;
}

export interface RecordHouseSettlementInput {
  amount: string;
  note?: string;
}

export const houseAccountService = {
  listActive: (token: string): Promise<HouseAccountDropdownItem[]> =>
    apiClient.get('/house-accounts/active', token),

  list: (token: string): Promise<HouseAccount[]> =>
    apiClient.get('/house-accounts', token),

  getOwn: (token: string): Promise<HouseAccount> =>
    apiClient.get('/house-accounts/my', token),

  grantAccount: (data: CreateHouseAccountInput, token: string): Promise<HouseAccount> =>
    apiClient.post('/house-accounts', data, token),

  updateAccount: (id: string, data: UpdateHouseAccountInput, token: string): Promise<HouseAccount> =>
    apiClient.patch(`/house-accounts/${id}`, data, token),

  recordSettlement: (id: string, data: RecordHouseSettlementInput, token: string): Promise<void> =>
    apiClient.post(`/house-accounts/${id}/settlements`, data, token),
};
