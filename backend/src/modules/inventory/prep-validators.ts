/**
 * Inventory — Milestone Three (Prep)
 * FROZEN API CONTRACT — request/response schemas.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ Source of truth for the Milestone Three contract, built in the S0       │
 * │ single-session vertical slice. `frontend/features/inventory/types/      │
 * │ prep.ts` mirrors it by hand (no shared package in this repo).           │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Plan: `docs/features/inventory/milestone-3-plan.md` §3. All four of the
 * plan's §6 modeling questions are owner-resolved (2026-09-19) and reflected
 * below — see `prep-service.ts`'s named threshold/window constants.
 *
 * Naming: routes live under `/inventory/prep/…` throughout, never a bare
 * `/prep…` path. `API_CONTRACT.md` §5 "Prep Tickets & Incidents" is a
 * completely different domain (BDS/KDS order-item prep tickets — see
 * CLAUDE.md's "one ticket per order-item line" system) and must never
 * collide with this contract's names.
 *
 * Wire-format rule (inherited from §22, non-negotiable): every decimal —
 * quantity, cost, total — crosses the wire as a **string**, never a JS
 * number. Prisma stores them as Decimal; coercing to number loses precision.
 *
 * Five contract-formatting gaps left open by the plan's §3.3 sketch, resolved
 * here at S0 build time (not new modeling questions — the plan's §6
 * questions are all resolved; these are formatting decisions the build
 * session owns, same as Milestone Two's post-freeze amendments):
 *
 *  1. `yieldUnit` sources from the **output item's `usageUnit`** — matches
 *     the "~22L" Paper example (a usage-unit figure, not a buy-unit one).
 *  2. `inputsPreview.firstItemLabel` is formatted `"${quantity}${unit}
 *     ${itemName}"` (e.g. "6kg chicken"), matching `TypicalYield.
 *     typicalInputSummary`'s own "~6 kg chicken" example — the New Prep Run
 *     nudge and the runs-list table use one consistent convention.
 *  3. `yieldVarianceLabel` is stored as `'normal'` (not `null`) whenever a
 *     typical yield exists but the delta is under the warn threshold;
 *     `null` is reserved for "no typical yet, unflaggable" only. This keeps
 *     `yieldFlag=normal` a clean equality filter on the stored column and
 *     keeps `null` meaning exactly one thing.
 *  4. `yieldVarianceDelta` is a signed **quantity** delta (`actualYield -
 *     typicalYieldAtRunTime`, one decimal place, explicit sign), not a
 *     percentage — the percentage stays internal to threshold logic only.
 *  5. `createdByInitials` reuses this feature's existing
 *     `name.slice(0,2).toUpperCase()` convention (see
 *     `history-list-screen.tsx`'s mobile header), not a first+last-initial
 *     scheme.
 */
import { z } from 'zod';

// --- Shared primitives ------------------------------------------------------

/** A monetary or quantity value on the wire. Always a string (see header). */
const decimalString = z.string().regex(/^-?\d+(\.\d+)?$/, 'must be a decimal string');

/** Positive decimal — quantities that cannot be zero or negative. */
const positiveDecimalString = decimalString.refine((v) => Number(v) > 0, 'must be greater than zero');

const uuid = z.string().uuid();
const isoDate = z.string().datetime({ offset: true });

// --- Enums ------------------------------------------------------------------

/**
 * `null` means "no typical yield to compare against yet" (insufficient prep
 * history for this output item) — never used for a run that IS within the
 * normal band. See this file's header gap #3.
 */
export const yieldVarianceLabelSchema = z.enum(['normal', 'low yield', 'high yield']);

/** Query-filter form — single-word, matches the runs-list/History filter chips. */
export const yieldFlagFilterSchema = z.enum(['normal', 'low', 'high']);

// --- Prep runs ---------------------------------------------------------------

export const PrepRunInputsPreviewSchema = z.object({
  /** "6kg chicken" — see this file's header gap #2. */
  firstItemLabel: z.string(),
  remainingCount: z.number().int(),
});

export const PrepRunSummarySchema = z.object({
  id: uuid,
  when: isoDate,
  outputItemId: uuid,
  outputName: z.string(),
  inputsPreview: PrepRunInputsPreviewSchema,
  actualYield: decimalString,
  /** The output item's usage unit — see this file's header gap #1. */
  yieldUnit: z.string(),
  /** Null only when no typical yield exists yet for this output item. */
  yieldVarianceLabel: yieldVarianceLabelSchema.nullable(),
  /** Signed quantity delta, e.g. "+0.5" / "-1.2" — see this file's header gap #4. Null in lockstep with yieldVarianceLabel. */
  yieldVarianceDelta: z.string().nullable(),
  outputUnitCost: decimalString,
  createdByInitials: z.string(),
});

export const PrepRunInputLineSchema = z.object({
  itemName: z.string(),
  quantity: decimalString,
  unit: z.string(),
  unitCostAtRunTime: decimalString,
  lineCost: decimalString,
});

export const PrepRunDetailSchema = PrepRunSummarySchema.extend({
  createdByName: z.string(),
  createdAt: isoDate,
  inputLines: z.array(PrepRunInputLineSchema),
  totalInputCost: decimalString,
  /** Null in lockstep with yieldVarianceLabel/yieldVarianceDelta. */
  typicalYieldAtRunTime: decimalString.nullable(),
});

/**
 * The one write endpoint. Server computes totalInputCost, outputUnitCost,
 * typicalYieldAtRunTime, yieldVarianceLabel, notifiedStoreManager inside the
 * same $transaction that writes the ledger rows — none of these are
 * client-supplied (same trust boundary Milestone Two uses for
 * receiptTotal/price-alert fields). Plan §1.2, §1.3.
 */
export const CreatePrepRunSchema = z.object({
  outputItemId: uuid,
  inputLines: z
    .array(
      z.object({
        inventoryItemId: uuid,
        quantity: positiveDecimalString,
      }),
    )
    .min(1, 'at least one input line is required'),
  actualYield: positiveDecimalString,
});

export const ListPrepRunsQuerySchema = z.object({
  /** Matches output item name or attendant name. */
  search: z.string().trim().min(1).optional(),
  outputItemId: uuid.optional(),
  yieldFlag: yieldFlagFilterSchema.optional(),
  dateFrom: isoDate.optional(),
  dateTo: isoDate.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: uuid.optional(),
});

export const PrepSummarySchema = z.object({
  runsInRange: z.number().int(),
  totalInputCost: decimalString,
  yieldFlagCount: z.number().int(),
});

/**
 * `GET /inventory/prep/summary` — same dateFrom/dateTo params as
 * ListPrepRunsQuerySchema, so History's KPI strip stays scoped to the
 * active filter range (plan §3.2, owner's explicit request).
 */
export const PrepSummaryQuerySchema = z.object({
  dateFrom: isoDate.optional(),
  dateTo: isoDate.optional(),
});

/**
 * Powers the New Prep Run screen's "Typical: ~6kg chicken -> ~22L" nudge.
 * Null string fields + sampleSize: 0 on a never-prepped output item.
 */
export const TypicalYieldSchema = z.object({
  outputItemId: uuid,
  typicalInputSummary: z.string().nullable(),
  typicalYield: z.string().nullable(),
  sampleSize: z.number().int(),
});
