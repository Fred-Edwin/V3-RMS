/**
 * Inventory: Waste rebuild (Central Store). FROZEN API CONTRACT, front-end mirror.
 *
 * Hand-written mirror of `backend/src/modules/inventory/waste/_shared/waste-contract.ts`. Source of truth:
 * docs/features/inventory/stock-count-waste-contract.md. Waste is never signed with a PIN. The Attendant reads and
 * reverses only their own entries and receives no stock figure; the screens read the `can` flags and test whether a key
 * is present, never a role name.
 *
 * A Department Head's branch waste is not part of this contract: it keeps its old endpoints and screens
 * (`waste/department/`).
 */
import type { KpiCell, PageInfo, PageQuery, Person } from '../../../_shared/types/wire';

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
}

export interface WasteList {
  /** Absent for the Attendant. */
  kpis?: KpiCell[];
  rows: WasteEntry[];
  chips: { today: number; last7: number; reversed: number };
  /** The Attendant's own banner: "2 items logged at 14:20. You can reverse your own entries today." */
  bannerText?: string | null;
  page: PageInfo;
}

/** No PIN. "Other" needs a note. The response is the updated `WasteEntry`. */
export interface ReverseWasteInput {
  reason: WasteReversalReason;
  note?: string;
}

export type WasteErrorCode = 'ITEM_RETIRED' | 'NOT_YOUR_ENTRY' | 'REVERSAL_WINDOW_PASSED' | 'ALREADY_REVERSED';
