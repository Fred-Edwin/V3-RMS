import { apiClient } from '@/lib/apiClient';
import { env } from '@/lib/env';
import { useAuthStore } from '@/store/authStore';
import { ApiError, type ApiResponseEnvelope } from '@/types/api';

import type {
  AdjustmentBody,
  ApproveBody,
  CorrectionChange,
  CorrectionPreview,
  CorrectionResult,
  DownloadedFile,
  ExportFormat,
  ExportKind,
  MarkPaidBody,
  MarkPaidResult,
  PublishResult,
  ReviewCounts,
  StepResult,
} from '../types/action-types';
import type { ReminderResult } from '../types/month-types';
import { BASE } from './payroll-reads';

/** Every Payroll write (API_CONTRACT §40 P11 to P21 and §41 P22 to P29). Each POST carries an idempotency key made by the dialog that sends it. */

const token = (): string | undefined => useAuthStore.getState().accessToken ?? undefined;
const month = (monthKey: string): string => `${BASE}/months/${monthKey}`;

export const payrollWrites = {
  /** P12: tick or un-tick one line (does not move the month's version). */
  check: (monthKey: string, lineId: string, body: { checked: boolean; stateVersion: number }): Promise<{ checked: boolean; counts: ReviewCounts }> =>
    apiClient.post(`${month(monthKey)}/review/${lineId}/check`, body, token()),
  /** P13 */
  checkKind: (monthKey: string, body: { kind: string; stateVersion: number }): Promise<{ ticked: number; counts: ReviewCounts }> =>
    apiClient.post(`${month(monthKey)}/review/check-kind`, body, token()),
  /** P14 */
  leaveOut: (monthKey: string, lineId: string, body: { reason: string; stateVersion: number; idempotencyKey: string }): Promise<unknown> =>
    apiClient.post(`${month(monthKey)}/review/${lineId}/leave-out`, body, token()),
  /** P11 */
  recalculate: (monthKey: string, body: { idempotencyKey: string; stateVersion: number }): Promise<unknown> =>
    apiClient.post(`${month(monthKey)}/recalculate`, body, token()),
  /** P15 */
  addAdjustment: (monthKey: string, body: AdjustmentBody): Promise<unknown> => apiClient.post(`${month(monthKey)}/adjustments`, body, token()),
  /** P17 */
  send: (monthKey: string, body: { idempotencyKey: string; stateVersion: number }): Promise<StepResult> =>
    apiClient.post(`${month(monthKey)}/send-to-accountant`, body, token()),
  /** P18 */
  sendBack: (monthKey: string, body: { reason: string; idempotencyKey: string; stateVersion: number }): Promise<StepResult> =>
    apiClient.post(`${month(monthKey)}/send-back`, body, token()),
  /** P19 */
  approve: (monthKey: string, body: ApproveBody): Promise<StepResult> => apiClient.post(`${month(monthKey)}/approve`, body, token()),
  /** P20 */
  remind: (monthKey: string, siteId: string, idempotencyKey: string): Promise<ReminderResult> =>
    apiClient.post(`${month(monthKey)}/sites/${siteId}/remind`, { idempotencyKey }, token()),
  /** P21: the Director approves a site's timesheet month for it. */
  approveSiteLate: (
    monthKey: string,
    siteId: string,
    body: { pin: string; idempotencyKey: string; expectedTotals: { workedMinutes: number; overtimeAuthorisedMinutes: number; headcount: number } }
  ): Promise<unknown> => apiClient.post(`${month(monthKey)}/sites/${siteId}/approve-late`, body, token()),
  /** P22 */
  publish: (monthKey: string, body: { pin: string; idempotencyKey: string; stateVersion: number }): Promise<PublishResult> =>
    apiClient.post(`${month(monthKey)}/publish`, body, token()),
  /** P28 */
  markPaid: (monthKey: string, body: MarkPaidBody): Promise<MarkPaidResult> => apiClient.post(`${month(monthKey)}/mark-paid`, body, token()),
  /** P24: the live NOW and CORRECTED table. Saves nothing. */
  previewCorrection: (monthKey: string, payslipId: string, body: { change: CorrectionChange; expectedVersion: number }): Promise<CorrectionPreview> =>
    apiClient.post(`${month(monthKey)}/payslips/${payslipId}/correction-preview`, body, token()),
  /** P25 */
  correct: (
    monthKey: string,
    payslipId: string,
    body: { change: CorrectionChange; reason: string; pin: string; expectedVersion: number; idempotencyKey: string }
  ): Promise<CorrectionResult> => apiClient.post(`${month(monthKey)}/payslips/${payslipId}/correct`, body, token()),
};

const nameFrom = (disposition: string | null, fallback: string): string => /filename="?([^";]+)"?/.exec(disposition ?? '')?.[1] ?? fallback;

/**
 * A POST that answers with a file, not JSON (the bank file and the exports). A refusal comes back as the usual JSON envelope, so it reads
 * in the server's own words. The bank file's hash travels in a header: Mark as paid sends it back, so it is kept here.
 */
async function fetchFile(path: string, body: unknown, fallbackName: string): Promise<DownloadedFile> {
  const accessToken = token();
  const response = await fetch(`${env.apiUrl}${path}`, {
    method: 'POST',
    cache: 'no-store',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as Partial<ApiResponseEnvelope<unknown>>;
    throw new ApiError(payload.error?.message ?? 'The file could not be made.', response.status, payload.error?.code ?? 'FILE_FAILED', payload.error?.details);
  }
  return {
    blob: await response.blob(),
    filename: nameFrom(response.headers.get('Content-Disposition'), fallbackName),
    documentNumber: response.headers.get('X-Document-Number'),
    revision: response.headers.get('X-Revision'),
    bankFileHash: response.headers.get('X-Bank-File-Hash'),
  };
}

/** P27 */
export const downloadBankFile = (monthKey: string, idempotencyKey: string): Promise<DownloadedFile> =>
  fetchFile(`${month(monthKey)}/bank-file`, { idempotencyKey }, `bank-${monthKey}.csv`);

/** P29 */
export const downloadExport = (monthKey: string, kind: ExportKind, format: ExportFormat, idempotencyKey: string): Promise<DownloadedFile> =>
  fetchFile(`${month(monthKey)}/exports`, { kind, format, idempotencyKey }, `Payroll-${monthKey}.${format}`);
