/**
 * Inventory: Branch day rebuild (Block 4)
 * FROZEN API CONTRACT: request and response schemas for BD1 to BD21.
 *
 * Source of truth: docs/features/inventory/branch-day-contract.md and Paper page "Inventory · Counting and closing" (steps B0 to B18,
 * chapter 5 steps 19 and 20). The flow is branch-day-flow.md. The front end mirrors this file by hand in
 * `frontend/features/inventory/branch-day/_shared/types/branch-day-contract.ts`; the shared sample payloads are in
 * `branch-day-contract.fixtures.json` (parsed by `branch-day-contract.test.ts`, typed by the mirror's test; the two copies are byte-identical).
 *
 * Wire rules: `_shared/wire.ts` (decimals are strings, ids strings, ISO times, Nairobi dates). A field marked "cap" is ABSENT, never
 * null, unless the caller holds that capability. Money is `*ValueKes` and `unitCostKes` (cap `catalog.see_costs`: the Branch Manager and
 * every desktop reader hold it; a department head or member never does). Screens read the `can` flags and test whether a key is
 * present, never a role name. The back end sends FACTS and codes (states, ids, times, figures); the titles and lines of the blockers
 * and chips are written on the front end from the Paper step B18 wording table.
 *
 * THE BLIND RULE, in the shape: the head's evening count (BD6, BD7, BD8) carries no opening, received, waste, used, yesterday or
 * expected figure, and no money, ever (a test pins the key names). The opening check (BD2) shows last night's signed figure by
 * design (Paper B1); every past day the head reads (BD10) shows quantities and no money.
 *
 * Signing writes (BD5, BD8, BD14, BD20) take `{ pin, idempotencyKey }` in the body; BD3 (accepting an opening) takes an
 * `idempotencyKey` and no PIN. A repeated key returns the first result with `replayed: true`.
 *
 * Do not change a shape here without changing the contract document, the mirror and the fixtures in the same commit, and only with
 * the owner's approval.
 */
import { z } from 'zod';
import { decimalString, isoDateTime, nairobiDate, nonNegativeDecimal, pageInfoSchema, pageQuerySchema, personSchema, uuid } from '../../_shared/wire';
import { branchRefSchema, errorBodySchema, idempotencyKeySchema, pinSchema } from '../../requisitions/_shared/requisitions-contract';
import { departmentRefSchema } from '../../dispatch/_shared/dispatch-contract';

export { branchRefSchema, departmentRefSchema, errorBodySchema, idempotencyKeySchema, pinSchema };

// --- Words and enums --------------------------------------------------------------

/** A day's state in History and on its file. The database stores OPEN and CLOSED; CORRECTED is derived (closed, with at least one correction). */
export const DAY_STATUSES = ['OPEN', 'CLOSED', 'CORRECTED'] as const;
export const dayStatusSchema = z.enum(DAY_STATUSES);
export type DayStatus = z.infer<typeof dayStatusSchema>;
export const DAY_STATUS_TEXT: Record<DayStatus, string> = { OPEN: 'Open', CLOSED: 'Closed', CORRECTED: 'Corrected' };

/** A department card on Today: Counted or Not counted. */
export const COUNT_STATES = ['NOT_COUNTED', 'COUNTED'] as const;
export const countStateSchema = z.enum(COUNT_STATES);
export type CountState = z.infer<typeof countStateSchema>;

/** The opening check: nobody has checked it (the day runs on last night's figure), the head accepted it, or the head recounted it. */
export const OPENING_STATES = ['NOT_CHECKED', 'ACCEPTED', 'RECOUNTED'] as const;
export const openingStateSchema = z.enum(OPENING_STATES);
export type OpeningState = z.infer<typeof openingStateSchema>;

export const DELIVERY_STATES = ['NONE', 'WAITING', 'CONFIRMED'] as const;
export const deliveryStateSchema = z.enum(DELIVERY_STATES);
export type DeliveryState = z.infer<typeof deliveryStateSchema>;

/** The three reasons for a correction (Paper B12, B18). The note is optional for all three. */
export const CORRECTION_REASONS = ['COUNTED_WRONGLY', 'ITEM_WAS_MISSED', 'OTHER'] as const;
export const correctionReasonSchema = z.enum(CORRECTION_REASONS);
export type CorrectionReason = z.infer<typeof correctionReasonSchema>;
export const CORRECTION_REASON_TEXT: Record<CorrectionReason, string> = {
  COUNTED_WRONGLY: 'Counted wrongly',
  ITEM_WAS_MISSED: 'Item was missed',
  OTHER: 'Other',
};
export const CORRECTION_NOTE_MAX = 200;

/** What the head's Day home offers as the one button (Paper B0): check the opening in the morning, count in the evening, nothing once sent. */
export const HOME_ACTIONS = ['CHECK_OPENING', 'COUNT', 'NONE'] as const;
export const homeActionSchema = z.enum(HOME_ACTIONS);
export type HomeAction = z.infer<typeof homeActionSchema>;

/** The lines under "Before the day can close" on Today (Paper B5, B7, B14). Severity: BLOCKS stops the close, INFO is "to know about", OK is a tick. */
export const BLOCKER_KINDS = ['DEPARTMENT_NOT_COUNTED', 'DELIVERY_NOT_CONFIRMED', 'DELIVERIES_CONFIRMED', 'ALL_COUNTED', 'OPENING_NOT_CHECKED'] as const;
export const blockerKindSchema = z.enum(BLOCKER_KINDS);
export type BlockerKind = z.infer<typeof blockerKindSchema>;
export const BLOCKER_SEVERITIES = ['BLOCKS', 'INFO', 'OK'] as const;
export const blockerSeveritySchema = z.enum(BLOCKER_SEVERITIES);
export type BlockerSeverity = z.infer<typeof blockerSeveritySchema>;

/** The rows of the Activity tab and the Audit log source `BRANCH_DAY`. Printing is never an event. */
export const DAY_ACTIVITY_TYPES = [
  'OPENING_ACCEPTED',
  'OPENING_RECOUNTED',
  'COUNT_SIGNED',
  'COUNT_SIGNED_ON_BEHALF',
  'DAY_CLOSED',
  'COUNT_CORRECTED',
] as const;
export const dayActivityTypeSchema = z.enum(DAY_ACTIVITY_TYPES);
export type DayActivityType = z.infer<typeof dayActivityTypeSchema>;

/** The day sheet versions: the one made at the close, and one more after each correction. */
export const SHEET_KINDS = ['AT_THE_CLOSE', 'AFTER_CORRECTION'] as const;
export const sheetKindSchema = z.enum(SHEET_KINDS);
export type SheetKind = z.infer<typeof sheetKindSchema>;

// --- Shared pieces ----------------------------------------------------------------

/** One overnight difference: counted minus last night's signed figure (negative = "less"). The Branch Manager sees it; heads see their own at B2. */
export const openingDifferenceSchema = z.object({
  itemId: uuid,
  itemName: z.string(),
  unit: z.string(),
  lastNightQty: nonNegativeDecimal,
  countedQty: nonNegativeDecimal,
  /** counted − last night, signed ("-1"). Never zero. */
  difference: decimalString,
});
export type OpeningDifference = z.infer<typeof openingDifferenceSchema>;

/** Who checked the opening and how. */
export const openingCheckSchema = z.object({
  state: openingStateSchema,
  checkedAt: isoDateTime.nullable(),
  checkedBy: personSchema.nullable(),
  /** The Branch Manager checked it for the department (not drawn: contract gap 7). */
  onBehalf: z.boolean(),
  differences: z.array(openingDifferenceSchema),
});
export type OpeningCheck = z.infer<typeof openingCheckSchema>;

/** A delivery to the department today, as a fact for the tracker: how many came, whether they are all confirmed, and how many lines differed. */
export const deliveryFactSchema = z.object({
  state: deliveryStateSchema,
  /** "DSP-NYR-0231": the dispatches to this department that are On the way or confirmed today. */
  dispatches: z.array(z.object({ id: uuid, reference: z.string() })),
  /** Latest confirmation today; null while any is waiting or none came. */
  confirmedAt: isoDateTime.nullable(),
  /** Lines whose count differed ("1 short"), summed over today's confirmed deliveries. Zero while waiting. */
  gapCount: z.number().int().nonnegative(),
  /** A discrepancy of those deliveries is still open ("held for the Store Manager"). */
  gapOpen: z.boolean(),
});
export type DeliveryFact = z.infer<typeof deliveryFactSchema>;

/** Where the day's usage entries show: `DAY-NYR-0044` is the reference on every one. */
export const ledgerEntrySchema = z.object({
  id: uuid,
  at: isoDateTime,
  itemName: z.string(),
  unit: z.string(),
  department: departmentRefSchema,
  /** Signed as stored: "-3" is three used. A correction's entry carries the change only. */
  quantity: decimalString,
  /** The `DAY-…` reference every usage entry carries. */
  reference: z.string(),
  kind: z.enum(['USAGE', 'CORRECTION']),
});
export type LedgerEntry = z.infer<typeof ledgerEntrySchema>;

/** One printed day sheet kept on file (Paper B13). */
export const dayDocumentSchema = z.object({
  id: uuid,
  version: z.number().int().min(1),
  kind: sheetKindSchema,
  /** The newest version ("Latest · includes the correction"). */
  latest: z.boolean(),
  reference: z.string(),
  pages: z.number().int().min(2),
  madeAt: isoDateTime,
});
export type DayDocument = z.infer<typeof dayDocumentSchema>;

/** A correction as a figure line and the sheet show it: the closing figure as signed at the close, and as corrected. */
export const lineCorrectionSchema = z.object({
  id: uuid,
  at: isoDateTime,
  by: personSchema,
  fromClosingQty: nonNegativeDecimal,
  toClosingQty: nonNegativeDecimal,
  fromUsedQty: decimalString,
  toUsedQty: decimalString,
  reason: correctionReasonSchema,
  note: z.string().nullable(),
});
export type LineCorrection = z.infer<typeof lineCorrectionSchema>;

/**
 * One item's row on a department's figures (Paper B6, B11). `closingQty` and `usedQty` are null until the department has counted.
 * Used today = opening + received − waste − closing. `yesterdayUsedQty` is the same item's Used today the calendar day before (null
 * when that day is not closed or the item was not on it). The `*ValueKes` fields and `unitCostKes` are cap `catalog.see_costs`.
 */
export const figureLineSchema = z.object({
  itemId: uuid,
  itemName: z.string(),
  unit: z.string(),
  openingQty: decimalString,
  receivedQty: decimalString,
  wasteQty: decimalString,
  closingQty: nonNegativeDecimal.nullable(),
  usedQty: decimalString.nullable(),
  yesterdayUsedQty: decimalString.nullable(),
  unitCostKes: decimalString.optional(),
  usedValueKes: decimalString.nullable().optional(),
  closingValueKes: decimalString.nullable().optional(),
  /** The latest correction of this line (the day sheet strikes the original through). Null when none. */
  correction: lineCorrectionSchema.nullable(),
});
export type FigureLine = z.infer<typeof figureLineSchema>;

/** A department in the rail of the two-pane screens (B6, B11) and on Today's tiles. */
export const departmentTileSchema = z.object({
  departmentId: uuid,
  name: z.string(),
  /** "Grace W." The head's own name: a record states who did what, so a name shows here. Null when the department has no head. */
  head: personSchema.nullable(),
  state: countStateSchema,
  countedAt: isoDateTime.nullable(),
  /** Who signed the count: the head, a member, or the Branch Manager. */
  countedBy: personSchema.nullable(),
  onBehalf: z.boolean(),
  itemCount: z.number().int().nonnegative(),
  opening: z.object({ state: openingStateSchema, differences: z.array(openingDifferenceSchema) }),
  /** cap catalog.see_costs: the department's Used today in KES; null until it has counted. */
  usedValueKes: decimalString.nullable().optional(),
});
export type DepartmentTile = z.infer<typeof departmentTileSchema>;

/** Facts only; the title and line come from the wording table (B18) by `kind`. */
export const blockerSchema = z.object({
  kind: blockerKindSchema,
  severity: blockerSeveritySchema,
  department: departmentRefSchema.nullable(),
  /** DELIVERY_NOT_CONFIRMED: the delivery that left and is not counted ("DSP-NYR-0231 left the store at 3:05 pm"). */
  dispatch: z.object({ id: uuid, reference: z.string(), signedAt: isoDateTime }).nullable(),
  /** DELIVERIES_CONFIRMED and DELIVERY_NOT_CONFIRMED: discrepancies that are open and do not block ("DSC-NYR-0007"). */
  discrepancies: z.array(z.object({ id: uuid, reference: z.string() })),
  /** ALL_COUNTED: when the last department signed. */
  at: isoDateTime.nullable(),
  /** ALL_COUNTED: the department that signed last ("Housekeeping signed its count at 7:24 pm"). DEPARTMENT_NOT_COUNTED and OPENING_NOT_CHECKED use `department`. */
  lastDepartment: departmentRefSchema.nullable(),
});
export type Blocker = z.infer<typeof blockerSchema>;

export const dayHeadSchema = z.object({
  id: uuid,
  /** "DAY-NYR-0044" (an older day keeps "DAY-0012"). */
  reference: z.string(),
  date: nairobiDate,
  status: dayStatusSchema,
});
export type DayHead = z.infer<typeof dayHeadSchema>;

// --- BD1 GET /home (Paper B0, B4): the head's Day ------------------------------------

/** No query: the caller's own department (a person belongs to one). */
export const homeSchema = z.object({
  day: dayHeadSchema,
  branch: branchRefSchema,
  department: departmentRefSchema,
  itemCount: z.number().int().nonnegative(),
  opening: openingCheckSchema,
  delivery: deliveryFactSchema,
  /** The evening count; `signedBy` and `onBehalf` say who. */
  count: z.object({ state: countStateSchema, signedAt: isoDateTime.nullable(), signedBy: personSchema.nullable(), onBehalf: z.boolean() }),
  /** The Branch Manager closes the day (B4's last tracker line). */
  closed: z.object({ at: isoDateTime.nullable() }),
  action: homeActionSchema,
});
export type Home = z.infer<typeof homeSchema>;

// --- BD2 GET /opening (B1) and the writes BD3, BD4, BD5 (B1, B2, B2b) ---------------

/** `departmentId` is for the Branch Manager only (contract gap 7); a head or member is always their own department. */
export const openingQuerySchema = z.object({ departmentId: uuid.optional() });
export type OpeningQuery = z.infer<typeof openingQuerySchema>;

export const openingLineSchema = z.object({
  itemId: uuid,
  itemName: z.string(),
  unit: z.string(),
  /** Last night's signed closing figure (as corrected). */
  lastNightQty: nonNegativeDecimal,
  /** What was accepted or recounted; null until the opening is checked. */
  acceptedQty: nonNegativeDecimal.nullable(),
});
export type OpeningLine = z.infer<typeof openingLineSchema>;

export const openingViewSchema = z.object({
  day: dayHeadSchema,
  department: departmentRefSchema,
  itemCount: z.number().int().nonnegative(),
  /** When last night's day was closed ("signed when the Barista day closed on Tuesday at 7:31 pm"). Null when there is no earlier close. */
  lastCloseAt: isoDateTime.nullable(),
  check: openingCheckSchema,
  lines: z.array(openingLineSchema),
});
export type OpeningView = z.infer<typeof openingViewSchema>;

export const acceptOpeningInputSchema = z.object({ departmentId: uuid.optional(), idempotencyKey: idempotencyKeySchema }).strict();
export type AcceptOpeningInput = z.infer<typeof acceptOpeningInputSchema>;
export const openingResultSchema = z.object({ view: openingViewSchema, replayed: z.boolean() });
export type OpeningResult = z.infer<typeof openingResultSchema>;

/** One counted figure of a blind count: every line of the department, none left out. */
export const countedLineInputSchema = z.object({ itemId: uuid, countedQty: nonNegativeDecimal });
export type CountedLineInput = z.infer<typeof countedLineInputSchema>;

/** BD4: the receipt-style summary before the PIN (B2). Writes nothing. */
export const recountPreviewInputSchema = z.object({ departmentId: uuid.optional(), lines: z.array(countedLineInputSchema).min(1).max(500) }).strict();
export type RecountPreviewInput = z.infer<typeof recountPreviewInputSchema>;
export const recountPreviewSchema = z.object({
  itemCount: z.number().int().nonnegative(),
  /** Names of the items whose recount matched last night. */
  matchedItems: z.array(z.string()),
  differences: z.array(openingDifferenceSchema),
});
export type RecountPreview = z.infer<typeof recountPreviewSchema>;

export const recountOpeningInputSchema = z
  .object({ departmentId: uuid.optional(), lines: z.array(countedLineInputSchema).min(1).max(500), pin: pinSchema, idempotencyKey: idempotencyKeySchema })
  .strict();
export type RecountOpeningInput = z.infer<typeof recountOpeningInputSchema>;

// --- BD6 GET /count, BD7 PUT /count, BD8 POST /count/sign (B3, B3b, B3c, B15) ----------

/** `departmentId` is for the Branch Manager counting on behalf (B15); a head or member is always their own department. */
export const countQuerySchema = z.object({ departmentId: uuid.optional() });
export type CountQuery = z.infer<typeof countQuerySchema>;

/** One line of the blind count: the item, its unit and what was typed. NOTHING to count against. */
export const countLineSchema = z.object({
  itemId: uuid,
  itemName: z.string(),
  /** "Count in bags": the screen writes the hint from the unit. */
  unit: z.string(),
  categoryPath: z.array(z.string()),
  countedQty: nonNegativeDecimal.nullable(),
});
export type CountLine = z.infer<typeof countLineSchema>;

export const countViewSchema = z.object({
  day: dayHeadSchema,
  department: departmentRefSchema,
  /** The Branch Manager is counting and will sign "on behalf of the department". */
  onBehalfOfDepartment: z.boolean(),
  state: countStateSchema,
  lines: z.array(countLineSchema),
  /** The receipt-style summary of B3b, from the saved figures: 8 items, none left blank, one row per category group. */
  summary: z.object({
    itemCount: z.number().int().nonnegative(),
    filledCount: z.number().int().nonnegative(),
    blankCount: z.number().int().nonnegative(),
    groups: z.array(z.object({ name: z.string(), itemCount: z.number().int().nonnegative() })),
  }),
  /** Every line is filled and the count is not yet signed: "Check and sign" is enabled. */
  canSign: z.boolean(),
  signedAt: isoDateTime.nullable(),
  signedBy: personSchema.nullable(),
});
export type CountView = z.infer<typeof countViewSchema>;

/** A save only stores what was typed (last write wins); a figure may be cleared with null. */
export const saveCountInputSchema = z
  .object({ departmentId: uuid.optional(), lines: z.array(z.object({ itemId: uuid, countedQty: nonNegativeDecimal.nullable() })).min(1).max(500) })
  .strict();
export type SaveCountInput = z.infer<typeof saveCountInputSchema>;
export const saveCountResultSchema = z.object({ savedAt: isoDateTime, view: countViewSchema });
export type SaveCountResult = z.infer<typeof saveCountResultSchema>;

export const signCountInputSchema = z.object({ departmentId: uuid.optional(), pin: pinSchema, idempotencyKey: idempotencyKeySchema }).strict();
export type SignCountInput = z.infer<typeof signCountInputSchema>;
export const signCountResultSchema = z.object({ view: countViewSchema, signedAt: isoDateTime, onBehalf: z.boolean(), replayed: z.boolean() });
export type SignCountResult = z.infer<typeof signCountResultSchema>;

// --- BD9 GET /mine/history, BD10 GET /mine/days/:id (chapter 5, steps 19 and 20) ----------

export const myHistoryQuerySchema = pageQuerySchema.extend({
  from: nairobiDate.optional(),
  to: nairobiDate.optional(),
  status: z.enum(['CLOSED', 'CORRECTED']).optional(),
});
export type MyHistoryQuery = z.infer<typeof myHistoryQuerySchema>;

export const myHistoryRowSchema = z.object({
  id: uuid,
  reference: z.string(),
  date: nairobiDate,
  status: z.enum(['CLOSED', 'CORRECTED']),
  /** "62 items counted". */
  itemsCounted: z.number().int().nonnegative(),
  /** "I signed at 6:20 pm". */
  signedAt: isoDateTime,
  /** "1 figure corrected". */
  correctedCount: z.number().int().nonnegative(),
});
export type MyHistoryRow = z.infer<typeof myHistoryRowSchema>;
export const myHistorySchema = z.object({ department: departmentRefSchema, head: personSchema.nullable(), rows: z.array(myHistoryRowSchema), page: pageInfoSchema });
export type MyHistory = z.infer<typeof myHistorySchema>;

/** Quantities only: a head never sees money. */
export const myDayLineSchema = z.object({
  itemName: z.string(),
  unit: z.string(),
  openingQty: decimalString,
  receivedQty: decimalString,
  wasteQty: decimalString,
  closingQty: nonNegativeDecimal,
  usedQty: decimalString,
});
export type MyDayLine = z.infer<typeof myDayLineSchema>;
export const myDaySchema = z.object({
  day: dayHeadSchema,
  department: departmentRefSchema,
  signedAt: isoDateTime,
  lines: z.array(myDayLineSchema),
});
export type MyDay = z.infer<typeof myDaySchema>;

// --- BD11 GET /today (Paper B5, B7, B9, B14, B16) -------------------------------------

/** `branchId` is for the hub roles (the picker). A Branch Manager always reads their own branch. Absent: the first branch by name. */
export const todayQuerySchema = z.object({ branchId: uuid.optional() });
export type TodayQuery = z.infer<typeof todayQuerySchema>;

export const todaySchema = z.object({
  branch: branchRefSchema,
  /** The picker's options for a hub role; absent for the Branch Manager. */
  branches: z.array(branchRefSchema).optional(),
  /** Null when nobody has opened today for this branch yet (a hub reader does not create it). */
  day: z
    .object({
      head: dayHeadSchema,
      departments: z.array(departmentTileSchema),
      blockers: z.array(blockerSchema),
      /** "1 thing to do. 1 more to know about." */
      summary: z.object({ todo: z.number().int().nonnegative(), toKnow: z.number().int().nonnegative() }),
      /** Nothing blocks and the day is open; the button is shown to `can.close` roles only. */
      canClose: z.boolean(),
      /** cap catalog.see_costs: the branch's Used today in KES; null while no department has counted. */
      usedValueKes: decimalString.nullable().optional(),
      /** Set once closed (B9): the first five usage entries and the total. */
      closed: z
        .object({ at: isoDateTime, by: personSchema, entryCount: z.number().int().nonnegative(), entries: z.array(ledgerEntrySchema).max(5) })
        .nullable(),
    })
    .nullable(),
  can: z.object({ close: z.boolean(), countOnBehalf: z.boolean() }),
});
export type Today = z.infer<typeof todaySchema>;

// --- BD12 GET /days/:id/departments/:departmentId (Paper B6, B11 Items tab) -------------

export const departmentFiguresSchema = z.object({
  day: dayHeadSchema,
  branch: branchRefSchema,
  rail: z.array(departmentTileSchema),
  /** cap catalog.see_costs: the branch's Used value (the rail's footer). */
  branchUsedValueKes: decimalString.nullable().optional(),
  department: z.object({
    id: uuid,
    name: z.string(),
    state: countStateSchema,
    countedAt: isoDateTime.nullable(),
    countedBy: personSchema.nullable(),
    onBehalf: z.boolean(),
    opening: openingCheckSchema,
    delivery: deliveryFactSchema,
    lines: z.array(figureLineSchema),
    /** "Waste: 1 entry (Eggs, broken)": the entries behind the Waste column, by item. */
    waste: z.object({ entryCount: z.number().int().nonnegative(), items: z.array(z.object({ itemName: z.string(), reasonText: z.string() })) }),
    /** cap catalog.see_costs */
    totals: z.object({ usedValueKes: decimalString.nullable(), closingValueKes: decimalString.nullable() }).optional(),
    /** The Branch Manager may correct this department's lines from here (closed day, window open). */
    can: z.object({ correct: z.boolean() }),
  }),
});
export type DepartmentFigures = z.infer<typeof departmentFiguresSchema>;

// --- BD13 GET /days/:id/close-summary, BD14 POST /days/:id/close (Paper B8, B9) ------------

export const closeSummarySchema = z.object({
  day: dayHeadSchema,
  branch: branchRefSchema,
  /** Money is part of the shape: only `branch_day.close` holders reach this, and they all hold `catalog.see_costs`. */
  usedValueKes: decimalString,
  departments: z.array(z.object({ departmentId: uuid, name: z.string(), itemCount: z.number().int().nonnegative(), usedValueKes: decimalString })),
  /** "Writes 43 usage entries to the stock ledger, one per item": the entries this close will post (items with a non-zero Used today). */
  entryCount: z.number().int().nonnegative(),
  canClose: z.boolean(),
  blockers: z.array(blockerSchema),
});
export type CloseSummary = z.infer<typeof closeSummarySchema>;

export const closeDayInputSchema = z.object({ pin: pinSchema, idempotencyKey: idempotencyKeySchema }).strict();
export type CloseDayInput = z.infer<typeof closeDayInputSchema>;
export const closeDayResultSchema = z.object({
  day: dayHeadSchema,
  closedAt: isoDateTime,
  closedBy: personSchema,
  usedValueKes: decimalString,
  entryCount: z.number().int().nonnegative(),
  /** The first five of the day's usage entries (B9: "Showing 5 of 43"). */
  entries: z.array(ledgerEntrySchema).max(5),
  document: dayDocumentSchema,
  replayed: z.boolean(),
});
export type CloseDayResult = z.infer<typeof closeDayResultSchema>;

// --- BD15 GET /history (Paper B10, B10b, B10c) -----------------------------------------

export const historyQuerySchema = pageQuerySchema.extend({
  /** Hub roles only; a Branch Manager always reads their own branch. Absent: every branch. */
  branchId: uuid.optional(),
  /** Search by day number ("DAY-NYR-0044", "0044"). */
  q: z.string().trim().min(1).optional(),
  from: nairobiDate.optional(),
  to: nairobiDate.optional(),
  status: dayStatusSchema.optional(),
});
export type HistoryQuery = z.infer<typeof historyQuerySchema>;

export const historyRowSchema = z.object({
  id: uuid,
  reference: z.string(),
  date: nairobiDate,
  branch: branchRefSchema,
  /** "5 of 5". */
  departmentsCounted: z.number().int().nonnegative(),
  departmentsTotal: z.number().int().nonnegative(),
  status: dayStatusSchema,
  closedBy: personSchema.nullable(),
  closedAt: isoDateTime.nullable(),
  /** cap catalog.see_costs: null for an open day ("–"). */
  usedValueKes: decimalString.nullable().optional(),
  closingValueKes: decimalString.nullable().optional(),
});
export type HistoryRow = z.infer<typeof historyRowSchema>;
export const historySchema = z.object({
  rows: z.array(historyRowSchema),
  /** The Branch filter's options (hub roles); absent for the Branch Manager. */
  branches: z.array(branchRefSchema).optional(),
  page: pageInfoSchema,
});
export type History = z.infer<typeof historySchema>;

// --- BD16 GET /days/:id (Paper B11), BD17, BD18, BD19 -----------------------------------

export const dayFileSchema = z.object({
  day: dayHeadSchema,
  branch: branchRefSchema,
  /** The tracker (B11): facts only. */
  tracker: z.object({
    openingsChecked: z.object({ checked: z.number().int().nonnegative(), total: z.number().int().nonnegative() }),
    counted: z.object({ counted: z.number().int().nonnegative(), total: z.number().int().nonnegative(), lastAt: isoDateTime.nullable() }),
    closed: z.object({ at: isoDateTime.nullable(), by: personSchema.nullable() }),
  }),
  rail: z.array(departmentTileSchema),
  tabCounts: z.object({ documents: z.number().int().nonnegative(), activity: z.number().int().nonnegative() }),
  /** cap catalog.see_costs: the day's Used value now (after any correction). */
  usedValueKes: decimalString.nullable().optional(),
  /** The newest correction, for the green line on the Activity tab ("Correction posted at 9:14 am: Flour 25kg, closing stock 1 → 2"). */
  lastCorrection: z
    .object({ at: isoDateTime, itemName: z.string(), departmentName: z.string(), fromClosingQty: nonNegativeDecimal, toClosingQty: nonNegativeDecimal })
    .nullable(),
  can: z.object({ correct: z.boolean(), print: z.boolean() }),
});
export type DayFile = z.infer<typeof dayFileSchema>;

export const activityQuerySchema = z.object({ limit: z.coerce.number().int().min(1).max(200).default(5) });
export type ActivityQuery = z.infer<typeof activityQuerySchema>;
export const dayActivityEntrySchema = z.object({
  id: z.string(),
  at: isoDateTime,
  actor: personSchema,
  type: dayActivityTypeSchema,
  /** "Counted and signed: Housekeeping, 6 items". Names appear: a record states who did it. */
  sentence: z.string(),
  /** "Reason: counted wrongly. Note: … Signed with PIN." */
  detail: z.string().nullable(),
  link: z.object({ kind: z.enum(['DAY', 'LEDGER_ENTRY']), id: uuid, reference: z.string().nullable() }).nullable(),
});
export type DayActivityEntry = z.infer<typeof dayActivityEntrySchema>;
export const dayActivitySchema = z.object({ entries: z.array(dayActivityEntrySchema), total: z.number().int().nonnegative() });
export type DayActivity = z.infer<typeof dayActivitySchema>;

export const dayDocumentsSchema = z.object({ documents: z.array(dayDocumentSchema) });
export type DayDocuments = z.infer<typeof dayDocumentsSchema>;

export const entriesQuerySchema = pageQuerySchema;
export type EntriesQuery = z.infer<typeof entriesQuerySchema>;
export const dayEntriesSchema = z.object({ rows: z.array(ledgerEntrySchema), page: pageInfoSchema });
export type DayEntries = z.infer<typeof dayEntriesSchema>;

// --- BD20 POST /days/:id/corrections (Paper B12, B12b) ------------------------------------

export const correctCountInputSchema = z
  .object({
    departmentId: uuid,
    itemId: uuid,
    /** The closing figure the item should have had. */
    closingQty: nonNegativeDecimal,
    reason: correctionReasonSchema,
    note: z.string().trim().min(1).max(CORRECTION_NOTE_MAX).optional(),
    pin: pinSchema,
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();
export type CorrectCountInput = z.infer<typeof correctCountInputSchema>;
export const correctCountResultSchema = z.object({
  day: dayHeadSchema,
  line: figureLineSchema,
  /** The one linked entry posted to the stock ledger (the change only). */
  entry: ledgerEntrySchema,
  document: dayDocumentSchema,
  usedValueKes: decimalString,
  replayed: z.boolean(),
});
export type CorrectCountResult = z.infer<typeof correctCountResultSchema>;

// --- BD21 GET /days/:id/sheet (Paper B13b, B13c, B13d) ---------------------------------------

export const sheetQuerySchema = z.object({ version: z.coerce.number().int().min(1).optional() });
export type SheetQuery = z.infer<typeof sheetQuerySchema>;

/**
 * The rows of one department's figures that fit an A4 page. The cover is page 1; a department starts on the next page and takes
 * max(1, ceil(items / SHEET_ROWS_PER_PAGE)) pages, so `page` and `pageCount` are known when the sheet is made. Paper draws only a six-row
 * department (contract gap 11), so the number is the build's to confirm against the printed layout.
 */
export const SHEET_ROWS_PER_PAGE = 16;

export const sheetLineSchema = z.object({
  position: z.number().int().min(1),
  itemName: z.string(),
  unit: z.string(),
  openingQty: decimalString,
  receivedQty: decimalString,
  wasteQty: decimalString,
  closingQty: nonNegativeDecimal,
  usedQty: decimalString,
  usedValueKes: decimalString,
  closingValueKes: decimalString,
  /** The Wednesday figure struck through when this line was corrected. */
  correction: lineCorrectionSchema.nullable(),
});
export type SheetLine = z.infer<typeof sheetLineSchema>;

export const sheetDepartmentSchema = z.object({
  position: z.number().int().min(1),
  department: departmentRefSchema,
  head: personSchema.nullable(),
  itemCount: z.number().int().nonnegative(),
  usedValueKes: decimalString,
  closingValueKes: decimalString,
  /** The A4 page the department starts on (the cover is page 1). */
  page: z.number().int().min(2),
  corrected: z.boolean(),
  countedAt: isoDateTime,
  countedBy: personSchema,
  onBehalf: z.boolean(),
  opening: z.object({ state: openingStateSchema, checkedAt: isoDateTime.nullable(), differenceCount: z.number().int().nonnegative() }),
  delivery: z.object({ state: deliveryStateSchema, dispatches: z.array(z.string()) }),
  lines: z.array(sheetLineSchema),
});
export type SheetDepartment = z.infer<typeof sheetDepartmentSchema>;

export const daySheetSchema = z.object({
  reference: z.string(),
  date: nairobiDate,
  branch: z.object({ id: uuid, name: z.string(), code: z.string().nullable(), address: z.string().nullable(), phone: z.string().nullable() }),
  version: z.number().int().min(1),
  kind: sheetKindSchema,
  closedAt: isoDateTime,
  closedBy: personSchema,
  /** When the latest correction in this version was posted; null at the close. */
  correctedAt: isoDateTime.nullable(),
  /** When this copy was printed (the moment of the request: printing is not an event). */
  printedAt: isoDateTime,
  totals: z.object({ itemCount: z.number().int().nonnegative(), usedValueKes: decimalString, closingValueKes: decimalString }),
  pageCount: z.number().int().min(2),
  departments: z.array(sheetDepartmentSchema),
  /** The corrections included in this version, newest last. */
  corrections: z.array(
    z.object({ at: isoDateTime, by: personSchema, departmentName: z.string(), itemName: z.string(), fromClosingQty: nonNegativeDecimal, toClosingQty: nonNegativeDecimal, reason: correctionReasonSchema }),
  ),
  /** The notes block on the cover: departments that ran on last night's figure, and open discrepancies that did not hold the close. */
  notes: z.object({
    openingNotChecked: z.array(z.string()),
    openDiscrepancies: z.array(z.object({ reference: z.string(), departmentName: z.string(), itemName: z.string() })),
  }),
  /** The QR on the last page opens the day file. */
  qrUrl: z.string(),
});
export type DaySheet = z.infer<typeof daySheetSchema>;

// --- Errors ---------------------------------------------------------------------------------------

export const BRANCH_DAY_ERROR_CODES = [
  'INVALID_PIN', // 401: wrong PIN or none set (nothing is said about which); same code as the rest of Inventory
  'NOT_YOUR_DEPARTMENT', // 403: not an active head or member of that department of this branch (a head naming another department)
  'NOT_YOUR_BRANCH', // 403: a Branch Manager reading or writing another branch
  'DAY_ALREADY_CLOSED', // 409: a count, an opening or a close on a day that is closed
  'DAY_NOT_READY', // 409: BD14, something blocks the close; `details.blockers` lists them
  'DAY_NOT_CLOSED', // 409: BD20 or BD21 on a day still open
  'ALREADY_COUNTED', // 409: BD7 or BD8 on a department that already signed its count
  'COUNT_INCOMPLETE', // 422: BD5 or BD8 with a line left blank; `details.itemIds`
  'OPENING_ALREADY_CHECKED', // 409: BD3 or BD5 on an opening that was already accepted or recounted
  'ITEM_NOT_IN_DAY', // 422: a line for an item that is not on the department's day
  'DEPARTMENT_NOT_COUNTED', // 409: BD20 on a department that never counted
  'CORRECTION_WINDOW_PASSED', // 409: BD20 after the department's next opening was accepted
  'CORRECTION_NO_CHANGE', // 422: BD20 with the figure it already has
  'NO_DEPARTMENTS', // 409: the branch has no active department, so there is no day to count
] as const;
export type BranchDayErrorCode = (typeof BRANCH_DAY_ERROR_CODES)[number];

/** Keys a department head or member must never receive from any endpoint (money). A test pins the fixtures against it. */
export const DAY_MONEY_KEYS = ['usedValueKes', 'closingValueKes', 'unitCostKes', 'branchUsedValueKes', 'totals'] as const;
/** Keys the head's blind evening count (BD6, BD7, BD8) must not carry: nothing to count against. */
export const DAY_COUNT_BLIND_KEYS = ['openingQty', 'receivedQty', 'wasteQty', 'usedQty', 'yesterdayUsedQty', 'lastNightQty', 'expectedQty', 'acceptedQty'] as const;
