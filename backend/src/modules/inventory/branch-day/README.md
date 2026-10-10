# branch-day

**Design:** approved by the owner (Paper: *Inventory · Counting and closing*, B0 to B18 and chapter 5; flow in `branch-day-flow.md`) · **Code:** the contract is frozen in code (Block 4, 9 Oct 2026, on `feat/block4-contract`): Zod schemas, fixtures, the access rows, a placeholder router at `/inventory/branch-day`. **No service logic is written yet.** The old Milestone Six code below still runs, on the old routes, until the Block 4 build replaces and deletes it.

A branch's end-of-day count and close, and the next-morning opening. Each department head counts their own department blind on their phone and signs with their PIN; the Branch Manager reviews all departments, closes the day with a PIN, and corrects one item if it was wrong. The figure is **Used today** = opening stock + received − waste − closing stock. Nothing is reopened; the system flags nothing and asks for no reason.

The frozen contract is [branch-day-contract.md](../../../../../docs/features/inventory/branch-day-contract.md); in code it is `_shared/branch-day-contract.ts` with `branch-day-contract.fixtures.json` and `branch-day-contract.test.ts`, mirrored by hand in `frontend/features/inventory/branch-day/_shared/types/branch-day-contract.ts` (the fixtures are byte-identical). The owner decisions it needs are in §0 of the document.

## Endpoints (base `/api/v1/inventory/branch-day`, mounted from `routes/index.ts`; the router is a placeholder)
| # | Method and path | Who |
|---|---|---|
| BD1 | `GET /home` | department rule (an active head or member of an active department) |
| BD2 | `GET /opening` | department rule; `branch_day.count_on_behalf` may pass `departmentId` |
| BD3 | `POST /opening/accept` | the same. No PIN |
| BD4 | `POST /opening/recount/preview` | the same. Writes nothing |
| BD5 | `POST /opening/recount` | the same. PIN |
| BD6 | `GET /count` | the same. Blind |
| BD7 | `PUT /count` | the same |
| BD8 | `POST /count/sign` | the same. PIN |
| BD9 | `GET /mine/history` | department rule: the department's closed days, no costs |
| BD10 | `GET /mine/days/:id` | department rule: one past day, quantities only |
| BD11 | `GET /today` | `branch_day.read` (own branch) or `read_any_branch` (picker, read only) |
| BD12 | `GET /days/:id/departments/:departmentId` | a reader |
| BD13 | `GET /days/:id/close-summary` | `branch_day.close` |
| BD14 | `POST /days/:id/close` | `branch_day.close`. PIN |
| BD15 | `GET /history` | a reader |
| BD16 | `GET /days/:id` | a reader (the day file) |
| BD17 | `GET /days/:id/activity` | a reader |
| BD18 | `GET /days/:id/documents` | a reader |
| BD19 | `GET /days/:id/entries` | a reader |
| BD20 | `POST /days/:id/corrections` | `branch_day.correct`. PIN |
| BD21 | `GET /days/:id/sheet` | a reader (print data, every version kept) |

## Rules (the contract, §5 and §6)
- Used today = opening + received − waste − closing; Yesterday is the same item the calendar day before; values follow `catalog.see_costs` and are never sent to a head or member.
- What blocks the close: a department that has not counted, and a delivery that left the store and is not confirmed. An open discrepancy and a missing opening check never block.
- The close posts one usage entry per item that moved, through `postStockMovement`, each carrying `DAY-{code}-{nnnn}`; a correction posts one linked entry and is allowed until that department's next opening is accepted.
- No reopen, no thresholds, no reason prompt, no notification. Printing is not an audit event.

## What exists today
Contract, fixtures, tests, the six `branch_day.*` rows in `_shared/central-store-access.ts` (`branch-day-access.test.ts`), `branch-day-rebuild-routes.ts` (authenticates, no endpoint) and its one mount line. No migration yet: the expand migration is the build's first commit (contract §10); the contract migration comes later (§11).

## Old code still running (deleted by the build, contract §12)
`branch-day-{calc,controller,repository,routes,service,validators}.ts`, `branch-day.types.ts` and three tests: the Branch Manager enters every department's counts, reasons above a KES threshold, reopen, `CONSUMPTION`, the overnight and Director pushes. It imports `counting/count-calc`, `counting/thresholds-service` and `stock/stock-service` (`departmentLabel`), which go with it. `ledger-guard.test.ts` still allows its one direct ledger write.

## Coupling
`_shared/{central-store-access,reference-counter,wire}`, `stock/ledger/ledger-door` (+ one small `reference` extension in the build), `departments` (Block 1), `dispatch` and `discrepancies` (a delivery not confirmed blocks), `waste_logs` (Block 3), `audit-log` (a derived source `BRANCH_DAY`). No other sub-module.
