/**
 * Inventory: Branch day rebuild (Block 4). FROZEN API CONTRACT, front-end mirror.
 *
 * Hand-written mirror of `backend/src/modules/inventory/branch-day/_shared/branch-day-contract.ts` (BD1 to BD21).
 * Source of truth: docs/features/inventory/branch-day-contract.md and Paper "Inventory · Counting and closing" (B0 to B18, chapter 5).
 * Decimals are strings; times are ISO; dates are Nairobi days. A field marked "cap" is ABSENT, never null, without that capability.
 * The back end sends facts and codes; every title and line is written in `../lib/branch-day-copy.ts` from the Paper B18 wording table.
 *
 * THE BLIND RULE: the head's evening count (BD6 to BD8) carries no opening, received, waste, used, yesterday or expected figure and no
 * money. A head or member never receives money from any endpoint.
 */
import type { PageInfo, PageQuery, Person } from '../../../_shared/types/wire';
import type { BranchRef, DepartmentRef, ErrorBody } from '../../../dispatch/_shared/types/dispatch-contract';

export type { BranchRef, DepartmentRef, ErrorBody };

// --- Words and enums -----------------------------------------------------------

/** The database stores OPEN and CLOSED; CORRECTED is derived (closed, with at least one correction). */
export type DayStatus = 'OPEN' | 'CLOSED' | 'CORRECTED';
export const DAY_STATUSES: readonly DayStatus[] = ['OPEN', 'CLOSED', 'CORRECTED'];
export const DAY_STATUS_TEXT: Record<DayStatus, string> = { OPEN: 'Open', CLOSED: 'Closed', CORRECTED: 'Corrected' };

export type CountState = 'NOT_COUNTED' | 'COUNTED';
export const COUNT_STATES: readonly CountState[] = ['NOT_COUNTED', 'COUNTED'];

export type OpeningState = 'NOT_CHECKED' | 'ACCEPTED' | 'RECOUNTED';
export const OPENING_STATES: readonly OpeningState[] = ['NOT_CHECKED', 'ACCEPTED', 'RECOUNTED'];

export type DeliveryState = 'NONE' | 'WAITING' | 'CONFIRMED';
export const DELIVERY_STATES: readonly DeliveryState[] = ['NONE', 'WAITING', 'CONFIRMED'];

export type CorrectionReason = 'COUNTED_WRONGLY' | 'ITEM_WAS_MISSED' | 'OTHER';
export const CORRECTION_REASONS: readonly CorrectionReason[] = ['COUNTED_WRONGLY', 'ITEM_WAS_MISSED', 'OTHER'];
export const CORRECTION_REASON_TEXT: Record<CorrectionReason, string> = {
  COUNTED_WRONGLY: 'Counted wrongly',
  ITEM_WAS_MISSED: 'Item was missed',
  OTHER: 'Other',
};
export const CORRECTION_NOTE_MAX = 200;

export type HomeAction = 'CHECK_OPENING' | 'COUNT' | 'NONE';
export const HOME_ACTIONS: readonly HomeAction[] = ['CHECK_OPENING', 'COUNT', 'NONE'];

export type BlockerKind = 'DEPARTMENT_NOT_COUNTED' | 'DELIVERY_NOT_CONFIRMED' | 'DELIVERIES_CONFIRMED' | 'ALL_COUNTED' | 'OPENING_NOT_CHECKED';
export const BLOCKER_KINDS: readonly BlockerKind[] = ['DEPARTMENT_NOT_COUNTED', 'DELIVERY_NOT_CONFIRMED', 'DELIVERIES_CONFIRMED', 'ALL_COUNTED', 'OPENING_NOT_CHECKED'];
export type BlockerSeverity = 'BLOCKS' | 'INFO' | 'OK';
export const BLOCKER_SEVERITIES: readonly BlockerSeverity[] = ['BLOCKS', 'INFO', 'OK'];

export type DayActivityType = 'OPENING_ACCEPTED' | 'OPENING_RECOUNTED' | 'COUNT_SIGNED' | 'COUNT_SIGNED_ON_BEHALF' | 'DAY_CLOSED' | 'COUNT_CORRECTED';
export const DAY_ACTIVITY_TYPES: readonly DayActivityType[] = ['OPENING_ACCEPTED', 'OPENING_RECOUNTED', 'COUNT_SIGNED', 'COUNT_SIGNED_ON_BEHALF', 'DAY_CLOSED', 'COUNT_CORRECTED'];

export type SheetKind = 'AT_THE_CLOSE' | 'AFTER_CORRECTION';
export const SHEET_KINDS: readonly SheetKind[] = ['AT_THE_CLOSE', 'AFTER_CORRECTION'];

// --- Shared pieces ----------------------------------------------------------------

/** Counted minus last night's signed figure (negative = "less"). Never zero. */
export interface OpeningDifference {
  itemId: string;
  itemName: string;
  unit: string;
  lastNightQty: string;
  countedQty: string;
  difference: string;
}

export interface OpeningCheck {
  state: OpeningState;
  checkedAt: string | null;
  checkedBy: Person | null;
  /** The Branch Manager checked it for the department (not drawn: contract gap 7). */
  onBehalf: boolean;
  differences: OpeningDifference[];
}

export interface DeliveryFact {
  state: DeliveryState;
  dispatches: { id: string; reference: string }[];
  confirmedAt: string | null;
  gapCount: number;
  gapOpen: boolean;
}

export interface LedgerEntry {
  id: string;
  at: string;
  itemName: string;
  unit: string;
  department: DepartmentRef;
  /** Signed as stored: "-3" is three used. A correction's entry carries the change only. */
  quantity: string;
  /** The `DAY-…` reference every usage entry carries. */
  reference: string;
  kind: 'USAGE' | 'CORRECTION';
}

export interface DayDocument {
  id: string;
  version: number;
  kind: SheetKind;
  latest: boolean;
  reference: string;
  pages: number;
  madeAt: string;
}

export interface LineCorrection {
  id: string;
  at: string;
  by: Person;
  fromClosingQty: string;
  toClosingQty: string;
  fromUsedQty: string;
  toUsedQty: string;
  reason: CorrectionReason;
  note: string | null;
}

/** Used today = opening + received − waste − closing. The `*ValueKes` fields and `unitCostKes` are cap `catalog.see_costs`. */
export interface FigureLine {
  itemId: string;
  itemName: string;
  unit: string;
  openingQty: string;
  receivedQty: string;
  wasteQty: string;
  closingQty: string | null;
  usedQty: string | null;
  yesterdayUsedQty: string | null;
  unitCostKes?: string;
  usedValueKes?: string | null;
  closingValueKes?: string | null;
  correction: LineCorrection | null;
}

export interface DepartmentTile {
  departmentId: string;
  name: string;
  head: Person | null;
  state: CountState;
  countedAt: string | null;
  countedBy: Person | null;
  onBehalf: boolean;
  itemCount: number;
  opening: { state: OpeningState; differences: OpeningDifference[] };
  /** cap catalog.see_costs; null until the department has counted. */
  usedValueKes?: string | null;
}

/** Facts only; the title and line come from the wording table by `kind`. */
export interface Blocker {
  kind: BlockerKind;
  severity: BlockerSeverity;
  department: DepartmentRef | null;
  dispatch: { id: string; reference: string; signedAt: string } | null;
  discrepancies: { id: string; reference: string }[];
  at: string | null;
  lastDepartment: DepartmentRef | null;
}

export interface DayHead {
  id: string;
  reference: string;
  date: string;
  status: DayStatus;
}

// --- BD1 GET /home (B0, B4) ------------------------------------------------------------

/** No query: the caller's own department (a person belongs to one). */
export interface Home {
  day: DayHead;
  branch: BranchRef;
  department: DepartmentRef;
  itemCount: number;
  opening: OpeningCheck;
  delivery: DeliveryFact;
  count: { state: CountState; signedAt: string | null; signedBy: Person | null; onBehalf: boolean };
  closed: { at: string | null };
  action: HomeAction;
}

// --- BD2 to BD5 the opening (B1, B2, B2b) ----------------------------------------------------

export interface OpeningQuery {
  departmentId?: string;
}
export interface OpeningLine {
  itemId: string;
  itemName: string;
  unit: string;
  lastNightQty: string;
  acceptedQty: string | null;
}
export interface OpeningView {
  day: DayHead;
  department: DepartmentRef;
  itemCount: number;
  lastCloseAt: string | null;
  check: OpeningCheck;
  lines: OpeningLine[];
}
export interface AcceptOpeningInput {
  departmentId?: string;
  idempotencyKey: string;
}
export interface OpeningResult {
  view: OpeningView;
  replayed: boolean;
}
export interface CountedLineInput {
  itemId: string;
  countedQty: string;
}
export interface RecountPreviewInput {
  departmentId?: string;
  lines: CountedLineInput[];
}
export interface RecountPreview {
  itemCount: number;
  matchedItems: string[];
  differences: OpeningDifference[];
}
export interface RecountOpeningInput {
  departmentId?: string;
  lines: CountedLineInput[];
  pin: string;
  idempotencyKey: string;
}

// --- BD6 to BD8 the blind evening count (B3, B3b, B3c, B15) --------------------------------------

export interface CountQuery {
  departmentId?: string;
}
export interface CountLine {
  itemId: string;
  itemName: string;
  unit: string;
  categoryPath: string[];
  countedQty: string | null;
}
export interface CountView {
  day: DayHead;
  department: DepartmentRef;
  /** The Branch Manager is counting and will sign "on behalf of the department". */
  onBehalfOfDepartment: boolean;
  state: CountState;
  lines: CountLine[];
  summary: { itemCount: number; filledCount: number; blankCount: number; groups: { name: string; itemCount: number }[] };
  canSign: boolean;
  signedAt: string | null;
  signedBy: Person | null;
}
export interface SaveCountInput {
  departmentId?: string;
  lines: { itemId: string; countedQty: string | null }[];
}
export interface SaveCountResult {
  savedAt: string;
  view: CountView;
}
export interface SignCountInput {
  departmentId?: string;
  pin: string;
  idempotencyKey: string;
}
export interface SignCountResult {
  view: CountView;
  signedAt: string;
  onBehalf: boolean;
  replayed: boolean;
}

// --- BD9, BD10 the head's past days (chapter 5, steps 19 and 20) ------------------------------------

export interface MyHistoryQuery extends PageQuery {
  from?: string;
  to?: string;
  status?: 'CLOSED' | 'CORRECTED';
}
export interface MyHistoryRow {
  id: string;
  reference: string;
  date: string;
  status: 'CLOSED' | 'CORRECTED';
  itemsCounted: number;
  signedAt: string;
  correctedCount: number;
}
export interface MyHistory {
  department: DepartmentRef;
  head: Person | null;
  rows: MyHistoryRow[];
  page: PageInfo;
}
export interface MyDayLine {
  itemName: string;
  unit: string;
  openingQty: string;
  receivedQty: string;
  wasteQty: string;
  closingQty: string;
  usedQty: string;
}
export interface MyDay {
  day: DayHead;
  department: DepartmentRef;
  signedAt: string;
  lines: MyDayLine[];
}

// --- BD11 GET /today (B5, B7, B9, B14, B16) --------------------------------------------------------

export interface TodayQuery {
  branchId?: string;
}
export interface Today {
  branch: BranchRef;
  /** The picker's options for a hub role; absent for the Branch Manager. */
  branches?: BranchRef[];
  /** Null when nobody has opened today for this branch yet. */
  day: {
    head: DayHead;
    departments: DepartmentTile[];
    blockers: Blocker[];
    summary: { todo: number; toKnow: number };
    canClose: boolean;
    usedValueKes?: string | null;
    closed: { at: string; by: Person; entryCount: number; entries: LedgerEntry[] } | null;
  } | null;
  can: { close: boolean; countOnBehalf: boolean };
}

// --- BD12 GET /days/:id/departments/:departmentId (B6, B11 Items) ----------------------------------

export interface DepartmentFigures {
  day: DayHead;
  branch: BranchRef;
  rail: DepartmentTile[];
  branchUsedValueKes?: string | null;
  department: {
    id: string;
    name: string;
    state: CountState;
    countedAt: string | null;
    countedBy: Person | null;
    onBehalf: boolean;
    opening: OpeningCheck;
    delivery: DeliveryFact;
    lines: FigureLine[];
    waste: { entryCount: number; items: { itemName: string; reasonText: string }[] };
    totals?: { usedValueKes: string | null; closingValueKes: string | null };
    can: { correct: boolean };
  };
}

// --- BD13, BD14 close the day (B8, B9) -------------------------------------------------------------

export interface CloseSummary {
  day: DayHead;
  branch: BranchRef;
  usedValueKes: string;
  departments: { departmentId: string; name: string; itemCount: number; usedValueKes: string }[];
  entryCount: number;
  canClose: boolean;
  blockers: Blocker[];
}
export interface CloseDayInput {
  pin: string;
  idempotencyKey: string;
}
export interface CloseDayResult {
  day: DayHead;
  closedAt: string;
  closedBy: Person;
  usedValueKes: string;
  entryCount: number;
  entries: LedgerEntry[];
  document: DayDocument;
  replayed: boolean;
}

// --- BD15 GET /history (B10, B10b, B10c) ------------------------------------------------------------

export interface HistoryQuery extends PageQuery {
  branchId?: string;
  q?: string;
  from?: string;
  to?: string;
  status?: DayStatus;
}
export interface HistoryRow {
  id: string;
  reference: string;
  date: string;
  branch: BranchRef;
  departmentsCounted: number;
  departmentsTotal: number;
  status: DayStatus;
  closedBy: Person | null;
  closedAt: string | null;
  usedValueKes?: string | null;
  closingValueKes?: string | null;
}
export interface History {
  rows: HistoryRow[];
  branches?: BranchRef[];
  page: PageInfo;
}

// --- BD16 to BD19 the day file (B11, B12b, B13) -------------------------------------------------------

export interface DayFile {
  day: DayHead;
  branch: BranchRef;
  tracker: {
    openingsChecked: { checked: number; total: number };
    counted: { counted: number; total: number; lastAt: string | null };
    closed: { at: string | null; by: Person | null };
  };
  rail: DepartmentTile[];
  tabCounts: { documents: number; activity: number };
  usedValueKes?: string | null;
  lastCorrection: { at: string; itemName: string; departmentName: string; fromClosingQty: string; toClosingQty: string } | null;
  can: { correct: boolean; print: boolean };
}
export interface ActivityQuery {
  limit?: number;
}
export interface DayActivityEntry {
  id: string;
  at: string;
  actor: Person;
  type: DayActivityType;
  sentence: string;
  detail: string | null;
  link: { kind: 'DAY' | 'LEDGER_ENTRY'; id: string; reference: string | null } | null;
}
export interface DayActivity {
  entries: DayActivityEntry[];
  total: number;
}
export interface DayDocuments {
  documents: DayDocument[];
}
export type EntriesQuery = PageQuery;
export interface DayEntries {
  rows: LedgerEntry[];
  page: PageInfo;
}

// --- BD20 POST /days/:id/corrections (B12, B12b) -------------------------------------------------------

export interface CorrectCountInput {
  departmentId: string;
  itemId: string;
  closingQty: string;
  reason: CorrectionReason;
  note?: string;
  pin: string;
  idempotencyKey: string;
}
export interface CorrectCountResult {
  day: DayHead;
  line: FigureLine;
  entry: LedgerEntry;
  document: DayDocument;
  usedValueKes: string;
  replayed: boolean;
}

// --- BD21 GET /days/:id/sheet (B13b, B13c, B13d) ------------------------------------------------------

export interface SheetQuery {
  version?: number;
}
/** Rows of one department's figures per A4 page; the cover is page 1 (same constant as the back end). */
export const SHEET_ROWS_PER_PAGE = 16;
export interface SheetLine {
  position: number;
  itemName: string;
  unit: string;
  openingQty: string;
  receivedQty: string;
  wasteQty: string;
  closingQty: string;
  usedQty: string;
  usedValueKes: string;
  closingValueKes: string;
  correction: LineCorrection | null;
}
export interface SheetDepartment {
  position: number;
  department: DepartmentRef;
  head: Person | null;
  itemCount: number;
  usedValueKes: string;
  closingValueKes: string;
  page: number;
  corrected: boolean;
  countedAt: string;
  countedBy: Person;
  onBehalf: boolean;
  opening: { state: OpeningState; checkedAt: string | null; differenceCount: number };
  delivery: { state: DeliveryState; dispatches: string[] };
  lines: SheetLine[];
}
export interface DaySheet {
  reference: string;
  date: string;
  branch: { id: string; name: string; code: string | null; address: string | null; phone: string | null };
  version: number;
  kind: SheetKind;
  closedAt: string;
  closedBy: Person;
  correctedAt: string | null;
  printedAt: string;
  totals: { itemCount: number; usedValueKes: string; closingValueKes: string };
  pageCount: number;
  departments: SheetDepartment[];
  corrections: { at: string; by: Person; departmentName: string; itemName: string; fromClosingQty: string; toClosingQty: string; reason: CorrectionReason }[];
  notes: { openingNotChecked: string[]; openDiscrepancies: { reference: string; departmentName: string; itemName: string }[] };
  qrUrl: string;
}

// --- Errors ------------------------------------------------------------------------------------------------

export const BRANCH_DAY_ERROR_CODES = [
  'INVALID_PIN',
  'NOT_YOUR_DEPARTMENT',
  'NOT_YOUR_BRANCH',
  'DAY_ALREADY_CLOSED',
  'DAY_NOT_READY',
  'DAY_NOT_CLOSED',
  'ALREADY_COUNTED',
  'COUNT_INCOMPLETE',
  'OPENING_ALREADY_CHECKED',
  'ITEM_NOT_IN_DAY',
  'DEPARTMENT_NOT_COUNTED',
  'CORRECTION_WINDOW_PASSED',
  'CORRECTION_NO_CHANGE',
  'NO_DEPARTMENTS',
] as const;
export type BranchDayErrorCode = (typeof BRANCH_DAY_ERROR_CODES)[number];

/** Keys a department head or member must never receive from any endpoint (money). */
export const DAY_MONEY_KEYS = ['usedValueKes', 'closingValueKes', 'unitCostKes', 'branchUsedValueKes', 'totals'] as const;
/** Keys the head's blind evening count must not carry: nothing to count against. */
export const DAY_COUNT_BLIND_KEYS = ['openingQty', 'receivedQty', 'wasteQty', 'usedQty', 'yesterdayUsedQty', 'lastNightQty', 'expectedQty', 'acceptedQty'] as const;
