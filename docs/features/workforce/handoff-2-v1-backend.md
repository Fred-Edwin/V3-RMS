# Hand-off: Schedule V1, back-end stage to front-end stage

Written 24 Oct 2026 by the V1 back-end session (lane 3). Next stage: **front end only**.

## (a) Where things are
- Worktree `/home/fred/Projects/V3-RMS-lanes/lane-3`, branch `design/workforce-2-v1`. Based on `5ae1ee89` (the design hand-off); the back-end commit follows it. Not pushed.
- Lane 3 database `wendo_rms_lane3` (Postgres 5433, rebuilt clean from `wendo_rms_template`), Redis 6403 (`docker start wendo-lane-3-redis`). Paper page "Workforce · Schedule · V1".

## (b) Done
- T1 `GET /workforce/attendance/time/month`: a person's month, rows newest first, five summary figures, chip counts, filter, paging, `clocks`/`clockOn`/`emptyReason`, `canEditTime`, `last30`.
- T2 `GET /workforce/attendance/time/tiles`: On time (30 days incl. today), Overtime (approved this month), Leave left = `NOT_SET`.
- Board `GET /board` adds `readOnly`, `actions`, `clock` (on, siteName, canSwitch, whoCanSwitch), `pastDay` wording, `fixedAfterTheDay`; clock off answers with no people and a real On leave.
- Tests: 27 new/changed in `time-tab/` (view, validators, 8 database flows) plus `board-mode` and route cases. Full Workforce run on a clean lane: 162 of 166 files pass; the 8 failures are the known rule-change ones in `TESTING.md` (timesheets 5, payroll 2, payslips 1).
- Docs: `API_CONTRACT.md` section 48 (and the B1 row), attendance `README.md`.

## (c) Not done (front-end checklist)
- [ ] Time tab on the employee file (frames 1.1 to 1.5), calling T1; month picker, chips from `counts`, pager from `total`/`page`/`pageSize`.
- [ ] Overview tiles (frame 1.3) from T2; "Leave left" reads "Not set" / "No leave rule for this position yet".
- [ ] Empty states from `emptyReason`; loading, busy and error from the states kit.
- [ ] Today board: clock-off cards (2.1, 2.2), past-day view (2.3), phone view (2.4) from the new board fields; reword "Clock in for her/him" to "for them".
- [ ] Hide the Time tab when the caller has no `timesheet.read` (department heads); hide "Edit time" when `canEditTime` is false.

## (d) Commands for the next stage
Starter prompt printed at the end of the back-end session. It begins `git fetch -q origin`, then `git checkout -q design/workforce-2-v1`. Database and Redis as in (a); frontend with `pnpm dev`; verify in one real browser page.

## (e) Read first (five files)
1. `docs/features/workforce/final-pass/design-notes-2-v1.md`
2. `docs/API_CONTRACT.md` section 48 (and section 37, B1)
3. `docs/features/workforce/final-pass/2-schedule-plan.md` (V1 row, hand-off protocol)
4. `backend/src/modules/workforce/attendance/README.md` ("Schedule V1")
5. `docs/features/workforce/TESTING.md`

## (f) Gotchas
- Use `minutesAfterGrace` for the "Late 12 min" tag and `summary.lateMinutes` for "20 minutes in total": both are minutes past the grace time, so they agree. Raw `minutesLate` is also sent.
- With the clock off, old days with a clock-in stay in `rows`; nothing is ever marked Absent. `emptyReason` is `CLOCK_OFF` only when no day is left to list.
- `whoCanSwitch` comes from the access table: today the Director and the System Admin (the attendance README's older "System Admin only" line is out of date; the table is the authority).
- A past day has `asOf: ''`: do not print "expected by". `fixedAfterTheDay` is empty on a live day.
- The Branch Manager phone Home is the same board. No new `requireRole` anywhere.

## (g) Rule slips
One slip: a no-op Python heredoc was run in Bash once (it changed nothing). All edits were made with Edit and Write.

## (h) Departures from the design or the scope
- Rows for days off, leave, absences and upcoming rostered days appear only from the day the clock was switched on; before that, only days with a clock-in show.
- Free future days and days outside employment are left out. Overtime counts auto-authorised and part-approved minutes too.
- The Time tab header copy "Late in the last 30 days" uses `last30` (a separate window from the picked month).
- Section number 48 in `API_CONTRACT.md` may need renumbering at the merge if another vertical took it.
