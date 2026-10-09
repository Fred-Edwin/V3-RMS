# waste/branch

**Design:** approved (Paper: *Inventory · Branch waste*, W1 to W9, and step 55 on *Inventory · Counting redesign (Oct 7)*) · **Code:** contract only (a placeholder router, no service yet).

A branch's departments log what was thrown away; the Branch Manager reads the branch with values and reverses any entry; the hub desktop roles read any branch. It replaces `waste/department/` (the Department Head's three old endpoints), which is **renamed** into this folder when the build lands.

The frozen contract is [branch-waste-contract.md](../../../../../../docs/features/inventory/branch-waste-contract.md); in code it is the second half of `waste/_shared/waste-contract.ts` (BW1 to BW7) with `waste-contract.fixtures.json` and `waste-contract.test.ts`, mirrored by hand in `frontend/features/inventory/waste/_shared/types/waste-contract.ts`.

## Endpoints (base `/api/v1/inventory/branch-waste`, mounted from `routes/index.ts`)
| # | Method and path | Who |
|---|---|---|
| BW1 | `GET /items` | department rule (an active head or member) |
| BW2 | `POST /` | department rule |
| BW3 | `GET /mine` | department rule: the department's whole list, today and earlier (step 55) |
| BW4 | `GET /branch` | `branch_waste.read` (Branch Manager, own branch) |
| BW5 | `GET /branches` | `branch_waste.read_any_branch` (Director, Accountant, Store Manager, System Admin) |
| BW6 | `GET /:id` | a reader, or the department rule |
| BW7 | `POST /:id/reverse` | `branch_waste.reverse_any`, or the department rule on an own entry of today |

## Rules
- No PIN anywhere. Heads and members are blind to money and stock; the Branch Manager and the hub desktop roles see value.
- Every stock movement through `postStockMovement` at the department's location; a reversal is the same type with the opposite sign, linked.
- No migration: `waste_logs`, `waste_batches`, the department-linked `locations` and the ledger's WASTE reversal path already exist.
- Notifications: none. Audit: a derived source `BRANCH_WASTE` from `waste_logs` at branch department locations (added by the build).

## Status
Contract frozen in code, access rows in `_shared/central-store-access.ts` (`branch_waste.*`), router mounted and empty. Not built: the service, repository, controller, validators, tests, the audit source, the removal of `waste/department/`.
