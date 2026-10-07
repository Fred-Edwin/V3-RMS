# prep / review

**Design:** approved (Paper: *Inventory · Prep*, step 10 Needs a look band, step 11 review drawer, step 12 History export) · **Code:** built (Slice 4).

## Who can do what
| Who | Can |
|---|---|
| Store Manager, System Admin | read the queue and the count, **Mark reviewed** (`prep.review`), export |
| Accountant, Director, Branch Manager | read the queue and the count, export (`prep.read_flags`); cannot review |
| Store Attendant and everyone else | **403 on every route here.** The silent stock flag, `needsLook`, review fields and Needs a look never reach an Attendant |

Reads use `requireHubReader`, the one write uses `requireHubActor`. No `requireRole`.

## Endpoints
| # | Method | Path | Cap | Notes |
|---|---|---|---|---|
| 14 | GET | `/inventory/prep/needs-a-look` | `prep.read_flags` | `{ count, items }`, newest first, each item a `RunSummary` plus `reasons[]` |
| 15 | GET | `/inventory/prep/needs-a-look/count` | `prep.read_flags` | `{ count }`: the sidebar badge, one indexed count on `(organization_id, needs_look)` |
| 16 | POST | `/inventory/prep/runs/:id/review` | `prep.review` | idempotent (a reviewed run returns unchanged); `409 RUN_NOT_OPEN` for a cancelled or corrected run |
| 17 | GET | `/inventory/prep/runs/export` | `prep.read_flags` | same filters as `GET /runs` without paging; UTF-8 CSV with BOM; `422 EXPORT_TOO_LARGE` over 10,000 rows |

(#9 `GET /runs/summary` lives in `../runs/`.)

### The queue
A run is in Needs a look when it is `RECORDED` and `needs_look` is set. A cancelled run and a corrected original leave the queue even if they were flagged. Old runs from before the rebuild were never flagged (Q-3).

### Reasons (chips)
Built in `review-reasons.ts` from the run's own columns, in this order: "Low yield · 2 kg under usual" (or "High yield · … over usual"), one "Beef mince used more than expected" per ingredient that went over the stock, "Said: spillage" (what the Attendant told us), "Corrected".

### Export
Columns: When (Nairobi time), Run, Output, Made, Unit, Vs usual, By, Status, Reviewed by, and **Unit cost only with `prep.see_costs`** (the header follows the same rule, even with no rows). File `prep-history-<from>-<to>.csv` (`start` and today when the dates are open). Names that start with `= + - @` get a leading apostrophe so a spreadsheet does not run them as a formula.

## Route order
`review-routes.ts` is mounted **before** `runs-routes.ts` in `routes/index.ts` so `/runs/export` is found before `/runs/:id` (`/runs/summary` is registered ahead of `:id` inside the runs router). `review-routes.test.ts` pins both.

## Code map
`review-routes/controller/service/repository/validators.ts`, `review-reasons.ts` (chips), `review-csv.ts` (pure). The repository holds its own queries; it reads through `_shared/prep-run-repository.ts`'s `prepRunInclude` only. Tests: `review-service.test.ts` (reasons, review idempotency, export, summary), `review-routes.test.ts` (capability grid, route order, wire format), `review.db.test.ts` (opt-in, `RUN_DB_TESTS=1` with `DATABASE_URL` set: count equals the queue, review clears the flag).
