# Inventory roadmap: what is left, in the order the owner chose

Set by the owner on 3 Oct 2026, after the Central Store roles pass (PR #66) and the sidebar tree (PR #67) were merged. One line per step; each step is its own agent session (Purchasing may take two). Tick a step off when it is merged.

| # | Step | Why it sits here | Needs first |
|---|---|---|---|
| 1 | **Paper catch-up** (work through [paper-updates-needed.md](paper-updates-needed.md)) **and the Purchasing design check** (does the approved Purchasing design still fit the access model and the sidebar? fix Paper if not) | Paper must agree with the code before more is built on it | Nothing |
| 2 | **Purchasing + Receiving rebuild** (LPO instead of the shopping list; Accountant deposit, invoice and pay screens; "Orders to pay" replacing Supplier AP; routes onto the permissions table) | The flow the client sees first and the one furthest from its approved design | Step 1 |
| 3 | **Prep rebuild** | Design approved | Step 2 |
| 4 | **Stock & counts rebuild** (Overview, All items, Daily count, Spot count, Stock ledger; opens them to the other desktop roles for reading) | Design approved | Step 3 |
| 5 | **Waste rebuild** | Design approved | Step 4 |
| 6 | **Requisitions, Dispatch and Branch day: design in Paper, owner approval, then rebuild** | Not designed yet. Open decision F4 (attendant on-hand in dispatch fulfil) is settled here, with the requisitions flow | Step 5 |
| 7 | **Small findings and housekeeping** | Clean-up after the builds | Step 6 |

## Small findings (step 7)
- The old receipt row shows a KES price box to the attendant (the attendant must be blind to money).
- System Admin cannot sign old-flow documents yet (the rebuilt flows will use their own PIN).
- The older sidebars (Branch Manager, Accountant, Director) carry one "Central Store" link, not the tree.

## Housekeeping (step 7)
- After each merge: check the deploy run in GitHub Actions and the server disk (PR #64 prunes old images).
- Prepare the production demo; the rehearsal sheet is [demo-run-sheet.md](demo-run-sheet.md) and has stale steps.
- Rebuilt screens must use `requireCapability(...)` and the permissions table, never a new `requireRole(...)` list.

## Not scheduled yet
- **Dashboard and Reports** for the Central Store: no design. They stay hidden from the sidebar. Start from [reports-spec.md](reports-spec.md).
- **Phone versions for the desktop roles**: deferred until all of the inventory feature is built.
