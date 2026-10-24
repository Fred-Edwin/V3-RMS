# Final pass, section 1: People, closed (24 Oct 2026)

One page for the owner: what People is, who can do what, what was decided, what was deleted, and what is left. Details live in the READMEs it points to.

## What People does
People is the employee file. It covers hire (a draft, saved as you go), the file with its tabs (Overview, Job and pay, Documents, Activity), pay profile and pay changes, contract and probation, moves (transfer, send to another branch), exit with a 7-day undo, rehire, and the sign-in for a person with no login yet. Around it sit Organisation (departments, positions, heads), My team and the probation report for heads, and the person's own screens: My file (details, photo, ID and bank, sign-in and alerts), My payslips, My notices, Activity on my record and My leave. Specs: `backend/src/modules/workforce/people/README.md`, `frontend/features/workforce/people/README.md`.

## What each role can do
| Role | People |
|---|---|
| HR Manager | Everything: hire, edit all details, pay profile, pay-change requests, contract, probation, moves, exit, rehire, Organisation (all branches). |
| Director | Everything HR does, plus decides pay changes (never the Director's own); own pay change applies at once and HR and the Accountant are told. |
| System Admin | Full access except the steps that belong to one role by design; no file, payslip or clock of its own; gets the security alerts. |
| Accountant | Reads files and pay; edits bank and account only; no hire, no moves. Told when a bank or account changes. |
| Branch Manager, Store Manager | Own branch: hire the basics, edit an onboarding file (the hiring manager may correct for 24 hours), probation notes, name or end heads. No pay, no IDs. |
| Department head | Own department's people: My team (read only), probation report. Nothing about pay. |
| Floor staff, Store Attendant | Only their own file, payslips, notices, activity and leave. |

## What was decided
- A pay change asks for a PIN, both when HR sends it and when the Director decides.
- A person enters their own National ID, bank and account in My file; it saves at once and the Accountant is told when bank or account changes.
- Cash only on the casual path; Bank is the default for monthly staff; screen and API accept the same set.
- The hiring manager corrects a hire for 24 hours; after that the screen says "Ask HR to change this".
- Director and System Admin read and write everything except the steps in the exceptions list; the System Admin has no People screens of its own.
- One definition each: "active" (active, on leave, on notice, suspended), "no head" (a branch department with people and no head or acting head today), and the kinds count (no Overdue row). Home, Organisation and Employees all read them.
- Profile and My phones are gone: My file holds the sign-in settings and the alerts card.
- Clean-up rules: files at most 350 lines, folders at most 12 files, both held by `size-guard.test.ts` (back end and front end).

## What was deleted
The Profile page, the My phones page and its components, the Profile menu row and its test lines, the dead `/app/profile` rule in the route gate, the unused shell file `hint-tooltip.tsx` (no file referenced it), and the 415, 372, 358, 461, 359, 440, 352 and 633 line files (split, not removed). A search of every Workforce and shell source file found nothing else that no file imports.

## What is left, and where it goes
- **Not walked in a browser:** W8, W20, W27, W33, W39, W45, W50 (go to the Schedule section's first walk as the roles concerned); the "Photo not saved" dialog, Sign out everywhere confirmation, payslip year chips and the "Earlier" fold, "This wasn't me", and My leave against Paper frame 13.8 (go to section 6 for payslips, section 9 for "This wasn't me", section 7 for leave).
- **"Search a request" on My leave:** needs a server search; goes to section 7 (Leave).
- **Folders still over 12 files (back end):** `conduct/notices`, `audit`, `needs-you`, `_shared/time`, `conduct/_shared`, `timesheets/exports`, `_shared/audit`, `notifications`, `leave`: section 10, listed in `size-guard.test.ts`.
- **Database tests:** how to run them on a clean lane: `TESTING.md`. On a clean lane 157 of 162 Workforce test files pass (2,070 of 2,079 tests). Nine tests in five files still fail, and each one asserts a rule the owner changed after the test was written; the assertions were not touched:
  - `timesheets-flow-db.test.ts` (5): lines 182 and 314 expect the Director to be refused a day decision and an export, but since 21 Oct the Director holds everything except the listed steps; the other three failures follow from the Director's decision changing the day.
  - `payroll-flow-db.test.ts` 5b and `payroll-part2-db.test.ts` 8: expect the System Admin to be refused a payroll export (same 21 Oct rule).
  - `org-departments-flow-db.test.ts` ("HR adds a department"): expects an empty new department to show a gap; since People batch 3 a gap needs people in the department.
  - `payslips-flow-db.test.ts` (wrong codes): counts the person's message kind for the System Admin too; admins now get their own kind (`payslip.three_wrong_codes_admin`).
  - Decision for the orchestrator: flip these assertions to the current rules (flip, do not delete), in the section that owns each file.
