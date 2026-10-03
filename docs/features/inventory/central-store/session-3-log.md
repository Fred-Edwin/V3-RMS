# Central Store catalog — Session 3 log (Part B services, B9–B13)

Date: 2026-10-03 · Branch: `feat/central-store-catalog-services-2` (from `main` @ `6628606`) · Not pushed, not merged.
Backend only. One migration (owner-approved, see questions). No file moved or renamed; new files follow the flat layout.

## Questions asked and answered (owner, in session)
1. **B10 — which branch?** Department restock levels live per branch location, and the plan's `scope` was only a department tag. Owner asked what I meant; answer: yes, the Store Manager sets levels per branch department, but "Kitchen" alone doesn't say which branch's kitchen, so the request also carries the branch. **Built as `scope` + `branchId`** (required for a department scope, rejected with `CENTRAL_STORE`). *The owner's answer to the multiple-choice was a clarifying question, not a pick; my recommendation was the one built. Please confirm.*
2. **B10 — audit.** Owner chose a **new `restock_level_changes` table** (migration `20261003031835_restock_level_changes`).
3. **B11 — suggestions.** The plan had no formula. Owner: "why can't we just come up with the best formula?" So I implemented a **provisional** one (below) rather than returning null. It is flagged for sign-off.

## Plan vs code conflicts found (all resolved above or flagged below)
- B13 said "extend the existing summary in inventory-service.ts". **No such summary existed** → built a new endpoint.
- B12 said "confirm the attendant stays blind to money". **He was not**: `GET /inventory/items` and `/:id` returned `currentCost`, the Central Store level, preferred supplier and supplier prices to the attendant. Fixed for reads as well as the create response.
- B10 `scope` needed a branch (above). B11 "suggestions differ" had no formula (above).

## What changed (by item)
- **B9 Housekeeping** — verification, no code gap. `HOUSEKEEPING` is already a `DepartmentTag` and is accepted by item `departmentTags`, the list filter, restock scoping, requisition / dispatch / branch-day validators and department-head assignment. A Housekeeping head is `isDepartmentHead` + `departmentTag: HOUSEKEEPING` on a base role (like Kitchen/Service); **no new `UserRole`, no schema change**. Tests prove it end to end (item tag, filter, restock scope, head lists/saves own department only).
- **B10** — `GET/PUT /inventory/restock-levels` accept `scope` (+ `branchId`, `reason`); legacy `locationId` still works. Department heads still limited to their own department (any scope/branch/location → 403). Items must be tagged for that department (403 otherwise). Every change is written to `restock_level_changes` in the same transaction (who, for which location, old → new, reason); unchanged saves log nothing; the inline Central Store level on item create/update is logged too.
- **B11** — catalog `meta` gains `needsSetup`, `lowOrOut` (SM only, else null), `addedThisWeek`; `?needsSetup=true` list filter sorted oldest first. `GET /inventory/restock-levels/summary`, `GET /inventory/suppliers/summary`, `GET /inventory/suppliers/:id/catalog-summary`. Restock rows gain `status`, `suggestedLevel`, `suggestionNote`.
- **B12** — `POST /inventory/items` is SM + SA. Attendant: `PREPPED` → **403**; may not set category, preferred supplier, used-by departments or restock level (**403**); response and reads omit `currentCost`, `centralStoreRestockLevel`, `preferredSupplier(Id)` and supplier line prices.
- **B13** — new `GET /inventory/items/:id/change-review` (SM): `onHandQty, locationsHoldingStock, stockEntries, receipts, receiptLines, openOrders, hasHistory`; always numbers, never null.

## Definitions flagged for the owner (provisional or judgement calls)
1. **Needs setup** = live item with `lower(trim(usageUnit)) = lower(trim(buyUnit))` **and** no `packSize` **and** no `conversionFactor`. Matches the seeding (145 of 214 today). Limit: an item genuinely bought and used in one unit with no conversion stays flagged until someone enters a conversion factor (even 1). A clean fix needs a "setup confirmed" column (schema) — not done.
2. **Suggested level** (`restock-suggestion.ts`, constants in one place): use = −Σ ledger of `PREP_CONSUME, DISPATCH_OUT, WASTE, SALE` at that location; needs 14 days since the first use row ("Needs 14 days of use first"); average over min(30, history) days × **15 days of cover for every item**, rounded up to 2 dp. **Suggestions differ** = level set, suggestion exists, >20 % apart. Per-item days of cover (5 for perishables) is not modelled.
3. **Out / Low** need a level set: `OUT` = level set and on-hand ≤ 0; `LOW` = 0 < on-hand < level. Items with no level are `NO_LEVEL`, not "out".
4. **Profile 4 of 7** = name · type · phone · address (not "—") · contact person (a contact whose name differs from the supplier's) · payment details (≥1 pay method) · KRA PIN. This reproduces "4 of 7" for a freshly added supplier. The 7 are my reading of the walkthrough; confirm.
5. **Supplier Catalog tab "price alerts"** counts alert lines on signed receipts in the **last 90 days** (the existing all-time `/summary` count is unchanged).
6. **Attendant create** allows name, type, units, conversion, pack only — stricter than "type only", following the walkthrough ("No prices or stock"; Needs-setup lets the manager add category, supplier, departments).

## Commands run
`git checkout -b feat/central-store-catalog-services-2` (from main) · `npx prisma migrate status` (up to date) · `npx prisma migrate dev --name restock_level_changes` (local only; file reviewed: one CREATE TABLE, 2 indexes, 4 FKs, nothing else) · `npx vitest run src/modules/inventory` · `cd backend && pnpm build && pnpm test`.
**Result: `pnpm build` clean; `pnpm test` 102 files / 1455 tests passed** (was 98 / 1387 at the end of Session 2). Frontend untouched, `pnpm build` there not run.

## Postgres evidence
The MCP is read-only, so the real services were run against a scratch clone (`CREATE DATABASE scratch_s3 TEMPLATE wendo_rms`), then queried with `psql`. Script and clone deleted (`select datname … like 'scratch%'` → none).

- **Housekeeping item + restock row:** created `S3 Test Floor Cleaner` (`department_tags = {HOUSEKEEPING}`); `restock_levels` row at `Nyeri Town — Housekeeping`, level `8.0000` (after SM 20 → 25, then the Housekeeping head 25 → 8). Town Housekeeping page = 14 rows = 14 Housekeeping-tagged live items (SQL).
- **SM saving another department's level, and the log (psql):**
```
 item                  | location                  | old_level | new_level | changed_by                        | reason
 S3 Test Floor Cleaner | Nyeri Town — Housekeeping |           |   20.0000 | Grace Wanjiku (Store Manager)     | Opening the new wing
 S3 Test Floor Cleaner | Nyeri Town — Housekeeping |   20.0000 |   25.0000 | Grace Wanjiku (Store Manager)     |
 S3 Test Floor Cleaner | Nyeri Town — Housekeeping |   25.0000 |    8.0000 | Kelvin Kings (Kitchen head, Town) |   (head's own save; the Housekeeping-head actor was a stand-in using that user's id)
 Air freshener / Aluminium foil / Arrow roots | Central Store | (null) | 10.0000 | Grace Wanjiku (Store Manager) |
```
  A department head asking for `scope: KITCHEN` got `403 "Department Heads set restock levels for their own department only"`.
- **KPI counts vs hand SQL:**

| Count | Service | Hand SQL |
|---|---|---|
| needs setup | 145 | 145 |
| items tracked / added this week | 215 / 215 (216 after the tomato tin) | 216 live / 216 created < 7 days |
| lowOrOut (Central Store) | 2 | Air freshener LOW (4 < 10), Aluminium foil OUT (0), Arrow roots OK (40) → 2 |
| restock summary | total 215, out 1, low 1, ok 1, noLevel 212, differ 1 | 3 levels set → 212 without; Arrow roots: 180 used in the 30-day window → 6/day × 15 = **90** vs level 10 → differs |
| Town Housekeeping summary | total 14, out 1, noLevel 13 | 14 tagged items, one level (8, on-hand 0) |
| suppliers | active 7, onHold 0, profileNotFinished 7, owed 0.00, suppliersOwed 0 | 7 ACTIVE; 0 suppliers pass all 7 checks; positive-balance invoices sum 0 |
| Samrat catalog | itemsTheySell 30, priceAlerts 0, lastReceiptAt null, spend 0.00 | 30 distinct items; no signed receipts in the data |

  *The owed / spend / price-alert paths have no non-zero rows in this database; their arithmetic is covered by unit tests with built rows.*
- **Attendant:** created `S3 Test Tomato Tin` (`RAW_INGREDIENT`; row has `current_cost 0`, no category / supplier); the response had none of `currentCost`, `centralStoreRestockLevel`, `preferredSupplier(Id)`. `PREPPED` → `Error: Store Attendants can add stocked and raw-ingredient items only` (403 via `ForbiddenError`); setting a restock level → 403. `lowOrOut` for the attendant: `null`.
- **Zero-count review:** `{"onHandQty":"0","locationsHoldingStock":0,"stockEntries":0,"receipts":0,"receiptLines":0,"openOrders":0,"hasHistory":false}`. An item with ledger rows: `onHandQty "40", stockEntries 3, hasHistory true`.
- **MCP on `wendo_rms`:** `restock_level_changes` exists (0 rows), migration recorded, 13 live Housekeeping items, needs-setup SQL = 145, 0 leftover `S3 Test%` rows.

## Files touched
Docs: `docs/API_CONTRACT.md` (new §29, §21.3 row), `docs/DATA_MODEL.md` (§4.51a), this log.
Schema: `backend/prisma/schema.prisma`, `backend/prisma/migrations/20261003031835_restock_level_changes/migration.sql`.
Inventory module (new): `restock-suggestion.ts` (+test), `supplier-summary.ts`, `supplier-summary.test.ts`, `central-store-b9-b13.test.ts`, `restock-level-change-log.test.ts`.
Inventory module (edited): `inventory-service.ts`, `inventory-repository.ts`, `inventory-validators.ts`, `inventory.types.ts`, `inventory-controller.ts`, `inventory-routes.ts`, `supplier-service.ts`, `supplier-repository.ts`, `supplier-validators.ts`, `supplier-controller.ts`, tests `inventory-service.test.ts`, `inventory-contract.test.ts`, `supplier-test-fixtures.ts`.
**Outside the module:** `backend/tests/inventory-catalog.test.ts` — the old assertion "POST /inventory/items blocks attendant (403)" is now false by design (B12); replaced by four route-level tests (attendant admitted, PREPPED → 403, waiter still 403, attendant PATCH still 403).

## Surprising / for the owner
- The attendant could read item cost and the Central Store level before this session (fixed).
- `restock_levels` is empty in every location of `wendo_rms`; the seed's `centralStoreLevel` values were never written. The restock page will start with everything `NO_LEVEL`.
- Local `wendo_rms` already has the new table (`migrate dev`). Production gets it from `migrate deploy` on merge.
- The change log has no read endpoint yet (History / Put back is Part C).
