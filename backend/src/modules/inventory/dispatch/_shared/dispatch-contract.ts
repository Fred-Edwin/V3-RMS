/**
 * Inventory: Dispatch, deliveries and discrepancies (Block 2), the DISPATCH half.
 * FROZEN API CONTRACT: request and response schemas for P1 to P10 (carriers included). V1 to V6 are in
 * `deliveries/_shared/deliveries-contract.ts`, Q1 to Q5 in `discrepancies/_shared/discrepancies-contract.ts`; both import the shared
 * pieces below (people, carriers, photos, the dispatch stages, the activity events).
 *
 * Source of truth: docs/features/inventory/dispatch-contract.md (§4, with the owner's decision that at the final review the
 * Attendant may leave a department out: `leaveOut` of P5), dispatch-flow.md, discrepancies.md, and the Paper page "Inventory ·
 * Requisition and dispatch" chapters 5 to 8 (D1 to D21) plus the gap fixes G2, G3. The front end mirrors this file by hand in
 * `frontend/features/inventory/dispatch/_shared/types/dispatch-contract.ts`; the shared sample payloads are in
 * `dispatch-contract.fixtures.json` (parsed by `dispatch-contract.test.ts`, typed by the mirror's test).
 *
 * Wire rules: `_shared/wire.ts` (decimals are strings, ids strings, ISO times, Nairobi dates). A field marked "cap" is ABSENT, never
 * null, unless the caller holds that capability. Money is `valueKes` / `unitCostKes` (cap `requisitions.see_value`): never present for
 * the Attendant, the branch or a department. Screens read the `can` flags and test whether a key is present, never a role name.
 *
 * Blind rule (docs/features/inventory/discrepancies.md): the SENT figure never reaches a person who is about to count. The Attendant
 * and the hub roles pack and read sent quantities (P1 to P9); a BRANCH-side caller (the Branch Manager reading P6) gets `sentQty`
 * ABSENT on every item until that department has signed its count, and `sentVisible` says which it is. The branch copy of the
 * delivery note (P7) carries no quantities at all. Nothing in `deliveries/` carries a sent figure before V5. A money total would let
 * a blind caller work the sent figure back out (value ÷ unit cost), so while `sentVisible` is false every `valueKes` is ABSENT too
 * (the per-unit `unitCostKes` may stay).
 *
 * Words: the back end returns facts and keys (status, stage, action key, tracker facts). Titles, bodies and labels are the front
 * ends', written from Paper (D21 and the States kit); `DISPATCH_STAGE_TEXT` below is only the eight state names D21 draws.
 *
 * Amendment 1 (owner approved 9 Oct 2026, docs/features/inventory/dispatch-amendment-1.md) is applied. The 2-hour clock runs from
 * `signedAt`; `arrivedAt` is only information (stamped by V2 the first time the department opens the delivery). Fields marked
 * `// back end C` or `// back end D` cannot be produced yet: the shape is fixed, the behaviour is that session's.
 *
 * Do not change a shape here without changing the contract document, the mirror and the fixtures in the same commit, and only with
 * the owner's approval.
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
  uuid,
} from '../../_shared/wire';
import { branchRefSchema, idempotencyKeySchema, pinSchema, requisitionCycleSchema } from '../../requisitions/_shared/requisitions-contract';

export { branchRefSchema, errorBodySchema, idempotencyKeySchema, pinSchema, requisitionCycleSchema } from '../../requisitions/_shared/requisitions-contract';
export type { BranchRef, ErrorBody } from '../../requisitions/_shared/requisitions-contract';

// --- Words and enums -----------------------------------------------------------

/** Database names (the replace migration). "Waiting for the branch" and "Gap held" are DERIVED (see `dispatchStageSchema`). */
export const DISPATCH_STATUSES = ['TO_PACK', 'PACKING', 'ON_THE_WAY', 'CONFIRMED', 'CLOSED', 'CANCELLED'] as const;
export const dispatchStatusSchema = z.enum(DISPATCH_STATUSES);
export type DispatchStatus = z.infer<typeof dispatchStatusSchema>;

/**
 * The states Paper D21 draws, derived from the status plus facts: READY_TO_SEND (every department of the requisition packed, not yet
 * signed), WAITING_FOR_BRANCH (ON_THE_WAY, 2 hours and nobody has counted), GAP_HELD (CONFIRMED with a discrepancy still OPEN).
 * CONFIRMED stays a stage for the moment between a clean count and CLOSED (a clean count closes at once, so it is rarely seen).
 */
export const DISPATCH_STAGES = [
  'TO_PACK',
  'PACKING',
  'READY_TO_SEND',
  'ON_THE_WAY',
  'WAITING_FOR_BRANCH',
  'CONFIRMED',
  'GAP_HELD',
  'CLOSED',
  'CANCELLED',
] as const;
export const dispatchStageSchema = z.enum(DISPATCH_STAGES);
export type DispatchStage = z.infer<typeof dispatchStageSchema>;
/** The state names of Paper D21 ("One file, eight states"); the front ends own every other word. */
export const DISPATCH_STAGE_TEXT: Record<DispatchStage, string> = {
  TO_PACK: 'To pack',
  PACKING: 'Packing',
  READY_TO_SEND: 'Ready to send',
  ON_THE_WAY: 'On the way',
  WAITING_FOR_BRANCH: 'Waiting for the branch',
  CONFIRMED: 'Confirmed',
  GAP_HELD: 'Gap held',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
};

/** The one main button of a state (Paper D21 "Main button"). Null when the state has none. */
export const DISPATCH_ACTIONS = [
  'PACK',
  'DONE_WITH_DEPARTMENT',
  'SIGN_AND_SEND',
  'COUNT_THE_DELIVERY',
  'CONFIRM_FOR_DEPARTMENT',
  'RECORD_A_FINDING',
  'PRINT',
  'PACK_AGAIN',
] as const;
export const dispatchActionSchema = z.enum(DISPATCH_ACTIONS);
export type DispatchAction = z.infer<typeof dispatchActionSchema>;

/** The delivery's result for a department, shown on the branch history (G2) and filtered by `result` (Amendment 1, row 10). */
export const DELIVERY_RESULTS = ['MATCHED', 'GAP_OPEN', 'GAP_RESOLVED'] as const;
export const deliveryResultSchema = z.enum(DELIVERY_RESULTS);
export type DeliveryResult = z.infer<typeof deliveryResultSchema>;

/** The result chip of a row on the Attendant's Done tab (G3, Amendment 1 row 10). Null on the On the way tab. */
export const DISPATCH_DONE_RESULTS = ['CONFIRMED', 'GAP_FOUND', 'GAP_SETTLED', 'CANCELLED'] as const;
export const dispatchDoneResultSchema = z.enum(DISPATCH_DONE_RESULTS);
export type DispatchDoneResult = z.infer<typeof dispatchDoneResultSchema>;

/** Fixed constants, not settings (owner, 8 and 9 Oct): the 2-hour wait runs from `signedAt`; the amber "Waiting" chip on D1 starts at 20 minutes. */
export const WAITING_FOR_BRANCH_AFTER_HOURS = 2;
export const PACK_WAITING_CHIP_AFTER_MINUTES = 20;

/** Socket events (Amendment 1 row 16), per record; `inventory:badges` also carries `dispatch` and `deliveries` counts. Emitted by back end C and D. */
export const DISPATCH_CHANGED_EVENT = 'dispatch:changed';
export const dispatchChangedPayloadSchema = z.object({ id: uuid, reference: z.string().nullable(), siteId: z.string(), reason: z.string() });
export type DispatchChangedPayload = z.infer<typeof dispatchChangedPayloadSchema>;

/** Append-only activity of a dispatch (the file's Activity tab, the Audit log source DISPATCH). Packing saves are not events. */
export const DISPATCH_EVENT_TYPES = [
  'SIGNED_AND_SENT',
  'CANCELLED',
  'DELIVERY_CONFIRMED',
  'DELIVERY_CONFIRMED_ON_BEHALF',
  'DISCREPANCY_OPENED',
  'FINDING_RECORDED',
  'FINDING_REVERSED',
  'CLOSED',
] as const;
export const dispatchEventTypeSchema = z.enum(DISPATCH_EVENT_TYPES);
export type DispatchEventType = z.infer<typeof dispatchEventTypeSchema>;

// --- Shared pieces ---------------------------------------------------------------

export const departmentRefSchema = z.object({ id: uuid, name: z.string() });
export type DepartmentRef = z.infer<typeof departmentRefSchema>;

/** Who did a thing and when ("Store Attendant · 3:01 pm"). Titles come from `roleLabel`; names only where a record states who. */
export const stampSchema = z.object({ by: personSchema, at: isoDateTime });
export type Stamp = z.infer<typeof stampSchema>;

/** `COMPANY` is "Courier company" (Amendment 1 row 4). */
export const CARRIER_KINDS = ['PERSON', 'VEHICLE', 'COMPANY'] as const;
export const carrierKindSchema = z.enum(CARRIER_KINDS);
export type CarrierKind = z.infer<typeof carrierKindSchema>;

/** A carrier as a picker and a file show it. */
export const carrierRefSchema = z.object({ id: uuid, name: z.string(), kind: carrierKindSchema });
export type CarrierRef = z.infer<typeof carrierRefSchema>;

/** A carrier as Settings lists it (Paper D18). Retiring keeps history. */
export const carrierSchema = carrierRefSchema.extend({
  active: z.boolean(),
  retiredAt: isoDateTime.nullable(),
  /** "Deliveries this month" (D18): dispatches signed with this carrier since the 1st, Nairobi time. */
  deliveriesThisMonth: z.number().int().nonnegative(),
});
export type Carrier = z.infer<typeof carrierSchema>;

/**
 * A photo on a delivery line: up to 3 per line, 5 MB each, JPEG, PNG or WebP (owner default, 8 Oct), kept in the new `DispatchPhoto`
 * table (not Purchasing's file table; Amendment 1 row 6). The wire is `{ id, url }`: the url is an AUTHENTICATED link, so the screen
 * loads it with the caller's token (`GET /inventory/deliveries/photos/:photoId`, built in back end D).
 */
export const PHOTO_MAX_PER_LINE = 3;
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const photoRefSchema = z.object({ id: uuid, url: z.string() });
export type PhotoRef = z.infer<typeof photoRefSchema>;

/** Why the branch says a line is different (Paper D10 chips). */
export const COUNT_REASONS = ['NOT_IN_THE_BOX', 'DAMAGED', 'WRONG_ITEM', 'OTHER'] as const;
export const countReasonSchema = z.enum(COUNT_REASONS);
export type CountReason = z.infer<typeof countReasonSchema>;
export const COUNT_REASON_TEXT: Record<CountReason, string> = {
  NOT_IN_THE_BOX: 'Not in the box',
  DAMAGED: 'Damaged',
  WRONG_ITEM: 'Wrong item',
  OTHER: 'Other',
};

/** A record link drawn in the document-name colour: DSP-, DSC-, REQ-. */
export const recordLinkSchema = z.object({ kind: z.enum(['REQUISITION', 'DISPATCH', 'DISCREPANCY']), id: uuid, reference: z.string() });
export type RecordLink = z.infer<typeof recordLinkSchema>;

export const dispatchActivityEventSchema = z.object({
  id: uuid,
  type: dispatchEventTypeSchema,
  at: isoDateTime,
  actor: personSchema,
  /** "Signed and sent DSP-NYR-0232 · 8 lines · carried by Wendo van KCB 214K" */
  sentence: z.string(),
  link: recordLinkSchema.nullable(),
  reason: z.string().nullable(),
});
export type DispatchActivityEvent = z.infer<typeof dispatchActivityEventSchema>;

// --- P1 GET /dispatch/queue (Paper D1) ----------------------------------------------

/** `dispatch.pack` (and `dispatch.read`): one card per branch's approved requisition, oldest first. No money. */
export const packDepartmentStateSchema = z.enum(['TO_PACK', 'PACKING', 'PACKED']);
export type PackDepartmentState = z.infer<typeof packDepartmentStateSchema>;
export const queueCardSchema = z.object({
  requisitionId: uuid,
  /** "REQ-NYR-0112" */
  reference: z.string(),
  branch: branchRefSchema,
  cycle: requisitionCycleSchema,
  /** "Afternoon" */
  cycleLabel: z.string(),
  /** The wait ("Waiting 29 min") runs from here. */
  approvedAt: isoDateTime,
  lineCount: z.number().int().nonnegative(),
  departments: z.array(
    z.object({
      departmentId: uuid,
      departmentName: z.string(),
      lineCount: z.number().int().nonnegative(),
      /** Lines ticked so far. */
      packedCount: z.number().int().nonnegative(),
      state: packDepartmentStateSchema,
    }),
  ),
});
export type QueueCard = z.infer<typeof queueCardSchema>;
export const queueSchema = z.object({
  cards: z.array(queueCardSchema),
  /** The Attendant's sidebar badge: branches to pack. */
  branchesToPack: z.number().int().nonnegative(),
});
export type Queue = z.infer<typeof queueSchema>;

// --- P2 GET /dispatch/pack/:requisitionId/departments/:departmentId (Paper D2, D3) ---

export const packLineSchema = z.object({
  /** The requisition line this packs; a line added after approval carries `addedAfterApproval`. */
  lineId: uuid,
  itemId: uuid,
  itemName: z.string(),
  unit: z.string(),
  /** Category names from the top: ["Prep kitchen"] ("PREP KITCHEN", "DRY ITEMS", "MARKET ITEMS"). */
  categoryPath: z.array(z.string()),
  requestedQty: nonNegativeDecimal,
  /** In store now ("In store 140"). The Attendant sees quantities including on hand, never money. */
  onHand: decimalString,
  /** What will go out; pre-filled with the requested quantity. */
  sentQty: nonNegativeDecimal,
  packedTick: z.boolean(),
  /** sentQty is below requestedQty: shown "Not enough in store" when on hand is the reason. A short line is normal. */
  short: z.boolean(),
  addedAfterApproval: z.boolean(),
});
export type PackLine = z.infer<typeof packLineSchema>;

export const packDepartmentSchema = z.object({
  requisitionId: uuid,
  reference: z.string(),
  branch: branchRefSchema,
  department: departmentRefSchema,
  /** "Department 1 of 5": the 1-based position among the departments still to pack and the total. */
  position: z.object({ index: z.number().int().min(1), total: z.number().int().min(1) }),
  lineCount: z.number().int().nonnegative(),
  packedCount: z.number().int().nonnegative(),
  state: packDepartmentStateSchema,
  lines: z.array(packLineSchema),
  /** The next department still to pack, for "go straight to the next"; null when this was the last. */
  nextDepartmentId: uuid.nullable(),
  /** Every department of the requisition is ticked: the next screen is the list leading to the final review (D4). */
  allPacked: z.boolean(),
  /** Amendment 1 row 2: "Go to the final review" works once at least one department is fully ticked. */
  canReview: z.boolean(),
});
export type PackDepartment = z.infer<typeof packDepartmentSchema>;

// --- P3 PUT /dispatch/pack/:requisitionId/departments/:departmentId/lines (Paper D2, D3) ----

/** Last write wins. A line left out of the body is left as it is. `sentQty` may be zero, never negative; the service refuses more than requested. */
export const savePackLinesInputSchema = z
  .object({ lines: z.array(z.object({ lineId: uuid, sentQty: nonNegativeDecimal, packedTick: z.boolean() }).strict()).min(1).max(300) })
  .strict()
  .refine((v) => new Set(v.lines.map((l) => l.lineId)).size === v.lines.length, 'A line can be listed once');
export type SavePackLinesInput = z.infer<typeof savePackLinesInputSchema>;
/** The response is the updated `PackDepartment`. */

// --- P4 GET /dispatch/pack/:requisitionId/review (Paper D4, D5, D5b) -------------------

export const reviewDepartmentSchema = z.object({
  departmentId: uuid,
  departmentName: z.string(),
  lineCount: z.number().int().nonnegative(),
  /** Every line ticked. A department that is not shows "Not ready · stays in To pack" with no action (Amendment 1 row 2). */
  allTicked: z.boolean(),
  /** A fully ticked department has "Leave out" (undo until signed): it stays in To pack with its ticks and ships later with its own short review and signature (P5 `leaveOut`). */
  canLeaveOut: z.boolean(),
  shortCount: z.number().int().nonnegative(),
  /** What is short ("oil 1 of 2"): the screen words it from these facts. */
  shortLines: z.array(z.object({ itemName: z.string(), unit: z.string(), requestedQty: nonNegativeDecimal, sentQty: nonNegativeDecimal })),
});
export const reviewLineSchema = z.object({
  departmentId: uuid,
  lineId: uuid,
  itemName: z.string(),
  unit: z.string(),
  requestedQty: nonNegativeDecimal,
  sentQty: nonNegativeDecimal,
  short: z.boolean(),
});
export const reviewSchema = z.object({
  requisitionId: uuid,
  reference: z.string(),
  branch: branchRefSchema,
  cycleLabel: z.string(),
  /** Over the departments that will ship (all of them until the Attendant leaves one out; the client recomputes). */
  lineCount: z.number().int().nonnegative(),
  shortCount: z.number().int().nonnegative(),
  departments: z.array(reviewDepartmentSchema),
  /** D5b "Every line, in detail": all lines by department with sent quantities. */
  lines: z.array(reviewLineSchema),
  /** Pre-filled with the signed-in person. */
  packedBy: personSchema,
  signedBy: personSchema,
  /** The active carriers the Attendant picks from (they hold no `carriers.read`). */
  carriers: z.array(carrierRefSchema),
  /** At least one department is fully ticked, so something can be signed. */
  canSign: z.boolean(),
});
export type Review = z.infer<typeof reviewSchema>;

// --- P5 POST /dispatch/pack/:requisitionId/sign (Paper D5, D6) -------------------------

export const signDispatchInputSchema = z
  .object({
    carrierId: uuid,
    pin: pinSchema,
    idempotencyKey: idempotencyKeySchema,
    /** Owner decision, 8 Oct: departments left out stay in To pack and ship later with their own short review and signature. */
    leaveOut: z.array(uuid).max(20).optional(),
  })
  .strict()
  .refine((v) => new Set(v.leaveOut ?? []).size === (v.leaveOut ?? []).length, 'A department can be left out once');
export type SignDispatchInput = z.infer<typeof signDispatchInputSchema>;

export const signDispatchResultSchema = z.object({
  requisitionId: uuid,
  reference: z.string(),
  branch: branchRefSchema,
  signedAt: isoDateTime,
  packedBy: personSchema,
  signedBy: personSchema,
  carrier: carrierRefSchema,
  /** Shared by every dispatch signed together (`finalSignAt`). */
  sendBatchId: uuid,
  /** One `DSP-` per department that shipped (D6). */
  dispatches: z.array(
    z.object({ id: uuid, reference: z.string(), departmentId: uuid, departmentName: z.string(), lineCount: z.number().int().nonnegative(), shortCount: z.number().int().nonnegative() }),
  ),
  /** Departments left out; still in To pack. */
  leftOut: z.array(departmentRefSchema),
  lineCount: z.number().int().nonnegative(),
  shortCount: z.number().int().nonnegative(),
  /** D6 "4 of 5 departments sent. Pastry is still to pack.": departments of the requisition sent so far (earlier batches included) and the total. */
  sentDepartments: z.number().int().nonnegative(),
  totalDepartments: z.number().int().positive(),
  /** A repeated idempotencyKey returned the first result. */
  replayed: z.boolean(),
});
export type SignDispatchResult = z.infer<typeof signDispatchResultSchema>;

// --- P6 GET /dispatch/:id the dispatch file (Paper D13) ---------------------------------

export const trackerStepSchema = z.object({
  key: z.enum(['APPROVED', 'PACKED', 'ON_THE_WAY', 'COUNTED', 'CLOSED']),
  state: z.enum(['DONE', 'CURRENT', 'TODO']),
  at: isoDateTime.nullable(),
  by: personSchema.nullable(),
  /** ON_THE_WAY: the carrier ("Wendo van KCB 214K"). Null on the other steps. */
  carrier: carrierRefSchema.nullable(),
});
export type TrackerStep = z.infer<typeof trackerStepSchema>;

export const dispatchItemSchema = z.object({
  lineId: uuid,
  itemId: uuid,
  itemName: z.string(),
  unit: z.string(),
  categoryPath: z.array(z.string()),
  requestedQty: nonNegativeDecimal,
  /** ABSENT for a branch-side caller until the department has signed its count (`sentVisible` is false then). */
  sentQty: nonNegativeDecimal.optional(),
  /** Null until the department signs its count. */
  countedQty: nonNegativeDecimal.nullable(),
  /** counted − sent, signed; null until counted, and ABSENT with `sentQty`. */
  gapQty: decimalString.nullable().optional(),
  countedTwice: z.boolean(),
  countReason: countReasonSchema.nullable(),
  countReasonNote: z.string().nullable(),
  photos: z.array(photoRefSchema),
  /** The discrepancy this line opened, once the count differed. */
  discrepancy: z.object({ id: uuid, reference: z.string(), status: z.enum(['OPEN', 'RECORDED', 'REVERSED']) }).nullable(),
  /** cap requisitions.see_value: the cost frozen at dispatch, KES per unit. */
  unitCostKes: decimalString.optional(),
  /** cap requisitions.see_value: sentQty × unitCostKes. */
  valueKes: decimalString.optional(),
});
export type DispatchItem = z.infer<typeof dispatchItemSchema>;

/** The delivery note versions of the file's Documents tab: voided ones are kept. */
export const dispatchDocumentSchema = z.object({
  id: uuid,
  kind: z.enum(['DELIVERY_NOTE_STORE', 'DELIVERY_NOTE_BRANCH']),
  at: isoDateTime,
  by: personSchema,
  voided: z.boolean(),
});

export const dispatchFileSchema = z.object({
  id: uuid,
  /** "DSP-NYR-0232" */
  reference: z.string(),
  requisition: z.object({ id: uuid, reference: z.string() }),
  branch: branchRefSchema,
  department: departmentRefSchema,
  status: dispatchStatusSchema,
  stage: dispatchStageSchema,
  lineCount: z.number().int().nonnegative(),
  shortCount: z.number().int().nonnegative(),
  carrier: carrierRefSchema,
  packed: stampSchema,
  signed: stampSchema,
  sendBatchId: uuid,
  /** Amendment 1 row 10, the flat moments and people the file also carries (the stamps above hold the same as objects). */
  packedAt: isoDateTime,
  /** Stamped by V2 the first time anyone from the department opens the delivery; information only ("Arrived 3:28 pm"). Null before that: the card reads "On the way". Stamped by Deliveries V2 (built, back end D). */
  arrivedAt: isoDateTime.nullable(),
  countedById: z.string().nullable(),
  countedAt: isoDateTime.nullable(),
  /** The Branch Manager signed for the department. */
  onBehalf: z.boolean(),
  /** cap requisitions.see_value: the value written off by a recorded finding, at the cost frozen at dispatch, KES. Absent without the capability and while `sentVisible` is false. // back end C */
  lossValueKes: decimalString.optional(),
  /** Who counted for the department and when; the real signer even when "on behalf". Null until counted. */
  counted: stampSchema.nullable(),
  /** The department the Branch Manager signed for ("on behalf of Pastry"); null when a department member counted. */
  onBehalfOfDepartment: departmentRefSchema.nullable(),
  cancelled: z.object({ at: isoDateTime, by: personSchema, reason: z.string() }).nullable(),
  closedAt: isoDateTime.nullable(),
  /** The other departments' dispatches signed with this one (the requisition's roll-up). */
  siblings: z.array(z.object({ id: uuid, reference: z.string(), departmentName: z.string(), stage: dispatchStageSchema })),
  tracker: z.array(trackerStepSchema),
  /** The Next step card: the action key and facts only; the front end writes the words. */
  nextStep: z.object({
    action: dispatchActionSchema.nullable(),
    facts: z.object({
      /** Lines whose count differs (or 0). */
      gapLineCount: z.number().int().nonnegative(),
      /** The open discrepancy a Record a finding button leads to. */
      discrepancyId: uuid.nullable(),
      /** ON_THE_WAY: when the 2-hour wait started: the final-sign time `signedAt` (Amendment 1 row 1). */
      waitingSince: isoDateTime.nullable(),
    }),
  }),
  /** false = `sentQty` and `gapQty` are absent from every item (a branch-side caller before the count is signed). */
  sentVisible: z.boolean(),
  items: z.array(dispatchItemSchema),
  documents: z.array(dispatchDocumentSchema),
  activity: z.array(dispatchActivityEventSchema),
  /** cap requisitions.see_value: the value sent, at the cost frozen at dispatch. */
  valueKes: decimalString.optional(),
  can: z.object({ print: z.boolean(), cancel: z.boolean(), recordFinding: z.boolean(), confirmForDepartment: z.boolean() }),
});
export type DispatchFile = z.infer<typeof dispatchFileSchema>;

// --- P7 GET /dispatch/:id/print?copy=store|branch (Paper D17, D17b) -----------------------

export const DELIVERY_NOTE_COPIES = ['store', 'branch'] as const;
export const printDispatchQuerySchema = z.object({ copy: z.enum(DELIVERY_NOTE_COPIES) });
export type PrintDispatchQuery = z.infer<typeof printDispatchQuerySchema>;

const printHeaderShape = {
  reference: z.string(),
  /** A cancelled dispatch's note is voided and kept. */
  voided: z.boolean(),
  /** Amendment 1 row 14: the "VOID · cancelled {date}" band. Null unless voided. */
  cancelledAt: isoDateTime.nullable(),
  requisitionReference: z.string(),
  branch: branchRefSchema,
  department: departmentRefSchema,
  /** The day the dispatch was signed, Nairobi. */
  date: nairobiDate,
  carrier: carrierRefSchema,
  packed: stampSchema,
  signed: stampSchema,
  generatedAt: isoDateTime,
  /** What the QR code carries: a link to the file. */
  qrPayload: z.string(),
};
/** The store copy: asked and sent quantities, no money. Pages repeat the header and headings; the signature block, received-by line and QR sit on the last page only (the A4 layout is the front end's). */
export const printStoreSchema = z.object({
  copy: z.literal('store'),
  ...printHeaderShape,
  lines: z.array(z.object({ n: z.number().int().min(1), itemName: z.string(), unit: z.string(), requestedQty: nonNegativeDecimal, sentQty: nonNegativeDecimal })),
});
/** The branch copy: NO quantities, so the count stays blind; the screen draws a blank "Your count" column. */
export const printBranchSchema = z.object({
  copy: z.literal('branch'),
  ...printHeaderShape,
  lines: z.array(z.object({ n: z.number().int().min(1), itemName: z.string(), unit: z.string() })),
});
export const printDispatchSchema = z.discriminatedUnion('copy', [printStoreSchema, printBranchSchema]);
export type PrintDispatch = z.infer<typeof printDispatchSchema>;

// --- P8 POST /dispatch/:id/cancel (Paper D20) ------------------------------------------------

export const DISPATCH_CANCEL_REASON_MAX = 300;
/** Amendment 1 row 8: the reason is "preset — note" (the Requisitions R20 pattern). `Other` needs a note; the others may carry one. */
export const DISPATCH_CANCEL_PRESETS = ['Packed the wrong lines', 'Branch asked us to stop', 'Vehicle did not leave', 'Other'] as const;
export type DispatchCancelPreset = (typeof DISPATCH_CANCEL_PRESETS)[number];
export const DISPATCH_CANCEL_REASON_SEPARATOR = ' — ';
/** Splits a reason into its preset and note; null when it does not start with a preset. */
export const parseDispatchCancelReason = (reason: string): { preset: DispatchCancelPreset; note: string } | null => {
  for (const preset of DISPATCH_CANCEL_PRESETS) {
    if (reason === preset) return { preset, note: '' };
    if (reason.startsWith(preset + DISPATCH_CANCEL_REASON_SEPARATOR)) return { preset, note: reason.slice(preset.length + DISPATCH_CANCEL_REASON_SEPARATOR.length).trim() };
  }
  return null;
};
export const dispatchCancelReasonSchema = z
  .string()
  .trim()
  .max(DISPATCH_CANCEL_REASON_MAX)
  .refine((v) => {
    const parsed = parseDispatchCancelReason(v);
    return parsed !== null && (parsed.preset !== 'Other' || parsed.note.length > 0);
  }, 'Pick a reason; "Other" needs a note');
/**
 * Only before any department member has signed that department's count, and only while the dispatch is On the way. It locks THAT
 * dispatch only; the others are untouched. Entry: the "…" menu beside Print (holders of `dispatch.cancel`). PIN-signed, so it carries
 * an idempotencyKey (Amendment 1 row 11): a repeated key returns the first result.
 */
export const cancelDispatchInputSchema = z.object({ reason: dispatchCancelReasonSchema, pin: pinSchema, idempotencyKey: idempotencyKeySchema }).strict();
export type CancelDispatchInput = z.infer<typeof cancelDispatchInputSchema>;
export const cancelDispatchResultSchema = z.object({
  id: uuid,
  reference: z.string(),
  status: z.literal('CANCELLED'),
  cancelledAt: isoDateTime,
  cancelledBy: personSchema,
  /** Lines returned to the queue and stock put back by a linked entry. */
  linesReturnedToQueue: z.number().int().nonnegative(),
  /** A repeated idempotencyKey returned the first result. */
  replayed: z.boolean(),
});
export type CancelDispatchResult = z.infer<typeof cancelDispatchResultSchema>;

// --- P9 GET /dispatch/mine (Paper G3) ----------------------------------------------------------

/** The Attendant's own packing history: no costs. `tab` and `branchId` are Paper G3's tab and Branch filter (contract addition, reported). */
export const dispatchMineQuerySchema = pageQuerySchema.extend({
  tab: z.enum(['on-the-way', 'done']).default('done'),
  from: nairobiDate.optional(),
  to: nairobiDate.optional(),
  branchId: uuid.optional(),
});
export type DispatchMineQuery = z.infer<typeof dispatchMineQuerySchema>;
export const dispatchMineRowSchema = z.object({
  id: uuid,
  reference: z.string(),
  branch: branchRefSchema,
  department: departmentRefSchema,
  lineCount: z.number().int().nonnegative(),
  signedAt: isoDateTime,
  stage: dispatchStageSchema,
  /** The Done chip (Amendment 1 row 10): CONFIRMED, GAP_FOUND ("Gap found"), GAP_SETTLED or CANCELLED; null while it is on the way. */
  result: dispatchDoneResultSchema.nullable(),
});
export const dispatchMineSchema = z.object({
  tab: z.enum(['on-the-way', 'done']),
  rows: z.array(dispatchMineRowSchema),
  /** The Attendant's tab counts (To pack is the queue). */
  tabCounts: z.object({ 'on-the-way': z.number().int().nonnegative(), done: z.number().int().nonnegative() }),
  page: pageInfoSchema,
});
export type DispatchMine = z.infer<typeof dispatchMineSchema>;

// --- P10 /carriers (Paper D18) --------------------------------------------------------------------

/** `carriers.read` (the Attendant picks from P4). `status` defaults to active only. */
export const listCarriersQuerySchema = z.object({ status: z.enum(['active', 'retired', 'all']).default('active') });
export type ListCarriersQuery = z.infer<typeof listCarriersQuerySchema>;
export const listCarriersSchema = z.object({
  carriers: z.array(carrierSchema),
  /** `carriers.manage` holders may add, rename, retire and restore. */
  can: z.object({ manage: z.boolean() }),
});
export type ListCarriers = z.infer<typeof listCarriersSchema>;

export const CARRIER_NAME_MAX = 80;
export const carrierNameSchema = z.string().trim().min(2).max(CARRIER_NAME_MAX);
export const addCarrierInputSchema = z.object({ name: carrierNameSchema, kind: carrierKindSchema }).strict();
export type AddCarrierInput = z.infer<typeof addCarrierInputSchema>;
/** One change at a time: rename, or retire (`active: false`), or restore (`active: true`). The response is the `Carrier`. */
export const updateCarrierInputSchema = z
  .object({ name: carrierNameSchema.optional(), active: z.boolean().optional() })
  .strict()
  .refine((v) => (v.name === undefined) !== (v.active === undefined), 'Send a new name or active, not both');
export type UpdateCarrierInput = z.infer<typeof updateCarrierInputSchema>;

// --- Errors ----------------------------------------------------------------------------------------

export const DISPATCH_ERROR_CODES = [
  // From the contract (P5)
  'NOT_ALL_PACKED', // 409: P5, a department that is not left out has an unticked line
  'INVALID_PIN', // 401: wrong PIN or none set (nothing is said about which); same code as Counting and Requisitions
  'CARRIER_INACTIVE', // 409: P5, the carrier was retired
  'NOTHING_TO_SEND', // 409: P5, every department was left out, or none is packed
  // Added for the writes the contract lists without codes (reported); renamed to the Amendment 1 row 11 names where they overlap
  'REQUISITION_NOT_APPROVED', // 409: P1 to P5 on a requisition that is not approved (or was cancelled)
  'OVER_REQUESTED', // 422: P3, a sent quantity above the requested one
  'NOT_SIGNED', // 409: P6, P7, P8 on a dispatch that is not signed yet
  // Amendment 1 row 11
  'ALREADY_SIGNED', // 409: P3 and P5 on a department whose dispatch is already signed (was ALREADY_SENT)
  'STOCK_CHANGED', // 409: P3 and P5, stock changed under the Attendant; `details.lineIds` are the affected lines, flagged
  'DISPATCH_ALREADY_COUNTED', // 409: P8, a department member has signed its count: no cancel (D20; was ALREADY_COUNTED)
  'DISPATCH_CANCELLED', // 409: any write on a cancelled dispatch, including the department's next one (no push); a second P8
  'CARRIER_NAME_TAKEN', // 409: P10
  // The rest of row 11 is in `deliveries-contract.ts` (ALREADY_CONFIRMED, NOT_COUNTED, RECOUNT_USED, REASON_REQUIRED, NOT_YOUR_DEPARTMENT,
  // PHOTO_TOO_LARGE, TOO_MANY_PHOTOS) and `discrepancies-contract.ts` (FINDING_NOT_REVERSIBLE); a test checks the three lists together cover all 13.
] as const;
export type DispatchErrorCode = (typeof DISPATCH_ERROR_CODES)[number];
