# Stock, Counting and Waste rebuild: the frozen contract

Written 8 Oct 2026 by the orchestrator (Stage 2). **Status: frozen on owner approval of the build briefs; nothing built yet except the pieces listed in §12.** Sources: the Paper page "Inventory · Counting redesign (Oct 7)" (steps 1 to 29, 24B, 24C, 40 to 51, Screens index), `stock-count-waste-needs.md` (what each screen needs), `counting-stock-waste-plan.md`, `counting-redesign.md`, `decisions.md`, `central-store-access.ts`, `FEATURE_REDO_PLAYBOOK.md` §9, `CODING_STANDARDS.md` §4 and §9, the Purchasing and Prep plans.

Frozen in code (do not change a shape without an owner-approved amendment, `FEATURE_REDO_PLAYBOOK.md` step 5):

| What | Back end | Front-end mirror |
|---|---|---|
| Wire primitives | `modules/inventory/_shared/wire.ts` | `features/inventory/_shared/types/wire.ts` |
| Counting, 30 endpoints (C1 to C30) | `counting/_shared/counting-contract.ts` + `.fixtures.json` + `.test.ts` | `counting/_shared/types/counting-contract.ts` + identical fixtures + test |
| Stock, 5 endpoints (S1 to S5) | `stock/_shared/stock-contract.ts` + fixtures + test | `stock/_shared/types/stock-contract.ts` + fixtures + test |
| Waste, 4 endpoints (W1 to W4) | `waste/_shared/waste-contract.ts` + fixtures + test | `waste/_shared/types/waste-contract.ts` + fixtures + test |
| Capability rows | `_shared/central-store-access.ts` (+ `stock-count-waste-access.test.ts`) | `_shared/lib/capabilities.ts` (names only) |
| State copy | | `{counting,stock,waste}/_shared/lib/states-copy.ts` |
| Route mounts | `routes/index.ts`, `counting/counting-routes.ts`, `stock/stock-hub-routes.ts`, `waste/waste-hub-routes.ts`, 12 placeholder folder routers | |

Owner decisions that shape it (8 Oct 2026): the Manager's own count applies every line at signing; no PIN on waste reversal; "Log a missing movement" and "Ask for a recount" write nothing; first sections seeded from suppliers with the rest in "Others"; Director has *flagged* lines (Mark seen) and an *alert* (push only, no inbox row); one open count per person and a section in only one open count; the four design defaults. See `stock-count-waste-needs.md` §8, where the remaining "needs owner decision" items N1 to N10 also have their defaults.

## 1. Production read-only check (8 Oct 2026, `ssh wendo`, SELECTs only, run in a `READ ONLY` transaction)

| Table | Production | Local dev |
|---|---|---|
| `stock_counts`, `stock_count_lines` | **0, 0** (no open counts) | 0, 0 |
| `waste_logs` | **0** | 0 |
| `counting_thresholds` | **0** (the code defaults apply: KES 500 reason, KES 5,000 Director alert) | 3 rows (hub 300 / 1,500; two branches 400 / 300) |
| `inventory_transactions` | 17 rows: `RECEIVE` 10, `DISPATCH_IN` 7; **none** linked to a count line, a waste log or an ADJ; no `ADJUSTMENT` rows | 101 rows: `RECEIVE` 49, `PREP_CONSUME` 29, `PREP_PRODUCE` 19, `DISPATCH_OUT` 4 |
| `reference_counters` | `DAY` ×3, `SUPPLIER`; **no `CNT`, `ADJ`, `PREP`** yet | has `GRN`, `LPO`, `PAY`, `PREP`, `SUPPLIER` |
| Items | 216 live, **69 with a preferred supplier, 7 suppliers used** | 221 live, 71 with a supplier, 8 suppliers |
| Latest migration | `20261007120000_prep_rebuild` | same |
| PINs (active users with a PIN set) | System Admin 0 of 1, Directors 0 of 6, Store Manager 0 of 1, Store Attendants 0 of 3, Accountants 1 of 2 | |

Consequences: **nothing to convert.** The old count and waste tables hold no rows in production, so the contract migration can drop them outright; the new tables start empty except the seeded sections (§2.7). `CNT` and `ADJ` counters start at 1. **Go-live blocker, not a build item:** counting and approving need a PIN and **nobody who counts or approves has one**: set PINs for the Store Manager, the System Admin and the three Attendants before the flow can be used (Director needs none: Mark seen has no PIN). Local data to discard: nothing (0 counts, 0 waste).

## 2. Data model and migration (expand, then contract)

One migration for the whole rebuild, written and applied locally by the counting back-end session as its **first commit** (§10), then merged into `feat/stock-count-waste` so the other sessions start from it. Schema files: new `backend/prisma/schema/inventory/counts.prisma`; additive edits to `waste.prisma`, `counting.prisma` (thresholds only) and `stock.prisma` (one ledger column). **Expand now, contract at release:** the old tables, enums and the `stock_count_line_id` ledger column are dropped in a *second* migration at Stage 4, after the new flow works and the old code is deleted. Never `prisma migrate dev` on production; generate locally, commit, apply with `migrate deploy`; test the migration on a restored production copy before the release.

Prefix for every table below: column `organization_id` is the site (`siteId`); every query carries it. Decimals `Decimal(12,4)` for quantities, `(12,2)` for KES. Names are `snake_case` with `@map`.

### 2.1 Counts (new)

```
enum CountStatus        { OPEN SUBMITTED APPROVED }
enum CountLineResult    { MATCHES WITHIN_RANGE EXCEEDS NOT_COUNTED }       // frozen at the counter's sign
enum CountRecheck       { NONE RECOUNTED KEPT }
enum CountCause         { PREP_NOT_LOGGED SPOILAGE MISCOUNT LOSS OTHER }
enum CountMovementKind  { DISPATCH PREP_USE DELIVERY WASTE }
enum CountDecisionKind  { PENDING ACCEPTED WRITE_OFF MOVEMENT_LOGGED RECOUNT_ASKED }

Count            id, siteId, locationId (the Central Store), reference String  @@unique([siteId, reference]),
                 status CountStatus @default(OPEN), counterId, startedAt, signedAt?, approvedAt?, approverId?,
                 selfSigned Boolean,                      // the counter is the Manager who signed: APPROVED on sign, no approval step
                 recountOfLineId String? (FK CountLine),  // "Count again": this count links back to the old line
                 expectedAsOf DateTime?,                  // the counter's sign time: the instant expected stock is frozen at
                 rangeKes Int?, rangePercent Decimal(5,2)?, directorAlertKes Int?, flagRepeat Boolean?,   // the settings in force at the sign
                 idempotencyKey String?  @@unique([siteId, counterId, idempotencyKey]),
                 createdAt, updatedAt
                 @@index([siteId, status, startedAt]) @@index([counterId])
                 PARTIAL UNIQUE (raw SQL):  one OPEN count per person  ON (organization_id, counter_id) WHERE status = 'OPEN'

CountScopeSection  id, countId, sectionId?, sectionName String      // what was picked (name frozen); none for an item-scoped (recount) count
CountLine        id, siteId, countId, inventoryItemId, sectionId?, sectionName?, position Int,
                 countedQty Decimal?, skipped Boolean @default(false),
                 recheck CountRecheck @default(NONE), firstCountedQty Decimal?, recheckOffered Boolean @default(false),
                 isOpen Boolean,                          // denormalised: true while the count is OPEN
                 // frozen at the counter's sign (null until then):
                 expectedQty Decimal?, unitCost Decimal(12,4)?, result CountLineResult?, shortStreak Int @default(0),
                 // the Manager's decision:
                 decision CountDecisionKind @default(PENDING), cause CountCause?, causeNote String?, movementKind CountMovementKind?,
                 decidedById?, decidedAt?,
                 // the Director:
                 directorFlagged Boolean @default(false), directorAlert Boolean @default(false), directorSeenAt?, directorSeenById?,
                 createdAt, updatedAt
                 @@unique([countId, inventoryItemId]) @@index([inventoryItemId, createdAt]) @@index([siteId, directorFlagged, directorSeenAt])
                 PARTIAL UNIQUE (raw SQL):  an item is in at most one OPEN count  ON (organization_id, inventory_item_id) WHERE is_open
```
`transactions InventoryTransaction[]` hangs off `CountLine` through the new ledger column (§2.5). A line has **no stored difference**: difference, percent and value are computed from `countedQty`, `expectedQty` and `unitCost` (one function, `variance-calc.ts`).

### 2.2 Sections and layout (new)

```
enum CountSectionKind { SUPPLIER MANUAL }
CountSection        id, siteId, name String, kind, supplierId? (FK Supplier), position Int, createdAt  @@unique([siteId, name])
CountSectionItem    id, siteId, sectionId, inventoryItemId, position Int, addedById?, addedAt
                    @@unique([siteId, inventoryItemId])            // an item is in at most ONE section
CountItemMove       id, siteId, inventoryItemId, fromSectionId?, toSectionId, movedById, movedAt, undoneAt?, undoneById?
                    // logged for every move; the Manager's undo restores `fromSectionId` and stamps `undone*`
CountDayOrder       id, siteId, userId, day Date (Nairobi), sectionIds String[]   @@unique([siteId, userId, day])
                    // one person's own order for today only; a stale day is simply ignored
CountSetupVisit     siteId, userId, lastVisitAt   @@id([siteId, userId])        // "moved since your last visit"
```
"Last counted" per section and per item is **derived** (max signed time of a counted line), not stored. Section order and item order use `position`; "Save order" rewrites positions in one transaction.

### 2.3 Settings (additive columns on `counting_thresholds`)

`range_percent Decimal(5,2) NOT NULL DEFAULT 5` and `flag_repeat_shortfalls Boolean NOT NULL DEFAULT true`. The existing `reason_required_kes` is the range's "Worth up to" KES; `director_alert_kes`, `updated_by_id`, `director_updated_by_id/at` are reused. The branch rows keep working for branch day, unchanged. Defaults when the hub has no row: KES 500, 5 %, repeat shortfalls on, Director alert KES 5,000.

### 2.4 Waste (additive columns on `waste_logs`, one new table)

```
enum WasteReversalReason { WRONG_ITEM WRONG_QUANTITY OTHER }
WasteBatch   id, siteId, userId, idempotencyKey, createdAt   @@unique([siteId, userId, idempotencyKey])    // "Log 2 items" is one batch
waste_logs + batch_id (FK WasteBatch)?, reversed_at?, reversed_by_id?, reversal_reason WasteReversalReason?, reversal_note String?
```
An entry is REVERSED when `reversed_at` is set. The original row and its WASTE ledger row stay; a linked reversing ledger row returns the stock (§7).

### 2.5 Ledger link (additive column on `inventory_transactions`)

`count_line_id String? @map("count_line_id")` with a foreign key to `count_lines` **ON DELETE SET NULL** (the same shape as every other link; the append-only trigger already blocks deleting a source document that a ledger row points at, so a signed count line can never be deleted). Index on it. `LEDGER_LINKS` gains `countLineId`; `ADJUSTMENT` accepts it beside `stockCountLineId` (which stays until the contract migration). `findLinkOwnerSites` in `ledger-repository.ts` learns `countLineId` (same change, with `ledger-door.db.test.ts`).

### 2.6 Reference numbers

`CNT` counter per site, gap-free, taken in the same transaction as the count (`referenceCounterRepository`, with one new additive `nextNumber` that returns the integer). The reference is `CNT-{year of start}-{number padded to 4}`: the number never resets with the year. The Paper numbers (CNT-2026-1013) are mock; production starts at `CNT-2026-0001`. Adjustments are numbered `ADJ-nnnn` by the door, as today. Waste entries are not numbered.

### 2.7 First sections (the seed inside the migration)

In SQL, for the hub site only: (1) one `SUPPLIER` section per supplier that has at least one live item whose `preferred_supplier_id` is that supplier (name = the supplier's name, ordered by name); (2) one `MANUAL` section **"Others"** holding every live item with no preferred supplier; (3) one empty `MANUAL` section **"Packaging"**. Retired items (`deleted_at` set) get no row. Positions follow the order above. Production gets 7 supplier sections, "Others" with about 147 items, and an empty "Packaging"; the Manager reorganises in Count setup. Tested locally on the 221-item database and on a restored production copy at release. **Later:** a new catalog item with a preferred supplier whose section exists lands in that section; a new item with no supplier lands in "Not in any section" (the catalog's create path calls the counting back end's `placeNewItem(itemId)`, exported through `modules/inventory/index.ts`; the counting session builds it, the catalog is not edited: see §10 coupling).

### 2.8 Migration plan

| Migration | When | Contents |
|---|---|---|
| **A `stock_count_waste_expand`** | counting back-end session, first commit | everything in 2.1 to 2.5 (new tables, enums, additive columns, the two partial unique indexes, the ledger column and its FK) and the section seed in 2.7. No existing row is touched. |
| **B `stock_count_waste_contract`** | Stage 4 (orchestrator), after the old code is deleted and the combined branch passes | drop `stock_counts`, `stock_count_lines`, enums `StockCountKind`, `StockCountStatus`, `CountLineDecision`, `CountReason`, and the ledger column `stock_count_line_id` (with its FK and index). `CountingThresholds` stays. |

## 3. Access: capability rows (`central-store-access.ts`, landed)

Eleven new capabilities. **Read for every desktop role; write by job.** The client has not approved role names, so every row is a one-row edit.

| Capability | Meaning | Held by |
|---|---|---|
| `stock.read` | Overview, All items, Stock ledger, Stock card; costs follow `catalog.see_costs` | Store Manager, System Admin, Accountant, Director, Branch Manager. **Not the Attendant** |
| `counts.read` | every count with expected stock, differences, the Director's flagged lines | same five |
| `counts.record` | start a count, count, sign it with the caller's PIN, recount; the Attendant's reorder for today and item moves | Store Manager, System Admin, **Store Attendant** |
| `counts.resolve` | decide lines, approve and sign a submitted count (PIN), ask for a recount | Store Manager, System Admin |
| `counts.setup` | sections, order, items, undo a move, the within-range settings | Store Manager, System Admin |
| `counts.acknowledge` | "Mark seen" | Director, System Admin |
| `counts.set_director_alert` | the Director alert amount | Director, System Admin |
| `waste.read` | every waste entry | the five desktop roles; the **Attendant, own entries only** (a service rule) |
| `waste.log` | log waste at the Central Store | Store Manager, System Admin, Store Attendant |
| `waste.reverse_own` | reverse an entry the caller logged earlier the same Nairobi day | Store Attendant (and the Manager and Admin, who hold both reverse rows) |
| `waste.reverse_any` | reverse any entry | Store Manager, System Admin |

The Store Manager inherits "everything" **except** `counts.acknowledge` and `counts.set_director_alert` (a named list `NOT_THE_STORE_MANAGERS` in the table). Accountant and Branch Manager hold the three reads and nothing else here. The Director's only writes in this feature are Mark seen and the alert amount. Routes use `requireCapability(...)`, reads resolve the site with `requireHubReader`, writes with `requireHubActor`. **Never a `requireRole(...)` list.** A department head's branch waste is unchanged and outside this table.

### 3.1 Role by endpoint (R read, W write, own = own records only, — = 403)

| Endpoint | SM | SA (admin) | DIR | ACC | BM | AT |
|---|---|---|---|---|---|---|
| C1 summary, C2 list, C3 flagged, C4 repeat shortfalls | R | R | R | R | R | — |
| C5 detail (`counts.read`, or `counts.record` on own count) | R | R | R | R | R | own |
| C6 record print | R | R | R | R | R | — |
| C7 blank sheet | R | R | R | R | R | R |
| C8 to C14 take a count (`counts.record`) | W | W | — | — | — | W (own) |
| C15, C16 Count setup reads, C23, C24 settings reads | R | R | R | R | R | — |
| C17 to C20, C22 Count setup writes, C25 range (`counts.setup`) | W | W | — | — | — | — |
| C21 move an item (`counts.record`) | W | W | — | — | — | W |
| C26 Director alert amount | — | W | W | — | — | — |
| C27 to C29 decide, preview, approve (`counts.resolve`) | W | W | — | — | — | — |
| C30 Mark seen (`counts.acknowledge`) | — | W | W | — | — | — |
| S1 to S5 stock (`stock.read`) | R | R | R | R | R | — |
| W1, W2 log waste (`waste.log`) | W | W | — | — | — | W |
| W3 list (`waste.read`) | R | R | R | R | R | own |
| W4 reverse | any | any | — | — | — | own, same day |

The route-by-role test (`*-routes.test.ts`, one per sub-module) asserts this grid for every endpoint with the six roles, plus a non-hub actor refused on every write.

## 4. API: base paths and the endpoint table

Base `/api/v1`. Envelope `{ success, data }`. Wire rules in `_shared/wire.ts`. All Counting and Stock endpoints are under **`/inventory/stock`**, all Waste under **`/inventory/stock/waste`**; none of the new paths is shared with an old one (the old routers stay mounted until release and are deleted then). Every route: `authenticate` + `requireCapability(...)`; every service starts with `requireHubReader` or `requireHubActor`; every query carries `siteId`. Every endpoint has a Zod schema in the frozen contract files.

### 4.1 Counting (`counting/`)

| # | Method and path | Folder | Capability (+ service rule) | Request, response (contract schema) |
|---|---|---|---|---|
| C1 | `GET /counts/summary?audience=` | counts | `counts.read` | `countsSummary`. Manager strip (Waiting for you, In progress, Exceeded the range 7 days, Longest without a count) or the Director's (Flagged to you, Net difference 7 days, Short 3 counts running, Longest without a count); chosen by capability, `audience` lets the Admin pick |
| C2 | `GET /counts?status=&search=&page=&pageSize=` | counts | `counts.read` | `countsList` (rows, chips, page). `differencesText` needs `restock.read` |
| C3 | `GET /counts/flagged?page=&pageSize=` | counts | `counts.read` | `flaggedList` |
| C4 | `GET /counts/repeat-shortfalls?page=&pageSize=` | counts | `counts.read` | `repeatShortfallList` |
| C5 | `GET /counts/:id` | counts | `counts.read`, or `counts.record` and the caller is the counter | `countDetail`. **Registered last.** |
| C6 | `GET /counts/:id/print` | print | `counts.read` | `countRecordPrint` |
| C7 | `GET /counts/blank-sheet` | print | `counts.read` or `counts.record` | `blankSheet` (no stock figures) |
| C8 | `GET /counts/start-options?recountLineId=` | record | `counts.record` | `startOptions` |
| C9 | `POST /counts` | record | `counts.record` | `startCountInput` → `countDetail` (201; a repeated `idempotencyKey` returns the same count with 200). Errors `YOU_HAVE_OPEN_COUNT`, `SECTION_BUSY`, `NOTHING_TO_COUNT`, `RECOUNT_NOT_ALLOWED` |
| C10 | `PUT /counts/:id/lines` | record | `counts.record`, the counter, count OPEN | `saveLinesInput` → `saveLinesResult`. Last write wins; `skipped` and a number cannot both be set |
| C11 | `POST /counts/:id/check` | record | `counts.record`, the counter, OPEN | `checkInput` → `checkResult`. Returns the lines that exceed the range **by name and typed number only**; for a caller with `restock.read` it returns none (they see results live). Marks each returned line `recheckOffered` |
| C12 | `GET /counts/:id/sign-preview` | record | `counts.record`, the counter, OPEN | `signPreview` |
| C13 | `POST /counts/:id/sign` | record | `counts.record`, the counter, OPEN. Own PIN | `signInput` → `countDetail`. Attendant: OPEN → SUBMITTED. Manager (holds `counts.resolve`): OPEN → APPROVED and adjustments post. Errors `INVALID_PIN`, `NOTHING_COUNTED`, `CAUSE_REQUIRED`, `COUNT_NOT_OPEN` |
| C14 | `PUT /counts/section-order/today` | record | `counts.record` | `sectionOrderInput` → `sectionOrderResult` |
| C15 | `GET /count-setup` | setup | `counts.read` | `setupView`. Stamps `CountSetupVisit` for "moved since your last visit" |
| C16 | `GET /count-setup/sections/:id/items` (`unsectioned` allowed) | setup | `counts.read` | `sectionItems`, whole section, no pager |
| C17 | `POST /count-setup/sections` | setup | `counts.setup` | `addSectionInput` → `setupView`. `SECTION_NAME_TAKEN` |
| C18 | `PUT /count-setup/layout` | setup | `counts.setup` | `layoutInput` → `setupView`. 409 `LAYOUT_CHANGED` when `version` is stale. A section is a `SUPPLIER` section (name and supplier fixed) or `MANUAL`; items moved between sections here are logged as the Manager's moves |
| C19 | `GET /count-setup/add-items?...` | setup | `counts.setup` | `addItemsList` (search as you type, filters, numbered pager) |
| C20 | `POST /count-setup/sections/:id/items` | setup | `counts.setup` | `addItemsInput` → `setupView`. Items in another section move (logged) |
| C21 | `POST /count-setup/items/:itemId/move` | setup | `counts.record` | `moveItemInput` → `moveView`. Applies at once, is logged. An item inside an OPEN count keeps its place in that count |
| C22 | `POST /count-setup/moves/:id/undo` | setup | `counts.setup` | → `setupView`. `MOVE_ALREADY_UNDONE` |
| C23 | `GET /count-settings` | settings | `counts.read` | `countSettings` |
| C24 | `GET /count-settings/preview?rangeKes=&rangePercent=&directorAlertKes=` | settings | `counts.read` | `settingsPreview` (last 7 days of signed counts, recomputed with the proposed numbers) |
| C25 | `PUT /count-settings` | settings | `counts.setup` | `updateSettingsInput` → `countSettings`. Applies from the next signed count |
| C26 | `PUT /count-settings/director-alert` | settings | `counts.set_director_alert` | `updateDirectorAlertInput` → `countSettings` |
| C27 | `POST /counts/:id/decisions` | review | `counts.resolve`, count SUBMITTED | `decisionInput` → `countDetail`. One line, several lines, or `group: WITHIN_RANGE`. `CLEAR` takes a decision back. Only outside-range lines take WRITE_OFF, MOVEMENT_LOGGED or RECOUNT_ASKED; only within-range lines take ACCEPTED. `COUNT_NOT_SUBMITTED` |
| C28 | `GET /counts/:id/approve-preview` | review | `counts.resolve`, SUBMITTED | `approvePreview` |
| C29 | `POST /counts/:id/approve` | review | `counts.resolve`, SUBMITTED. Own PIN | `approveInput` → `countDetail`. `LINES_UNDECIDED`, `INVALID_PIN` |
| C30 | `POST /counts/seen` | review | `counts.acknowledge` | `seenInput` → `{ seen }`. Only lines with `directorFlagged` |

### 4.2 Stock (`stock/`), all `stock.read`

| # | Method and path | Folder | Response |
|---|---|---|---|
| S1 | `GET /overview` | overview | `stockOverview` |
| S2 | `GET /items?search=&status=&categoryId=&type=&departmentTag=&sectionId=&page=&pageSize=` | items | `stockItemsList` |
| S3 | `GET /ledger?from=&to=&search=&sectionId=&chip=&page=&pageSize=` | history | `ledgerList` |
| S4 | `GET /ledger/export?...` | history | CSV, every row, at most 10,000 (413 `EXPORT_TOO_LARGE`). Registered **before** S5 |
| S5 | `GET /ledger/:itemId?from=&to=&show=&chip=` | history | `stockCard` |

Status of an item (S2, S5): `NEGATIVE` when on hand < 0; `OUT` when on hand = 0 and a restock level is set; `LOW` when 0 < on hand < restock level; else `OK`. Chip "Low or out" counts LOW + OUT. The restock level is the Central Store's `RestockLevel`.

### 4.3 Waste (`waste/`), base `/inventory/stock/waste`

| # | Method and path | Folder | Capability (+ service rule) | Request, response |
|---|---|---|---|---|
| W1 | `GET /waste/items?search=&limit=` | log | `waste.log` | `wasteItems` (`often` = this person's most logged, up to 6) |
| W2 | `POST /waste` | log | `waste.log` | `logWasteInput` → `logWasteResult` (201; a repeated `idempotencyKey` returns the same batch with 200). One transaction: one `WasteLog` + one WASTE ledger row per entry through the door; negative stock allowed and flagged, never blocked |
| W3 | `GET /waste?period=&scope=&search=&page=&pageSize=` | entries | `waste.read` (Attendant: own only, whatever `scope` says) | `wasteList` |
| W4 | `POST /waste/:id/reverse` | reverse | `waste.reverse_any`, or `waste.reverse_own` on an entry the caller logged earlier the same Nairobi day. **No PIN** | `reverseWasteInput` → `wasteEntry`. `NOT_YOUR_ENTRY`, `REVERSAL_WINDOW_PASSED`, `ALREADY_REVERSED` |

A Department Head's waste keeps the three old endpoints (`GET /inventory/waste/items`, `GET`/`POST /inventory/waste`) unchanged until release, when `waste-routes.ts`, its controller, service, repository, validators, types and tests move **unchanged** into `waste/department/`.

## 5. The count state machine

```
                 C9 start                       C13 sign (Attendant)                 C29 approve
   (none) ──────────────▶ OPEN ───────────────────────────────▶ SUBMITTED ─────────────────────▶ APPROVED
                            │   C13 sign (Manager, counts.resolve)                                   ▲
                            └──────────────────────────────────────────────────────────────────────┘
                                         selfSigned = true: adjustments post on this transition
```
There is no way back: a signed count is never edited (a wrong line is counted again, §5.5). There is no cancel (needs owner decision N5; deferred).

### 5.1 Starting (C9)
One transaction: `requireHubActor`; lock the picked section rows; refuse `YOU_HAVE_OPEN_COUNT` if the caller has an OPEN count (the partial unique index is the backstop); refuse `SECTION_BUSY` if any item of the scope has an open line (the other partial unique index; the message names who); allocate `CNT-…`; copy one `CountLine` per item in the scope, in shelf order (the caller's order for today when set, else the Manager's), with `sectionName` frozen. An item-scoped count (recount) is one line per picked item.

### 5.2 Counting (C10, C11)
A line's `countedQty` is a non-negative decimal or null; `skipped` is the deliberate Skip. Typing a number clears `skipped`; Skip clears the number. The **section-end check** (C11) is offered **once** per line: it returns the lines that exceed the range (judged against the settings in force **now**) for a caller blind to stock, marks them `recheckOffered`, and a line is never offered again. The save that follows sets `recheck` to `RECOUNTED` (a new number; `firstCountedQty` keeps the old one) or `KEPT`. For a caller with `restock.read` (the Manager counting herself) the live result per line comes back from C10 instead (Paper step 13).

### 5.3 Signing (C13), the moment figures are frozen
In one transaction: verify the caller's **own** PIN (`INVALID_PIN` for a wrong or missing PIN, saying nothing about which; the System Admin signs with their own PIN); require at least one number (`NOTHING_COUNTED`); set `signedAt`, `expectedAsOf = signedAt`; for every line: freeze `expectedQty` = ledger on-hand at `signedAt` (Σ quantity of that item at the Central Store with `createdAt ≤ signedAt`), `unitCost` = the item's current cost, `result`, `shortStreak`; freeze the settings in force on the `Count`; set `isOpen = false` on every line. Then:
- **Attendant:** status SUBMITTED; push to the Store Manager ("Linnet submitted CNT-… · 36 items counted").
- **Manager (holds `counts.resolve`):** every outside-range line needs a cause in `causes` (`CAUSE_REQUIRED`; default N1: the chips in the sign dialog); `selfSigned = true`, `approverId` = herself, status APPROVED, and **every non-zero line posts** (§7), outside-range lines flagged to the Director (§5.7). One transaction: all the adjustments or none.

### 5.4 Judging a line (`variance-calc.ts`, one function, table-tested, shared by both sides' words)
`difference = counted − expected`; `value = difference × unitCost` (KES, 2 dp); `percent = |difference| ÷ expected × 100`. A line is
- `NOT_COUNTED` when it has no number (skipped); never adjusted, never judged;
- `MATCHES` when `difference = 0`;
- `WITHIN_RANGE` when **both** `|value| ≤ rangeKes` **and** `percent ≤ rangePercent` (ties are within range: the settings read "worth up to" and "at most"); when `expected ≤ 0` the percent test cannot pass, so any non-zero difference is `EXCEEDS`;
- `EXCEEDS` otherwise.
While the count is OPEN the live result uses the live range and live expected figure (Paper step 13's "Over 5%, so it will exceed" is `percent > rangePercent` with value inside). `shortStreak` = consecutive signed counts, newest first, in which this item had `difference < 0`, including this one (only with the repeat-shortfall setting on; otherwise 0). A streak of 3 or more makes the item a **repeat shortfall** (C4, Director KPI).

### 5.5 Reviewing (C27 to C29)
Only a SUBMITTED count. The Manager sees every line. Outside-range lines need a decision before approval; within-range lines are accepted (singly or as a group); skipped lines need nothing.
- `WRITE_OFF` + cause (OTHER needs a note): the line will post an adjustment equal to its difference.
- `MOVEMENT_LOGGED` + kind: **writes nothing**; the line reads "Movement logged · Dispatch". The real movement is logged in its own flow and explains the gap (owner, 8 Oct 2026).
- `RECOUNT_ASKED`: **writes nothing**; the line reads "Recount asked"; the screen takes her to Start a count with the item picked (C8 `recountLineId`, C9 `recountOfLineId`). The recount is a new count, reviewed on its own. (Whoever starts it counts it: the Manager or an Attendant.)
- `ACCEPTED`: a within-range line, writes a small adjustment on approval. `CLEAR` removes a decision.
`approve.can` is true when `toDecide = 0`. **C29** verifies the Manager's own PIN and, in one transaction, posts one `ADJUSTMENT` per non-zero `WRITE_OFF` and `ACCEPTED` line (§7), sets APPROVED, `approvedAt`, `approverId`, flags and alerts (§5.7). "Count again" on an approved count is C9 with `recountOfLineId`; the new count's expected stock already includes the first count's adjustment.

### 5.6 Section busy, one count per person, many a day
Two people count different sections at once; one person has one open count; an item is in one open count. Many counts a day are normal. Starting a count with an item or section already counted today is allowed (Spot count is gone).

### 5.7 The Director: flagged lines and the alert
- **Flagged** (`directorFlagged`): every `EXCEEDS` line of a count the Manager signs herself (selfSigned). It shows in C3 under "Flagged to me" until `counts.acknowledge` marks it seen (`directorSeenAt/By`). Lines of an Attendant's count that the Manager approves are *not* flagged by this rule (the Manager reviewed them); they are flagged only through the alert.
- **Alert** (`directorAlert`): any line (self-signed or approved) whose `|value| ≥ directorAlertKes` in force. It also sets `directorFlagged`. A push goes to every Director ("Isabel signed a count: Eggs short KES 5,200. Over your KES 5,000 alert. Tap to open it", link `/app/inventory/stock/counts?view=flagged`); **quiet hours 22:00 to 05:00 Africa/Nairobi hold the push until 05:00** (a delayed queue job); the flagged list is the in-app place. **No inbox row** (decision 5; the Inbox is chat only).
- The Director's KPI "Short 3 counts running" counts repeat-shortfall items; "Net difference 7 days" sums `value` of signed lines of the last 7 days that were outside the range.

## 6. Blind rule and view builders

One helper (`_shared/blind-rule.ts`, `blindnessOf` and a new `withoutCountFigures` that removes `COUNT_STOCK_FIGURE_KEYS`), one view builder per response family, never an `isAttendant` check:
- `counting/_shared/count-view.ts` builds `CountDetail`, `CountRow`, `SignPreview`, `SaveLinesResult`, `CheckResult` and the print data; the only place that decides which keys exist.
- `waste/_shared/waste-view.ts` builds `WasteEntry`, `WasteList`, `WasteItems`, `LogWasteResult`.
- Stock builds are `stock.read` only; they still go through `blindnessOf(...).itemCosts` for `valueKes`.

What the Attendant gets: their **own** count's lines with the number they typed, skipped, rechecked and zero counts, **item cost** (`unitCost`), section names and "last counted" as a date; the section-end check as names and typed numbers; their own waste with `valueKes` (item cost). What they **never** get from any endpoint: `expectedQty`, `difference*`, `result`, `story`, `suggestedCause`, `shortStreak`, `decision`, `director`, `adjustmentRef`, `figures`, `range`, `expectedAsOf`, `timeline`, `differencesText`, on-hand, restock levels, "went negative", waste KPIs. **Tests on every Attendant-reachable endpoint** assert the response has none of those keys; the contract test already pins the fixtures. A caller without `counts.read` who is not the counter gets 404 for someone else's count.

While a count is OPEN, `expectedQty` goes only to the counter, and only if the counter holds `restock.read` (the Manager counting herself); nobody else sees an open count's numbers except through C5 without figures.

## 7. Ledger posting (always through `postStockMovement`)

- **Counts:** one `ADJUSTMENT` per posting line: `quantity = difference` (signed; the door keeps the caller's sign), `unitCost` = the frozen line cost, `reason` = the cause text ("Prep use not logged", "Within range · accepted"), `userId` = the approver (the Manager; the System Admin's own id), `links: { countLineId }`. All in the same transaction as the status change. The door numbers each `ADJ-nnnn`. Matched, skipped and `MOVEMENT_LOGGED` / `RECOUNT_ASKED` lines post nothing. A wrong adjustment is corrected by a linked reversing row, never SQL.
- **Waste log (W2):** as today, one WASTE row per entry, stored negative by the door, `links: { wasteLogId }`.
- **Waste reversal (W4):** a new door path. `ledger-rules.ts` gets `reversal: 'WASTE'` on `WASTE`: **a reversal keeps the original's type with the opposite sign** (the same rule as Prep): the caller passes the same positive quantity with `reversesTransactionId`; the door stores it positive; the original must be a WASTE row at the same site, location and item with the exact opposite stored quantity; one reversal per row (the existing unique index), a reversal is never reversed. The `WasteLog` is stamped `reversed_*` in the same transaction. The Stock ledger's "Waste" column nets the two rows and the card shows "· reversed".
- **Ledger guard:** `ledger-guard.test.ts` lists `counting/count-service.ts` (1 direct write). The new code writes through the door only, so at release, after the old file is deleted, that allow-list row is removed. The test also fails on a stale entry, so the row is removed in the same commit as the file.

## 8. PINs

Signing a count (C13) and approving one (C29) are the only PIN-signed actions here. The caller types **their own** PIN; the System Admin signs with their own, so the record names them. A missing PIN and a wrong PIN are the same `INVALID_PIN`. Counting keeps its own tiny `pin-repository` and `count-pin.ts` (the same idiom as Purchasing's `pin.ts`, **not imported**: Purchasing's helper is that sub-module's internal). No PIN anywhere in Waste.

## 9. Branch-day coupling (the code `branch-day` imports from counting and stock)

Branch day is not redone here and must keep working. It imports exactly:
- `counting/count-calc.ts`: `lineVariance`, `lineVarianceValue`, `isReasonRequired`, `isDirectorAlert`, `toMoney` (via `branch-day-calc.ts`);
- `counting/thresholds-service.ts`: `getBranchThresholdsInForce`, `getHubThresholdsInForce`;
- `stock/stock-service.ts`: `departmentLabel`.

Decision: **move each to `_shared/`, leave nothing behind for branch day to break on.**
| Old | New home | How |
|---|---|---|
| `count-calc.ts` (+ test) | `modules/inventory/_shared/variance-calc.ts` (+ test) | **Copy**, then repoint branch-day's imports (`branch-day-calc.ts`, `branch-day-service.ts`: two import lines). The old file stays until it is deleted at release. The new counting code imports the shared one. The judging function of §5.4 is added here beside the old four. |
| `counting-thresholds.ts`, `thresholds-repository.ts`, the readers `getHubThresholdsInForce` (extended with `rangePercent`, `flagRepeatShortfalls`) and `getBranchThresholdsInForce`, and the **branch** write path (`updateBranch`, `GET`/`PUT /inventory/thresholds` for the Branch Manager) | `modules/inventory/_shared/thresholds/` | Copy and extend; repoint branch-day (one import line); the Branch Manager's two routes move to `_shared/thresholds/branch-thresholds-routes.ts`, mounted in `routes/index.ts` in the counting session's one-line mount. The hub parts (Store Manager's `PUT /inventory/thresholds`, Director's `PUT /inventory/thresholds/director`) are replaced by C25 and C26 and deleted with the old routes. |
| `departmentLabel` from `stock-service.ts` | `modules/inventory/_shared/department-label.ts` | Copy, repoint branch-day (one import line). |
| `stock-repository.ts` (`onHandForItem` and the item queries Prep and Waste use) | `stock/_shared/stock-repository.ts` | Copy what Prep's `record-repository` imports; repoint Prep's one import line; the new stock folders add their own queries. |

**Tests that must stay green before and after:** `branch-day-service.test.ts`, `branch-day-contract.test.ts`, `branch-day-opening.test.ts` (unchanged), plus new tests: the shared `variance-calc.test.ts` ported from `count-calc.test.ts` with the same cases and the new judging cases; a thresholds test that the branch readers return the same numbers as before; an import test (a plain unit test that fails if any file under `branch-day/` still imports from `../counting/` or `../stock/stock-service`).

## 10. Folder structure (the target, both sides) and where every old file goes

### 10.1 Back end

```
backend/src/modules/inventory/
  _shared/                          LANDED: wire.ts, central-store-access.ts (+11 rows), stock-count-waste-access.test.ts
                                    ADDED by the counting session: variance-calc.ts(+test), department-label.ts (the stock session adds this one),
                                    thresholds/ (repository, readers, branch routes), blind-rule.ts (+withoutCountFigures), reference-counter.ts (+nextNumber)
  counting/
    README.md                       rewritten: spec, status, roles, endpoints, coupling
    counting-routes.ts              LANDED aggregator
    _shared/                        LANDED: counting-contract.ts, .fixtures.json, .test.ts
                                    BUILT: count-state.ts (state machine, can{} flags), count-view.ts (blind rule), count-story.ts + count-story-repository.ts
                                           ("what the records show", suggested cause), count-pin.ts + pin-repository.ts, count-numbers.ts, count-notify.ts (push, quiet hours)
    counts/    {routes,controller,service,repository,validators}.ts, counts.types.ts, tests, README.md      C1 to C5
    record/    same                                                                                         C8 to C14
    review/    same                                                                                         C27 to C30
    setup/     same                                                                                         C15 to C22 (+ placeNewItem)
    settings/  same                                                                                         C23 to C26
    print/     same                                                                                         C6, C7
  stock/
    README.md                       rewritten (the door section is kept)
    stock-hub-routes.ts             LANDED aggregator
    _shared/                        LANDED: stock-contract.ts, fixtures, test.  BUILT: stock-repository.ts (copied from the old file), stock-status.ts
    overview/  items/  history/     {routes,controller,service,repository,validators}.ts, types, tests, README.md    S1 / S2 / S3 to S5
    ledger/                         the door: untouched except the counting session's foundation commit (§2.5, §7)
  waste/
    README.md                       rewritten
    waste-hub-routes.ts             LANDED aggregator
    _shared/                        LANDED: waste-contract.ts, fixtures, test.  BUILT: waste-view.ts
    log/  entries/  reverse/        {routes,controller,service,repository,validators}.ts, types, tests, README.md    W1 W2 / W3 / W4
    department/                     the old three endpoints, MOVED UNCHANGED at release
```
Every sub-module folder has `README.md` (spec, status, endpoints, coupling). Each file keeps its layer suffix. A `$transaction` lives in a service only; all Prisma in repositories; every query carries `siteId`. Cross-folder imports go through each folder's exports and are listed in its README **Coupling**: `record`, `review`, `print`, `counts` use `counting/_shared`, `stock/ledger/ledger-door`, `stock/_shared/stock-repository`; `setup` is called by the catalog's create path through `modules/inventory/index.ts` (`placeNewItem`); `stock/overview` reads counting's tables through counting's exported read function (`todaysCounts`, `longestWithoutCount`), never its repository; `waste` uses the door and `stock/_shared`.

### 10.2 Old back-end files

| Old file | Fate |
|---|---|
| `counting/count-service.ts`, `count-repository.ts`, `count-controller.ts`, `count-routes.ts`, `count-validators.ts`, `count.types.ts`, `count-test-fixtures.ts`, `count-service.test.ts`, `count-contract.test.ts` | **Deleted at release.** Useful cases (the section-judging and approval maths) are ported into the new tests by the counting session. |
| `counting/count-calc.ts`, `count-calc.test.ts` | Copied to `_shared/variance-calc.ts` (§9); the old pair is **deleted at release** |
| `counting/counting-thresholds.ts`, `thresholds-*.ts` (controller, validators, types, repository, service, tests) | Copied and extended into `_shared/thresholds/` (§9); the hub write paths are replaced; the old files are **deleted at release** |
| `counting/DESIGN-NOTES.md`, `counting/README.md` | README **rewritten**; DESIGN-NOTES **deleted at release** (its content is in Paper and these docs; it says to delete it when the last redo merges) |
| `stock/stock-service.ts`, `stock-controller.ts`, `stock-routes.ts`, `stock-validators.ts`, `stock.types.ts`, `stock-contract.test.ts` | **Deleted at release** (`departmentLabel` is copied to `_shared`; `TodaysCount` goes with the old summary) |
| `stock/stock-repository.ts` | Copied to `stock/_shared/stock-repository.ts`; Prep repointed; the old file **deleted at release** |
| `stock/ledger/*` | **Kept.** Two additive edits in the counting session's foundation commit: the `countLineId` link and the WASTE reversal path, with door tests |
| `waste/waste-service.ts`, `waste-controller.ts`, `waste-repository.ts`, `waste-routes.ts`, `waste-validators.ts`, `waste.types.ts` + their tests | **Moved unchanged** into `waste/department/` at release (the Department Head's branch waste keeps working) |
| `scripts/seed-counting-dev-fixtures.ts`, `scripts/seed-stock-waste-dev-fixtures.ts` | Rewritten for the new tables by the counting session and the stock and waste session respectively (the old `StockCount` rows go; the new fixtures seed sections, an open count, a submitted count, a signed count, a flagged line, waste entries) |

### 10.3 Front end

```
frontend/
  app/app/inventory/(shell)/stock/          ROUTING ONLY: thin shells, no logic (the routes in §11.1)
  app/app/inventory/count-print/            [id]/page.tsx (replaced) and blank/page.tsx (new): bare A4 pages, no shell
  features/inventory/
    index.ts                                public API: the old counting/stock/waste exports are replaced by the new screens (the front-end session owns these lines)
    _shared/                                LANDED: types/wire.ts, types/state-copy.ts, lib/capabilities.ts (names)
                                            KEPT: components/stock-format.ts, stock-states.tsx (may gain exports; never lose one another folder imports)
                                            MOVED IN: components/stock-mobile-header.tsx (from stock/components/; the department waste form uses it)
    counting/
      README.md  index.ts
      _shared/  types/  LANDED (contract mirror, fixtures, test)   lib/states-copy.ts LANDED   components/  hooks/  services/counting-api.ts
      record/   components/  hooks/  lib/  services/  types/  README.md       steps 1 to 7, 12 to 15, 40, 41, 49 (the phone screens as a centred column at every width, and the Manager's desktop count)
      review/   same                                                         steps 8, 9, 10, 11, 26, 46, 47, 48 (Counts, Review, Director's view)
      setup/    same                                                         steps 24, 24B, 24C, 25, 45, 50, 51
      print/    same                                                         steps 43, 44
    stock/
      README.md  index.ts
      _shared/  types/ LANDED   lib/states-copy.ts LANDED   services/stock-api.ts
      overview/  items/  history/   components/ hooks/ lib/ services/ types/ README.md    steps 42 / 27 / 28 and 29
    waste/
      README.md  index.ts
      _shared/  types/ LANDED   lib/states-copy.ts LANDED   services/waste-api.ts
      log/  entries/  reverse/  components/ hooks/ lib/ services/ types/ README.md        steps 16 to 18 and 22 / 19 and 21 / 20 and 23
      department/               the old `log-waste-drawer.tsx`, `log-waste-form.tsx`, `department-log-waste-screen.tsx` and `types/waste.ts`, kept for branch waste
  components/ui2/                           the shared table is `data-table/` (README inside); every table uses it
```
Every sub-module and every folder has `README.md` (spec, status, endpoints, coupling) and a `service-boundary.test.ts` where the folder has a services layer (no component calls `apiClient` directly; every call goes through `services/`). Components use `components/ui2/` and `wds-` tokens only; **nothing new in `components/ui/`**. Cross-feature imports go through `features/inventory/index.ts` only.

### 10.4 Old front-end files

| Old file | Fate |
|---|---|
| `counting/components/screens/{daily-count,stock-counts,spot-count}-screen.tsx`, `count-reason.tsx`, `count-verify-parts.tsx`, `pin-sheet.tsx`, `printable-count-verification.tsx`, `thresholds-drawer.tsx`, `hooks/*`, `services/count-api-service.ts`, `types/count.ts` | **Deleted by the front-end session** as each new screen replaces it (the front-end owns these folders). `features/inventory/index.ts` stops exporting `PinSheet`, `CountReasonControl`, `Reveal`, `StatCell`, `StatusDot`, `STOCK_DRAWER_MOTION`, `useReturnFocus` (nothing outside the old folders uses them: checked) |
| `stock/components/*` (hub, items, ledger screens, `stock-table`, `hub-kpi-strip`, `stock-topbar`, `highlight-on-change`), `hooks/use-stock.ts`, `services/stock-api-service.ts` | **Deleted by the front-end session**; `stock-mobile-header.tsx` is **moved** to `_shared/components/` first (the department waste form imports it) |
| `stock/types/stock.ts` | The two types `_shared/components/stock-format.ts` imports (`InventoryItemTypeValue`, `InventoryTransactionTypeValue`) are re-homed in `features/inventory/_shared/types/` (additive), then the file is deleted; `waste/types/waste.ts` stays for `waste/department/`; `COUNT_REASON_LABEL` in `stock-format.ts` is replaced by `CAUSE_TEXT` |
| `waste/components/log-waste-drawer.tsx`, `log-waste-form.tsx`, `screens/department-log-waste-screen.tsx` | **Moved** into `waste/department/` (the Central Store use is deleted, the branch use stays) |
| `app/app/inventory/(shell)/stock/{page,items,ledger,counts}/…` | **Replaced in place** by thin shells over the new screens |
| `app/app/inventory/(shell)/stock/{daily-count,spot-count}/` and the old `count-print/[id]` | **Deleted at release** by the orchestrator (the new routes cover them), with redirects only if the owner asks |

## 11. Routes (all proposals from the Screens index, confirmed)

### 11.1 Pages (`app/app/inventory/(shell)/stock/…`, thin shells)
| Route | Screen | Who |
|---|---|---|
| `/stock` | Overview (42) | desktop roles |
| `/stock/items` | All items (27) | desktop roles |
| `/stock/ledger`, `/stock/ledger/[itemId]` | Stock ledger (28), Stock card (29) | desktop roles |
| `/stock/counts` | Counts (8, 48, 26 with `?view=flagged`) for desktop roles; **Pick a section (1)** for the Attendant, at phone width | all |
| `/stock/counts/new` (`?recount=[lineId]`) | Start a count (12, 49); the Attendant is redirected to `/stock/counts` (N4) | SM, SA |
| `/stock/counts/[id]` | Review (9) or the signed count (47); for the Attendant: their own count, redirecting to `/count` while OPEN and `/submitted` after | all |
| `/stock/counts/[id]/count`, `/sign`, `/submitted` | Counting (2 to 4, 13), Review before signing (5) with the PIN dialog (6), Submitted (7) | counter |
| `/stock/counts/[id]/signed` | Count signed (15) | desktop roles |
| `/stock/counts/setup` | Count setup (24), with the drawers 24B, 24C, 25, 45, 50, 51 as `?drawer=` states | desktop roles read, SM/SA write |
| `/stock/waste`, `/stock/waste/new` | Waste (21, 19), Log waste (22, 16 to 18) | all |
| `/app/inventory/count-print/[id]`, `/app/inventory/count-print/blank` | Printed record (44), blank sheet (43) | print |

Page state (filters, page, rows per page, search, tab, drawer) lives in the URL (`UI_BUILD_RULES.md` §4a). The Director opens Count settings from a **Count settings** control on their Counts page (step 26's top bar), which opens step 45's drawer (default 2, as I read it); no new sidebar row.

## 12. What the orchestrator has landed, and what each side builds against

Landed on `feat/stock-count-waste` (gates: backend `pnpm build` and `pnpm test`; frontend `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test`, `pnpm build`): the plan, the design docs, the needs document, this contract, the frozen contracts and fixtures on both sides, the capability rows and tests, the route mounts and twelve placeholder folder routers, the state copy files, the briefs. **Not landed (the sessions' work):** the Prisma schema and migration A, the door edits, every service, repository, controller, validator, screen and hook.

**Hand-off point (front end from fixtures to the real API).** The front-end session builds every screen against the frozen types with a thin HTTP service per sub-module and fixtures served through the same service interface (`USE_FIXTURES` per service, defaulting on until the hand-off). The hand-off happens when the orchestrator tells the front-end session that **both** back-end branches are merged into `feat/stock-count-waste` and `pnpm build` and `pnpm test` pass there: the front-end session then rebases onto it, turns the fixture switch off, and runs the whole parity and role pass against real data. If the back end is late, the front end stops after its fixture pass with a written list and waits; it never builds its own copy of a back-end rule.

## 13. Stage 4 switch list (the orchestrator, at release; none of it is done in the build sessions)

1. Merge `feat/stock-count-waste-be-counting`, then `…-be-stock-waste`, then `…-fe` into `feat/stock-count-waste`; resolve conflicts; run the combined gates (backend `pnpm build` and `pnpm test`; frontend `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test`, `pnpm build`).
2. Delete the old files in §10.2 and §10.4; move `waste/*` into `waste/department/`; remove the old route mounts from `routes/index.ts`; remove the `counting/count-service.ts` row from `ledger-guard.test.ts` (and update the guard's count in the stock README); add migration B.
3. **Nav rows** (`frontend/components/app/shell/nav-table.ts`), prepared here as the exact replacement of the `stock-counts` sub-links (not switched):
   ```ts
   subItems: [
     { key: 'overview', label: 'Overview', newHref: '/app/inventory/stock', roles: DESKTOP_HUB, capability: 'stock.read' },
     { key: 'items', label: 'All items', newHref: '/app/inventory/stock/items', roles: DESKTOP_HUB, capability: 'stock.read' },
     { key: 'counts', label: 'Counts', newHref: '/app/inventory/stock/counts', roles: HUB_ALL, anyCapability: ['counts.read', 'counts.record'] },
     { key: 'waste', label: 'Waste', newHref: '/app/inventory/stock/waste', roles: HUB_ALL, capability: 'waste.read' },
     { key: 'ledger', label: 'Stock ledger', newHref: '/app/inventory/stock/ledger', roles: DESKTOP_HUB, capability: 'stock.read' },
     { key: 'restock-levels', label: 'Restock levels', newHref: '/app/inventory/stock/restock-levels', roles: DESKTOP_HUB, capability: 'restock.read' }, // unchanged
   ],
   ```
   The rows `daily-count`, `daily-count-blind` and `spot-count` are deleted. Per Q6, each area switches on when finished: Counts and Waste may switch before Overview, All items and the ledger if the owner wants it, but then the old pages at the same URLs must already be replaced by the new thin shells.
4. **Route gate** (`frontend/lib/route-access.ts`): `/app/inventory/stock` currently falls through to "Store Manager or Store Attendant". Add the stock branch in the same commit as the nav switch: desktop roles for everything under `/app/inventory/stock`, plus the Attendant for `/stock/counts` and `/stock/waste` (and the print blank page); the API still decides who may write. `nav-table.test.ts` fails if a row shows a link the gate would bounce.
5. Docs close-out: sub-module READMEs, `docs/API_CONTRACT.md` (new §34 from the three contract files), `docs/DATA_MODEL.md`, `decisions.md` ("Access", counting section), `counting-redesign.md`, `PROJECT_STATUS.md`, `CLAUDE.md` current-work pointer; delete the plan, the contract, the needs document, the briefs and `counting/DESIGN-NOTES.md` (working documents, `FEATURE_REDO_PLAYBOOK.md` §11).
6. Before the deploy: run migrations A and B on a restored production copy; set PINs (§1); push, open the PR, merge, watch the deploy, run `migrate deploy`, check production; **the owner watches a real user count**.

## 14. Test plan (back end; the briefs repeat the parts each session owns)

- **Pure:** `variance-calc` judging table (every tier, the tie, expected ≤ 0, `NOT_COUNTED`), `shortStreak`, the story and suggested-cause rules, quiet-hours calculation, the count reference format.
- **Service (mocked repositories, per-role payloads):** every state transition and every error code in `COUNT_ERROR_CODES`; one open count per person; section busy; recheck offered once; Attendant payload has no stock key (per endpoint); Manager self-sign applies everything and flags outside-range lines; approve needs every outside-range line decided; PIN own, wrong, missing, System Admin; `RECOUNT_ASKED` and `MOVEMENT_LOGGED` post nothing; settings frozen on the count at sign.
- **Route capability matrix** (§3.1): role by endpoint, six roles, plus a non-hub actor refused on every write.
- **Database (`*.db.test.ts`, opt-in `RUN_DB_TESTS=1`):** sign freezes expected at `signedAt` with a later movement ignored; approve posts N rows and rolls back whole on a failure (door rejects); two people racing for one section leave one open count; the two partial unique indexes; a replayed `idempotencyKey` makes one count and one waste batch; a count line cannot be deleted once a ledger row points at it; migration seed gives the right sections on a seeded copy; waste reversal nets the stock exactly and a second reversal is refused.
- **Ledger:** door tests for the `countLineId` link and the WASTE reversal path; `ledger-guard.test.ts` unchanged and green; `findLinkOwnerSites` covers `countLineId`.
- **Branch day:** the three branch-day tests unchanged and green; the import-guard test (§9).
- **Contract:** the three contract tests (landed) stay green; every response of every endpoint is parsed with its Zod schema in the route tests.
- **Stock:** the ledger summary adds up per row (opening + in − out + adjusted = closing) against a seeded ledger; reversed waste nets to zero in the Waste column; chips and counts match the rows; export refuses over 10,000.
- Gate: `cd backend && pnpm build && pnpm test`, and real requests as Store Manager, Accountant, Director, Branch Manager and Attendant.

## 15. Open items (nothing blocks the build; defaults are in `stock-count-waste-needs.md` §8)

N1 to N10 as listed there. The two with the most weight if the owner disagrees: **N1** (where the Manager picks causes for her own outside-range lines) and **N2** (the move and add-section controls). Both change only a screen, not the contract's shape.
