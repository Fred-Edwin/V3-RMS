# Workforce Home

**Status:** built and walked in a real browser (22 Oct 2026, branch `feat/workforce-1-people-batch-2a`, not pushed). Spec: Paper page "Workforce · Final pass designs", frames 1.1 to 1.13; design notes `docs/features/workforce/final-pass/design-notes-1-round-1.md`; checklist `docs/features/workforce/checklist-1-people-batch-2a.md`; decisions `decisions-1-people-batch-2a.md`. Back end: `backend/src/modules/workforce/home/` and `needs-you/` (API in `docs/API_CONTRACT.md` section 47).

## What it is
The first page every signed-in person lands on (`/app/workforce`, every human role; the two kitchen display roles keep their screens). One kit for every role, drawn by `role-home/`:

- A greeting with the date and, for a person who has a Needs you list, a one-line headline ("12 things need you, and 11 are overdue.").
- Three to five **number cards** (counts only, never a pay figure). Which cards a person gets is decided by the server per audience: HR, Director, Accountant, Branch Manager, Store Manager, department head, staff, System Admin. The System Admin sees "Password resets", never "Locked out".
- **Needs you**: one row per kind with a count, overdue first, with a button to the page where it is decided. "See all" opens the paged list at `/app/workforce/needs-you` (search, a chip per kind, Kind and Site lists, a numbered pager with rows per page; rows are one per item). A person with no Needs you capability (staff, heads, Store Attendant) sees the action cards below instead.
- **Latest**: the newest notifications, with "Mark all read" and "See all notifications". The bell in the top bar carries the unread count ("99+" above 99).
- The **states kit** (`components/home-states.tsx`): loading, error with Try again, offline, "Nothing needs you", and stale data.
- A page action in the top bar that depends on the role (Add employee, Build shifts, Open payroll, Add account).

On a phone the same data draws the phone Home (Paper 1.9 to 1.11): the dark top bar with the menu and the bell, the greeting, the 2 x 2 number cards, Needs you as one card per row with a 44 px button, Latest.

## What is here
| Piece | Where |
|---|---|
| Route shell | `app/app/workforce/page.tsx` (routing only) |
| Home screen, cards, table, Latest, states | `role-home/components/` (`role-home-screen`, `home-kpi-cards`, `home-needs-you-table`, `home-latest`, `home-states`, `home-body`) |
| See all page | `role-home/components/needs-you-page-screen.tsx`, `role-home/hooks/use-needs-you-page.ts` |
| Reads and the wire-name mapper | `role-home/services/role-home-services.ts` (the API says `organizations`; the screen says site) |
| Words that depend on numbers (pure, tested) | `role-home/lib/role-home-words.ts` |
| Landing after sign-in | `frontend/lib/role-home.ts` (every human role lands here; the display roles land on `/app/kitchen` and `/app/barista`) |
| Phone action cards for staff and heads | `cards/` (card registry, `phone-cards-defs`, `rota-data`, `attendance-data`) drawn by `components/phone-cards.tsx` and `home-stack.tsx` |
| Today page | `components/today-screen.tsx`, `live-board`, `live-team-card`, `everyone-list`, `branch-board` at `/app/workforce/today` |
| Today page states (Schedule V1, Paper frames 2.1 to 2.4) | Clock off: `clock-off-card.tsx` (tiles read "Not tracked / clock is off", On leave real; the brown "Open Attendance switch" button only when `board.clock.canSwitch`; "Open Shifts" and "Open Leave" only with `rota.read` and `leave.read`). Past day: `past-day-parts.tsx` (date picker, "Back to today", exceptions with Edit time, "Fixed after the day", By department), no "Clock in for them" (`board.actions`). Phone (under 768 px): `phone-board.tsx` (2 x 2 cards, stacked "Needs a look", 44 px buttons). All words from `attendance/board/lib/board-view.ts` |
| Greeting words | `lib/greeting.ts` (Nairobi time) |

## How the pieces fit
`useRoleHome` reads `GET /workforce/home` once; the screen draws what the server returns and holds no role logic. The same Needs you rows feed the sidebar's attention marks (`use-needs-you-badges` in `../needs-you`), so a badge cannot disagree with the table.

## Differences from Paper, on purpose
- Needs you rows carry no pay amounts (an existing test forbids KES in row text); the amount is on the page the row opens.
- The staff Home shows three numbers, not five; the other two need data no module holds yet.
- Search is in the sidebar (the menu frames are the later, approved ones), not in the Home top bar.
- A staff Home with no Needs you list shows the branch name after the date; Paper's staff frame puts it first.
- A mixed Overdue row says "See overdue" and opens the overdue list; a row of one kind keeps that kind's button.

## Deleted in batch 2A
The old desktop cards (`hr-cards`, `branch-cards`, `payrun-cards`, `audit-cards`, `needs-you-cards`), their data hooks, `WorkforceHome`, the gallery and `/dev/workforce-home`. History is in `docs/features/workforce/handoff-1-people-batch-2a.md`.

## People batch 3 (23 Oct 2026)
Home leaves out cards the role cannot reach (Store Manager: no Leave or Timesheets while the clock is off, no "no head"; System Admin: no People housekeeping). "Pay changes this month" and the probation card link to real Employees filters (`pay_change_month`, `on_probation`). "HR asks for a detail" notices open My file. The count rules are the back end's (`ACTIVE_STATUSES`, one "no head" rule); see the People README.

## Tests
`role-home/lib/role-home-words.test.ts`, `role-home/services/role-home-services.test.ts`, `lib/card-registry.test.ts`, `lib/greeting.test.ts`; back end `home.test.ts`, `home-db.test.ts`.
