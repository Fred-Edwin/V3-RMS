/**
 * Inventory — Milestone Four (Requisition & Branch Approval), Session A
 * FROZEN API CONTRACT (Session A subset) — request/response schemas.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ Source of truth for the 6 Department-Head endpoints built this session. │
 * │ `frontend/features/requisitions/types/index.ts` mirrors it by hand (no  │
 * │ shared package in this repo).                                          │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Plan: `docs/features/inventory/milestone-4-sessions/session-a-plan.md`.
 * Session B adds the branch-manager-facing endpoints (approve/return/edit) —
 * not built here.
 *
 * Wire-format rule (inherited from §22, non-negotiable): every decimal
 * crosses the wire as a **string**, never a JS number. Prisma stores them as
 * Decimal; coercing to number loses precision.
 *
 * `parAtRequest` is `Decimal?` (nullable) — a deliberate deviation from the
 * milestone plan's original non-nullable sketch (session-a-plan.md decision
 * #2). Null means no `RestockLevel` exists yet for this branch
 * department/item — expected to be common until Milestone One's par-setting
 * flow is used per-branch.
 */
import { z } from 'zod';

// --- Shared primitives -------------------------------------------------------

/** A quantity value on the wire. Always a string (see header). */
const decimalString = z.string().regex(/^-?\d+(\.\d+)?$/, 'must be a decimal string');

/** Positive decimal — quantities that cannot be zero or negative. */
const positiveDecimalString = decimalString.refine((v) => Number(v) > 0, 'must be greater than zero');

/** Non-negative decimal — zero allowed (zero-not-delete), negative rejected. */
const nonNegativeDecimalString = decimalString.refine((v) => Number(v) >= 0, 'must not be negative');

const uuid = z.string().uuid();
const isoDate = z.string().datetime({ offset: true });

// --- Enums --------------------------------------------------------------------

export const requisitionTypeSchema = z.enum(['MORNING', 'AFTERNOON', 'EVENING', 'AD_HOC']);
export const requisitionStatusSchema = z.enum(['OPEN', 'PENDING_APPROVAL', 'APPROVED']);
export const requisitionSectionStatusSchema = z.enum(['NOT_STARTED', 'DRAFT', 'SUBMITTED', 'RETURNED']);
export const departmentTagSchema = z.enum(['KITCHEN', 'PASTRY', 'BARISTA', 'SERVICE', 'HOUSEKEEPING']);

// --- Requisitions (list / open) -----------------------------------------------

/**
 * `mySectionStatus` is the only per-department status surfaced to a
 * Department Head — never other departments' sections (the cross-department
 * authorization guard applies to the read shape too, not just writes).
 */
export const RequisitionListRowSchema = z.object({
  id: uuid,
  type: requisitionTypeSchema,
  note: z.string().nullable(),
  status: requisitionStatusSchema,
  openedAt: isoDate,
  mySectionStatus: requisitionSectionStatusSchema,
});

export const OpenRequisitionSchema = z.object({
  type: requisitionTypeSchema,
  note: z.string().trim().min(1).optional(),
});

export const ListRequisitionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

// --- Section fill (Department Head) -------------------------------------------

export const DepartmentTagParamSchema = z.object({
  departmentTag: departmentTagSchema,
});

export const RequisitionSectionParamsSchema = z.object({
  id: uuid,
  departmentTag: departmentTagSchema,
});

export const RequisitionSectionLineSchema = z.object({
  id: uuid,
  inventoryItemId: uuid,
  itemName: z.string(),
  usageUnit: z.string(),
  categoryName: z.string().nullable(),
  parentCategoryName: z.string().nullable(),
  /** Reference only — null when no RestockLevel exists for this branch department/item yet. */
  parAtRequest: decimalString.nullable(),
  requestedQty: decimalString.nullable(),
});

export const RequisitionSectionDetailSchema = z.object({
  requisitionId: uuid,
  departmentTag: departmentTagSchema,
  status: requisitionSectionStatusSchema,
  managerNote: z.string().nullable(),
  returnedNote: z.string().nullable(),
  submittedAt: isoDate.nullable(),
  lines: z.array(RequisitionSectionLineSchema),
});

/**
 * Bulk upsert: existing line qty edits (including "0", zero-not-delete) +
 * new lines (add-item). `requestedQty` allows "0" but rejects negative, so
 * `nonNegativeDecimalString` (not `positiveDecimalString`) is used here —
 * the refine below still requires either `id` (existing line) or
 * `inventoryItemId` (new line).
 */
const UpsertRequisitionLineSchema = z
  .object({
    id: uuid.optional(),
    inventoryItemId: uuid.optional(),
    requestedQty: nonNegativeDecimalString.nullable(),
  })
  .refine((line) => Boolean(line.id) || Boolean(line.inventoryItemId), {
    message: 'each line must include either id (existing line) or inventoryItemId (new line)',
  });

export const UpsertRequisitionLinesSchema = z.object({
  lines: z.array(UpsertRequisitionLineSchema),
  managerNote: z.string().trim().optional(),
});

export { positiveDecimalString };
