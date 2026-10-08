/**
 * Inventory: Waste rebuild (Central Store)
 * FROZEN API CONTRACT: request and response schemas for the 4 waste endpoints (W1 to W4).
 *
 * Source of truth: docs/features/inventory/stock-count-waste-contract.md and Paper steps 16 to 23. The front end mirrors
 * this file by hand in `frontend/features/inventory/waste/_shared/types/waste-contract.ts`; the shared sample payloads are
 * in `waste-contract.fixtures.json` (parsed by `waste-contract.test.ts`).
 *
 * Scope: the Central Store only. A Department Head's branch waste keeps its three old endpoints untouched (they move,
 * unchanged, into `waste/department/` at release). Waste is never signed with a PIN (owner, 8 Oct 2026). The Store
 * Attendant reads and reverses only their own entries (a service rule on top of the capability) and receives no stock
 * figure from any endpoint; item cost reaches them (owner rule, 6 Oct 2026) though the drawn phone screens show none.
 *
 * Do not change a shape here without changing the contract document, the mirror and the fixtures in the same commit,
 * and only with the owner's approval.
 */
import { z } from 'zod';
import { decimalString, isoDateTime, kpiCellSchema, pageInfoSchema, pageQuerySchema, personSchema, positiveDecimal, uuid } from '../../_shared/wire';

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
});
export const wasteListSchema = z.object({
  /** Today KES, Last 7 days, Most wasted, Reversed 7 days. Absent for the Attendant (their screen is a list only). */
  kpis: z.array(kpiCellSchema).optional(),
  rows: z.array(wasteEntrySchema),
  chips: z.object({ today: z.number().int().nonnegative(), last7: z.number().int().nonnegative(), reversed: z.number().int().nonnegative() }),
  /** "2 items logged at 14:20. You can reverse your own entries today." The Attendant's own banner; absent for desktop roles. */
  bannerText: z.string().nullable().optional(),
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
