/**
 * Inventory Milestone Six, Session 2 — Central Store counting.
 * Hand-mirrored from `backend/src/modules/inventory/count-validators.ts`
 * (API_CONTRACT.md §26.2). Decimals are strings; business dates are
 * `YYYY-MM-DD` (Africa/Nairobi); instants are ISO-8601.
 *
 * Blind count: `AttendantCountView` deliberately has no expected / variance /
 * on-hand / cost fields — the server never sends them to the attendant.
 */

export type CountKind = 'DAILY' | 'SPOT';
export type CountStatus = 'DRAFT' | 'SUBMITTED' | 'RETURNED' | 'VERIFIED';
export type CountLineDecision = 'PENDING' | 'ACCEPTED' | 'QUERIED';
export type CountReasonValue =
  | 'SUSPECTED_MISCOUNT'
  | 'UNLOGGED_SPOILAGE'
  | 'SUSPECTED_LOSS'
  | 'WITHIN_NORMAL_RANGE'
  | 'OTHER';

// --- Attendant (blind) -------------------------------------------------------

export interface AttendantCountLine {
  inventoryItemId: string;
  name: string;
  usageUnit: string;
  categoryId: string | null;
  categoryName: string;
  countedQty: string | null;
  /** RETURNED: only queried lines are editable. */
  editable: boolean;
  /** The Store Manager's per-line note. Never states the expected figure. */
  queryNote: string | null;
}

export interface AttendantCountCategory {
  /** Top-level category id; null = uncategorized. */
  id: string | null;
  name: string;
  total: number;
  counted: number;
}

export interface AttendantCountView {
  id: string;
  reference: string;
  countDate: string;
  status: CountStatus;
  counterName: string;
  totals: { counted: number; total: number };
  categories: AttendantCountCategory[];
  /** DRAFT: every line. RETURNED: queried lines only. SUBMITTED / VERIFIED: none. */
  lines: AttendantCountLine[];
  savedAt: string | null;
  submittedAt: string | null;
  returnNote: string | null;
  returnedAt: string | null;
  returnedByName: string | null;
}

export interface SaveCountLinesInput {
  lines: { inventoryItemId: string; countedQty: string | null }[];
}

export interface AttendantSaveResult {
  savedAt: string;
  counted: number;
  total: number;
}

export interface AttendantSubmitResult {
  id: string;
  reference: string;
  status: CountStatus;
  submittedAt: string;
  counted: number;
  total: number;
}

// --- Store Manager ------------------------------------------------------------

export interface VerifierCountLine {
  lineId: string;
  inventoryItemId: string;
  name: string;
  usageUnit: string;
  categoryName: string;
  countedQty: string | null;
  expectedQty: string | null;
  variance: string | null;
  /** Signed KES. */
  varianceValue: string | null;
  unitCost: string | null;
  decision: CountLineDecision;
  reason: CountReasonValue | null;
  reasonNote: string | null;
  reasonRequired: boolean;
  directorAlert: boolean;
  queryNote: string | null;
  firstCountedQty: string | null;
  adjustmentReference: string | null;
  adjustmentTransactionId: string | null;
}

export interface CountTotals {
  lines: number;
  uncountedLines: number;
  matchedLines: number;
  varianceLines: number;
  aboveThreshold: number;
  queriedLines: number;
  netVarianceValue: string;
}

export interface VerifierCountView {
  id: string;
  reference: string;
  kind: CountKind;
  countDate: string;
  status: CountStatus;
  counter: { id: string; name: string };
  counterSignedAt: string | null;
  verifier: { id: string; name: string } | null;
  verifiedAt: string | null;
  returnNote: string | null;
  returnedAt: string | null;
  directorNotified: boolean;
  totals: CountTotals;
  thresholds: { reasonRequiredKes: number; directorAlertKes: number };
  lines: VerifierCountLine[];
}

export interface CountListItem {
  id: string;
  reference: string;
  kind: CountKind;
  countDate: string;
  status: CountStatus;
  counterName: string;
  counterSignedAt: string | null;
  verifierName: string | null;
  verifiedAt: string | null;
  itemCount: number;
  totalLines: number;
  varianceLines: number;
  adjustmentCount: number;
  netVarianceValue: string;
  directorNotified: boolean;
}

export interface CountList {
  counts: CountListItem[];
}

export interface DecideLineInput {
  decision: CountLineDecision;
  reason?: CountReasonValue | null;
  reasonNote?: string | null;
  queryNote?: string | null;
}

export interface ApproveCountResult {
  count: VerifierCountView;
  adjustmentsWritten: number;
  netAdjustmentValue: string;
  directorNotified: boolean;
}

export interface ReturnCountResult {
  count: VerifierCountView;
}

export interface SpotCountInput {
  lines: { inventoryItemId: string; countedQty: string; reason?: CountReasonValue | null; reasonNote?: string | null }[];
  pin: string;
}

export type SpotCountResult = ApproveCountResult;

export interface CountPrint {
  reference: string;
  kind: CountKind;
  countDate: string;
  status: CountStatus;
  locationName: string;
  totals: CountTotals;
  adjustments: {
    itemName: string;
    usageUnit: string;
    variance: string;
    reference: string;
    value: string;
    reason: string | null;
  }[];
  directorAlertItems: { itemName: string; variance: string; usageUnit: string }[];
  directorNotified: boolean;
  counter: { name: string; roleLabel: string; signedAt: string | null };
  verifier: { name: string; roleLabel: string; signedAt: string | null } | null;
  generatedAt: string;
}

// --- Thresholds ---------------------------------------------------------------

export interface Thresholds {
  reasonRequiredKes: number;
  overnightAlertKes: number | null;
  directorAlertKes: number;
  isDefault: boolean;
  updatedBy: { id: string; name: string } | null;
  updatedAt: string | null;
  directorUpdatedBy: { id: string; name: string } | null;
  directorUpdatedAt: string | null;
}
