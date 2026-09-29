/**
 * Inventory Milestone Six, Session 1 — waste.
 * Hand-mirrored from `backend/src/modules/inventory/waste-validators.ts`
 * (API_CONTRACT.md §26.1). Location is never sent — the server resolves it
 * from the signed-in user.
 */

export type WasteReasonValue = 'SPOILAGE' | 'EXPIRY' | 'DAMAGE_IN_STORE' | 'PREP_ERROR';

export interface CreateWasteInput {
  inventoryItemId: string;
  quantity: string;
  reason: WasteReasonValue;
  note?: string;
}

export interface WasteEntry {
  id: string;
  at: string;
  itemId: string;
  itemName: string;
  quantity: string;
  usageUnit: string;
  reason: WasteReasonValue;
  note: string | null;
  unitCost: string;
  value: string;
  loggedByName: string;
}

/** Store Manager / department head. The attendant's result has `entry` only. */
export interface CreateWasteResult {
  entry: WasteEntry;
  onHandAfter?: string;
  wentNegative?: boolean;
}

export interface WasteList {
  days: number;
  entries: WasteEntry[];
  totalValue: string;
}

/** `onHand` is absent for the Store Attendant (blind count). */
export interface WasteItemOption {
  itemId: string;
  name: string;
  usageUnit: string;
  unitCost: string;
  onHand?: string;
}

export interface WasteItemOptionList {
  items: WasteItemOption[];
}
