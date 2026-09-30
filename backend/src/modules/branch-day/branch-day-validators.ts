/**
 * Branch day close, history & opening — Milestone Six, Sessions 3–4
 * FROZEN API CONTRACT — request/response schemas.
 *
 * Source of truth for `API_CONTRACT.md` §26.3. Frontend mirror:
 * `frontend/features/branch-day/types/branch-day.ts` (by hand).
 * Plan: `docs/features/inventory/milestone-6-plan.md` §1.4, §1.5, §2.3.
 *
 * Wire format: every decimal crosses as a string; business dates as
 * `YYYY-MM-DD` (Africa/Nairobi); instants as ISO-8601 with offset.
 */
import { z } from 'zod';

const decimalString = z.string().regex(/^-?\d+(\.\d+)?$/, 'must be a decimal string');
/** A physical count is never negative. */
const countQtyString = z.string().regex(/^\d+(\.\d+)?$/, 'must be a non-negative decimal string');
const uuid = z.string().uuid();
const isoDate = z.string().datetime({ offset: true });
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD');
const pin = z.string().min(4).max(12);

export const departmentTagSchema = z.enum(['KITCHEN', 'PASTRY', 'BARISTA', 'SERVICE', 'HOUSEKEEPING']);
export const branchDayStatusSchema = z.enum(['OPEN', 'CLOSED']);
/** `BLOCKED` / `COUNTING` / `CLOSED` are derived at read time — only NOT_STARTED / COUNTED are stored. */
export const departmentDayStatusSchema = z.enum(['NOT_STARTED', 'COUNTING', 'COUNTED', 'BLOCKED', 'CLOSED']);
export const gapReasonSchema = z.enum(['CONSUMPTION', 'UNLOGGED_WASTE', 'WALK_IN_COMP', 'SUSPECTED_LOSS', 'OTHER']);

export const GAP_REASON_LABEL: Record<z.infer<typeof gapReasonSchema>, string> = {
  CONSUMPTION: 'Consumption',
  UNLOGGED_WASTE: 'Unlogged waste',
  WALK_IN_COMP: 'Walk-in comp',
  SUSPECTED_LOSS: 'Suspected loss',
  OTHER: 'Other',
};

/** `OTHER` always needs a note — one rule for every place a reason is taken. */
const reasonPairRefinement = (v: { reason?: string | null; reasonNote?: string | null }): boolean =>
  v.reason !== 'OTHER' || (v.reasonNote ?? '').trim().length > 0;
const REASON_OTHER_MESSAGE = 'Describe the reason when you choose Other';

const userRef = z.object({ id: uuid, name: z.string() });

// --- Responses -----------------------------------------------------------------

export const BlockingDispatchSchema = z.object({ id: uuid, sequenceLabel: z.string() });

export const DepartmentDaySummarySchema = z.object({
  tag: departmentTagSchema,
  name: z.string(),
  status: departmentDayStatusSchema,
  blockingDispatches: z.array(BlockingDispatchSchema),
  countedBy: userRef.nullable(),
  countedAt: isoDate.nullable(),
  itemCount: z.number().int(),
  countedLines: z.number().int(),
  gapsAboveThreshold: z.number().int(),
  netAdjustmentValue: decimalString,
});

export const CloseBlockerSchema = z.object({
  code: z.enum(['NOT_COUNTED', 'BLOCKED', 'REASON_REQUIRED']),
  departmentTag: departmentTagSchema,
  message: z.string(),
});

export const BranchDayTodaySchema = z.object({
  id: uuid,
  reference: z.string(),
  date: dateOnly,
  status: branchDayStatusSchema,
  branchName: z.string(),
  closedAt: isoDate.nullable(),
  closedBy: userRef.nullable(),
  reopenCount: z.number().int(),
  departments: z.array(DepartmentDaySummarySchema),
  yesterday: z
    .object({ id: uuid, date: dateOnly, status: branchDayStatusSchema, closedAt: isoDate.nullable(), closedBy: userRef.nullable() })
    .nullable(),
  reasonRequiredKes: z.number().int(),
  canClose: z.boolean(),
  closeBlockers: z.array(CloseBlockerSchema),
});

export const DepartmentLineSchema = z.object({
  inventoryItemId: uuid,
  name: z.string(),
  usageUnit: z.string(),
  expectedQty: decimalString,
  countedQty: decimalString.nullable(),
  /** counted − expected; null until counted. */
  gap: decimalString.nullable(),
  /** gap × unit cost in KES; null until counted. */
  gapValue: decimalString.nullable(),
  unitCost: decimalString,
  reasonRequired: z.boolean(),
  reason: gapReasonSchema.nullable(),
  reasonNote: z.string().nullable(),
});

export const DepartmentDayDetailSchema = z.object({
  branchDayId: uuid,
  date: dateOnly,
  dayStatus: branchDayStatusSchema,
  closedAt: isoDate.nullable(),
  reasonRequiredKes: z.number().int(),
  summary: DepartmentDaySummarySchema,
  lines: z.array(DepartmentLineSchema),
});

export const SaveLinesResultSchema = z.object({
  savedAt: isoDate,
  detail: DepartmentDayDetailSchema,
});

export const CloseResultSchema = z.object({
  id: uuid,
  reference: z.string(),
  status: branchDayStatusSchema,
  closedAt: isoDate,
  adjustmentCount: z.number().int(),
  reversalCount: z.number().int(),
  netAdjustmentValue: decimalString,
  directorNotified: z.boolean(),
});

export const ReopenResultSchema = z.object({
  id: uuid,
  status: branchDayStatusSchema,
  reopenCount: z.number().int(),
});

export const DayDocumentSchema = z.object({
  id: uuid,
  reference: z.string(),
  date: dateOnly,
  branchName: z.string(),
  branchAddress: z.string(),
  branchPhone: z.string().nullable(),
  openedAt: isoDate,
  closedAt: isoDate,
  closedBy: userRef,
  reopenCount: z.number().int(),
  departments: z.array(
    z.object({ tag: departmentTagSchema, name: z.string(), items: z.number().int(), gaps: z.number().int(), status: z.literal('Closed') }),
  ),
  totals: z.object({ items: z.number().int(), gapLines: z.number().int(), netAdjustmentValue: decimalString }),
});

// --- Session 4 responses: history, detail, opening ----------------------------------

export const HistoryRowSchema = z.object({
  id: uuid,
  reference: z.string(),
  date: dateOnly,
  status: branchDayStatusSchema,
  reopenCount: z.number().int(),
  closedAt: isoDate.nullable(),
  closedBy: userRef.nullable(),
  departmentsClosed: z.number().int(),
  departmentsTotal: z.number().int(),
  gapLines: z.number().int(),
  netAdjustmentValue: decimalString,
});

export const HistoryListSchema = z.object({
  from: dateOnly,
  to: dateOnly,
  days: z.array(HistoryRowSchema),
});

export const ReopenEntrySchema = z.object({
  id: uuid,
  reopenedBy: userRef,
  reopenedAt: isoDate,
  reason: z.string(),
});

export const BranchDayDetailSchema = z.object({
  id: uuid,
  reference: z.string(),
  date: dateOnly,
  status: branchDayStatusSchema,
  branchName: z.string(),
  closedAt: isoDate.nullable(),
  closedBy: userRef.nullable(),
  reopenCount: z.number().int(),
  kpis: z.object({
    departmentsClosed: z.number().int(),
    departmentsTotal: z.number().int(),
    totalGaps: z.number().int(),
    netAdjustmentValue: decimalString,
    reopens: z.number().int(),
  }),
  departments: z.array(z.object({ summary: DepartmentDaySummarySchema, lines: z.array(DepartmentLineSchema) })),
  reopens: z.array(ReopenEntrySchema),
});

export const OpeningLineSchema = z.object({
  inventoryItemId: uuid,
  name: z.string(),
  usageUnit: z.string(),
  /** Department on-hand the ledger shows now (or, once accepted, when it was accepted). */
  prefilledQty: decimalString,
  /** Null until accepted. */
  acceptedQty: decimalString.nullable(),
  /** accepted − prefilled; null until accepted. */
  overnightVariance: decimalString.nullable(),
  unitCost: decimalString,
});

export const OpeningViewSchema = z.object({
  branchDayId: uuid,
  date: dateOnly,
  departmentTag: departmentTagSchema,
  departmentName: z.string(),
  status: z.enum(['PENDING', 'ACCEPTED']),
  /** When last night's close was signed; null when yesterday was never closed. */
  lastCloseAt: isoDate.nullable(),
  acceptedAt: isoDate.nullable(),
  acceptedBy: userRef.nullable(),
  varianceLineCount: z.number().int(),
  lines: z.array(OpeningLineSchema),
});

export const AcceptOpeningResultSchema = z.object({
  openingId: uuid,
  acceptedAt: isoDate,
  varianceLineCount: z.number().int(),
  adjustmentCount: z.number().int(),
  managerNotified: z.boolean(),
});

// --- Requests --------------------------------------------------------------------

export const BranchDayParamsSchema = z.object({ id: uuid });
export const DepartmentParamsSchema = z.object({ id: uuid, tag: departmentTagSchema });

/** One line per item; `countedQty: null` clears a count. Partial saves are fine. */
export const SaveDepartmentLinesSchema = z
  .object({
    lines: z
      .array(
        z
          .object({
            inventoryItemId: uuid,
            countedQty: countQtyString.nullable(),
            reason: gapReasonSchema.nullable().optional(),
            reasonNote: z.string().trim().max(500).nullable().optional(),
          })
          .strict()
          .refine(reasonPairRefinement, { message: REASON_OTHER_MESSAGE, path: ['reasonNote'] }),
      )
      .min(1)
      .max(500),
  })
  .strict();

export const CloseDaySchema = z.object({ pin }).strict();
export const ReopenDaySchema = z.object({ reason: z.string().trim().min(1, 'A reason is required').max(500) }).strict();

const MAX_RANGE_DAYS = 92;

export const HistoryQuerySchema = z
  .object({ from: dateOnly, to: dateOnly })
  .strict()
  .refine((v) => v.from <= v.to, { message: '`from` must not be after `to`', path: ['from'] })
  .refine((v) => (Date.parse(v.to) - Date.parse(v.from)) / 86_400_000 <= MAX_RANGE_DAYS, {
    message: `The range can span at most ${MAX_RANGE_DAYS} days`,
    path: ['to'],
  });

/** Every item the department head is shown; omitted items are accepted at their pre-filled figure. */
export const AcceptOpeningSchema = z
  .object({
    lines: z.array(z.object({ inventoryItemId: uuid, acceptedQty: countQtyString }).strict()).max(500),
  })
  .strict();
