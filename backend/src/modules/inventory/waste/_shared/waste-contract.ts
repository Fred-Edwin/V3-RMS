/**
 * Inventory: Waste rebuild (Central Store)
 * FROZEN API CONTRACT: request and response schemas for the 4 waste endpoints (W1 to W4).
 *
 * Source of truth: docs/features/inventory/stock-count-waste-contract.md and Paper steps 16 to 23. The front end mirrors
 * this file by hand in `frontend/features/inventory/waste/_shared/types/waste-contract.ts`; the shared sample payloads are
 * in `waste-contract.fixtures.json` (parsed by `waste-contract.test.ts`).
 *
 * Scope: the first half (W1 to W4) is the Central Store. The second half, "BRANCH WASTE (Block 3)" at the end of this file
 * (BW1 to BW7, docs/features/inventory/branch-waste-contract.md), is a branch's departments; until the build replaces them a
 * Department Head's three old endpoints keep running from `waste/department/`. Waste is never signed with a PIN (owner, 8 Oct 2026). The Store
 * Attendant reads and reverses only their own entries (a service rule on top of the capability) and receives no stock
 * figure from any endpoint; item cost reaches them (owner rule, 6 Oct 2026) though the drawn phone screens show none.
 *
 * Do not change a shape here without changing the contract document, the mirror and the fixtures in the same commit,
 * and only with the owner's approval.
 */
import { z } from 'zod';
import { decimalString, isoDateTime, kpiCellSchema, nairobiDate, pageInfoSchema, pageQuerySchema, personSchema, positiveDecimal, uuid } from '../../_shared/wire';
import { branchRefSchema } from '../../requisitions/_shared/requisitions-contract';

/** The four reason chips (Paper steps 17 and 22). Same values as the database enum `WasteReason`. */
export const WASTE_REASONS = ['EXPIRY', 'SPOILAGE', 'DAMAGE_IN_STORE', 'PREP_ERROR'] as const;
export const wasteReasonSchema = z.enum(WASTE_REASONS);
export type WasteReason = z.infer<typeof wasteReasonSchema>;
export const WASTE_REASON_TEXT: Record<WasteReason, string> = {
  EXPIRY: 'Expired',
  SPOILAGE: 'Spoiled',
  DAMAGE_IN_STORE: 'Damaged in store',
  PREP_ERROR: 'Prep error',
};

/** Why an entry is reversed (Paper steps 20 and 23). Required. OTHER needs a note. */
export const WASTE_REVERSAL_REASONS = ['WRONG_ITEM', 'WRONG_QUANTITY', 'OTHER'] as const;
export const wasteReversalReasonSchema = z.enum(WASTE_REVERSAL_REASONS);
export type WasteReversalReason = z.infer<typeof wasteReversalReasonSchema>;
export const WASTE_REVERSAL_TEXT: Record<WasteReversalReason, string> = {
  WRONG_ITEM: 'Logged the wrong item',
  WRONG_QUANTITY: 'Wrong quantity',
  OTHER: 'Other',
};

// --- W1 GET /waste/items (Paper steps 16 and 22) -----------------------------

/** cap waste.log. `often` is this person's most logged items, newest habit first (at most 6). */
export const wasteItemsQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export const wasteItemOptionSchema = z.object({
  itemId: uuid,
  name: z.string(),
  unit: z.string(),
  /** cap catalog.see_costs: the cost an entry would be valued at (current cost now). */
  unitCost: decimalString.optional(),
  /** cap restock.read: "On hand −4 kg". Never the Attendant. */
  onHand: decimalString.optional(),
});
export type WasteItemOption = z.infer<typeof wasteItemOptionSchema>;
export const wasteItemsSchema = z.object({ often: z.array(wasteItemOptionSchema), items: z.array(wasteItemOptionSchema) });
export type WasteItems = z.infer<typeof wasteItemsSchema>;

// --- Entries ------------------------------------------------------------------

export const wasteEntrySchema = z.object({
  id: uuid,
  at: isoDateTime,
  itemId: uuid,
  itemName: z.string(),
  quantity: positiveDecimal,
  unit: z.string(),
  reason: wasteReasonSchema,
  reasonText: z.string(),
  note: z.string().nullable(),
  loggedBy: personSchema,
  /** cap catalog.see_costs: quantity × the cost it was logged at, KES. */
  valueKes: decimalString.optional(),
  status: z.enum(['LOGGED', 'REVERSED']),
  reversal: z
    .object({
      at: isoDateTime,
      by: personSchema,
      reason: wasteReversalReasonSchema,
      reasonText: z.string(),
      note: z.string().nullable(),
    })
    .nullable(),
  can: z.object({
    /** waste.reverse_any, or waste.reverse_own on an entry the caller logged earlier the same Nairobi day; and the entry is not already reversed. */
    reverse: z.boolean(),
  }),
});
export type WasteEntry = z.infer<typeof wasteEntrySchema>;

// --- W2 POST /waste ------------------------------------------------------------

/** Log one or several items in one go ("Log 2 items"). Nothing moves until this is sent. cap waste.log. */
export const logWasteInputSchema = z
  .object({
    entries: z
      .array(z.object({ inventoryItemId: uuid, quantity: positiveDecimal, reason: wasteReasonSchema }).strict())
      .min(1)
      .max(30),
    /** One optional note, kept on every entry of this batch. */
    note: z.string().trim().max(500).optional(),
    /** A uuid the form makes when it opens; a second tap returns the same entries (HTTP 200). */
    idempotencyKey: z.string().min(8).max(64),
  })
  .strict();
export type LogWasteInput = z.infer<typeof logWasteInputSchema>;
export const logWasteResultSchema = z.object({
  entries: z.array(wasteEntrySchema),
  /** cap catalog.see_costs */
  totalValueKes: decimalString.optional(),
  /** cap restock.read: stock went below zero (allowed and flagged, never blocked). */
  wentNegative: z.boolean().optional(),
  replayed: z.boolean(),
});
export type LogWasteResult = z.infer<typeof logWasteResultSchema>;

// --- W3 GET /waste (Paper steps 19 and 21) -------------------------------------

/**
 * cap waste.read. The Store Attendant always gets their own entries only, whatever `scope` says. `period`:
 * today (the Nairobi day), 7d (last 7 days), reversed (reversed entries in the last 7 days).
 */
export const wasteListQuerySchema = pageQuerySchema.extend({
  period: z.enum(['today', '7d', 'reversed']).default('today'),
  scope: z.enum(['all', 'mine']).default('all'),
  search: z.string().trim().min(1).optional(),
  /**
   * Lane 0 amendment (8 Oct 2026), all optional. `from` and `to` are Nairobi days (both included, either may be given alone) and
   * replace `period` as the window on when the entry was logged. `reason`, `loggedBy` (a person's id) and `status` narrow the rows.
   */
  from: nairobiDate.optional(),
  to: nairobiDate.optional(),
  reason: wasteReasonSchema.optional(),
  loggedBy: z.string().min(1).optional(),
  status: z.enum(['logged', 'reversed']).optional(),
});
export const wasteListSchema = z.object({
  /** Today KES, Last 7 days, Most wasted, Reversed 7 days. Absent for the Attendant (their screen is a list only). */
  kpis: z.array(kpiCellSchema).optional(),
  rows: z.array(wasteEntrySchema),
  chips: z.object({ today: z.number().int().nonnegative(), last7: z.number().int().nonnegative(), reversed: z.number().int().nonnegative() }),
  /** "2 items logged at 14:20. You can reverse your own entries today." The Attendant's own banner; absent for desktop roles. */
  bannerText: z.string().nullable().optional(),
  /** Lane 0 amendment: who has logged waste here, for the "Logged by" filter. Absent for the Attendant (their list is their own). */
  people: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
  page: pageInfoSchema,
});
export type WasteList = z.infer<typeof wasteListSchema>;

// --- W4 POST /waste/:id/reverse (Paper steps 20 and 23) ------------------------

/** cap waste.reverse_any, or waste.reverse_own for an own entry of today. No PIN. The original stays; a linked reversing ledger row returns the stock. */
export const reverseWasteInputSchema = z
  .object({ reason: wasteReversalReasonSchema, note: z.string().trim().max(300).optional() })
  .strict()
  .refine((v) => !(v.reason === 'OTHER' && !v.note), 'Other needs a note');
export type ReverseWasteInput = z.infer<typeof reverseWasteInputSchema>;
/** The response is the updated `WasteEntry`. */

export const WASTE_ERROR_CODES = [
  'ITEM_RETIRED', // 409
  'NOT_YOUR_ENTRY', // 403: an Attendant reversing someone else's entry
  'REVERSAL_WINDOW_PASSED', // 403: an Attendant reversing an entry from an earlier day
  'ALREADY_REVERSED', // 409
] as const;

// ═══ BRANCH WASTE (Block 3) ═══════════════════════════════════════════════════════════════════════════════════════════
// Source of truth: docs/features/inventory/branch-waste-contract.md, Paper page "Inventory · Branch waste" (W1 to W9) and step 55.
// Base path `/inventory/branch-waste`. Seven endpoints, BW1 to BW7. A department head or member logs for their own department and
// reads the department's whole list (step 55); the Branch Manager reads their branch with values and reverses any entry; Director,
// Accountant, Store Manager and System Admin read any branch (W8). No PIN anywhere. Heads and members are blind to money and stock:
// `valueKes`, `unitCost`, `totalValueKes`, `kpis`, `onHand`, `wentNegative` and `ledger` are ABSENT unless the caller holds the matching
// capability (`catalog.see_costs`, `restock.read`), never null. The reasons and reversal reasons are the Central Store ones above.

/** A department as a response names it. */
export const branchWasteDepartmentSchema = z.object({ id: uuid, name: z.string() });
export type BranchWasteDepartment = z.infer<typeof branchWasteDepartmentSchema>;

/** One entry: the Central Store entry plus where it was thrown away. `valueKes` is "0.00" once reversed (Paper W6, W9). */
export const branchWasteEntrySchema = wasteEntrySchema.extend({
  department: branchWasteDepartmentSchema,
  branch: branchRefSchema,
});
export type BranchWasteEntry = z.infer<typeof branchWasteEntrySchema>;

// --- BW1 GET /items (Paper W1, W2): department rule ------------------------------

export const branchWasteItemsQuerySchema = wasteItemsQuerySchema;
/** Live items linked to the caller's department; `often` is this person's most logged (at most 6). `unitCost` and `onHand` are absent for a head or member. */
export const branchWasteItemsSchema = wasteItemsSchema;
export type BranchWasteItems = z.infer<typeof branchWasteItemsSchema>;

// --- BW2 POST / (Paper W2, W3): department rule ----------------------------------

/** Strict: a `locationId`, `departmentId` or `pin` is refused; the department comes from the caller and waste is never signed. */
export const logBranchWasteInputSchema = logWasteInputSchema;
export type LogBranchWasteInput = z.infer<typeof logBranchWasteInputSchema>;
export const logBranchWasteResultSchema = z.object({
  entries: z.array(branchWasteEntrySchema),
  /** cap catalog.see_costs */
  totalValueKes: decimalString.optional(),
  /** cap restock.read: stock went below zero (allowed and flagged, never blocked). */
  wentNegative: z.boolean().optional(),
  replayed: z.boolean(),
});
export type LogBranchWasteResult = z.infer<typeof logBranchWasteResultSchema>;

// --- BW3 GET /mine (step 55): department rule -------------------------------------

/** Nairobi days, both included. Default window: the last 7 days, to today ("Date: Last 7 days"). */
export const myBranchWasteQuerySchema = pageQuerySchema.extend({ from: nairobiDate.optional(), to: nairobiDate.optional() });
export type MyBranchWasteQuery = z.infer<typeof myBranchWasteQuerySchema>;
export const myBranchWasteListSchema = z.object({
  department: branchWasteDepartmentSchema,
  /** The whole department's entries, newest first. No money, no stock. `can.reverse` is true on the caller's own entries logged today. */
  rows: z.array(branchWasteEntrySchema),
  /** "2 items logged at 14:20. You can reverse your own entries today." when the caller logged a batch today, else null. */
  bannerText: z.string().nullable(),
  page: pageInfoSchema,
});
export type MyBranchWasteList = z.infer<typeof myBranchWasteListSchema>;

// --- BW4 GET /branch (W6) and BW5 GET /branches (W8) -------------------------------

const branchWasteFiltersSchema = pageQuerySchema.extend({
  search: z.string().trim().min(1).optional(),
  departmentId: uuid.optional(),
  reason: wasteReasonSchema.optional(),
  status: z.enum(['logged', 'reversed']).optional(),
  /** Nairobi days, both included; either may be given alone. Default window: today ("Date: Today"). */
  from: nairobiDate.optional(),
  to: nairobiDate.optional(),
});
/** cap branch_waste.read: the caller's own branch. */
export const branchWasteListQuerySchema = branchWasteFiltersSchema;
export type BranchWasteListQuery = z.infer<typeof branchWasteListQuerySchema>;
/** cap branch_waste.read_any_branch: `branchId` absent means all branches. */
export const allBranchesWasteQuerySchema = branchWasteFiltersSchema.extend({ branchId: uuid.optional() });
export type AllBranchesWasteQuery = z.infer<typeof allBranchesWasteQuerySchema>;
export const branchWasteListSchema = z.object({
  /** cap catalog.see_costs. Today, Last 7 days, Most wasted, Reversed 7 days; the server phrases the captions. */
  kpis: z.array(kpiCellSchema).optional(),
  rows: z.array(branchWasteEntrySchema),
  /** The Department filter's options. */
  departments: z.array(branchWasteDepartmentSchema),
  /** BW5 only: the "Branch: All branches" picker. */
  branches: z.array(z.object({ id: uuid, name: z.string() })).optional(),
  page: pageInfoSchema,
});
export type BranchWasteList = z.infer<typeof branchWasteListSchema>;

// --- BW6 GET /:id ------------------------------------------------------------------

export const branchWasteDetailSchema = z.object({
  entry: branchWasteEntrySchema,
  /** cap restock.read: the ledger rows this entry wrote, signed as stored (the log, then a reversal). Absent for a head or member. */
  ledger: z.array(z.object({ kind: z.enum(['LOGGED', 'REVERSAL']), at: isoDateTime, quantity: decimalString })).optional(),
});
export type BranchWasteDetail = z.infer<typeof branchWasteDetailSchema>;

// --- BW7 POST /:id/reverse (W5, W7) ---------------------------------------------------

/** No PIN. `branch_waste.reverse_any`, or `branch_waste.reverse_own` for an own entry of today. The response is the updated `BranchWasteEntry`. */
export const reverseBranchWasteInputSchema = reverseWasteInputSchema;
export type ReverseBranchWasteInput = z.infer<typeof reverseBranchWasteInputSchema>;

export const BRANCH_WASTE_ERROR_CODES = [
  'ITEM_RETIRED', // 409: the item was retired
  'ITEM_NOT_IN_DEPARTMENT', // 422: the item is not linked to the caller's department
  'NOT_YOUR_DEPARTMENT', // 403: not an active head or member of a department of this branch
  'NOT_YOUR_ENTRY', // 403: reversing someone else's entry without `branch_waste.reverse_any`
  'REVERSAL_WINDOW_PASSED', // 403: reversing an own entry from an earlier day
  'ALREADY_REVERSED', // 409
] as const;
export type BranchWasteErrorCode = (typeof BRANCH_WASTE_ERROR_CODES)[number];

/** Keys a head or member must never receive from any branch waste endpoint (money and stock). A test pins the fixtures against it. */
export const BRANCH_WASTE_BLIND_KEYS = ['valueKes', 'unitCost', 'totalValueKes', 'kpis', 'onHand', 'wentNegative', 'ledger'] as const;
