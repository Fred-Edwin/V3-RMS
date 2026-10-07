# Prep rebuild: plan and API contract (Slice 0, Part 1)

**Closed out (Slice 5): everything below is built. This file is kept as the design record (code comments cite its sections); where it differs from what was built, `docs/API_CONTRACT.md` §33 and the sub-module READMEs win.** Written 7 Oct 2026. Earlier status: **Part 2 done (7 Oct 2026): frozen contract, migration, capabilities, ledger reversal path and sidebar built on `feat/prep-rebuild`; next is Slice 1.** Decisions Q-1 to Q-5 settled (section 8); production checked (section 7). Built differently from the text below in two small ways: the `typical_yield_at_run_time` drop is inside the one migration (section 8), and the migration SQL was produced with `prisma migrate diff` (non-interactive shell) with the backfill placed before the drop. Temporary file; deleted at close-out (Slice 5). Branch `feat/prep-rebuild` (from `main` at `47029c1`). Sources: the Slice 0 brief, Paper page "Inventory · Prep" (Chapters 1 to 8 and 10, steps 1 to 27 and 35 to 42, sidebar parts `1UZ1-0`), `prep/README.md` and `DESIGN-NOTES.md`, the ledger door, `central-store-access.ts`, `blind-rule.ts`, the audit-log module, and the nav table. Chapter 9 (manager on tablet and phone) is parked and not planned here.

## 0. What I found in the code that shapes the plan

- **The old flow is small.** 5 endpoints, 2 models, 1 service writing the ledger directly (2 writes, listed in `ledger-guard.test.ts`), `requireRole` lists, 4 screens. Local database: 0 runs, 27 live prepped items (`type = PREPPED`).
- **Nothing reaches production until Slice 5.** The whole rebuild is one branch and one merge, so "the old flow keeps running" means two things only: (a) the old endpoints keep passing their tests on this branch until the slice that replaces them; (b) at the Slice 5 deploy the migration runs before the new containers start, so every new column is nullable or defaulted and the old code never breaks mid-deploy.
- **The ledger door cannot reverse a prep row yet.** It reverses only `ADJUSTMENT` rows. `restock-suggestion.ts` already says "Reversals net out because they carry the opposite sign", so the pattern is: **a reversal keeps the original's type with the opposite sign** (`PREP_CONSUME` positive, `PREP_PRODUCE` negative), linked by the existing unique `reversesTransactionId`. No new enum value. The door gains a "reverse a prep row" path; Stock's ledger label gets "· reversed" (as it does for counts); `currentCostSetAt` ignores reversal rows.
- **Run numbers use the existing `ReferenceCounter`** with prefix `PREP`, gap-free per site, same transaction as the run (as `ADJ`, `LPO`, `GRN` do).
- **Idempotency**: the existing `idempotency_keys` table is tied to orders. Prep gets its own column on the run instead (section 1.3).
- **Audit log** merges sources by `AuditArea`; a `PREP` area is added. Prep events are **derived from run and recipe-version columns**, so no event table is needed.

## 1. Data model

Schema file: `backend/prisma/schema/inventory/prep.prisma` (extended; recipes go in a new `prep-recipes.prisma`). Column names `snake_case` with `@map`, site column is `organization_id` (`siteId`), decimals as the existing `Decimal(12,4)` / `(12,2)`.

### 1.1 New models (Usual recipes)

```
PrepRecipe            one per (site, output item). The "current recipe" header.
  id, siteId, outputItemId  @@unique([siteId, outputItemId])
  currentVersion Int          (the highest version number)
  createdAt

PrepRecipeVersion     immutable; this table IS the change log (who, when, reason; "before" is version n-1)
  id, recipeId, siteId, version Int  @@unique([recipeId, version])
  targetYield Decimal(12,4)         yield for ONE batch, in the output item's usage unit
  reason PrepRecipeChangeReason?    null only on version 1 ("Recipe set"); required from version 2 ("Recipe changed")
  reasonNote String?                 free text when reason = OTHER (optional)
  createdById, createdAt

PrepRecipeLine        the ingredients of one version
  id, versionId, inputItemId, amount Decimal(12,4)  (for one batch), isMain Boolean, lineOrder Int
  Exactly one isMain per version (partial unique index, raw SQL in the migration).

enum PrepRecipeChangeReason { BETTER_RECIPE  PORTION_SIZE_CHANGED  NEW_SUPPLIER  OTHER }
```

### 1.2 Changes to `PrepRun` and `PrepRunInputLine` (all additive)

| Column (new) | Type | Why | Old code writes it? |
|---|---|---|---|
| `reference` | `String?` `@@unique([siteId, reference])` | PREP-nnnn | no, so nullable; the service always sets it |
| `status` | enum `PrepRunStatus { RECORDED CORRECTED CANCELLED }` default `RECORDED` | Q5 | default covers old inserts |
| `replacesRunId` | `String? @unique` (self FK) | a correction points at the run it replaces; one run is replaced once | n/a |
| `closedAt`, `closedById` | `DateTime?`, `String?` | when and who corrected or cancelled this run | n/a |
| `correctionReason` | enum `PrepCorrectReason { TYPO WRONG_ITEM WRONG_QUANTITY OTHER }?` | on the **new** run | n/a |
| `cancelReason` | enum `PrepCancelReason { ENTERED_TWICE NEVER_MADE WRONG_ITEM OTHER }?` | on the cancelled run | n/a |
| `reasonNote` | `String?` | note when `OTHER` | n/a |
| `yieldReason` | enum `PrepYieldReason { TRIMMED_MORE SPILLAGE BURNT OTHER }?` | the Attendant's optional "Say why" | n/a |
| `expectedYield` | `Decimal(12,4)?` | the figure the run was judged against | backfilled |
| `expectedSource` | enum `PrepExpectedSource { RECIPE PAST_RUNS NONE }` default `NONE` | label on screens ("past runs") | backfilled |
| `recipeVersionId` | `String?` FK `PrepRecipeVersion` | which recipe version judged it | n/a |
| `stockFlag` | `Boolean` default false | silent flag: an input exceeded expected stock | n/a |
| `needsLook` | `Boolean` default false, `@@index([siteId, needsLook])` | queue and badge, cleared by Mark reviewed | n/a |
| `reviewedAt`, `reviewedById` | `DateTime?`, `String?` | Mark reviewed | n/a |
| `idempotencyKey` | `String?` `@@unique([siteId, createdById, idempotencyKey])` | double-tap guard | n/a |
| `PrepRunInputLine.onHandAtRunTime` | `Decimal(12,4)?` | stock the run was judged against (manager drawer "expected in stock") | n/a |

**Kept as they are** (the old code still writes them; new code keeps writing `yieldVarianceLabel` and `notifiedStoreManager`): `typicalYieldAtRunTime`, `yieldVarianceLabel`, `notifiedStoreManager`. After release, a later "contract" migration drops `typical_yield_at_run_time` (see 1.4). Also add `@@index([siteId, status, createdAt])` and `@@index([siteId, createdById, createdAt])`.

Which run carries which status (confirm, Q-1): the **old** run of a correction becomes `CORRECTED` (superseded, kept on record) and the **new** run is `RECORDED` with `replacesRunId` set; screens label the new one "Corrected run" (as Paper step 17 does). A cancelled run is `CANCELLED`. "Typical yield" and the past-runs fallback count `RECORDED` runs only: so a correction counts and the superseded original and a cancelled run do not.

### 1.3 Idempotency and numbering

- Confirm and correct carry `idempotencyKey` (a UUID the form makes when it opens). Same `(site, user, key)` returns the already-recorded run (HTTP 200, `replayed: true`). A race past the check is decided by the unique index (catch `P2002`, read, return).
- `reference` comes from `referenceCounterRepository.nextReference(tx, siteId, 'PREP')` inside the record or correct transaction.

### 1.4 Migration plan (additive; expand now, contract later)

The brief's Part 2 asks for the schema in this session, and two agents build in parallel afterwards, so **one migration for the whole rebuild is generated in Slice 0** (no migration collisions between worktrees). Slices only start *using* parts of it.

| Migration | When | Contents |
|---|---|---|
| **A `prep_rebuild`** | Slice 0 Part 2 | the 3 recipe tables and enums; all new `prep_runs` / `prep_run_input_lines` columns and indexes; the partial unique index (one main ingredient); backfill (below) |
| **B `prep_drop_typical_yield`** (optional) | after the release is stable (separate later PR) | drop `typical_yield_at_run_time` |

Backfill inside A, in SQL, per site ordered by `created_at, id`:
1. `reference = 'PREP-' || lpad(row_number(), 4, '0')`; set `reference_counters (site, 'PREP').last_number` to the count so the next run continues the sequence.
2. `status = 'RECORDED'` (default).
3. `expected_yield = typical_yield_at_run_time`, `expected_source = 'PAST_RUNS'` where it was set, else `NONE`.
4. `needs_look = false` for every old run. **Old flagged runs are not pushed into Needs a look** (they would flood the manager on day one). Confirm, Q-3.
5. `recipe_version_id`, `stock_flag`, `reviewed_*`, `on_hand_at_run_time` stay null/false.
The ledger rows of old runs are untouched (append-only trigger). Tested locally on a seeded copy and, in Slice 5, on a restored production copy. Local data today is empty, so Slice 0 also seeds a few runs to test the backfill on.

## 2. Access: capability rows (`central-store-access.ts`)

New capabilities (7). Existing ones reused: `restock.read` (stock figures, via the blind rule), `catalog.read`/`catalog.see_costs`, `audit.read`.

| Capability | Meaning | Roles |
|---|---|---|
| `prep.read` | open Runs, Usual recipes (read-only), History, run detail | Store Manager, System Admin, Accountant, Director, Branch Manager, **Store Attendant** |
| `prep.see_costs` | run costs: output unit cost, input cost, line costs, prep value KPI | everyone above **except the Attendant** (Paper: Attendant views carry no run costs) |
| `prep.read_flags` | flags, Needs a look, review status, expected stock on a run, History export | desktop roles (Store Manager, System Admin, Accountant, Director, Branch Manager); never the Attendant |
| `prep.record` | record a run; correct or cancel **own** run within 24 hours | Store Manager, System Admin, Store Attendant |
| `prep.fix_any` | correct or cancel any run, any age | Store Manager, System Admin |
| `prep.review` | Mark reviewed | Store Manager, System Admin |
| `prep.recipes_write` | set and edit usual recipes | Store Manager, System Admin |

`READ_EVERYTHING` gains `prep.read`, `prep.see_costs`, `prep.read_flags`. Accountant, Director and Branch Manager write nothing in Prep. The Attendant list gets `prep.read`, `prep.record`. A new `prep-access.test.ts` asserts the role-by-capability grid, and `permissions-routes.test.ts` is updated. Run costs are stripped in the serializer with `blindnessOf` plus `actorCan(actor, 'prep.see_costs')`; stock figures with `withoutStockFigures` / `restock.read`. No `requireRole` in any new Prep route.

The 24-hour window and "own run" rule are **service rules**, not capabilities: the service allows a caller without `prep.fix_any` only when `run.createdById === actor.id` and `now - run.createdAt <= 24h`; otherwise `403 PREP_RUN_LOCKED` ("Ask the Store Manager").

## 3. API contract

Base `/inventory/prep`. Envelope `{ success, data }` (as everywhere). Decimals are **strings**; ids strings; timestamps ISO 8601 UTC; dates `YYYY-MM-DD` read as **Africa/Nairobi** days. Every route: `authenticate` + `requireCapability(...)`; reads resolve the site with `requireHubReader`, writes with `requireHubActor` (D-15). All Zod schemas live in one file, **`backend/src/modules/inventory/prep/_shared/prep-contract.ts`** (schemas + `z.infer` types), re-exported by each sub-module's `*-validators.ts` / `*.types.ts`; the front end mirrors it by hand in `frontend/features/inventory/prep/_shared/types/prep-contract.ts`, and a test parses the same sample payloads on both sides. "Cap" below is the capability; extra checks are in the Notes column. Errors use the standard codes: 400 validation, 401, 403, 404, 409, 422.

### 3.1 Shared shapes

```ts
type Unit = string;                                  // the item's usage unit: "kg", "L", "portions"
type PrepRunStatus = 'RECORDED' | 'CORRECTED' | 'CANCELLED';
type VsUsual = { label: 'ON_TARGET' | 'LOW' | 'HIGH' | 'NO_BASIS';   // within 15% / under / over / nothing to judge by
                 deltaAmount: string | null;         // signed, "−2" / "+0.3"; null for NO_BASIS
                 text: string };                     // ready-to-show: "on target", "−2 kg · low yield", "−2 · normal"
type ExpectedYield = { amount: string | null; unit: Unit; source: 'RECIPE' | 'PAST_RUNS' | 'NONE';
                       text: string };               // "about 76 portions" (RECIPE) or "about 3 kg, from past runs"
type Person = { id: string; name: string; initials: string; roleLabel: string };   // "Store Attendant"

interface RunLine { itemId: string; itemName: string; quantity: string; unit: Unit;
  unitCost?: string; lineCost?: string;              // prep.see_costs only
  onHand?: string;                                   // stock at run time; restock.read only
  exceedsStock?: boolean }                           // prep.read_flags only (silent flag)

interface RunSummary {
  id: string; reference: string;                     // "PREP-0131"
  at: string; outputItemId: string; outputName: string;
  inputsPreview: { firstLabel: string; moreCount: number };   // "6 kg beef mince" +1 more
  made: string; unit: Unit; vsUsual: VsUsual;
  status: PrepRunStatus; isCorrection: boolean;      // isCorrection = replacesRunId is set
  by: Person; mine: boolean;                         // recorded by the caller
  outputUnitCost?: string;                           // prep.see_costs
  needsLook?: boolean; reviewedBy?: Person | null; reviewedAt?: string | null;   // prep.read_flags
}

interface RunDetail extends RunSummary {
  inputs: RunLine[]; totalInputCost?: string;        // prep.see_costs
  expected: ExpectedYield;                           // the figure it was judged against (the snapshot)
  recipeVersion: number | null;
  yieldReason: 'TRIMMED_MORE' | 'SPILLAGE' | 'BURNT' | 'OTHER' | null; yieldReasonNote: string | null;
  flags?: { yield: 'LOW' | 'HIGH' | null; notify: boolean; stockExceeded: boolean;
            exceedsText: string | null };            // prep.read_flags; notify = over 35% (in-app flag only)
  replaces: { id: string; reference: string; at: string } | null;
  replacedBy: { id: string; reference: string; at: string } | null;
  correction: { reason: string; note: string | null; by: Person; at: string; changed: ChangeRow[]; unitCostBefore?: string; unitCostAfter?: string } | null;
  cancellation: { reason: string; note: string | null; by: Person; at: string } | null;
  timeline: { at: string; text: string }[];          // "Recorded as PREP-0130 · Sarah Achieng"
  can: { correct: boolean; cancel: boolean; review: boolean; lockedReason: string | null };  // for THIS caller; lockedReason "Ask the Store Manager" after 24 h
  windowEndsAt: string | null;                       // for the Attendant's "until tomorrow 07:20"
}
type ChangeRow = { itemName: string; was: string | null; now: string | null; unit: Unit; costNow?: string };
```

### 3.2 Recipes (sub-module `recipes`)

| # | Method, path | Cap | Request | Response | Errors / notes |
|---|---|---|---|---|---|
| 1 | `GET /recipes` | `prep.read` | query `search?` (item or ingredient name), `show=all\|has\|none` (default all), `changed=any\|30d\|older` (default any), `page`, `perPage` (default 25, max 100) | `{ items: RecipeRow[], total, totalItems, withoutRecipe }` | every live `PREPPED` item is a row, recipe or not |
| 2 | `GET /recipes/:itemId` | `prep.read` | `:itemId` = output item id | `RecipeDetail` | 404 item not prepped or not found |
| 3 | `PUT /recipes/:itemId` | `prep.recipes_write` | `RecipeInput` | `RecipeDetail` (new version) | 422 `RECIPE_UNCHANGED`; 422 `REASON_REQUIRED` (not first version, no reason); 422 `MAIN_INGREDIENT_REQUIRED`; 409 item retired |

```ts
interface RecipeRow { itemId: string; itemName: string; unit: Unit;
  recipe: { ingredientsText: string;                // "10 kg chicken, cut · 1 kg garlic-ginger paste"
            targetYield: string; mainItemName: string; version: number;
            lastChangedAt: string; lastChangedBy: Person } | null;
  pastRunsAverageText: string | null }              // "about 3 kg", shown when recipe is null

interface RecipeDetail { itemId: string; itemName: string; unit: Unit;
  current: { version: number; targetYield: string; lines: { itemId: string; itemName: string; unit: Unit; amount: string; isMain: boolean }[];
             changedAt: string; changedBy: Person; reason: RecipeReason | null } | null;
  suggestFromLastRun: { lines: { itemId: string; itemName: string; unit: Unit; amount: string }[]; made: string; basedOn: string } | null;   // step 26 "Use these"; only when current is null
  costPerUnitNow?: string;                           // prep.see_costs, "about KES 121 per portion"
  history: { version: number; at: string; by: Person; reason: RecipeReason | null; reasonNote: string | null }[] }

const RecipeInput = z.object({
  targetYield: positiveDecimal,
  lines: z.array(z.object({ itemId: uuid, amount: positiveDecimal, isMain: z.boolean() })).min(1).max(30),   // exactly one isMain, no duplicate item, no line = the output item
  reason: z.enum(['BETTER_RECIPE','PORTION_SIZE_CHANGED','NEW_SUPPLIER','OTHER']).optional(),
  reasonNote: z.string().trim().max(300).optional() });
```

The edit drawer's live scaling rows (5 / 10 / 20 kg) are the one-line formula `targetYield × used ÷ mainAmount`; the front end computes them from the form, and one shared table of cases (section 5.3) pins the back-end function and the front-end copy to the same answers.

### 3.3 Recording a run (sub-module `record`)

| # | Method, path | Cap | Request | Response | Errors / notes |
|---|---|---|---|---|---|
| 4 | `GET /outputs` | `prep.record` | none | `{ items: { itemId, name, unit, hasRecipe, expectedText\|null, lastRun: { inputs: {itemId,quantity}[]; made } \| null }[] }` | every live `PREPPED` item, for "Something else" |
| 5 | `GET /prep-again` | `prep.record` | none | `{ tiles: { itemId, name, ingredientsText, expectedText, lastRun: {...} }[] }` (max 3) | the 3 most-made outputs over the last 30 days (non-cancelled runs); if fewer than 3, filled from all time by most recent |
| 6 | `POST /runs/check` | `prep.record` | `CheckInput` | `CheckResult` | no write, no log. Called as the form changes and for the "This run" panel and confirm summary |
| 7 | `POST /runs` | `prep.record` | `RecordInput` | `RunDetail` | 201 new, 200 `replayed`; 404 item; 409 item retired; 422 `INPUT_IS_OUTPUT`, `DUPLICATE_INPUT_LINE`, `QUANTITY_NOT_POSITIVE` |

```ts
const InputLine = z.object({ itemId: uuid, quantity: positiveDecimal });
const CheckInput  = z.object({ outputItemId: uuid, inputs: z.array(InputLine).min(1).max(30), made: positiveDecimal.optional() });
const RecordInput = z.object({ idempotencyKey: uuid, outputItemId: uuid, inputs: z.array(InputLine).min(1).max(30),
  made: positiveDecimal, yieldReason: z.enum(['TRIMMED_MORE','SPILLAGE','BURNT','OTHER']).optional(), reasonNote: z.string().trim().max(300).optional() });

interface CheckResult {
  expected: ExpectedYield;                           // recipe scaling, else past runs, else NONE
  vsUsual: VsUsual | null;                           // null until `made` is sent
  tier: 'ON_TARGET' | 'WARN' | 'NOTIFY' | null;      // ≤15% / >15% / >35%. NOTIFY is shown to managers only as a flag; the Attendant sees the WARN wording
  typoSuspect: { suspect: boolean; text: string | null };   // made > 3x or < 1/3 of expected; warns, never blocks
  repeat: { duplicate: boolean; of: { id: string; reference: string; at: string } | null };   // same output, same input amounts, same Nairobi day (RECORDED runs)
  usualRecipeText: string | null;                    // "Usual recipe: 10 kg chicken and 1 kg paste give 38 portions. For 20 kg chicken that is about 76."
  mainIngredientMissing: boolean;                    // recipe exists but the run does not use its main ingredient: judged by past runs instead
  cost?: { totalInput: string; perUnit: string | null };                         // prep.see_costs
  stock?: { itemId: string; onHand: string; exceeds: boolean }[];                // restock.read (managers' drawer "In stock now 41 kg")
}
```

Rules the service applies when recording (all inside one `prisma.$transaction`): load output and inputs (live, in site); read each input's on-hand from the ledger (for `stockFlag` and the line snapshot); compute expected (recipe if the main ingredient is among the inputs, else past runs: the last 10 `RECORDED` runs or 30 days, whichever gives fewer, else none); compute variance (≤15% on target, >15% low or high, >35% notify); **post one `PREP_CONSUME` per input and one `PREP_PRODUCE` for the output through `postStockMovement`**; set the output item's `currentCost` to total input cost ÷ made; assign `PREP-nnnn`; set `needsLook` when the yield is off or `stockFlag` is true. A typo or repeat warning never blocks and is not stored. The silent flag is never in an Attendant payload.

### 3.4 Seeing runs (sub-module `runs`)

| # | Method, path | Cap | Request | Response | Errors / notes |
|---|---|---|---|---|---|
| 8 | `GET /runs` | `prep.read` | query `search?` (number, output or person), `outputItemId?`, `personId?`, `status?` (`RECORDED\|CORRECTED\|CANCELLED`), `needsLook?`, `mine?`, `from?`, `to?` (Nairobi dates), `page`, `perPage` (default 25, max 100) | `{ items: RunSummary[], total, page, perPage }` | newest first. `needsLook` honoured only with `prep.read_flags` (else ignored). Used by Runs, History and the Attendant's recent runs |
| 9 | `GET /runs/summary` | `prep.read_flags` | none | `{ runsThisWeek, runsToday, needsLookCount, prepValue7d?: string }` | `prepValue7d` needs `prep.see_costs`. Manager KPI strip (step 10) |
| 10 | `GET /runs/:id` | `prep.read` | none | `RunDetail` | blind per role (section 2); an Attendant opening someone else's run gets it read-only (`can` all false, no flags, no costs) |

### 3.5 Fixing a slip (sub-module `fix`)

| # | Method, path | Cap | Request | Response | Errors / notes |
|---|---|---|---|---|---|
| 11 | `POST /runs/:id/correct` | `prep.record` | `CorrectInput` | `RunDetail` of the **new** run | 403 `PREP_RUN_LOCKED` (not own, or over 24 h, and no `prep.fix_any`); 409 `RUN_NOT_OPEN` (cancelled or already corrected); 404 |
| 12 | `POST /runs/:id/cancel` | `prep.record` | `CancelInput` | `RunDetail` | same errors; replays of a cancel return 409 `RUN_NOT_OPEN` |
| 13 | `GET /runs/:id/cancel-preview` | `restock.read` | none | `{ items: { itemId, itemName, onHandNow, onHandAfter, unit, belowZero }[] }` | managers' "this takes stock below zero" warning (step 18) |

```ts
const CorrectInput = z.object({ idempotencyKey: uuid, inputs: z.array(InputLine).min(1).max(30), made: positiveDecimal,
  reason: z.enum(['TYPO','WRONG_ITEM','WRONG_QUANTITY','OTHER']), reasonNote: z.string().trim().max(300).optional(),
  yieldReason: z.enum(['TRIMMED_MORE','SPILLAGE','BURNT','OTHER']).optional() });
const CancelInput  = z.object({ reason: z.enum(['ENTERED_TWICE','NEVER_MADE','WRONG_ITEM','OTHER']), reasonNote: z.string().trim().max(300).optional() });
```

Correct: lock the run row; refuse unless `RECORDED`; post **reversing rows** for the old run (opposite sign, `reversesTransactionId` = each original row, linked to the old run); post new consume and produce rows for the new run; mark the old run `CORRECTED` (`closedAt`, `closedById`); the new run takes a fresh `PREP-nnnn`, `replacesRunId`, `correctionReason`, and is judged against the **current** expected figure. Cancel: the same reversing rows, status `CANCELLED`, nothing deleted; allowed to push stock negative. Output cost: updated **only when the run being fixed is the latest `RECORDED` run of that output item** (by time); on correct it becomes the new run's unit cost; a cancel does not change it (Q-2). A correction keeps the original run's unit-cost snapshot for items it already used and snapshots current cost only for items it adds. The new or cancelled run goes to Needs a look when the corrector is not a manager (an Attendant's correction) or when its own flags say so.

### 3.6 Oversight (sub-module `review`)

| # | Method, path | Cap | Request | Response | Errors / notes |
|---|---|---|---|---|---|
| 14 | `GET /needs-a-look` | `prep.read_flags` | `page`, `perPage` | `{ count, items: (RunSummary & { reasons: string[] })[] }` | `reasons` are the chips: "Low yield · 2 kg under usual", "Beef mince used more than expected", "Said: spillage", "Corrected" |
| 15 | `GET /needs-a-look/count` | `prep.read_flags` | none | `{ count }` | the sidebar badge; cheap indexed count |
| 16 | `POST /runs/:id/review` | `prep.review` | none | `RunDetail` | idempotent: reviewing a reviewed run returns it unchanged; 409 `RUN_NOT_OPEN` for a cancelled run |
| 17 | `GET /runs/export` | `prep.read_flags` | same filters as #8 without paging | `text/csv` (UTF-8 with BOM; header row; columns When, Run, Output, Made, Unit, Vs usual, By, Status, Reviewed by; plus Unit cost with `prep.see_costs`) | file name `prep-history-<from>-<to>.csv`; capped at 10,000 rows (`413`-style 422 `EXPORT_TOO_LARGE`) |

**Removed in the slice that replaces them:** `GET /runs` (old shape), `GET /runs/:id` (old shape), `POST /runs` (old shape), `GET /summary`, `GET /items/:id/typical-yield`. The old routes stay live (and tested) until their replacement lands, then are deleted in that slice's PR to the branch.

**Audit log:** `AUDIT_AREAS` gains `'PREP'`; entries derived from the run and recipe tables: *Recorded* (run `createdAt`), *Corrected* (the new run's `replacesRunId`), *Cancelled* (`closedAt` on a cancelled run), *Reviewed* (`reviewedAt`), *Recipe set* (version 1), *Recipe changed* (version ≥2, with the reason). `audit.read` already covers it; each entry's `what` reads "Recorded PREP-0130 · Marinated chicken 38 portions". `audit-log-validators.ts`' `area` enum gains `PREP`.

**Sidebar badge:** `NavBadge` gains `'prep-needs-look'`, read from `#15` through `features/inventory` public API, shown only to roles holding `prep.read_flags`.

## 4. Session breakdown

Placement. Backend `backend/src/modules/inventory/prep/` (the `prep` sub-module becomes a feature folder of five sub-modules, named for what the user does, plus `_shared`); frontend `frontend/features/inventory/prep/` mirrors it. Each has a `README.md`. Back-end and front-end of a slice are built by two agents in worktrees against the frozen contract, then integrated before the next slice.

```
backend/src/modules/inventory/prep/
  README.md              (feature map)
  _shared/               prep-contract.ts (the frozen schemas), expected-yield.ts (pure scaling + variance), prep-flags.ts,
                         prep-run-serializer.ts (blind rule per role), prep-run-repository.ts, prep-constants.ts (15 / 35 / 3x / 24 h / 10 runs / 30 days)
  recipes/               #1-3     recipes-{routes,controller,service,repository,validators}.ts + types + tests
  record/                #4-7     (outputs, prep-again, check, record)
  runs/                  #8-10    (list, summary, detail)
  fix/                   #11-13   (correct, cancel, cancel-preview)
  review/                #14-17   (needs a look, count, mark reviewed, export)
frontend/features/inventory/prep/
  index.ts  _shared/     prep-contract.ts mirror, states-copy.ts (the step 23 copy table), run-status-chip, vs-usual chip, stepper, run-table, expected-yield note
  recipes/  record/  runs/  fix/  review/   (components/ hooks/ services/ lib/ types/ each)
```

| Slice | Back end | Front end | Needs |
|---|---|---|---|
| **0** Plan, contract, foundation (this session) | frozen contract + schema/migration A + capabilities + ledger reversal path + move prep writes onto the door | sidebar sub-links, active-node marker, badge support, nav-table rows | owner approval of this file |
| **1** Usual recipes | `expected-yield.ts` (pure, table-tested), recipes endpoints #1-3, audit "Recipe set/changed" rows | Step 24 list (search, Show, Changed, Clear filters), step 25 edit drawer, step 26 first recipe, step 27 read-only line on the Catalog item's Prep tab | slice 0 |
| **2** Record a run | endpoints #4-7, the door, flags, repeat and typo, idempotency, past-runs fallback | Attendant phone steps 1-8 and 39-40, tablet/computer steps 35-38 (live "This run" panel), manager New prep run drawer step 41; `/app/inventory/prep` becomes the new Runs home; old new-run screen deleted | slice 1 (expected figure) |
| **3** Fix a slip | endpoints #11-13, reversing rows, 24-hour rule | Attendant steps 13-16, 22; manager steps 17-18 (side-by-side drawer, cancel dialog) | slice 2 |
| **4** Oversight | endpoints #8-10 (full filters), #14-17, Audit log `PREP` area | Manager Runs with KPI strip and Needs a look band (step 10), review drawer (11), History (12) with Export CSV, sidebar badge live, audit step 19 entries | slice 3 |
| **5** Hardening and release | `ledger-guard` list final, DB checks | walk both roles at 390, 820 and 1440 against Paper; migration on a restored production copy; docs close-out; PR; deploy | all |

Runs list and detail (`#8`, `#10`) are cheap, so the Slice 2 back-end agent builds them fully (the Attendant's Recent runs needs them); Slice 4 adds the manager screens and the remaining endpoints.

**Tests, by class.** Unit (pure): expected-yield scaling and variance tiers (table), typo ratio, repeat key, window rule. Service (mocked repos, per-role payloads, blind rule): record, correct, cancel, review, recipes. Contract: sample payloads parse on both sides; capability grid per role. Database (`*.db.test.ts`, real Postgres, like `ledger-door.db.test.ts`): record writes N+1 ledger rows and the sum matches; correct and cancel net to zero per original row; a replayed key records one run; two concurrent corrects of one run leave one new run; backfill on a seeded old-shape table. Ledger guard: Prep's count goes from 2 to 0. Front end: component tests per screen state (loading, empty, error, locked), nav-table tests, `expected-yield` mirror table. Browser: the per-screen visual gate against Paper at the Paper anchors and spot checks, zero console errors (by eye plus computed styles; no pixel-diff).

**Retirement of old files** (deleted in the slice that replaces them, never left beside the new): Slice 2 deletes the old `prep-service.ts`, `prep-repository.ts`, `prep-controller.ts`, `prep-routes.ts`, `prep-validators.ts`, `prep.types.ts`, `prep-contract.test.ts`, `prep-service.test.ts` (their useful cases move into the new tests), old `GET /summary`, `/items/:id/typical-yield`, and the front end's `new-prep-run-screen.tsx`, `prep-runs-list-screen.tsx`, `use-new-prep-run-form.ts`, `use-typical-yield.ts`. Slice 3 and 4 delete `prep-run-detail-screen.tsx`, `prep-history-screen.tsx`, `use-prep-summary.ts`, `use-prep-run-detail.ts`, `use-prep-runs-list.ts`, the old `types/prep.ts` and `services/prep-api-service.ts`. Slice 5 deletes `DESIGN-NOTES.md` and this plan. The old `prep.prisma` comments are rewritten, not kept.

## 5. Scaling rule, written once

1. `expected = targetYield × (mainUsed ÷ recipeMainAmount)`, in the output's usage unit, rounded to 2 decimals for storage and shown rounded to a whole number for portions, one decimal for kg and L ("about 76 portions").
2. Tiers on `|made − expected| ÷ expected`: ≤15% on target; >15% warn (low or high) and manager flag; >35% also notify (in-app flag and badge only, no push).
3. Shared cases (both back end and front end test these): recipe 10 kg chicken → 38 portions: 5 kg → 19; 10 kg → 38; 20 kg → 76; 0 kg main → no expectation; made 72 vs 76 → on target; made 60 vs 76 → −21% warn low; made 380 vs 38 → typo suspect (>3x); made 12 vs 38 → typo suspect (<1/3).
4. No recipe, or the run does not use the recipe's main ingredient: expected = the mean of the last 10 `RECORDED` runs of that output or those in the last 30 days, whichever gives fewer; with none, `NONE` and the run is not judged.

## 6. Component inventory (Paper node per piece, per `UI_BUILD_RULES.md`)

Paper file `01M3TP8J54R83RHC9FJ7RAHGKG`, page "Inventory · Prep". Values come from `get_jsx` / `get_computed_styles` at build time, never from screenshots. Phone frames show a fake status bar (9:41): **do not build it** (UI rule 7a).

| Piece | Paper node | Reuse / build |
|---|---|---|
| Geometric sidebar with Prep sub-links, filled-square active node, count badge on Runs (open) or Prep (collapsed) | `1UZ1-0` (4 states), `MR1-0` on page "Inventory . Stock and Counting" | edit `sidebar-nav.tsx` (the shell); rows in `nav-table.ts` |
| Page shell, breadcrumb, top bar action | step 10 `7DF-0`, step 24 `1TAP-0` | existing app shell, `topbar.tsx`; button from `ui2/button` |
| KPI strip (Runs this week, Needs a look, Prep value) | `7DF-0` | hand-built on `ui2/card` (same strip as other Central Store screens) |
| Needs a look band with reason chips and Review | `7DF-0` | new `NeedsLookBand`; chips on `ui2/badge` |
| Runs table (When, Output, Inputs, Yield, Vs usual, Unit cost, By), "yours" tag, row tint when flagged | `7DF-0`, step 36 `1UAA-0` | `ui2/table`; shared `RunTable` with a column set per role |
| History filters (search, output, person, status, from, to) and pager "Showing 8 of 31" | step 12 `7RL-0` | `ui2/search-input`, `ui2/select`, date inputs; page-based pager |
| Run drawers: review (11), corrected side-by-side (17), recipe edit (25), manager New prep run (41) | `7JM-0`, `87R-0`, `1TFH-0`, `1UPP-0` | `ui2/sheet`; one `RunDrawer` shell |
| Cancel dialog with below-zero warning | step 18 `8FN-0` | `ui2/confirm-dialog` |
| Prep-again tiles, "Something else" | steps 1-2 `6Q0-0`, `6S9-0`; step 36 `1UAA-0` | new `PrepAgainTile`; picker on `ui2/sheet` (phone) and `ui2/combobox` (desktop) |
| Stepper (− number +, unit-aware step, tap to type) | step 39 `1UL4-0`, 41 `1UPP-0`, rule table `1UXT-0` | new `PrepStepper` (0.5 for kg and L, 1 for portions), numeric keypad |
| Expected-yield note and live yield check (green/amber/red wording) | steps 6, 39, 37 | new `ExpectedYieldNote` |
| Confirm sheet (phone) and "This run" panel (tablet and computer) | step 4 `6XV-0`, step 37 `1UF2-0` | one `RunSummaryPanel`; sheet on phone, side panel at ≥ tablet |
| Reason chips (yield, correct, cancel, recipe change) | steps 7, 14, 16, 25 | `ui2/toggle-group` |
| Run recorded, flagged for review, warnings (repeat dialog, typo), locked run ("Ask the Store Manager") | steps 5, 8, 20, 21, 22 | `ui2/confirm-dialog`, inline notes |
| Run status chip and Vs usual chip | `7DF-0`, `7RL-0` | `ui2/status-dot` + text |
| Usual recipes list with filters; empty/filtered-empty/error rows | step 24 `1TAP-0`, step 42 `1UXT-0` | `ui2/table`, `ui2/search-input`, `ui2/select`; "Clear filters" link |
| First recipe with "Use these" | step 26 `1TMD-0` | variant of the recipe drawer |
| Catalog item Prep tab read-only recipe line | step 27 `1TVE-0` | new `RecipeLine` inside the existing catalog item page |
| Loading, empty, error, permission states | step 23 `8ZX-0` | `shell-states.tsx` plus per-screen skeletons; copy table in `_shared/states-copy.ts`; `(shell)/loading.tsx` next to the Prep layout |
| Attendant phone shell (back chevron header, no bottom tabs) | steps 39, 40, 13 | `mobile-headers.tsx` / `mobile-topbar.tsx` (no status bar) |

Responsive: Paper draws 390, 820 and 1440 for the Attendant; verify those and spot-check 768 and 1024. The Attendant on a computer uses the same components reflowed (no centred phone column); the manager is desktop-only (Chapter 9 parked).

## 7. Production check (7 Oct 2026, read-only, `ssh wendo`, run by me with the owner's permission)

**Results**
- `prep_runs` **0**, `prep_run_input_lines` **0**, prep ledger rows **0**, ledger rows linked to a run **0**. Nobody has recorded a Prep run in production.
- 25 live prepped items, none ever made. No runs on any site, no flag data, so there is nothing to backfill: **migration A's backfill is a no-op in production** (it is still tested locally on seeded old-shape rows, because the SQL must be right).
- Ledger types in use: `RECEIVE` 10, `DISPATCH_IN` 7. Reference counters: `DAY` and `SUPPLIER` only, so `PREP` starts at 1 on the first run.
- Latest applied migration: `20261006140000_drop_old_purchasing` (2026-10-07). One old row, `20260510025111_redesign_payslip_fields`, shows no finish time but has `rolled_back_at` set (a May failure, recovered; 87 of 88 rows finished). It is not an open failure and does not block `migrate deploy`.
- Consequences: no legacy-run compatibility is needed at release, so migration B (drop `typical_yield_at_run_time`) can ride in the same release instead of a later PR; the "old flow keeps running" concern reduces to branch tests only. Production go-live note, as for Purchasing: PINs are not needed for Prep (no PIN anywhere in Prep), but an Attendant and a Store Manager account must exist on the hub site.

The queries used (kept for re-runs):

```sql
-- 1. Row counts
SELECT (SELECT count(*) FROM prep_runs)                 AS prep_runs,
       (SELECT count(*) FROM prep_run_input_lines)      AS prep_run_input_lines,
       (SELECT count(*) FROM inventory_transactions WHERE type IN ('PREP_CONSUME','PREP_PRODUCE')) AS prep_ledger_rows,
       (SELECT count(*) FROM inventory_transactions WHERE prep_record_id IS NOT NULL)              AS rows_linked_to_a_run;

-- 2. Runs per site and per month (are there runs on any site other than the hub?)
SELECT organization_id, to_char(date_trunc('month', created_at), 'YYYY-MM') AS month, count(*) AS runs
FROM prep_runs GROUP BY 1, 2 ORDER BY 2, 1;

-- 3. Prepped items: how many exist, how many have ever been made
SELECT count(*) FILTER (WHERE type = 'PREPPED' AND deleted_at IS NULL) AS live_prepped_items,
       count(*) FILTER (WHERE type = 'PREPPED' AND deleted_at IS NULL
                        AND id IN (SELECT output_item_id FROM prep_runs)) AS prepped_items_with_runs
FROM inventory_items;

-- 4. The old flag columns: what the backfill will carry over
SELECT yield_variance_label, notified_store_manager, count(*) AS runs,
       count(typical_yield_at_run_time) AS with_typical
FROM prep_runs GROUP BY 1, 2 ORDER BY 3 DESC;

-- 5. Enum usage and the current reference counters
SELECT type, count(*) FROM inventory_transactions GROUP BY type ORDER BY 2 DESC;
SELECT organization_id, prefix, last_number FROM reference_counters ORDER BY prefix;

-- 6. Latest applied migration (must be ...ledger_append_only_trigger or later)
SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 3;
```

(Local database: 0 runs, 0 prep ledger rows, 27 live prepped items. The production figures decide how big the backfill is.)

## 8. Decisions (owner, 7 Oct 2026: "go with your recommendation as the default for all of them")

Q-1 old run `CORRECTED`, new run `RECORDED` with a "Corrected run" tag. Q-2 a cancel leaves the output cost unchanged. Q-3 old flagged runs are not pushed into Needs a look (moot: production has none). Q-4 one migration for the whole rebuild, generated in Slice 0. Q-5 new capability `prep.see_costs`. **All five settled as recommended.** Migration B (drop `typical_yield_at_run_time`) moves into the same migration as A, since production has no runs to protect (section 1.4 table, row B, is superseded by this).

## 8a. The questions as asked (kept for the record)

- **Q-1. Which run is "Corrected"?** I label the **old** (superseded) run `CORRECTED` and the new one `RECORDED` with a "Corrected run" tag, as Paper step 17 shows. Fine?
- **Q-2. Cancelling the latest run of an item:** the output cost stays as it is (only a *correction* of the latest run updates it). Or should a cancel put back the previous run's cost?
- **Q-3. Old flagged runs** are not put into Needs a look on day one (the queue starts empty). Fine?
- **Q-4. One migration for the whole rebuild, generated in Slice 0** (so the two agents in each slice never collide), instead of one per slice. Fine?
- **Q-5. New capability `prep.see_costs`** (run costs hidden from the Attendant, shown to every desktop role) rather than reusing `payables.read`. Fine?

If you answer "all fine", I go ahead with Part 2 exactly as written above.
