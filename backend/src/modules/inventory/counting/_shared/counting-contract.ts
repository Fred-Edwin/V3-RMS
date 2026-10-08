/**
 * Inventory: Counting rebuild
 * FROZEN API CONTRACT: request and response schemas for the 30 counting endpoints (C1 to C30).
 *
 * Source of truth: docs/features/inventory/stock-count-waste-contract.md (the endpoint table, the state machine, the
 * role matrix) and the Paper page "Inventory · Counting redesign (Oct 7)". The front end mirrors this file by hand in
 * `frontend/features/inventory/counting/_shared/types/counting-contract.ts`; `counting-contract.test.ts` parses the same
 * sample payloads (`counting-contract.fixtures.json`) on both sides.
 *
 * Wire rules are in `../../_shared/wire.ts`. A field marked "cap X" is present only when the caller holds X and is
 * otherwise ABSENT. The Store Attendant holds neither `restock.read` nor `counts.read`, so every key listed in
 * `COUNT_STOCK_FIGURE_KEYS` is absent from every response they can reach (the blind rule, `_shared/blind-rule.ts`).
 *
 * Do not change a shape here without changing the contract document, the mirror and the fixtures in the same commit,
 * and only with the owner's approval (an "amendment": FEATURE_REDO_PLAYBOOK.md step 5).
 */
import { z } from 'zod';
import {
  decimalString,
  isoDateTime,
  kpiCellSchema,
  nairobiDate,
  nonNegativeDecimal,
  pageInfoSchema,
  pageQuerySchema,
  personSchema,
  uuid,
} from '../../_shared/wire';

// --- Enums ------------------------------------------------------------------

/** OPEN = being counted. SUBMITTED = signed by the counter, waiting for the Manager. APPROVED = final (the Manager's own count is APPROVED the moment she signs). */
export const COUNT_STATUSES = ['OPEN', 'SUBMITTED', 'APPROVED'] as const;
export const countStatusSchema = z.enum(COUNT_STATUSES);
export type CountStatus = z.infer<typeof countStatusSchema>;

/** What one line says once the number is in: MATCHES (zero difference), WITHIN_RANGE, EXCEEDS, NOT_COUNTED (skipped), NOT_YET (still being counted). */
export const LINE_RESULTS = ['MATCHES', 'WITHIN_RANGE', 'EXCEEDS', 'NOT_COUNTED', 'NOT_YET'] as const;
export const lineResultSchema = z.enum(LINE_RESULTS);
export type LineResult = z.infer<typeof lineResultSchema>;

/** The cause chips (Paper step 10). Never a dropdown. OTHER needs a note. */
export const COUNT_CAUSES = ['PREP_NOT_LOGGED', 'SPOILAGE', 'MISCOUNT', 'LOSS', 'OTHER'] as const;
export const countCauseSchema = z.enum(COUNT_CAUSES);
export type CountCause = z.infer<typeof countCauseSchema>;
export const CAUSE_TEXT: Record<CountCause, string> = {
  PREP_NOT_LOGGED: 'Prep use not logged',
  SPOILAGE: 'Spoilage or spill',
  MISCOUNT: 'Miscount',
  LOSS: 'Loss or theft',
  OTHER: 'Other',
};

/** "Log a missing movement instead": which kind of movement explains the gap. Writes nothing to stock (owner, 8 Oct 2026). */
export const MOVEMENT_KINDS = ['DISPATCH', 'PREP_USE', 'DELIVERY', 'WASTE'] as const;
export const movementKindSchema = z.enum(MOVEMENT_KINDS);
export type MovementKind = z.infer<typeof movementKindSchema>;

/** PENDING = no decision yet. ACCEPTED = a within-range line accepted (alone or in the group). */
export const LINE_DECISION_KINDS = ['PENDING', 'ACCEPTED', 'WRITE_OFF', 'MOVEMENT_LOGGED', 'RECOUNT_ASKED'] as const;
export const lineDecisionKindSchema = z.enum(LINE_DECISION_KINDS);
export type LineDecisionKind = z.infer<typeof lineDecisionKindSchema>;

/** The one allowed recheck at the end of a section: NONE (never offered or not needed), RECOUNTED (typed a new number), KEPT ("Continue as counted"). */
export const RECHECK_STATES = ['NONE', 'RECOUNTED', 'KEPT'] as const;
export const recheckStateSchema = z.enum(RECHECK_STATES);

export const SECTION_KINDS = ['SUPPLIER', 'MANUAL'] as const;
export const sectionKindSchema = z.enum(SECTION_KINDS);

/**
 * Keys that carry stock figures or the Manager's judgement. Absent for a caller without `restock.read` (the Store
 * Attendant). `_shared/blind-rule.ts` gains this list; the count view builder applies it in one place.
 */
export const COUNT_STOCK_FIGURE_KEYS = [
  'expectedQty',
  'difference',
  'differencePercent',
  'differenceValueKes',
  'result',
  'story',
  'suggestedCause',
  'shortStreak',
  'decision',
  'director',
  'adjustmentRef',
  'figures',
  'range',
  'expectedAsOf',
  'timeline',
  'differencesText',
] as const;

const decisionSchema = z.object({
  kind: lineDecisionKindSchema,
  cause: countCauseSchema.nullable(),
  causeNote: z.string().nullable(),
  movementKind: movementKindSchema.nullable(),
  /** "Prep use not logged", "Movement logged · Dispatch", "Within range · accepted", "Recount asked". */
  text: z.string(),
  by: personSchema.nullable(),
  at: isoDateTime.nullable(),
});
export type LineDecision = z.infer<typeof decisionSchema>;

// --- Lines and counts --------------------------------------------------------

export const countLineSchema = z.object({
  id: uuid,
  itemId: uuid,
  itemName: z.string(),
  unit: z.string(),
  sectionId: uuid.nullable(),
  sectionName: z.string().nullable(),
  /** Shelf position inside the count (the order the lines are counted in). */
  position: z.number().int().nonnegative(),
  /** null = no number (skipped or not yet reached). 0 is a real count of zero. */
  countedQty: nonNegativeDecimal.nullable(),
  skipped: z.boolean(),
  recheck: recheckStateSchema,
  /** The number typed before a recheck replaced it; null unless recheck = RECOUNTED. */
  firstCountedQty: nonNegativeDecimal.nullable(),
  /** When this item was last counted before this count: a date, never a stock figure. */
  lastCountedAt: isoDateTime.nullable(),
  /** "Yesterday", "6 days ago", "Never counted". */
  lastCountedText: z.string(),
  /** cap catalog.see_costs */
  unitCost: decimalString.optional(),
  /** cap restock.read. While the count is OPEN this is the live ledger figure and only the counter sees it; after the counter signs it is the frozen figure. */
  expectedQty: decimalString.optional(),
  /** cap restock.read. counted − expected, signed. Absent while nothing is counted. */
  difference: decimalString.optional(),
  /** cap restock.read. Signed percent of expected, one decimal: "-8.9". */
  differencePercent: decimalString.optional(),
  /** cap restock.read. difference × unit cost, signed KES. */
  differenceValueKes: decimalString.optional(),
  /** cap restock.read */
  result: lineResultSchema.optional(),
  /** cap restock.read. "What the records show": prep use, dispatch, last count, delivery. null when there is nothing to say. */
  story: z.string().nullable().optional(),
  /** cap restock.read. The cause chip marked SUGGESTED (Paper step 10). */
  suggestedCause: countCauseSchema.nullable().optional(),
  /** cap restock.read. Consecutive counts this item was short, including this one (3 = flagged). */
  shortStreak: z.number().int().nonnegative().optional(),
  /** cap restock.read */
  decision: decisionSchema.optional(),
  /** cap restock.read. Set once the count is signed and the line is outside the range. */
  director: z
    .object({
      flagged: z.boolean(),
      /** The line's value reached the Director alert amount. */
      alert: z.boolean(),
      seenAt: isoDateTime.nullable(),
      seenBy: personSchema.nullable(),
    })
    .optional(),
  /** cap restock.read. "ADJ-3402" once the line has posted an adjustment. */
  adjustmentRef: z.string().nullable().optional(),
  can: z.object({
    /** counts.resolve and the count is SUBMITTED. */
    decide: z.boolean(),
    /** "Count again": counts.record and the count is SUBMITTED or APPROVED and the line is outside the range. */
    countAgain: z.boolean(),
  }),
});
export type CountLine = z.infer<typeof countLineSchema>;

export const countSectionRefSchema = z.object({ id: uuid, name: z.string() });

export const countProgressSchema = z.object({
  total: z.number().int().nonnegative(),
  /** Lines with a number, zeros included. */
  counted: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  /** Lines counted as exactly zero. */
  zero: z.number().int().nonnegative(),
  rechecked: z.number().int().nonnegative(),
  /** "12 of 37 counted · 1 skipped". */
  text: z.string(),
});

export const countTrackerSchema = z.object({
  steps: z.array(
    z.object({
      key: z.enum(['COUNTED', 'SUBMITTED', 'CHECKED', 'APPROVED']),
      state: z.enum(['DONE', 'CURRENT', 'TODO']),
      at: isoDateTime.nullable(),
    }),
  ),
});

export const countDetailSchema = z.object({
  id: uuid,
  /** "CNT-2026-1013" */
  reference: z.string(),
  status: countStatusSchema,
  /** Words for the viewer: "In progress", "Waiting for you" (SM, SA on a SUBMITTED count), "Submitted", "Approved", "Signed" (the Manager's own). */
  statusText: z.string(),
  sections: z.array(countSectionRefSchema),
  scope: z.enum(['SECTIONS', 'ITEMS']),
  counter: personSchema,
  startedAt: isoDateTime,
  /** When the counter signed. */
  signedAt: isoDateTime.nullable(),
  approvedAt: isoDateTime.nullable(),
  approver: personSchema.nullable(),
  /** The Manager counted and signed her own count: no approval step. */
  selfSigned: z.boolean(),
  recountOf: z.object({ countId: uuid, reference: z.string(), lineId: uuid, itemName: z.string() }).nullable(),
  progress: countProgressSchema,
  /** "Saved 07:19" */
  savedAt: isoDateTime.nullable(),
  tracker: countTrackerSchema,
  /** cap restock.read */
  figures: z
    .object({
      counted: z.number().int().nonnegative(),
      withinRange: z.number().int().nonnegative(),
      exceeds: z.number().int().nonnegative(),
      notCounted: z.number().int().nonnegative(),
      /** Outside-range lines still without a decision. */
      toDecide: z.number().int().nonnegative(),
      decided: z.number().int().nonnegative(),
      netDifferenceKes: decimalString,
      /** Net of the within-range group ("net −KES 193"). */
      withinRangeNetKes: decimalString,
    })
    .optional(),
  /** cap restock.read. The range this count is judged against: live while OPEN, frozen at the counter's sign. */
  range: z.object({ kes: z.number().int().nonnegative(), percent: decimalString }).optional(),
  /** cap restock.read. The moment the expected figures were frozen (the counter's sign). */
  expectedAsOf: isoDateTime.nullable().optional(),
  /** cap restock.read. "What happened" (Paper step 15). */
  timeline: z.array(z.object({ label: z.string(), at: isoDateTime, detail: z.string().nullable() })).optional(),
  lines: z.array(countLineSchema),
  can: z.object({
    /** The caller is the counter and the count is OPEN: they may type numbers. */
    count: z.boolean(),
    sign: z.boolean(),
    /** counts.resolve and SUBMITTED. */
    decide: z.boolean(),
    /** counts.resolve, SUBMITTED, every outside-range line decided. */
    approve: z.boolean(),
    print: z.boolean(),
  }),
});
export type CountDetail = z.infer<typeof countDetailSchema>;

// --- C1 summary, C2 list, C3 flagged, C4 repeat shortfalls -------------------

/** C1 GET /counts/summary. The server picks the Manager's strip or the Director's by capability; `audience` lets the System Admin ask for either. cap counts.read */
export const countsSummaryQuerySchema = z.object({ audience: z.enum(['manager', 'director']).optional() });
export const countsSummarySchema = z.object({ audience: z.enum(['manager', 'director']), kpis: z.array(kpiCellSchema) });
export type CountsSummary = z.infer<typeof countsSummarySchema>;

/** C2 GET /counts. cap counts.read */
export const countsListQuerySchema = pageQuerySchema.extend({
  status: z.enum(['all', 'waiting', 'inProgress', 'approved']).default('all'),
  /** Matches reference, section name or counter name. */
  search: z.string().trim().min(1).optional(),
  /** Lane 0 amendment (8 Oct 2026): only counts started on these Nairobi days, both ends included. Either may be given alone. Counts waiting for approval (`SUBMITTED`) always appear, whatever the range (owner decision, 8 Oct 2026); the rows, the total and the chip numbers all follow that one rule. */
  from: nairobiDate.optional(),
  to: nairobiDate.optional(),
});
export const countRowSchema = z.object({
  id: uuid,
  reference: z.string(),
  status: countStatusSchema,
  statusText: z.string(),
  /** "Samrat", "Others, Packaging", "Eggs". */
  sectionsText: z.string(),
  counter: personSchema,
  startedAt: isoDateTime,
  signedAt: isoDateTime.nullable(),
  /** "Today 07:42", "Started 09:10", "Mon 12 Oct 16:10". */
  signedText: z.string(),
  itemsCounted: z.number().int().nonnegative(),
  itemsTotal: z.number().int().nonnegative(),
  /** "36" when finished, "14 of 28" while counting. */
  itemsText: z.string(),
  /** "4 exceed · 32 within", "All within range", "Not signed yet". */
  differencesText: z.string().optional(),
  recountOf: z.object({ id: uuid, reference: z.string() }).nullable(),
  /** The caller is the counter. */
  mine: z.boolean(),
  can: z.object({ review: z.boolean() }),
});
export type CountRow = z.infer<typeof countRowSchema>;
export const countsListSchema = z.object({
  rows: z.array(countRowSchema),
  chips: z.object({
    all: z.number().int().nonnegative(),
    waiting: z.number().int().nonnegative(),
    inProgress: z.number().int().nonnegative(),
    approved: z.number().int().nonnegative(),
    /** "Unsectioned 3 →" */
    unsectioned: z.number().int().nonnegative(),
  }),
  page: pageInfoSchema,
});
export type CountsList = z.infer<typeof countsListSchema>;

/** C3 GET /counts/flagged: the lines flagged to the Director (Paper step 26). cap counts.read */
export const flaggedLineSchema = z.object({
  countId: uuid,
  countReference: z.string(),
  lineId: uuid,
  itemName: z.string(),
  unit: z.string(),
  difference: decimalString,
  differenceValueKes: decimalString,
  cause: countCauseSchema.nullable(),
  causeText: z.string(),
  countedBy: personSchema,
  /** The line's value reached the Director alert amount. */
  alert: z.boolean(),
  seenAt: isoDateTime.nullable(),
  seenBy: personSchema.nullable(),
  can: z.object({ markSeen: z.boolean() }),
});
export const flaggedListSchema = z.object({
  rows: z.array(flaggedLineSchema),
  chips: z.object({
    /** Lines not yet seen: the number on "Flagged to me 3". */
    flaggedToMe: z.number().int().nonnegative(),
    allCounts: z.number().int().nonnegative(),
    repeatShortfalls: z.number().int().nonnegative(),
  }),
  page: pageInfoSchema,
});
export type FlaggedList = z.infer<typeof flaggedListSchema>;

/** C4 GET /counts/repeat-shortfalls: items short on three counts running. cap counts.read */
export const repeatShortfallListSchema = z.object({
  rows: z.array(
    z.object({
      itemId: uuid,
      itemName: z.string(),
      unit: z.string(),
      sectionName: z.string().nullable(),
      shortRuns: z.number().int().min(3),
      lastCounts: z.array(z.object({ countReference: z.string(), difference: decimalString, at: isoDateTime })),
    }),
  ),
  chips: flaggedListSchema.shape.chips,
  page: pageInfoSchema,
});
export type RepeatShortfallList = z.infer<typeof repeatShortfallListSchema>;

// --- C5 detail, C6 record print, C7 blank sheet ------------------------------

/** C5 GET /counts/:id: cap counts.read, or counts.record on the caller's own count. */
export const countDetailParamsSchema = z.object({ id: uuid });

/** C6 GET /counts/:id/print (Paper step 44). cap counts.read */
export const countRecordPrintSchema = z.object({
  reference: z.string(),
  /** "Generated 13 Oct 2026, 09:18" */
  generatedText: z.string(),
  sectionsText: z.string(),
  counterName: z.string(),
  /** "07:02 to 07:41" */
  timeText: z.string(),
  counted: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  differences: z.number().int().nonnegative(),
  netValueKes: decimalString,
  rows: z.array(
    z.object({
      itemName: z.string(),
      unit: z.string(),
      expected: decimalString,
      counted: decimalString,
      difference: decimalString,
      valueKes: decimalString,
      /** "Written off · Spoilage", "Movement logged · Dispatch", "Within range · accepted". */
      decisionText: z.string(),
    }),
  ),
  /** "The other 54 counted items matched. 6 items were skipped and keep their last count. This copy is for the Manager and shows expected stock." */
  footnote: z.string(),
  signatures: z.array(
    z.object({
      role: z.enum(['COUNTED_BY', 'APPROVED_BY']),
      name: z.string(),
      roleLabel: z.string(),
      /** "13 Oct 07:41" */
      signedAtText: z.string(),
    }),
  ),
});
export type CountRecordPrint = z.infer<typeof countRecordPrintSchema>;

/** C7 GET /counts/blank-sheet (Paper step 43). cap counts.read or counts.record. No stock figures. */
export const blankSheetSchema = z.object({
  printedAtText: z.string(),
  dateText: z.string(),
  sections: z.array(
    z.object({
      id: uuid,
      name: z.string(),
      /** "Section 1 of 4 · Samrat Supermarket Ltd · 37 items" */
      detail: z.string(),
      items: z.array(z.object({ name: z.string(), unit: z.string() })),
    }),
  ),
});
export type BlankSheet = z.infer<typeof blankSheetSchema>;

// --- C8 start options, C9 start, C10 save, C11 check, C12 preview, C13 sign, C14 order

/** C8 GET /counts/start-options. cap counts.record. `recountLineId` adds the recount banner (Paper step 49). */
export const startOptionsQuerySchema = z.object({ recountLineId: uuid.optional() });
export const startSectionSchema = z.object({
  id: uuid,
  name: z.string(),
  supplierName: z.string().nullable(),
  itemCount: z.number().int().nonnegative(),
  lastCountedAt: isoDateTime.nullable(),
  /** "Yesterday", "6 days ago", "Never". */
  lastCountedText: z.string(),
  lastCountedBy: z.string().nullable(),
  /** The "LONGEST SINCE A COUNT" tag on step 12. */
  longestSinceCount: z.boolean(),
  /** Already in someone else's open count: it cannot be started now. */
  busy: z.object({ countId: uuid, reference: z.string(), counterName: z.string() }).nullable(),
});
export const startOptionsSchema = z.object({
  /** In the order to show: the caller's order for today when they set one, else the Manager's shelf order. */
  sections: z.array(startSectionSchema),
  order: z.object({ mode: z.enum(['SHELF', 'TODAY']), appliesTo: nairobiDate }),
  /** Items in no section ("Unsectioned 3"). */
  unsectionedCount: z.number().int().nonnegative(),
  /** The caller's own open count, so the screen can resume it. */
  openCount: z.object({ id: uuid, reference: z.string(), sectionsText: z.string(), progressText: z.string() }).nullable(),
  recount: z
    .object({ lineId: uuid, countId: uuid, countReference: z.string(), itemId: uuid, itemName: z.string(), unit: z.string(), sectionName: z.string().nullable() })
    .nullable(),
  can: z.object({ start: z.boolean() }),
});
export type StartOptions = z.infer<typeof startOptionsSchema>;

/** C9 POST /counts. Scope is whole sections, or items (a recount). cap counts.record. */
export const startCountInputSchema = z
  .object({
    sectionIds: z.array(uuid).min(1).max(20).optional(),
    itemIds: z.array(uuid).min(1).max(100).optional(),
    /** The line of a signed or submitted count being counted again: the new count links back to it. */
    recountOfLineId: uuid.optional(),
    /** A uuid the form makes when it opens; a second tap returns the same count (HTTP 200). */
    idempotencyKey: z.string().min(8).max(64),
  })
  .strict()
  .refine((v) => Boolean(v.sectionIds?.length || v.itemIds?.length || v.recountOfLineId), 'Pick at least one section or item');
export type StartCountInput = z.infer<typeof startCountInputSchema>;

/** C10 PUT /counts/:id/lines: autosave, last write wins. Only the counter, only while OPEN. cap counts.record. */
export const saveLinesInputSchema = z
  .object({
    lines: z
      .array(
        z
          .object({
            lineId: uuid,
            /** null clears the number. */
            countedQty: nonNegativeDecimal.nullable(),
            /** The Skip key: a deliberate "not counted today". Ignored when a number is sent. */
            skipped: z.boolean().default(false),
            /** Set when this save is the section-end recheck: RECOUNTED when a number was typed, KEPT for "Continue as counted". */
            recheck: z.enum(['RECOUNTED', 'KEPT']).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(200),
  })
  .strict();
export type SaveLinesInput = z.infer<typeof saveLinesInputSchema>;
export const saveLinesResultSchema = z.object({
  savedAt: isoDateTime,
  progress: countProgressSchema,
  /** cap restock.read, and only for the counter: the live result of each line saved (Paper step 13). */
  lines: z
    .array(
      z.object({
        lineId: uuid,
        result: lineResultSchema.optional(),
        difference: decimalString.optional(),
        differenceValueKes: decimalString.optional(),
      }),
    )
    .optional(),
});
export type SaveLinesResult = z.infer<typeof saveLinesResultSchema>;

/** C11 POST /counts/:id/check: the section-end check (Paper step 3). cap counts.record. Names and the typed number only, never a figure or a direction. */
export const checkInputSchema = z.object({ sectionId: uuid.optional() }).strict();
export const checkResultSchema = z.object({
  items: z.array(z.object({ lineId: uuid, itemName: z.string(), unit: z.string(), sectionName: z.string().nullable(), counted: nonNegativeDecimal })),
  /** "Samrat done. Check 2 items again?" or "Nothing to check again. Carry on." */
  text: z.string(),
});
export type CheckResult = z.infer<typeof checkResultSchema>;

/** C12 GET /counts/:id/sign-preview: what the sign dialog shows (Paper steps 6 and 14). cap counts.record, own count. */
export const signPreviewSchema = z.object({
  itemCount: z.number().int().nonnegative(),
  zero: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  /** cap restock.read (the Manager's own count, Paper step 14). */
  figures: z
    .object({
      appliedLines: z.number().int().nonnegative(),
      appliedNetKes: decimalString,
      outside: z.array(
        z.object({
          lineId: uuid,
          itemName: z.string(),
          unit: z.string(),
          difference: decimalString,
          differenceValueKes: decimalString,
          cause: countCauseSchema.nullable(),
        }),
      ),
      netKes: decimalString,
      /** Outside-range lines that still need a cause before "Sign and apply". */
      causesNeeded: z.array(uuid),
      directorNote: z.string(),
    })
    .optional(),
});
export type SignPreview = z.infer<typeof signPreviewSchema>;

/** C13 POST /counts/:id/sign. The counter's own PIN. Attendant: OPEN to SUBMITTED. Manager: OPEN to APPROVED and the adjustments post. */
export const signInputSchema = z
  .object({
    pin: z.string().regex(/^\d{4,8}$/, 'PIN is 4 to 8 digits'),
    /** The Manager's own count: a cause for every outside-range line (default N1: chips inline in the dialog). Ignored for an Attendant. */
    causes: z
      .array(z.object({ lineId: uuid, cause: countCauseSchema, note: z.string().trim().max(300).optional() }).strict())
      .max(200)
      .optional(),
    idempotencyKey: z.string().min(8).max(64),
  })
  .strict();
export type SignInput = z.infer<typeof signInputSchema>;

/** C14 PUT /counts/section-order/today: this person's order for today only. cap counts.record. */
export const sectionOrderInputSchema = z.object({ sectionIds: z.array(uuid).min(1).max(30) }).strict();
export const sectionOrderResultSchema = z.object({ sectionIds: z.array(uuid), appliesTo: nairobiDate });

// --- Count setup (C15 to C22) ------------------------------------------------

export const setupSectionSchema = z.object({
  id: uuid,
  name: z.string(),
  kind: sectionKindSchema,
  supplierName: z.string().nullable(),
  itemCount: z.number().int().nonnegative(),
  position: z.number().int().nonnegative(),
  /** "manual section" on the Manager's list. */
  tagText: z.string().nullable(),
});

export const moveViewSchema = z.object({
  id: uuid,
  itemId: uuid,
  itemName: z.string(),
  fromSectionId: uuid.nullable(),
  fromSectionName: z.string().nullable(),
  toSectionId: uuid,
  toSectionName: z.string(),
  by: personSchema,
  at: isoDateTime,
  undone: z.boolean(),
  /** "Moved here from Summer by Linnet · 13 Oct 07:12" */
  text: z.string(),
  can: z.object({ undo: z.boolean() }),
});
export type MoveView = z.infer<typeof moveViewSchema>;

/** C15 GET /count-setup. cap counts.read. */
export const setupViewSchema = z.object({
  /** An opaque stamp of the last change; C18 must send it back (409 LAYOUT_CHANGED when stale). */
  version: z.string(),
  sections: z.array(setupSectionSchema),
  /** "Not in any section · 3 new items · never counted until placed". */
  unsectioned: z.object({ count: z.number().int().nonnegative(), text: z.string() }),
  /** Moves by other people since this person's last visit: "1 item moved by the Attendant since your last visit." */
  movedSinceLastVisit: z.array(moveViewSchema),
  movedText: z.string().nullable(),
  can: z.object({ edit: z.boolean() }),
});
export type SetupView = z.infer<typeof setupViewSchema>;

/** C16 GET /count-setup/sections/:id/items (`unsectioned` is a valid id). The whole section on one list, no pager (UI_BUILD_RULES §4a.5). cap counts.read */
export const sectionIdParamSchema = z.object({ id: z.union([uuid, z.literal('unsectioned')]) });
export const sectionItemsSchema = z.object({
  section: z.object({ id: z.union([uuid, z.literal('unsectioned')]), name: z.string(), itemCount: z.number().int().nonnegative() }),
  items: z.array(
    z.object({
      itemId: uuid,
      name: z.string(),
      unit: z.string(),
      lastCountedAt: isoDateTime.nullable(),
      /** "Today", "6 days ago". */
      lastCountedText: z.string(),
      /** Drawn amber ("6 days ago"). */
      stale: z.boolean(),
      movedHere: moveViewSchema.nullable(),
    }),
  ),
});
export type SectionItems = z.infer<typeof sectionItemsSchema>;

/** C17 POST /count-setup/sections. cap counts.setup. */
export const addSectionInputSchema = z.object({ name: z.string().trim().min(1).max(40) }).strict();

/** C18 PUT /count-setup/layout: "Save order". Sections in array order; each lists its items in order. cap counts.setup. */
export const layoutInputSchema = z
  .object({
    version: z.string(),
    sections: z.array(z.object({ id: z.union([uuid, z.literal('unsectioned')]), itemIds: z.array(uuid) }).strict()).min(1).max(30),
  })
  .strict();
export type LayoutInput = z.infer<typeof layoutInputSchema>;

/** C19 GET /count-setup/add-items (Paper steps 24B, 24C, 50, 51). Search as you type; filters; numbered pager. cap counts.setup. */
export const addItemsQuerySchema = pageQuerySchema.extend({
  sectionId: uuid,
  q: z.string().trim().min(1).optional(),
  tab: z.enum(['unsectioned', 'other']).default('unsectioned'),
  categoryId: uuid.optional(),
  type: z.string().optional(),
  departmentTag: z.string().optional(),
});
export const addItemsListSchema = z.object({
  rows: z.array(
    z.object({
      itemId: uuid,
      name: z.string(),
      categoryName: z.string().nullable(),
      /** "Stocked" */
      typeText: z.string(),
      unit: z.string(),
      placement: z.discriminatedUnion('kind', [
        z.object({ kind: z.literal('UNSECTIONED'), /** "New, no supplier" */ note: z.string().nullable() }),
        z.object({ kind: z.literal('IN_SECTION'), sectionId: uuid, sectionName: z.string() }),
      ]),
    }),
  ),
  chips: z.object({ unsectioned: z.number().int().nonnegative(), otherSections: z.number().int().nonnegative() }),
  /** `3 matches for "oat" · all sections` (null when there is no search). */
  matchText: z.string().nullable(),
  page: pageInfoSchema,
});
export type AddItemsList = z.infer<typeof addItemsListSchema>;

/** C20 POST /count-setup/sections/:id/items: add (or move here) items. cap counts.setup. */
export const addItemsInputSchema = z.object({ itemIds: z.array(uuid).min(1).max(100) }).strict();

/** C21 POST /count-setup/items/:itemId/move: applies at once and is logged. cap counts.record (Attendant and Store Manager). */
export const moveItemInputSchema = z.object({ toSectionId: uuid }).strict();

/** C22 POST /count-setup/moves/:id/undo. cap counts.setup. Returns the setup view. */

// --- Count settings (C23 to C26) ---------------------------------------------

/** C23 GET /count-settings. cap counts.read. */
export const countSettingsSchema = z.object({
  /** "Worth up to" KES. A difference is within range when BOTH this and the percent hold. */
  rangeKes: z.number().int().nonnegative(),
  /** "And at most" percent of expected, one decimal. */
  rangePercent: decimalString,
  /** Flag an item short in 3 counts in a row, even inside the range. */
  flagRepeatShortfalls: z.boolean(),
  /** KES per line. Set by the Director. */
  directorAlertKes: z.number().int().nonnegative(),
  rangeUpdatedBy: personSchema.nullable(),
  rangeUpdatedAt: isoDateTime.nullable(),
  alertUpdatedBy: personSchema.nullable(),
  alertUpdatedAt: isoDateTime.nullable(),
  can: z.object({ editRange: z.boolean(), editDirectorAlert: z.boolean() }),
});
export type CountSettings = z.infer<typeof countSettingsSchema>;

/** C24 GET /count-settings/preview: "How this plays out, last 7 days". cap counts.read. */
export const settingsPreviewQuerySchema = z.object({
  rangeKes: z.coerce.number().int().min(0).max(1_000_000).optional(),
  rangePercent: decimalString.optional(),
  directorAlertKes: z.coerce.number().int().min(0).max(10_000_000).optional(),
});
export const settingsPreviewSchema = z.object({
  range: z.object({
    withinRange: z.number().int().nonnegative(),
    outsideRange: z.number().int().nonnegative(),
    /** "Raising the percentage to 8 would move 6 lines into range. Nothing changes for counts already signed." */
    hint: z.string().nullable(),
  }),
  alert: z.object({
    countsOver: z.number().int().nonnegative(),
    /** "3 counts went over KES 5,000. At KES 8,000 it would have been 1." */
    hint: z.string().nullable(),
  }),
});
export type SettingsPreview = z.infer<typeof settingsPreviewSchema>;

/** C25 PUT /count-settings. cap counts.setup. Applies from the next signed count; signed counts keep what they were judged against. */
export const updateSettingsInputSchema = z
  .object({
    rangeKes: z.number().int().min(0).max(1_000_000),
    rangePercent: decimalString.refine((v) => Number(v) >= 0 && Number(v) <= 100, 'percent is 0 to 100'),
    flagRepeatShortfalls: z.boolean(),
  })
  .strict();

/** C26 PUT /count-settings/director-alert. cap counts.set_director_alert. */
export const updateDirectorAlertInputSchema = z.object({ alertKes: z.number().int().min(0).max(10_000_000) }).strict();

// --- Review (C27 to C30) -----------------------------------------------------

const noteSchema = z.string().trim().max(300);

/** C27 POST /counts/:id/decisions: decide one line, several lines (one cause for all), or "Accept all within range". cap counts.resolve, count SUBMITTED. */
export const decisionInputSchema = z
  .object({
    /** Omit when `group` is sent. */
    lineIds: z.array(uuid).min(1).max(200).optional(),
    /** "Accept all 32": every within-range line still undecided. */
    group: z.literal('WITHIN_RANGE').optional(),
    decision: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('WRITE_OFF'), cause: countCauseSchema, note: noteSchema.optional() }).strict(),
      z.object({ kind: z.literal('MOVEMENT_LOGGED'), movementKind: movementKindSchema }).strict(),
      z.object({ kind: z.literal('RECOUNT_ASKED') }).strict(),
      z.object({ kind: z.literal('ACCEPTED') }).strict(),
      /** Take the decision back ("Change"). */
      z.object({ kind: z.literal('CLEAR') }).strict(),
    ]),
  })
  .strict()
  .refine((v) => Boolean(v.lineIds?.length) !== Boolean(v.group), 'Send lineIds or group, not both')
  .refine((v) => !(v.decision.kind === 'WRITE_OFF' && v.decision.cause === 'OTHER' && !v.decision.note), 'Other needs a note');
export type DecisionInput = z.infer<typeof decisionInputSchema>;

/** C28 GET /counts/:id/approve-preview (Paper step 11). cap counts.resolve. */
export const approvePreviewSchema = z.object({
  rows: z.array(
    z.object({
      lineId: uuid.nullable(),
      /** "Sugar, white · Prep use not logged" */
      label: z.string(),
      valueKes: decimalString,
    }),
  ),
  /** The within-range group, written as small adjustments. */
  withinRange: z.object({ count: z.number().int().nonnegative(), netKes: decimalString }).nullable(),
  /** Adjustments that will post (non-zero WRITE_OFF and ACCEPTED lines). */
  adjustments: z.number().int().nonnegative(),
  netKes: decimalString,
  /** "Director is not alerted. No single difference reaches KES 5,000." */
  directorNote: z.string(),
  /** "Brown sugar was not counted, so nothing is written for it." */
  notCountedNote: z.string().nullable(),
});
export type ApprovePreview = z.infer<typeof approvePreviewSchema>;

/** C29 POST /counts/:id/approve: the Manager's own PIN. One transaction: every adjustment posts through `postStockMovement`, or none. cap counts.resolve. */
export const approveInputSchema = z
  .object({ pin: z.string().regex(/^\d{4,8}$/, 'PIN is 4 to 8 digits'), idempotencyKey: z.string().min(8).max(64) })
  .strict();
export type ApproveInput = z.infer<typeof approveInputSchema>;

/** C30 POST /counts/seen: "Mark seen". cap counts.acknowledge. */
export const seenInputSchema = z.object({ lineIds: z.array(uuid).min(1).max(200) }).strict();
export const seenResultSchema = z.object({ seen: z.number().int().nonnegative() });

// --- Error codes (the `code` field of a 4xx body) ----------------------------

/** Plain-voice messages live in the front end's states copy; the server sends the code and a short English fallback. */
export const COUNT_ERROR_CODES = [
  'YOU_HAVE_OPEN_COUNT', // 409: finish or sign your open count first
  'SECTION_BUSY', // 409: the section is in someone else's open count
  'NOTHING_TO_COUNT', // 422: the picked sections hold no items
  'RECOUNT_NOT_ALLOWED', // 422: the line is not outside the range, or its count is still OPEN
  'COUNT_NOT_OPEN', // 409
  'COUNT_NOT_SUBMITTED', // 409: only a SUBMITTED count can be decided or approved
  'NOT_YOUR_COUNT', // 403
  'NOTHING_COUNTED', // 422: signing needs at least one number
  'CAUSE_REQUIRED', // 422: the Manager's own outside-range line has no cause
  'LINES_UNDECIDED', // 422: approve needs every outside-range line decided
  'INVALID_PIN', // 401: wrong PIN or none set (the same code, nothing is said about which)
  'LAYOUT_CHANGED', // 409: Count setup changed since this page loaded; reload it
  'SECTION_NAME_TAKEN', // 409
  'ITEM_NOT_IN_SETUP', // 404
  'MOVE_ALREADY_UNDONE', // 409
] as const;
export type CountErrorCode = (typeof COUNT_ERROR_CODES)[number];
