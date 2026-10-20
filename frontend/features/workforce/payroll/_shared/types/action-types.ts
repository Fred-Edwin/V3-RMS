/** Review, approval, publish, pay-out and correction: what the screens send and what comes back (API_CONTRACT §40 and §41). */

import type { MonthState } from './month-types';

export type ReviewSeverity = 'BLOCK' | 'TICK';

export interface ReviewCounts {
  total: number;
  checked: number;
  blocking: number;
}

export interface ReviewLine {
  id: string;
  kind: string;
  severity: ReviewSeverity;
  employeeId: string;
  name: string;
  siteId: string;
  siteName: string;
  text: string;
  state: 'OPEN' | 'CHECKED';
  checkedBy: string | null;
  checkedAt: string | null;
  actions: string[];
}

export interface ReviewList {
  monthKey: string;
  state: MonthState;
  stateVersion: number;
  counts: ReviewCounts;
  /** Something the calculation read changed since it ran: Calculate again. */
  stale: boolean;
  canTick: boolean;
  lines: ReviewLine[];
  page: number;
  rows: number;
  total: number;
}

export interface ReviewQuery {
  kind?: string;
  state?: 'OPEN' | 'CHECKED';
  severity?: ReviewSeverity;
  q?: string;
  page: number;
  rows: number;
}

export const ADJUSTMENT_TYPES = ['ALLOWANCE', 'INCENTIVE', 'ARREARS', 'OTHER_EARNING', 'ADVANCE_REPAID', 'HELB', 'OTHER_DEDUCTION'] as const;
export type AdjustmentType = (typeof ADJUSTMENT_TYPES)[number];

export interface AdjustmentBody {
  employeeId: string;
  type: AdjustmentType;
  label: string;
  amount: string;
  taxable: boolean;
  reason: string;
  pin: string;
  idempotencyKey: string;
  stateVersion: number;
}

/** What a step answers: send, send back, approve. */
export interface StepResult {
  monthKey: string;
  state: 'TO_APPROVE' | 'IN_REVIEW' | 'TO_PUBLISH';
  stateVersion: number;
  documentNumber: string | null;
  repeat: boolean;
}

export interface ApproveBody {
  pin: string;
  idempotencyKey: string;
  stateVersion: number;
  expectedTotals: { gross: string; net: string; taxStatutory: string; other: string; headcount: number };
  handChecked?: boolean;
}

export interface PublishResult {
  state: 'PUBLISHED';
  stateVersion: number;
  published: number;
}

export type FileState = 'NONE' | 'DOWNLOADED' | 'VOIDED';

export interface BankFile {
  state: FileState;
  version: number | null;
  filename: string | null;
  hash: string | null;
  downloadedAt: string | null;
  downloadedBy: string | null;
  voidedAt: string | null;
  voidReason: string | null;
}

export interface PayoutView {
  monthKey: string;
  state: MonthState;
  locked: boolean;
  methods: { method: 'BANK'; people: number; amount: string; file: BankFile }[];
  cannotPay: { employeeId: string; name: string; reason: string }[];
  nothingToPay: { employeeId: string; name: string }[];
  otherMethods: { method: string; people: number; amount: string }[];
  canMarkPaid: boolean;
  blockedBy: 'CANNOT_PAY' | 'NO_FILE' | null;
  nextFilename: string;
}

export interface MarkPaidBody {
  pin: string;
  idempotencyKey: string;
  stateVersion: number;
  bankFileHash?: string;
}

export interface MarkPaidResult {
  state: 'PAID';
  stateVersion: number;
  paidAt: string;
}

/** A downloaded file: the bytes, the name the server gave it and the headers the screens keep. */
export interface DownloadedFile {
  blob: Blob;
  filename: string;
  documentNumber: string | null;
  revision: string | null;
  bankFileHash: string | null;
}

export type CorrectionKind = 'LATE_DAYS' | 'UNPAID_ABSENCE' | 'OVERTIME' | 'BASIC' | 'EXTRA_LINE';

export type CorrectionChange =
  | { kind: 'LATE_DAYS'; changes: { lateDaysCounted: number } }
  | { kind: 'UNPAID_ABSENCE'; changes: { absentDays: number } }
  | { kind: 'OVERTIME'; changes: { ordinaryDay: number; restDay: number; publicHoliday: number } }
  | { kind: 'BASIC'; changes: { amount: string } }
  | { kind: 'EXTRA_LINE'; changes: { add: { type: AdjustmentType; label: string; amount: string; taxable: boolean }[]; removeIds: string[] } };

export interface CorrectionInputs {
  payslipId: string;
  version: number;
  employeeName: string;
  siteName: string;
  current: {
    lateDaysCounted: number;
    absentDays: number;
    overtimeAuthorisedMinutes: { ordinaryDay: number; restDay: number; publicHoliday: number };
    basicAmount: string | null;
    extraLines: { id: string; kind: string; label: string; amount: string; taxable: boolean }[];
  };
  bankFile: { downloadedAt: string; version: number } | null;
}

export interface CorrectionPreview {
  payslipId: string;
  version: number;
  lines: { code: string; label: string; now: string | null; corrected: string | null }[];
  netNow: string;
  netCorrected: string;
  netChange: string;
  voidsBankFile: boolean;
}

export interface CorrectionResult {
  monthKey: string;
  payslipId: string;
  employeeId: string;
  version: number;
  netBefore: string;
  netAfter: string;
  bankFileVoided: boolean;
  stateVersion: number;
  repeat: boolean;
}

export type ExportKind = 'REGISTER' | 'SUMMARY' | 'STATUTORY' | 'PAYSLIPS';
export type ExportFormat = 'pdf' | 'xlsx' | 'zip';
