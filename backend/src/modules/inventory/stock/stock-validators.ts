/**
 * Inventory — Milestone Six, Session 1 (Stock position & ledger)
 * FROZEN API CONTRACT — request/response schemas.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ Source of truth for `API_CONTRACT.md` §26.1 (stock half). The frontend  │
 * │ mirror is `frontend/features/inventory/types/stock.ts` (by hand).       │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Plan: `docs/features/inventory/milestone-6-plan.md` §2.1,
 * `milestone-6-sessions/session-1-plan.md`.
 *
 * Wire-format rule (inherited from §22, non-negotiable): every decimal —
 * quantity, cost, value — crosses the wire as a **string**.
 *
 * Blind count (plan §7 Q-A, owner-confirmed): the Store Attendant sees no
 * on-hand quantity anywhere. The attendant's summary is a **separate schema**
 * (`AttendantStockSummarySchema`) that structurally has no on-hand/value/
 * low/negative fields — the omission is not a filtered field on a shared
 * shape. The ledger is 403 for the attendant at the route.
 */
import { z } from 'zod';

// --- Shared primitives ------------------------------------------------------

const decimalString = z.string().regex(/^-?\d+(\.\d+)?$/, 'must be a decimal string');
const uuid = z.string().uuid();
const isoDate = z.string().datetime({ offset: true });

/** Express query strings arrive as text — "true"/"false" only, never truthy coercion. */
const queryBoolean = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true')
  .optional();

// --- Enums ------------------------------------------------------------------

export const inventoryItemTypeSchema = z.enum(['RAW_INGREDIENT', 'PREPPED', 'STOCKED']);

export const inventoryTransactionTypeSchema = z.enum([
  'RECEIVE',
  'PREP_CONSUME',
  'PREP_PRODUCE',
  'WASTE',
  'ADJUSTMENT',
  'DISPATCH_OUT',
  'DISPATCH_IN',
  'MARKET_RECEIVE',
  'SALE',
]);

/**
 * Today's Central Store daily count, as far as the hub needs it. Session 1
 * has no counting yet, so the service always returns `NOT_STARTED` with
 * nulls — the shape is frozen now so Session 2 only fills it in.
 */
export const todaysCountStatusSchema = z.enum(['NOT_STARTED', 'DRAFT', 'SUBMITTED', 'RETURNED', 'VERIFIED']);

export const TodaysCountSchema = z.object({
  status: todaysCountStatusSchema,
  countId: uuid.nullable(),
  submittedAt: isoDate.nullable(),
  submittedByName: z.string().nullable(),
  /** Lines counted / on the sheet — progress only, never a quantity (safe for the attendant). Null before a count exists. */
  countedLines: z.number().int().nullable(),
  totalLines: z.number().int().nullable(),
});

// --- GET /inventory/stock ---------------------------------------------------

export const ListStockQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  type: inventoryItemTypeSchema.optional(),
  /** Top-level or sub-category; a top-level id also matches its sub-categories. */
  categoryId: uuid.optional(),
  belowRestock: queryBoolean,
  negative: queryBoolean,
  /**
   * The hub's "attention" table: items that are negative or have a restock
   * level, negative first, then nearest to (or furthest below) their restock
   * level. Combines with the other filters.
   */
  attention: queryBoolean,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(8),
});

export const StockRowSchema = z.object({
  itemId: uuid,
  name: z.string(),
  type: inventoryItemTypeSchema,
  category: z.object({ id: uuid, name: z.string() }).nullable(),
  onHand: decimalString,
  usageUnit: z.string(),
  restockLevel: decimalString.nullable(),
  currentCost: decimalString,
  /** onHand × currentCost — negative when on-hand is negative. */
  value: decimalString,
  isLow: z.boolean(),
  isNegative: z.boolean(),
});

export const StockListSchema = z.object({
  rows: z.array(StockRowSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
  pageCount: z.number().int(),
});

// --- GET /inventory/stock/summary --------------------------------------------

export const StockSummarySchema = z.object({
  onHandValue: decimalString,
  itemCount: z.number().int(),
  lowCount: z.number().int(),
  negativeCount: z.number().int(),
  todaysCount: TodaysCountSchema,
});

/** STORE_ATTENDANT — `{todaysCount}` only, structurally (plan §7 Q-A). */
export const AttendantStockSummarySchema = z.object({
  todaysCount: TodaysCountSchema,
});

// --- GET /inventory/stock/items/:itemId/ledger ---------------------------------

export const LedgerParamsSchema = z.object({
  itemId: uuid,
});

export const LedgerQuerySchema = z.object({
  /**
   * STORE_MANAGER: omitted = the Central Store (the only location they may
   * read). MANAGER: required — one of their own branch's department
   * locations. DEPARTMENT_HEAD: omitted = their own department; any other
   * value is 403.
   */
  locationId: uuid.optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  type: inventoryTransactionTypeSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const LedgerLocationSchema = z.object({
  id: uuid,
  name: z.string(),
  /** null for the Central Store. */
  departmentTag: z.enum(['KITCHEN', 'PASTRY', 'BARISTA', 'SERVICE', 'HOUSEKEEPING']).nullable(),
  /** The branch org's name for a department location; null for the Central Store. */
  branchName: z.string().nullable(),
});

export const LedgerSummarySchema = z.object({
  itemId: uuid,
  itemName: z.string(),
  usageUnit: z.string(),
  categoryName: z.string().nullable(),
  onHand: decimalString,
  currentCost: decimalString,
  /** When the current cost was last set by a receipt or prep run; null if never. */
  currentCostSince: isoDate.nullable(),
  value: decimalString,
  restockLevel: decimalString.nullable(),
  isLow: z.boolean(),
  location: LedgerLocationSchema,
  /** Latest movement at this location, any date — the empty-range copy's "since {date}". */
  lastMovementAt: isoDate.nullable(),
});

export const LedgerRowSchema = z.object({
  id: uuid,
  at: isoDate,
  type: inventoryTransactionTypeSchema,
  /** Derived from whichever FK the row carries — no stored free text (plan §1.7). */
  counterparty: z.string(),
  /** Signed. */
  qty: decimalString,
  /** Balance after this row, over the whole ledger (not just the filtered range). */
  runningOnHand: decimalString,
  reference: z.string().nullable(),
});

export const LedgerSchema = z.object({
  summary: LedgerSummarySchema,
  rows: z.array(LedgerRowSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
  pageCount: z.number().int(),
});
