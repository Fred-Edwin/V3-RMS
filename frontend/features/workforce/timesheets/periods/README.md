# Timesheets · periods (the page)

**Spec:** Paper Chapter 8 steps 1 and 4. **Status:** built, awaiting review (19 Oct 2026). **Endpoints:** T1 (the months), T2 (one month, with `from`/`to`), P3 (close), P4 (reopen), P1 (for Export).

The month at a glance for a branch: the title and "closes by itself on …", the four numbers (approved by itself, needs you, late recorded, hours worked), search and the chips Needs a look / Late / All, the Department filter, the people table (planned, worked, late, what needs you), the numbered pager. The page opens on the whole month up to today; the range picker narrows the numbers and the people to any days of it. Close early (on the last day or after the button is brown; before it, disabled with the reason), HR's Reopen with a reason, Export.

| Piece | File |
|---|---|
| Page | `components/timesheets-screen.tsx` |
| People table | `components/people-table.tsx` |
| Close early dialog (reads the whole month itself) | `components/close-dialog.tsx` |
| Reopen with a reason (HR) | `components/reopen-dialog.tsx` |
| KPI cells, "what needs you" words, chips, close rule | `lib/period-view.ts` |
| The range rules (whole month by default) | `lib/period-range.ts` |
| Departments of the branch, Export | `hooks/use-departments.ts`, `hooks/use-export.ts` |

**Coupling:** Attendance (`attendanceReads.switches` for the branch chooser; the Edit time dialog through `week/`), People (`peopleReads.lookups` for departments), Rota (`nairobiToday`). Company-wide roles (HR, Director, Accountant) choose among branches that have the new clock on; everyone else has one branch; a department head sees their department (the server scopes it).
