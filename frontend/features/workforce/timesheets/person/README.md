# Timesheets · a person's month (drawer and full page)

**Spec:** S4 and S5; Paper Chapter 12 steps 08 and 09. **Status:** built (19 Oct 2026, not pushed, awaiting review). **Endpoints:** MO4 (the drawer), MO5 (every day). Decisions: F7, F8, F10, F11, F20 in [decisions-1a-timesheets-frontend.md](../../../../../docs/features/workforce/decisions-1a-timesheets-frontend.md).

**Drawer** (`components/person-drawer.tsx`, opened by `?person=`): the four numbers, **days that need a look** (one card each with ONE button for its kind: Decide the overtime, Fix the clock-out, Answer the request, Look at this day; a button the viewer may not use is absent), the last 7 days, "Open the full month ↗". On an approved month the cards become quiet "Decisions" rows and nothing can change.

**Full month** (`/app/workforce/timesheets/month/{monthKey}/{employeeId}`, `components/person-month-screen.tsx`): the four numbers, the calendar at a glance (each day a named button that scrolls the table to it), the range, chips All days / Needs a look / Worked, every day on a dense row (rest days grey, late and overtime-to-decide amber, two shifts on two lines, night shift "+1", "Not yet employed"), previous and next person, and a one-person export.

| Piece | File |
|---|---|
| Cards, last 7 days, table, calendar | `components/need-look-card.tsx`, `last-days.tsx`, `days-table.tsx`, `calendar-glance.tsx` |
| Edit time (Attendance's dialog) | `components/day-fix.tsx` |
| Which button, decision lines, short results | `lib/person-view.ts`, `lib/days-view.ts` |

**Coupling:** `overtime/` (the decision), Attendance (Edit time), `exports/`, the Requests inbox (by link).
