/**
 * Inventory — Prep rebuild: FROZEN API CONTRACT, front-end mirror.
 *
 * Hand-written mirror of `backend/src/modules/inventory/prep/_shared/prep-contract.ts`
 * (no shared package in this repo, and the front end carries no Zod). Source of
 * truth: docs/API_CONTRACT.md §33 and docs/features/inventory/prep-plan.md §3.
 * `prep-contract.test.ts` (back end) parses `prep-contract.fixtures.json` against
 * the Zod schemas and checks the front-end copy of the fixtures is identical; the
 * front-end test types the same fixtures with these types, so drift fails CI.
 *
 * Wire rules: decimals are STRINGS, timestamps ISO 8601 UTC, dates `YYYY-MM-DD`
 * (Africa/Nairobi days). Fields marked "cap" are absent unless the caller holds
 * that capability.
 */

export type PrepRunStatus = 'RECORDED' | 'CORRECTED' | 'CANCELLED';
export type YieldReason = 'TRIMMED_MORE' | 'SPILLAGE' | 'BURNT' | 'OTHER';
export type CorrectReason = 'TYPO' | 'WRONG_ITEM' | 'WRONG_QUANTITY' | 'OTHER';
export type CancelReason = 'ENTERED_TWICE' | 'NEVER_MADE' | 'WRONG_ITEM' | 'OTHER';
export type RecipeReason = 'BETTER_RECIPE' | 'PORTION_SIZE_CHANGED' | 'NEW_SUPPLIER' | 'OTHER';

export interface VsUsual {
  label: 'ON_TARGET' | 'LOW' | 'HIGH' | 'NO_BASIS';
  /** Signed, "−2" / "+0.3"; null for NO_BASIS. */
  deltaAmount: string | null;
  /** Ready to show: "on target", "−2 kg · low yield". */
  text: string;
}

export interface ExpectedYield {
  amount: string | null;
  unit: string;
  source: 'RECIPE' | 'PAST_RUNS' | 'NONE';
  /** "about 76 portions" or "about 3 kg, from past runs". */
  text: string;
}

export interface Person {
  id: string;
  name: string;
  initials: string;
  /** "Store Attendant" */
  roleLabel: string;
}

export interface RunLine {
  itemId: string;
  itemName: string;
  quantity: string;
  unit: string;
  /** cap prep.see_costs */
  unitCost?: string;
  lineCost?: string;
  /** Stock at run time; cap restock.read */
  onHand?: string;
  /** Silent flag; cap prep.read_flags */
  exceedsStock?: boolean;
}

export interface RunRef {
  id: string;
  reference: string;
  at: string;
}

export interface RunSummary {
  id: string;
  /** "PREP-0131" */
  reference: string;
  at: string;
  outputItemId: string;
  outputName: string;
  inputsPreview: { firstLabel: string; moreCount: number };
  made: string;
  unit: string;
  vsUsual: VsUsual;
  status: PrepRunStatus;
  /** replacesRunId is set */
  isCorrection: boolean;
  by: Person;
  /** Recorded by the caller. */
  mine: boolean;
  /** cap prep.see_costs */
  outputUnitCost?: string;
  /** cap prep.read_flags */
  needsLook?: boolean;
  reviewedBy?: Person | null;
  reviewedAt?: string | null;
}

export interface ChangeRow {
  itemName: string;
  was: string | null;
  now: string | null;
  unit: string;
  /** cap prep.see_costs */
  costNow?: string;
}

export interface RunDetail extends RunSummary {
  inputs: RunLine[];
  /** cap prep.see_costs */
  totalInputCost?: string;
  /** The figure the run was judged against (the snapshot). */
  expected: ExpectedYield;
  recipeVersion: number | null;
  yieldReason: YieldReason | null;
  yieldReasonNote: string | null;
  /** cap prep.read_flags; notify = over 35% (in-app flag only). */
  flags?: {
    yield: 'LOW' | 'HIGH' | null;
    notify: boolean;
    stockExceeded: boolean;
    exceedsText: string | null;
  };
  replaces: RunRef | null;
  replacedBy: RunRef | null;
  correction: {
    reason: string;
    note: string | null;
    by: Person;
    at: string;
    changed: ChangeRow[];
    unitCostBefore?: string;
    unitCostAfter?: string;
  } | null;
  cancellation: { reason: string; note: string | null; by: Person; at: string } | null;
  /** "Recorded as PREP-0130 · Sarah Achieng" */
  timeline: { at: string; text: string }[];
  /** For THIS caller. lockedReason is "Ask the Store Manager" after 24 h. */
  can: { correct: boolean; cancel: boolean; review: boolean; lockedReason: string | null };
  /** The Attendant's "until tomorrow 07:20". */
  windowEndsAt: string | null;
}

// --- Recipes (#1-3) ---------------------------------------------------------

export interface RecipesQuery {
  search?: string;
  show?: 'all' | 'has' | 'none';
  changed?: 'any' | '30d' | 'older';
  page?: number;
  perPage?: number;
}

export interface RecipeRow {
  itemId: string;
  itemName: string;
  unit: string;
  recipe: {
    /** "10 kg chicken, cut · 1 kg garlic-ginger paste" */
    ingredientsText: string;
    targetYield: string;
    mainItemName: string;
    version: number;
    lastChangedAt: string;
    lastChangedBy: Person;
  } | null;
  /** "about 3 kg"; shown when recipe is null. */
  pastRunsAverageText: string | null;
}

export interface RecipesList {
  items: RecipeRow[];
  total: number;
  totalItems: number;
  withoutRecipe: number;
}

export interface RecipeDetail {
  itemId: string;
  itemName: string;
  unit: string;
  current: {
    version: number;
    targetYield: string;
    lines: { itemId: string; itemName: string; unit: string; amount: string; isMain: boolean }[];
    changedAt: string;
    changedBy: Person;
    reason: RecipeReason | null;
  } | null;
  /** Step 26 "Use these"; only when current is null. */
  suggestFromLastRun: {
    lines: { itemId: string; itemName: string; unit: string; amount: string }[];
    made: string;
    basedOn: string;
  } | null;
  /** cap prep.see_costs */
  costPerUnitNow?: string;
  history: {
    version: number;
    at: string;
    by: Person;
    reason: RecipeReason | null;
    reasonNote: string | null;
  }[];
}

/** Exactly one isMain, no duplicate item, no line equal to the output item. */
export interface RecipeInput {
  targetYield: string;
  lines: { itemId: string; amount: string; isMain: boolean }[];
  reason?: RecipeReason;
  reasonNote?: string;
}

// --- Recording (#4-7) -------------------------------------------------------

export interface InputLine {
  itemId: string;
  quantity: string;
}

export interface CheckInput {
  outputItemId: string;
  inputs: InputLine[];
  made?: string;
}

export interface RecordInput {
  idempotencyKey: string;
  outputItemId: string;
  inputs: InputLine[];
  made: string;
  yieldReason?: YieldReason;
  reasonNote?: string;
}

export interface LastRun {
  inputs: { itemId: string; quantity: string }[];
  made: string;
}

export interface OutputsResponse {
  items: {
    itemId: string;
    name: string;
    unit: string;
    hasRecipe: boolean;
    expectedText: string | null;
    lastRun: LastRun | null;
  }[];
}

export interface PrepAgainResponse {
  tiles: {
    itemId: string;
    name: string;
    ingredientsText: string;
    expectedText: string | null;
    lastRun: LastRun | null;
  }[];
}

export interface CheckResult {
  expected: ExpectedYield;
  /** null until `made` is sent. */
  vsUsual: VsUsual | null;
  /** ≤15% / >15% / >35%. NOTIFY shows to managers as a flag only. */
  tier: 'ON_TARGET' | 'WARN' | 'NOTIFY' | null;
  /** made > 3x or < 1/3 of expected; warns, never blocks. */
  typoSuspect: { suspect: boolean; text: string | null };
  /** Same output, same input amounts, same Nairobi day (RECORDED runs). */
  repeat: { duplicate: boolean; of: RunRef | null };
  usualRecipeText: string | null;
  /** Recipe exists but the run does not use its main ingredient. */
  mainIngredientMissing: boolean;
  /** cap prep.see_costs */
  cost?: { totalInput: string; perUnit: string | null };
  /** cap restock.read */
  stock?: { itemId: string; onHand: string; exceeds: boolean }[];
}

// --- Runs (#8-10) -----------------------------------------------------------

export interface RunsQuery {
  search?: string;
  outputItemId?: string;
  personId?: string;
  status?: PrepRunStatus;
  needsLook?: boolean;
  mine?: boolean;
  /** YYYY-MM-DD, Africa/Nairobi */
  from?: string;
  to?: string;
  page?: number;
  perPage?: number;
}

export interface RunsList {
  items: RunSummary[];
  total: number;
  page: number;
  perPage: number;
}

export interface RunsSummary {
  runsThisWeek: number;
  runsToday: number;
  needsLookCount: number;
  /** cap prep.see_costs */
  prepValue7d?: string;
}

// --- Fixing a slip (#11-13) -------------------------------------------------

export interface CorrectInput {
  idempotencyKey: string;
  inputs: InputLine[];
  made: string;
  reason: CorrectReason;
  reasonNote?: string;
  yieldReason?: YieldReason;
}

export interface CancelInput {
  reason: CancelReason;
  reasonNote?: string;
}

export interface CancelPreview {
  items: {
    itemId: string;
    itemName: string;
    onHandNow: string;
    onHandAfter: string;
    unit: string;
    belowZero: boolean;
  }[];
}

// --- Oversight (#14-17) -----------------------------------------------------

export interface NeedsLookList {
  count: number;
  items: (RunSummary & { reasons: string[] })[];
}

export interface NeedsLookCount {
  count: number;
}

// --- Error codes (stable; switch on these) ----------------------------------

export type PrepErrorCode =
  | 'RECIPE_UNCHANGED'
  | 'REASON_REQUIRED'
  | 'MAIN_INGREDIENT_REQUIRED'
  | 'INPUT_IS_OUTPUT'
  | 'DUPLICATE_INPUT_LINE'
  | 'QUANTITY_NOT_POSITIVE'
  | 'PREP_RUN_LOCKED'
  | 'RUN_NOT_OPEN'
  | 'EXPORT_TOO_LARGE';
