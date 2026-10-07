# counting / review

**Design:** approved (Paper: *Inventory · Counting redesign (Oct 7)*, steps 9 to 11 and 26) · **Code:** built.

## What it does
The Store Manager reviews a **SUBMITTED** count: decides every outside-range line, accepts the within-range group, approves with her own PIN. The Director marks flagged lines seen.

## Who can do what
| Who | Can |
|---|---|
| Store Manager, System Admin | C27 decide, C28 preview, C29 approve (`counts.resolve`) |
| Director, System Admin | C30 Mark seen (`counts.acknowledge`) |
| Accountant, Branch Manager, Store Attendant | nothing here (403) |

`requireHubActor` first. No `requireRole`.

## Endpoints (base `/api/v1/inventory/stock`)
| # | Method | Path | Notes |
|---|---|---|---|
| C27 | POST | `/counts/:id/decisions` | one line, several lines (one cause for all) or `group: WITHIN_RANGE`; `CLEAR` takes a decision back. Only outside-range lines take WRITE_OFF, MOVEMENT_LOGGED or RECOUNT_ASKED; only within-range lines are ACCEPTED. All or none. `COUNT_NOT_SUBMITTED` |
| C28 | GET | `/counts/:id/approve-preview` | every adjustment that will post, the accepted group, net, the Director note, the not-counted note |
| C29 | POST | `/counts/:id/approve` | own PIN. `LINES_UNDECIDED` (with the line ids), `INVALID_PIN`. A retried key returns the approved count (`replayed`) |
| C30 | POST | `/counts/seen` | only lines with `directorFlagged` and not yet seen; answers `{ seen }` |

## Rules
- **Writes nothing to stock:** "Log a missing movement" (kind kept, line reads "Movement logged · Dispatch") and "Ask for a recount" (line reads "Recount asked"; the screen opens Start a count with the item, C8/C9 `recountLineId`).
- **Approve** (one transaction under a lock on the count): one `ADJUSTMENT` per non-zero `WRITE_OFF` and `ACCEPTED` line through `postStockMovement`, quantity the frozen difference, unit cost the frozen cost, `countLineId` set, user the approver. All the adjustments or none (a door refusal rolls everything back). Lines at or above the frozen alert amount get `directorFlagged` and `directorAlert`; after the commit a Director push goes out (held in quiet hours). Lines of an Attendant's count are flagged **only** through the alert; the Manager reviewed them.
- Everything is computed from figures frozen at the counter's sign (`review-preview.ts`), never from later stock.

## Code map
`review-routes/controller/service/repository/validators.ts`, `review.types.ts`, `review-preview.ts` (pure: posting lines, alerting lines, the preview). Shared: `../_shared/count-reason.ts`, `count-state.ts`.

## Tests
`review-service.test.ts`, `review-routes.test.ts` (§3.1 grid, six roles), `review-service.db.test.ts` (opt-in `RUN_DB_TESTS=1`: submit, decide, approve end to end, wrong PIN writes nothing, gap-free ADJ numbers, Mark seen once).

## Coupling
`../_shared/` (count-record-repository, count-detail-reader, count-pin, count-notify, count-state, count-idempotency, count-reason), `../../stock/ledger/ledger-door`, `../../_shared/central-store-access`.
