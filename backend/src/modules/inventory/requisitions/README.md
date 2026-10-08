# requisitions

> **Block 1 status (8 Oct 2026):** the new API contract is frozen in code for the owner to read: `_shared/requisitions-contract.ts` (R1 to R22, Zod), `requisitions-contract.fixtures.json`, `requisitions-contract.test.ts`; the access rows are in `_shared/central-store-access.ts` (`requisitions.*`); `requisitions-rebuild-routes.ts` is a placeholder router mounted at `/inventory/requisitions`. **No service, repository or migration exists yet** (back end A). The text below describes the OLD Milestone Four code, which still runs at `/requisitions` until back end A deletes it in the same PR that lands R1 to R22. Spec: `docs/features/inventory/requisitions-contract.md`.

**Design:** *Requisition and dispatch* page in Paper, **approved by the owner (8 Oct 2026)**; flow in `docs/features/inventory/requisitions-flow.md` · **Code:** built to the old flow (Milestone Four), **pending redo** (Block 1 of `docs/features/inventory/final-pass-build-plan.md`).

A branch asks the Central Store for stock. Where the rules below disagree with Paper or `requisitions-flow.md`, Paper wins: there is no "Return a section", cycles are Morning, Afternoon and Extra, the Director may approve any requisition, and a head's send needs a PIN.

## Who can do what
- **Department Head** (phone): fills their own department's section only; sees only their slice of the catalog; opening count at start of day lives with branch-day.
- **Branch Manager**: reviews all five sections in one view, may change a quantity, delete a line, add a line; signs once (PIN). Hard gate: nothing reaches the store unapproved.
- **Store Manager/Attendant**: see approved requisitions in the dispatch queue.

## Rules
- One requisition per branch per cycle (typically morning/afternoon/evening, not fixed), with a section per department.
- Quantities are pre-suggested from restock level − on hand and freely editable (target under 5 minutes per department).
- A slow or skipping department never blocks the others; the manager can send with some sections empty.
- Any manager modification notifies the affected head with what changed.
- Urgent: notifies the Branch Manager and, if still unapproved after a period, the Director; never bypasses the signature.
- Lines are grouped by category (two levels for Kitchen); market items are a category, not a separate requisition.
- A started requisition can be cancelled. Terminology: "requisition", "Opening count"/"Closing count".

## Endpoints
14 endpoints (generated from the route files; re-run if routes change).

| Method | Path | Roles |
|---|---|---|
| GET | `/requisitions/history` | MANAGER |
| GET | `/requisitions/needs-approval` | MANAGER |
| POST | `/requisitions` | — |
| GET | `/requisitions` | — |
| DELETE | `/requisitions/:id` | — |
| GET | `/requisitions/:id` | MANAGER |
| POST | `/requisitions/:id/approve` | MANAGER |
| PATCH | `/requisitions/:id/sections/:departmentTag/approval` | MANAGER |
| POST | `/requisitions/:id/sections/:departmentTag/return` | MANAGER |
| POST | `/requisitions/:id/sections/:departmentTag/nudge` | MANAGER |
| GET | `/requisitions/:id/sections/:departmentTag` | — |
| PATCH | `/requisitions/:id/sections/:departmentTag/lines` | — |
| POST | `/requisitions/:id/sections/:departmentTag/submit` | — |
| POST | `/requisitions/:id/sections/:departmentTag/recall` | — |

## Code map
`requisitions-controller.ts`, `requisitions-repository.ts`, `requisitions-routes.ts`, `requisitions-service.ts`, `requisitions-validators.ts`, `requisitions.types.ts`. 2 test files beside the code.

## Coupling
Uses `catalog/inventory-repository`.
