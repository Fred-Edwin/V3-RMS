/**
 * Inventory — Milestone Five (Dispatch & Branch Receiving), Session A.
 * FROZEN API CONTRACT (Session A subset) — request/response schemas.
 *
 * Wire-format rule (inherited from §22/§25, non-negotiable): every decimal
 * crosses the wire as a **string**, never a JS number.
 *
 * Plan: `docs/features/inventory/milestone-5-sessions/session-a-plan.md`,
 * `docs/features/inventory/milestone-5-plan.md` §2.
 */
import { z } from 'zod';

// --- Shared primitives -------------------------------------------------------

const decimalString = z.string().regex(/^-?\d+(\.\d+)?$/, 'must be a decimal string');
const nonNegativeDecimalString = decimalString.refine((v) => Number(v) >= 0, 'must not be negative');
const uuid = z.string().uuid();
const isoDate = z.string().datetime({ offset: true });

// --- Enums --------------------------------------------------------------------

export const departmentTagSchema = z.enum(['KITCHEN', 'PASTRY', 'BARISTA', 'SERVICE', 'HOUSEKEEPING']);
export const dispatchStatusSchema = z.enum(['AWAITING', 'IN_TRANSIT', 'CONFIRMED', 'DISCREPANCY_OPEN']);

// --- Dispatch queue (C1/C2) ----------------------------------------------------

export const DispatchQueueRowSchema = z.object({
  requisitionId: uuid,
  toSiteId: uuid,
  branchName: z.string(),
  requisitionType: z.enum(['MORNING', 'AFTERNOON', 'EVENING', 'AD_HOC']),
  openedAt: isoDate,
  departments: z.array(
    z.object({
      departmentTag: departmentTagSchema,
      status: dispatchStatusSchema.nullable(), // null = approved, not yet dispatched
      totalUnits: decimalString,
      dispatchId: uuid.nullable(),
    }),
  ),
});

export const ListDispatchQueueQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

// --- Fulfil detail (C2) ---------------------------------------------------------

export const FulfilLineSchema = z.object({
  requisitionLineId: uuid.nullable(),
  inventoryItemId: uuid,
  itemName: z.string(),
  usageUnit: z.string(),
  requestedQty: decimalString.nullable(),
  onHandQty: decimalString,
  dispatchQty: decimalString, // pre-filled min(requested, onHand); editable client-side before submit
  isSubstitute: z.boolean(),
  substituteNote: z.string().nullable(),
});

export const FulfilSectionSchema = z.object({
  departmentTag: departmentTagSchema,
  status: z.enum(['NOT_STARTED', 'DRAFT', 'SUBMITTED', 'RETURNED']),
  dispatchStatus: dispatchStatusSchema.nullable(),
  dispatchId: uuid.nullable(),
  lines: z.array(FulfilLineSchema),
});

export const FulfilDetailSchema = z.object({
  requisitionId: uuid,
  toSiteId: uuid,
  branchName: z.string(),
  requisitionType: z.enum(['MORNING', 'AFTERNOON', 'EVENING', 'AD_HOC']),
  openedAt: isoDate,
  sections: z.array(FulfilSectionSchema),
});

const fulfilLineInputSchema = z
  .object({
    requisitionLineId: uuid.nullable().optional(),
    inventoryItemId: uuid,
    dispatchQty: nonNegativeDecimalString,
    isSubstitute: z.boolean().optional(),
    substituteNote: z.string().trim().optional(),
  })
  .refine((line) => !line.isSubstitute || Boolean(line.substituteNote), {
    message: 'A substitute line requires a note',
  });

export const FulfilDepartmentSchema = z.object({
  lines: z.array(fulfilLineInputSchema),
  pin: z.string().regex(/^\d{4}$/, 'PIN must be 4 digits'),
});

export const DispatchRequisitionParamsSchema = z.object({
  requisitionId: uuid,
});

export const DispatchDepartmentParamsSchema = z.object({
  requisitionId: uuid,
  departmentTag: departmentTagSchema,
});

// --- Delivery note (C3) ----------------------------------------------------------

export const DeliveryNoteLineSchema = z.object({
  inventoryItemId: uuid,
  itemName: z.string(),
  usageUnit: z.string(),
  requestedQty: decimalString.nullable(),
  dispatchedQty: decimalString,
  confirmedQty: decimalString.nullable(),
  isSubstitute: z.boolean(),
  substituteNote: z.string().nullable(),
});

export const DeliveryNoteSchema = z.object({
  id: uuid,
  sequenceLabel: z.string(),
  status: dispatchStatusSchema,
  departmentTag: departmentTagSchema,
  branchName: z.string(),
  dispatchedByName: z.string().nullable(),
  dispatchedAt: isoDate.nullable(),
  confirmedByName: z.string().nullable(),
  confirmedAt: isoDate.nullable(),
  confirmedOnBehalf: z.boolean(),
  lines: z.array(DeliveryNoteLineSchema),
});

export const DispatchIdParamSchema = z.object({
  id: uuid,
});

// --- Deliveries / confirm (C4/C5, Session B) --------------------------------

export const ListDeliveriesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const confirmLineInputSchema = z.object({
  dispatchLineId: uuid,
  confirmedQty: nonNegativeDecimalString,
});

export const ConfirmDeliverySchema = z.object({
  lines: z.array(confirmLineInputSchema).min(1),
  pin: z.string().regex(/^\d{4}$/, 'PIN must be 4 digits'),
});

export const DeliveryLineSchema = z.object({
  dispatchLineId: uuid,
  inventoryItemId: uuid,
  itemName: z.string(),
  usageUnit: z.string(),
  requestedQty: decimalString.nullable(),
  dispatchedQty: decimalString,
  confirmedQty: decimalString.nullable(),
  isSubstitute: z.boolean(),
  substituteNote: z.string().nullable(),
});

export const DeliveryRowSchema = z.object({
  id: uuid,
  sequenceLabel: z.string(),
  status: dispatchStatusSchema,
  departmentTag: departmentTagSchema,
  branchName: z.string(),
  dispatchedByName: z.string().nullable(),
  dispatchedAt: isoDate.nullable(),
  confirmedByName: z.string().nullable(),
  confirmedAt: isoDate.nullable(),
  confirmedOnBehalf: z.boolean(),
  lines: z.array(DeliveryLineSchema),
});

// --- Discrepancy (C6/C7, Session B) -----------------------------------------

export const discrepancyStatusSchema = z.enum(['OPEN', 'RESOLVED']);
export const discrepancyOutcomeSchema = z.enum(['FOUND_REDELIVERED', 'TRANSIT_LOSS_WRITEOFF', 'MISCOUNT_CORRECTED']);

/**
 * `limit` is the original "newest N" cap and still works on its own. `page` / `perPage` / `status` / `search` are the shared
 * table's (UI_BUILD_RULES §4a): when `page` is given the list pages by `perPage` and `limit` is ignored. The response always
 * carries a `pagination` block next to `data`, so existing readers of `data` are unchanged.
 */
export const ListDiscrepanciesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  status: discrepancyStatusSchema.optional(),
  search: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).optional(),
  /** Defaults to 50 when `page` is given. */
  perPage: z.coerce.number().int().min(1).max(100).optional(),
});

export const DiscrepancyRowSchema = z.object({
  id: uuid,
  referenceNumber: z.string(),
  status: discrepancyStatusSchema,
  outcome: discrepancyOutcomeSchema.nullable(),
  gapQty: decimalString,
  createdAt: isoDate,
  resolvedAt: isoDate.nullable(),
  resolvedByName: z.string().nullable(),
  branchName: z.string(),
  departmentTag: departmentTagSchema,
  dispatchSequenceLabel: z.string(),
  itemName: z.string(),
  usageUnit: z.string(),
  dispatchedQty: decimalString,
  confirmedQty: decimalString.nullable(),
});

export const DiscrepancyDetailSchema = DiscrepancyRowSchema.extend({
  resolutionNote: z.string().nullable(),
  followUpDispatchId: uuid.nullable(),
  costAtDispatch: decimalString,
  confirmedByName: z.string().nullable(),
  confirmedAt: isoDate.nullable(),
});

export const DiscrepancyIdParamSchema = z.object({
  id: uuid,
});

export const ResolveDiscrepancySchema = z.object({
  outcome: discrepancyOutcomeSchema,
  resolutionNote: z.string().trim().min(1, 'A resolution note is required'),
  pin: z.string().regex(/^\d{4}$/, 'PIN must be 4 digits'),
});
