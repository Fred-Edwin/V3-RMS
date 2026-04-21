import { apiClient } from '@/lib/apiClient';
import { env } from '@/lib/env';
import { ApiError, type ApiResponseEnvelope } from '@/types/api';
import type {
  AccountantReconciliationQuery,
  AccountantReconciliationReport,
  DiscountUsageQuery,
  DiscountUsageReport,
  BranchTrendsQuery,
  BranchTrendsReport,
  BranchOverview,
  BranchOverviewQuery,
  DailySummary,
  DirectorPulseReport,
  DirectorTrendsQuery,
  DirectorTrendsReport,
  ExportReportQuery,
  HourlyHeatmapQuery,
  HourlyHeatmapReport,
  ItemsPerformanceQuery,
  ItemsPerformanceReport,
  MyPerformance,
  MyPerformanceQuery,
  OutstandingBalancesReport,
  StaffPerformancePeriod,
  StaffPerformanceQuery,
  StaleOrdersReport,
} from '@/types/report';

const toQueryString = (params: Record<string, string | undefined>): string => {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      query.set(key, value);
    }
  }

  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
};

const parseFilename = (contentDisposition: string | null, fallback: string): string => {
  if (!contentDisposition) {
    return fallback;
  }

  const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(contentDisposition);
  if (!match) {
    return fallback;
  }

  const encoded = match[1] ?? match[2];
  if (!encoded) {
    return fallback;
  }

  try {
    return decodeURIComponent(encoded);
  } catch {
    return encoded;
  }
};

export const reportService = {
  getDailySummary: (accessToken: string, query: { date?: string; organizationId?: string }): Promise<DailySummary> => {
    return apiClient.get<DailySummary>(
      `/reports/daily-summary${toQueryString({
        date: query.date,
        organizationId: query.organizationId,
      })}`,
      accessToken,
    );
  },

  getStaffPerformance: (accessToken: string, query: StaffPerformanceQuery): Promise<StaffPerformancePeriod> => {
    return apiClient.get<StaffPerformancePeriod>(
      `/reports/staff-performance${toQueryString({
        startDate: query.startDate,
        endDate: query.endDate,
        organizationId: query.organizationId,
        role: query.role,
      })}`,
      accessToken,
    );
  },

  getBranchOverview: (accessToken: string, query: BranchOverviewQuery): Promise<BranchOverview> => {
    return apiClient.get<BranchOverview>(
      `/reports/branch-overview${toQueryString({
        startDate: query.startDate,
        endDate: query.endDate,
      })}`,
      accessToken,
    );
  },

  getBranchTrends: (accessToken: string, query: BranchTrendsQuery): Promise<BranchTrendsReport> => {
    return apiClient.get<BranchTrendsReport>(
      `/reports/branch-trends${toQueryString({
        startDate: query.startDate,
        endDate: query.endDate,
        organizationId: query.organizationId,
      })}`,
      accessToken,
    );
  },

  getDirectorTrends: (accessToken: string, query: DirectorTrendsQuery): Promise<DirectorTrendsReport> => {
    return apiClient.get<DirectorTrendsReport>(
      `/reports/director-trends${toQueryString({
        startDate: query.startDate,
        endDate: query.endDate,
      })}`,
      accessToken,
    );
  },

  getMyPerformance: (accessToken: string, query: MyPerformanceQuery): Promise<MyPerformance> => {
    return apiClient.get<MyPerformance>(
      `/reports/my-performance${toQueryString({
        startDate: query.startDate,
        endDate: query.endDate,
      })}`,
      accessToken,
    );
  },

  getDirectorPulse: (accessToken: string): Promise<DirectorPulseReport> => {
    return apiClient.get<DirectorPulseReport>('/reports/director-pulse', accessToken);
  },

  exportReport: async (accessToken: string, query: ExportReportQuery): Promise<void> => {
    const path = `/reports/export${toQueryString({
      reportType: query.reportType,
      format: query.format,
      startDate: query.startDate,
      endDate: query.endDate,
      organizationId: query.organizationId,
    })}`;

    const response = await fetch(`${env.apiUrl}${path}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      let message = 'Request failed';
      let code = 'UNKNOWN_ERROR';

      try {
        const payload = (await response.json()) as ApiResponseEnvelope<unknown>;
        message = payload.error?.message ?? message;
        code = payload.error?.code ?? code;
      } catch {
        // Non-JSON export errors fall through to generic message.
      }

      throw new ApiError(message, response.status, code);
    }

    const blob = await response.blob();
    const defaultFilename = `${query.reportType}.${query.format}`;
    const filename = parseFilename(response.headers.get('Content-Disposition'), defaultFilename);

    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    link.style.display = 'none';
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  },

  getOutstandingBalances: (token: string): Promise<OutstandingBalancesReport> =>
    apiClient.get('/reports/outstanding-balances', token),

  getHourlyHeatmap: (token: string, query: HourlyHeatmapQuery): Promise<HourlyHeatmapReport> =>
    apiClient.get(
      `/reports/hourly-heatmap${toQueryString({
        startDate: query.startDate,
        endDate: query.endDate,
        organizationId: query.organizationId,
      })}`,
      token,
    ),

  getItemsPerformance: (token: string, query: ItemsPerformanceQuery): Promise<ItemsPerformanceReport> =>
    apiClient.get(
      `/reports/items-performance${toQueryString({
        startDate: query.startDate,
        endDate: query.endDate,
        organizationId: query.organizationId,
        limit: query.limit !== undefined ? String(query.limit) : undefined,
      })}`,
      token,
    ),

  getAccountantReconciliation: (
    token: string,
    query: AccountantReconciliationQuery,
  ): Promise<AccountantReconciliationReport> =>
    apiClient.get(
      `/reports/accountant-reconciliation${toQueryString({
        date: query.date,
        organizationId: query.organizationId,
      })}`,
      token,
    ),

  getDiscountUsage: (
    token: string,
    query: DiscountUsageQuery,
  ): Promise<DiscountUsageReport> =>
    apiClient.get(
      `/reports/discount-usage${toQueryString({
        startDate: query.startDate,
        endDate: query.endDate,
        organizationId: query.organizationId,
      })}`,
      token,
    ),

  getStaleOrders: (
    token: string,
    organizationId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<StaleOrdersReport> =>
    apiClient.get(`/reports/stale-orders${toQueryString({ organizationId, startDate, endDate })}`, token),
};

