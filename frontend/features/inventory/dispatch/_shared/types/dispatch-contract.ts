/**
 * Inventory: Dispatch, deliveries and discrepancies (Block 2), the DISPATCH half. FROZEN API CONTRACT, front-end mirror.
 *
 * Hand-written mirror of `backend/src/modules/inventory/dispatch/_shared/dispatch-contract.ts` (P1 to P10; carriers included).
 * Source of truth: docs/features/inventory/dispatch-contract.md. The screens read the `can` flags and test whether a key is present
 * (money, the sent figure), never a role name. A field marked "cap" is ABSENT, never null, without the capability; `sentQty` and
 * `gapQty` are ABSENT while `sentVisible` is false (a branch-side caller before the department has signed its count).
 *
 * The back end returns facts and keys; titles, bodies and labels are written by the front ends from Paper (D21 and the States kit).
 * `DISPATCH_STAGE_TEXT` is only the state names D21 draws.
 *
 * The old `dispatch/types` (Milestone Five) is not touched here; it is deleted when the old screens are replaced, and the barrel
 * `dispatch/index.ts` does not export this mirror until then.
 */
import type { PageInfo, PageQuery, Person } from '../../../_shared/types/wire';
import type { BranchRef, RequisitionCycle } from '../../../requisitions/_shared/types/requisitions-contract';

export type { BranchRef, ErrorBody, RequisitionCycle } from '../../../requisitions/_shared/types/requisitions-contract';

// --- Words and enums -----------------------------------------------------------

export type DispatchStatus = 'TO_PACK' | 'PACKING' | 'ON_THE_WAY' | 'CONFIRMED' | 'CLOSED' | 'CANCELLED';
export const DISPATCH_STATUSES: readonly DispatchStatus[] = ['TO_PACK', 'PACKING', 'ON_THE_WAY', 'CONFIRMED', 'CLOSED', 'CANCELLED'];

/** Derived: READY_TO_SEND (every department packed, not signed), WAITING_FOR_BRANCH (2 hours, nobody counted), GAP_HELD (confirmed, a discrepancy still OPEN). */
export type DispatchStage =
  | 'TO_PACK'
  | 'PACKING'
  | 'READY_TO_SEND'
  | 'ON_THE_WAY'
  | 'WAITING_FOR_BRANCH'
  | 'CONFIRMED'
  | 'GAP_HELD'
  | 'CLOSED'
  | 'CANCELLED';
export const DISPATCH_STAGES: readonly DispatchStage[] = [
  'TO_PACK',
  'PACKING',
  'READY_TO_SEND',
  'ON_THE_WAY',
  'WAITING_FOR_BRANCH',
  'CONFIRMED',
  'GAP_HELD',
  'CLOSED',
  'CANCELLED',
];
/** The state names of Paper D21 ("One file, eight states"). */
export const DISPATCH_STAGE_TEXT: Record<DispatchStage, string> = {
  TO_PACK: 'To pack',
  PACKING: 'Packing',
  READY_TO_SEND: 'Ready to send',
  ON_THE_WAY: 'On the way',
  WAITING_FOR_BRANCH: 'Waiting for the branch',
  CONFIRMED: 'Confirmed',
  GAP_HELD: 'Gap held',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
};

/** The one main button of a state (Paper D21 "Main button"). */
export type DispatchAction =
  | 'PACK'
  | 'DONE_WITH_DEPARTMENT'
  | 'SIGN_AND_SEND'
  | 'COUNT_THE_DELIVERY'
  | 'CONFIRM_FOR_DEPARTMENT'
  | 'RECORD_A_FINDING'
  | 'PRINT'
  | 'PACK_AGAIN';
export const DISPATCH_ACTIONS: readonly DispatchAction[] = [
  'PACK',
  'DONE_WITH_DEPARTMENT',
  'SIGN_AND_SEND',
  'COUNT_THE_DELIVERY',
  'CONFIRM_FOR_DEPARTMENT',
  'RECORD_A_FINDING',
  'PRINT',
  'PACK_AGAIN',
];

/** G2 chips and the `result` filter (Amendment 1 row 10). */
export type DeliveryResult = 'MATCHED' | 'GAP_OPEN' | 'GAP_RESOLVED';
export const DELIVERY_RESULTS: readonly DeliveryResult[] = ['MATCHED', 'GAP_OPEN', 'GAP_RESOLVED'];

/** The result chip of a row on the Attendant's Done tab (G3). Null on the On the way tab. */
export type DispatchDoneResult = 'CONFIRMED' | 'GAP_FOUND' | 'GAP_SETTLED' | 'CANCELLED';
export const DISPATCH_DONE_RESULTS: readonly DispatchDoneResult[] = ['CONFIRMED', 'GAP_FOUND', 'GAP_SETTLED', 'CANCELLED'];

/** Fixed constants, not settings: the 2-hour wait runs from `signedAt`; the amber "Waiting" chip on D1 starts at 20 minutes. */
export const WAITING_FOR_BRANCH_AFTER_HOURS = 2;
export const PACK_WAITING_CHIP_AFTER_MINUTES = 20;

/** Socket event per record (Amendment 1 row 16); `inventory:badges` also carries `dispatch` and `deliveries` counts. */
export const DISPATCH_CHANGED_EVENT = 'dispatch:changed';
export interface DispatchChangedPayload {
  id: string;
  reference: string | null;
  siteId: string;
  reason: string;
}

export type DispatchEventType =
  | 'SIGNED_AND_SENT'
  | 'CANCELLED'
  | 'DELIVERY_CONFIRMED'
  | 'DELIVERY_CONFIRMED_ON_BEHALF'
  | 'DISCREPANCY_OPENED'
  | 'FINDING_RECORDED'
  | 'FINDING_REVERSED'
  | 'CLOSED';
export const DISPATCH_EVENT_TYPES: readonly DispatchEventType[] = [
  'SIGNED_AND_SENT',
  'CANCELLED',
  'DELIVERY_CONFIRMED',
  'DELIVERY_CONFIRMED_ON_BEHALF',
  'DISCREPANCY_OPENED',
  'FINDING_RECORDED',
  'FINDING_REVERSED',
  'CLOSED',
];

// --- Shared pieces ---------------------------------------------------------------

export interface DepartmentRef {
  id: string;
  name: string;
}

/** Who did a thing and when. */
export interface Stamp {
  by: Person;
  at: string;
}

/** `COMPANY` is "Courier company" (Amendment 1 row 4). */
export type CarrierKind = 'PERSON' | 'VEHICLE' | 'COMPANY';
export const CARRIER_KINDS: readonly CarrierKind[] = ['PERSON', 'VEHICLE', 'COMPANY'];
export interface CarrierRef {
  id: string;
  name: string;
  kind: CarrierKind;
}
/** D18. */
export interface Carrier extends CarrierRef {
  active: boolean;
  retiredAt: string | null;
  /** Dispatches signed with this carrier since the 1st (Nairobi). */
  deliveriesThisMonth: number;
}

/** Up to 3 photos per line, 5 MB each, JPEG, PNG or WebP, kept in the new `DispatchPhoto` table (Amendment 1 row 6). */
export const PHOTO_MAX_PER_LINE = 3;
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type PhotoMimeType = (typeof PHOTO_MIME_TYPES)[number];
/** `url` is an AUTHENTICATED link: load it with the caller's token. */
export interface PhotoRef {
  id: string;
  url: string;
}

/** D10 chips. */
export type CountReason = 'NOT_IN_THE_BOX' | 'DAMAGED' | 'WRONG_ITEM' | 'OTHER';
export const COUNT_REASONS: readonly CountReason[] = ['NOT_IN_THE_BOX', 'DAMAGED', 'WRONG_ITEM', 'OTHER'];
export const COUNT_REASON_TEXT: Record<CountReason, string> = {
  NOT_IN_THE_BOX: 'Not in the box',
  DAMAGED: 'Damaged',
  WRONG_ITEM: 'Wrong item',
  OTHER: 'Other',
};

export interface RecordLink {
  kind: 'REQUISITION' | 'DISPATCH' | 'DISCREPANCY';
  id: string;
  reference: string;
}

export interface DispatchActivityEvent {
  id: string;
  type: DispatchEventType;
  at: string;
  actor: Person;
  sentence: string;
  link: RecordLink | null;
  reason: string | null;
}

// --- P1 GET /dispatch/queue (D1) --------------------------------------------------

export type PackDepartmentState = 'TO_PACK' | 'PACKING' | 'PACKED';
export interface QueueCard {
  requisitionId: string;
  reference: string;
  branch: BranchRef;
  cycle: RequisitionCycle;
  cycleLabel: string;
  /** The wait ("Waiting 29 min") runs from here. */
  approvedAt: string;
  lineCount: number;
  departments: {
    departmentId: string;
    departmentName: string;
    lineCount: number;
    packedCount: number;
    state: PackDepartmentState;
  }[];
}
export interface Queue {
  cards: QueueCard[];
  /** The sidebar badge: branches to pack. */
  branchesToPack: number;
}

// --- P2 GET /dispatch/pack/:requisitionId/departments/:departmentId (D2, D3) --------

export interface PackLine {
  lineId: string;
  itemId: string;
  itemName: string;
  unit: string;
  categoryPath: string[];
  requestedQty: string;
  /** In store now. Quantities including on hand, never money. */
  onHand: string;
  sentQty: string;
  packedTick: boolean;
  short: boolean;
  addedAfterApproval: boolean;
}
export interface PackDepartment {
  requisitionId: string;
  reference: string;
  branch: BranchRef;
  department: DepartmentRef;
  /** "Department 1 of 5". */
  position: { index: number; total: number };
  lineCount: number;
  packedCount: number;
  state: PackDepartmentState;
  lines: PackLine[];
  nextDepartmentId: string | null;
  allPacked: boolean;
  /** "Go to the final review" works once at least one department is fully ticked (Amendment 1 row 2). */
  canReview: boolean;
}

/** P3. Last write wins. The response is the updated `PackDepartment`. */
export interface SavePackLinesInput {
  lines: { lineId: string; sentQty: string; packedTick: boolean }[];
}

// --- P4 GET /dispatch/pack/:requisitionId/review (D4, D5, D5b) --------------------------

export interface ReviewDepartment {
  departmentId: string;
  departmentName: string;
  lineCount: number;
  /** Not every line ticked: "Not ready · stays in To pack", no action. */
  allTicked: boolean;
  /** A fully ticked department has "Leave out" (undo until signed). */
  canLeaveOut: boolean;
  shortCount: number;
  shortLines: { itemName: string; unit: string; requestedQty: string; sentQty: string }[];
}
export interface ReviewLine {
  departmentId: string;
  lineId: string;
  itemName: string;
  unit: string;
  requestedQty: string;
  sentQty: string;
  short: boolean;
}
export interface Review {
  requisitionId: string;
  reference: string;
  branch: BranchRef;
  cycleLabel: string;
  lineCount: number;
  shortCount: number;
  departments: ReviewDepartment[];
  lines: ReviewLine[];
  packedBy: Person;
  signedBy: Person;
  carriers: CarrierRef[];
  canSign: boolean;
}

// --- P5 POST /dispatch/pack/:requisitionId/sign (D5, D6) -----------------------------------

export interface SignDispatchInput {
  carrierId: string;
  pin: string;
  idempotencyKey: string;
  /** Departments left out stay in To pack and ship later with their own short review and signature. */
  leaveOut?: string[];
}
export interface SignDispatchResult {
  requisitionId: string;
  reference: string;
  branch: BranchRef;
  signedAt: string;
  packedBy: Person;
  signedBy: Person;
  carrier: CarrierRef;
  sendBatchId: string;
  dispatches: { id: string; reference: string; departmentId: string; departmentName: string; lineCount: number; shortCount: number }[];
  leftOut: DepartmentRef[];
  lineCount: number;
  shortCount: number;
  /** D6 "4 of 5 departments sent. Pastry is still to pack." */
  sentDepartments: number;
  totalDepartments: number;
  replayed: boolean;
}

// --- P6 GET /dispatch/:id the dispatch file (D13) --------------------------------------------

export interface TrackerStep {
  key: 'APPROVED' | 'PACKED' | 'ON_THE_WAY' | 'COUNTED' | 'CLOSED';
  state: 'DONE' | 'CURRENT' | 'TODO';
  at: string | null;
  by: Person | null;
  carrier: CarrierRef | null;
}

export interface DispatchItem {
  lineId: string;
  itemId: string;
  itemName: string;
  unit: string;
  categoryPath: string[];
  requestedQty: string;
  /** ABSENT while `sentVisible` is false. */
  sentQty?: string;
  countedQty: string | null;
  /** counted − sent, signed; ABSENT with `sentQty`, null until counted. */
  gapQty?: string | null;
  countedTwice: boolean;
  countReason: CountReason | null;
  countReasonNote: string | null;
  photos: PhotoRef[];
  discrepancy: { id: string; reference: string; status: 'OPEN' | 'RECORDED' | 'REVERSED' } | null;
  /** cap requisitions.see_value: cost frozen at dispatch, KES per unit. */
  unitCostKes?: string;
  /** cap requisitions.see_value, and ABSENT while `sentVisible` is false. */
  valueKes?: string;
}

export interface DispatchDocument {
  id: string;
  kind: 'DELIVERY_NOTE_STORE' | 'DELIVERY_NOTE_BRANCH';
  at: string;
  by: Person;
  voided: boolean;
}

export interface DispatchFile {
  id: string;
  reference: string;
  requisition: { id: string; reference: string };
  branch: BranchRef;
  department: DepartmentRef;
  status: DispatchStatus;
  stage: DispatchStage;
  lineCount: number;
  shortCount: number;
  carrier: CarrierRef;
  packed: Stamp;
  signed: Stamp;
  sendBatchId: string;
  /** Amendment 1 row 10: the flat moments and people the file also carries (the stamps hold the same as objects). */
  packedAt: string;
  /** Stamped the first time anyone from the department opens the delivery; information only. Null: the card reads "On the way". */
  arrivedAt: string | null;
  countedById: string | null;
  countedAt: string | null;
  /** The Branch Manager signed for the department. */
  onBehalf: boolean;
  /** cap requisitions.see_value: value written off by a recorded finding at the cost frozen at dispatch; absent while `sentVisible` is false. */
  lossValueKes?: string;
  counted: Stamp | null;
  onBehalfOfDepartment: DepartmentRef | null;
  cancelled: { at: string; by: Person; reason: string } | null;
  closedAt: string | null;
  siblings: { id: string; reference: string; departmentName: string; stage: DispatchStage }[];
  tracker: TrackerStep[];
  nextStep: {
    action: DispatchAction | null;
    facts: { gapLineCount: number; discrepancyId: string | null; waitingSince: string | null };
  };
  /** false = `sentQty`, `gapQty` and every `valueKes` are absent (a branch-side caller before the count is signed). */
  sentVisible: boolean;
  items: DispatchItem[];
  documents: DispatchDocument[];
  activity: DispatchActivityEvent[];
  /** cap requisitions.see_value, and ABSENT while `sentVisible` is false. */
  valueKes?: string;
  can: { print: boolean; cancel: boolean; recordFinding: boolean; confirmForDepartment: boolean };
}

// --- P7 GET /dispatch/:id/print?copy=store|branch (D17, D17b) ------------------------------------

export type DeliveryNoteCopy = 'store' | 'branch';
export const DELIVERY_NOTE_COPIES: readonly DeliveryNoteCopy[] = ['store', 'branch'];
export interface PrintDispatchQuery {
  copy: DeliveryNoteCopy;
}
interface PrintHeader {
  reference: string;
  voided: boolean;
  /** The "VOID · cancelled {date}" band. Null unless voided. */
  cancelledAt: string | null;
  requisitionReference: string;
  branch: BranchRef;
  department: DepartmentRef;
  /** YYYY-MM-DD, Nairobi. */
  date: string;
  carrier: CarrierRef;
  packed: Stamp;
  signed: Stamp;
  generatedAt: string;
  qrPayload: string;
}
/** Asked and sent quantities, no money. */
export interface PrintStore extends PrintHeader {
  copy: 'store';
  lines: { n: number; itemName: string; unit: string; requestedQty: string; sentQty: string }[];
}
/** NO quantities: the screen draws a blank "Your count" column. */
export interface PrintBranch extends PrintHeader {
  copy: 'branch';
  lines: { n: number; itemName: string; unit: string }[];
}
export type PrintDispatch = PrintStore | PrintBranch;

// --- P8 POST /dispatch/:id/cancel (D20) ----------------------------------------------------------------

export const DISPATCH_CANCEL_REASON_MAX = 300;
/** The reason is "preset — note" (Amendment 1 row 8). `Other` needs a note; the others may carry one. */
export const DISPATCH_CANCEL_PRESETS = ['Packed the wrong lines', 'Branch asked us to stop', 'Vehicle did not leave', 'Other'] as const;
export type DispatchCancelPreset = (typeof DISPATCH_CANCEL_PRESETS)[number];
export const DISPATCH_CANCEL_REASON_SEPARATOR = ' — ';
/** Splits a reason into its preset and note; null when it does not start with a preset. */
export const parseDispatchCancelReason = (reason: string): { preset: DispatchCancelPreset; note: string } | null => {
  for (const preset of DISPATCH_CANCEL_PRESETS) {
    if (reason === preset) return { preset, note: '' };
    if (reason.startsWith(preset + DISPATCH_CANCEL_REASON_SEPARATOR)) return { preset, note: reason.slice(preset.length + DISPATCH_CANCEL_REASON_SEPARATOR.length).trim() };
  }
  return null;
};
export interface CancelDispatchInput {
  reason: string;
  pin: string;
  /** A repeated key returns the first result. */
  idempotencyKey: string;
}
export interface CancelDispatchResult {
  id: string;
  reference: string;
  status: 'CANCELLED';
  cancelledAt: string;
  cancelledBy: Person;
  linesReturnedToQueue: number;
  replayed: boolean;
}

// --- P9 GET /dispatch/mine (G3) -------------------------------------------------------------------------

export type DispatchMineTab = 'on-the-way' | 'done';
export interface DispatchMineQuery extends PageQuery {
  tab?: DispatchMineTab;
  from?: string;
  to?: string;
  branchId?: string;
}
export interface DispatchMineRow {
  id: string;
  reference: string;
  branch: BranchRef;
  department: DepartmentRef;
  /** N2 draws "REQ-NYR-0112 · Afternoon" above the rows sent together. */
  requisition: { id: string; reference: string; cycle: RequisitionCycle; cycleLabel: string };
  carrier: CarrierRef | null;
  lineCount: number;
  signedAt: string;
  stage: DispatchStage;
  result: DispatchDoneResult | null;
}
export interface DispatchMine {
  tab: DispatchMineTab;
  rows: DispatchMineRow[];
  tabCounts: { 'on-the-way': number; done: number };
  page: PageInfo;
}

// --- P10 /carriers (D18) -----------------------------------------------------------------------------------

export type CarrierStatusFilter = 'active' | 'retired' | 'all';
export interface ListCarriersQuery {
  status?: CarrierStatusFilter;
}
export interface ListCarriers {
  carriers: Carrier[];
  can: { manage: boolean };
}
export const CARRIER_NAME_MAX = 80;
export interface AddCarrierInput {
  name: string;
  kind: CarrierKind;
}
/** A rename, or retire (`active: false`), or restore (`active: true`), never both. The response is the `Carrier`. */
export interface UpdateCarrierInput {
  name?: string;
  active?: boolean;
}

// --- Errors ---------------------------------------------------------------------------------------------------

export const DISPATCH_ERROR_CODES = [
  'NOT_ALL_PACKED',
  'INVALID_PIN',
  'CARRIER_INACTIVE',
  'NOTHING_TO_SEND',
  'REQUISITION_NOT_APPROVED',
  'OVER_REQUESTED',
  'NOT_SIGNED',
  // Amendment 1 row 11
  'ALREADY_SIGNED',
  'STOCK_CHANGED',
  'DISPATCH_ALREADY_COUNTED',
  'DISPATCH_CANCELLED',
  'CARRIER_NAME_TAKEN',
  'NOT_YOUR_DEPARTMENT',
] as const;
export type DispatchErrorCode = (typeof DISPATCH_ERROR_CODES)[number];
