# requisitions

**Design:** *Requisition and dispatch* page exists in Paper but is **not yet approved**; a walkthrough decisions file has not been written · **Code:** built to the old flow (Milestones Four), **pending redo**.

A branch asks the Central Store for stock. Rules below are the original description and still stand until the walkthrough replaces them.

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
