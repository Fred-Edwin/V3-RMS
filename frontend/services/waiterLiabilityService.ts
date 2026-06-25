import { apiClient } from '@/lib/apiClient';
import type {
  MyWaiterLiabilityReport,
  WaiterLiabilitySummaryReport,
} from '@/types/waiterLiability';

export const waiterLiabilityService = {
  // WAITER: their own unresolved stale-order liabilities + running total.
  getMyLiabilities: (accessToken: string): Promise<MyWaiterLiabilityReport> => {
    return apiClient.get<MyWaiterLiabilityReport>('/reports/my-liabilities', accessToken);
  },

  // HR/management: per-waiter rollup. Pass organizationId to scope to one branch;
  // omit it for cross-branch roles to get all active branches.
  getWaiterSummary: (
    accessToken: string,
    organizationId?: string,
  ): Promise<WaiterLiabilitySummaryReport> => {
    const query = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : '';
    return apiClient.get<WaiterLiabilitySummaryReport>(`/reports/waiter-liabilities${query}`, accessToken);
  },
};
