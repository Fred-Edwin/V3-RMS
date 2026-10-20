# Handoff: Conduct front end, part 1 → part 2

## (a) Where
- Worktree `/home/fred/Projects/V3-RMS-lanes/lane-2`, branch `feat/workforce-5-conduct-frontend` (cut from `feat/workforce-backends-4-6`). Last code commit: `e6c5e639`; the docs commit follows it.
- Ports: front end `pnpm exec next dev -p 3102`, API 4102, browser `http://lane2.localhost:3102`, database `wendo_rms_lane2`.

## (b) Built (every screen of the brief, committed, `tsc` clean)
- Staff: list, one notice with stepper (also the "before signing" layout), sign with code, appeal, Document view, witness card.
- Desk: list on the shared table (KPI strip, chips, Site select, `?id=`), standard panel, HR appeal panel.
- Dialogs: Issue a warning (right sheet, person picker, facts, preview, PIN), Record not signed (witness, PIN), Decide / Change (preview rows, reason, PIN).
- Employee file Conduct tab; status reference (disclosure); nav rows; route gates.
- Kit/shared edits: `CircleStepper`, `SegmentItem.disabled`, `DataTable isRowSelected`, `tabsFor` 2nd argument. All listed in `conduct/README.md`.

## (c) Not yet done (part 2)
- [ ] Fresh servers, switch on for one lane site, walk staff phone (390) and desk (1440 and 1100), switch off again
- [ ] One screenshot pair per screen against Paper (nodes in the spec table); fix differences; read values only where the eye cannot settle
- [ ] Keyboard run of each main task; hover/focus/disabled of each new interactive part; screen-reader labels
- [ ] Safety property: switch off, main roles see nothing new; one flow end to end with the audit entries
- [ ] Gates once each: `pnpm exec tsc --noEmit`, `pnpm lint` (zero errors), `pnpm test`, `pnpm build`; size checks
- [ ] Docs: README, parity manifest (one line per screen), `docs/PROJECT_STATUS.md`, Workforce README row; tick `Verified` in the checklist
- [ ] Decide the open compare items in the decisions file (row 18 radio cards, row 19 tag popover)

## (d) Part-2 commands
```
cd /home/fred/Projects/V3-RMS-lanes/lane-2/frontend
pnpm exec tsc --noEmit && pnpm lint && pnpm test && pnpm build
pnpm exec vitest run features/workforce/conduct components/app/shell lib
```
Start the servers in the background with a log; confirm `/app/conduct` (new code only) answers before any screenshot.

## (e) Read first
1. `docs/sessions/workforce-5-conduct-frontend.md` (brief), 2. `docs/features/workforce/decisions-5-conduct-frontend.md`, 3. `specs/5-conduct-spec.md` (screens S1 to S14 and the Paper node table), 4. `frontend/features/workforce/conduct/README.md`, 5. the two session method files.

## (f) Gotchas
- Logins `password123`: `hr@`, `director@`, `bm.town@`, `accountant@`, `store.manager@wendo.test`; a floor-staff login from the read-only Postgres MCP (owner's main database: never write there).
- The lane database may lack `hr@wendo.test`. A staff member needs a signing PIN set; the screens ask for one first.
- A notice needs the site's attendance switch on (System Admin owns it). Issue one as the Branch Manager, then sign it as the person; turn the switch off at the end.
- Long commands in the background; never `pkill -f`; login limit is 10 a minute.
- `DataTable` search param is `search`; the chips key is `status` (Active is the empty value).

## (g) Rule slips
- I printed a very large old page (`app/app/payslips/page.tsx`) into my own context by mistake while looking for a pattern. No effect on the code.
- Ran a wider test subset than strictly "changed files" once (`components/app/shell lib`, 107 files, all passing) to fix the nav lists. No full suite, build or browser run was done.
- A no-op heredoc to `/dev/null` was issued once in Bash; it edited nothing.

## (h) Departures from the spec
- Employee file is `employees/[id]`, not `people/[id]`. Status words popover not built (disclosure instead). Inbox message, menu badge and Home rows left to Shared parts. "Read as text" not built (API has no text). `aria-current` instead of `aria-selected` on the chosen row. The decision options use `RadioCards`, not Paper's ink fill (to compare). Full list: decisions file rows 1 to 26.
