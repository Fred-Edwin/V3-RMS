# Counting (front end)

Rebuilt from the Paper page "Inventory · Counting redesign (Oct 7)" (`01M3TP8J54R83RHC9FJ7RAHGKG`, `p-G-0`). Contract: `docs/features/inventory/stock-count-waste-contract.md` §4.1 (C1 to C30). Status: **fixture pass complete, real API not switched on** (`NEXT_PUBLIC_SCW_FIXTURES=1` answers from `_shared/fixtures/`; flag off calls the real API through `_shared/services/counting-api.ts`).

Folders: `record/` (the Attendant's phone count and the Manager's own count), `review/` (Counts, Review, Director's view), `setup/` (Count setup and its drawers), `print/` (the two A4 pages), `_shared/` (landed contract mirror, fixtures, states copy, `counting-api.ts`, autosave, chips).

Role-aware by data, never by role name: `/stock/counts` shows the Counts list to a caller holding `counts.read`, the Director's flagged view to one holding `counts.acknowledge` without `counts.resolve` (or with `?view=flagged`), and Pick a section to one holding only `counts.record`. `/counts/[id]/count` shows the phone column when the response has no stock-figure keys and the desktop table when it has them.

## Parity manifest

Verdicts: **by eye** = compared to `get_screenshot` in the browser at the artboard width; **built** = built from Paper's `get_jsx` values and type-checks, not yet compared in the browser (do this in the real-data pass). "Needs owner decision" rows are Paper gaps with a default applied.

| Step | Paper node | Route and state | Width | Verdict |
|---|---|---|---|---|
| 1 Pick a section | `1WGA-0` | `/stock/counts` as Attendant; busy section, resume banner | 390 | by eye, matches |
| 2 Count the shelf | `1WIL-0` | `/counts/[id]/count` | 390 | by eye, matches (empty boxes borderless; Paper draws a faint box, corrected later) |
| 3 Check again | `1WM9-0` | section check sheet | 390 | by eye (list sheet); built |
| 4 Recount once | `1WQJ-0` | recount mode, Up next, Keep | 390 | by eye, matches |
| 5 Review before signing | `1WT5-0` | `/counts/[id]/sign` | 390 | by eye, matches |
| 6 Sign with PIN | `1WVE-0` | PIN sheet, wrong PIN, signing | 390 | by eye, matches |
| 7 Submitted | `1WYG-0` | `/counts/[id]/submitted` | 390 | by eye, matches |
| 40 Reorder | `245F-0` | Reorder, handles, Done | 390 | by eye, matches |
| 41 Move an item | `247B-0` | Move sheet | 390 | built. **Needs owner decision**: Paper draws no control that opens it; a "Move" link on the row being counted |
| 12 Start a count | `1YJM-0` | `/counts/new` | 1440 | built |
| 49 Start, item picked | `25M7-0` | `/counts/new?recount=` | 1440 | built |
| 13 Counting with expected | `1YP3-0` | `/counts/[id]/count` (figures) | 1440 | by eye (live result, Recount) |
| 14 Sign your count | `1YWV-0` | sign dialog with cause chips (N1) | 1440 | built |
| 15 Count signed | `1Z61-0` | `/counts/[id]/signed` | 1440 | built |
| 8 Counts | `1X6I-0` | `/stock/counts` | 1440 | by eye, matches |
| 48 Counts with a recount | `25F8-0` | recount link, Unsectioned chip | 1440 | built |
| 9 Review a count | `1XCK-0` | `/counts/[id]` | 1440 | by eye |
| 10 Decide a line | `1XM6-0` | decision panel, bulk | 1440 | by eye |
| 11 Approve and sign | `1XV7-0` | approve dialog | 1440 | built |
| 47 Approved, Count again | `257F-0` | `/counts/[id]` approved | 1440 | built |
| 26 Director's Counts | `21YA-0` | `?view=flagged` | 1440 | built |
| 45 Count settings, Director | `24TJ-0` | drawer, alert amount | 1440 | built |
| 46 Director alert | `256N-0` | push only | n/a | nothing to draw |
| 24 Count setup | `21MC-0` | `/counts/setup` | 1440 | by eye (list rows corrected) |
| 24B, 24C, 50, 51 | `23EG-0` `23KP-0` `265Y-0` `25SX-0` | Add items drawer | 1440 | built |
| 25 Count settings | `21T8-0` | `?drawer=settings` | 1440 | built |
| 43 Blank sheet | `24O2-0` `27N7-0` | `/count-print/blank` | A4 | built (data-driven page breaks, not Paper's four fixed pages) |
| 44 Count record | `24O7-0` | `/count-print/[id]` | A4 | built |

Not done: the 820 and 1024 spot-checks; keyboard walk of every screen; the throttled-network check.
