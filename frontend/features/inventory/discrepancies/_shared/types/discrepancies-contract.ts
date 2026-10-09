/**
 * Inventory: Dispatch, deliveries and discrepancies (Block 2), the DISCREPANCIES half. FROZEN API CONTRACT, front-end mirror.
 *
 * Hand-written mirror of `backend/src/modules/inventory/discrepancies/_shared/discrepancies-contract.ts` (Q1 to Q5).
 * Source of truth: docs/features/inventory/dispatch-contract.md and discrepancies.md. Shared pieces come from the dispatch mirror.
 *
 * Money (`lossValueKes`, `valueKes`) is ABSENT, never null, without `requisitions.see_value`. Screens read the `can` flags.
 */
import type { PageInfo, PageQuery } from '../../../_shared/types/wire';
import type { BranchRef, CountReason, DepartmentRef, DispatchActivityEvent, PhotoRef, Stamp } from '../../../dispatch/_shared/types/dispatch-contract';

// --- Words and enums -----------------------------------------------------------

/** Socket event per record (Amendment 1 row 16). */
export const DISCREPANCY_CHANGED_EVENT = 'discrepancy:changed';
export interface DiscrepancyChangedPayload {
  id: string;
  reference: string;
  siteId: string;
  reason: string;
}

/**
 * OPEN = held as unaccounted, waiting for a finding, and again after a reversal. REVERSED is the instant a reversal is posted: the
 * status goes REVERSED and straight back to OPEN (Amendment 1 row 7), so a response never shows it as the settled state.
 */
export type DiscrepancyStatus = 'OPEN' | 'RECORDED' | 'REVERSED';
export const DISCREPANCY_STATUSES: readonly DiscrepancyStatus[] = ['OPEN', 'RECORDED', 'REVERSED'];

export type Finding = 'PACKED_SHORT' | 'PACKED_MORE' | 'LOST_OR_DAMAGED' | 'BRANCH_COUNTED_WRONG' | 'CANT_TELL';
export const FINDINGS: readonly Finding[] = ['PACKED_SHORT', 'PACKED_MORE', 'LOST_OR_DAMAGED', 'BRANCH_COUNTED_WRONG', 'CANT_TELL'];

export type GapDirection = 'SHORT' | 'EXTRA';
export const GAP_DIRECTIONS: readonly GapDirection[] = ['SHORT', 'EXTRA'];

/** Which findings may be recorded for which direction. */
export const FINDINGS_FOR: Record<GapDirection, readonly Finding[]> = {
  SHORT: ['PACKED_SHORT', 'LOST_OR_DAMAGED', 'BRANCH_COUNTED_WRONG', 'CANT_TELL'],
  EXTRA: ['PACKED_MORE', 'BRANCH_COUNTED_WRONG', 'CANT_TELL'],
};

/** Names as Paper D15 and D21 draw them; the Extra one is the contract's recommended wording (not drawn, owner to confirm). */
export const FINDING_TEXT: Record<Finding, string> = {
  PACKED_SHORT: 'Packed short at the store',
  PACKED_MORE: 'Packed more than recorded',
  LOST_OR_DAMAGED: 'Lost or damaged on the way',
  BRANCH_COUNTED_WRONG: 'Branch counted wrong',
  CANT_TELL: "Can't tell",
};

export type FindingAgainst = 'STORE' | 'CARRIER' | 'RECEIVER' | 'UNEXPLAINED';
export const FINDING_AGAINST: readonly FindingAgainst[] = ['STORE', 'CARRIER', 'RECEIVER', 'UNEXPLAINED'];
/** LOSS is written off at frozen cost; PACKING_ERROR is shown on its own report line (not a loss); NONE is a correction. */
export type LossKind = 'LOSS' | 'PACKING_ERROR' | 'NONE';
export const LOSS_KINDS: readonly LossKind[] = ['LOSS', 'PACKING_ERROR', 'NONE'];
export const FINDING_PROFILE: Record<Finding, { against: FindingAgainst; lossKind: LossKind }> = {
  PACKED_SHORT: { against: 'STORE', lossKind: 'PACKING_ERROR' },
  PACKED_MORE: { against: 'STORE', lossKind: 'PACKING_ERROR' },
  LOST_OR_DAMAGED: { against: 'CARRIER', lossKind: 'LOSS' },
  BRANCH_COUNTED_WRONG: { against: 'RECEIVER', lossKind: 'NONE' },
  CANT_TELL: { against: 'UNEXPLAINED', lossKind: 'LOSS' },
};

export type DiscrepancyTab = 'open' | 'settled';
export const DISCREPANCY_TABS: readonly DiscrepancyTab[] = ['open', 'settled'];

export const FINDING_NOTE_MAX = 300;
export const REVERSE_REASON_MAX = 300;
/** Fixed constant: the reminder after 24 hours, then daily. */
export const REMINDER_AFTER_HOURS = 24;

// --- Shared pieces ---------------------------------------------------------------

export interface RecordedFinding {
  finding: Finding;
  note: string | null;
  recorded: Stamp;
  against: FindingAgainst;
  lossKind: LossKind;
  /** cap requisitions.see_value: written off at the cost frozen at dispatch (LOSS findings), KES. */
  lossValueKes?: string;
}
export interface Reversal {
  reason: string;
  reversed: Stamp;
}

// --- Q1 GET /discrepancies (7c) -------------------------------------------------------

export interface ListDiscrepanciesQuery extends PageQuery {
  tab?: DiscrepancyTab;
  branchId?: string;
  departmentId?: string;
  q?: string;
  from?: string;
  to?: string;
}
export interface DiscrepancyRow {
  id: string;
  reference: string;
  status: DiscrepancyStatus;
  branch: BranchRef;
  department: DepartmentRef;
  itemName: string;
  unit: string;
  /** counted − sent, signed. */
  gapQty: string;
  direction: GapDirection;
  branchReason: CountReason | null;
  dispatch: { id: string; reference: string };
  openedAt: string;
  reminderSentAt: string | null;
  finding: RecordedFinding | null;
  can: { recordFinding: boolean };
}
export interface ListDiscrepancies {
  tab: DiscrepancyTab;
  rows: DiscrepancyRow[];
  /** A discrepancy whose finding was reversed counts as Open. */
  counts: { open: number; settled: number };
  /** Hub roles only. */
  branches?: BranchRef[];
  page: PageInfo;
}

// --- Q2 GET /discrepancies/:id (D14) ---------------------------------------------------

export interface DiscrepancyFile {
  id: string;
  reference: string;
  status: DiscrepancyStatus;
  branch: BranchRef;
  department: DepartmentRef;
  dispatch: { id: string; reference: string };
  requisition: { id: string; reference: string };
  item: { id: string; name: string; unit: string };
  sentQty: string;
  countedQty: string;
  gapQty: string;
  direction: GapDirection;
  countedTwice: boolean;
  branchReason: CountReason | null;
  branchReasonNote: string | null;
  photos: PhotoRef[];
  packed: Stamp;
  signed: Stamp;
  carrier: { id: string; name: string };
  counted: Stamp;
  assignedTo: string;
  openedAt: string;
  reminderSentAt: string | null;
  /** The CURRENT finding: null while OPEN, including after a reversal (history in `events` and `reversal`). */
  finding: RecordedFinding | null;
  /** The latest reversal. */
  reversal: Reversal | null;
  /** The findings that may be recorded; empty unless the status is OPEN (full again after a reversal). */
  allowedFindings: Finding[];
  events: DispatchActivityEvent[];
  nextStep: { action: 'RECORD_A_FINDING' | null; facts: { reminderAfterHours: number } };
  /** cap requisitions.see_value: the held gap at the cost frozen at dispatch, KES. */
  valueKes?: string;
  can: { recordFinding: boolean; reverse: boolean };
}

// --- Q3 GET /discrepancies/:id/finding-preview?finding= (D15) ----------------------------------

export interface FindingPreviewQuery {
  finding: Finding;
}
export interface FindingPreview {
  id: string;
  reference: string;
  finding: Finding;
  itemName: string;
  unit: string;
  /** Signed, one row per place stock moves ("Central Store stock +2"). */
  effects: { place: 'CENTRAL_STORE' | 'DEPARTMENT' | 'WRITTEN_OFF'; placeName: string; quantity: string }[];
  against: FindingAgainst;
  againstParty: string | null;
  lossKind: LossKind;
  /** cap requisitions.see_value */
  lossValueKes?: string;
}

// --- Q4 POST /discrepancies/:id/findings (D15) ----------------------------------------------------

export interface RecordFindingInput {
  finding: Finding;
  note?: string;
  pin: string;
  /** A repeated key returns the first result. */
  idempotencyKey: string;
}
export interface RecordFindingResult {
  id: string;
  reference: string;
  status: 'RECORDED';
  finding: RecordedFinding;
  ledgerEntries: number;
  replayed: boolean;
}

// --- Q5 POST /discrepancies/:id/reverse (D16) ----------------------------------------------------------

export interface ReverseFindingInput {
  reason: string;
  pin: string;
  /** A repeated key returns the first result. */
  idempotencyKey: string;
}
/** After a reversal the gap is held as unaccounted again: `status` is OPEN and a new finding may be recorded. */
export interface ReverseFindingResult {
  id: string;
  reference: string;
  status: 'OPEN';
  reversal: Reversal;
  ledgerEntries: number;
  replayed: boolean;
}

// --- Errors ------------------------------------------------------------------------------------------------

export const DISCREPANCY_ERROR_CODES = [
  'FINDING_ALREADY_RECORDED',
  'INVALID_PIN',
  'FINDING_NOT_ALLOWED',
  // Amendment 1 rows 7 and 11: replaces NO_FINDING_TO_REVERSE and ALREADY_REVERSED
  'FINDING_NOT_REVERSIBLE',
] as const;
export type DiscrepancyErrorCode = (typeof DISCREPANCY_ERROR_CODES)[number];
