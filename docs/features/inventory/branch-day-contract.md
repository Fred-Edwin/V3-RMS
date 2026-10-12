# Block 4: Branch day, the contract (draft for owner freeze, 9 Oct 2026)

Governs: `branch-day-flow.md` (the agreed rules and the Paper design log), Paper page "Inventory · Counting and closing" (steps B0 to B18, 28 screens, and chapter 5 steps 19 and 20). **Paper wins.** Models followed: `requisitions-contract.md` §2 (departments as data, the expand and contract plan, the dual-write rule), `dispatch-contract.md` (a delivery not yet confirmed blocks the close), `discrepancies.md` (an open discrepancy never blocks), `branch-waste-contract.md` (waste is read for Used today) and `stock-count-waste-contract.md`. Not frozen until the owner says so; the contract is written in Zod, fixtures and mirrors in the same change (`branch-day/_shared/branch-day-contract.ts`).

**What Block 4 delivers:** the whole Branch day for the department heads and members (phone), the Branch Manager (desktop) and every other desktop role (read): the head's Day home, the opening check, the blind evening count, the Branch Manager's Today with the department cards and what blocks the close, a department's figures, counting on behalf of a department, closing the day, History, the day file with Items, Documents and Activity, correcting one count, and the printed day sheet. **What it removes:** reopen, the KES 1,000 reason threshold, the `CONSUMPTION` reason, the overnight and Director alert pushes, the Branch Manager's branch thresholds drawer, and (in a separate, later migration) the old department enums and dead branch-day columns.

## 0. Owner decisions (all seven ACCEPTED by the owner on 10 Oct 2026, "accept"; the contract stands as written)

Also accepted: the head's button switches from "Check the opening" to "Count your department" at 12:00 Nairobi, and the printed sheet takes 16 rows per page. The owner still runs the §10.4 production queries before the contract migration is written.

1. **Items that used nothing post no usage entry.** Paper counts "43 usage entries, one per item" for 43 items, two of them with Used today 0 (Baking powder, Vanilla essence). The ledger door refuses a movement of zero. Recommendation: post an entry only for an item whose Used today is not zero, and have the drawer and the banner say the real number (41 in the fixtures). The 43 in Paper is an invented figure.
2. **Counting for a department ("on behalf") is the Branch Manager's alone**, not the System Admin's. The flow table says the System Admin "can do every action with their own PIN", but the owner's 8 Oct ruling for requisitions and deliveries is that signing for a department is the Branch Manager's alone. The System Admin reads, closes and corrects with their own PIN. One row in `central-store-access.ts` flips it.
3. **The contract migration keeps `users.department_tag`, `departments.key` and the `DepartmentTag` enum.** The prompt says it drops the old department enums. The login token, shift assignment, the workforce access rules and the old Staff › Departments page still read them (§11.3). The migration drops every other enum column (locations, items, requisition sections, branch day and openings). Retiring the user column belongs to the Workforce redo.
4. **Days closed under the old flow stay readable but have no Used today.** Their figures were never stored in the new shape. History shows them Closed with "–" for Used value and the closing stock value computed from what was counted; their day file shows closing figures only. Recommendation: accept, because production has few days (the owner's counts decide, §10.4).
5. **A correction is allowed until the next opening of that department is accepted**, department by department. Paper says "until tomorrow's opening is accepted" on the day file. One department's opening does not close the window of another.
6. **The usage entry is the closing count minus the ledger position at the close**, so the ledger equals the count afterwards. When nothing else moved the department's stock that day it is exactly minus Used today (Paper B9). Recommendation: keep, because the count is the truth and any other movement is caught rather than hidden (§5.9).
7. **A signed evening count cannot be changed before the close.** The head can change figures on "See every figure" until they send (B3c); after that only Correct a count (after the close) or the next opening recount. Paper B4 says exactly that ("tell the Branch Manager. They can correct one item after the day is closed").

## 1. What was checked first (real schema and code, 9 Oct 2026)

| Question | Answer |
|---|---|
| What does the old Branch day do? | `backend/src/modules/inventory/branch-day/`: 11 endpoints at `/branch-day/...` (`today`, `history`, `opening`, `opening/accept`, `:id`, `:id/overview`, `:id/departments/:tag`, `PUT :id/departments/:tag/lines`, `:id/close`, `:id/reopen`, `:id/document`), all `requireRole('MANAGER')` except the head's opening (`requireDepartmentHead`) and reopen (MANAGER, DIRECTOR). The Branch Manager enters every department's counts, gives a reason for any gap at or above the branch threshold (default KES 1,000), signs the close with a PIN, and may reopen with a reason. |
| Which tables? | `branch_days` (unique per branch and Nairobi date, `status` OPEN or CLOSED, `reference` DAY-nnnn, `reopen_count`), `branch_day_departments` (keyed by the **enum** `department_tag`, `location_id`, status NOT_STARTED or COUNTED, counted by and at), `branch_day_lines` (`counted_qty`, `expected_qty` NOT NULL, `unit_cost`, `reason`, `reason_note`, `reason_required`), `branch_day_reopens`, `department_openings` and `department_opening_lines` (keyed by the enum; `prefilled_qty`, `accepted_qty`, `overnight_variance`, `unit_cost`). Enums `BranchDayStatus`, `BranchDayDepartmentStatus`, `GapReason` (`CONSUMPTION`, `UNLOGGED_WASTE`, `WALK_IN_COMP`, `SUSPECTED_LOSS`, `OTHER`). The ledger carries `branch_day_line_id` and `opening_line_id` links. |
| The reopen and thresholds code | `reopenDay` (a counter and an audit row; a re-close reverses the standing gap adjustments with linked rows, `recomputeNextMorningOpenings` rewrites the next morning's overnight rows); `counting_thresholds` branch rows (`reason_required_kes`, `overnight_alert_kes`) read through `counting/thresholds-service` and edited through `GET/PUT /inventory/thresholds`; two pushes in `fcm-service` (`sendBranchDayDirectorAlertPush`, `sendOvernightVarianceAlertPush`). All of it goes. |
| The `CONSUMPTION` reason | Only the `GapReason` enum value and its label in `branch-day-validators.ts`. Dead with the rebuild. |
| The old counting files branch day still imports | `counting/count-calc.ts` (via `branch-day-calc.ts`: `lineVariance`, `isReasonRequired`, `isDirectorAlert`, `toMoney`) and `counting/thresholds-service.ts`, with the files they sit beside and that are marked "kept for the branch-day refactor": `counting-thresholds.ts`, `thresholds-{controller,repository,routes,validators}.ts`, `thresholds.types.ts`, `count-calc.test.ts`, `thresholds-service.test.ts`, and the `departmentLabel` stub in `stock/stock-service.ts`. The build deletes them (§12). |
| How does `ReferenceCounter` DAY work per branch? | `referenceCounterRepository.nextReference(tx, branchOrgId, 'DAY')` on the **branch** site, inside the transaction that creates the day, gap-free, giving `DAY-0001`. There is no branch code in it. Dispatch shows the new shape: ``DSP-${branch.code}-${pad4(nextNumber)}`` with `Site.code` (NYR, KRT, set by Block 1). The new day number is `DAY-{code}-{nnnn}` from the same counter, which continues from where it is (an older day keeps its `DAY-0012`). Local data: one open day, counter at 1. |
| How can Block 1's departments be read? | `departments` (`siteId`, `name`, `key` the legacy enum or null for an added one, `status` ACTIVE or RETIRED, `position`), `item_departments` (which items a department holds), `users.department_id` and `users.is_department_head` (the head and members), `locations.department_id` (a `BRANCH_DEPARTMENT` location per department; `deliveriesRepository.ensureDepartmentLocation` creates it for an added department). The login token (`Actor`) carries only `departmentTag`, so every service reads `users.department_id` itself, as Deliveries and Branch waste do. |
| How can Block 2's delivery confirmation be read for the close? | `dispatches` with `to_organization_id` = the branch, `department_id`, `status` `ON_THE_WAY` (signed and left, not yet counted) blocks that department; `CONFIRMED` and `CLOSED` do not. Open discrepancies are `discrepancies.status = OPEN`. The Branch Manager confirms a delivery for a department through Block 2's V-endpoint (`deliveries.confirm_on_behalf`); the "Confirm for Kitchen" button on Today opens that. The old `inTransitDispatches` skipped a department with no legacy key (an added department), so a delivery to it never blocked; the new rule reads `department_id`. |
| How can Block 3's waste be read? | `waste_logs` (`organization_id`, `location_id`, `quantity`, `created_at`, `reversed_at`) at the department's location, per Nairobi day; a reversed entry counts for nothing (`branch-waste-contract.md` §2.6, §5). No endpoint is needed. |
| Which old enum columns are still dual-written? | `locations.department_tag`, `inventory_items.department_tags[]`, `users.department_tag`, `requisition_sections.department_tag`, and the two branch-day columns `branch_day_departments.department_tag` and `department_openings.department_tag` (these two have **no** id link yet). Block 2 already replaced `dispatches.department_tag` with `department_id`. |
| The ledger door | `postStockMovement` numbers every `ADJUSTMENT` row `ADJ-nnnn` from the counter. A branch-day close needs `DAY-{code}-{nnnn}` on its usage entries, so the door gets one small extension (§6.1). The allow-list in `ledger-guard.test.ts` still has `branch-day-repository.ts` (`writeAdjustment`, a direct write); it shrinks to nothing in the build. |
| Production data | Not seen. The owner's read-only counts from `final-pass-build-plan.md` ("Owner to run": `branch_days` by status, `branch_day_reopens`, `reference_counters`) are still to paste back before the migration is written (§10.4). Local lane database: 1 open day, 0 reopens, 0 openings, 0 ledger rows linked to a day. |

### Differences between the flow document and Paper or the code (none breaks a rule; Paper wins)

1. **"One usage entry per item"** versus the door refusing zero: entries only where Used today is not zero (§0.1).
2. **"System Admin can do every action"** versus the 8 Oct "on behalf is the Branch Manager's alone" ruling: the Admin does not count on behalf (§0.2).
3. **Chapter 5 (steps 19 and 20, the head's past days)** is not in the B0 to B18 index or in the flow, but the owner approved it (role-coverage A6, 8 Oct): built as BD9 and BD10.
4. **"The Branch Manager may accept or recount an opening"** (flow decision 4) has no Paper screen (B15 draws only the evening count): the API takes `departmentId` for the Branch Manager, no screen is built (gap 7).
5. **The day number** is branch-coded in the flow and Paper (`DAY-NYR-0044`); the code gives `DAY-0001`. New days are branch-coded, old ones keep their number.
6. **"Open, Closed, Corrected"**: the database has OPEN and CLOSED; Corrected is derived from the existence of a correction.
7. **"Heads see only their own department's slice"**: true for the day; chapter 5 also lets a head read their department's **closed** days (quantities, no costs).
8. **The overnight difference** the head sees is counted minus last night's signed figure; the entry posted to the ledger is counted minus the ledger position (the same number unless something else moved the stock overnight, §5.9).
9. **Old close behaviour removed:** the old close posted one `ADJ-` row per gap and reversed them on reopen; the new close posts one `DAY-` row per item that moved and never reverses.
10. **The Branch Manager's "Today" badge** drawn beside Today on B5 (the number of things to do) has no feed (gap 9).

## 2. Decisions that shape it

1. **Heads count their own department blind, on their phone, signing with their own PIN.** Any active member of the department may, when the head is off; the Branch Manager may for any department, recorded "on behalf of the department", with their own PIN. Accepting an opening is one tap with no PIN; a recount is blind and signed.
2. **The figure is Used today** = opening stock + received − waste − closing stock. The system flags nothing, asks for no reason, tells nobody. The Branch Manager reads the figures and the **Yesterday** column.
3. **No reopen, ever.** After the close one item is changed by **Correct a count**: one reason, a PIN, one linked ledger entry. Nothing is undone or deleted.
4. **What blocks the close:** a department that has not counted (a department with no items counts as done) and a delivery that left the store and is not confirmed. An open discrepancy and a missing opening check never block.
5. **Departments are rows** (Block 1), never the enum: every new query reads `department_id`. The enum columns stay dual-written until the contract migration (§11).
6. **Money by capability:** every `*ValueKes` and `unitCostKes` follows `catalog.see_costs` (the Branch Manager and every desktop reader hold it; a head or member never does, from any endpoint).
7. **No notifications.** No push, no badge feed, no Inbox row. The old overnight and Director pushes are deleted.
8. **Printing is not an audit event.** The day sheet is kept as versions; reading one changes nothing.
9. **The day and its lines are made together.** The first read by the branch's own people on a Nairobi day creates the day and, for every department with items, one line per live item linked to it; the set is fixed from then (an item added later appears tomorrow).
10. **Figures freeze at the close** (opening, received, waste, unit cost, used). A correction changes one line and the day's totals and adds a sheet version.

## 3. Access (`_shared/central-store-access.ts`, new rows)

The client has not approved role names; each row is a one-row edit. A department head or member holds **none** of these from the table for their own count and opening: that is the department rule in the service (an active user whose `department_id` names an active department of their own branch, found with `users.department_id`), the same shape as `deliveries.count` and `branch_waste.log`.

| Capability | Meaning | Held by |
|---|---|---|
| `branch_day.count` | check the opening and count and sign the evening for the caller's own department | **no role** (department rule) |
| `branch_day.count_on_behalf` | count and sign for a department of the branch, recorded "on behalf" | Branch Manager (own branch) |
| `branch_day.read` | Today, figures, History, the day file and the day sheet for the caller's own branch, with values | Branch Manager, System Admin (needs a branch) |
| `branch_day.read_any_branch` | the same for every branch, read only, with a Branch picker and column | Director, Accountant, Store Manager, System Admin |
| `branch_day.close` | close the day with the caller's own PIN | Branch Manager (own branch), System Admin |
| `branch_day.correct` | correct one item's closing figure on a closed day, with a reason and the caller's own PIN | Branch Manager (own branch), System Admin |

The Store Manager inherits none of `read`, `close`, `correct`, `count` and `count_on_behalf` (they are named in `NOT_THE_STORE_MANAGERS`); they read through `read_any_branch`. `count` and `count_on_behalf` are in `DEPARTMENT_ONLY` (not held by the System Admin through "everything"). No new `requireRole` list on any route. The Store Attendant holds none.

### 3.1 Role by endpoint (R read, W write, own = own department or own branch, — = 403)

| Endpoint | Head or member | BM | DIR | ACC | SM | SA |
|---|---|---|---|---|---|---|
| BD1 to BD8 (home, opening, count) | W own department | W any department (BD2 to BD8, `count_on_behalf`) | — | — | — | — |
| BD9, BD10 (my past days) | R own department | — | — | — | — | — |
| BD11, BD12, BD15 to BD19, BD21 | — | R own branch | R any | R any | R any | R any (names the branch) |
| BD13, BD14 (close) | — | W own branch | — | — | — | W any |
| BD20 (correct) | — | W own branch | — | — | — | W any |

The route-by-role test asserts this grid for every endpoint, plus a Branch Manager of another branch and a head of another department refused (`NOT_YOUR_BRANCH`, `NOT_YOUR_DEPARTMENT`).

## 4. API: base path and the endpoint table

Base `/api/v1/inventory/branch-day`, envelope `{ success, data }`, wire rules in `_shared/wire.ts`. Every route has `authenticate`, a Zod schema (all bodies **strict**) and `siteId` (the branch) in every query. The old `/branch-day/...` routes stay mounted until the build deletes them (§12). The literals (`/home`, `/opening`, `/count`, `/today`, `/history`, `/mine/...`) are registered before the `/days/:id` family, and `:id` only matches a uuid. Signing writes carry `{ pin, idempotencyKey }` in the **body** (one convention for the block; Deliveries do the same); a repeated key returns the first result with `replayed: true`.

| # | Method and path | Gate | Request, response (contract schema) |
|---|---|---|---|
| BD1 | `GET /home` | department rule | no query → `home` (Paper B0, B4). The head's Day: the opening card, the delivery card, the evening count, who and when, and `action`. Creates today's day on first read (§2.9) |
| BD2 | `GET /opening` | department rule; `branch_day.count_on_behalf` may pass `departmentId` | `openingQuery` → `openingView` (B1). Last night's signed figures; after the check, what was accepted |
| BD3 | `POST /opening/accept` | the same | `acceptOpeningInput` → `openingResult` (B1). **No PIN.** Writes the opening with the accepted figures equal to last night's, no ledger row. `OPENING_ALREADY_CHECKED` |
| BD4 | `POST /opening/recount/preview` | the same | `recountPreviewInput` → `recountPreview` (B2's receipt, before the PIN). Writes nothing |
| BD5 | `POST /opening/recount` | the same | `recountOpeningInput` → `openingResult` (B2, B2b). **PIN.** One opening row, its lines, and one ADJUSTMENT per line whose count differs from the ledger position (§6.3). `COUNT_INCOMPLETE`, `ITEM_NOT_IN_DAY`, `INVALID_PIN` |
| BD6 | `GET /count` | department rule; `count_on_behalf` may pass `departmentId` | `countQuery` → `countView` (B3, B3b, B3c, B15). **Blind:** items, units, categories and what was typed; nothing to count against |
| BD7 | `PUT /count` | the same | `saveCountInput` → `saveCountResult`. Stores what was typed (last write wins; a figure may be cleared with null). `ALREADY_COUNTED`, `DAY_ALREADY_CLOSED` |
| BD8 | `POST /count/sign` | the same | `signCountInput` → `signCountResult` (B3b, B4, B15). **PIN.** Every line filled, else `COUNT_INCOMPLETE`. Marks the department Counted with the signer and `onBehalf` |
| BD9 | `GET /mine/history?from=&to=&status=&page=&pageSize=` | department rule | `myHistoryQuery` → `myHistory` (step 19). Default window: the last 30 Nairobi days (Paper "Date: Last 30 days"). Closed and Corrected days only |
| BD10 | `GET /mine/days/:id` | department rule | `myDay` (step 20). One past day of the caller's department, quantities only |
| BD11 | `GET /today?branchId=` | `branch_day.read` (own branch) or `read_any_branch` | `todayQuery` → `today` (B5, B7, B9, B14, B16). A Branch Manager's read creates today's day if none; a hub reader's does not (`day: null`). `branches` is the picker for hub roles. Absent `branchId` for a hub role: the first branch by name |
| BD12 | `GET /days/:id/departments/:departmentId` | a reader | `departmentFigures` (B6, B11 Items). Live for an open day, frozen for a closed one |
| BD13 | `GET /days/:id/close-summary` | `branch_day.close` | `closeSummary` (B8). Always 200, with `canClose` and `blockers`; the drawer is disabled when not ready |
| BD14 | `POST /days/:id/close` | `branch_day.close` | `closeDayInput` → `closeDayResult` (B8, B9). **PIN.** One transaction (§5.8). `DAY_NOT_READY` with `details.blockers`, `DAY_ALREADY_CLOSED`, `INVALID_PIN`, `NOT_YOUR_BRANCH` |
| BD15 | `GET /history?branchId=&q=&from=&to=&status=&page=&pageSize=` | a reader | `historyQuery` → `history` (B10, B10b, B10c). Default window: the last 7 Nairobi days (Paper "Date: Last 7 days"), newest first; `q` searches the day number. `branches` for hub roles |
| BD16 | `GET /days/:id` | a reader | `dayFile` (B11): header, tracker facts, the department rail, tab counts, the newest correction, `can` |
| BD17 | `GET /days/:id/activity?limit=` | a reader | `activityQuery` → `dayActivity` (B12b). Newest first; `limit` defaults to 5 ("Showing the 5 most recent of 10"); `total` is the whole |
| BD18 | `GET /days/:id/documents` | a reader | `dayDocuments` (B13). Newest first; the newest is `latest` |
| BD19 | `GET /days/:id/entries?page=&pageSize=` | a reader | `entriesQuery` → `dayEntries`. Every ledger entry carrying the day number (the usage entries and the corrections), newest first. Gap 10: no screen draws the full list |
| BD20 | `POST /days/:id/corrections` | `branch_day.correct` | `correctCountInput` → `correctCountResult` (B12, B12b). **PIN.** One transaction (§5.10). `DAY_NOT_CLOSED`, `DEPARTMENT_NOT_COUNTED`, `ITEM_NOT_IN_DAY`, `CORRECTION_WINDOW_PASSED`, `CORRECTION_NO_CHANGE`, `INVALID_PIN` |
| BD21 | `GET /days/:id/sheet?version=` | a reader | `sheetQuery` → `daySheet` (B13b to B13d). Default the latest version; a version is the stored copy as made. `DAY_NOT_CLOSED` on an open day |

## 5. Rules and calculations (pure functions, table-tested in the build)

### 5.1 The day, its departments and its lines

- **Business date** is the Nairobi day. One day per branch per date (`@@unique([siteId, businessDate])`). `status` is OPEN until closed; on the wire it is CORRECTED when closed with at least one correction.
- **Created together** on the first read by the branch's own people (BD1, BD2, BD6, or the Branch Manager's BD11): the day, one `branch_day_departments` row per ACTIVE department of the branch (with its `departmentId`, location and legacy key when it has one), and one `branch_day_lines` row per live item linked to that department in `item_departments`. A losing creation race re-reads the winner. A branch with no active department is `NO_DEPARTMENTS`. An open day made by the old code is adopted: a department with no lines gets them on first read.
- **A department with no items** is Counted by rule (`state: COUNTED`, no `countedAt`, no `countedBy`); it never blocks and has no entries.
- **The number** is `DAY-{Site.code}-{nnnn}` from `ReferenceCounter` prefix `DAY` on the branch site, taken in the transaction that creates the day.

### 5.2 Opening stock

For a department and item on a day:
1. If the opening was checked, the accepted figure (`department_opening_lines.accepted_qty`): the same as last night's when accepted, the head's count when recounted.
2. Otherwise **last night's signed closing figure**: the closing figure (as corrected) of the item's line on the branch's latest earlier closed day.
3. If there is no such line (a new item, or no earlier closed day): the department location's ledger position at the start of the Nairobi day (every row created before 00:00 +03:00).

`lastNightQty` on the wire (B1, B2) is the figure in 2 or 3. The opening check shows it to the head by design.

### 5.3 Received and Waste

- **Received** = the sum of `DISPATCH_IN` ledger rows at the department's location created in the Nairobi day (what the department counted and confirmed).
- **Waste** = the sum of `waste_logs.quantity` at the department's location created in the Nairobi day that are not reversed when read. A reversed entry counts for nothing. Waste logged or reversed after the close does not change a closed day.

### 5.4 Closing stock and Used today

`closingQty` is the line's `counted_qty` (the evening count, as corrected). **Used today = opening + received − waste − closing**, a signed decimal; a negative figure (more on the shelves than the figures explain) is shown as it is and flagged to nobody. It is null until the department has counted. Values: `usedValueKes = used × unitCost`, `closingValueKes = closing × unitCost`, `unitCostKes` the department location's latest `DISPATCH_IN` cost else the item's current cost, read live on an open day and **frozen at the close** on the line (`unit_cost`); money at two decimals, half up.

### 5.5 Yesterday

The same item's frozen Used today on the branch's day **dated the calendar day before**, when that day is closed; otherwise null. Nothing is flagged.

### 5.6 The department card, the blockers and the heading

A department's card (`departmentTile`): `state`, who signed and when, the head's name, the item count, the opening check (`state` and its differences), and (cap) its Used value, null until counted. The **opening differences** are counted minus last night per item, never zero; the chip's words are the front end's (`openingChip`).

The blockers are facts in this fixed order, which is the order Paper draws (B5, B7, B14):
1. **The delivery line:** one `DELIVERY_NOT_CONFIRMED` (BLOCKS) per dispatch of the branch that is `ON_THE_WAY`, with its department, reference and signed time; otherwise one `DELIVERIES_CONFIRMED` (OK) carrying the open discrepancies (references and ids) that do not block.
2. **The count line:** one `DEPARTMENT_NOT_COUNTED` (BLOCKS) per department not counted; when every department has counted, one `ALL_COUNTED` (OK) with the last signing time and department.
3. **One `OPENING_NOT_CHECKED` (INFO) per department that has counted with its opening not checked** (the day "ran on last night's figure"; gap 13).

`summary.todo` = the number of BLOCKS, `summary.toKnow` = the number of INFO ("1 thing to do. 1 more to know about."). `canClose` = the day is OPEN and nothing BLOCKS.

### 5.7 Who the caller is

- **Department rule** (BD1 to BD10): an active user whose `department_id` names an ACTIVE department of their own branch. A person who holds `branch_day.read` or `read_any_branch` is never a department, so the Branch Manager's own `department_id`, if any, is ignored. A retired department's members cannot count (403 `NOT_YOUR_DEPARTMENT`).
- **On behalf:** `branch_day.count_on_behalf` for a department of the Branch Manager's own branch (`NOT_YOUR_BRANCH` otherwise). It counts a department that has **not** counted; it records `onBehalf` and the Branch Manager as the signer.
- **Reach for readers:** `read_any_branch` reads every active branch; `read` the caller's own branch. The System Admin names the branch (`branchId`); with none, Today takes the first branch by name.

### 5.8 Close (BD14)

One transaction, after the PIN is verified with the caller's own PIN (`countPin.verifyOwn`):
1. Lock the day row. Replay: a day already closed with the same `closeIdempotencyKey` returns the first result with `replayed: true`; any other key is `DAY_ALREADY_CLOSED`.
2. Re-check the blockers; any BLOCKS is `DAY_NOT_READY` with `details.blockers`.
3. For every line: freeze opening, received, waste, unit cost and used. A line of a department with no count (no items) has none.
4. For every line whose closing figure differs from the department location's ledger position: post one usage entry (§6.1). A line that moved nothing posts none.
5. Set the day CLOSED with the closer, the time, the day's `used_value` and `closing_value`, and the key. Make sheet version 1 (`AT_THE_CLOSE`).

The result carries the first five entries (department order, then item name) and the total count (B9: "Showing 5 of 41"). BD11 on a closed day carries the same five.

### 5.9 What the usage entry is, and what it can miss

The usage entry's quantity is `closing − ledger position now`, so after the close the ledger equals the count. With nothing else moving the department's stock that day it equals −Used today. Two things can move it, both rare: a **finding** a Store Manager records on a branch department's stock, and a **waste or delivery posted after the close** for a closed day. They are caught, not hidden: the entry nets them, and the next morning's opening recount shows the difference (the design's own safety net). Gap 2.

### 5.10 Correct a count (BD20)

One transaction after the PIN:
1. Lock the day. It must be CLOSED (`DAY_NOT_CLOSED`); the department must have counted (`DEPARTMENT_NOT_COUNTED`); the item must be a line of that department's day (`ITEM_NOT_IN_DAY`).
2. **The window:** refused with `CORRECTION_WINDOW_PASSED` when that department has an accepted opening (`department_openings`) on any later day of the branch. Replay by `idempotencyKey` first.
3. `closingQty` must differ from the line's current closing figure (`CORRECTION_NO_CHANGE`).
4. Post **one** `ADJUSTMENT` of `to − from` (§6.2), set the line's closing figure and used (`used −= to − from`), keep both figures in a correction row with the reason and note, update the day's `used_value` and `closing_value`, and make the next sheet version (`AFTER_CORRECTION`).
5. The wire status becomes CORRECTED. The original close, its entry and its sheet stay.

The same item may be corrected again; each correction starts from the figure then on the line.

### 5.11 History and the day file

History rows: the day number, the date, the branch, departments counted of the total (a department with no items counts as counted), the status, the closer, and (cap) the two values from the day's frozen totals. An open day shows "–" for both. The file's tracker (B11): openings checked n of total, counted n of total with the last time, closed time and by. `can.correct` is true for a `branch_day.correct` holder on a closed day; a department's `can.correct` is also false once its window has passed.

### 5.12 The day sheet

Made at the close (version 1) and after every correction (version n+1) from the same data as the file, stored whole (`branch_day_sheets.payload`, the shape of `daySheet`). Printing returns the stored copy with `printedAt` set to now; it writes nothing and is not an event. Pages: the cover is page 1; a department starts on the next page and takes `max(1, ceil(items / SHEET_ROWS_PER_PAGE))` pages (the constant is 16 on both sides; gap 11), so each department's `page` and the `pageCount` are known when the sheet is made. A corrected line carries the figure as signed and as corrected (the Wednesday figure struck through). The signatures and the QR (the day file's address) are on the last page only. The cover's notes list the departments whose opening was not checked and the discrepancies that were open and did not hold the close.

## 6. Ledger (always through `postStockMovement`)

### 6.1 The usage entries and the one door change

Type `ADJUSTMENT`, location the department's, item, quantity the signed difference (§5.9), `unitCost` the frozen unit cost, `reason` "Used today", `userId` the Branch Manager (the signer), link `branchDayLineId`. **The reference is the day number** (`DAY-NYR-0044`), not `ADJ-nnnn`. The door gets one small extension in the build: `PostStockMovementInput` takes an optional `reference`, allowed only for `ADJUSTMENT` with a `branchDayLineId` link; when given the door stores it and does **not** take a number from the `ADJ` counter. `ledger-door.test.ts` covers it (given, refused with another link or type, no counter taken). `ledger-guard.test.ts` loses its `branch-day-repository.ts` allow-list row in the same commit as the file.

### 6.2 The correction entry

Type `ADJUSTMENT`, the same location and item, quantity `to − from`, reference the day number, link `branchDayLineId` of the corrected line, `reason` "Count corrected: {reason text}". It does not use `reversesTransactionId` (the door allows a reversal only as the exact opposite of the original, which is not a correction). "Linked" means the day number on the entry, the line link, and the correction row's `transaction_id`. Nothing is edited or deleted.

### 6.3 The opening recount

Type `ADJUSTMENT`, link `openingLineId`, reason "Overnight variance", numbered `ADJ-nnnn` as before (only the day's usage entries carry the day number), one per line whose counted figure differs from the ledger position, quantity counted − ledger position. Accepting an opening posts nothing. The old `recomputeNextMorningOpenings` (rewriting a later opening after a re-close) goes with reopen.

## 7. Idempotency

The key is in the body. BD3 and BD5: `department_openings.idempotency_key` with `@@unique([branchDayId, departmentId])` (a duplicate resolves to the first). BD8: `branch_day_departments.count_idempotency_key`. BD14: `branch_days.close_idempotency_key`. BD20: `branch_day_corrections.idempotency_key` with `@@unique([branchDayId, idempotencyKey])`. BD7 and BD4 are naturally idempotent. A replay returns the first result with `replayed: true` and writes nothing.

## 8. Notifications, badges and sockets

**None.** Flow: "No alerts"; the map's row 15 (day closed) is "no alert"; the owner removed the unusual-figure and overnight alerts on 8 Oct. The two pushes in `fcm-service` are deleted. There is no badge feed in this contract: the Today badge Paper B5 draws is `summary.todo` on BD11, which the shell can read (gap 9). There is no socket event; screens refetch after a write and on focus (a later session may add one).

## 9. Audit and Activity

No events table. The Activity tab and the Audit log read the rows that already say who and when, so nothing can drift from them:

| Type | Row | Sentence (Paper B12b and B17) |
|---|---|---|
| `OPENING_ACCEPTED` | `department_openings` kind ACCEPTED | "Checked the opening: Barista, same as last night" |
| `OPENING_RECOUNTED` | kind RECOUNTED | "Recorded the opening: Milk 1L, 1 less than last night (8 → 7)" (several: "Recorded the opening: Barista, 3 differences") |
| `COUNT_SIGNED` / `COUNT_SIGNED_ON_BEHALF` | `branch_day_departments` counted | "Counted and signed: Housekeeping, 6 items" (on behalf: "… on behalf of Housekeeping") |
| `DAY_CLOSED` | `branch_days` closed | Activity: "Closed the day · Used today KES 50,060"; Audit log: "Closed the day · Used value KES 50,060 · signed with PIN" |
| `COUNT_CORRECTED` | `branch_day_corrections` | "Corrected a count: Flour 25kg (Pastry), closing stock 1 → 2", with the reason, the note and "Signed with PIN" |

Each carries its record link: the day number (`DAY` link), or the stock ledger entry for a correction. The Audit log's area `BRANCH_DAY` leaves `AUDIT_AREAS_WITHOUT_SOURCE` and becomes a derived source (`audit-log/sources/branch-day-source.ts`, like `branch-waste-source.ts`); the Branch Manager reads only their branch. Printing is not an event. Entries are never edited or deleted.

## 10. Data model: the expand migration (one migration, written and applied locally by the build's first commit)

Never `migrate dev` on production; generate locally (`npx prisma migrate dev --name block4_branch_day_expand`), commit beside the schema folder, test on a restored production copy. The old branch-day code keeps working on top of it: every new column is nullable or defaulted, and no column or enum value goes. Files: `prisma/schema/inventory/branch-day.prisma` (edit).

### 10.1 What it adds

| Table | Adds |
|---|---|
| `branch_days` | `used_value` and `closing_value` `Decimal(14,2)?` (frozen totals; corrections update them), `close_idempotency_key String?`, `@@unique([siteId, reference])`, `@@unique([siteId, closeIdempotencyKey])` |
| `branch_day_departments` | `department_id String?` (FK `departments`, **back-filled** from `department_tag` and the day's branch: `departments.organization_id = branch_days.organization_id AND departments.key = department_tag`), `on_behalf Boolean @default(false)`, `count_idempotency_key String?`, `@@unique([branchDayId, departmentId])`, `@@index([departmentId])` |
| `branch_day_lines` | `opening_qty`, `received_qty`, `waste_qty`, `used_qty` `Decimal(12,4)?` (frozen at the close), and `expected_qty` made **nullable** (the new code writes null) |
| `department_openings` | `department_id String?` (FK, back-filled the same way), `kind OpeningKind @default(ACCEPTED)` (back-filled RECOUNTED where any line has a non-zero overnight variance), `on_behalf Boolean @default(false)`, `idempotency_key String?`, `@@unique([branchDayId, departmentId])` |
| `branch_day_corrections` (new) | `id`, `branch_day_id`, `branch_day_line_id`, `from_closing_qty`, `to_closing_qty`, `from_used_qty`, `to_used_qty`, `reason BranchDayCorrectionReason`, `note String?`, `corrected_by_id`, `corrected_at`, `transaction_id String @unique` (the ledger row), `sheet_version Int`, `idempotency_key`, `@@unique([branchDayId, idempotencyKey])`, `@@index([branchDayLineId])` |
| `branch_day_sheets` (new) | `id`, `branch_day_id`, `version Int`, `kind BranchDaySheetKind`, `pages Int`, `payload Json`, `created_by_id`, `created_at`, `@@unique([branchDayId, version])` |
| enums (new) | `OpeningKind` (ACCEPTED, RECOUNTED), `BranchDayCorrectionReason` (COUNTED_WRONGLY, ITEM_WAS_MISSED, OTHER), `BranchDaySheetKind` (AT_THE_CLOSE, AFTER_CORRECTION) |

Not changed: `BranchDayStatus` (OPEN, CLOSED; Corrected is derived), `BranchDayDepartmentStatus`, `inventory_transactions` (the door only inserts; the append-only trigger is untouched), `DepartmentTag`, `reference_counters` (prefix `DAY` carries on). The migration also computes `closing_value` for old closed days (sum of `counted_qty × unit_cost`); their `used_value` stays null (§0.4).

### 10.2 Order of the build's commits

1. The expand migration, then the door's `reference` extension with its tests. 2. The services (`branch-day/`). 3. The deletions (§12). The contract migration is **not** in Block 4's PR (§11).

### 10.3 What must hold after it runs (the build's database test)

`branch_day_departments` and `department_openings` have no row with a null `department_id` for a branch that has the five departments; every `department_id` matches its row's `department_tag` through `departments.key`; the old code still creates and counts a day.

### 10.4 Production counts to paste back before the migration is written

The owner's read-only queries already listed in `final-pass-build-plan.md` ("Owner to run"): `SELECT status, count(*) FROM branch_days GROUP BY status;`, `SELECT count(*) FROM branch_day_reopens;`, `SELECT prefix, last_number FROM reference_counters WHERE prefix IN ('DSC','DAY','REQ','DSP');`, plus one more: `SELECT count(*) FROM inventory_transactions WHERE branch_day_line_id IS NOT NULL OR opening_line_id IS NOT NULL;`. If closed days exist, §0.4 applies to them; if the counts are small the owner may prefer to leave them out of History. Nothing here changes data.

## 11. The contract migration (separate and later; NOT written or run now)

A second migration, in its own PR after the owner's production check of Block 4 (and after Blocks 1 to 3 have run), named `block4_branch_day_contract`. It is irreversible, so it runs only after a snapshot.

### 11.1 What it drops

| Where | What |
|---|---|
| `branch_day_departments` | `department_tag` and its unique `(branch_day_id, department_tag)`; `department_id` becomes NOT NULL |
| `department_openings` | `department_tag` and its unique; `department_id` becomes NOT NULL |
| `branch_day_lines` | `expected_qty`, `reason`, `reason_note`, `reason_required` |
| `branch_days` | `reopen_count`; the table `branch_day_reopens` |
| enum `GapReason` | the type |
| `counting_thresholds` | the Branch rows (`organization_id` of a branch site) and the column `overnight_alert_kes` (the hub row, `director_alert_kes` and the Central Store columns stay: they belong to Counting) |
| `locations` | `department_tag`; the unique `(organization_id, type, department_tag)` is replaced by a unique `(organization_id, department_id)` for `BRANCH_DEPARTMENT` rows plus the existing partial unique index for the one Central Store |
| `inventory_items` | `department_tags[]` (the id link `item_departments` is the truth) |
| `requisition_sections` | `department_tag`; its unique `(requisition_id, department_tag)` is replaced by `(requisition_id, department_id)` first (an added department has a null tag, so only the id can be unique for it) |

### 11.2 Guard conditions (the migration refuses to run, or the PR is not merged, unless all hold)

1. **Zero readers.** A guard test fails while any file under `backend/src` (scripts included) or the front end reads or writes a dropped column by its Prisma field name (`departmentTag` on a location, item, branch-day department, opening or requisition section; `departmentTags`; `expectedQty`; `reason*`; `reopenCount`; the `BranchDayReopen` and `GapReason` types). The readers to rewire first are those listed by `grep departmentTag`: the audit log repository and service, the catalog (item chips and history), `stock-scope.ts`, counting setup, stock items, requisitions, deliveries, `department-links.ts` (the dual-write helper, deleted last), `location-repository`, the staff transfer and department repositories, and the seed scripts.
2. **No null id links.** `SELECT count(*) FROM branch_day_departments WHERE department_id IS NULL`, the same for `department_openings`, and `locations WHERE type = 'BRANCH_DEPARTMENT' AND department_id IS NULL`, are all 0.
3. **Enum and id agree.** For every row with both, `departments.key = department_tag` (a query per table returns 0 mismatches).
4. **No open work on the old shape.** No `branch_days` row is OPEN with a department counted under the old flow.
5. **A snapshot exists** and the owner has said go.

### 11.3 What it deliberately keeps

`users.department_tag`, `departments.key` and the enum `DepartmentTag`. The login token (`utils/jwt.ts`, `middleware/authenticate.ts`, `types/express.d.ts`), shift assignment, the workforce access rules (`sameDepartmentGroup`) and the old Staff › Departments service all read the user's enum. Retiring them is a Workforce change (carry `departmentId` in the token first), not a Branch day one. The `ledger-guard` and the dual-write helper keep writing the user column until then.

### 11.4 The restore-a-copy test (done before it runs on production)

1. Restore the production snapshot into a scratch database. 2. Apply every migration up to and including the expand migration (`prisma migrate deploy`); run the row-count and consistency queries of §10.3 and §11.2 and keep their output. 3. Run the backend's opt-in database tests against it. 4. Apply the contract migration; check it takes only short locks on these small tables and report how long it took. 5. Re-run the queries; the counts of days, departments, openings, lines and ledger rows are unchanged except for the dropped columns. 6. `prisma migrate diff` from the migrated copy to `prisma/schema` reports no difference. 7. Start the API against the copy and read Today, History and one day file as the Branch Manager and one head. 8. Drop the scratch database. The owner does the production steps.

## 12. Code placement

### 12.1 Back end (`backend/src/modules/inventory/branch-day/`, rebuilt in place)

```
README.md   branch-day-rebuild-routes.ts → becomes branch-day-routes.ts   branch-day-controller.ts   branch-day-service.ts (every rule)
branch-day-repository.ts (Prisma only)   branch-day-validators.ts (the contract's schemas)   branch-day.types.ts
branch-day-rules.ts (pure: opening, used, yesterday, blockers, window)   branch-day-view.ts (response builders)   branch-day-sheet.ts (the stored day sheet)
_shared/branch-day-contract.ts (+ .fixtures.json + .test.ts)   the frozen wire types
tests beside the code; opt-in branch-day.db.test.ts
```

Also: `stock/ledger/ledger-door.ts` (+ `ledger-rules.ts`, tests: the optional `reference`), `audit-log/sources/branch-day-source.ts` and `branch-day-repository.ts` (beside `branch-waste-source.ts`, with a case in `derived-sources.test.ts`), `_shared/central-store-access.ts` (the rows, done), `routes/index.ts` (one mount line, done).

**Deleted in the build's PR:** `branch-day-{calc,controller,repository,routes,service,validators}.ts`, `branch-day.types.ts` and the three old tests; `counting/{counting-thresholds.ts,thresholds-controller.ts,thresholds-repository.ts,thresholds-routes.ts,thresholds-service.ts,thresholds-validators.ts,thresholds.types.ts,count-calc.ts}` with their tests; `departmentLabel` in `stock/stock-service.ts`; the two pushes in `services/fcm-service.ts`; the `GET/PUT /inventory/thresholds` mount and the `/branch-day` mount; the allow-list row in `ledger-guard.test.ts`; the seed scripts `seed-branch-day-dev-fixtures.ts` and `seed-branch-day-history-dev-fixtures.ts` are rewritten for the new shape.

### 12.2 Front end (`frontend/features/inventory/branch-day/`)

```
components/ (phone: home, opening, recount, count, check and sign, every figure, sent, past days, one past day;
             desktop: today, figures, close drawer, closed banner, history, day file, correct drawer, activity, documents, day sheet (print))
hooks/   lib/   services/   store/ if needed   types/   README.md
_shared/types/branch-day-contract.ts (+ .fixtures.json + .test.ts)   the mirror, byte-identical fixtures
_shared/lib/branch-day-copy.ts (+ .test.ts)   the wording and states table (§14)
```

Pages (thin shells): the Branch Manager's and the hub roles' under `app/app/branch/(shell)/day/...` and `app/app/inventory/...` as the nav table says, the print page at `app/app/branch/day-print/[id]`, the heads' phone pages under the existing shell. Navigation only through rows in `components/app/shell/nav-table.ts` (Branch Manager: Day with Today and History, Waste; hub roles under Branches: the same; heads and members: Day and Waste in the drawer). Old components, hook, service and types are deleted in the same PR. Primitives from `components/ui2/` only. The sub-module's `index.ts` does not export the new mirror yet (the old type names clash); the switch belongs to the PR that deletes the old screens.

## 13. Screens covered, mapped to Paper

Phone, department head or member: B0 (BD1), B1 (BD2, BD3), B2 and B2b (BD4, BD5), B3 (BD6, BD7), B3b (BD8, BD6 summary), B3c (BD6, BD7), B4 (BD1), step 19 (BD9), step 20 (BD10). Desktop: B5, B7, B9, B14, B16 (BD11, BD13, BD14), B6 and the Items tab (BD12), B8 (BD13, BD14), B10, B10b, B10c (BD15), B11 (BD16, BD12), B12 and B12b (BD20, BD17), B13 (BD18), B13b to B13d (BD21), B15 (BD6 to BD8 for the Branch Manager), B17 (the Audit log source, §9), B18 (§14).

## 14. Wording and states

The words, chips, blockers, buttons and messages come from Paper step B18 and the copy drawn on B0 to B17 and chapter 5, and are in `frontend/features/inventory/branch-day/_shared/lib/branch-day-copy.ts` with a test that pins them. The back end sends facts and codes only. Per-screen loading, empty, error and permission lines use the one States kit and the table in that file; no per-screen state designs (B18 draws none). The figure names are Opening stock, Received, Waste, Closing stock, Used today, Yesterday, Used value (KES) and Closing stock value (KES); the day states Open, Closed, Corrected; the card chips Counted, Not counted, Opening not checked, "Opening 1 less · Milk 1L". The words **counted** (for the closing figure), **consumption**, **gap**, **unusual** and **reopen** never appear.

## 15. Test plan (the build and the front-end sessions)

Back end: state table for every pure function in §5 (opening 1, 2, 3; received and waste windows; used and yesterday; blockers in order; the correction window; the heading counts); every error code; the §3.1 grid with six roles plus a Branch Manager of another branch and a head of another department; the blind and money views (no money key in any head or member response, no opening, received, waste, used, yesterday or expected key in BD6 to BD8); the usage entries (balanced, linked, numbered with the day number, none for an unmoved item, idempotent close); the correction (one entry, both figures kept, totals and sheet version updated, a second correction, the window); opening accept and recount (no entry, variance entries `ADJ-`); the department rule with a retired department; `siteId` on every query; an open day made by the old code adopted; contract fixtures; the door's `reference` cases; `ledger-guard`; opt-in database tests (`branch-day.db.test.ts`, one file at a time) including the expand migration's back-fill and a concurrent first read of a day. Front end: the mirror test (done), the wording test (done), `nav-table.test.ts`, component tests for the blind count, the close drawer, the correct drawer and History (loading, empty, error, retry), keyboard and focus on the drawers. Both: backend `pnpm build` and `pnpm test`, frontend `pnpm build` and `pnpm test`.

## 16. Gaps this contract could not close from Paper alone

1. **Zero-use items** versus "43 usage entries" (§0.1).
2. **Other movements.** A finding on branch stock, or waste or a delivery posted after the close, is not in the Used today formula. The usage entry nets it and the opening recount shows it; Paper does not say what the manager should see (§5.9).
3. **An earlier day left open.** If nobody closed yesterday, it stays Open in History. Today shows only today. Closing it is possible through BD14 by id when every department has counted, but no screen reaches it, and heads cannot count a past day. Not drawn.
4. **A signed count before the close** cannot be changed (§0.7); Paper says only "tell the Branch Manager".
5. **A hub role with no branch picked** gets the first branch by name; the System Admin must name one to read a branch's History row for a single branch.
6. **The chip for several overnight differences.** B5 draws one ("Opening 1 less · Milk 1L"). The front end writes "Opening: 3 differences" until it is drawn.
7. **The Branch Manager checking an opening for a department** has no screen (B15 is the evening count). The API allows it; nothing builds a screen for it.
8. **When the head's one button changes from Check the opening to Count your department.** B0's note says "in the morning" and "evening". The back end switches at 12:00 Nairobi (`action`), and the opening card is always tappable until checked.
9. **The Today badge** (B5 draws "1" beside Today) has no badge feed; the shell can read `summary.todo` from BD11.
10. **Where the full list of usage entries lives.** B9 says "See all 43 in the day file" but the day file's tabs are Items, Documents and Activity. BD19 lists them; the screen is not drawn.
11. **Long departments on the printed sheet.** Paper draws a six-row department. `SHEET_ROWS_PER_PAGE` (16) is the contract's assumption; the build confirms it against the layout.
12. **Old closed days** (§0.4): History shows them with "–"; the day file shows closing figures only.
13. **"Opening not checked" in the morning.** Paper draws it in the evening; the contract lists it only once the department has counted.
14. **The correction window** is per department (§0.5); Paper words it for the branch.
15. **The correction note** is optional for all three reasons, as B12 draws ("NOTE · OPTIONAL"); Block 3 requires a note for "Other" on a reversal, this does not.
16. **B8's "See every line"** link target is not drawn; the contract assumes the department figures (BD12).
17. **Date and time zone.** Business date and every window are Africa/Nairobi; the sheet and Activity send ISO times and the screens format them.
18. **A surplus** (Used today negative) is shown as it is and flagged to nobody, by design.
19. **Retired department.** Not stated in Paper; a retired department's members cannot count (403), and a day already made keeps the department's row so the day can still close.
20. **Step 17's remaining rows** (Catalog, Purchasing, Requisitions, Dispatch, Discrepancies, Branch waste sentences) are other blocks' sources; only the Branch day rows are specified here.
