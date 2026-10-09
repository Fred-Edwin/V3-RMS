# counting / counts

**Design:** approved (Paper: *Inventory · Counting redesign (Oct 7)*, steps 8, 26, 47, 48; chapter 11 steps 52, 53 for C31 and C32) · **Code:** built (C31 and C32 added by Block 5 back end, 9 Oct 2026; the front end is the next session).

## What it does
The read side of Counting: the **Counts** table with its KPI strip and chips (every desktop role), the Director's **flagged lines** and **repeat shortfalls**, one count's full detail, and the Attendant's own **front door** (C31) and **count history** (C32). Nothing here writes.

## Who can do what
| Who | Can |
|---|---|
| Store Manager, System Admin, Director, Accountant, Branch Manager | C1 to C5, with figures (`counts.read`) |
| Store Attendant | **C5 on their own count only**, blind (no stock figure of any kind), and **C31 and C32** (their own front door and history, blind). Everything else 403; someone else's count is 404 |
| Store Manager, System Admin | also C31 and C32 (`counts.record`), about **their own** counts and waste only: holding `counts.read` never widens C32 to other people's counts |
| Director, Accountant, Branch Manager | C31 and C32 are 403 (no `counts.record`) |

## Endpoints (base `/api/v1/inventory/stock`)
| # | Method | Path | Notes |
|---|---|---|---|
| C1 | GET | `/counts/summary?audience=` | the Manager's strip (Waiting for you, In progress, Exceeded the range 7 days, Longest without a count) or the Director's (Flagged to you, Net difference 7 days, Short 3 counts running, Longest). Chosen by capability (whoever may Mark seen gets the Director's); `audience` only matters to the System Admin, who holds both |
| C2 | GET | `/counts?status=&search=&from=&to=&page=&pageSize=` | **Lane 0 (8 Oct 2026): `from` and `to` are Nairobi days, both included, either alone, cut on when the count started; the status chip numbers follow them; `from` after `to` is a 400. A count waiting for approval is always listed, whatever the range (owner decision), and the rows, total and chip numbers share that rule.** Status chip (all, waiting, inProgress, approved), search over reference, section, counter and item name, numbered pager. `differencesText` ("4 exceed · 32 within", "All within range", "Not signed yet") only for a caller who sees stock figures. "Unsectioned n" chip |
| C3 | GET | `/counts/flagged` | lines flagged to the Director, not-yet-seen first; `can.markSeen` only for `counts.acknowledge` and while unseen |
| C4 | GET | `/counts/repeat-shortfalls` | items whose LATEST signed line has a short streak of 3 or more, with their last three counts |
| C5 | GET | `/counts/:id` | one count through the one view builder (`../_shared/count-view.ts`). **Registered last**: `/counts/home`, `/mine`, `/summary`, `/flagged`, `/repeat-shortfalls`, `/blank-sheet`, `/start-options` are literal paths that win |
| C31 | GET | `/counts/home` | **Amendment 2 (Block 5).** `counts.record`, `requireHubActor`. The caller's own: `openCount` (id, reference, section names, counted and total lines, "0 of 2 counted": the Resume card), `sections.total` and `sections.longestAgo` (the section counted longest ago as a name and a date, "3 days ago"; never counted reads "Never counted"), `signedCount` (counts the caller has signed, SUBMITTED or APPROVED, **all time**: the badge on My counts), `wasteToday` (waste entries the caller logged on today's Nairobi day, **reversed ones included**, as step 54 lists them struck through). No stock figure or difference |
| C32 | GET | `/counts/mine?from=&to=&status=&page=&pageSize=` | **Amendment 2.** `counts.record`, own counts only whoever the caller is. Signed counts (SUBMITTED, APPROVED; an open count is on the home, not here), newest signed first. `status` all, waiting or approved; `from`/`to` are Nairobi days on the **sign** day, both included, either alone; **with neither the window is the last 30 days** (today and the 29 before); a count waiting for review always shows, like C2; `from` after `to` is a 400. Row: reference, section names, `itemCount`, status text ("Waiting for review", "Approved", "Signed" for a Manager's own count), signed time. `page.total` is the header's "12 counts". No stock figure or difference |

## Rules
- The strips are built from words the screens draw (`counts-view.ts`): captions such as "Samrat · signed 07:42", "Summer · Peter, 14 of 28", "Net difference −KES 7,940", "6 days" / "Never".
- "Net difference 7 days" and "Exceeded the range" are the same lines: signed lines of the last 7 days that were outside the range, valued from the frozen figures.
- C31 and C32 read the caller's id from the token, never from the request, so there is no id to tamper with. C31 reads the Waste table once, to count today's entries (`countsRepository.wasteEntriesLogged`); it reads no other Waste code. W3 (the Attendant's waste list) is unchanged: it already takes `from`/`to` and gives the Attendant their own entries only (test in `counts-mine.test.ts`).
- Mixed-role routes (`counts.read` or `counts.record`) leave the final say to the service for C5.

## Code map
`counts-routes/controller/service/repository/validators.ts`, `counts.types.ts`, `counts-view.ts` (KPI words, row words). Raw SQL is in the repository only.

## Tests
`counts-service.test.ts` (strips, rows, flagged, repeat, detail access), `counts-mine.test.ts` (C31, C32 and W3 for the Attendant: own only, 30-day window, Nairobi day, longest-ago is a date, no stock key at any depth), `counts-mine.db.test.ts` (opt-in: own only, waiting always shows, pager and total, open count not listed, waste count), `../counting-routes.test.ts` (the §3.1 grid for all 32 endpoints and route order), `counts.db.test.ts` (opt-in `RUN_DB_TESTS=1`: every query runs; a three-counts-running shortfall shows up).

## Coupling
`../_shared/` (count-view via count-detail-reader, count-reads, count-state, count-people, count-time, count-format, counting-contract), `../../_shared/central-store-access`.
