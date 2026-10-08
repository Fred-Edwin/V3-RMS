/**
 * Inventory: Requisitions rebuild (Block 1). FROZEN API CONTRACT, front-end mirror.
 *
 * Hand-written mirror of `backend/src/modules/inventory/requisitions/_shared/requisitions-contract.ts` (R1 to R22).
 * Source of truth: docs/features/inventory/requisitions-contract.md. The screens read the `can` flags and test whether a
 * key is present (money, stock figures), never a role name. A field marked "cap" is ABSENT, never null, without the capability.
 * Status names are the database enum names; `statusText` carries the words.
 *
 * The old `requisitions/types` (Milestone Four) is not touched here; it is deleted when the old screens are replaced.
 */
import type { PageInfo, PageQuery, Person } from '../../../_shared/types/wire';

export const IDEMPOTENCY_HEADER = 'Idempotency-Key';

export type RequisitionCycle = 'MORNING' | 'AFTERNOON' | 'EXTRA';
export const REQUISITION_CYCLES: readonly RequisitionCycle[] = ['MORNING', 'AFTERNOON', 'EXTRA'];
export const CYCLE_TEXT: Record<RequisitionCycle, string> = { MORNING: 'Morning', AFTERNOON: 'Afternoon', EXTRA: 'Extra' };

/** OPEN = Collecting, PENDING_APPROVAL = Ready to approve. */
export type RequisitionStatus = 'OPEN' | 'PENDING_APPROVAL' | 'APPROVED' | 'CANCELLED' | 'CLOSED';
export const REQUISITION_STATUSES: readonly RequisitionStatus[] = ['OPEN', 'PENDING_APPROVAL', 'APPROVED', 'CANCELLED', 'CLOSED'];
export const REQUISITION_STATUS_TEXT: Record<RequisitionStatus, string> = {
  OPEN: 'Collecting',
  PENDING_APPROVAL: 'Ready to approve',
  APPROVED: 'Approved',
  CANCELLED: 'Cancelled',
  CLOSED: 'Closed',
};

/** SUBMITTED is shown as "Sent". */
export type SectionStatus = 'NOT_STARTED' | 'DRAFT' | 'SUBMITTED' | 'SKIPPED';
export const SECTION_STATUSES: readonly SectionStatus[] = ['NOT_STARTED', 'DRAFT', 'SUBMITTED', 'SKIPPED'];
export const SECTION_STATUS_TEXT: Record<SectionStatus, string> = {
  NOT_STARTED: 'Not started',
  DRAFT: 'Draft',
  SUBMITTED: 'Sent',
  SKIPPED: 'Sent without this section',
};

export type AdditionStatus = 'PENDING' | 'APPROVED' | 'CANCELLED';

export type RequisitionTab = 'collecting' | 'to-approve' | 'to-pack' | 'on-the-way' | 'to-confirm' | 'discrepancies' | 'closed';
export const REQUISITION_TABS: readonly RequisitionTab[] = ['collecting', 'to-approve', 'to-pack', 'on-the-way', 'to-confirm', 'discrepancies', 'closed'];
export type TabCounts = Record<RequisitionTab, number>;

export type EventType =
  | 'STARTED'
  | 'LINE_CHANGED'
  | 'SENT'
  | 'RECALLED'
  | 'QUANTITY_CHANGED'
  | 'SKIPPED'
  | 'NUDGED'
  | 'URGENT_SET'
  | 'URGENT_CLEARED'
  | 'APPROVED'
  | 'CANCELLED'
  | 'ADDITION_ADDED'
  | 'ADDITION_APPROVED';

export type NextStepAction = 'SEND_SECTION' | 'NUDGE' | 'APPROVE_AND_SIGN' | 'ADD_TO_THIS_REQUISITION' | 'APPROVE_ADDITION' | 'PRINT' | 'START_A_NEW_ONE';

export interface BranchRef {
  id: string;
  name: string;
  /** "NYR" */
  code: string | null;
}

export interface RequisitionLine {
  id: string;
  itemId: string;
  itemName: string;
  unit: string;
  /** From the top: ["Dairy"], or two levels for Kitchen: ["Proteins", "Chicken"]. */
  categoryPath: string[];
  requestedQty: string;
  /** Null until the Branch Manager approves or edits. */
  approvedQty: string | null;
  /** What the screen pre-filled (restock level minus on hand). Null for a line the head added. */
  suggestedQty: string | null;
  /** cap restock.read, or the head of this department. */
  onHand?: string;
  /** cap restock.read, or the head of this department. */
  level?: string;
  changedFromSuggested: boolean;
  changedByManager: boolean;
  changeReason: string | null;
  additionId: string | null;
  /** cap requisitions.see_value */
  valueKes?: string;
}

export interface SectionSummary {
  departmentId: string;
  departmentName: string;
  status: SectionStatus;
  statusText: string;
  head: Person | null;
  sentAt: string | null;
  sentBy: Person | null;
  skippedAt: string | null;
  skippedBy: Person | null;
  lineCount: number;
  changedCount: number;
  /** cap requisitions.see_value */
  valueKes?: string;
}

export interface SectionDetail extends SectionSummary {
  noteForManager: string | null;
  lines: RequisitionLine[];
  can: { edit: boolean; send: boolean; recall: boolean; nudge: boolean; skip: boolean; fillMyself: boolean; changeQuantity: boolean };
}

export interface Addition {
  id: string;
  departmentId: string;
  departmentName: string;
  status: AdditionStatus;
  statusText: string;
  addedBy: Person;
  addedAt: string;
  approvedBy: Person | null;
  approvedAt: string | null;
  lines: RequisitionLine[];
  /** cap requisitions.see_value */
  valueKes?: string;
  can: { approve: boolean };
}

export interface TrackerStep {
  key: 'STARTED' | 'ALL_IN' | 'APPROVED' | 'PACKED' | 'DELIVERED' | 'CLOSED';
  label: string;
  state: 'DONE' | 'CURRENT' | 'TODO';
  at: string | null;
  by: Person | null;
}

export interface NextStep {
  title: string;
  text: string | null;
  action: NextStepAction | null;
  actionLabel: string | null;
  departmentId: string | null;
}

/** Empty until Block 2. */
export interface DispatchRef {
  id: string;
  reference: string;
  departmentId: string;
  status: string;
  statusText: string;
}

// --- R1 list ---------------------------------------------------------------------

export interface ListRequisitionsQuery extends PageQuery {
  tab?: RequisitionTab;
  branchId?: string;
  q?: string;
  from?: string;
  to?: string;
  status?: RequisitionStatus;
}

export interface RequisitionRow {
  id: string;
  /** "REQ-NYR-0112" */
  reference: string;
  cycle: RequisitionCycle;
  /** "Afternoon · Wed 7 Oct" */
  cycleLabel: string;
  branch: BranchRef;
  status: RequisitionStatus;
  statusText: string;
  tab: RequisitionTab;
  sections: { departmentId: string; departmentName: string; status: SectionStatus }[];
  lineCount: number;
  /** cap requisitions.see_value */
  valueKes?: string;
  openedAt: string;
  urgent: boolean;
  urgentOverHour: boolean;
  additionWaiting: boolean;
  rowAction: { action: NextStepAction; label: string; departmentId: string | null } | null;
}

export interface ListRequisitions {
  tab: RequisitionTab;
  rows: RequisitionRow[];
  tabCounts: TabCounts;
  /** The dark badge. */
  waitingForYou: number;
  /** Hub roles only. */
  branches?: BranchRef[];
  page: PageInfo;
}

// --- R2 badges ---------------------------------------------------------------------

export interface Badges {
  requisitions: number;
  toApprove?: number;
  toPack?: number;
  deliveries?: number;
}

// --- R3 file --------------------------------------------------------------------------

export interface RequisitionFile {
  id: string;
  reference: string;
  cycle: RequisitionCycle;
  cycleLabel: string;
  branch: BranchRef;
  status: RequisitionStatus;
  statusText: string;
  urgent: boolean;
  urgentAt: string | null;
  urgentOverHour: boolean;
  openedBy: Person;
  openedAt: string;
  approvedBy: Person | null;
  approvedAt: string | null;
  cancelled: { at: string; by: Person; reason: string } | null;
  closedAt: string | null;
  tracker: TrackerStep[];
  nextStep: NextStep;
  /** For a head: their own department only. */
  sections: SectionDetail[];
  additions: Addition[];
  dispatches: DispatchRef[];
  lineCount: number;
  /** cap requisitions.see_value */
  valueKes?: string;
  can: {
    nudge: boolean;
    skip: boolean;
    changeQuantity: boolean;
    approve: boolean;
    cancel: boolean;
    setUrgent: boolean;
    addToIt: boolean;
    print: boolean;
    startNew: boolean;
  };
}

// --- R4 activity, R5 documents ---------------------------------------------------------

export interface ActivityEvent {
  id: string;
  type: EventType;
  at: string;
  actor: Person;
  sentence: string;
  departmentId: string | null;
  lineId: string | null;
  fromValue: string | null;
  toValue: string | null;
  reason: string | null;
  link: { kind: 'REQUISITION' | 'DISPATCH' | 'DISCREPANCY'; id: string; reference: string } | null;
}
export interface Activity {
  events: ActivityEvent[];
}

export interface Documents {
  documents: { id: string; version: number; label: string; at: string; by: Person }[];
}

// --- R6 print (no money anywhere) ---------------------------------------------------------

export interface PrintPageLine {
  n: number;
  itemName: string;
  unit: string;
  requestedQty: string;
  approvedQty: string;
  changed: boolean;
}
export interface Print {
  reference: string;
  branch: BranchRef;
  cycleLabel: string;
  urgent: boolean;
  approvedAt: string | null;
  approvedBy: Person | null;
  cover: {
    departments: { departmentId: string; departmentName: string; lineCount: number; page: number; dispatchReference: string | null }[];
    managerChanges: { departmentName: string; itemName: string; from: string; to: string; reason: string | null }[];
    additionsCount: number;
  };
  pages: {
    departmentId: string;
    departmentName: string;
    lines: PrintPageLine[];
    additions: { addedAt: string; addedBy: Person; approvedBy: Person | null; lines: PrintPageLine[] }[];
  }[];
  qrPayload: string;
}

// --- R7 home, R8 section edit, R9 history ---------------------------------------------------

export interface Home {
  department: { id: string; name: string };
  suggestedCycle: RequisitionCycle;
  open: {
    requisitionId: string;
    reference: string;
    cycle: RequisitionCycle;
    cycleLabel: string;
    status: RequisitionStatus;
    statusText: string;
    urgent: boolean;
    section: SectionSummary;
    can: { edit: boolean; recall: boolean; addToIt: boolean };
  } | null;
  earlierToday: {
    requisitionId: string;
    reference: string;
    cycleLabel: string;
    status: RequisitionStatus;
    statusText: string;
    sectionStatus: SectionStatus;
    lineCount: number;
  }[];
}

export interface AddableItem {
  itemId: string;
  itemName: string;
  unit: string;
  categoryPath: string[];
  suggestedQty: string;
  onHand?: string;
  level?: string;
  inSection: boolean;
}
export interface SectionEdit {
  requisitionId: string;
  reference: string;
  cycleLabel: string;
  requisitionStatus: RequisitionStatus;
  urgent: boolean;
  section: SectionDetail;
  addable: AddableItem[];
}

export interface HistoryMineQuery extends PageQuery {
  from?: string;
  to?: string;
  status?: RequisitionStatus;
}
export interface HistoryMine {
  rows: {
    requisitionId: string;
    reference: string;
    cycleLabel: string;
    status: RequisitionStatus;
    statusText: string;
    sectionStatus: SectionStatus;
    lineCount: number;
    openedAt: string;
  }[];
  page: PageInfo;
}

// --- R10 approve summary -----------------------------------------------------------------------

export interface ApproveSummary {
  requisitionId: string;
  reference: string;
  lineCount: number;
  /** cap requisitions.see_value */
  valueKes?: string;
  departments: { departmentId: string; departmentName: string; status: SectionStatus; lineCount: number; valueKes?: string }[];
  changes: { departmentName: string; itemName: string; from: string; to: string; reason: string | null }[];
  signatureLine: string;
  signingAs: 'BRANCH_MANAGER' | 'DIRECTOR' | 'SYSTEM_ADMIN';
}

// --- Writes -----------------------------------------------------------------------------------------

export interface MutationResult {
  requisitionId: string;
  reference: string;
  status: RequisitionStatus;
  statusText: string;
  /** A repeated Idempotency-Key returned the first result. */
  replayed: boolean;
}

/** R11. The key goes in the body. */
export interface StartRequisitionInput {
  cycle: RequisitionCycle;
  urgent?: boolean;
  idempotencyKey: string;
}
export type StartRequisitionResult = MutationResult;

/** R12. The response is the updated `SectionDetail`. */
export interface SaveLinesInput {
  lines: { itemId: string; requestedQty: string }[];
  noteForManager?: string | null;
}

/** R13. Signing writes take the Idempotency-Key header. */
export interface SendSectionInput {
  pin: string;
}
export interface SendSectionResult extends MutationResult {
  section: SectionSummary;
  readyToApprove: boolean;
}

/** R14, no body. */
export interface RecallSectionResult extends MutationResult {
  section: SectionSummary;
}

/** R15 */
export interface SetUrgentInput {
  urgent: boolean;
}
export interface SetUrgentResult extends MutationResult {
  urgent: boolean;
  urgentAt: string | null;
}

/** R16. `reason` is required after approval. */
export interface ChangeQuantityInput {
  approvedQty: string;
  reason?: string;
}
export interface ChangeQuantityResult extends MutationResult {
  line: RequisitionLine;
  section: SectionSummary;
  /** cap requisitions.see_value */
  valueKes?: string;
}

/** R17, no body. */
export interface NudgeResult extends MutationResult {
  nudgedAt: string;
}

/** R18, no body. */
export interface SkipSectionResult extends MutationResult {
  section: SectionSummary;
  readyToApprove: boolean;
}

/** R19 */
export interface ApproveInput {
  pin: string;
}
export interface ApproveResult extends MutationResult {
  approvedAt: string;
  approvedBy: Person;
  /** cap requisitions.see_value */
  valueKes?: string;
}

/** R20 */
export interface CancelInput {
  reason: string;
  pin: string;
}
export interface CancelResult extends MutationResult {
  cancelledAt: string;
}

/** R21. The department comes from the caller, never the body. */
export interface AddAdditionInput {
  lines: { itemId: string; requestedQty: string }[];
  pin: string;
}
export interface AddAdditionResult extends MutationResult {
  addition: Addition;
}

/** R22 */
export interface ApproveAdditionInput {
  pin: string;
}
export interface ApproveAdditionResult extends MutationResult {
  addition: Addition;
}

export const REQUISITION_ERROR_CODES = [
  'REQUISITION_ALREADY_OPEN',
  'INVALID_PIN',
  'NOT_YOUR_DEPARTMENT',
  'SECTION_EMPTY',
  'ITEM_NOT_IN_DEPARTMENT',
  'ALREADY_APPROVED',
  'NOT_READY_TO_APPROVE',
  'ADDITION_LOCKED',
  'REASON_REQUIRED',
  'DEPARTMENT_PACKED',
  'CANCELLED',
] as const;
export type RequisitionErrorCode = (typeof REQUISITION_ERROR_CODES)[number];

export interface ErrorBody {
  success: false;
  error: { code: string; message: string; details?: unknown };
}
