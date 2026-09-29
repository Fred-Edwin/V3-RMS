/**
 * Inventory — Milestone Six, Session 1 (Waste)
 * FROZEN API CONTRACT — request/response schemas.
 *
 * Source of truth for `API_CONTRACT.md` §26.1 (waste half). Frontend mirror:
 * `frontend/features/inventory/types/waste.ts` (by hand).
 *
 * Plan: `docs/features/inventory/milestone-6-plan.md` §1.3, §2.1.
 *
 * Every decimal crosses the wire as a string (§22 wire-format rule).
 *
 * Location is never a request field: it is resolved server-side from the
 * actor (Store Manager / Store Attendant → Central Store; department head →
 * their own department location). `CreateWasteSchema` is `.strict()`, so a
 * client that sends `locationId` gets a 400 rather than having it silently
 * ignored.
 *
 * Blind count (plan §7 Q-A): the Store Attendant's item picker and create
 * response are separate schemas with no on-hand field at all. The waste list
 * carries no on-hand for anyone, so one schema serves every role.
 */
import { z } from 'zod';

const decimalString = z.string().regex(/^-?\d+(\.\d+)?$/, 'must be a decimal string');
const positiveDecimalString = decimalString.refine((v) => Number(v) > 0, 'must be greater than zero');
const uuid = z.string().uuid();
const isoDate = z.string().datetime({ offset: true });

export const wasteReasonSchema = z.enum(['SPOILAGE', 'EXPIRY', 'DAMAGE_IN_STORE', 'PREP_ERROR']);

// --- POST /inventory/waste ----------------------------------------------------

export const CreateWasteSchema = z
  .object({
    inventoryItemId: uuid,
    quantity: positiveDecimalString,
    reason: wasteReasonSchema,
    note: z.string().trim().max(500).optional(),
  })
  .strict();

export const WasteEntrySchema = z.object({
  id: uuid,
  at: isoDate,
  itemId: uuid,
  itemName: z.string(),
  quantity: decimalString,
  usageUnit: z.string(),
  reason: wasteReasonSchema,
  note: z.string().nullable(),
  unitCost: decimalString,
  /** quantity × unitCost, 2dp. */
  value: decimalString,
  loggedByName: z.string(),
});

/** Store Manager / department head — Flow 21: negative stock is allowed and flagged. */
export const CreateWasteResultSchema = z.object({
  entry: WasteEntrySchema,
  onHandAfter: decimalString,
  wentNegative: z.boolean(),
});

/** Store Attendant — the entry only; nothing that reveals on-hand. */
export const AttendantCreateWasteResultSchema = z.object({
  entry: WasteEntrySchema,
});

// --- GET /inventory/waste ------------------------------------------------------

export const ListWasteQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(7),
});

export const WasteListSchema = z.object({
  days: z.number().int(),
  entries: z.array(WasteEntrySchema),
  totalValue: decimalString,
});

// --- GET /inventory/waste/items (the Log waste item picker) ---------------------

export const WasteItemsQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/** Store Manager / department head: on-hand + cost hint ("On hand −4 kg · current cost KES 90 / kg"). */
export const WasteItemOptionSchema = z.object({
  itemId: uuid,
  name: z.string(),
  usageUnit: z.string(),
  /** The cost this entry would be valued at — Central Store: current cost; department: latest cost carried in. */
  unitCost: decimalString,
  onHand: decimalString,
});

/** Store Attendant: cost only (plan §7 Q-A). */
export const AttendantWasteItemOptionSchema = WasteItemOptionSchema.omit({ onHand: true });

export const WasteItemOptionListSchema = z.object({ items: z.array(WasteItemOptionSchema) });
export const AttendantWasteItemOptionListSchema = z.object({ items: z.array(AttendantWasteItemOptionSchema) });
