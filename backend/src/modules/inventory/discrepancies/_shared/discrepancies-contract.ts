/**
 * Inventory: Dispatch, deliveries and discrepancies (Block 2), the DISCREPANCIES half.
 * FROZEN API CONTRACT: request and response schemas for Q1 to Q5.
 *
 * Source of truth: docs/features/inventory/dispatch-contract.md (§4 and §6), discrepancies.md and Paper 7c (the list), D14 (the file),
 * D15 (record a finding), D16 (reverse a finding). Mirrored by hand in
 * `frontend/features/inventory/discrepancies/_shared/types/discrepancies-contract.ts`; fixtures in `discrepancies-contract.fixtures.json`.
 * Shared pieces (people, photos, reasons, record links, the error envelope) come from `dispatch/_shared/dispatch-contract.ts`.
 *
 * A discrepancy opens when a department signs a count that differs from what was sent (one `DSC-` per differing line). The gap is held
 * as unaccounted until the Store Manager (or System Admin) records ONE finding with a PIN; a wrong finding is reversed by a new linked
 * entry. A finding and its reversal are separate append-only rows (`DiscrepancyEvent`); nothing is edited or deleted.
 *
 * Money: `lossValueKes` and `valueKes` follow `requisitions.see_value` (the Accountant, Director, Store Manager, Branch Manager and
 * System Admin hold it; the Branch Manager does not see supplier payment details, which is unrelated). Absent, never null, without it.
 * The sent figure is shown here because a discrepancy exists only after the department has signed its count.
 *
 * Amendment 1 (docs/features/inventory/dispatch-amendment-1.md) is applied: a reversal puts the gap back to unaccounted (status goes
 * REVERSED, then back to OPEN, and a new finding may be recorded; the events keep the history), Q1 tabs carry `counts`, Q4 and Q5
 * carry an idempotencyKey, and the new code is FINDING_NOT_REVERSIBLE.
 *
 * Do not change a shape here without changing the contract document, the mirror and the fixtures in the same commit, and only with
 * the owner's approval.
 */
import { z } from 'zod';
import { decimalString, isoDateTime, nairobiDate, nonNegativeDecimal, pageInfoSchema, pageQuerySchema, uuid } from '../../_shared/wire';
import {
  branchRefSchema,
  countReasonSchema,
  departmentRefSchema,
  dispatchActivityEventSchema,
  idempotencyKeySchema,
  photoRefSchema,
  pinSchema,
  stampSchema,
} from '../../dispatch/_shared/dispatch-contract';

// --- Words and enums -----------------------------------------------------------

/** Socket event (Amendment 1 row 16), per record. Emitted by `discrepancies-notify.ts` and `deliveries-notify.ts` (back end D). */
export const DISCREPANCY_CHANGED_EVENT = 'discrepancy:changed';
export const discrepancyChangedPayloadSchema = z.object({ id: uuid, reference: z.string(), siteId: z.string(), reason: z.string() });
export type DiscrepancyChangedPayload = z.infer<typeof discrepancyChangedPayloadSchema>;

/**
 * Database names. OPEN = held as unaccounted, waiting for a finding, and again after a reversal. REVERSED is the instant a reversal is
 * posted: the status goes REVERSED and straight back to OPEN (Amendment 1 row 7), so a response never shows it as the settled state.
 */
export const DISCREPANCY_STATUSES = ['OPEN', 'RECORDED', 'REVERSED'] as const;
export const discrepancyStatusSchema = z.enum(DISCREPANCY_STATUSES);
export type DiscrepancyStatus = z.infer<typeof discrepancyStatusSchema>;

/** The five findings of discrepancies.md §"What happens after the branch signs": four for a short line, three for an extra one (two are shared). */
export const FINDINGS = ['PACKED_SHORT', 'PACKED_MORE', 'LOST_OR_DAMAGED', 'BRANCH_COUNTED_WRONG', 'CANT_TELL'] as const;
export const findingSchema = z.enum(FINDINGS);
export type Finding = z.infer<typeof findingSchema>;

/** The direction of the gap: counted fewer than sent (negative `gapQty`) or more (positive). */
export const GAP_DIRECTIONS = ['SHORT', 'EXTRA'] as const;
export const gapDirectionSchema = z.enum(GAP_DIRECTIONS);
export type GapDirection = z.infer<typeof gapDirectionSchema>;

/** Which findings may be recorded for which direction. The service refuses any other pair with `FINDING_NOT_ALLOWED`. */
export const FINDINGS_FOR: Record<GapDirection, readonly Finding[]> = {
  SHORT: ['PACKED_SHORT', 'LOST_OR_DAMAGED', 'BRANCH_COUNTED_WRONG', 'CANT_TELL'],
  EXTRA: ['PACKED_MORE', 'BRANCH_COUNTED_WRONG', 'CANT_TELL'],
};

/** Names as Paper D15 and D21 draw them; the Extra names are the contract's recommended wording (not drawn, owner to confirm). */
export const FINDING_TEXT: Record<Finding, string> = {
  PACKED_SHORT: 'Packed short at the store',
  PACKED_MORE: 'Packed more than recorded',
  LOST_OR_DAMAGED: 'Lost or damaged on the way',
  BRANCH_COUNTED_WRONG: 'Branch counted wrong',
  CANT_TELL: "Can't tell",
};

/** Whom a finding is recorded against, and whether it counts as a loss (D21 "Four findings, each with its stock effect"). */
export const FINDING_AGAINST = ['STORE', 'CARRIER', 'RECEIVER', 'UNEXPLAINED'] as const;
export const findingAgainstSchema = z.enum(FINDING_AGAINST);
export type FindingAgainst = z.infer<typeof findingAgainstSchema>;
/** `lossKind`: LOSS written off at frozen cost; PACKING_ERROR shown on its own report line (not a loss); NONE (a correction). */
export const LOSS_KINDS = ['LOSS', 'PACKING_ERROR', 'NONE'] as const;
export const lossKindSchema = z.enum(LOSS_KINDS);
export type LossKind = z.infer<typeof lossKindSchema>;
export const FINDING_PROFILE: Record<Finding, { against: FindingAgainst; lossKind: LossKind }> = {
  PACKED_SHORT: { against: 'STORE', lossKind: 'PACKING_ERROR' },
  PACKED_MORE: { against: 'STORE', lossKind: 'PACKING_ERROR' },
  LOST_OR_DAMAGED: { against: 'CARRIER', lossKind: 'LOSS' },
  BRANCH_COUNTED_WRONG: { against: 'RECEIVER', lossKind: 'NONE' },
  CANT_TELL: { against: 'UNEXPLAINED', lossKind: 'LOSS' },
};

export const DISCREPANCY_TABS = ['open', 'settled'] as const;
export const discrepancyTabSchema = z.enum(DISCREPANCY_TABS);
export type DiscrepancyTab = z.infer<typeof discrepancyTabSchema>;

export const FINDING_NOTE_MAX = 300;
export const REVERSE_REASON_MAX = 300;
/** Fixed constants, not settings (owner, 8 Oct): the reminder after 24 hours, then daily. */
export const REMINDER_AFTER_HOURS = 24;

// --- Shared pieces ---------------------------------------------------------------

/** A recorded finding as the file and the list show it. */
export const recordedFindingSchema = z.object({
  finding: findingSchema,
  note: z.string().nullable(),
  recorded: stampSchema,
  against: findingAgainstSchema,
  lossKind: lossKindSchema,
  /** cap requisitions.see_value: the written-off value at the cost frozen at dispatch (LOSS findings), KES. Absent without the capability. */
  lossValueKes: decimalString.optional(),
});
export type RecordedFinding = z.infer<typeof recordedFindingSchema>;

/** The latest reversal, for the file's history line; the events hold every one. */
export const reversalSchema = z.object({ reason: z.string(), reversed: stampSchema });
export type Reversal = z.infer<typeof reversalSchema>;

// --- Q1 GET /discrepancies (Paper 7c) -----------------------------------------------

/** `discrepancies.read`; a Branch Manager's branch and a head's department are applied by the service. `departmentId` is Paper 7c's "Department: All" (contract addition, reported). `q` searches the number and the item. */
export const listDiscrepanciesQuerySchema = pageQuerySchema.extend({
  tab: discrepancyTabSchema.default('open'),
  branchId: uuid.optional(),
  departmentId: uuid.optional(),
  q: z.string().trim().min(1).optional(),
  from: nairobiDate.optional(),
  to: nairobiDate.optional(),
});
export type ListDiscrepanciesQuery = z.infer<typeof listDiscrepanciesQuerySchema>;

export const discrepancyRowSchema = z.object({
  id: uuid,
  /** "DSC-NYR-0007" */
  reference: z.string(),
  status: discrepancyStatusSchema,
  branch: branchRefSchema,
  department: departmentRefSchema,
  itemName: z.string(),
  unit: z.string(),
  /** counted − sent, signed: -2. */
  gapQty: decimalString,
  direction: gapDirectionSchema,
  /** The reason the branch gave ("not in the box"), as a line under the number. */
  branchReason: countReasonSchema.nullable(),
  dispatch: z.object({ id: uuid, reference: z.string() }),
  openedAt: isoDateTime,
  /** "Open for 1 h 2 min" runs from openedAt; the row is flagged when a reminder has gone ("reminder sent after 24 hours"). */
  reminderSentAt: isoDateTime.nullable(),
  /** The recorded finding, on the Settled tab; null while open. */
  finding: recordedFindingSchema.nullable(),
  can: z.object({ recordFinding: z.boolean() }),
});
export type DiscrepancyRow = z.infer<typeof discrepancyRowSchema>;

export const listDiscrepanciesSchema = z.object({
  tab: discrepancyTabSchema,
  rows: z.array(discrepancyRowSchema),
  /** Amendment 1 row 9. A discrepancy whose finding was reversed counts as Open. */
  counts: z.object({ open: z.number().int().nonnegative(), settled: z.number().int().nonnegative() }),
  /** Hub roles only: the branch picker. */
  branches: z.array(branchRefSchema).optional(),
  page: pageInfoSchema,
});
export type ListDiscrepancies = z.infer<typeof listDiscrepanciesSchema>;

// --- Q2 GET /discrepancies/:id (Paper D14) -----------------------------------------------

export const discrepancyFileSchema = z.object({
  id: uuid,
  reference: z.string(),
  status: discrepancyStatusSchema,
  branch: branchRefSchema,
  department: departmentRefSchema,
  dispatch: z.object({ id: uuid, reference: z.string() }),
  requisition: z.object({ id: uuid, reference: z.string() }),
  item: z.object({ id: uuid, name: z.string(), unit: z.string() }),
  /** The gap: sent, counted, held as unaccounted (|gap|). */
  sentQty: nonNegativeDecimal,
  countedQty: nonNegativeDecimal,
  gapQty: decimalString,
  direction: gapDirectionSchema,
  countedTwice: z.boolean(),
  branchReason: countReasonSchema.nullable(),
  branchReasonNote: z.string().nullable(),
  photos: z.array(photoRefSchema),
  /** Who handled it (D14 "WHO HANDLED IT"). */
  packed: stampSchema,
  signed: stampSchema,
  carrier: z.object({ id: uuid, name: z.string() }),
  counted: stampSchema,
  /** "Assigned to": the title it is assigned to (the Store Manager). */
  assignedTo: z.string(),
  openedAt: isoDateTime,
  reminderSentAt: isoDateTime.nullable(),
  /** The CURRENT finding: null while OPEN, including after a reversal (the history is in `events` and `reversal`). */
  finding: recordedFindingSchema.nullable(),
  reversal: reversalSchema.nullable(),
  /** The findings that may be recorded for this direction (`FINDINGS_FOR`); empty unless the status is OPEN (after a reversal it is full again). */
  allowedFindings: z.array(findingSchema),
  /** Append-only: opened, finding, reversal (the dispatch activity events DISCREPANCY_OPENED, FINDING_RECORDED, FINDING_REVERSED). */
  events: z.array(dispatchActivityEventSchema),
  /** The Next step card: the action key and facts only. */
  nextStep: z.object({
    action: z.enum(['RECORD_A_FINDING']).nullable(),
    facts: z.object({ reminderAfterHours: z.number().int().positive() }),
  }),
  /** cap requisitions.see_value: the held gap at the cost frozen at dispatch, KES. */
  valueKes: decimalString.optional(),
  can: z.object({ recordFinding: z.boolean(), reverse: z.boolean() }),
});
export type DiscrepancyFile = z.infer<typeof discrepancyFileSchema>;

// --- Q3 GET /discrepancies/:id/finding-preview?finding= (Paper D15) --------------------------

export const findingPreviewQuerySchema = z.object({ finding: findingSchema });
export type FindingPreviewQuery = z.infer<typeof findingPreviewQuerySchema>;

/** What the finding would do, live, before the PIN. A finding not allowed for the direction is refused (`FINDING_NOT_ALLOWED`). */
export const findingPreviewSchema = z.object({
  id: uuid,
  reference: z.string(),
  finding: findingSchema,
  itemName: z.string(),
  unit: z.string(),
  /** The ledger effect, one row per place stock moves: "Central Store stock +2". Signed. */
  effects: z.array(z.object({ place: z.enum(['CENTRAL_STORE', 'DEPARTMENT', 'WRITTEN_OFF']), placeName: z.string(), quantity: decimalString })),
  against: findingAgainstSchema,
  /** The party it is recorded against: "Packer: Store Attendant", the carrier's name, "Receiver: Barista Department Head", "Unexplained". */
  againstParty: z.string().nullable(),
  lossKind: lossKindSchema,
  /** cap requisitions.see_value: written off at the cost frozen at dispatch (LOSS findings), KES. */
  lossValueKes: decimalString.optional(),
});
export type FindingPreview = z.infer<typeof findingPreviewSchema>;

// --- Q4 POST /discrepancies/:id/findings (Paper D15) ------------------------------------------

/** `discrepancies.record`: the Store Manager or System Admin, with their own PIN. Posts through the ledger door as a new linked entry carrying the `DSC-` number. */
export const recordFindingInputSchema = z
  .object({ finding: findingSchema, note: z.string().trim().min(1).max(FINDING_NOTE_MAX).optional(), pin: pinSchema, idempotencyKey: idempotencyKeySchema })
  .strict();
export type RecordFindingInput = z.infer<typeof recordFindingInputSchema>;
export const recordFindingResultSchema = z.object({
  id: uuid,
  reference: z.string(),
  status: z.literal('RECORDED'),
  finding: recordedFindingSchema,
  /** Ledger entries posted (balanced, linked to the `DSC-` number). */
  ledgerEntries: z.number().int().nonnegative(),
  /** A repeated idempotencyKey returned the first result. */
  replayed: z.boolean(),
});
export type RecordFindingResult = z.infer<typeof recordFindingResultSchema>;

// --- Q5 POST /discrepancies/:id/reverse (Paper D16) -----------------------------------------------

/** `discrepancies.reverse`. A new linked entry with the opposite effect; the finding and the reversal both stay on the file and in the audit log. The reason chips are a screen convention: the wire holds the words. */
export const reverseFindingInputSchema = z
  .object({ reason: z.string().trim().min(3).max(REVERSE_REASON_MAX), pin: pinSchema, idempotencyKey: idempotencyKeySchema })
  .strict();
export type ReverseFindingInput = z.infer<typeof reverseFindingInputSchema>;
/** After a reversal the gap is held as unaccounted again: `status` is OPEN and a new finding may be recorded. */
export const reverseFindingResultSchema = z.object({
  id: uuid,
  reference: z.string(),
  status: z.literal('OPEN'),
  reversal: reversalSchema,
  ledgerEntries: z.number().int().nonnegative(),
  /** A repeated idempotencyKey returned the first result. */
  replayed: z.boolean(),
});
export type ReverseFindingResult = z.infer<typeof reverseFindingResultSchema>;

// --- Errors ----------------------------------------------------------------------------------------

export const DISCREPANCY_ERROR_CODES = [
  'FINDING_ALREADY_RECORDED', // 409: Q4 on a discrepancy that is not OPEN (from the contract)
  'INVALID_PIN', // 401: Q4, Q5
  'FINDING_NOT_ALLOWED', // 422: Q3, Q4, a finding that does not fit the gap's direction (`FINDINGS_FOR`)
  // Amendment 1 row 7 and 11. Replaces my first pass's NO_FINDING_TO_REVERSE and ALREADY_REVERSED: after a reversal the status is OPEN
  // again, so "nothing to reverse" and "already reversed" are the same refusal.
  'FINDING_NOT_REVERSIBLE', // 409: Q5 on a discrepancy that has no recorded finding to reverse
] as const;
export type DiscrepancyErrorCode = (typeof DISCREPANCY_ERROR_CODES)[number];
