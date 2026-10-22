# Handoff: People batch 2B, part 1 to part 2

**(a) Where.** Worktree `/home/fred/Projects/V3-RMS-lanes/lane-4`, branch `feat/workforce-1-people-batch-2b` (from `feat/workforce-stack-complete`). Last code commit `bc9d4eca`; the docs commit follows it. Ports: front end 3104, API 4104, `http://lane4.localhost:3104`, database `wendo_rms_lane4`, Redis 6404. Nothing is pushed.

**(b) Built (one line each).**
1. Edit convention: amber underlined `PanelLink`, grey tag otherwise, on Job, IDs and bank, Pay.
2. `Edit IDs and bank` dialog (`ids-bank-dialog.tsx`); Accountant bank-only via new capability `payprofile.write_bank`; file `actions.editIds` and `editBank`.
3. `Edit pay` dialog (7.3) and Director review (7.4); `PayChangeRow` gained asker position and site.
4. Person label (`PersonLabel`, `PersonLabelLine`, `highlightParts`) in Assign head, Reports to, employee list; `PickerOption.render` added to `components/ui2/picker.tsx`.
5. My file: `own-ids-card.tsx` (last four, one Show, Edit), `own-numbers-dialog.tsx`, `photo-pages.tsx` (3 full pages), Still-to-finish rows 56 px; back end `patchMe` no longer locks or resets HR's check and tells the Accountant of a bank change.
6. HR Documents sentence removed; finding 70 closed.
7. Head's `ProbationReportDialog` and route `/app/workforce/probation/[id]/report`; three verdicts; HR Decide dialog shows the report block.
8. My team: `GET /workforce/people/team` and `/app/workforce/team` (`people/team/`).
9. Branch Manager's Job tab with `RestrictedCard`s.
10. Deleted: old bank dialog, own `IdBankDialog` and `NumbersDialog`, `NoteDialog`, `payChangeSteps`, the ID block of `DetailsDialog`.

**(c) Not yet done (part 2).**
- [ ] Every row of `checklist-1-people-batch-2b.md` is `verified: no`.
- [ ] Browser walk: HR, Director, Accountant, Branch Manager, a head, staff (390 px for My file and the head's pages); one screenshot beside its Paper frame per screen (7.1 to 7.5, 8.1 to 8.6, 9.1 to 9.5, 12.1); hover, keyboard, console clean, audit entries show no PIN and no number.
- [ ] Set the lane PINs with a helper (never overwrite a PIN backup) to walk the pay change, approval and probation report. Attendance switch stays off.
- [ ] Measure the 44 px tap targets on My file.
- [ ] Docs: module READMEs (`people/README.md`, `workforce/people/README.md`), `API_CONTRACT.md` (team endpoint, `actions`, verdicts), `DATA_MODEL.md` (none changed), Workforce README row, `PROJECT_STATUS.md`.

**(d) Part-2 commands.** `cd backend && pnpm exec prisma migrate deploy && pnpm exec prisma generate`. Gates: `pnpm build`, backend `pnpm test` (re-run the seven known failing DB files only at the end), `pnpm check:imports`, `pnpm lint`, `cd frontend && pnpm exec tsc --noEmit && pnpm test && pnpm build`. Servers: kill by pid, then `pnpm exec next dev -p 3104` and the API on 4104; prove fresh with `GET /api/v1/workforce/people/team` (404 means stale). Database tests need `export DATABASE_URL=$(grep '^DATABASE_URL=' backend/.env | cut -d= -f2-)`.

**(e) Read first.** `docs/features/workforce/decisions-1-people-batch-2b.md`; `docs/features/workforce/checklist-1-people-batch-2b.md`; `docs/features/workforce/final-pass/design-notes-1-round-2.md`; `frontend/features/workforce/people/mine/components/my-file-screen.tsx`; `frontend/features/workforce/people/file/components/tabs/job-pay-tab.tsx`.

**(f) Gotchas.** Never `pkill -f`. The lane has no WAITER employees (use BARISTA or CHEF for staff). zsh: no `grep --include`. The read-only Postgres MCP is the owner's main database. Shared-file edits to name in the final message: `lib/route-access.ts` (one block, own commit) and its test; `components/ui2/picker.tsx` (`render` prop); kit `_shared/index.ts`, `person-radio-list.tsx`; `workforce-access.ts` and its matrix test (new capability). 2A owns `nav-table.ts`, the shell, Homes and the refusal screen; agree the route names: `/app/workforce/team` and `/app/workforce/probation/[id]/report` (built here).

**(g) Rule slips.** Three no-op Bash heredocs (empty `python3`, `cat > /dev/null`, `cat > /tmp/x`) that edited nothing, and leftover empty `/tmp` files, now removed. `backend/.../people/` holds 27 files already; this batch added none to that folder (new code is in `people/team/` and `people/employees/`), but the folder was not split.

**(h) Departures from the spec.** "Deductions and rules" card on 7.1 not built (decision 2). Employee list cell is "Name · position" (decision 13). No notification to HR when a head sends a report (decision 9). Paper was opened once only (to look for 8.x frames; none of the values were needed), so every Paper comparison is for part 2.
