import { apiClient } from '@/lib/apiClient';

export interface CorporateAccount {
  id: string;
  companyName: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  creditLimit: string | null;
  currentBalance: string;
  billingCycleDay: number;
  isActive: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; name: string };
}

export interface CorporateAccountDropdownItem {
  id: string;
  companyName: string;
  currentBalance: string;
  creditLimit: string | null;
}

export interface CreateCorporateAccountInput {
  companyName: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  creditLimit?: string | null;
  billingCycleDay?: number;
}

export interface UpdateCorporateAccountInput {
  companyName?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string | null;
  creditLimit?: string | null;
  billingCycleDay?: number;
  isActive?: boolean;
}

export interface RecordCorporateSettlementInput {
  amount: string;
  paymentMethod: 'MPESA' | 'CASH' | 'CARD';
  note?: string;
}

export interface CorporateAccountOrder {
  id: string;
  dailyNumber: number;
  total: string;
  createdAt: string;
  organizationId: string;
  corporateEmployeeRef: string | null;
}

export interface CorporateAccountSettlementRecord {
  id: string;
  corporateAccountId: string;
  amount: string;
  paymentMethod: 'MPESA' | 'CASH' | 'CARD';
  note: string | null;
  settledById: string;
  settledBy: { id: string; name: string };
  createdAt: string;
}

export const corporateAccountService = {
  list: (token: string): Promise<CorporateAccount[] | CorporateAccountDropdownItem[]> =>
    apiClient.get('/corporate-accounts', token),

  createAccount: (data: CreateCorporateAccountInput, token: string): Promise<CorporateAccount> =>
    apiClient.post('/corporate-accounts', data, token),

  updateAccount: (id: string, data: UpdateCorporateAccountInput, token: string): Promise<CorporateAccount> =>
    apiClient.patch(`/corporate-accounts/${id}`, data, token),

  recordSettlement: (
    id: string,
    data: RecordCorporateSettlementInput,
    token: string,
  ): Promise<{ settlementId: string; currentBalance: string }> =>
    apiClient.post(`/corporate-accounts/${id}/settlements`, data, token),

  getOrderHistory: async (
    id: string,
    token: string,
    page = 1,
    perPage = 50,
    dateRange?: { startDate?: string; endDate?: string },
  ): Promise<{ orders: CorporateAccountOrder[]; total: number }> => {
    const params = new URLSearchParams({ page: String(page), perPage: String(perPage) });
    if (dateRange?.startDate) params.set('startDate', dateRange.startDate);
    if (dateRange?.endDate) params.set('endDate', dateRange.endDate);
    const envelope = await apiClient.getWithEnvelope<CorporateAccountOrder[]>(`/corporate-accounts/${id}/orders?${params.toString()}`, token);
    return {
      orders: envelope.data ?? [],
      total: (envelope.pagination as { total: number } | undefined)?.total ?? 0,
    };
  },

  getSettlementHistory: async (
    id: string,
    token: string,
    page = 1,
    perPage = 50,
    dateRange?: { startDate?: string; endDate?: string },
  ): Promise<{ settlements: CorporateAccountSettlementRecord[]; total: number }> => {
    const params = new URLSearchParams({ page: String(page), perPage: String(perPage) });
    if (dateRange?.startDate) params.set('startDate', dateRange.startDate);
    if (dateRange?.endDate) params.set('endDate', dateRange.endDate);
    const envelope = await apiClient.getWithEnvelope<CorporateAccountSettlementRecord[]>(`/corporate-accounts/${id}/settlements?${params.toString()}`, token);
    return {
      settlements: envelope.data ?? [],
      total: (envelope.pagination as { total: number } | undefined)?.total ?? 0,
    };
  },
};
