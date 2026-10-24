# Hand-off: Schedule V1, design stage to back-end stage

Written 24 Oct 2026 by the V1 design session (lane 3). Next stage: **back end only**.

## (a) Where things are
- Worktree `/home/fred/Projects/V3-RMS-lanes/lane-3`, branch `design/workforce-2-v1` (from `origin/feat/workforce-stack-complete`, base commit `b2b56faf`; the design commit follows it). Not pushed.
- Redis for this lane: 6403 (`TESTING.md`). Paper page "Workforce · Schedule · V1" in file `01M3TP8J54R83RHC9FJ7RAHGKG`.

## (b) Done
- Group 1, the Time tab (frames 1.1 to 1.5): approved by the owner.
- Group 2, the Today board's clock-off, past-day and phone states (frames 2.1 to 2.4): approved by the owner.
- `final-pass/design-notes-2-v1.md`: frames, exact copy, sizes, definitions, what the back end must supply.
- No code was changed.

## (c) Not done (back-end checklist)
- [ ] A person's month read for the Time tab: per-day rows, the five summary figures, filter (all, late, overtime, absent), paging, "does not clock" and "clock is off" flags. Gate: `timesheet.read` with scope (own site for the Branch Manager; all for HR, Director, Accountant).
- [ ] The Overview tile figures: On time (30 days incl. today), Overtime (approved this month); Leave left stays "Not set".
- [ ] Past-day board: `GET /board?date=` marks `readOnly`, no live-only actions, W27 wording fields.
- [ ] Board "clock off" state: say clock is off, keep On leave today real, say who can switch it (switch capability).
- [ ] Tests on the clean lane database; API notes in `API_CONTRACT.md` and the attendance README.

## (d) Commands for the next stage
Use the starter prompt printed at the end of the design session. It begins `git fetch -q origin`, then `git checkout -q design/workforce-2-v1`. Clean test database: `TESTING.md` (lane 3 is `wendo_rms_lane3`, copied from `wendo_rms_template`).

## (e) Read first (five files)
1. `docs/features/workforce/final-pass/design-notes-2-v1.md`
2. `docs/features/workforce/final-pass/2-schedule-plan.md` (the V1 row and hand-off protocol)
3. `docs/features/workforce/TESTING.md`
4. `backend/src/modules/workforce/attendance/README.md`
5. `backend/src/modules/workforce/_shared/workforce-access.ts`

## (f) Gotchas
- Department heads have no `timesheet.read`, so they get no Time tab; never add a new `requireRole` list, use `requireCapability`.
- All time maths through the Nairobi helpers in `_shared/time/`.
- `/day` is one person, one day; `/lateness` is capped at 62 days. Neither is a month list.
- Database tests run only on a `_lane` database; never the owner's main database or a demo-seeded lane.
- Edit the Paper design only by owner's word; the design is approved.

## (g) Rule slips
None known. One note: the Group 1 sidebar and the board's sidebar were cloned from the HR menu for convenience (not a rule break).

## (h) Departures from the brief and the design
- The brief allowed a head to read the Time tab "if they may"; they may not, so none is drawn.
- The brief named the test database `wendo_rms_test_lane3`; `TESTING.md` names it `wendo_rms_lane3` (tests run only on a `_lane` database). Use the `TESTING.md` name.
- Frames 1.3 to 1.5 and 2.2 show the page content without the menu; 2.2 shows only the changed card.
- The approved desktop board still reads "Clock in for her/him"; the phone says "for them". Reword at the next desktop board build.
