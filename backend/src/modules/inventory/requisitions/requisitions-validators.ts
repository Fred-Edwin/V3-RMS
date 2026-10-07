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

// ---------------------------------------------------------------------------
// Session B — Branch Manager approval. Appended as siblings; nothing above
// this line is mutated (Session A's contract is frozen — see file header).
// ---------------------------------------------------------------------------

/**
 * Approval-facing line. `onHand` is always null this milestone — no branch-
 * department ledger exists yet (see milestone-4-plan.md §7 Q1). Encoding it
 * as `z.null()` rather than omitting the field means Milestone Five can widen
 * it to `decimalString.nullable()` and the frontend renders real numbers with
 * zero frontend change.
 */
export const RequisitionApprovalLineSchema = z.object({
  id: uuid,
  inventoryItemId: uuid,
  itemName: z.string(),
  usageUnit: z.string(),
  categoryName: z.string().nullable(),
  parentCategoryName: z.string().nullable(),
  onHand: z.null(),
  parAtRequest: decimalString.nullable(),
  requestedQty: decimalString.nullable(),
  approvedQty: decimalString.nullable(),
  editReason: z.string().nullable(),
  isEdited: z.boolean(),
});

export const RequisitionApprovalSectionSchema = z.object({
  departmentTag: departmentTagSchema,
  status: requisitionSectionStatusSchema,
  managerNote: z.string().nullable(),
  returnedNote: z.string().nullable(),
  submittedAt: isoDate.nullable(),
  submittedByName: z.string().nullable(),
  isAsRequested: z.boolean(),
  changedLineCount: z.number().int().min(0),
  totalUnits: decimalString,
  lines: z.array(RequisitionApprovalLineSchema),
});

export const RequisitionApprovalDetailSchema = z.object({
  id: uuid,
  type: requisitionTypeSchema,
  note: z.string().nullable(),
  status: requisitionStatusSchema,
  openedAt: isoDate,
  approvedAt: isoDate.nullable(),
  approvedByName: z.string().nullable(),
  sections: z.array(RequisitionApprovalSectionSchema),
});

export const RequisitionManagerListRowSchema = z.object({
  id: uuid,
  type: requisitionTypeSchema,
  note: z.string().nullable(),
  status: requisitionStatusSchema,
  openedAt: isoDate,
  totalUnits: decimalString,
  sectionsSubmitted: z.number().int().min(0),
  sectionsTotal: z.number().int().min(0),
});

/**
 * `displayStatus` is derived, never stored: RETURNED = any section returned;
 * no DISPATCHED variant (not modelled until Milestone Five). `signedByName`
 * comes from `approvedBy` only, never `submittedBy` — a Paper mock shows a
 * Department Head signing in History, which is mock-data drift, not spec.
 */
export const requisitionDisplayStatusSchema = z.enum(['PENDING_APPROVAL', 'APPROVED', 'RETURNED']);

/**
 * Milestone Five addition (session-a-plan.md §1.4, additive only): one entry
 * per department this requisition has been dispatched for, so Requisition
 * History cross-links to the Dispatch/Delivery screens. Empty array when
 * nothing has been dispatched yet — not omitted, so the frontend never has
 * to special-case "field absent" vs. "no dispatches".
 */
export const RequisitionDispatchSummaryEntrySchema = z.object({
  dispatchId: uuid,
  departmentTag: departmentTagSchema,
  status: z.enum(['AWAITING', 'IN_TRANSIT', 'CONFIRMED', 'DISCREPANCY_OPEN']),
  sequenceLabel: z.string(),
});

export const RequisitionHistoryRowSchema = z.object({
  id: uuid,
  type: requisitionTypeSchema,
  note: z.string().nullable(),
  openedAt: isoDate,
  approvedAt: isoDate.nullable(),
  displayStatus: requisitionDisplayStatusSchema,
  signedByName: z.string().nullable(),
  totalUnits: decimalString,
  dispatchSummary: z.array(RequisitionDispatchSummaryEntrySchema),
});

// --- Requests ------------------------------------------------------------

const approvalLineEditSchema = z
  .object({
    id: uuid.optional(),
    inventoryItemId: uuid.optional(),
    approvedQty: nonNegativeDecimalString.nullable(),
    editReason: z.string().trim().min(1).optional(),
    deleted: z.boolean().optional(),
  })
  .refine((line) => Boolean(line.id) || Boolean(line.inventoryItemId), {
    message: 'each line must include either id (existing line) or inventoryItemId (new line)',
  });

export const UpsertApprovalLinesSchema = z.object({
  lines: z.array(approvalLineEditSchema),
  fillMyself: z.boolean().optional(),
});

export const ApproveRequisitionSchema = z.object({
  pin: z.string().regex(/^\d{4}$/, 'PIN must be 4 digits'),
});

export const ReturnSectionSchema = z.object({
  note: z.string().trim().min(1, 'A reason is required'),
});

export const ListRequisitionHistoryQuerySchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  status: requisitionDisplayStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: uuid.optional(),
  /**
   * Paged mode (the shared table, UI_BUILD_RULES §4a): with `page` the list is paged by `perPage` and the response carries a
   * `pagination` block with the true total after the status filter. `limit` and `cursor` still work on their own.
   */
  page: z.coerce.number().int().min(1).optional(),
  perPage: z.coerce.number().int().min(1).max(100).optional(),
});

export const ListNeedsApprovalQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
