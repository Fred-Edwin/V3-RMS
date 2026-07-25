import { apiClient } from '@/lib/apiClient';
import type {
  CreatedPrintStation,
  PrintJob,
  PrintJobSummary,
  PrintStation,
  ReceiptType,
  SelectablePrintStation,
} from '@/types/print';
import type { ApiResponseEnvelope } from '@/types/api';

export const printService = {
  // ── Print Jobs ────────────────────────────────────────────────────────────

  /**
   * Create a print job. `targetStationId` pins the job to one device;
   * omit it (or pass null) to let any station in the branch claim it.
   */
  createPrintJob: (
    orderId: string,
    token: string,
    receiptType: ReceiptType = 'RECEIPT',
    targetStationId?: string | null,
  ): Promise<PrintJobSummary> =>
    apiClient.post<PrintJobSummary>(
      '/print-jobs',
      { orderId, receiptType, ...(targetStationId ? { targetStationId } : {}) },
      token,
    ),

  createOtherIncomePrintJob: (entryId: string, token: string): Promise<PrintJobSummary> =>
    apiClient.post<PrintJobSummary>('/print-jobs/other-income', { entryId }, token),

  /**
   * Print a corporate account settlement receipt. `branchId` selects which
   * branch's printer receives the job — required for DIRECTOR/SYSTEM_ADMIN/
   * ACCOUNTANT users with no home branch (CorporateAccount itself has none).
   */
  createCorporateSettlementPrintJob: (
    settlementId: string,
    token: string,
    branchId?: string,
    targetStationId?: string | null,
  ): Promise<PrintJobSummary> => {
    const qs = branchId ? `?branchId=${branchId}` : '';
    return apiClient.post<PrintJobSummary>(
      `/print-jobs/corporate-settlement${qs}`,
      { settlementId, ...(targetStationId ? { targetStationId } : {}) },
      token,
    );
  },

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

  // ── Print Target Picker ───────────────────────────────────────────────────

  /** Branch print stations available to pick as a print target (waiter-accessible). */
  listSelectableStations: (token: string): Promise<SelectablePrintStation[]> =>
    apiClient.get<SelectablePrintStation[]>('/print-stations/selectable', token),

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

  /** Enqueue a canned diagnostic print on a specific station. */
  testPrintStation: (stationId: string, token: string, branchId?: string): Promise<PrintJobSummary> => {
    const qs = branchId ? `?branchId=${branchId}` : '';
    return apiClient.post<PrintJobSummary>(`/print-stations/${stationId}/test-print${qs}`, {}, token);
  },
};
