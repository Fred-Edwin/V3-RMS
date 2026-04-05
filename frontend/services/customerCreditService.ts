import { apiClient } from '@/lib/apiClient';

export interface CustomerCreditAccount {
  id: string;
  organizationId: string;
  customerName: string;
  customerPhone: string;
  creditLimit: string;
  currentBalance: string;
  notes: string | null;
  isActive: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; name: string };
}

export interface CustomerCreditDropdownItem {
  id: string;
  customerName: string;
  customerPhone: string;
  creditLimit: string;
  currentBalance: string;
}

export interface CreateCustomerCreditInput {
  customerName: string;
  customerPhone: string;
  creditLimit: string;
  notes?: string;
}

export interface UpdateCustomerCreditInput {
  customerName?: string;
  customerPhone?: string;
  creditLimit?: string;
  notes?: string | null;
  isActive?: boolean;
}

export interface RecordCustomerCreditSettlementInput {
  amount: string;
  note?: string;
}

export const customerCreditService = {
  list: (token: string, params?: { branchId?: string }): Promise<CustomerCreditAccount[] | CustomerCreditDropdownItem[]> => {
    const query = params?.branchId ? `?branchId=${encodeURIComponent(params.branchId)}` : '';
    return apiClient.get(`/customer-credit-accounts${query}`, token);
  },

  createAccount: (data: CreateCustomerCreditInput, token: string): Promise<CustomerCreditAccount> =>
    apiClient.post('/customer-credit-accounts', data, token),

  updateAccount: (id: string, data: UpdateCustomerCreditInput, token: string): Promise<CustomerCreditAccount> =>
    apiClient.patch(`/customer-credit-accounts/${id}`, data, token),

  recordSettlement: (
    id: string,
    data: RecordCustomerCreditSettlementInput,
    token: string,
    branchId?: string,
  ): Promise<void> => {
    const query = branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
    return apiClient.post(`/customer-credit-accounts/${id}/settlements${query}`, data, token);
  },

  getOrderHistory: (
    id: string,
    token: string,
    page = 1,
    perPage = 50,
    branchId?: string,
  ): Promise<{ orders: Array<{ id: string; dailyNumber: number; total: string; createdAt: string; organizationId: string }>; total: number }> => {
    const params = new URLSearchParams({ page: String(page), perPage: String(perPage) });
    if (branchId) params.set('branchId', branchId);
    return apiClient.get(`/customer-credit-accounts/${id}/orders?${params.toString()}`, token);
  },
};
