# counting / counts

**Design:** approved (Paper: *Inventory · Counting redesign (Oct 7)*, steps 8, 26, 47, 48) · **Code:** built.

## What it does
The read side of Counting: the **Counts** table with its KPI strip and chips (every desktop role), the Director's **flagged lines** and **repeat shortfalls**, and one count's full detail. Nothing here writes.

## Who can do what
| Who | Can |
|---|---|
| Store Manager, System Admin, Director, Accountant, Branch Manager | C1 to C5, with figures (`counts.read`) |
| Store Attendant | **C5 on their own count only**, blind (no stock figure of any kind). Everything else 403; someone else's count is 404 |

## Endpoints (base `/api/v1/inventory/stock`)
| # | Method | Path | Notes |
|---|---|---|---|
| C1 | GET | `/counts/summary?audience=` | the Manager's strip (Waiting for you, In progress, Exceeded the range 7 days, Longest without a count) or the Director's (Flagged to you, Net difference 7 days, Short 3 counts running, Longest). Chosen by capability (whoever may Mark seen gets the Director's); `audience` only matters to the System Admin, who holds both |
| C2 | GET | `/counts?status=&search=&page=&pageSize=` | status chip (all, waiting, inProgress, approved), search over reference, section, counter and item name, numbered pager. `differencesText` ("4 exceed · 32 within", "All within range", "Not signed yet") only for a caller who sees stock figures. "Unsectioned n" chip |
| C3 | GET | `/counts/flagged` | lines flagged to the Director, not-yet-seen first; `can.markSeen` only for `counts.acknowledge` and while unseen |
| C4 | GET | `/counts/repeat-shortfalls` | items whose LATEST signed line has a short streak of 3 or more, with their last three counts |
| C5 | GET | `/counts/:id` | one count through the one view builder (`../_shared/count-view.ts`). **Registered last**: `/counts/summary`, `/flagged`, `/repeat-shortfalls`, `/blank-sheet`, `/start-options` are literal paths that win |

## Rules
- The strips are built from words the screens draw (`counts-view.ts`): captions such as "Samrat · signed 07:42", "Summer · Peter, 14 of 28", "Net difference −KES 7,940", "6 days" / "Never".
- "Net difference 7 days" and "Exceeded the range" are the same lines: signed lines of the last 7 days that were outside the range, valued from the frozen figures.
- Mixed-role routes (`counts.read` or `counts.record`) leave the final say to the service for C5.

## Code map
`counts-routes/controller/service/repository/validators.ts`, `counts.types.ts`, `counts-view.ts` (KPI words, row words). Raw SQL is in the repository only.

## Tests
`counts-service.test.ts` (strips, rows, flagged, repeat, detail access), `../counting-routes.test.ts` (the §3.1 grid for all 30 endpoints and route order), `counts.db.test.ts` (opt-in `RUN_DB_TESTS=1`: every query runs; a three-counts-running shortfall shows up).

## Coupling
`../_shared/` (count-view via count-detail-reader, count-reads, count-state, count-people, count-time, count-format, counting-contract), `../../_shared/central-store-access`.
