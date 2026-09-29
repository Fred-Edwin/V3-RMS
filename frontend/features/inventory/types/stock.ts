/**
 * Inventory Milestone Six, Session 1 — stock position & ledger.
 * Hand-mirrored from `backend/src/modules/inventory/stock-validators.ts`
 * (API_CONTRACT.md §26.1). Every decimal is a string on the wire.
 */

export type InventoryItemTypeValue = 'RAW_INGREDIENT' | 'PREPPED' | 'STOCKED';

export type InventoryTransactionTypeValue =
  | 'RECEIVE'
  | 'PREP_CONSUME'
  | 'PREP_PRODUCE'
  | 'WASTE'
  | 'ADJUSTMENT'
  | 'DISPATCH_OUT'
  | 'DISPATCH_IN'
  | 'MARKET_RECEIVE'
  | 'SALE';

export type TodaysCountStatus = 'NOT_STARTED' | 'DRAFT' | 'SUBMITTED' | 'RETURNED' | 'VERIFIED';

export interface TodaysCount {
  status: TodaysCountStatus;
  countId: string | null;
  submittedAt: string | null;
  submittedByName: string | null;
  /** Progress only — never a quantity (safe for the attendant). Null before a count exists. */
  countedLines: number | null;
  totalLines: number | null;
}

export interface ListStockQuery {
  search?: string;
  type?: InventoryItemTypeValue;
  categoryId?: string;
  belowRestock?: boolean;
  negative?: boolean;
  attention?: boolean;
  page?: number;
  pageSize?: number;
}

export interface StockRow {
  itemId: string;
  name: string;
  type: InventoryItemTypeValue;
  category: { id: string; name: string } | null;
  onHand: string;
  usageUnit: string;
  restockLevel: string | null;
  currentCost: string;
  value: string;
  isLow: boolean;
  isNegative: boolean;
}

export interface StockList {
  rows: StockRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface StockSummary {
  onHandValue: string;
  itemCount: number;
  lowCount: number;
  negativeCount: number;
  todaysCount: TodaysCount;
}

/** STORE_ATTENDANT — `{todaysCount}` only (blind count). */
export interface AttendantStockSummary {
  todaysCount: TodaysCount;
}

export interface LedgerQuery {
  locationId?: string;
  from?: string;
  to?: string;
  type?: InventoryTransactionTypeValue;
  page?: number;
  pageSize?: number;
}

export interface LedgerLocation {
  id: string;
  name: string;
  departmentTag: 'KITCHEN' | 'PASTRY' | 'BARISTA' | 'SERVICE' | 'HOUSEKEEPING' | null;
  branchName: string | null;
}

export interface LedgerSummary {
  itemId: string;
  itemName: string;
  usageUnit: string;
  categoryName: string | null;
  onHand: string;
  currentCost: string;
  currentCostSince: string | null;
  value: string;
  restockLevel: string | null;
  isLow: boolean;
  location: LedgerLocation;
  lastMovementAt: string | null;
}

export interface LedgerRow {
  id: string;
  at: string;
  type: InventoryTransactionTypeValue;
  counterparty: string;
  qty: string;
  runningOnHand: string;
  reference: string | null;
}

export interface Ledger {
  summary: LedgerSummary;
  rows: LedgerRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}
