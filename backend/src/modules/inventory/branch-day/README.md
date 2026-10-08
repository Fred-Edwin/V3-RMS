# branch-day

**Design:** *Counting and closing* page in Paper, **approved by the owner (8 Oct 2026)**; flow in `branch-day-flow.md` · **Code:** built to the old flow (Milestone Six S3–S4), **pending redo** (Block 4 of `docs/features/inventory/final-pass-build-plan.md`).

A branch's end-of-day count and close, and the next-morning opening. Where the rules below disagree with Paper or `branch-day-flow.md`, Paper wins: heads count their own department blind, there is no reopen (Correct a count instead), no reason thresholds and no `CONSUMPTION` reason, and the figure is Used today.

## Who can do what
- **Branch Manager**: enters counts for all five departments on Today's day, adds reasons, signs and closes (PIN), reopens with a reason, sets the branch reason and overnight thresholds.
- **Department Head**: accepts or recounts the next-morning opening.
- **Director**: company-wide alert threshold; can reopen.

## Rules
- Close is enabled only when all five departments are counted, none is blocked by an unconfirmed dispatch, and every above-threshold gap has a reason. A department with no tagged items counts as done.
- Closing posts one adjustment per gap (ADJ-nnnn). Reopen with a reason reverses those adjustments with linked reversal rows; re-close writes fresh ones. History shows Closed / Reopened / Open only (no "never closed" flag).
- Opening prefilled from the signed close; a different figure is an overnight variance and writes an adjustment; the Branch Manager is alerted when over the overnight threshold. Overnight push needs a real phone.
- Branch gaps blend consumption and loss; `CONSUMPTION` is a reason option; default reason threshold KES 1,000.
- Aggregate branch views are always broken down by department.

## Endpoints
11 endpoints (generated from the route files; re-run if routes change).

| Method | Path | Roles |
|---|---|---|
| GET | `/branch-day/today` | MANAGER |
| GET | `/branch-day/history` | MANAGER |
| GET | `/branch-day/opening` | — |
| POST | `/branch-day/opening/accept` | — |
| GET | `/branch-day/:id` | MANAGER |
| GET | `/branch-day/:id/overview` | MANAGER |
| GET | `/branch-day/:id/departments/:tag` | MANAGER |
| PUT | `/branch-day/:id/departments/:tag/lines` | MANAGER |
| POST | `/branch-day/:id/close` | MANAGER |
| POST | `/branch-day/:id/reopen` | MANAGER, DIRECTOR |
| GET | `/branch-day/:id/document` | MANAGER |

## Code map
`branch-day-calc.ts`, `branch-day-controller.ts`, `branch-day-repository.ts`, `branch-day-routes.ts`, `branch-day-service.ts`, `branch-day-validators.ts`, `branch-day.types.ts`. 3 test files beside the code.

## Coupling
Uses `_shared/stock-scope`, `purchasing/receiving-repository`, `counting/count-calc`.
