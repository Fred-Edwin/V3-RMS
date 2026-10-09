/**
 * Inventory: Waste rebuild (Central Store). FROZEN API CONTRACT, front-end mirror.
 *
 * Hand-written mirror of `backend/src/modules/inventory/waste/_shared/waste-contract.ts`. Source of truth:
 * docs/features/inventory/stock-count-waste-contract.md. Waste is never signed with a PIN. The Attendant reads and
 * reverses only their own entries and receives no stock figure; the screens read the `can` flags and test whether a key
 * is present, never a role name.
 *
 * The first half is the Central Store (W1 to W4). A Department Head's branch waste keeps its old endpoints and screens
 * (`waste/department/`) until the build replaces them; its new contract (BW1 to BW7) is the second half of this file.
 */
import type { KpiCell, PageInfo, PageQuery, Person } from '../../../_shared/types/wire';
import type { BranchRef } from '../../../requisitions/_shared/types/requisitions-contract';

export type WasteReason = 'EXPIRY' | 'SPOILAGE' | 'DAMAGE_IN_STORE' | 'PREP_ERROR';
export type WasteReversalReason = 'WRONG_ITEM' | 'WRONG_QUANTITY' | 'OTHER';

export const WASTE_REASONS: readonly WasteReason[] = ['EXPIRY', 'SPOILAGE', 'DAMAGE_IN_STORE', 'PREP_ERROR'];
export const WASTE_REASON_TEXT: Record<WasteReason, string> = {
  EXPIRY: 'Expired',
  SPOILAGE: 'Spoiled',
  DAMAGE_IN_STORE: 'Damaged in store',
  PREP_ERROR: 'Prep error',
};
export const WASTE_REVERSAL_REASONS: readonly WasteReversalReason[] = ['WRONG_ITEM', 'WRONG_QUANTITY', 'OTHER'];
export const WASTE_REVERSAL_TEXT: Record<WasteReversalReason, string> = {
  WRONG_ITEM: 'Logged the wrong item',
  WRONG_QUANTITY: 'Wrong quantity',
  OTHER: 'Other',
};

export interface WasteItemOption {
  itemId: string;
  name: string;
  unit: string;
  /** cap catalog.see_costs */
  unitCost?: string;
  /** cap restock.read. Never the Attendant. */
  onHand?: string;
}

export interface WasteItems {
  /** This person's most logged items. */
  often: WasteItemOption[];
  items: WasteItemOption[];
}

export interface WasteEntry {
  id: string;
  at: string;
  itemId: string;
  itemName: string;
  quantity: string;
  unit: string;
  reason: WasteReason;
  reasonText: string;
  note: string | null;
  loggedBy: Person;
  /** cap catalog.see_costs */
  valueKes?: string;
  status: 'LOGGED' | 'REVERSED';
  reversal: { at: string; by: Person; reason: WasteReversalReason; reasonText: string; note: string | null } | null;
  can: { reverse: boolean };
}

export interface LogWasteInput {
  entries: { inventoryItemId: string; quantity: string; reason: WasteReason }[];
  note?: string;
  /** A uuid the form makes when it opens. */
  idempotencyKey: string;
}

export interface LogWasteResult {
  entries: WasteEntry[];
  /** cap catalog.see_costs */
  totalValueKes?: string;
  /** cap restock.read */
  wentNegative?: boolean;
  replayed: boolean;
}

export interface WasteListQuery extends PageQuery {
  period?: 'today' | '7d' | 'reversed';
  scope?: 'all' | 'mine';
  search?: string;
  /** Lane 0 amendment (8 Oct 2026): Nairobi days (`YYYY-MM-DD`), both included, replacing `period` as the window on when it was logged. */
  from?: string;
  to?: string;
  reason?: WasteReason;
  /** A person's id, from `WasteList.people`. */
  loggedBy?: string;
  status?: 'logged' | 'reversed';
}

export interface WasteList {
  /** Absent for the Attendant. */
  kpis?: KpiCell[];
  rows: WasteEntry[];
  chips: { today: number; last7: number; reversed: number };
  /** The Attendant's own banner: "2 items logged at 14:20. You can reverse your own entries today." */
  bannerText?: string | null;
  /** Lane 0 amendment: who has logged waste here, for the "Logged by" filter. Absent for the Attendant. */
  people?: { id: string; name: string }[];
  page: PageInfo;
}

/** No PIN. "Other" needs a note. The response is the updated `WasteEntry`. */
export interface ReverseWasteInput {
  reason: WasteReversalReason;
  note?: string;
}

export type WasteErrorCode = 'ITEM_RETIRED' | 'NOT_YOUR_ENTRY' | 'REVERSAL_WINDOW_PASSED' | 'ALREADY_REVERSED';

// ═══ BRANCH WASTE (Block 3) ═══════════════════════════════════════════════════════════════════════════════════════════
// Hand-written mirror of the second half of `waste-contract.ts` on the back end (BW1 to BW7, `/inventory/branch-waste`). A department head
// or member logs for their own department and reads the department's list (step 55); the Branch Manager reads the branch with values and
// reverses any entry; Director, Accountant, Store Manager and System Admin read any branch. No PIN. Money and stock keys are ABSENT for a
// head or member (`BRANCH_WASTE_BLIND_KEYS`); screens test whether a key is present, never a role name.

export interface BranchWasteDepartment {
  id: string;
  name: string;
}

/** The Central Store entry plus where it was thrown away. `valueKes` is "0.00" once reversed. */
export interface BranchWasteEntry extends WasteEntry {
  department: BranchWasteDepartment;
  branch: BranchRef;
}

/** BW1. Live items linked to the caller's department; `unitCost` and `onHand` are absent for a head or member. */
export type BranchWasteItems = WasteItems;

/** BW2. Strict on the wire: never a location, a department or a PIN. */
export type LogBranchWasteInput = LogWasteInput;
export interface LogBranchWasteResult {
  entries: BranchWasteEntry[];
  /** cap catalog.see_costs */
  totalValueKes?: string;
  /** cap restock.read */
  wentNegative?: boolean;
  replayed: boolean;
}

/** BW3. Nairobi days, both included. Default window: the last 7 days, to today. */
export interface MyBranchWasteQuery extends PageQuery {
  from?: string;
  to?: string;
}
export interface MyBranchWasteList {
  department: BranchWasteDepartment;
  /** The whole department, newest first. `can.reverse` is true on the caller's own entries logged today. */
  rows: BranchWasteEntry[];
  /** "2 items logged at 14:20. You can reverse your own entries today." or null. */
  bannerText: string | null;
  page: PageInfo;
}

/** BW4 (own branch) and BW5 (any branch, `branchId` absent means all). Default window: today. */
export interface BranchWasteListQuery extends PageQuery {
  search?: string;
  departmentId?: string;
  reason?: WasteReason;
  status?: 'logged' | 'reversed';
  from?: string;
  to?: string;
}
export interface AllBranchesWasteQuery extends BranchWasteListQuery {
  branchId?: string;
  /** The W8 Department filter: the same name matches that department in every branch; `departments` lists each name once. */
  departmentName?: string;
}
export interface BranchWasteList {
  /** cap catalog.see_costs: Today, Last 7 days, Most wasted, Reversed 7 days. */
  kpis?: KpiCell[];
  rows: BranchWasteEntry[];
  departments: BranchWasteDepartment[];
  /** BW5 only: the "Branch: All branches" picker. */
  branches?: { id: string; name: string }[];
  page: PageInfo;
}

/** BW6. */
export interface BranchWasteDetail {
  entry: BranchWasteEntry;
  /** cap restock.read: the ledger rows this entry wrote, signed as stored. */
  ledger?: { kind: 'LOGGED' | 'REVERSAL'; at: string; quantity: string }[];
}

/** BW7. No PIN. "Other" needs a note. The response is the updated `BranchWasteEntry`. */
export type ReverseBranchWasteInput = ReverseWasteInput;

export const BRANCH_WASTE_ERROR_CODES = [
  'ITEM_RETIRED',
  'ITEM_NOT_IN_DEPARTMENT',
  'NOT_YOUR_DEPARTMENT',
  'NOT_YOUR_ENTRY',
  'REVERSAL_WINDOW_PASSED',
  'ALREADY_REVERSED',
] as const;
export type BranchWasteErrorCode = (typeof BRANCH_WASTE_ERROR_CODES)[number];

/** Keys a head or member must never receive from any branch waste endpoint (money and stock). */
export const BRANCH_WASTE_BLIND_KEYS = ['valueKes', 'unitCost', 'totalValueKes', 'kpis', 'onHand', 'wentNegative', 'ledger'] as const;
