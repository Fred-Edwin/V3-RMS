# Inventory roadmap: what is left, in the order the owner chose

Set by the owner on 3 Oct 2026, after the Central Store roles pass (PR #66) and the sidebar tree (PR #67) were merged. One line per step; each step is its own agent session (Purchasing may take two). Tick a step off when it is merged.

| # | Step | Why it sits here | Needs first |
|---|---|---|---|
| 1 | **Paper catch-up** (work through [paper-updates-needed.md](paper-updates-needed.md)) **and the Purchasing design check** (does the approved Purchasing design still fit the access model and the sidebar? fix Paper if not) | Paper must agree with the code before more is built on it | Nothing |
| 1b | **Stock ledger door**: one function that every flow uses to post a stock movement, with tests (today 9 sub-modules write `inventoryTransaction` directly). Runs after the Company/Branch rename ([../../ROADMAP.md](../../ROADMAP.md)). **Done 4 Oct 2026 (PR #73, plus the database lock):** `postStockMovement` in `stock/ledger/`, Waste moved onto it, a guard test with an allow-list of the other 10 write sites that shrinks as steps 2 to 5 move their writers, and a database trigger that refuses `UPDATE`/`DELETE` on the ledger. Details in [stock/README](../../../backend/src/modules/inventory/stock/README.md) | Three rebuilds would otherwise invent three ledgers | Step 1 and the rename |
| 2 | **Purchasing + Receiving rebuild** (LPO instead of the shopping list; Accountant deposit, invoice and pay screens; "Orders to pay" replacing Supplier AP; routes onto the permissions table). **Old front-end deleted 4 Oct 2026; plan: mock-data front-end first for client demo (demo role switcher for the System Admin), back-end after approval. Mock Sessions 1 and 2 built (5 Oct 2026; Session 2 awaiting the owner's "merge"): the whole flow on curated mock data, from need to payment, the closed file, supplier orders and statement, audit log, the Attendant's phone views and every exception. Mock complete, awaiting client approval; then the back-end session builds from `purchasing-mock/backend-rules.md` and replaces the old purchasing code and tables** | The flow the client sees first and the one furthest from its approved design | Step 1 |
| 3 | **Prep rebuild** | Design approved | Step 2 |
| 4 | **Stock & counts rebuild** (Overview, All items, Daily count, Spot count, Stock ledger; opens them to the other desktop roles for reading) | Design approved | Step 3 |
| 5 | **Waste rebuild** | Design approved | Step 4 |
| 6 | **Requisitions, Dispatch and Branch day: design in Paper, owner approval, then rebuild** | Not designed yet. Open decision F4 (attendant on-hand in dispatch fulfil) is settled here, with the requisitions flow | Step 5 |
| 7 | **Dashboard and Reports for the Central Store: moved into the Reporting module** (step 7 of [../../ROADMAP.md](../../ROADMAP.md)), designed once with the other dashboards (start from [reports-spec.md](reports-spec.md)). Un-hide the sidebar links when built | They show numbers from every flow, so they come after the flows exist | Reporting module |
| 8 | **Phone versions for the desktop roles** (Store Manager, Accountant, Director, Branch Manager, System Admin): design in Paper, owner approval, then build | Deferred by the owner until all of the inventory is built | Step 7 |
| 9 | **Small findings and housekeeping** | Clean-up after the builds | Step 8 |

## Small findings (step 9)
- The old receipt row shows a KES price box to the attendant (the attendant must be blind to money).
- System Admin cannot sign old-flow documents yet (the rebuilt flows will use their own PIN).
- The older sidebars (Branch Manager, Accountant, Director) carry one "Central Store" link, not the tree.

## Housekeeping (step 9)
- After each merge: check the deploy run in GitHub Actions and the server disk (PR #64 prunes old images).
- Prepare the production demo; the rehearsal sheet is [demo-run-sheet.md](demo-run-sheet.md) and has stale steps.
- Rebuilt screens must use `requireCapability(...)` and the permissions table, never a new `requireRole(...)` list.
