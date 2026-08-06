import { apiClient } from '@/lib/apiClient';
import type {
  BulkUpsertInput,
  BulkUpsertResult,
  Payslip,
  PayslipListFilters,
  PayslipListResult,
  PublishRevertInput,
} from '@/types/payslip';

const toQueryString = (filters?: PayslipListFilters): string => {
  const params = new URLSearchParams();

  if (filters?.payPeriod) params.set('payPeriod', filters.payPeriod);
  if (filters?.userId) params.set('userId', filters.userId);
  if (filters?.organizationId) params.set('organizationId', filters.organizationId);
  if (filters?.isLocked !== undefined) params.set('status', filters.isLocked ? 'PUBLISHED' : 'DRAFT');
  if (filters?.page) params.set('page', String(filters.page));
  if (filters?.perPage) params.set('perPage', String(filters.perPage));

  const query = params.toString();
  return query ? `?${query}` : '';
};

const toListResult = async (path: string, accessToken: string): Promise<PayslipListResult> => {
  const response = await apiClient.getWithEnvelope<Payslip[]>(path, accessToken);

  return {
    items: response.data ?? [],
    pagination: response.pagination ?? {
      total: 0,
      page: 1,
      perPage: 20,
      totalPages: 0,
    },
  };
};

export const payslipService = {
  listMyPayslips: (accessToken: string, filters?: Omit<PayslipListFilters, 'userId' | 'isLocked'>): Promise<PayslipListResult> =>
    toListResult(`/payslips/my${toQueryString(filters)}`, accessToken),

  getPayslip: async (id: string, accessToken: string): Promise<Payslip> => {
    const response = await apiClient.get<{ payslip: Payslip }>(`/payslips/${id}`, accessToken);
    return response.payslip;
  },

  listHrPayslips: (accessToken: string, filters?: PayslipListFilters): Promise<PayslipListResult> =>
    toListResult(`/payslips${toQueryString(filters)}`, accessToken),

  listBranchPayslips: (
    branchId: string,
    accessToken: string,
    filters?: Omit<PayslipListFilters, 'isLocked'>,
  ): Promise<PayslipListResult> => toListResult(`/payslips/branch/${branchId}${toQueryString(filters)}`, accessToken),

  bulkUpsert: async (input: BulkUpsertInput, accessToken: string): Promise<BulkUpsertResult> => {
    const response = await apiClient.post<BulkUpsertResult>('/payslips/bulk-upsert', input, accessToken);
    return response;
  },

  publishPeriod: async (input: PublishRevertInput, accessToken: string): Promise<{ count: number }> => {
    const response = await apiClient.post<{ count: number }>('/payslips/publish', input, accessToken);
    return response;
  },

  revertPeriod: async (input: PublishRevertInput, accessToken: string): Promise<{ count: number }> => {
    const response = await apiClient.post<{ count: number }>('/payslips/revert', input, accessToken);
    return response;
  },

  updateMyPaymentDetails: async (
    data: {
      kraPIN?: string | null;
      shifNhifNumber?: string | null;
      nssfNumber?: string | null;
      bankName?: string | null;
      accountNumber?: string | null;
      accountName?: string | null;
      bankBranch?: string | null;
      helbNumber?: string | null;
    },
    accessToken: string,
  ): Promise<void> => {
    await apiClient.patch('/hr/profiles/my/payment-details', data, accessToken);
  },
};
