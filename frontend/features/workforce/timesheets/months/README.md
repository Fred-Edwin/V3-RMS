# Timesheets · months (the Timesheets page)

**Spec:** `docs/features/workforce/specs/1a-timesheets-spec.md` S1, S2, S8; Paper "Workforce · D. Pay" Chapter 12 steps 02, 03, 12. **Status:** built on `feat/workforce-1a-timesheets-frontend` (19 Oct 2026, not pushed, awaiting review). **Endpoints:** MO1 (the months), MO2 (a month), MO3 (its people). Decisions: [decisions-1a-timesheets-frontend.md](../../../../../docs/features/workforce/decisions-1a-timesheets-frontend.md).

`/app/workforce/timesheets`: months of the branch on the left (newest first, 5 a page, Open / To approve / Approved), the chosen month on the right: the four numbers (the fourth is "Needs you before approving", and turns green once approved), the range control (a week Picker plus the approved range picker, limited to the month), and the people table (search, Needs you / Late / All chips with counts, Department, numbered pager). A row opens the drawer (`person/`). Header: Export (whoever the server says may export), Approve {Month} (the site's approver only; disabled with its date reason while the month is open; "Approved ✓" and the document number once signed). The branch, month, days and open person are in the address (`site`, `month`, `from`, `to`, `person`); the table keeps `q`, `page`, `perPage`, `view`, `dept`.

| Piece | File |
|---|---|
| Page | `components/months-screen.tsx` |
| Header and the four numbers | `components/month-head.tsx` |
| Months list | `components/months-list.tsx` |
| People table | `components/people-table.tsx` |
| Range control | `components/range-control.tsx` |
| Address state, refresh on focus, departments | `hooks/` |
| Default month, range from the address | `lib/month-pick.ts` |

**Coupling:** `person/` (drawer), `approve/`, `exports/`, `_shared/` (words, services, types), Attendance (`useDayHistory`, Edit time), People (department lookups). Buttons follow the server's `capabilities` on the month and the capability table, never a role name. A branch whose clock is off shows "This branch still uses the old clock".
