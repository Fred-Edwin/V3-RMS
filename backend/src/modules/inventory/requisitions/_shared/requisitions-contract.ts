/**
 * Inventory: Requisitions rebuild (Block 1)
 * FROZEN API CONTRACT: request and response schemas for R1 to R22 (R23 to R26 are in `departments/_shared/departments-contract.ts`).
 *
 * Source of truth: docs/features/inventory/requisitions-contract.md (§4, the screens in §13) and the Paper page
 * "Inventory · Requisition and dispatch" (steps 1 to 22 including 7b and 18b; gap fix G1). The front end mirrors this file by
 * hand in `frontend/features/inventory/requisitions/_shared/types/requisitions-contract.ts`; the shared sample payloads are
 * in `requisitions-contract.fixtures.json` (parsed by `requisitions-contract.test.ts`, typed by the mirror's test).
 *
 * Wire rules: `_shared/wire.ts` (decimals are strings, ids strings, ISO times, Nairobi dates). A field marked "cap" is ABSENT,
 * never null, unless the caller holds that capability. Money is `valueKes` / `*ValueKes` (cap `requisitions.see_value`).
 * Stock figures (`onHand`, `level`) follow the blind rule (`_shared/blind-rule.ts`) and the department rule for heads.
 * Screens read the `can` flags and test whether a key is present, never a role name.
 *
 * Status names on the wire are the DATABASE enum names (the expand migration keeps them); `statusText` carries the words
 * ("Collecting", "Ready to approve"). Signing writes (R13, R19, R20, R21, R22) take `{ pin }` and an `Idempotency-Key`
 * header; a repeated key returns the first result with `replayed: true`. R11 carries its key in the body, as the contract says.
 *
 * Do not change a shape here without changing the contract document, the mirror and the fixtures in the same commit, and only
 * with the owner's approval.
 */
import { z } from 'zod';
import {
  decimalString,
  isoDateTime,
  nairobiDate,
  nonNegativeDecimal,
  pageInfoSchema,
  pageQuerySchema,
  personSchema,
  positiveDecimal,
  uuid,
} from '../../_shared/wire';

export const IDEMPOTENCY_HEADER = 'Idempotency-Key';
export const idempotencyKeySchema = z.string().min(8).max(64);

/** The 4-digit PIN every signing write carries. Never logged, never returned. */
export const pinSchema = z.string().regex(/^\d{4}$/, 'PIN must be 4 digits');

// --- Words and enums -----------------------------------------------------------

/** The cycles new code writes. Old EVENING and AD_HOC rows are read as EXTRA (the migration maps them). */
export const REQUISITION_CYCLES = ['MORNING', 'AFTERNOON', 'EXTRA'] as const;
export const requisitionCycleSchema = z.enum(REQUISITION_CYCLES);
export type RequisitionCycle = z.infer<typeof requisitionCycleSchema>;
export const CYCLE_TEXT: Record<RequisitionCycle, string> = { MORNING: 'Morning', AFTERNOON: 'Afternoon', EXTRA: 'Extra' };

/** Database names. OPEN = Collecting, PENDING_APPROVAL = Ready to approve. */
export const REQUISITION_STATUSES = ['OPEN', 'PENDING_APPROVAL', 'APPROVED', 'CANCELLED', 'CLOSED'] as const;
export const requisitionStatusSchema = z.enum(REQUISITION_STATUSES);
export type RequisitionStatus = z.infer<typeof requisitionStatusSchema>;
export const REQUISITION_STATUS_TEXT: Record<RequisitionStatus, string> = {
  OPEN: 'Collecting',
  PENDING_APPROVAL: 'Ready to approve',
  APPROVED: 'Approved',
  CANCELLED: 'Cancelled',
  CLOSED: 'Closed',
};

/** Database names. SUBMITTED is shown as "Sent". RETURNED is never written by new code and never appears on the wire. */
export const SECTION_STATUSES = ['NOT_STARTED', 'DRAFT', 'SUBMITTED', 'SKIPPED'] as const;
export const sectionStatusSchema = z.enum(SECTION_STATUSES);
export type SectionStatus = z.infer<typeof sectionStatusSchema>;
export const SECTION_STATUS_TEXT: Record<SectionStatus, string> = {
  NOT_STARTED: 'Not started',
  DRAFT: 'Draft',
  SUBMITTED: 'Sent',
  SKIPPED: 'Sent without this section',
};

export const ADDITION_STATUSES = ['PENDING', 'APPROVED', 'CANCELLED'] as const;
export const additionStatusSchema = z.enum(ADDITION_STATUSES);
export type AdditionStatus = z.infer<typeof additionStatusSchema>;

/** The seven stage tabs of the list (Paper steps 7 and 7b). */
export const REQUISITION_TABS = ['collecting', 'to-approve', 'to-pack', 'on-the-way', 'to-confirm', 'discrepancies', 'closed'] as const;
export const requisitionTabSchema = z.enum(REQUISITION_TABS);
export type RequisitionTab = z.infer<typeof requisitionTabSchema>;
export const tabCountsSchema = z.object({
  collecting: z.number().int().nonnegative(),
  'to-approve': z.number().int().nonnegative(),
  'to-pack': z.number().int().nonnegative(),
  'on-the-way': z.number().int().nonnegative(),
  'to-confirm': z.number().int().nonnegative(),
  discrepancies: z.number().int().nonnegative(),
  closed: z.number().int().nonnegative(),
});
export type TabCounts = z.infer<typeof tabCountsSchema>;

/** Each write is one `RequisitionEvent` type (contract §8). */
export const EVENT_TYPES = [
  'STARTED',
  'LINE_CHANGED',
  'SENT',
  'RECALLED',
  'QUANTITY_CHANGED',
  'SKIPPED',
  'NUDGED',
  'URGENT_SET',
  'URGENT_CLEARED',
  'APPROVED',
  'CANCELLED',
  'ADDITION_ADDED',
  'ADDITION_APPROVED',
] as const;
export const eventTypeSchema = z.enum(EVENT_TYPES);
export type EventType = z.infer<typeof eventTypeSchema>;

/** The one main action of the Next step card (Paper step 22, "main button"). Null when the card has no button. */
export const NEXT_STEP_ACTIONS = ['SEND_SECTION', 'NUDGE', 'APPROVE_AND_SIGN', 'ADD_TO_THIS_REQUISITION', 'APPROVE_ADDITION', 'PRINT', 'START_A_NEW_ONE'] as const;
export const nextStepActionSchema = z.enum(NEXT_STEP_ACTIONS);
export type NextStepAction = z.infer<typeof nextStepActionSchema>;

// --- Shared pieces --------------------------------------------------------------

export const branchRefSchema = z.object({ id: uuid, name: z.string(), /** "NYR" */ code: z.string().nullable() });
export type BranchRef = z.infer<typeof branchRefSchema>;

/** One line of a section, as the head edits it and the manager reviews it (Paper steps 2, 3, 8, 9, 12). */
export const requisitionLineSchema = z.object({
  id: uuid,
  itemId: uuid,
  itemName: z.string(),
  unit: z.string(),
  /** Category names from the top: ["Dairy"], or two levels for Kitchen: ["Proteins", "Chicken"]. */
  categoryPath: z.array(z.string()),
  requestedQty: nonNegativeDecimal,
  /** Null until the Branch Manager approves (or edits). */
  approvedQty: nonNegativeDecimal.nullable(),
  /** What the screen pre-filled (restock level minus on hand), for "changed from 27". Null for a line the head added. */
  suggestedQty: nonNegativeDecimal.nullable(),
  /** cap restock.read, or the head of this department: "On hand 9" under the item name. */
  onHand: decimalString.optional(),
  /** cap restock.read, or the head of this department: "Restock level 36" under the item name. */
  level: decimalString.optional(),
  /** The head changed the pre-filled number. */
  changedFromSuggested: z.boolean(),
  /** The Branch Manager changed the Approved quantity (the head is told). */
  changedByManager: z.boolean(),
  /** The manager's optional reason chip text, when they gave one. */
  changeReason: z.string().nullable(),
  /** Set when the line belongs to an "Added after approval" block. */
  additionId: uuid.nullable(),
  /** cap requisitions.see_value: approvedQty (requestedQty before approval) × unit cost (frozen at approval once approved), KES. */
  valueKes: decimalString.optional(),
});
export type RequisitionLine = z.infer<typeof requisitionLineSchema>;

/** One department's section: the rail entry and, with `lines`, the pane (Paper steps 8 and 11). */
export const sectionSummarySchema = z.object({
  departmentId: uuid,
  departmentName: z.string(),
  status: sectionStatusSchema,
  statusText: z.string(),
  head: personSchema.nullable(),
  sentAt: isoDateTime.nullable(),
  sentBy: personSchema.nullable(),
  skippedAt: isoDateTime.nullable(),
  skippedBy: personSchema.nullable(),
  lineCount: z.number().int().nonnegative(),
  /** Lines the Branch Manager changed ("1 changed"). */
  changedCount: z.number().int().nonnegative(),
  /** cap requisitions.see_value */
  valueKes: decimalString.optional(),
});
export type SectionSummary = z.infer<typeof sectionSummarySchema>;

export const sectionDetailSchema = sectionSummarySchema.extend({
  noteForManager: z.string().nullable(),
  lines: z.array(requisitionLineSchema),
  /** Which actions the caller may take on this section now. */
  can: z.object({ edit: z.boolean(), send: z.boolean(), recall: z.boolean(), nudge: z.boolean(), skip: z.boolean(), fillMyself: z.boolean(), changeQuantity: z.boolean() }),
});
export type SectionDetail = z.infer<typeof sectionDetailSchema>;

/** The "Added after approval" block (Paper steps 15 and 16). Its lines also appear in `lines` of the section, marked by `additionId`. */
export const additionSchema = z.object({
  id: uuid,
  departmentId: uuid,
  departmentName: z.string(),
  status: additionStatusSchema,
  statusText: z.string(),
  addedBy: personSchema,
  addedAt: isoDateTime,
  approvedBy: personSchema.nullable(),
  approvedAt: isoDateTime.nullable(),
  lines: z.array(requisitionLineSchema),
  /** cap requisitions.see_value */
  valueKes: decimalString.optional(),
  can: z.object({ approve: z.boolean() }),
});
export type Addition = z.infer<typeof additionSchema>;

/** One step of the tracker, with the date and who (Paper steps 8, 12, 13). */
export const trackerStepSchema = z.object({
  key: z.enum(['STARTED', 'ALL_IN', 'APPROVED', 'PACKED', 'DELIVERED', 'CLOSED']),
  label: z.string(),
  state: z.enum(['DONE', 'CURRENT', 'TODO']),
  at: isoDateTime.nullable(),
  by: personSchema.nullable(),
});
export type TrackerStep = z.infer<typeof trackerStepSchema>;

export const nextStepSchema = z.object({
  /** "Housekeeping hasn't sent yet" · "Everything is in. Ready for your signature." */
  title: z.string(),
  text: z.string().nullable(),
  action: nextStepActionSchema.nullable(),
  actionLabel: z.string().nullable(),
  /** The department the action is about (Nudge Housekeeping). */
  departmentId: uuid.nullable(),
});
export type NextStep = z.infer<typeof nextStepSchema>;

/** A dispatch of this requisition. Empty until Block 2 fills it; the shape is fixed now so the file page need not change. */
export const dispatchRefSchema = z.object({
  id: uuid,
  /** "DSP-NYR-0112" */
  reference: z.string(),
  departmentId: uuid,
  status: z.string(),
  statusText: z.string(),
});
export type DispatchRef = z.infer<typeof dispatchRefSchema>;

// --- R1 GET / the list (Paper steps 7, 7b) ---------------------------------------

/** cap requisitions.read; a head gets their own department's rows only. `tab` omitted = the caller's own tab. */
export const listRequisitionsQuerySchema = pageQuerySchema.extend({
  tab: requisitionTabSchema.optional(),
  branchId: uuid.optional(),
  q: z.string().trim().min(1).optional(),
  from: nairobiDate.optional(),
  to: nairobiDate.optional(),
  status: requisitionStatusSchema.optional(),
});
export type ListRequisitionsQuery = z.infer<typeof listRequisitionsQuerySchema>;

export const requisitionRowSchema = z.object({
  id: uuid,
  /** "REQ-NYR-0112" */
  reference: z.string(),
  cycle: requisitionCycleSchema,
  /** "Afternoon · Wed 7 Oct" */
  cycleLabel: z.string(),
  branch: branchRefSchema,
  status: requisitionStatusSchema,
  statusText: z.string(),
  /** The tab the row sits in. */
  tab: requisitionTabSchema,
  sections: z.array(z.object({ departmentId: uuid, departmentName: z.string(), status: sectionStatusSchema })),
  lineCount: z.number().int().nonnegative(),
  /** cap requisitions.see_value */
  valueKes: decimalString.optional(),
  openedAt: isoDateTime,
  urgent: z.boolean(),
  /** Urgent and unapproved for more than 1 hour (the Director's list, step 18b). */
  urgentOverHour: z.boolean(),
  /** An addition is waiting for approval (shown in To approve). */
  additionWaiting: z.boolean(),
  /** The row action for this caller: "Nudge Housekeeping", "Open and approve". Null when the row has none. */
  rowAction: z.object({ action: nextStepActionSchema, label: z.string(), departmentId: uuid.nullable() }).nullable(),
});
export type RequisitionRow = z.infer<typeof requisitionRowSchema>;

export const listRequisitionsSchema = z.object({
  /** The tab the rows are for (the caller's own when none was asked). */
  tab: requisitionTabSchema,
  rows: z.array(requisitionRowSchema),
  tabCounts: tabCountsSchema,
  /** The dark badge: what waits for this caller. */
  waitingForYou: z.number().int().nonnegative(),
  /** Hub roles only: the branch picker. */
  branches: z.array(branchRefSchema).optional(),
  page: pageInfoSchema,
});
export type ListRequisitions = z.infer<typeof listRequisitionsSchema>;

// --- R2 GET /badges ------------------------------------------------------------

/** Only the keys that apply to the caller's role are present. `requisitions` is the sidebar badge. */
export const badgesSchema = z.object({
  requisitions: z.number().int().nonnegative(),
  toApprove: z.number().int().nonnegative().optional(),
  toPack: z.number().int().nonnegative().optional(),
  /** Block 2: a head's deliveries to confirm. */
  deliveries: z.number().int().nonnegative().optional(),
});
export type Badges = z.infer<typeof badgesSchema>;

// --- R3 GET /:id the file (Paper steps 8, 11, 12, 13, 14) -----------------------

/** For a head, `sections` holds their own department only and `additions` only theirs. */
export const requisitionFileSchema = z.object({
  id: uuid,
  reference: z.string(),
  cycle: requisitionCycleSchema,
  cycleLabel: z.string(),
  branch: branchRefSchema,
  status: requisitionStatusSchema,
  statusText: z.string(),
  urgent: z.boolean(),
  urgentAt: isoDateTime.nullable(),
  urgentOverHour: z.boolean(),
  openedBy: personSchema,
  openedAt: isoDateTime,
  /** The signer, with the role they signed as (Branch Manager, Director or System Admin). */
  approvedBy: personSchema.nullable(),
  approvedAt: isoDateTime.nullable(),
  cancelled: z.object({ at: isoDateTime, by: personSchema, reason: z.string() }).nullable(),
  closedAt: isoDateTime.nullable(),
  tracker: z.array(trackerStepSchema),
  nextStep: nextStepSchema,
  sections: z.array(sectionDetailSchema),
  additions: z.array(additionSchema),
  /** Empty until Block 2. */
  dispatches: z.array(dispatchRefSchema),
  lineCount: z.number().int().nonnegative(),
  /** cap requisitions.see_value */
  valueKes: decimalString.optional(),
  can: z.object({
    nudge: z.boolean(),
    skip: z.boolean(),
    changeQuantity: z.boolean(),
    approve: z.boolean(),
    cancel: z.boolean(),
    setUrgent: z.boolean(),
    addToIt: z.boolean(),
    print: z.boolean(),
    startNew: z.boolean(),
  }),
});
export type RequisitionFile = z.infer<typeof requisitionFileSchema>;

// --- R4 GET /:id/activity -------------------------------------------------------

export const activityEventSchema = z.object({
  id: uuid,
  type: eventTypeSchema,
  at: isoDateTime,
  actor: personSchema,
  /** "Approved REQ-NYR-0112 · 40 lines · signed with PIN" */
  sentence: z.string(),
  departmentId: uuid.nullable(),
  lineId: uuid.nullable(),
  fromValue: z.string().nullable(),
  toValue: z.string().nullable(),
  reason: z.string().nullable(),
  /** A record link drawn in the document-name colour: "DSP-NYR-0112". */
  link: z.object({ kind: z.enum(['REQUISITION', 'DISPATCH', 'DISCREPANCY']), id: uuid, reference: z.string() }).nullable(),
});
export type ActivityEvent = z.infer<typeof activityEventSchema>;
export const activitySchema = z.object({ events: z.array(activityEventSchema) });
export type Activity = z.infer<typeof activitySchema>;

// --- R5 GET /:id/documents ------------------------------------------------------

/** The printed requisition versions: one at approval, one after each approved addition. */
export const documentsSchema = z.object({
  documents: z.array(
    z.object({
      id: uuid,
      version: z.number().int().min(1),
      /** "Requisition · approved" · "Requisition · with 2 added lines" */
      label: z.string(),
      at: isoDateTime,
      by: personSchema,
    }),
  ),
});
export type Documents = z.infer<typeof documentsSchema>;

// --- R6 GET /:id/print (Paper step 17) ------------------------------------------

/** The data for the A4: a cover plus one page per department. NO MONEY anywhere in this payload (a test pins it). */
export const printPageLineSchema = z.object({
  n: z.number().int().min(1),
  itemName: z.string(),
  unit: z.string(),
  requestedQty: nonNegativeDecimal,
  approvedQty: nonNegativeDecimal,
  /** Approved differs from requested: drawn as the requested number struck through. */
  changed: z.boolean(),
});
export const printSchema = z.object({
  reference: z.string(),
  branch: branchRefSchema,
  cycleLabel: z.string(),
  urgent: z.boolean(),
  approvedAt: isoDateTime.nullable(),
  approvedBy: personSchema.nullable(),
  cover: z.object({
    departments: z.array(z.object({ departmentId: uuid, departmentName: z.string(), lineCount: z.number().int().nonnegative(), page: z.number().int().min(2), dispatchReference: z.string().nullable() })),
    managerChanges: z.array(z.object({ departmentName: z.string(), itemName: z.string(), from: z.string(), to: z.string(), reason: z.string().nullable() })),
    additionsCount: z.number().int().nonnegative(),
  }),
  pages: z.array(
    z.object({
      departmentId: uuid,
      departmentName: z.string(),
      lines: z.array(printPageLineSchema),
      additions: z.array(z.object({ addedAt: isoDateTime, addedBy: personSchema, approvedBy: personSchema.nullable(), lines: z.array(printPageLineSchema) })),
    }),
  ),
  /** What the QR code carries: a link to the file. */
  qrPayload: z.string(),
});
export type Print = z.infer<typeof printSchema>;

// --- R7 GET /home (a head; Paper steps 1, 14) ------------------------------------

export const homeSchema = z.object({
  department: z.object({ id: uuid, name: z.string() }),
  /** Chosen by time of day; the head can switch to Morning, Afternoon or Extra. */
  suggestedCycle: requisitionCycleSchema,
  /** The open requisition for the suggested cycle, with the head's own section; null = "Start the afternoon requisition". */
  open: z
    .object({
      requisitionId: uuid,
      reference: z.string(),
      cycle: requisitionCycleSchema,
      cycleLabel: z.string(),
      status: requisitionStatusSchema,
      statusText: z.string(),
      urgent: z.boolean(),
      section: sectionSummarySchema,
      can: z.object({ edit: z.boolean(), recall: z.boolean(), addToIt: z.boolean() }),
    })
    .nullable(),
  earlierToday: z.array(
    z.object({ requisitionId: uuid, reference: z.string(), cycleLabel: z.string(), status: requisitionStatusSchema, statusText: z.string(), sectionStatus: sectionStatusSchema, lineCount: z.number().int().nonnegative() }),
  ),
});
export type Home = z.infer<typeof homeSchema>;

// --- R8 GET /:id/sections/:departmentId (the head's editing screen; Paper steps 2 to 4) -------

/** One item the head may add to this section (tagged to the department). The screen searches this list; there is no search endpoint. */
export const addableItemSchema = z.object({
  itemId: uuid,
  itemName: z.string(),
  unit: z.string(),
  categoryPath: z.array(z.string()),
  /** Restock level minus on hand, floored at zero: what the screen would pre-fill. */
  suggestedQty: nonNegativeDecimal,
  onHand: decimalString.optional(),
  level: decimalString.optional(),
  inSection: z.boolean(),
});
export const sectionEditSchema = z.object({
  requisitionId: uuid,
  reference: z.string(),
  cycleLabel: z.string(),
  requisitionStatus: requisitionStatusSchema,
  urgent: z.boolean(),
  section: sectionDetailSchema,
  addable: z.array(addableItemSchema),
});
export type SectionEdit = z.infer<typeof sectionEditSchema>;

// --- R9 GET /history/mine (gap fix G1) -------------------------------------------

export const historyMineQuerySchema = pageQuerySchema.extend({
  from: nairobiDate.optional(),
  to: nairobiDate.optional(),
  status: requisitionStatusSchema.optional(),
});
export type HistoryMineQuery = z.infer<typeof historyMineQuerySchema>;
/** No money, no other departments. */
export const historyMineSchema = z.object({
  rows: z.array(
    z.object({
      requisitionId: uuid,
      reference: z.string(),
      cycleLabel: z.string(),
      status: requisitionStatusSchema,
      statusText: z.string(),
      sectionStatus: sectionStatusSchema,
      lineCount: z.number().int().nonnegative(),
      openedAt: isoDateTime,
    }),
  ),
  page: pageInfoSchema,
});
export type HistoryMine = z.infer<typeof historyMineSchema>;

// --- R10 GET /:id/approve-summary (Paper step 11) -------------------------------

export const approveSummarySchema = z.object({
  requisitionId: uuid,
  reference: z.string(),
  lineCount: z.number().int().nonnegative(),
  /** cap requisitions.see_value */
  valueKes: decimalString.optional(),
  departments: z.array(z.object({ departmentId: uuid, departmentName: z.string(), status: sectionStatusSchema, lineCount: z.number().int().nonnegative(), valueKes: decimalString.optional() })),
  /** What the manager changed: "Kitchen · Milk 30 to 24". */
  changes: z.array(z.object({ departmentName: z.string(), itemName: z.string(), from: z.string(), to: z.string(), reason: z.string().nullable() })),
  /** "One signature covers the whole requisition." */
  signatureLine: z.string(),
  /** The role the caller would sign as; the record shows it. */
  signingAs: z.enum(['BRANCH_MANAGER', 'DIRECTOR', 'SYSTEM_ADMIN']),
});
export type ApproveSummary = z.infer<typeof approveSummarySchema>;

// --- Write results ---------------------------------------------------------------

/** What every write returns besides its own payload: enough to update the screen; the file is refetched. */
export const mutationResultSchema = z.object({
  requisitionId: uuid,
  reference: z.string(),
  status: requisitionStatusSchema,
  statusText: z.string(),
  /** A repeated Idempotency-Key returned the first result. */
  replayed: z.boolean(),
});
export type MutationResult = z.infer<typeof mutationResultSchema>;

// --- R11 POST / start -------------------------------------------------------------

/** A head (own branch) or `requisitions.start`. Creates a section per active department; the starter's is pre-filled. */
export const startRequisitionInputSchema = z
  .object({ cycle: requisitionCycleSchema, urgent: z.boolean().optional(), idempotencyKey: idempotencyKeySchema })
  .strict();
export type StartRequisitionInput = z.infer<typeof startRequisitionInputSchema>;
/** 201, or 200 with `replayed: true`. 409 `REQUISITION_ALREADY_OPEN` when one is open for the cycle. */
export const startRequisitionResultSchema = mutationResultSchema;

// --- R12 PUT /:id/sections/:departmentId/lines ------------------------------------

/** The whole draft. Only items tagged to the department; quantities above zero; no duplicate item. A sent section reopens as Draft. */
export const saveLinesInputSchema = z
  .object({
    lines: z.array(z.object({ itemId: uuid, requestedQty: positiveDecimal }).strict()).max(300),
    noteForManager: z.string().trim().max(500).nullable().optional(),
  })
  .strict()
  .refine((v) => new Set(v.lines.map((l) => l.itemId)).size === v.lines.length, 'An item can be on a section once');
export type SaveLinesInput = z.infer<typeof saveLinesInputSchema>;
/** The response is the updated `SectionDetail`. */

// --- R13 POST /:id/sections/:departmentId/send ------------------------------------

export const sendSectionInputSchema = z.object({ pin: pinSchema }).strict();
export type SendSectionInput = z.infer<typeof sendSectionInputSchema>;
export const sendSectionResultSchema = mutationResultSchema.extend({
  section: sectionSummarySchema,
  /** Every active section is Sent or Skipped: the requisition is now Ready to approve. */
  readyToApprove: z.boolean(),
});
export type SendSectionResult = z.infer<typeof sendSectionResultSchema>;

// --- R14 POST /:id/sections/:departmentId/recall (no body) ------------------------

export const recallSectionResultSchema = mutationResultSchema.extend({ section: sectionSummarySchema });
export type RecallSectionResult = z.infer<typeof recallSectionResultSchema>;

// --- R15 PUT /:id/urgent -----------------------------------------------------------

export const setUrgentInputSchema = z.object({ urgent: z.boolean() }).strict();
export type SetUrgentInput = z.infer<typeof setUrgentInputSchema>;
export const setUrgentResultSchema = mutationResultSchema.extend({ urgent: z.boolean(), urgentAt: isoDateTime.nullable() });
export type SetUrgentResult = z.infer<typeof setUrgentResultSchema>;

// --- R16 PATCH /:id/lines/:lineId --------------------------------------------------

/** `reason` is the chip text or typed words; it is REQUIRED after approval (the service refuses without it). */
export const changeQuantityInputSchema = z.object({ approvedQty: nonNegativeDecimal, reason: z.string().trim().min(1).max(200).optional() }).strict();
export type ChangeQuantityInput = z.infer<typeof changeQuantityInputSchema>;
export const changeQuantityResultSchema = mutationResultSchema.extend({
  line: requisitionLineSchema,
  section: sectionSummarySchema,
  /** cap requisitions.see_value */
  valueKes: decimalString.optional(),
});
export type ChangeQuantityResult = z.infer<typeof changeQuantityResultSchema>;

// --- R17 POST /:id/sections/:departmentId/nudge (no body) --------------------------

export const nudgeResultSchema = mutationResultSchema.extend({ nudgedAt: isoDateTime });
export type NudgeResult = z.infer<typeof nudgeResultSchema>;

// --- R18 POST /:id/sections/:departmentId/skip (no body) ---------------------------

export const skipSectionResultSchema = mutationResultSchema.extend({ section: sectionSummarySchema, readyToApprove: z.boolean() });
export type SkipSectionResult = z.infer<typeof skipSectionResultSchema>;

// --- R19 POST /:id/approve ----------------------------------------------------------

export const approveInputSchema = z.object({ pin: pinSchema }).strict();
export type ApproveInput = z.infer<typeof approveInputSchema>;
export const approveResultSchema = mutationResultSchema.extend({
  approvedAt: isoDateTime,
  /** The signer; the record shows the role they signed as. */
  approvedBy: personSchema,
  /** cap requisitions.see_value: the total frozen at approval. */
  valueKes: decimalString.optional(),
});
export type ApproveResult = z.infer<typeof approveResultSchema>;

// --- R20 POST /:id/cancel ------------------------------------------------------------

export const cancelInputSchema = z.object({ reason: z.string().trim().min(3).max(300), pin: pinSchema }).strict();
export type CancelInput = z.infer<typeof cancelInputSchema>;
export const cancelResultSchema = mutationResultSchema.extend({ cancelledAt: isoDateTime });
export type CancelResult = z.infer<typeof cancelResultSchema>;

// --- R21 POST /:id/additions ----------------------------------------------------------

/** A head, for their own department, while that department's dispatch is not signed. The department comes from the caller, never the body. */
export const addAdditionInputSchema = z
  .object({ lines: z.array(z.object({ itemId: uuid, requestedQty: positiveDecimal }).strict()).min(1).max(100), pin: pinSchema })
  .strict()
  .refine((v) => new Set(v.lines.map((l) => l.itemId)).size === v.lines.length, 'An item can be added once');
export type AddAdditionInput = z.infer<typeof addAdditionInputSchema>;
export const addAdditionResultSchema = mutationResultSchema.extend({ addition: additionSchema });
export type AddAdditionResult = z.infer<typeof addAdditionResultSchema>;

// --- R22 POST /:id/additions/:additionId/approve ---------------------------------------

export const approveAdditionInputSchema = z.object({ pin: pinSchema }).strict();
export type ApproveAdditionInput = z.infer<typeof approveAdditionInputSchema>;
export const approveAdditionResultSchema = mutationResultSchema.extend({ addition: additionSchema });
export type ApproveAdditionResult = z.infer<typeof approveAdditionResultSchema>;

// --- Errors -----------------------------------------------------------------------------

export const REQUISITION_ERROR_CODES = [
  'REQUISITION_ALREADY_OPEN', // 409: R11, one open requisition per branch per cycle
  'INVALID_PIN', // 401: wrong PIN or none set (nothing is said about which); same code as Counting
  'NOT_YOUR_DEPARTMENT', // 403: a head acting on another department's section
  'SECTION_EMPTY', // 409: R13, a section with no lines cannot be sent
  'ITEM_NOT_IN_DEPARTMENT', // 422: R12 and R21, an item not tagged to the department
  'ALREADY_APPROVED', // 409: R12, R14, R15, R19, R20 once the requisition is signed
  'NOT_READY_TO_APPROVE', // 409: R19, a section is still Not started, Draft or has been recalled
  'ADDITION_LOCKED', // 409: R21, the department's dispatch is signed; start an Extra requisition
  'REASON_REQUIRED', // 422: R16 after approval
  'DEPARTMENT_PACKED', // 409: R16 after the department is packed (Block 2 fills the rule)
  'CANCELLED', // 409: any write on a cancelled requisition
] as const;
export type RequisitionErrorCode = (typeof REQUISITION_ERROR_CODES)[number];

/** The shape of an error body, so the error fixtures are parsed too. */
export const errorBodySchema = z.object({ success: z.literal(false), error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }) });
export type ErrorBody = z.infer<typeof errorBodySchema>;
