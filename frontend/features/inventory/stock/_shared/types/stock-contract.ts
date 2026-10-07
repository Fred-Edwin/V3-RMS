/**
 * Inventory: Stock rebuild. FROZEN API CONTRACT, front-end mirror.
 *
 * Hand-written mirror of `backend/src/modules/inventory/stock/_shared/stock-contract.ts`. Source of truth:
 * docs/features/inventory/stock-count-waste-contract.md. Every Stock endpoint needs `stock.read`, which the Store
 * Attendant does not hold: they never reach these screens.
 */
import type { KpiCell, PageInfo, PageQuery } from '../../../_shared/types/wire';

export type ItemStockStatus = 'OK' | 'LOW' | 'OUT' | 'NEGATIVE';

export interface StockOverview {
  kpis: KpiCell[];
  todaysCounts: { id: string; reference: string; what: string; byText: string; status: 'IN_PROGRESS' | 'TO_REVIEW' | 'SIGNED'; statusText: string }[];
  longestWithoutCount: { kind: 'SECTION' | 'ITEM'; refId: string; name: string; detail: string; lastCountedAt: string | null; lastCountedText: string }[];
  can: { startCount: boolean };
}

export interface StockItemsQuery extends PageQuery {
  search?: string;
  status?: 'all' | 'low' | 'negative';
  categoryId?: string;
  type?: string;
  departmentTag?: string;
  sectionId?: string;
}

export interface StockItemRow {
  itemId: string;
  name: string;
  sectionName: string | null;
  unit: string;
  onHand: string;
  restockLevel: string | null;
  valueKes: string;
  lastCountedAt: string | null;
  /** "Tue 13 Oct" */
  lastCountedText: string;
  status: ItemStockStatus;
}

export interface StockItemsList {
  kpis: KpiCell[];
  rows: StockItemRow[];
  chips: { all: number; low: number; negative: number };
  page: PageInfo;
}

export interface LedgerQuery extends PageQuery {
  from?: string;
  to?: string;
  /** An item name, or a reference such as ADJ-3402 or CNT-2026-1013. */
  search?: string;
  sectionId?: string;
  chip?: 'all' | 'adjustments' | 'waste' | 'negative';
}

export interface LedgerRow {
  itemId: string;
  name: string;
  unit: string;
  /** "made in Prep" */
  note: string | null;
  /** Out columns are stored negative; each row adds up. */
  opening: string;
  in: string;
  sentOut: string;
  prepUse: string;
  waste: string;
  adjusted: string;
  closing: string;
  closingValueKes: string;
}

export interface LedgerList {
  from: string;
  to: string;
  periodText: string;
  kpis: KpiCell[];
  rows: LedgerRow[];
  chips: { all: number; adjustments: number; waste: number; negative: number };
  page: PageInfo;
}

export interface StockCardQuery {
  from?: string;
  to?: string;
  show?: 'byDay' | 'entries';
  chip?: 'daysWithMovement' | 'adjustmentsOnly';
}

export interface StockCardEntry {
  id: string;
  at: string;
  type: 'RECEIVE' | 'PREP_CONSUME' | 'PREP_PRODUCE' | 'WASTE' | 'ADJUSTMENT' | 'DISPATCH_OUT' | 'DISPATCH_IN';
  reference: string | null;
  /** Signed, in the usage unit. */
  quantity: string;
  reversed: boolean;
  note: string | null;
}

export interface StockCardDay {
  day: string;
  dayText: string;
  referenceText: string;
  references: string[];
  collapsed: boolean;
  opening: string;
  in: string;
  sentOut: string;
  prepUse: string;
  waste: string;
  adjusted: string;
  closing: string;
  closingValueKes: string;
  entries?: StockCardEntry[];
}

export interface StockCard {
  item: { id: string; name: string; unit: string; sectionName: string | null; locationName: string };
  onHand: string;
  status: ItemStockStatus;
  statusText: string;
  valueKes: string;
  unitCostText: string;
  lastCounted: { at: string; reference: string; text: string } | null;
  from: string;
  to: string;
  periodText: string;
  strip: { opening: string; in: string; sentOut: string; prepUse: string; waste: string; adjusted: string; closing: string };
  days: StockCardDay[];
  footerText: string;
}

export type StockErrorCode = 'EXPORT_TOO_LARGE' | 'ITEM_NOT_FOUND' | 'DATE_IN_FUTURE' | 'RANGE_INVALID';
