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
  toOrganizationId: uuid,
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
  toOrganizationId: uuid,
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
