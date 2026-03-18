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
  note?: string;
}

export const corporateAccountService = {
  list: (token: string): Promise<CorporateAccount[] | CorporateAccountDropdownItem[]> =>
    apiClient.get('/corporate-accounts', token),

  createAccount: (data: CreateCorporateAccountInput, token: string): Promise<CorporateAccount> =>
    apiClient.post('/corporate-accounts', data, token),

  updateAccount: (id: string, data: UpdateCorporateAccountInput, token: string): Promise<CorporateAccount> =>
    apiClient.patch(`/corporate-accounts/${id}`, data, token),

  recordSettlement: (id: string, data: RecordCorporateSettlementInput, token: string): Promise<void> =>
    apiClient.post(`/corporate-accounts/${id}/settlements`, data, token),
};
