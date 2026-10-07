# prep / runs (front end)

**Design:** approved (Paper steps 1, 10, 11, 12, 35, 36) · **Code:** built. Runs home with KPI strip and Needs a look band, run drawer, History with Export CSV (Slice 4). Correct and cancel plug into the drawer (Slice 3).

## What it does
- `PrepHomeScreen` (`/app/inventory/prep`) picks the view from the server's permissions, not a role name: holds `prep.record` and not `prep.read_flags` → `AttendantHome`; anyone else with `prep.read` → `ManagerRunsHome` (KPI strip, Needs a look band, Recent runs with an Output filter, "Needs a look only", flagged-row tint, "New prep run" with `prep.record`).
- `PrepHistoryScreen` (`/app/inventory/prep/history`): search (debounced 300 ms), output, person (desktop roles), status, from, to, pager "Showing 8 of 31 runs · 29 Sep to 12 Oct 2026", Export CSV (`prep.read_flags`). Filters live in the URL, so "Clear filters" is the clean address. The Attendant sees the same table without flags, costs or export, starting on "Only my runs".
- `RunDrawer` (`components/run-drawer.tsx`, on `ui2/sheet`): one drawer for every role, driven by `?run=<id>` (`useRunParam`). Shows what the server sent for the caller; **Mark reviewed** with `can.review`.

## Props Slice 3's components plug into (`RunDrawerProps`)
`onCorrect?: (run: RunDetail) => void` and `onCancel?: (run: RunDetail) => void`. A button shows only when the server says `run.can.correct` / `run.can.cancel` **and** a handler is passed; with no handler there is no button. Also `onChanged?` (reload what is behind the drawer) and `onOpenRun?` (replaces / replaced-by links). The integrator passes the handlers in `manager-runs-home.tsx`, `attendant-home.tsx` and `history-screen.tsx`.

## Data and refresh
One `reloadAll` in the manager home refreshes the strip, the band and the table; Mark reviewed also calls `refreshNeedsLookCount()` so the sidebar badge (`review/store/needs-look-store.ts`, read by `use-shell-nav.ts`) drops without a reload. The badge refetches on route change and after a write, never on a timer.

## Errors
`_shared/lib/prep-errors.ts` turns 401, 403, 404, 5xx, offline, `RUN_NOT_OPEN` and `EXPORT_TOO_LARGE` into plain sentences. Wording for loading, empty and error is in `_shared/lib/states-copy.ts` (Paper step 23).

## Parity manifest (checked 7 Oct 2026 at 1440 against Paper by computed values; Attendant at 390)
| Paper node | Reached at | Verdict |
|---|---|---|
| Step 10 `7DL-0` Runs, needs a look | `/app/inventory/prep` as Store Manager, flagged runs present | matches: KPI 10/12 mono, 28/34 value, 12/16 caption; band header 15/20 semibold, chips 12/16 pad 3×8; Review 13/500 pad 8×16; Recent runs 15/18; table header 34 high, rows 48. Corrected: page title and spacing set to Paper's 24/30, gap 22, padding 32 (the shared 26px token is not Paper's) |
| Step 10 flagged row tint `7HV-0` | same | matches (`warning-bg`) |
| Step 11 `7PT-0` drawer, flagged | `?run=<id>` on a flagged run | matches: 460 wide, header 17/22, three-cell strip, output box, input table 32/44, three notes, footer |
| Step 11 variants: reviewed, cancelled, corrected, linked | seeded rows | built from the same parts; Paper draws only the flagged one, so reviewed/cancelled/corrected wording is **needs owner decision** |
| Step 12 `7RR-0` History | `/app/inventory/prep/history` | matches: filter row 34 high, columns 120/100/190/120/210/150, status cell. Corrected: outer table box removed (Paper draws rules only). Differences left: native date inputs show `mm/dd/yyyy` where Paper shows "29 Sep 2026"; the search box has a small search icon Paper does not draw (needs owner decision) |
| Step 12 states: empty, filtered-empty, loading, error | built from the states kit + step 23 wording | matches wording; layout is the shared kit |
| Step 23 `903-0` wording table | `states-copy.ts` | matches |
| Step 36 `1UAA-0` Attendant desktop | unchanged table, no tint, no flags | unchanged |
| Attendant History 390 | `/history` as Store Attendant | built from the manager's parts; Paper draws no Attendant History (needs owner decision); no page-level horizontal scroll, no flags, costs or export |

Not drawn by Paper and not built: Chapter 9 (manager on tablet and phone) is parked; the manager screens are desktop-first (1440 verified, 1024 not yet spot-checked).
