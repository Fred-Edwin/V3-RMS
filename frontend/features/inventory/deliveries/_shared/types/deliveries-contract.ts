/**
 * Inventory: Dispatch, deliveries and discrepancies (Block 2), the DELIVERIES half. FROZEN API CONTRACT, front-end mirror.
 *
 * Hand-written mirror of `backend/src/modules/inventory/deliveries/_shared/deliveries-contract.ts` (V1 to V6).
 * Source of truth: docs/features/inventory/dispatch-contract.md and discrepancies.md. Shared pieces come from the dispatch mirror.
 *
 * THE BLIND RULE: nothing in V1 to V4 carries the sent quantity or the gap. The sent figure first appears in V5. The branch never
 * sees money. A save only stores what was typed; a check is the moment of comparison (COUNT_AGAIN once, then SHORT or EXTRA, final).
 */
import type { PageInfo, PageQuery, Person } from '../../../_shared/types/wire';
import type { BranchRef, CountReason, DeliveryResult, DepartmentRef, DispatchStage, PhotoRef } from '../../../dispatch/_shared/types/dispatch-contract';

// --- Words and enums -----------------------------------------------------------

/** SHORT and EXTRA appear only after the second check. */
export type LineCountState = 'NOT_COUNTED' | 'COUNTED' | 'COUNT_AGAIN' | 'SHORT' | 'EXTRA';
export const LINE_COUNT_STATES: readonly LineCountState[] = ['NOT_COUNTED', 'COUNTED', 'COUNT_AGAIN', 'SHORT', 'EXTRA'];

export type DeliveryTab = 'waiting' | 'past';
export const DELIVERY_TABS: readonly DeliveryTab[] = ['waiting', 'past'];

export const REASON_NOTE_MAX = 200;

// --- V1 GET /deliveries/mine (D7, G2) ---------------------------------------------

export interface ListDeliveriesQuery extends PageQuery {
  tab?: DeliveryTab;
  from?: string;
  to?: string;
  result?: DeliveryResult;
}
export interface DeliveryRow {
  id: string;
  reference: string;
  department: DepartmentRef;
  lineCount: number;
  /** When the Central Store signed it ("left 3:05 pm"). */
  signedAt: string;
  stage: DispatchStage;
  /** Someone has started counting: the button reads "Continue counting". */
  countStarted: boolean;
  confirmedAt: string | null;
  confirmedBy: Person | null;
  result: DeliveryResult | null;
  can: { count: boolean; confirmOnBehalf: boolean };
}
export interface ListDeliveries {
  tab: DeliveryTab;
  rows: DeliveryRow[];
  tabCounts: { waiting: number; past: number };
  page: PageInfo;
}

// --- V2 GET /deliveries/:id/count (D8, D9) ------------------------------------------

/** NO sent figure, NO gap, nothing pre-filled. */
export interface CountLine {
  lineId: string;
  itemName: string;
  unit: string;
  categoryPath: string[];
  countedQty: string | null;
  state: LineCountState;
  /** Checks this line has been through: 0, 1, or 2 (final). */
  attempt: 0 | 1 | 2;
  reason: CountReason | null;
  reasonNote: string | null;
  photos: PhotoRef[];
}
export interface CountView {
  id: string;
  reference: string;
  branch: BranchRef;
  department: DepartmentRef;
  signedAt: string;
  lineCount: number;
  countedCount: number;
  countAgainCount: number;
  lines: CountLine[];
  canCheck: boolean;
  onBehalfOfDepartment: DepartmentRef | null;
}

// --- V3 PUT /deliveries/:id/count and POST /deliveries/:id/check (D8, D9) -----------------

/** The save never says whether a count matches. The response is the updated `CountView`. */
export interface SaveCountInput {
  counts: { lineId: string; countedQty: string }[];
}
/** The check: only the lines that differ, by name and typed number. */
export interface CheckCountResult {
  differing: { lineId: string; itemName: string; countedQty: string; state: 'COUNT_AGAIN' | 'SHORT' | 'EXTRA' }[];
  /** No line is COUNT_AGAIN. */
  final: boolean;
  /** Every SHORT or EXTRA line has a reason. */
  reasonsComplete: boolean;
  view: CountView;
}

// --- V4 reason and photos (D10) --------------------------------------------------------------

/** The response is the updated `CountLine`. */
export interface SetReasonInput {
  reason: CountReason;
  note?: string;
}
/** The upload is multipart: a `lineId` field and one `file` part (JPEG, PNG or WebP, at most 5 MB, at most 3 per line). */
export interface UploadPhotoFields {
  lineId: string;
}
export interface UploadPhotoResult {
  lineId: string;
  photo: PhotoRef;
  photos: PhotoRef[];
}

// --- V5 GET /deliveries/:id/confirm-preview (D11) ------------------------------------------------

/** The ONLY place the sent figure appears before the signature. */
export interface ConfirmPreview {
  id: string;
  reference: string;
  department: DepartmentRef;
  lineCount: number;
  matchingLines: { lineId: string; itemName: string }[];
  differingLines: {
    lineId: string;
    itemName: string;
    unit: string;
    countedQty: string;
    sentQty: string;
    /** counted − sent, signed. */
    gapQty: string;
    direction: 'SHORT' | 'EXTRA';
    reason: CountReason | null;
    reasonNote: string | null;
    photoCount: number;
  }[];
  signedBy: Person;
  onBehalfOfDepartment: DepartmentRef | null;
  canConfirm: boolean;
}

// --- V6 POST /deliveries/:id/confirm (D11, D12, D19) ---------------------------------------------

export interface ConfirmDeliveryInput {
  pin: string;
  onBehalf?: boolean;
  idempotencyKey: string;
}
export interface ConfirmDeliveryResult {
  id: string;
  reference: string;
  status: 'CONFIRMED' | 'CLOSED';
  confirmedAt: string;
  confirmedBy: Person;
  onBehalfOfDepartment: DepartmentRef | null;
  lineCount: number;
  matchedCount: number;
  discrepancies: { id: string; reference: string; itemName: string; gapQty: string }[];
  replayed: boolean;
}

// --- Errors ------------------------------------------------------------------------------------------

export const DELIVERY_ERROR_CODES = [
  'INVALID_PIN',
  'NOT_YOUR_DEPARTMENT',
  'NOT_ON_THE_WAY',
  'ALREADY_CONFIRMED',
  'COUNT_FINAL',
  'NOT_ALL_COUNTED',
  'COUNT_AGAIN_PENDING',
  'LINE_NOT_DIFFERENT',
  'REASON_MISSING',
  'TOO_MANY_PHOTOS',
  'PHOTO_TOO_LARGE',
  'PHOTO_TYPE_NOT_ALLOWED',
  'ON_BEHALF_NOT_ALLOWED',
] as const;
export type DeliveryErrorCode = (typeof DELIVERY_ERROR_CODES)[number];
