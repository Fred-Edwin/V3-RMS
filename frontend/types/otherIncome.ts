export type OtherIncomePaymentMethod = 'CASH' | 'MPESA' | 'CARD' | 'SPLIT';

export interface OtherIncomeCategory {
  id: string;
  name: string;
  isActive: boolean;
  branchId: string | null;
  branch: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface OtherIncomeCategoryDropdownItem {
  id: string;
  name: string;
  branchId: string | null;
  branchName: string | null;
}

export interface OtherIncomeEntryEdit {
  id: string;
  editedBy: { id: string; name: string };
  changes: Array<{ field: string; from: string | null; to: string | null }>;
  createdAt: string;
}

export interface OtherIncomeEntry {
  id: string;
  organizationId: string;
  branchId: string;
  categoryId: string;
  category: { id: string; name: string };
  branch: { id: string; name: string };
  amount: string;
  paymentMethod: OtherIncomePaymentMethod;
  mpesaCode: string | null;
  mpesaAmount: string | null;
  cashAmount: string | null;
  cardAmount: string | null;
  splitType: string | null;
  description: string | null;
  entryDate: string;
  recordedById: string;
  recordedBy: { id: string; name: string };
  edits: OtherIncomeEntryEdit[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateCategoryInput {
  name: string;
  branchId?: string | null;
}

export interface UpdateCategoryInput {
  name?: string;
  isActive?: boolean;
  branchId?: string | null;
}

export interface CreateEntryInput {
  categoryId: string;
  amount: string;
  paymentMethod: OtherIncomePaymentMethod;
  mpesaCode?: string;
  mpesaAmount?: string;
  cashAmount?: string;
  cardAmount?: string;
  splitType?: 'MPESA_CASH' | 'MPESA_CARD' | 'CASH_CARD';
  description?: string;
  entryDate: string;
  branchId?: string;
}

export interface UpdateEntryInput {
  categoryId?: string;
  amount?: string;
  paymentMethod?: OtherIncomePaymentMethod;
  mpesaCode?: string;
  mpesaAmount?: string;
  cashAmount?: string;
  cardAmount?: string;
  splitType?: 'MPESA_CASH' | 'MPESA_CARD' | 'CASH_CARD';
  description?: string;
  entryDate?: string;
}

export interface ListEntriesParams {
  startDate?: string;
  endDate?: string;
  categoryId?: string;
  branchId?: string;
  page?: number;
  perPage?: number;
}
