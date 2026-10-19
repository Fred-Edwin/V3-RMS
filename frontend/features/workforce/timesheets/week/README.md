# Timesheets · week (a person's month, a week at a time)

**Spec:** Paper Chapter 8 step 2. **Status:** built, awaiting review (19 Oct 2026). **Endpoints:** T4 (a person's period), T6 (decide a day). Edit time is Attendance's F1 to F3.

A drawer opened from a row. It opens on the first week with something to decide (else the latest week that has started); a week stepper moves between weeks, and a week that runs into the next or last month is labelled "part week" and shows only this month's days. Days the system approved are quiet rows with the clock range; each day that needs a person is a card with the reasons in words and only the buttons the viewer may use: **Accept as recorded**, **Excuse lateness** (needs a reason), **Hold** (needs a reason), **Edit time** (the Attendance dialog, always with a reason), and **Review the overtime**. Overtime is answered first: a day with overtime waiting has no Accept. A closed month shows every control as read-only with the reason in words. There is no week sign-off.

| Piece | File |
|---|---|
| Drawer | `components/person-drawer.tsx` |
| Day rows and exception cards | `components/day-list.tsx` |
| Hold / Excuse dialog | `components/day-decision-dialog.tsx` |
| Weeks, the week to open on, the words for a day | `lib/week-view.ts` |

**Coupling:** `overtime/` (the dialog), Attendance (`EditTimeDialog`, `useDayHistory`, Nairobi clock helpers), Rota (`mondayOf`, `nairobiToday`). A fix on the first shift of the day; a second shift is fixed from the Today board.
