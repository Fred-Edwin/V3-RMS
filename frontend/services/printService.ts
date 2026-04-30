import { apiClient } from '@/lib/apiClient';
import type {
  CreatedPrintStation,
  PrintJob,
  PrintJobSummary,
  PrintStation,
  ReceiptType,
} from '@/types/print';
import type { ApiResponseEnvelope } from '@/types/api';

export const printService = {
  // ── Print Jobs ────────────────────────────────────────────────────────────

  createPrintJob: (orderId: string, token: string, receiptType: ReceiptType = 'RECEIPT'): Promise<PrintJobSummary> =>
    apiClient.post<PrintJobSummary>('/print-jobs', { orderId, receiptType }, token),

  createOtherIncomePrintJob: (entryId: string, token: string): Promise<PrintJobSummary> =>
    apiClient.post<PrintJobSummary>('/print-jobs/other-income', { entryId }, token),

  getPrintJobs: (
    token: string,
    params?: { status?: string; page?: number; perPage?: number },
  ): Promise<ApiResponseEnvelope<PrintJob[]>> => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.perPage) qs.set('perPage', String(params.perPage));
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return apiClient.getWithEnvelope<PrintJob[]>(`/print-jobs${query}`, token);
  },

  getPrintJobById: (id: string, token: string): Promise<PrintJob> =>
    apiClient.get<PrintJob>(`/print-jobs/${id}`, token),

  // ── Print Station Management ──────────────────────────────────────────────

  createPrintStation: (name: string, token: string, branchId?: string): Promise<CreatedPrintStation> => {
    const qs = branchId ? `?branchId=${branchId}` : '';
    return apiClient.post<CreatedPrintStation>(`/print-stations${qs}`, { name }, token);
  },

  listPrintStations: (token: string, branchId?: string): Promise<PrintStation[]> => {
    const qs = branchId ? `?branchId=${branchId}` : '';
    return apiClient.get<PrintStation[]>(`/print-stations${qs}`, token);
  },

  deactivatePrintStation: (stationId: string, token: string, branchId?: string): Promise<void> => {
    const qs = branchId ? `?branchId=${branchId}` : '';
    return apiClient.delete<void>(`/print-stations/${stationId}${qs}`, token);
  },
};
