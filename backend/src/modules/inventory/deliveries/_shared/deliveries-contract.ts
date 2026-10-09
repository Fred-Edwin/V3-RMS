/**
 * Inventory: Dispatch, deliveries and discrepancies (Block 2), the DELIVERIES half (the branch).
 * FROZEN API CONTRACT: request and response schemas for V1 to V7 (V7, the department's own delivery file, was added at integration).
 *
 * Source of truth: docs/features/inventory/dispatch-contract.md (§4), discrepancies.md ("At the branch: count blind, flag,
 * recount, sign") and Paper chapter 6 (D7 to D12), D19 and the gap fix G2. Mirrored by hand in
 * `frontend/features/inventory/deliveries/_shared/types/deliveries-contract.ts`; fixtures in `deliveries-contract.fixtures.json`.
 * Shared pieces (photos, reasons, stages, the error envelope) come from `dispatch/_shared/dispatch-contract.ts`.
 *
 * THE BLIND RULE, in the shape: nothing in V1 to V4 carries the sent quantity, the gap, or any field that could stand in for them
 * (a test pins the key names). The sent figure is revealed in V5 only, and V6 returns the gaps after the signature. Every money
 * field is absent: the branch never sees money.
 *
 * Counting is two passes. A save (V3 PUT) only stores what was typed and never says whether it matches. A check (V3 POST) is the
 * moment of comparison: a differing line becomes COUNT_AGAIN once; after the second check it becomes SHORT or EXTRA (its direction,
 * never its size) and is final. `attempt` counts the checks the line has been through.
 *
 * Who counts: an active member or the head of the receiving department (`deliveries.count`, a department rule, held by no role in
 * the capability table) or the Branch Manager for any department (`deliveries.confirm_on_behalf`). Rows carry `can` flags.
 *
 * Amendment 1 (docs/features/inventory/dispatch-amendment-1.md) is applied: the check also says which way a differing line differs
 * (`direction`, never the size), V2 reports the saved count and whether the recount was used, `arrivedAt` is stamped by V2, photos
 * are `{ id, url }` with a delete endpoint, V1 and V6 carry the fields of row 10, and the error codes are the row 11 names.
 *
 * Do not change a shape here without changing the contract document, the mirror and the fixtures in the same commit, and only with
 * the owner's approval.
 */
import { z } from 'zod';
import { decimalString, isoDateTime, nairobiDate, nonNegativeDecimal, pageInfoSchema, pageQuerySchema, personSchema, uuid } from '../../_shared/wire';
import {
  branchRefSchema,
  carrierRefSchema,
  countReasonSchema,
  deliveryResultSchema,
  departmentRefSchema,
  dispatchFileSchema,
  dispatchStageSchema,
  idempotencyKeySchema,
  photoRefSchema,
  pinSchema,
  requisitionCycleSchema,
} from '../../dispatch/_shared/dispatch-contract';

// --- Words and enums -----------------------------------------------------------

/** What the screen shows for a line while counting. SHORT and EXTRA appear only after the second check. */
export const LINE_COUNT_STATES = ['NOT_COUNTED', 'COUNTED', 'COUNT_AGAIN', 'SHORT', 'EXTRA'] as const;
export const lineCountStateSchema = z.enum(LINE_COUNT_STATES);
export type LineCountState = z.infer<typeof lineCountStateSchema>;

export const DELIVERY_TABS = ['waiting', 'past'] as const;
export const deliveryTabSchema = z.enum(DELIVERY_TABS);
export type DeliveryTab = z.infer<typeof deliveryTabSchema>;

/** A note with the reason "Other" or any reason (V4). */
export const REASON_NOTE_MAX = 200;

// --- V1 GET /deliveries/mine (Paper D7, G2) ------------------------------------

/** `result` is Paper G2's "Result: All" filter (contract addition, reported). A head or member sees their department; the Branch Manager every department of the branch. */
export const listDeliveriesQuerySchema = pageQuerySchema.extend({
  tab: deliveryTabSchema.default('waiting'),
  from: nairobiDate.optional(),
  to: nairobiDate.optional(),
  result: deliveryResultSchema.optional(),
});
export type ListDeliveriesQuery = z.infer<typeof listDeliveriesQuerySchema>;

export const deliveryRowSchema = z.object({
  id: uuid,
  /** "DSP-NYR-0232" */
  reference: z.string(),
  department: departmentRefSchema,
  /** Amendment 1 row 10: the requisition's cycle ("Afternoon") and the carrier. */
  cycle: requisitionCycleSchema,
  carrier: carrierRefSchema,
  lineCount: z.number().int().nonnegative(),
  /** When the Central Store signed it ("left 3:05 pm"). The 2-hour wait runs from here (Amendment 1 row 1). */
  signedAt: isoDateTime,
  /** Stamped the first time anyone from the department opens the delivery (V2); information only. Null before that: the card reads "On the way". Built (back end D). */
  arrivedAt: isoDateTime.nullable(),
  /** ON_THE_WAY or WAITING_FOR_BRANCH while waiting; CONFIRMED, GAP_HELD or CLOSED on the past tab. */
  stage: dispatchStageSchema,
  /** Someone has started counting: the button reads "Continue counting". */
  countStarted: z.boolean(),
  /** Past tab: when it was confirmed, who counted for the department, and the chip (G2). Null while waiting. */
  confirmedAt: isoDateTime.nullable(),
  confirmedBy: personSchema.nullable(),
  /** The confirmer's title ("Barista Department Head"). */
  confirmedByTitle: z.string().nullable(),
  /** History (G2): MATCHED, GAP_OPEN or GAP_RESOLVED, with the number of lines whose count differed. Null while waiting. */
  result: deliveryResultSchema.nullable(),
  gapCount: z.number().int().nonnegative().nullable(),
  can: z.object({ count: z.boolean(), confirmOnBehalf: z.boolean() }),
});
export type DeliveryRow = z.infer<typeof deliveryRowSchema>;

export const listDeliveriesSchema = z.object({
  tab: deliveryTabSchema,
  rows: z.array(deliveryRowSchema),
  tabCounts: z.object({ waiting: z.number().int().nonnegative(), past: z.number().int().nonnegative() }),
  page: pageInfoSchema,
});
export type ListDeliveries = z.infer<typeof listDeliveriesSchema>;

// --- V2 GET /deliveries/:id/count (Paper D8, D9) -----------------------------------

/** One line as counted. NO sent figure, NO gap, nothing pre-filled: `countedQty` is what the person typed and saved. */
export const countLineSchema = z.object({
  lineId: uuid,
  itemName: z.string(),
  /** "Count in bags": the screen writes the hint from the unit. */
  unit: z.string(),
  categoryPath: z.array(z.string()),
  countedQty: nonNegativeDecimal.nullable(),
  state: lineCountStateSchema,
  /** Checks this line has been through: 0, 1 (flagged once), 2 (final). */
  attempt: z.number().int().min(0).max(2),
  /** Amendment 1 row 5: the one recount has been used (the second count is final). */
  recountUsed: z.boolean(),
  /** Which way a checked line differs, as Paper D10 draws it ("This line will be marked short"); never the size. Null until the first check flags it. */
  direction: z.enum(['SHORT', 'EXTRA']).nullable(),
  reason: countReasonSchema.nullable(),
  reasonNote: z.string().nullable(),
  photos: z.array(photoRefSchema),
});
export type CountLine = z.infer<typeof countLineSchema>;

export const countViewSchema = z.object({
  id: uuid,
  reference: z.string(),
  branch: branchRefSchema,
  department: departmentRefSchema,
  signedAt: isoDateTime,
  /** Stamped by this very read the first time anyone from the department opens the delivery (Amendment 1 row 1; only someone from the department stamps it, the Branch Manager looking in does not). Built (back end D). */
  arrivedAt: isoDateTime.nullable(),
  lineCount: z.number().int().nonnegative(),
  /** Lines with a saved count ("8 of 8 counted"). */
  countedCount: z.number().int().nonnegative(),
  /** Lines flagged COUNT_AGAIN ("1 line to count again"). */
  countAgainCount: z.number().int().nonnegative(),
  lines: z.array(countLineSchema),
  /** Every line has a count: "Check and sign" can be pressed. */
  canCheck: z.boolean(),
  /** The Branch Manager is counting for the department: the summary will say "on behalf of". */
  onBehalfOfDepartment: departmentRefSchema.nullable(),
});
export type CountView = z.infer<typeof countViewSchema>;

// --- V3 PUT /deliveries/:id/count and POST /deliveries/:id/check (Paper D8, D9) ------------

/**
 * Saves what was typed; never says whether it matches. Counts autosave; 0 is a valid count, an empty box is not (a line is sent only
 * with a number); one shared draft per delivery, last write wins. A line already SHORT or EXTRA is final and is refused (`RECOUNT_USED`).
 */
export const saveCountInputSchema = z
  .object({ counts: z.array(z.object({ lineId: uuid, countedQty: nonNegativeDecimal }).strict()).min(1).max(300) })
  .strict()
  .refine((v) => new Set(v.counts.map((c) => c.lineId)).size === v.counts.length, 'A line can be listed once');
export type SaveCountInput = z.infer<typeof saveCountInputSchema>;
/** The response is the updated `CountView`. */

/**
 * The check (no body), run on "Check and sign": every line is compared; the response lists ONLY the lines that differ, by name and
 * typed number, with the `direction` they differ in (Paper D10). A line differing for the first time is COUNT_AGAIN; one that still
 * differs is SHORT or EXTRA (final). No sent figure, no size of gap.
 */
export const checkCountResultSchema = z.object({
  differing: z.array(
    z.object({
      lineId: uuid,
      itemName: z.string(),
      countedQty: nonNegativeDecimal,
      direction: z.enum(['SHORT', 'EXTRA']),
      state: z.enum(['COUNT_AGAIN', 'SHORT', 'EXTRA']),
    }),
  ),
  /** No line is COUNT_AGAIN: the counts are final and the next screens are reasons, the summary and the PIN. */
  final: z.boolean(),
  /** Every line that is SHORT or EXTRA has a reason (V4). */
  reasonsComplete: z.boolean(),
  view: countViewSchema,
});
export type CheckCountResult = z.infer<typeof checkCountResultSchema>;

// --- V4 PUT /deliveries/:id/lines/:lineId/reason and POST /deliveries/:id/photos (Paper D10) ---

/** Only a line that is SHORT or EXTRA (`LINE_NOT_DIFFERENT` otherwise). The photo is suggested for DAMAGED and WRONG_ITEM, never forced. The response is the updated `CountLine`. */
export const setReasonInputSchema = z.object({ reason: countReasonSchema, note: z.string().trim().min(1).max(REASON_NOTE_MAX).optional() }).strict();
export type SetReasonInput = z.infer<typeof setReasonInputSchema>;

/**
 * The photo upload is multipart: a `lineId` field and one `file` part (JPEG, PNG or WebP by magic bytes, at most 5 MB, at most 3
 * photos per line). The body schema is the field part only.
 */
export const uploadPhotoFieldsSchema = z.object({ lineId: uuid }).strict();
export type UploadPhotoFields = z.infer<typeof uploadPhotoFieldsSchema>;
export const uploadPhotoResultSchema = z.object({ lineId: uuid, photo: photoRefSchema, photos: z.array(photoRefSchema) });
export type UploadPhotoResult = z.infer<typeof uploadPhotoResultSchema>;

/** `DELETE /deliveries/:id/photos/:photoId` (Amendment 1 row 6), no body: removes a mistaken photo before the confirm; the response is the line's photos that remain. */
export const deletePhotoResultSchema = z.object({ lineId: uuid, photos: z.array(photoRefSchema) });
export type DeletePhotoResult = z.infer<typeof deletePhotoResultSchema>;

// --- V5 GET /deliveries/:id/confirm-preview (Paper D11) --------------------------------------

/** The summary, and the ONLY place the sent figure appears before the signature. Titles, not names: "signed by the Barista Department Head". */
export const confirmPreviewSchema = z.object({
  id: uuid,
  reference: z.string(),
  department: departmentRefSchema,
  lineCount: z.number().int().nonnegative(),
  /** "7 lines match": names only, no figures. */
  matchingLines: z.array(z.object({ lineId: uuid, itemName: z.string() })),
  differingLines: z.array(
    z.object({
      lineId: uuid,
      itemName: z.string(),
      unit: z.string(),
      countedQty: nonNegativeDecimal,
      /** Revealed here, now that the counts are final. */
      sentQty: nonNegativeDecimal,
      /** counted − sent, signed: negative short, positive extra. */
      gapQty: decimalString,
      direction: z.enum(['SHORT', 'EXTRA']),
      reason: countReasonSchema.nullable(),
      reasonNote: z.string().nullable(),
      photoCount: z.number().int().nonnegative(),
    }),
  ),
  /** The signer as the record will show: the title, and "on behalf of the department" when the Branch Manager signs for one. */
  signedBy: personSchema,
  onBehalfOfDepartment: departmentRefSchema.nullable(),
  /** Every precondition holds (all counted, no COUNT_AGAIN, every difference has a reason). */
  canConfirm: z.boolean(),
});
export type ConfirmPreview = z.infer<typeof confirmPreviewSchema>;

// --- V6 POST /deliveries/:id/confirm (Paper D11, D12, D19) ---------------------------------------

/** `onBehalf` is for the Branch Manager signing for a department that has not counted (D19). */
export const confirmDeliveryInputSchema = z.object({ pin: pinSchema, onBehalf: z.boolean().optional(), idempotencyKey: idempotencyKeySchema }).strict();
export type ConfirmDeliveryInput = z.infer<typeof confirmDeliveryInputSchema>;

export const confirmDeliveryResultSchema = z.object({
  id: uuid,
  reference: z.string(),
  status: z.enum(['CONFIRMED', 'CLOSED']),
  /** The three times of D12 (Amendment 1 row 10): left, arrived (null if nobody opened it first, as on-behalf), confirmed. */
  signedAt: isoDateTime,
  arrivedAt: isoDateTime.nullable(),
  confirmedAt: isoDateTime,
  /** The real signer. */
  confirmedBy: personSchema,
  onBehalfOfDepartment: departmentRefSchema.nullable(),
  lineCount: z.number().int().nonnegative(),
  matchedCount: z.number().int().nonnegative(),
  /** One `DSC-` per differing line, held as unaccounted until the Store Manager records a finding ("opens DSC-NYR-0007"). */
  discrepancies: z.array(z.object({ id: uuid, reference: z.string(), itemName: z.string(), gapQty: decimalString })),
  /** A repeated idempotencyKey returned the first result. */
  replayed: z.boolean(),
});
export type ConfirmDeliveryResult = z.infer<typeof confirmDeliveryResultSchema>;

// --- V7 GET /deliveries/:id (the department's own delivery file, Paper N3a and N3b) -------------------

/**
 * A department head or member holds no `dispatch.read`, so P6 cannot serve the file they open from My deliveries. V7 returns the same
 * `DispatchFile`, built by the same function, with the same rules: a department caller is always branch side, so `sentVisible` is
 * false and `sentQty`, `gapQty`, `shortCount`, `gapLineCount` and every money field are ABSENT or 0 until their department has signed
 * its count; money only for a holder of `requisitions.see_value`; `siblings` is empty and `can.print` false. A member reads their
 * own department (`NOT_YOUR_DEPARTMENT` otherwise); the Branch Manager any department of the branch. An unsigned dispatch is
 * `NOT_ON_THE_WAY`.
 */
export const deliveryFileSchema = dispatchFileSchema;
export type DeliveryFile = z.infer<typeof deliveryFileSchema>;

// --- Errors ----------------------------------------------------------------------------------------

export const DELIVERY_ERROR_CODES = [
  'INVALID_PIN', // 401: V6
  'NOT_YOUR_DEPARTMENT', // 403: V1 to V6, a member of another department
  'NOT_ON_THE_WAY', // 409: V2 to V6, the dispatch is not signed yet, or already confirmed
  'COUNT_AGAIN_PENDING', // 409: V5, V6, a flagged line has not been counted again and checked
  'LINE_NOT_DIFFERENT', // 409: V4, a reason or photo on a line that matches or is not final
  'PHOTO_TYPE_NOT_ALLOWED', // 415: V4, not a JPEG, PNG or WebP
  'ON_BEHALF_NOT_ALLOWED', // 403: V6, `onBehalf` by someone without `deliveries.confirm_on_behalf`
  // Amendment 1 row 11 (renamed from my first pass where they overlap: COUNT_FINAL, NOT_ALL_COUNTED, REASON_MISSING)
  'ALREADY_CONFIRMED', // 409: V3 to V6, another member signed first (the two-signature race)
  'NOT_COUNTED', // 409: V3 check, V5, V6, a line has no count
  'RECOUNT_USED', // 409: V3 PUT, the line was already checked twice: the second count is final
  'REASON_REQUIRED', // 422: V5 (canConfirm false), V6, a differing line without a reason
  'DISPATCH_CANCELLED', // 409: V2 to V6, the dispatch was cancelled by the store (the department learns on its next write; no push)
  'TOO_MANY_PHOTOS', // 409: V4, more than 3 on a line
  'PHOTO_TOO_LARGE', // 413: V4, over 5 MB
] as const;
export type DeliveryErrorCode = (typeof DELIVERY_ERROR_CODES)[number];
