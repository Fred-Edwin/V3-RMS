# branch-day (front end)

**Design:** approved (Paper *Inventory · Counting and closing*, B0 to B18 and chapter 5; flow in `docs/features/inventory/branch-day-flow.md`; Paper spec `docs/features/inventory/branch-day-paper-spec.md`) · **Contract:** `docs/features/inventory/branch-day-contract.md`, accepted 10 Oct 2026.

**Status (10 Oct 2026, branch `feat/block4-fe-desktop`):** the desktop is built and runs on the real API (`feat/block4-be` is merged; the mock, its flag and its scenarios are deleted). Today, a department's figures, Close the day, Count for a department, History, the closed day file (Items, Documents, Activity), Correct a count, the printed day sheet, the top-bar day search and the sidebar badge all work. The phone screens are another session's (`phone/`). Walked on the lane database as the Branch Manager (Confirm for Kitchen on a real `ON_THE_WAY` dispatch, counting on behalf, close with a wrong then right PIN, a correction, the sheet) and read as the Director, Accountant, Store Manager and System Admin. Old-flow days show "–" for Used value and have no file link.

## Layout
- `_shared/` types mirror, fixtures, wording table (`lib/branch-day-copy.ts`). Shared with the phone session.
- `desk/` the desktop screens: `components/` (`today-screen`, `today-parts`, `department-pane` rail and figures table, `close-drawer`, `count-for-drawer`, `history-screen`, `day-file-screen`, `file-tabs` with `FileTabs` and `DayTracker`, `correct-drawer`, `day-sheet-print-screen`, `day-topbar`, `day-parts`), `hooks/` (`use-day-access` what the server's table lets this person see and do; `use-day-badge` the number beside Today), `lib/` (`desk-format`, `desk-paths`, `day-sheet-pages` the A4 pagination with its test, `mock-data` the fixtures), `services/branch-day-desk-api.ts` (BD6 to BD8, BD11 to BD21).
- Pages (thin shells): the Branch Manager's under `app/app/branch/(shell)/day/{,figures,history,file/[id]}` and the bare `app/app/branch/day-print/[id]`; the hub roles' under `app/app/inventory/(shell)/branch-day/...` and the bare `app/app/inventory/day-print/[id]`. Same screens; the server's table decides what shows.
- `index.ts` exports the contract mirror, the wording table and the desktop screens. The shell reads the badge through `features/inventory/index.ts` (`useBranchDayBadge`).

## Desktop screens
| Screen | Paper | Component | Notes |
|---|---|---|---|
| Today (blocked, ready, closed, blocked by a delivery, any branch) | B5, B7, B9, B14, B16 | `today-screen.tsx` | checked numerically in Part 1 |
| A department's figures | B6 | `figures-screen.tsx`, `department-pane.tsx` | rail 272, nine columns, 58-high rows |
| Close the day | B8 | `close-drawer.tsx` | PIN, "See every line" in place |
| Count for a department | B15 + G23 | `count-for-drawer.tsx` | blind, receipt and PIN |
| History, History across branches, date range | B10, B10b, B10c | `history-screen.tsx` | kit `DataTable` with `rowSize="two-line"` (67 high), search by day number as you type, "Date: Last 7 days", Status, Branch (hub roles), numbered pager, all in the URL; an open day goes to Today |
| The closed day file | B11 | `day-file-screen.tsx` | `?tab=items|documents|activity&dept=`; `FileTabs`, `DayTracker` on one line, the Part 1 rail and figures table; an open day redirects to Today |
| Activity | B12b | same | kit pager (gap G16: asks for 100 and pages on the screen); the correction row `#FBF2E4`; the green note only straight after a correction |
| Documents | B13 | same | newest first, latest highlighted, Print per version (130 by 36) opening the sheet in a new tab |
| Correct a count | B12 | `correct-drawer.tsx` | item bar with "Change" (searchable list, G14), figures with the arrow, WHAT CHANGES live, reason chips (`ChoiceChips size="drawer"`), note (200; Other needs it, G15), PIN; `INVALID_PIN` stays in the drawer; `CORRECTION_WINDOW_PASSED` closes it and reloads |
| The printed day sheet | B13b to B13d | `day-sheet-print-screen.tsx` | A4 794 by 1123, cover, a page per department (long ones continue with the heading repeated, G17), corrections and notes, signatures in Alex Brush ("on behalf" wording G20), QR, struck old figure then corrected figure in weight 600; `?version=`; writes nothing; the page calls `window.print()` |
| Top-bar search, sidebar badge | G9, G12 | `day-topbar.tsx`, `use-day-badge.ts` | results "DAY-NYR-0044 · Wednesday 7 October · Closed" or "No day matches."; Enter with nothing highlighted opens History; the badge is the number that blocks the close |

**Kit options added (defaults unchanged):** `Button` sizes `xl`/`md`/`drawer`; `Sheet` `overlayClassName`/`hideClose`; `DrawerShell` `variant="day"`; `Chip` `size="lg"`, `dotShape`, `ring`, tone `muted`; `PinField` `size="paper"` (focus `#B0610F`); `TableRow` `size="two-line"` and `DataTable` `rowSize`; `ChoiceChips` `size="drawer"`. The delivery note's `PrintFrame` and `PrintError` are now exported for the day sheet.

## Live data in the lane
`cd backend && npx tsx src/scripts/seed-branch-day-dev-fixtures.ts --state=none|open|counting|ready|closed [--block="Kitchen"|none]` puts today's day in a state (a real `ON_THE_WAY` dispatch is the blocker); the Branch Manager `bm.town@wendo.test` has PIN 1234. Apply migrations first (`npx prisma migrate deploy`) and restart the API.

## Open points (reported, not decided)
- The breadcrumb on the day file reads "Branch / Day" then "History" then the day number; the shell's top bar has two slots, so "Branch / Day" is one crumb and the day number is plain text (Paper sets it in mono).
- A correction entry's record ("Stock ledger entry") has no page to go to yet: shown as plain text.
- The printed department page says "Delivery confirmed" without a time: the contract's sheet carries the state only.
- Activity asks BD17 for `limit=100` and pages on the screen; a day with more entries needs a paged BD17 (or BD19).
- The Audit log's Branch day rows show the person's name only; the role under the name is a back-end gap.
- Not done: a numeric `get_computed_styles` pass of every screen and state against Paper after the move to the real API (Part 1 did Today, figures and the drawers; the day file, History, Correct a count and the sheet were checked by eye against the spec's numbers); loading skeletons were seen but not walked on a throttled network.
- The Branch Manager's Audit log row (gap G25) is in the Branch group; the screen must scope to their branch on the server.

## Rules the screens follow
Heads see no costs and no expected figure while counting; the Branch Manager sees values; every other desktop role reads the same pages with write buttons hidden, not greyed (the Close button for a disabled day is the one drawn exception). Every signing write sends an `idempotencyKey` in the body; page, filters and dates live in the URL; tables follow `UI_BUILD_RULES` §4a.
