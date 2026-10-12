# Block 3: Branch waste, the contract (draft for owner freeze, 9 Oct 2026)

Governs: `branch-waste-flow.md` (design log), Paper page "Inventory · Branch waste" (W1 to W9) and step 55 on "Inventory · Counting redesign (Oct 7)" (chapter 11, "Kitchen waste, today and earlier"). **Paper wins.** Models followed: `stock-count-waste-contract.md` (the Central Store waste, W1 to W4) and `dispatch-contract.md` (department rule, own branch). Not frozen until the owner says so; the contract is written in Zod, fixtures and mirrors in the same change (the second half of `waste/_shared/waste-contract.ts`, "BRANCH WASTE (Block 3)", with the same fixtures file and test as the Central Store waste).

## 0. Owner decisions (9 Oct 2026)

1. **No photo on a waste entry.** Dropped from Block 3 and from the flow; no column, no storage, no screen.
2. **Reverse is one endpoint, BW7**, for own and any (the capability decides), as the Central Store W4.
3. **The defaults in this document are accepted:** a retired department's members cannot log; the System Admin reads and reverses any entry and cannot log (no PIN); step 55 shows the whole department's entries; BW6 (entry detail) stays, built from the flow text.

## 1. What was checked first (real schema and code, 9 Oct 2026)

| Question | Answer |
|---|---|
| What does `waste/department/` do today? | Three endpoints, `GET /inventory/waste/items`, `GET` and `POST /inventory/waste`, one entry per call, gated by `allowDepartmentHead(requireRole('STORE_MANAGER','STORE_ATTENDANT'))`, so **only a department head** (a `isDepartmentHead` user) can log; the scope comes from `resolveWasteScope` and the legacy `DepartmentTag` enum on the user and the location. No reverse, no filters, no pager, no KPIs, no Branch Manager. |
| Which tables? | `waste_logs` (already has `batch_id`, `reversed_at`, `reversed_by_id`, `reversal_reason`, `reversal_note`), `waste_batches` (unique `[siteId, userId, idempotencyKey]`), `inventory_transactions` (WASTE rows linked by `wasteLogId`), `locations` (a `BRANCH_DEPARTMENT` location carries `departmentId` since Block 1), `departments`, `item_departments`. |
| **Migration needed?** | **No.** Every column the flow needs exists: the entry's branch is `waste_logs.organization_id`, its department is `locations.department_id` of `waste_logs.location_id`, the batch and the reversal columns were added by the Central Store rebuild, the ledger door already has the WASTE reversal path (`ledger-rules.ts`, `reversal: 'WASTE'`), and an added department gets its location through the same `ensureDepartmentLocation` step Deliveries uses. |
| Access rows for waste today | `waste.read`, `waste.log`, `waste.reverse_own`, `waste.reverse_any`, all **Central Store** (hub site, `requireHubActor`/`requireHubReader`). The Branch Manager holds `waste.read` (the Central Store list) and nothing for a branch. A department head or member holds **no** capability from the table. |
| How does Block 5's My waste relate to step 55? | Step 54 (My waste, today and earlier) is the **Store Attendant's** screen on the Central Store: W3 `GET /inventory/stock/waste?scope=mine&from=&to=` (built in Block 5). Step 55 is its **branch twin** for a department head or member. It is the same screen shape (a date range, entries grouped by day, a pager, Reverse on the caller's own entries logged today) on a different endpoint: **BW3** below. It is *not* W3, because W3 is hub-only (`requireHubReader`) and a department member has no hub context. One difference by design (Paper 55): the department list shows **every entry of the department**, not only the caller's own. |

### Differences between the flow document and Paper or the code (Paper wins; none breaks a rule)

1. **Photo.** The flow says "an optional photo" and "photo" on the entry detail. No Paper screen (W1 to W7, 55) draws a photo, the Central Store waste has none, and there is no column or storage for one. **Left out, and dropped by the owner (§0).**
2. **Who sees the department's entries.** The flow says a member "sees their own entries for today". Step 55 shows the whole department's entries, today and earlier, with "you" on the caller's own rows. **Step 55 followed.**
3. **Who may log.** Today only heads can. The flow and W1 say "department head or member". **Members may log** (the department rule, by `departmentId`, §3).
4. **"Items it holds".** Today's rule is "items tagged to the department" (legacy tag). New rule: the item is live and linked to the caller's department in `item_departments`. A department never holds raw ingredients (`RAW_INGREDIENT` items are Central Store only), which this link already guarantees. Not "has stock": stock may be zero or negative and waste is never blocked.
5. **System Admin "can act with their own PIN".** Waste is never PIN-signed (owner, 8 Oct), so there is no PIN; the System Admin may **read and reverse any** entry (their own id is recorded), and cannot log (no department).
6. **Check screen.** The flow says the summary shows "the effect on stock (−3 kg Tomatoes)". W3 as drawn shows the lines and a notice only, and a head or member is blind to stock, so **no effect line and no preview endpoint**; the screen computes its own summary from the lines.
7. **Entry detail** ("who logged it, when, reason, photo and its ledger entry") is in the flow text, not drawn. **BW6 is built from the text, minus the photo** (§12 gap).
8. **Reverse own and reverse any** are one endpoint, **BW7**, as the Central Store W4 is: the capability decides the rule (`branch_waste.reverse_any`, or `branch_waste.reverse_own` plus the same-Nairobi-day rule). The prompt listed them as two; one route keeps the guard in one place.

## 2. Decisions that shape it

1. **Branch scope.** An entry belongs to a **branch** (`siteId`) and a **department** (the location's `departmentId`). Every query carries `siteId`.
2. **No PIN anywhere** (owner, 8 Oct 2026). Logging is a few taps on the phone; reversal is a reason (Logged the wrong item, Wrong quantity, Other, which needs a note).
3. **Reasons** are the approved list: Expired, Spoiled, Damaged in store, Prep error (values `EXPIRY`, `SPOILAGE`, `DAMAGE_IN_STORE`, `PREP_ERROR`, the existing enum). Reversal reasons `WRONG_ITEM`, `WRONG_QUANTITY`, `OTHER`.
4. **Heads and members are blind**: item names and units, never costs, never a stock figure. The Branch Manager and the hub desktop roles see value (they hold `catalog.see_costs`). Decided by `blindnessOf(actor)`, never by role name.
5. **Waste takes stock down once it is confirmed** and a reversal puts it back with a linked entry. Nothing is edited or deleted. Negative stock is allowed and flagged to whoever may see stock, never blocked.
6. **Used today.** Branch waste counts toward the day's **Used today** at the branch close; Block 4 reads `waste_logs` by branch, department and Nairobi day. No endpoint is added for it here.
7. **Reversed entries count for nothing** in the figures and read `0` in the Value column (W6, W9).

## 3. Access (`_shared/central-store-access.ts`, new rows)

Five capabilities. The client has not approved role names; each is a one-row edit. A department head or member holds **none** from the table: logging and reversing your own entry is the department rule in the service (an active member or the head of that department, found by `users.department_id`), the same shape as `deliveries.count`.

| Capability | Meaning | Held by |
|---|---|---|
| `branch_waste.log` | log waste for the caller's own department | **no role** (department rule: an active head or member) |
| `branch_waste.reverse_own` | reverse an entry the caller logged earlier the same Nairobi day | **no role** (department rule) |
| `branch_waste.read` | the branch's waste with values, own branch | Branch Manager, System Admin |
| `branch_waste.read_any_branch` | every branch's waste, read only, with a Branch column | Director, Accountant, Store Manager, System Admin |
| `branch_waste.reverse_any` | reverse any entry of the branch with a reason | Branch Manager (own branch), System Admin |

The Store Manager inherits none of `read`, `log`, `reverse_own`, `reverse_any` (named in `NOT_THE_STORE_MANAGERS`); they read through `read_any_branch`. `log` and `reverse_own` are in `DEPARTMENT_ONLY` (not held by the System Admin through "everything"). No new `requireRole` list on any route.

### 3.1 Role by endpoint (R read, W write, own = own department / own entry, — = 403)

| Endpoint | Head or member | BM | DIR | ACC | SM | SA (admin) |
|---|---|---|---|---|---|---|
| BW1 items, BW2 log (department rule) | W (own department) | — | — | — | — | — |
| BW3 my department's list (department rule) | R (own department) | — | — | — | — | — |
| BW4 branch list (`branch_waste.read`) | — | R (own branch) | — | — | — | R (needs a branch) |
| BW5 any branch (`branch_waste.read_any_branch`) | — | — | R | R | R | R |
| BW6 entry detail | own department | own branch | R | R | R | R |
| BW7 reverse | own entry, same day | any, own branch | — | — | — | any |

The route-by-role test asserts this grid for every endpoint with the roles above, plus a user of another branch refused.

## 4. API: base path and the endpoint table

Base `/api/v1/inventory/branch-waste`, envelope `{ success, data }`, wire rules in `_shared/wire.ts`. Every route has `authenticate`, a Zod schema, and `siteId` in every query. The old three endpoints under `/inventory/waste` stay mounted until the build deletes them (§9). `/mine`, `/branch`, `/branches` and `/items` are registered **before** `/:id`, and `:id` only matches a uuid.

| # | Method and path | Gate | Request, response (contract schema) |
|---|---|---|---|
| BW1 | `GET /items?search=&limit=` | department rule | `branchWasteItemsQuery` → `branchWasteItems`. The department's usual items (`often`: this person's most logged, up to 6) and the matching items (live, linked to the caller's department). `unit` always; `unitCost` and `onHand` **absent** for a head or member |
| BW2 | `POST /` | department rule | `logBranchWasteInput` → `logBranchWasteResult` (201; a repeated `idempotencyKey` returns the same batch with 200 and `replayed: true`). One transaction: one `WasteLog` and one WASTE ledger row per entry through `postStockMovement` at the department's location. Errors `ITEM_RETIRED`, `ITEM_NOT_IN_DEPARTMENT` |
| BW3 | `GET /mine?from=&to=&page=&pageSize=` | department rule | `myBranchWasteQuery` → `myBranchWasteList`. The caller's whole department, newest first. Default window: the last 7 Nairobi days, to today (Paper 55 "Date: Last 7 days"). Rows carry `can.reverse` (the caller's own entries logged today). `bannerText` is "2 items logged at 14:20. You can reverse your own entries today." when the caller logged a batch today, else `null`. Blind: no value, no stock |
| BW4 | `GET /branch?search=&departmentId=&reason=&status=&from=&to=&page=&pageSize=` | `branch_waste.read` | `branchWasteListQuery` → `branchWasteList`. The caller's own branch (W6): four figures, search and filters first, a table, the numbered pager. Default window: today (Paper "Date: Today"). `status` is `logged` or `reversed` |
| BW5 | `GET /branches?branchId=&search=&departmentId=&reason=&status=&from=&to=&page=&pageSize=` | `branch_waste.read_any_branch` | `allBranchesWasteQuery` → `branchWasteList` with a Branch column (W8). `branchId` absent means all branches. Read only: every row has `can.reverse: false`. `branches` lists the branch picker |
| BW6 | `GET /:id` | department rule, `branch_waste.read` or `branch_waste.read_any_branch` | `branchWasteDetail`. The entry; for a caller who may see stock (`restock.read`) also the ledger rows (`ledger`). A caller outside the entry's reach gets 404 |
| BW7 | `POST /:id/reverse` | `branch_waste.reverse_any`, or `branch_waste.reverse_own` rule | `reverseBranchWasteInput` → `branchWasteEntry`. **No PIN.** The original stays; a linked reversing ledger row (same type, opposite sign, `reversesTransactionId`) returns the stock and the entry is stamped `reversed_*` in the same transaction. Errors `NOT_YOUR_ENTRY`, `REVERSAL_WINDOW_PASSED`, `ALREADY_REVERSED` |

### 4.1 Shapes (the schemas in `branch-waste-contract.ts` are the source; this is the reading guide)

- **`branchWasteEntry`** = the Central Store `wasteEntry` (id, at, itemId, itemName, quantity, unit, reason, reasonText, note, loggedBy, `valueKes?`, status `LOGGED`/`REVERSED`, `reversal` with at/by/reason/reasonText/note or null, `can.reverse`) plus `department {id, name}` and `branch {id, name}`. `valueKes` is present only with `catalog.see_costs`; a reversed entry reads `"0.00"`.
- **`logBranchWasteInput`**: `entries` (1 to 30 of `{ inventoryItemId, quantity > 0, reason }`), `note` (one optional note kept on every entry, max 500), `idempotencyKey` (8 to 64 characters). **Strict**: a `locationId`, `departmentId` or `pin` is a 400, because the department comes from the caller.
- **`logBranchWasteResult`**: `entries`, `totalValueKes?` (cap `catalog.see_costs`), `wentNegative?` (cap `restock.read`), `replayed`.
- **`branchWasteList`** (W6, W8): `kpis?` (four cells, cap `catalog.see_costs`: **Today** `KES · 9 entries` (BW5 adds `· 2 branches`), **Last 7 days** `KES · 41 entries`, **Most wasted** (the item, `KES 3,600 · Kitchen · mostly expired`), **Reversed · 7 days** (a count, `Both by their own department`); the server phrases the captions, the screen draws them), `rows`, `departments` (the Department filter's options, id and name, all of the branch's, or of the picked branch), `branches?` (BW5 only: the picker), `page`.
- **`myBranchWasteList`**: `department {id, name}`, `rows` (no money), `bannerText`, `page`.
- **`branchWasteDetail`**: `entry` and `ledger?` (cap `restock.read`: `{ kind: 'LOGGED' | 'REVERSAL', at, quantity }`, signed as stored).
- **W8 Department filter (owner, 9 Oct 2026):** BW5's `departments` lists each department name once (the id is the first branch's), and BW5 takes `departmentName` (case-insensitive), which matches that department in every branch. BW4 keeps `departmentId`.
- **Four figures** count entries that are not reversed for Today, Last 7 days and Most wasted (value × quantity at the cost frozen when logged); **Reversed** counts reversals made in the last 7 days.

### 4.2 Money and blind rules

| Caller | Sees |
|---|---|
| Department head or member | item names, units, quantities, reasons, who logged, the department's whole list (BW3). **Never** `valueKes`, `unitCost`, `totalValueKes`, KPIs, `onHand`, `wentNegative`, `ledger`. |
| Branch Manager, Director, Accountant, Store Manager, System Admin | everything above plus `valueKes`, the four figures, and (`restock.read`, which all five hold) `wentNegative`, `onHand` in the picker (only the department picker is BW1, so they never see it) and the `ledger` rows on BW6 |

A contract test pins that no response a head or member can reach carries any of those keys.

## 5. State and rules (pure functions, table-tested in the build)

- **May reverse**: `ALREADY_REVERSED` first; `branch_waste.reverse_any` reverses any entry of the caller's branch (the System Admin any branch); otherwise `branch_waste.reverse_own` rule: the caller logged it **and** it was logged on today's Nairobi day, else `NOT_YOUR_ENTRY` or `REVERSAL_WINDOW_PASSED`. It is the one rule behind `can.reverse` on every row and behind BW7 (the Central Store `waste-rules.ts` `reverseCheck`, reused through a branch-aware wrapper).
- **Department rule**: an active head or member of an **active** department of the branch, from `users.department_id`. A person keeps their department when it is retired; whether a retired department may still log is a gap (§12).
- **Entry value** (BW4/BW5) is `quantity × frozen unitCost`, `0` when reversed. Unit cost is frozen on `waste_logs.unit_cost` when logged: the latest `DISPATCH_IN` cost at that department's location, else the item's current cost (today's rule, kept).
- **Date windows** are Nairobi days, both included. `from` and `to` may be given alone.

## 6. Ledger (always through `postStockMovement`)

Log: one WASTE row per entry at the department's location, stored negative by the door, `links: { wasteLogId }`, `reason` the reason name, `userId` the caller. Reverse: the same WASTE type with the opposite sign through the door's reversal path (`reversesTransactionId`, one reversal per row, never reversed again), in the same transaction as the `reversed_*` stamp. `ledger-guard.test.ts`: the old `waste/department/waste-service.ts` direct writer moves out of the allow-list when the old file is deleted, in the same commit.

## 7. Notifications

**None by default** (design log: "Alerts: none by default; large entries are visible in the Branch Manager's table"). No push, no badge, no socket event. The product Inbox is chat only: no Inbox rows.

## 8. Audit

Audit area `BRANCH_WASTE` (already in the Area menu, listed in `AUDIT_AREAS_WITHOUT_SOURCE` until now) becomes a **derived source** from `waste_logs` at branch department locations, like the Central Store `WASTE` source: an entry **logged** (at `createdAt`) and an entry **reversed** (at `reversedAt`, reason in the sentence). Sentence as Paper step 60: "Logged waste · Beef stew 2 kg · Expired". Record link: that item's stock card (the department's ledger entry). The Branch Manager reads only their branch. No new table. The source is added by the back-end session, not this contract session.

## 9. Code placement and the rename

Back end `backend/src/modules/inventory/waste/branch/` (today's `waste/department/` **renamed** `branch/`): `README`, `branch-routes.ts`, `-controller`, `-service`, `-repository`, `-validators`, `branch.types.ts`, tests beside the code. The frozen contract is the second half of `waste/_shared/waste-contract.ts` (BW1 to BW7), with its samples in `waste-contract.fixtures.json` and its tests in `waste-contract.test.ts`, the same files as the Central Store waste. Mounted at `/inventory/branch-waste` from `routes/index.ts` (one line, landed in the contract session).

| Old | Fate (back-end session) |
|---|---|
| `waste/department/waste-{routes,controller,service,repository,validators}.ts`, `waste.types.ts`, `waste-contract.test.ts`, `waste-service.test.ts` | **Deleted** when `branch/` replaces them (the new service reuses the item-cost rule `resolveWasteUnitCost` and the repository's `latestDispatchInCost`, ported with their tests first). The mount line `apiRouter.use(wasteRoutes)` goes in the same commit |
| `_shared/stock-scope.ts` `resolveWasteScope` | The `isDepartmentHead` branch is deleted; it becomes Central Store only |
| `ledger-guard.test.ts` allow-list row for the old waste service | Removed in the same commit as the file |

Front end `frontend/features/inventory/waste/branch/{components,hooks,lib,services,types}` (today's `waste/department/` renamed), the mirror at `waste/_shared/types/branch-waste-contract.ts`, wording at `waste/_shared/lib/branch-waste-copy.ts`, and the `department-waste` nav row's `newHref` moves from `/app/branch/waste/new` to the new route (a front-end session job; no nav change here).

## 10. Wording (Paper W9) and states

The words, buttons and messages come from W9 and are in `branch-waste-copy.ts`. Per-screen loading, empty, error and permission lines use the one States kit and the table in that file; no per-screen state designs.

## 11. Test plan (back end and front end, the sessions that build)

State table for `reverseCheck`; every error code; blind view builders (no money, no stock key in any head or member response); the grid in §3.1 with six roles plus a user of another branch; ledger postings for log and reverse (balanced, linked, idempotent); a replayed `idempotencyKey` makes one batch; `siteId` on every query; contract fixtures; opt-in database tests; the Branch Manager's own-branch rule; BW5 `can.reverse` always false.

## 12. Gaps this contract could not close from Paper alone

1. ~~Photo~~: dropped by the owner (§0).
2. **Entry detail** (BW6) is not drawn: its shape is the entry plus the ledger rows (kept by the owner, §0), and the screen must be drawn or the endpoint left unused.
3. **Retired department**: not stated in Paper. Accepted default (§0): the department rule requires an **active** department, so logging is refused with a plain 403.
4. **A branch with no location for the department yet**: BW2 creates it through `ensureDepartmentLocation`, as Deliveries does (no owner decision needed).
5. **The Department filter for a head or member** is not drawn (step 55 has a date only); BW3 takes `from` and `to` only.
6. **Reversed figure caption** "Both by their own department" is Paper's sample text; the server phrases it from the data ("Each by its own department", "1 by Grace W.").
