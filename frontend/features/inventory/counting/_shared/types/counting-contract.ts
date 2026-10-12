/**
 * Inventory: Counting rebuild. FROZEN API CONTRACT, front-end mirror.
 *
 * Hand-written mirror of `backend/src/modules/inventory/counting/_shared/counting-contract.ts` (no shared package in this
 * repo, and the front end carries no Zod). Source of truth: docs/features/inventory/stock-count-waste-contract.md.
 * `counting-contract.test.ts` (back end) parses `counting-contract.fixtures.json` against the Zod schemas and checks the
 * front-end copy of the fixtures is identical; the front-end test types the same fixtures with these types, so drift fails CI.
 *
 * A field marked "cap X" is ABSENT unless the caller holds X. The Store Attendant holds neither `restock.read` nor
 * `counts.read`: every key in COUNT_STOCK_FIGURE_KEYS is absent from every response they can reach. The screens never
 * test a role name; they test whether the key is there, or the `can` flags.
 */
import type { KpiCell, PageInfo, PageQuery, Person } from '../../../_shared/types/wire';

export type CountStatus = 'OPEN' | 'SUBMITTED' | 'APPROVED';
export type LineResult = 'MATCHES' | 'WITHIN_RANGE' | 'EXCEEDS' | 'NOT_COUNTED' | 'NOT_YET';
export type CountCause = 'PREP_NOT_LOGGED' | 'SPOILAGE' | 'MISCOUNT' | 'LOSS' | 'OTHER';
export type MovementKind = 'DISPATCH' | 'PREP_USE' | 'DELIVERY' | 'WASTE';
export type LineDecisionKind = 'PENDING' | 'ACCEPTED' | 'WRITE_OFF' | 'MOVEMENT_LOGGED' | 'RECOUNT_ASKED';
export type RecheckState = 'NONE' | 'RECOUNTED' | 'KEPT';
export type SectionKind = 'SUPPLIER' | 'MANUAL';

export const COUNT_CAUSES: readonly CountCause[] = ['PREP_NOT_LOGGED', 'SPOILAGE', 'MISCOUNT', 'LOSS', 'OTHER'];
export const CAUSE_TEXT: Record<CountCause, string> = {
  PREP_NOT_LOGGED: 'Prep use not logged',
  SPOILAGE: 'Spoilage or spill',
  MISCOUNT: 'Miscount',
  LOSS: 'Loss or theft',
  OTHER: 'Other',
};
export const MOVEMENT_KINDS: readonly MovementKind[] = ['DISPATCH', 'PREP_USE', 'DELIVERY', 'WASTE'];

/** Keys absent for a caller without `restock.read` (the Store Attendant). */
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

export interface LineDecision {
  kind: LineDecisionKind;
  cause: CountCause | null;
  causeNote: string | null;
  movementKind: MovementKind | null;
  /** "Prep use not logged", "Movement logged · Dispatch", "Within range · accepted", "Recount asked". */
  text: string;
  by: Person | null;
  at: string | null;
}

export interface CountLine {
  id: string;
  itemId: string;
  itemName: string;
  unit: string;
  sectionId: string | null;
  sectionName: string | null;
  /** Shelf position inside the count. */
  position: number;
  /** null = no number (skipped or not yet reached). "0" is a real count of zero. */
  countedQty: string | null;
  skipped: boolean;
  recheck: RecheckState;
  /** The number typed before a recheck replaced it; null unless recheck = RECOUNTED. */
  firstCountedQty: string | null;
  lastCountedAt: string | null;
  /** "Yesterday", "6 days ago", "Never counted". */
  lastCountedText: string;
  /** cap catalog.see_costs */
  unitCost?: string;
  /** cap restock.read. Live ledger figure while OPEN (only the counter sees it); frozen after the counter signs. */
  expectedQty?: string;
  /** cap restock.read. counted − expected, signed. */
  difference?: string;
  /** cap restock.read. Signed percent of expected, one decimal. */
  differencePercent?: string;
  /** cap restock.read. Signed KES. */
  differenceValueKes?: string;
  /** cap restock.read */
  result?: LineResult;
  /** cap restock.read. "What the records show". */
  story?: string | null;
  /** cap restock.read. The chip marked SUGGESTED. */
  suggestedCause?: CountCause | null;
  /** cap restock.read. 3 or more = "short three counts running". */
  shortStreak?: number;
  /** cap restock.read */
  decision?: LineDecision;
  /** cap restock.read */
  director?: { flagged: boolean; alert: boolean; seenAt: string | null; seenBy: Person | null };
  /** cap restock.read. "ADJ-3402" */
  adjustmentRef?: string | null;
  can: { decide: boolean; countAgain: boolean };
}

export interface CountProgress {
  total: number;
  counted: number;
  skipped: number;
  zero: number;
  rechecked: number;
  /** "12 of 37 counted · 1 skipped" */
  text: string;
}

export interface CountDetail {
  id: string;
  /** "CNT-2026-1013" */
  reference: string;
  status: CountStatus;
  /** "In progress", "Waiting for you", "Submitted", "Approved", "Signed". */
  statusText: string;
  sections: { id: string; name: string }[];
  scope: 'SECTIONS' | 'ITEMS';
  counter: Person;
  startedAt: string;
  signedAt: string | null;
  approvedAt: string | null;
  approver: Person | null;
  /** The Manager counted and signed her own count: no approval step. */
  selfSigned: boolean;
  recountOf: { countId: string; reference: string; lineId: string; itemName: string } | null;
  progress: CountProgress;
  savedAt: string | null;
  tracker: { steps: { key: 'COUNTED' | 'SUBMITTED' | 'CHECKED' | 'APPROVED'; state: 'DONE' | 'CURRENT' | 'TODO'; at: string | null }[] };
  /** cap restock.read */
  figures?: {
    counted: number;
    withinRange: number;
    exceeds: number;
    notCounted: number;
    toDecide: number;
    decided: number;
    netDifferenceKes: string;
    withinRangeNetKes: string;
  };
  /** cap restock.read */
  range?: { kes: number; percent: string };
  /** cap restock.read */
  expectedAsOf?: string | null;
  /** cap restock.read. "What happened". */
  timeline?: { label: string; at: string; detail: string | null }[];
  lines: CountLine[];
  can: { count: boolean; sign: boolean; decide: boolean; approve: boolean; print: boolean };
}

// --- C1 to C4 -----------------------------------------------------------------

export interface CountsSummary {
  audience: 'manager' | 'director';
  kpis: KpiCell[];
}

export interface CountsListQuery extends PageQuery {
  status?: 'all' | 'waiting' | 'inProgress' | 'approved';
  search?: string;
  /** Lane 0 amendment (8 Oct 2026): only counts started on these Nairobi days (`YYYY-MM-DD`), both included; either may be given alone. Counts waiting for approval always appear, whatever the range (owner decision, 8 Oct 2026); rows, total and chip numbers follow the same rule. */
  from?: string;
  to?: string;
}

export interface CountRow {
  id: string;
  reference: string;
  status: CountStatus;
  statusText: string;
  /** "Samrat", "Others, Packaging", "Eggs". */
  sectionsText: string;
  counter: Person;
  startedAt: string;
  signedAt: string | null;
  /** "Today 07:42", "Started 09:10", "Mon 12 Oct 16:10". */
  signedText: string;
  itemsCounted: number;
  itemsTotal: number;
  /** "36" when finished, "14 of 28" while counting. */
  itemsText: string;
  /** "4 exceed · 32 within". cap restock.read */
  differencesText?: string;
  recountOf: { id: string; reference: string } | null;
  mine: boolean;
  can: { review: boolean };
}

export interface CountsList {
  rows: CountRow[];
  chips: { all: number; waiting: number; inProgress: number; approved: number; unsectioned: number };
  page: PageInfo;
}

// --- C31 home, C32 my counts (Amendment 2, Block 5). The caller's own data, blind: no stock figure, no difference. ---

/** C31 GET /counts/home: the Attendant's front door (Paper step 52). */
export interface CountsHome {
  /** The caller's own open count, so the home can say "Resume". `counted` and `total` are lines, not stock. */
  openCount: { id: string; reference: string; sectionsText: string; counted: number; total: number; progressText: string } | null;
  sections: {
    /** "8 sections". */
    total: number;
    /** The section counted longest ago: a date and no figure. Null when there is no section. */
    longestAgo: { id: string; name: string; lastCountedAt: string | null; lastCountedText: string } | null;
  };
  /** Counts the caller has signed, all time: the badge on My counts. */
  signedCount: number;
  /** Waste entries the caller logged today (Nairobi day), reversed ones included. */
  wasteToday: number;
}

/** C32 GET /counts/mine. */
export interface MyCountsQuery extends PageQuery {
  status?: 'all' | 'waiting' | 'approved';
  /** Nairobi days (`YYYY-MM-DD`) on when the count was signed, both included. Neither given: the last 30 days. A count waiting for review always shows. */
  from?: string;
  to?: string;
}

export interface MyCountRow {
  id: string;
  reference: string;
  status: 'SUBMITTED' | 'APPROVED';
  /** "Waiting for review", "Approved", "Signed". */
  statusText: string;
  sectionsText: string;
  itemCount: number;
  signedAt: string;
  /** "Today 07:42", "Yesterday 16:10", "Mon 12 Oct 16:10". */
  signedText: string;
}

export interface MyCountsList {
  rows: MyCountRow[];
  /** `page.total` is the header's "12 counts". */
  page: PageInfo;
}

export interface FlaggedLine {
  countId: string;
  countReference: string;
  lineId: string;
  itemName: string;
  unit: string;
  difference: string;
  differenceValueKes: string;
  cause: CountCause | null;
  causeText: string;
  countedBy: Person;
  alert: boolean;
  seenAt: string | null;
  seenBy: Person | null;
  can: { markSeen: boolean };
}

export interface FlaggedList {
  rows: FlaggedLine[];
  chips: { flaggedToMe: number; allCounts: number; repeatShortfalls: number };
  page: PageInfo;
}

export interface RepeatShortfallList {
  rows: {
    itemId: string;
    itemName: string;
    unit: string;
    sectionName: string | null;
    shortRuns: number;
    lastCounts: { countReference: string; difference: string; at: string }[];
  }[];
  chips: FlaggedList['chips'];
  page: PageInfo;
}

// --- C6, C7 print -------------------------------------------------------------

export interface CountRecordPrint {
  reference: string;
  generatedText: string;
  sectionsText: string;
  counterName: string;
  timeText: string;
  counted: number;
  total: number;
  differences: number;
  netValueKes: string;
  rows: { itemName: string; unit: string; expected: string; counted: string; difference: string; valueKes: string; decisionText: string }[];
  footnote: string;
  signatures: { role: 'COUNTED_BY' | 'APPROVED_BY'; name: string; roleLabel: string; signedAtText: string }[];
}

export interface BlankSheet {
  printedAtText: string;
  dateText: string;
  sections: { id: string; name: string; detail: string; items: { name: string; unit: string }[] }[];
}

// --- C8 to C14 record ---------------------------------------------------------

export interface StartSection {
  id: string;
  name: string;
  supplierName: string | null;
  itemCount: number;
  lastCountedAt: string | null;
  lastCountedText: string;
  lastCountedBy: string | null;
  longestSinceCount: boolean;
  /** Already in someone else's open count. */
  busy: { countId: string; reference: string; counterName: string } | null;
}

export interface StartOptions {
  sections: StartSection[];
  order: { mode: 'SHELF' | 'TODAY'; appliesTo: string };
  unsectionedCount: number;
  openCount: { id: string; reference: string; sectionsText: string; progressText: string } | null;
  recount: { lineId: string; countId: string; countReference: string; itemId: string; itemName: string; unit: string; sectionName: string | null } | null;
  can: { start: boolean };
}

export interface StartCountInput {
  sectionIds?: string[];
  itemIds?: string[];
  recountOfLineId?: string;
  /** A uuid the form makes when it opens. */
  idempotencyKey: string;
}

export interface SaveLinesInput {
  lines: { lineId: string; countedQty: string | null; skipped: boolean; recheck?: 'RECOUNTED' | 'KEPT' }[];
}

export interface SaveLinesResult {
  savedAt: string;
  progress: CountProgress;
  /** cap restock.read, counter only. */
  lines?: { lineId: string; result?: LineResult; difference?: string; differenceValueKes?: string }[];
}

export interface CheckResult {
  items: { lineId: string; itemName: string; unit: string; sectionName: string | null; counted: string }[];
  text: string;
}

export interface SignPreview {
  itemCount: number;
  zero: number;
  skipped: number;
  /** cap restock.read */
  figures?: {
    appliedLines: number;
    appliedNetKes: string;
    outside: { lineId: string; itemName: string; unit: string; difference: string; differenceValueKes: string; cause: CountCause | null }[];
    netKes: string;
    causesNeeded: string[];
    directorNote: string;
  };
}

export interface SignInput {
  /** 4 to 8 digits. */
  pin: string;
  causes?: { lineId: string; cause: CountCause; note?: string }[];
  idempotencyKey: string;
}

export interface SectionOrderResult {
  sectionIds: string[];
  appliesTo: string;
}

// --- C15 to C22 setup ---------------------------------------------------------

export interface SetupSection {
  id: string;
  name: string;
  kind: SectionKind;
  supplierName: string | null;
  itemCount: number;
  position: number;
  /** "manual section" */
  tagText: string | null;
}

export interface MoveView {
  id: string;
  itemId: string;
  itemName: string;
  fromSectionId: string | null;
  fromSectionName: string | null;
  toSectionId: string;
  toSectionName: string;
  by: Person;
  at: string;
  undone: boolean;
  /** "Moved here from Summer by Linnet · 13 Oct 07:12" */
  text: string;
  can: { undo: boolean };
}

export interface SetupView {
  /** Send back on `PUT /count-setup/layout`; a stale value is a 409 LAYOUT_CHANGED. */
  version: string;
  sections: SetupSection[];
  unsectioned: { count: number; text: string };
  movedSinceLastVisit: MoveView[];
  movedText: string | null;
  can: { edit: boolean };
}

export interface SectionItems {
  section: { id: string; name: string; itemCount: number };
  items: { itemId: string; name: string; unit: string; lastCountedAt: string | null; lastCountedText: string; stale: boolean; movedHere: MoveView | null }[];
}

export interface LayoutInput {
  version: string;
  /** Sections in order; `unsectioned` is a valid id. Each lists its items in order. */
  sections: { id: string; itemIds: string[] }[];
}

export interface AddItemsQuery extends PageQuery {
  sectionId: string;
  q?: string;
  tab?: 'unsectioned' | 'other';
  categoryId?: string;
  type?: string;
  departmentTag?: string;
}

export interface AddItemsList {
  rows: {
    itemId: string;
    name: string;
    categoryName: string | null;
    typeText: string;
    unit: string;
    placement: { kind: 'UNSECTIONED'; note: string | null } | { kind: 'IN_SECTION'; sectionId: string; sectionName: string };
  }[];
  chips: { unsectioned: number; otherSections: number };
  /** `3 matches for "oat" · all sections`, or null with no search. */
  matchText: string | null;
  page: PageInfo;
}

// --- C23 to C26 settings ------------------------------------------------------

export interface CountSettings {
  rangeKes: number;
  rangePercent: string;
  flagRepeatShortfalls: boolean;
  directorAlertKes: number;
  rangeUpdatedBy: Person | null;
  rangeUpdatedAt: string | null;
  alertUpdatedBy: Person | null;
  alertUpdatedAt: string | null;
  can: { editRange: boolean; editDirectorAlert: boolean };
}

export interface SettingsPreview {
  range: { withinRange: number; outsideRange: number; hint: string | null };
  alert: { countsOver: number; hint: string | null };
}

export interface UpdateSettingsInput {
  rangeKes: number;
  rangePercent: string;
  flagRepeatShortfalls: boolean;
}

// --- C27 to C30 review --------------------------------------------------------

export type DecisionBody =
  | { kind: 'WRITE_OFF'; cause: CountCause; note?: string }
  | { kind: 'MOVEMENT_LOGGED'; movementKind: MovementKind }
  | { kind: 'RECOUNT_ASKED' }
  | { kind: 'ACCEPTED' }
  | { kind: 'CLEAR' };

/** Send `lineIds` or `group`, never both. */
export interface DecisionInput {
  lineIds?: string[];
  group?: 'WITHIN_RANGE';
  decision: DecisionBody;
}

export interface ApprovePreview {
  rows: { lineId: string | null; label: string; valueKes: string }[];
  withinRange: { count: number; netKes: string } | null;
  adjustments: number;
  netKes: string;
  directorNote: string;
  notCountedNote: string | null;
}

export interface ApproveInput {
  pin: string;
  idempotencyKey: string;
}

/** The `code` of a 4xx body. The screens map each to the plain-voice copy in `lib/states-copy.ts`; never show the code. */
export type CountErrorCode =
  | 'YOU_HAVE_OPEN_COUNT'
  | 'SECTION_BUSY'
  | 'NOTHING_TO_COUNT'
  | 'RECOUNT_NOT_ALLOWED'
  | 'COUNT_NOT_OPEN'
  | 'COUNT_NOT_SUBMITTED'
  | 'NOT_YOUR_COUNT'
  | 'NOTHING_COUNTED'
  | 'CAUSE_REQUIRED'
  | 'LINES_UNDECIDED'
  | 'INVALID_PIN'
  | 'LAYOUT_CHANGED'
  | 'SECTION_NAME_TAKEN'
  | 'ITEM_NOT_IN_SETUP'
  | 'MOVE_ALREADY_UNDONE';
