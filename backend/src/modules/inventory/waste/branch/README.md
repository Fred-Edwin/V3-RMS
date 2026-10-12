# waste/branch

**Design:** approved (Paper: *Inventory · Branch waste*, W1 to W9, and step 55 on *Inventory · Counting redesign (Oct 7)*) · **Code:** back end built to the frozen contract (Block 3, 9 Oct 2026, on `feat/block3-be`, not pushed). The front end is the next session.

A branch's departments log what was thrown away; the Branch Manager reads the branch with values and reverses any entry; the hub desktop roles read any branch. It replaced `waste/department/` (the Department Head's three old endpoints under `/inventory/waste`), which is deleted, with its mount.

The frozen contract is [branch-waste-contract.md](../../../../../../docs/features/inventory/branch-waste-contract.md); in code it is the second half of `waste/_shared/waste-contract.ts` (BW1 to BW7) with `waste-contract.fixtures.json` and `waste-contract.test.ts`, mirrored by hand in `frontend/features/inventory/waste/_shared/types/waste-contract.ts`. Nothing in it changed in this build.

## Endpoints (base `/api/v1/inventory/branch-waste`, mounted from `routes/index.ts`)
| # | Method and path | Who |
|---|---|---|
| BW1 | `GET /items` | department rule (an active head or member of an active department) |
| BW2 | `POST /` | department rule. 201, or 200 with `replayed: true` for a repeated `idempotencyKey` |
| BW3 | `GET /mine` | department rule: the department's whole list, today and earlier (step 55); default window the last 7 Nairobi days |
| BW4 | `GET /branch` | `branch_waste.read` (Branch Manager, own branch; the System Admin the branch they stand in); default window today |
| BW5 | `GET /branches` | `branch_waste.read_any_branch` (Director, Accountant, Store Manager, System Admin); read only, `can.reverse` is always false |
| BW6 | `GET /:id` | a reader (capability), or the department rule; an entry outside the caller's reach is 404 |
| BW7 | `POST /:id/reverse` | `branch_waste.reverse_any` (Branch Manager own branch, System Admin any), or the department rule on an own entry logged today |

`/items`, `/mine`, `/branch` and `/branches` are registered before `/:id`, and `:id` only matches a uuid.

## Rules
- **The department rule** (`departmentCaller` in `branch-service.ts`): an active user whose `department_id` names an ACTIVE department of their own branch (not the hub). A person who holds `branch_waste.read` or `read_any_branch` is never a department. A retired department's members cannot log, list or reverse (403 `NOT_YOUR_DEPARTMENT`, with a plain message). `branch_waste.log` and `branch_waste.reverse_own` are held by no role in the access table.
- **Reach** (`reachOf`): `read_any_branch` reads every active branch; `read` reads the caller's own branch; otherwise the caller's own department. Every repository query carries `siteId` (a list of the branches in reach) and, for a head or member, `departmentId`. A branch entry is a `waste_logs` row whose location is a `BRANCH_DEPARTMENT` location; the Central Store's entries sit on the hub's `siteId` and never appear here.
- **No PIN anywhere.** Reversal reasons are `WRONG_ITEM`, `WRONG_QUANTITY`, `OTHER` (needs a note).
- **Blind view** (`branch-view.ts`, by capability through `blindnessOf`, never by role name): `valueKes`, `totalValueKes` and the four figures follow `catalog.see_costs`; `wentNegative` and the ledger rows on BW6 follow `restock.read`. A head or member never receives any of `BRANCH_WASTE_BLIND_KEYS`; the picker carries only the item's name and unit.
- **Ledger** (always `postStockMovement`): log = one WASTE row per entry at the department's location (made on first use by `deliveriesRepository.ensureDepartmentLocation`, in the same transaction); reverse = the same type with the opposite sign, `reversesTransactionId` set, in the same transaction as the `reversed_*` stamp and under a row lock, so a race is `ALREADY_REVERSED`. Negative stock is allowed and flagged (`wentNegative`), never blocked.
- **Value of an entry** is `quantity × the frozen unit cost`: the latest `DISPATCH_IN` cost at the department's location, else the item's current cost. A reversed entry reads `0.00`.
- **Windows** are Nairobi days, both included; `from` or `to` may be given alone. **Reverse window**: an own entry only on the Nairobi day it was logged (`branchReverseCheck`).
- **The four figures** (BW4, BW5) cover the scope's last 7 Nairobi days whatever the filters; captions are phrased from the data (`branch-kpis.ts`). Across branches (BW5) the Department filter lists each department name once and filters by `departmentName` (case-insensitive), so a name matches that department in every branch; BW4 keeps `departmentId`.
- **Notifications: none** (contract §7): no push, no badge, no socket event, no Inbox row.
- **Audit**: area `BRANCH_WASTE`, a derived source from `waste_logs` at branch department locations (`audit-log/sources/branch-waste-source.ts`): "Logged waste · Beef stew 2 kg · Expired" (no money) and "Reversed waste entry · …"; the link opens the item's stock card on that day. The Branch Manager reads only their branch.
- **Migration: none.**

## Files
`branch-routes.ts`, `-controller.ts`, `-service.ts` (every rule), `-repository.ts` (Prisma only), `-validators.ts` (the contract's schemas), `branch.types.ts`, `branch-rules.ts` (`branchReverseCheck`, `branchUnitCost`), `branch-view.ts` (the response builders), `branch-kpis.ts` (the four figures), `branch-row.ts` (the include).

## Tests
`branch-rules.test.ts`, `branch-kpis.test.ts`, `branch-service.test.ts` (the §3.1 grid for every endpoint and role, the department rule, blind keys, idempotency, the reverse window, scoping, ledger postings), `branch-routes.test.ts` (capability gates, 401, route order, strict bodies), and the opt-in `branch-waste.db.test.ts` (`DATABASE_URL=<the lane database> RUN_DB_TESTS=1 pnpm exec vitest run src/modules/inventory/waste/branch/branch-waste.db.test.ts`, one file at a time). The contract fixtures are parsed by `waste/_shared/waste-contract.test.ts`, and the front end's copy is compared byte for byte there. `ledger-guard.test.ts` pins that nothing here writes the ledger directly.

## Coupling
`stock/ledger/ledger-door`, `stock/_shared/{nairobi-time,person}`, `_shared/{central-store-access,blind-rule,wire}`, `deliveries/deliveries-repository` (`ensureDepartmentLocation`), `repositories/branch-repository`, `audit-log` (the source reads `waste_logs` itself). No other sub-module.

## Open for the owner
- BW4 for the System Admin needs a branch: they read the one they stand in, else 400. They read any branch through BW5.
- `resolveWasteScope` (`_shared/stock-scope.ts`) had no caller left once the old endpoints went, so it was deleted rather than narrowed to the Central Store.
