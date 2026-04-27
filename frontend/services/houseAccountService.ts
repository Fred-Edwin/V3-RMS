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

export interface HouseAccountOrderItem {
  id: string;
  quantity: number;
  unitPrice: string;
  subtotal: string;
  notes: string | null;
  menuItem: { name: string };
}

export interface HouseAccountOrder {
  id: string;
  dailyNumber: number;
  total: string;
  createdAt: string;
  organizationId: string;
  createdBy: { name: string };
  items: HouseAccountOrderItem[];
}

export interface HouseAccountOrdersPagination {
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface HouseAccountOrdersResponse {
  orders: HouseAccountOrder[];
  pagination: HouseAccountOrdersPagination;
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

  getOwnOrderHistory: async (
    token: string,
    page = 1,
    perPage = 15,
    date?: string,
  ): Promise<HouseAccountOrdersResponse> => {
    const params = new URLSearchParams({ page: String(page), perPage: String(perPage) });
    if (date) params.set('date', date);
    const envelope = await apiClient.getWithEnvelope<HouseAccountOrder[]>(`/house-accounts/my/orders?${params.toString()}`, token);
    return {
      orders: envelope.data ?? [],
      pagination: (envelope.pagination as HouseAccountOrdersPagination) ?? { total: 0, page, perPage, totalPages: 0 },
    };
  },

  getOrderHistory: async (
    id: string,
    token: string,
    page = 1,
    perPage = 15,
    date?: string,
  ): Promise<HouseAccountOrdersResponse> => {
    const params = new URLSearchParams({ page: String(page), perPage: String(perPage) });
    if (date) params.set('date', date);
    const envelope = await apiClient.getWithEnvelope<HouseAccountOrder[]>(`/house-accounts/${id}/orders?${params.toString()}`, token);
    return {
      orders: envelope.data ?? [],
      pagination: (envelope.pagination as HouseAccountOrdersPagination) ?? { total: 0, page, perPage, totalPages: 0 },
    };
  },
};
