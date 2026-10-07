/**
 * Inventory: Stock rebuild (Overview, All items, Stock ledger, Stock card)
 * FROZEN API CONTRACT: request and response schemas for the 5 stock endpoints (S1 to S5).
 *
 * Source of truth: docs/features/inventory/stock-count-waste-contract.md and Paper steps 27 to 29 and 42. The front end
 * mirrors this file by hand in `frontend/features/inventory/stock/_shared/types/stock-contract.ts`; the shared sample
 * payloads are in `stock-contract.fixtures.json` (parsed by `stock-contract.test.ts`).
 *
 * Every Stock endpoint needs `stock.read`: all five desktop roles hold it, the Store Attendant does not (a 403 for them,
 * not a stripped body). Money values (value, unit cost) are present for every holder because every holder also holds
 * `catalog.see_costs`; they are still built through the blind rule so a future role change is a one-row edit.
 *
 * Do not change a shape here without changing the contract document, the mirror and the fixtures in the same commit,
 * and only with the owner's approval.
 */
import { z } from 'zod';
import { decimalString, isoDateTime, kpiCellSchema, nairobiDate, pageInfoSchema, pageQuerySchema, uuid } from '../../_shared/wire';

export const ITEM_STOCK_STATUSES = ['OK', 'LOW', 'OUT', 'NEGATIVE'] as const;
export const itemStockStatusSchema = z.enum(ITEM_STOCK_STATUSES);
export type ItemStockStatus = z.infer<typeof itemStockStatusSchema>;

// --- S1 GET /overview (Paper step 42) ----------------------------------------

export const stockOverviewSchema = z.object({
  /** Items tracked, Low or out, Negative stock, Counts today. */
  kpis: z.array(kpiCellSchema),
  todaysCounts: z.array(
    z.object({
      id: uuid,
      reference: z.string(),
      /** "Others" */
      what: z.string(),
      /** "Isabel Njoki · started 11:02", "Linnet Wanjiru · 07:02 to 07:41" */
      byText: z.string(),
      status: z.enum(['IN_PROGRESS', 'TO_REVIEW', 'SIGNED']),
      statusText: z.string(),
    }),
  ),
  /** The sections and items that have gone longest without a count, longest first. */
  longestWithoutCount: z.array(
    z.object({
      kind: z.enum(['SECTION', 'ITEM']),
      /** `sectionId` for a SECTION, `itemId` for an ITEM. */
      refId: uuid,
      name: z.string(),
      /** "Section · 36 items" or "Item · Others" */
      detail: z.string(),
      lastCountedAt: isoDateTime.nullable(),
      /** "12 days ago" */
      lastCountedText: z.string(),
    }),
  ),
  can: z.object({ startCount: z.boolean() }),
});
export type StockOverview = z.infer<typeof stockOverviewSchema>;

// --- S2 GET /items (Paper step 27) -------------------------------------------

export const stockItemsQuerySchema = pageQuerySchema.extend({
  /** Matches the item name; results update as you type. */
  search: z.string().trim().min(1).optional(),
  status: z.enum(['all', 'low', 'negative']).default('all'),
  categoryId: uuid.optional(),
  type: z.string().optional(),
  departmentTag: z.string().optional(),
  sectionId: uuid.optional(),
});
export const stockItemRowSchema = z.object({
  itemId: uuid,
  name: z.string(),
  sectionName: z.string().nullable(),
  unit: z.string(),
  onHand: decimalString,
  restockLevel: decimalString.nullable(),
  /** KES, on hand × current cost; negative stock shows negative. */
  valueKes: decimalString,
  lastCountedAt: isoDateTime.nullable(),
  /** "Tue 13 Oct" */
  lastCountedText: z.string(),
  status: itemStockStatusSchema,
});
export type StockItemRow = z.infer<typeof stockItemRowSchema>;
export const stockItemsListSchema = z.object({
  /** Items tracked, Low or out, Negative stock, On-hand value. */
  kpis: z.array(kpiCellSchema),
  rows: z.array(stockItemRowSchema),
  chips: z.object({ all: z.number().int().nonnegative(), low: z.number().int().nonnegative(), negative: z.number().int().nonnegative() }),
  page: pageInfoSchema,
});
export type StockItemsList = z.infer<typeof stockItemsListSchema>;

// --- S3 GET /ledger, S4 GET /ledger/export (Paper step 28) -------------------

/** `from` and `to` are Nairobi days; both default to the last 30 days ending today. A single day is `from = to`. */
export const ledgerQuerySchema = pageQuerySchema.extend({
  from: nairobiDate.optional(),
  to: nairobiDate.optional(),
  /** An item name, or a reference such as ADJ-3402 or CNT-2026-1013. */
  search: z.string().trim().min(1).optional(),
  sectionId: uuid.optional(),
  chip: z.enum(['all', 'adjustments', 'waste', 'negative']).default('all'),
});
export type LedgerQuery = z.infer<typeof ledgerQuerySchema>;
export const ledgerRowSchema = z.object({
  itemId: uuid,
  name: z.string(),
  unit: z.string(),
  /** "made in Prep" */
  note: z.string().nullable(),
  /** Quantities in the item's usage unit; each row adds up: opening + in − sentOut − prepUse − waste + adjusted = closing. Out columns are stored negative. */
  opening: decimalString,
  in: decimalString,
  sentOut: decimalString,
  prepUse: decimalString,
  waste: decimalString,
  adjusted: decimalString,
  closing: decimalString,
  closingValueKes: decimalString,
});
export type LedgerRow = z.infer<typeof ledgerRowSchema>;
export const ledgerListSchema = z.object({
  from: nairobiDate,
  to: nairobiDate,
  /** "Last 30 days, as of 13 Oct, 16:30" */
  periodText: z.string(),
  /** Opening, In, Out, Closing. */
  kpis: z.array(kpiCellSchema),
  rows: z.array(ledgerRowSchema),
  chips: z.object({
    all: z.number().int().nonnegative(),
    adjustments: z.number().int().nonnegative(),
    waste: z.number().int().nonnegative(),
    negative: z.number().int().nonnegative(),
  }),
  page: pageInfoSchema,
});
export type LedgerList = z.infer<typeof ledgerListSchema>;
/** S4 GET /ledger/export: `text/csv`, the same filters as S3 and every row (no paging), at most 10,000 rows (413 `EXPORT_TOO_LARGE` beyond). */

// --- S5 GET /ledger/:itemId (Paper step 29) ----------------------------------

export const stockCardQuerySchema = z.object({
  from: nairobiDate.optional(),
  to: nairobiDate.optional(),
  show: z.enum(['byDay', 'entries']).default('byDay'),
  chip: z.enum(['daysWithMovement', 'adjustmentsOnly']).default('daysWithMovement'),
});
export const stockCardEntrySchema = z.object({
  id: uuid,
  at: isoDateTime,
  type: z.enum(['RECEIVE', 'PREP_CONSUME', 'PREP_PRODUCE', 'WASTE', 'ADJUSTMENT', 'DISPATCH_OUT', 'DISPATCH_IN']),
  /** "GRN-0412", "ADJ-3402", "DSP-0121", "CNT-2026-1013" when the movement has one. */
  reference: z.string().nullable(),
  /** Signed, in the usage unit. */
  quantity: decimalString,
  reversed: z.boolean(),
  /** "Reversal of WST-0007". */
  note: z.string().nullable(),
});
export const stockCardDaySchema = z.object({
  day: nairobiDate,
  /** "Tue 13 Oct 2026" */
  dayText: z.string(),
  /** The main reference of the day, or "13 movements, Prep use" for a collapsed quiet period. */
  referenceText: z.string(),
  references: z.array(z.string()),
  /** A collapsed quiet period ("14 Sep – 5 Oct"). */
  collapsed: z.boolean(),
  opening: decimalString,
  in: decimalString,
  sentOut: decimalString,
  prepUse: decimalString,
  waste: decimalString,
  adjusted: decimalString,
  closing: decimalString,
  closingValueKes: decimalString,
  /** Present when `show = entries`, or when the day was opened in place. */
  entries: z.array(stockCardEntrySchema).optional(),
});
export const stockCardSchema = z.object({
  item: z.object({ id: uuid, name: z.string(), unit: z.string(), sectionName: z.string().nullable(), locationName: z.string() }),
  onHand: decimalString,
  status: itemStockStatusSchema,
  /** "Low · restock level 180 kg" */
  statusText: z.string(),
  valueKes: decimalString,
  /** "at KES 183 per kg" */
  unitCostText: z.string(),
  lastCounted: z.object({ at: isoDateTime, reference: z.string(), text: z.string() }).nullable(),
  from: nairobiDate,
  to: nairobiDate,
  periodText: z.string(),
  strip: z.object({
    opening: decimalString,
    in: decimalString,
    sentOut: decimalString,
    prepUse: decimalString,
    waste: decimalString,
    adjusted: decimalString,
    closing: decimalString,
  }),
  days: z.array(stockCardDaySchema),
  /** "5 days and 1 earlier period · 18 movements · open a day for its entries · each row adds up". */
  footerText: z.string(),
});
export type StockCard = z.infer<typeof stockCardSchema>;

export const STOCK_ERROR_CODES = ['EXPORT_TOO_LARGE', 'ITEM_NOT_FOUND', 'DATE_IN_FUTURE', 'RANGE_INVALID'] as const;
