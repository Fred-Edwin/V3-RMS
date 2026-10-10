# branch-day (front end)

**Design:** approved (Paper *Inventory · Counting and closing*, B0 to B18 and chapter 5; flow in `docs/features/inventory/branch-day-flow.md`; Paper spec `docs/features/inventory/branch-day-paper-spec.md`) · **Contract:** `docs/features/inventory/branch-day-contract.md`, accepted 10 Oct 2026.

**Status (10 Oct 2026, branch `feat/block4-fe-desktop`):** the desktop is half built, on fixtures. **Part 1 is done:** Today, a department's figures, Close the day, Count for a department, Confirm for Kitchen and the hub branch picker. **Part 2 is not built:** History, the date range picker, the closed day file (Items, Documents, Activity), Correct a count, the printed day sheet, the top-bar day search results, the sidebar badge. The phone screens are another session's (`phone/`). The back end (`feat/block4-be`) has not landed, so every desktop call answers from `desk/lib/mock-data.ts` (`BRANCH_DAY_MOCK` is on unless `NEXT_PUBLIC_BRANCH_DAY_MOCK=off`).

## Layout
- `_shared/` types mirror, fixtures, wording table (`lib/branch-day-copy.ts`). Shared with the phone session; nothing here was changed in Part 1.
- `desk/` the desktop screens: `components/` (Today, department cards and blocker rows, department rail and figures table, Close drawer, Count-for drawer, top bar), `hooks/use-day-access.ts` (what the server's table lets this person see and do), `lib/` (`desk-format.ts` Paper's words for times, days, money; `desk-paths.ts` every link; `mock-data.ts` the fixtures), `services/branch-day-desk-api.ts` (BD6 to BD8, BD11 to BD14).
- Pages (thin shells): `app/app/branch/(shell)/day/page.tsx` and `.../day/figures/page.tsx` for the Branch Manager; `app/app/inventory/(shell)/branch-day/page.tsx` and `.../figures/page.tsx` for the hub roles. Same screens; the server's table decides what shows.
- Old files still here and **to delete in Part 2** (they carry the reopen UI and the old history): `components/{history-detail,history-list,day-document,day-parts,department-count,opening-card,opening-sheet,reopen-day}.tsx`, `hooks/use-branch-day.ts`, `services/branch-day-api-service.ts`, `types/branch-day.ts`, `lib/branch-day-format.ts`. The old Today screen and the thresholds drawer are already gone.

## Desktop screens, Part 1
| Screen | Paper | Component | Check |
|---|---|---|---|
| Today, blocked | B5 | `today-screen.tsx` | numeric match at 1440 (page padding and gap, card width 218.4 and 256 high, borders, blocker rows 14/8/14, Close button 40 high at 45%); 1024 (3 + 2 cards) and 768 spot-checked |
| Today, ready / closed | B7, B9 | same | ready header and rows as drawn; closed shows the green confirmation, five ledger rows, "Showing 5 of N", no cards |
| Blocked by a delivery | B14 | same | red row, "Confirm for Kitchen" (gap G21) opens Block 2's drawer |
| A department's figures | B6 | `figures-screen.tsx`, `department-pane.tsx` | rows 58 high, the nine columns at 60/60/48/60/60/68/68/92 with 12 gaps, rail 272, selected edge `#B0610F`, pane padding 20/24 |
| Close the day | B8 | `close-drawer.tsx` | 560 drawer, PIN focused, wrong PIN then right PIN, "See every line" opens the lines in place (gap G10) |
| Count for a department | B15 + G23 | `count-for-drawer.tsx` | blind, Enter moves to the next empty box, "N more items to count", receipt and PIN in the same drawer |
| Today for any branch | B16 | same screen, hub view | branch picker in the URL (`?branch=`), no Close button, "No open day at Karatina yet." |

**Kit options added (defaults unchanged):** `Button` sizes `xl` (40), `md` (36), `drawer` (44); `Sheet` `overlayClassName` and `hideClose`; `DrawerShell` `variant="day"` (560, close glyph, link Cancel, natural-width primary, 45% scrim, 300 ms in and 200 ms out), `compact`, `initialFocus`, `footerPrimary`, and `description` may be a node; `Chip` `size="lg"`, `dotShape="square"`, `ring`, tone `muted`; `PinField` `size="paper"`. **Kit bug fixed (owner ruling 8):** `PinField` focus uses `#B0610F`, as Paper draws. Shared files both desktop and phone sessions touched or need: `features/inventory/_shared/components/block2-phone-parts.tsx` (PinField, Chip), `lib/block2-words.ts` (`ChipTone` gains `muted`), `dispatch/index.ts` (exports `ConfirmForDepartmentDrawer`).

**Gaps built (same style, reported):** G5 disabled Close keeps `aria-disabled` and names the first blocking row; G6 a status line says which department has counted; G10 "See every line"; G21 and G22 the two actions on the red rows; G23 the receipt and PIN step; G24 hub picker and empty state; G26 loading skeletons, empty, error with Retry; G27 cards wrap 3 + 2 below 1280 and stack below 768, the rail becomes a select below 1024.

**Not built yet (Part 2 or open):** the sidebar badge on Today (G12; needs a hook the shell can call), the top-bar day search results (G9; Enter opens History with `?search=`), the Director's Branches group still lists the per-branch rows above Day (Paper's has Day and Waste only; owner call).

## Rules the screens follow
Heads see no costs and no expected figure while counting; the Branch Manager sees values; every other desktop role reads the same pages with write buttons hidden, not greyed (the Close button for a disabled day is the one drawn exception: Paper keeps it, at 45%). Every signing write sends an `idempotencyKey` in the body; page, filters and dates live in the URL; tables follow `UI_BUILD_RULES` §4a.

## Fixtures
`?mock=blocked|delivery|ready|closed` picks the starting state; `?fail=today` (or `figures`) makes the first second of calls fail so the error panel and Retry can be walked. The PIN is 1234.
