/**
 * Inventory — Prep rebuild
 * FROZEN API CONTRACT — request and response schemas for all 17 endpoints.
 *
 * Source of truth: docs/features/inventory/prep-plan.md §3 and
 * docs/API_CONTRACT.md §33. The front end mirrors this file by hand in
 * `frontend/features/inventory/prep/_shared/types/prep-contract.ts`; a test
 * parses the same sample payloads on both sides (`prep-contract.test.ts`).
 *
 * Wire rules: decimals are STRINGS (never JS numbers), ids are strings,
 * timestamps are ISO 8601 UTC, dates are `YYYY-MM-DD` read as Africa/Nairobi
 * days. Fields marked "cap" are present only when the caller holds that
 * capability (see central-store-access.ts) and are otherwise absent.
 *
 * Do not change a shape here without changing §33, the mirror and the test
 * in the same commit.
 */
import { z } from 'zod';

// --- Primitives -------------------------------------------------------------

/** A quantity or money value on the wire: always a string. */
export const decimalString = z.string().regex(/^-?\d+(\.\d+)?$/, 'must be a decimal string');

/** A quantity that must be greater than zero. */
export const positiveDecimal = decimalString.refine((v) => Number(v) > 0, 'must be greater than zero');

const uuid = z.string().uuid();
const isoDateTime = z.string().datetime({ offset: true });
const nairobiDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD');
const unit = z.string().min(1);

// --- Enums ------------------------------------------------------------------

export const PREP_RUN_STATUSES = ['RECORDED', 'CORRECTED', 'CANCELLED'] as const;
export const prepRunStatusSchema = z.enum(PREP_RUN_STATUSES);
export type PrepRunStatus = z.infer<typeof prepRunStatusSchema>;

export const yieldReasonSchema = z.enum(['TRIMMED_MORE', 'SPILLAGE', 'BURNT', 'OTHER']);
export const correctReasonSchema = z.enum(['TYPO', 'WRONG_ITEM', 'WRONG_QUANTITY', 'OTHER']);
export const cancelReasonSchema = z.enum(['ENTERED_TWICE', 'NEVER_MADE', 'WRONG_ITEM', 'OTHER']);
export const recipeReasonSchema = z.enum(['BETTER_RECIPE', 'PORTION_SIZE_CHANGED', 'NEW_SUPPLIER', 'OTHER']);
export type YieldReason = z.infer<typeof yieldReasonSchema>;
export type CorrectReason = z.infer<typeof correctReasonSchema>;
export type CancelReason = z.infer<typeof cancelReasonSchema>;
export type RecipeReason = z.infer<typeof recipeReasonSchema>;

// --- Shared shapes (plan §3.1) ----------------------------------------------

export const vsUsualSchema = z.object({
  label: z.enum(['ON_TARGET', 'LOW', 'HIGH', 'NO_BASIS']),
  /** Signed, "−2" / "+0.3"; null for NO_BASIS. */
  deltaAmount: z.string().nullable(),
  /** Ready to show: "on target", "−2 kg · low yield". */
  text: z.string(),
});
export type VsUsual = z.infer<typeof vsUsualSchema>;

export const expectedYieldSchema = z.object({
  amount: z.string().nullable(),
  unit,
  source: z.enum(['RECIPE', 'PAST_RUNS', 'NONE']),
  /** "about 76 portions" or "about 3 kg, from past runs". */
  text: z.string(),
});
export type ExpectedYield = z.infer<typeof expectedYieldSchema>;

export const personSchema = z.object({
  id: z.string(),
  name: z.string(),
  initials: z.string(),
  /** "Store Attendant" */
  roleLabel: z.string(),
});
export type Person = z.infer<typeof personSchema>;

export const runLineSchema = z.object({
  itemId: z.string(),
  itemName: z.string(),
  quantity: decimalString,
  unit,
  /** cap prep.see_costs */
  unitCost: decimalString.optional(),
  lineCost: decimalString.optional(),
  /** Stock at run time; cap restock.read */
  onHand: decimalString.optional(),
  /** Silent flag; cap prep.read_flags */
  exceedsStock: z.boolean().optional(),
});
export type RunLine = z.infer<typeof runLineSchema>;

const runRefSchema = z.object({ id: z.string(), reference: z.string(), at: isoDateTime });

export const runSummarySchema = z.object({
  id: z.string(),
  /** "PREP-0131" */
  reference: z.string(),
  at: isoDateTime,
  outputItemId: z.string(),
  outputName: z.string(),
  /** "6 kg beef mince" + 1 more */
  inputsPreview: z.object({ firstLabel: z.string(), moreCount: z.number().int().nonnegative() }),
  made: decimalString,
  unit,
  vsUsual: vsUsualSchema,
  status: prepRunStatusSchema,
  /** replacesRunId is set */
  isCorrection: z.boolean(),
  by: personSchema,
  /** Recorded by the caller. */
  mine: z.boolean(),
  /** cap prep.see_costs */
  outputUnitCost: decimalString.optional(),
  /** cap prep.read_flags */
  needsLook: z.boolean().optional(),
  reviewedBy: personSchema.nullable().optional(),
  reviewedAt: isoDateTime.nullable().optional(),
});
export type RunSummary = z.infer<typeof runSummarySchema>;

export const changeRowSchema = z.object({
  itemName: z.string(),
  was: z.string().nullable(),
  now: z.string().nullable(),
  unit,
  /** cap prep.see_costs */
  costNow: decimalString.optional(),
});
export type ChangeRow = z.infer<typeof changeRowSchema>;

export const runDetailSchema = runSummarySchema.extend({
  inputs: z.array(runLineSchema),
  /** cap prep.see_costs */
  totalInputCost: decimalString.optional(),
  /** The figure the run was judged against (the snapshot). */
  expected: expectedYieldSchema,
  recipeVersion: z.number().int().nullable(),
  yieldReason: yieldReasonSchema.nullable(),
  yieldReasonNote: z.string().nullable(),
  /** cap prep.read_flags; notify = over 35% (in-app flag only). */
  flags: z
    .object({
      yield: z.enum(['LOW', 'HIGH']).nullable(),
      notify: z.boolean(),
      stockExceeded: z.boolean(),
      exceedsText: z.string().nullable(),
    })
    .optional(),
  replaces: runRefSchema.nullable(),
  replacedBy: runRefSchema.nullable(),
  correction: z
    .object({
      reason: z.string(),
      note: z.string().nullable(),
      by: personSchema,
      at: isoDateTime,
      changed: z.array(changeRowSchema),
      unitCostBefore: decimalString.optional(),
      unitCostAfter: decimalString.optional(),
    })
    .nullable(),
  cancellation: z
    .object({ reason: z.string(), note: z.string().nullable(), by: personSchema, at: isoDateTime })
    .nullable(),
  /** "Recorded as PREP-0130 · Sarah Achieng" */
  timeline: z.array(z.object({ at: isoDateTime, text: z.string() })),
  /** For THIS caller. lockedReason is "Ask the Store Manager" after 24 h. */
  can: z.object({
    correct: z.boolean(),
    cancel: z.boolean(),
    review: z.boolean(),
    lockedReason: z.string().nullable(),
  }),
  /** The Attendant's "until tomorrow 07:20". */
  windowEndsAt: isoDateTime.nullable(),
});
export type RunDetail = z.infer<typeof runDetailSchema>;

// --- Recipes (#1-3) ---------------------------------------------------------

export const recipesQuerySchema = z.object({
  search: z.string().trim().optional(),
  show: z.enum(['all', 'has', 'none']).default('all'),
  changed: z.enum(['any', '30d', 'older']).default('any'),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});
export type RecipesQuery = z.infer<typeof recipesQuerySchema>;

export const recipeRowSchema = z.object({
  itemId: z.string(),
  itemName: z.string(),
  unit,
  recipe: z
    .object({
      /** "10 kg chicken, cut · 1 kg garlic-ginger paste" */
      ingredientsText: z.string(),
      targetYield: decimalString,
      mainItemName: z.string(),
      version: z.number().int(),
      lastChangedAt: isoDateTime,
      lastChangedBy: personSchema,
    })
    .nullable(),
  /** "about 3 kg"; shown when recipe is null. */
  pastRunsAverageText: z.string().nullable(),
});
export type RecipeRow = z.infer<typeof recipeRowSchema>;

export const recipesListSchema = z.object({
  items: z.array(recipeRowSchema),
  total: z.number().int(),
  totalItems: z.number().int(),
  withoutRecipe: z.number().int(),
});

export const recipeDetailSchema = z.object({
  itemId: z.string(),
  itemName: z.string(),
  unit,
  current: z
    .object({
      version: z.number().int(),
      targetYield: decimalString,
      lines: z.array(
        z.object({ itemId: z.string(), itemName: z.string(), unit, amount: decimalString, isMain: z.boolean() }),
      ),
      changedAt: isoDateTime,
      changedBy: personSchema,
      reason: recipeReasonSchema.nullable(),
    })
    .nullable(),
  /** Step 26 "Use these"; only when current is null. */
  suggestFromLastRun: z
    .object({
      lines: z.array(z.object({ itemId: z.string(), itemName: z.string(), unit, amount: decimalString })),
      made: decimalString,
      basedOn: z.string(),
    })
    .nullable(),
  /** cap prep.see_costs, "about KES 121 per portion" */
  costPerUnitNow: decimalString.optional(),
  history: z.array(
    z.object({
      version: z.number().int(),
      at: isoDateTime,
      by: personSchema,
      reason: recipeReasonSchema.nullable(),
      reasonNote: z.string().nullable(),
    }),
  ),
});
export type RecipeDetail = z.infer<typeof recipeDetailSchema>;

/** Exactly one isMain, no duplicate item, no line equal to the output item (checked by the service). */
export const recipeInputSchema = z.object({
  targetYield: positiveDecimal,
  lines: z
    .array(z.object({ itemId: uuid, amount: positiveDecimal, isMain: z.boolean() }))
    .min(1)
    .max(30),
  reason: recipeReasonSchema.optional(),
  reasonNote: z.string().trim().max(300).optional(),
});
export type RecipeInput = z.infer<typeof recipeInputSchema>;

// --- Recording (#4-7) -------------------------------------------------------

export const inputLineSchema = z.object({ itemId: uuid, quantity: positiveDecimal });
export type InputLine = z.infer<typeof inputLineSchema>;

export const checkInputSchema = z.object({
  outputItemId: uuid,
  inputs: z.array(inputLineSchema).min(1).max(30),
  made: positiveDecimal.optional(),
});
export type CheckInput = z.infer<typeof checkInputSchema>;

export const recordInputSchema = z.object({
  idempotencyKey: uuid,
  outputItemId: uuid,
  inputs: z.array(inputLineSchema).min(1).max(30),
  made: positiveDecimal,
  yieldReason: yieldReasonSchema.optional(),
  reasonNote: z.string().trim().max(300).optional(),
});
export type RecordInput = z.infer<typeof recordInputSchema>;

const lastRunSchema = z.object({
  inputs: z.array(z.object({ itemId: z.string(), quantity: decimalString })),
  made: decimalString,
});

export const outputsResponseSchema = z.object({
  items: z.array(
    z.object({
      itemId: z.string(),
      name: z.string(),
      unit,
      hasRecipe: z.boolean(),
      expectedText: z.string().nullable(),
      lastRun: lastRunSchema.nullable(),
    }),
  ),
});

export const prepAgainResponseSchema = z.object({
  tiles: z
    .array(
      z.object({
        itemId: z.string(),
        name: z.string(),
        ingredientsText: z.string(),
        expectedText: z.string().nullable(),
        lastRun: lastRunSchema.nullable(),
      }),
    )
    .max(3),
});

export const checkResultSchema = z.object({
  expected: expectedYieldSchema,
  /** null until `made` is sent. */
  vsUsual: vsUsualSchema.nullable(),
  /** ≤15% / >15% / >35%. NOTIFY shows to managers as a flag only. */
  tier: z.enum(['ON_TARGET', 'WARN', 'NOTIFY']).nullable(),
  /** made > 3x or < 1/3 of expected; warns, never blocks. */
  typoSuspect: z.object({ suspect: z.boolean(), text: z.string().nullable() }),
  /** Same output, same input amounts, within the last 2 hours (RECORDED runs). */
  repeat: z.object({ duplicate: z.boolean(), of: runRefSchema.nullable() }),
  usualRecipeText: z.string().nullable(),
  /** Recipe exists but the run does not use its main ingredient. */
  mainIngredientMissing: z.boolean(),
  /** cap prep.see_costs */
  cost: z.object({ totalInput: decimalString, perUnit: decimalString.nullable() }).optional(),
  /** cap restock.read */
  stock: z.array(z.object({ itemId: z.string(), onHand: decimalString, exceeds: z.boolean() })).optional(),
});
export type CheckResult = z.infer<typeof checkResultSchema>;

// --- Runs (#8-10) -----------------------------------------------------------

export const runsQuerySchema = z.object({
  search: z.string().trim().optional(),
  outputItemId: uuid.optional(),
  personId: uuid.optional(),
  status: prepRunStatusSchema.optional(),
  needsLook: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  mine: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  from: nairobiDate.optional(),
  to: nairobiDate.optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});
export type RunsQuery = z.infer<typeof runsQuerySchema>;

export const runsListSchema = z.object({
  items: z.array(runSummarySchema),
  total: z.number().int(),
  page: z.number().int(),
  perPage: z.number().int(),
});

export const runsSummarySchema = z.object({
  runsThisWeek: z.number().int(),
  runsToday: z.number().int(),
  needsLookCount: z.number().int(),
  /** cap prep.see_costs */
  prepValue7d: decimalString.optional(),
});

// --- Fixing a slip (#11-13) -------------------------------------------------

export const correctInputSchema = z.object({
  idempotencyKey: uuid,
  inputs: z.array(inputLineSchema).min(1).max(30),
  made: positiveDecimal,
  reason: correctReasonSchema,
  reasonNote: z.string().trim().max(300).optional(),
  yieldReason: yieldReasonSchema.optional(),
});
export type CorrectInput = z.infer<typeof correctInputSchema>;

export const cancelInputSchema = z.object({
  reason: cancelReasonSchema,
  reasonNote: z.string().trim().max(300).optional(),
});
export type CancelInput = z.infer<typeof cancelInputSchema>;

export const cancelPreviewSchema = z.object({
  items: z.array(
    z.object({
      itemId: z.string(),
      itemName: z.string(),
      onHandNow: decimalString,
      onHandAfter: decimalString,
      unit,
      belowZero: z.boolean(),
    }),
  ),
});

// --- Oversight (#14-17) -----------------------------------------------------

export const needsLookQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});

export const needsLookListSchema = z.object({
  count: z.number().int(),
  items: z.array(runSummarySchema.extend({ reasons: z.array(z.string()) })),
});

export const needsLookCountSchema = z.object({ count: z.number().int() });

/** Same filters as #8 without paging. */
export const exportQuerySchema = runsQuerySchema.omit({ page: true, perPage: true });
export type ExportQuery = z.infer<typeof exportQuerySchema>;

// --- Error codes (stable; the front end switches on these) ------------------

export const PREP_ERROR_CODES = [
  'RECIPE_UNCHANGED',
  'REASON_REQUIRED',
  'MAIN_INGREDIENT_REQUIRED',
  'INPUT_IS_OUTPUT',
  'DUPLICATE_INPUT_LINE',
  'QUANTITY_NOT_POSITIVE',
  'PREP_RUN_LOCKED',
  'RUN_NOT_OPEN',
  'EXPORT_TOO_LARGE',
] as const;
export type PrepErrorCode = (typeof PREP_ERROR_CODES)[number];
