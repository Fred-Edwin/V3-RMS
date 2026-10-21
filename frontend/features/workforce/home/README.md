# Workforce Home (the frame)

Chapter 1 of the approved Paper designs ("Role homes and navigation"): the Workforce menu, the Home pages for the five desktop roles, the phone Home for staff and for a department head, and the **card registry** every later slice plugs into. Front end only. The back end is untouched.

**Status:** built on branch `feat/workforce-frame` (17 Oct 2026), awaiting the owner's review. Nothing pushed. The real page at `/app/workforce` shows the greeting and then an empty state, because no slice feeds a card yet. Every block is shown with Paper's examples at **`/dev/workforce-home`** (404 in production). What is left to wire is the ledger: [`docs/features/workforce/chapter-1-ledger.md`](../../../../docs/features/workforce/chapter-1-ledger.md).

## What is here

| Piece | Where |
|---|---|
| Route shell | `app/app/workforce/page.tsx` and `layout.tsx` (routing only; the layout mounts the phone menu drawer) |
| Screen | `components/home-screen.tsx`: reads the server's capabilities, draws the shell's top bar (≥1024 px) or the phone band, and the stack |
| Registry (pure logic, tested) | `lib/card-registry.ts`: `defineHomeCard`, `registerHomeCard`, `arrangeHome`, `visibleCards`, `inSlot` |
| Stack | `components/home-stack.tsx`: runs each card's data hook, arranges by urgency, draws desktop columns or the phone stack, the loading, empty and card-error states |
| Cards | `cards/*.tsx`, listed in `cards/index.ts` (each has a `noSource` data hook today) |
| Blocks | `components/`: `AttentionList`, `PeopleByBranch`, `ComingUpSection`, `NeedsALook`, `OnTimeByDepartment`, `DepartmentChips`, `BranchNowHeader`, `WaitingForYouColumn`, `WaitingForYouCard`, `ServiceTeamCard`, `JobCardsSlot`, `WeekCard`, `PhoneHomeBar`, `SectionHeader`, `HomeButton` |
| Needs you (6a, 21 Oct 2026) | `cards/needs-you-cards.tsx` registers `workforce.needs-you` (desktop `main`, phone stack) and `workforce.overdue` (Director). They replace `workforce.waiting-for-you.desktop`, `workforce.waiting-for-you.phone`, `workforce.overdue-approvals` and `workforce.payrun-steps`, which are gone. The card comes from `../needs-you`. The KPI strips no longer carry a "Waiting for you" cell. |
| Branch cards for a person with no branch | `cards/attendance-data.ts`: the numbers strip, Today board and team card answer "no source" for a login with no branch (System Admin, Director), so the System Admin's Home is the Needs-you card only |
| Permissions | `hooks/use-workforce-permissions.ts` (`GET /workforce/permissions/me`) |
| Fixtures | `fixtures/home-fixtures.ts` (Paper's names and numbers; gallery only) |
| Menu | `components/app/shell/nav-table.ts` (`WORKFORCE_ROWS`) |

Built from the **Workforce kit** (`../_shared`), not from scratch: `WorkforceKpiStrip`, `ComingUpTimeline`, `FilterBar` and `FilterChip`, `AvatarStack`, `PhoneHero`, `ClockCard`, `WeekBars`, `TimerChip`, `EmptyState`, `ErrorBlock`, `ListSkeleton`, the interaction classes, and the shell's own `Topbar`, `MobileTopbar` and `ShellNavDrawer`. New here, because the kit has no equivalent: the small Home buttons (28, 30 and 36 px), the section line, the HR attention row, people-by-branch bars, the Branch Manager's board rows, the team card with its 9/10 ring, the dashed job-cards slot and the phone band with its two slots.

## How a slice registers a card

1. Write the data hook in your slice (it returns `CardDataState<T>`: `loading`, `error`, `ready` with `data`, or `no-source`). Keep `data` the same object between renders unless it changed (a query result does this).
2. In `cards/`, change the card's `useData: noSource<T>()` to your hook. For a new card, write `defineHomeCard<T>({ id, title, surfaces, slot, anyCapability, order, urgency?, isEmpty, useData, Card })` and add it to `HOME_CARDS` in `cards/index.ts`.
3. **Who sees it: capabilities, never role names.** `anyCapability` is a list from the server's table (`lib/capabilities.ts` mirrors the names). Empty means everyone signed in.
4. **Order:** `order` is Paper's place in the stack. `urgency(data)` may return a lower number to rise (a clock-in that is due, an approval waiting). Equal urgency falls back to `order`.
5. **Nothing to show:** `isEmpty(data)` true, or `no-source`, and the card is not drawn. If every card is empty the page shows the States kit's empty state.
6. A button on a card is passed only when the person may use it; the blocks never draw a greyed role-blocked action.
7. Tick the card's row in the ledger.

Desktop slots: `kpi` (the strip under the greeting), `main` (wide column), `side` (narrow column; `sideWidth` 340 or 360), `wide` (full width below). The phone is one stack in rank order.

## Parity manifest

"By eye" = the built screen in the gallery or the real page next to Paper's screenshot. "Computed" = `getComputedStyle` of key elements against Paper's `get_computed_styles`. "By values" = built from Paper's `get_jsx` values and seen, without a screenshot comparison. No pixel-diff tool was used.

| Paper node | Piece | States built | Widths checked | Verdict |
|---|---|---|---|---|
| `PLH-0` | Desktop top bar (shell `Topbar`) | breadcrumb "Workforce / Home" | 1440 | by eye on the real page; search and the page action left out (slots, see ledger) |
| `PLT-0` | Greeting | morning, afternoon, evening | 1440 | computed: 24/30/600, -0.01em, grey line 14/18; wording by Nairobi time (tested) |
| `SVM-0` / `SWB-0` | KPI strip | the kit's strip with each role's cells | 1440 | by eye; the kit's parity applies |
| `PME-0` | Needs your attention | rows with and without a button, late age, view all | 1440 | computed: line 36 ink rule, row 60, 8 px square, title 14/18/500, grey 13/16, age mono 11, button 30 high |
| `PNM-0` | People by branch | bars from share of total, note | 1440 | computed: bar 6 px, `neutral-100` track, `primary` fill, row padding 14 gap 7 |
| `POH-0` | Coming up | the kit's timeline, list on a phone | 1440 | by eye |
| `PUM-0` | Branch header with LIVE | with and without LIVE | 1440 | computed: 24/30/600; LIVE mono 11, success |
| `Q4T-0` | Department chips | chosen, hover, focus, marker (amber, red) | 1440 | by eye; the kit's `FilterChip` gained a `marker` |
| `Q5G-0` | Needs a look | not in (two buttons), late (bar), muted and named tiles | 1440 | computed: row 48, tile 28, name column 170, status 150, buttons 28 high |
| `Q6X-0` | On time and working | row open or plain, notes in three tones | 1440 | by values; faces are the kit's 24 px `AvatarStack` with initials (Paper: 26 px, no initials) |
| `PXC-0` | Waiting for you (column) | Approve and Decline, one button, open all | 1440 | computed: padding 14 gap 10, buttons 28 high |
| `QJV-0` | Waiting for you (phone card) | edge colours, count tag | 390 | by eye |
| `QKM-0` | Service team today | ring, faces, late and not-in tags, row with button, row with bar | 390 | by eye; the ring is new (the kit's ring prints a percent) |
| `QKK-0` | Job cards slot | dashed note | 390 | computed: 92 high, dashed `neutral-400`, 13/19 grey |
| `QHU-0` | This week | overtime segment, today ring, hours footer | 390 | by eye; the kit's `WeekBars` gained `extra` and `footer` |
| `QGV-0` | Phone band | slots empty and filled, menu ring | 390 | by eye; the menu button, pill and action have 44 px hit areas |
| `QG8-0` | Staff and head phone pages | from the real registered cards | 390 | by eye against Paper step 05 |
| `OOZ-0`, `PPM-0` | HR and Branch Manager pages | from the real registered cards | 1440; the blocks at 820 | by eye; no element overflows at 820; a column drops under another below 1024 |
| `OPQ-0` | Accountant, Director, Store Manager pages | from the real registered cards | 1440 | **no drawing**: built from the same blocks, to be reviewed against the reference table |
| `OOQ-0` | The five sidebars | live: the Workforce group is first, Home only | 1440 | Branch Manager and Accountant walked on the real page; the Director and Store Manager by the tests (see the report) |

## Built beyond Paper

| Item | What was built |
|---|---|
| Hover, pressed, focus, disabled | On every button, chip and row, in the kit's style (`lib/interaction`). |
| Home empty state | "Nothing needs you right now" in the States kit's voice; Paper draws no empty Home (`lib/home-copy.ts`). |
| Loading and card-error states | The kit's skeleton and error block; a failed card shows the error and the others stay. |
| Greeting for the Branch Manager | "Nyeri Town, right now" with the date and clock only; Paper's second sentence ("The morning shift ends at 14:00") needs Attendance. HR's sentence with counts is likewise left until slices supply the counts. |
| LIVE | Not drawn on the real page until Attendance makes the board live; drawn in the gallery. |
| Department chips filter | Choosing a chip filters both lists to that department (Paper draws the chips only). |
| `HomeButton` hit areas | 44 px tall on the phone team card; Paper draws 30. |
| Phone band | 44 px menu and action buttons (Paper 36). |
| Accountant, Director, Store Manager Homes | Not drawn in Paper; from the reference table, using the HR and Branch Manager blocks. |
| Capability that sets a role apart | Accountant `payrun.approve`, Director `payrun.reopen`, HR `employee.write_sensitive`, Branch and Store Manager `today.act`. |
| Compact bar from 768 to 1023 px | The shell's `MobileTopbar` with the menu drawer; the page's own layout is the desktop one. |
| Kit additions | `FilterChip` `marker`; `WeekBars` `extra`, today ring and `footer`. Defaults unchanged. |

## Not in this session

Any back end, any real data, moving legacy menu rows, the shift pill's content, a floor-staff Home link, changing where a role lands after sign-in, and the Orders job cards.
