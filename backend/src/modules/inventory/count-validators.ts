/**
 * Inventory — Milestone Six, Session 2 (Central Store counting)
 * FROZEN API CONTRACT — request/response schemas.
 *
 * Source of truth for `API_CONTRACT.md` §26.2. Frontend mirror:
 * `frontend/features/inventory/types/count.ts` (by hand).
 * Plan: `docs/features/inventory/milestone-6-plan.md` §1.1, §1.2, §2.2.
 *
 * Wire format: every decimal crosses as a string; business dates as
 * `YYYY-MM-DD` (Africa/Nairobi); instants as ISO-8601 with offset.
 *
 * **Blind count (enforced server-side).** `AttendantCountView` is a separate
 * response schema. Zod object schemas strip unknown keys on `parse`, so a
 * field that is not declared here (expected quantity, variance, on-hand,
 * unit cost) cannot reach the attendant even if the service object carries
 * it. The service parses every attendant-facing response through these
 * schemas, and `count-contract.test.ts` asserts on the serialized JSON.
 */
import { z } from 'zod';

const decimalString = z.string().regex(/^-?\d+(\.\d+)?$/, 'must be a decimal string');
/** A physical count is never negative. */
const countQtyString = z.string().regex(/^\d+(\.\d+)?$/, 'must be a non-negative decimal string');
const uuid = z.string().uuid();
const isoDate = z.string().datetime({ offset: true });
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD');
const pin = z.string().min(4).max(12);

export const countKindSchema = z.enum(['DAILY', 'SPOT']);
export const countStatusSchema = z.enum(['DRAFT', 'SUBMITTED', 'RETURNED', 'VERIFIED']);
export const countLineDecisionSchema = z.enum(['PENDING', 'ACCEPTED', 'QUERIED']);
export const countReasonSchema = z.enum([
  'SUSPECTED_MISCOUNT',
  'UNLOGGED_SPOILAGE',
  'SUSPECTED_LOSS',
  'WITHIN_NORMAL_RANGE',
  'OTHER',
]);

export const COUNT_REASON_LABEL: Record<z.infer<typeof countReasonSchema>, string> = {
  SUSPECTED_MISCOUNT: 'Suspected miscount',
  UNLOGGED_SPOILAGE: 'Unlogged spoilage',
  SUSPECTED_LOSS: 'Suspected loss',
  WITHIN_NORMAL_RANGE: 'Within normal range',
  OTHER: 'Other',
};

/** `OTHER` always needs a note — one rule for every place a reason is taken. */
const reasonPairRefinement = (v: { reason?: string | null; reasonNote?: string | null }): boolean =>
  v.reason !== 'OTHER' || (v.reasonNote ?? '').trim().length > 0;
const REASON_OTHER_MESSAGE = 'Describe the reason when you choose Other';

// --- Attendant (blind) -------------------------------------------------------

export const AttendantCountLineSchema = z.object({
  inventoryItemId: uuid,
  name: z.string(),
  usageUnit: z.string(),
  categoryId: uuid.nullable(),
  categoryName: z.string(),
  countedQty: countQtyString.nullable(),
  /** RETURNED: only queried lines are editable. */
  editable: z.boolean(),
  /** The Store Manager's per-line note. Never states the expected figure. */
  queryNote: z.string().nullable(),
});

export const AttendantCountCategorySchema = z.object({
  /** Top-level category id; null = uncategorized. */
  id: uuid.nullable(),
  name: z.string(),
  total: z.number().int(),
  counted: z.number().int(),
});

export const AttendantCountViewSchema = z.object({
  id: uuid,
  reference: z.string(),
  countDate: dateOnly,
  status: countStatusSchema,
  counterName: z.string(),
  totals: z.object({ counted: z.number().int(), total: z.number().int() }),
  categories: z.array(AttendantCountCategorySchema),
  /** DRAFT: every line. RETURNED: the queried lines only. SUBMITTED / VERIFIED: none. */
  lines: z.array(AttendantCountLineSchema),
  /** Last partial save ("Saved 07:08"). */
  savedAt: isoDate.nullable(),
  submittedAt: isoDate.nullable(),
  returnNote: z.string().nullable(),
  returnedAt: isoDate.nullable(),
  returnedByName: z.string().nullable(),
});

export const SaveCountLinesSchema = z
  .object({
    lines: z
      .array(z.object({ inventoryItemId: uuid, countedQty: countQtyString.nullable() }).strict())
      .min(1)
      .max(1000),
  })
  .strict();

export const AttendantSaveResultSchema = z.object({
  savedAt: isoDate,
  counted: z.number().int(),
  total: z.number().int(),
});

export const SubmitCountSchema = z.object({ pin }).strict();

export const AttendantSubmitResultSchema = z.object({
  id: uuid,
  reference: z.string(),
  status: countStatusSchema,
  submittedAt: isoDate,
  counted: z.number().int(),
  total: z.number().int(),
});

// --- Store Manager (verifier) -----------------------------------------------

export const VerifierCountLineSchema = z.object({
  lineId: uuid,
  inventoryItemId: uuid,
  name: z.string(),
  usageUnit: z.string(),
  categoryName: z.string(),
  /** null = not counted (never adjusted). */
  countedQty: countQtyString.nullable(),
  /** Snapshot at the attendant's sign; null while still DRAFT. */
  expectedQty: decimalString.nullable(),
  variance: decimalString.nullable(),
  /** Signed KES: variance × unit cost, 2dp. */
  varianceValue: decimalString.nullable(),
  unitCost: decimalString.nullable(),
  decision: countLineDecisionSchema,
  reason: countReasonSchema.nullable(),
  reasonNote: z.string().nullable(),
  /** Stored when the variance was computed — moving a threshold never changes it. */
  reasonRequired: z.boolean(),
  /** |variance value| ≥ the Director amount. */
  directorAlert: z.boolean(),
  queryNote: z.string().nullable(),
  /** The figure before a send-back cleared the line for a blind recount. */
  firstCountedQty: countQtyString.nullable(),
  /** ADJ-#### once approved and non-zero. */
  adjustmentReference: z.string().nullable(),
  adjustmentTransactionId: uuid.nullable(),
});

export const CountTotalsSchema = z.object({
  /** Counted lines. */
  lines: z.number().int(),
  uncountedLines: z.number().int(),
  matchedLines: z.number().int(),
  varianceLines: z.number().int(),
  /** Variance lines whose reason is required. */
  aboveThreshold: z.number().int(),
  queriedLines: z.number().int(),
  netVarianceValue: decimalString,
});

export const CountThresholdsInForceSchema = z.object({
  reasonRequiredKes: z.number().int(),
  directorAlertKes: z.number().int(),
});

export const VerifierCountViewSchema = z.object({
  id: uuid,
  reference: z.string(),
  kind: countKindSchema,
  countDate: dateOnly,
  status: countStatusSchema,
  counter: z.object({ id: uuid, name: z.string() }),
  counterSignedAt: isoDate.nullable(),
  verifier: z.object({ id: uuid, name: z.string() }).nullable(),
  verifiedAt: isoDate.nullable(),
  returnNote: z.string().nullable(),
  returnedAt: isoDate.nullable(),
  directorNotified: z.boolean(),
  totals: CountTotalsSchema,
  thresholds: CountThresholdsInForceSchema,
  lines: z.array(VerifierCountLineSchema),
});

// --- List -------------------------------------------------------------------

export const ListCountsQuerySchema = z.object({
  kind: countKindSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const CountListItemSchema = z.object({
  id: uuid,
  reference: z.string(),
  kind: countKindSchema,
  countDate: dateOnly,
  status: countStatusSchema,
  counterName: z.string(),
  counterSignedAt: isoDate.nullable(),
  verifierName: z.string().nullable(),
  verifiedAt: isoDate.nullable(),
  /** Counted lines. */
  itemCount: z.number().int(),
  totalLines: z.number().int(),
  varianceLines: z.number().int(),
  /** Adjustments written (VERIFIED only). */
  adjustmentCount: z.number().int(),
  netVarianceValue: decimalString,
  directorNotified: z.boolean(),
});

export const CountListSchema = z.object({ counts: z.array(CountListItemSchema) });

// --- Verify actions -----------------------------------------------------------

export const CountParamsSchema = z.object({ id: uuid });
export const CountLineParamsSchema = z.object({ id: uuid, lineId: uuid });

export const DecideLineSchema = z
  .object({
    decision: z.enum(['ACCEPTED', 'QUERIED', 'PENDING']),
    reason: countReasonSchema.nullish(),
    reasonNote: z.string().trim().max(500).nullish(),
    queryNote: z.string().trim().max(500).nullish(),
  })
  .strict()
  .refine(reasonPairRefinement, { message: REASON_OTHER_MESSAGE, path: ['reasonNote'] });

export const ReturnCountSchema = z.object({ note: z.string().trim().min(1).max(500) }).strict();

export const ApproveCountSchema = z.object({ pin }).strict();

export const ApproveCountResultSchema = z.object({
  count: VerifierCountViewSchema,
  adjustmentsWritten: z.number().int(),
  netAdjustmentValue: decimalString,
  directorNotified: z.boolean(),
});

/** Send-back returns the refreshed view so the desktop detail can re-render in place. */
export const ReturnCountResultSchema = z.object({ count: VerifierCountViewSchema });

// --- Spot count ---------------------------------------------------------------

export const SpotCountSchema = z
  .object({
    lines: z
      .array(
        z
          .object({
            inventoryItemId: uuid,
            countedQty: countQtyString,
            reason: countReasonSchema.nullish(),
            reasonNote: z.string().trim().max(500).nullish(),
          })
          .strict()
          .refine(reasonPairRefinement, { message: REASON_OTHER_MESSAGE, path: ['reasonNote'] }),
      )
      .min(1)
      .max(50),
    pin,
  })
  .strict()
  .refine((v) => new Set(v.lines.map((l) => l.inventoryItemId)).size === v.lines.length, {
    message: 'An item can only appear once in a spot count',
    path: ['lines'],
  });

export const SpotCountResultSchema = ApproveCountResultSchema;

// --- Print ------------------------------------------------------------------

export const CountPrintSchema = z.object({
  reference: z.string(),
  kind: countKindSchema,
  countDate: dateOnly,
  status: countStatusSchema,
  locationName: z.string(),
  totals: CountTotalsSchema,
  /** Every line that produced an adjustment, largest |value| first. */
  adjustments: z.array(
    z.object({
      itemName: z.string(),
      usageUnit: z.string(),
      variance: decimalString,
      reference: z.string(),
      value: decimalString,
      reason: z.string().nullable(),
    }),
  ),
  /** Director-alert lines, named for the printed note. */
  directorAlertItems: z.array(z.object({ itemName: z.string(), variance: decimalString, usageUnit: z.string() })),
  directorNotified: z.boolean(),
  counter: z.object({ name: z.string(), roleLabel: z.string(), signedAt: isoDate.nullable() }),
  verifier: z.object({ name: z.string(), roleLabel: z.string(), signedAt: isoDate.nullable() }).nullable(),
  generatedAt: isoDate,
});
