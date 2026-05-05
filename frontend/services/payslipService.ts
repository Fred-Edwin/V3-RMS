import { apiClient } from '@/lib/apiClient';
import type {
  Payslip,
  PayslipCreateInput,
  PayslipListFilters,
  PayslipListResult,
  PayslipUpdateInput,
} from '@/types/payslip';

const toQueryString = (filters?: PayslipListFilters): string => {
  const params = new URLSearchParams();

  if (filters?.payPeriod) params.set('payPeriod', filters.payPeriod);
  if (filters?.userId) params.set('userId', filters.userId);
  if (filters?.isLocked !== undefined) params.set('status', filters.isLocked ? 'LOCKED' : 'DRAFT');
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

  listAccountantPayslips: (accessToken: string, filters?: PayslipListFilters): Promise<PayslipListResult> =>
    toListResult(`/payslips${toQueryString(filters)}`, accessToken),

  createPayslip: async (input: PayslipCreateInput, accessToken: string): Promise<Payslip> => {
    const response = await apiClient.post<{ payslip: Payslip }>('/payslips', input, accessToken);
    return response.payslip;
  },

  updatePayslip: async (id: string, input: PayslipUpdateInput, accessToken: string): Promise<Payslip> => {
    const response = await apiClient.patch<{ payslip: Payslip }>(`/payslips/${id}`, input, accessToken);
    return response.payslip;
  },

  lockPayslip: async (id: string, accessToken: string): Promise<Payslip> => {
    const response = await apiClient.post<{ payslip: Payslip }>(`/payslips/${id}/lock`, {}, accessToken);
    return response.payslip;
  },
};
