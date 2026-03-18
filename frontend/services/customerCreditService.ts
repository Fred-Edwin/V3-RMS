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
  list: (token: string): Promise<CustomerCreditAccount[] | CustomerCreditDropdownItem[]> =>
    apiClient.get('/customer-credit-accounts', token),

  createAccount: (data: CreateCustomerCreditInput, token: string): Promise<CustomerCreditAccount> =>
    apiClient.post('/customer-credit-accounts', data, token),

  updateAccount: (id: string, data: UpdateCustomerCreditInput, token: string): Promise<CustomerCreditAccount> =>
    apiClient.patch(`/customer-credit-accounts/${id}`, data, token),

  recordSettlement: (id: string, data: RecordCustomerCreditSettlementInput, token: string): Promise<void> =>
    apiClient.post(`/customer-credit-accounts/${id}/settlements`, data, token),
};
