# Handoff: People batch 4 (desktop "My ..." screens), lane 4

## (a) Where
- Worktree `/home/fred/Projects/V3-RMS-lanes/lane-4`, branch `feat/workforce-1-people-batch-4` (from `origin/feat/workforce-stack-complete`). Last code commit `3e238a4e` (Profile menu row dropped); this handoff is committed after it. Nothing pushed.
- Ports: front end 3104, API 4104, `http://lane4.localhost:3104`, database `wendo_rms_lane4`, Redis 6404 (docker `wendo-redis-lane4`). The API (`pnpm dev`) and front end (`next dev -p 3104`) are still running: stop them by process id.
- Logins `<name>@demo.wendo.test`, password `WendoDemo#2026`, PIN `4321` (`hr@`, `peter.kamau@` chef, `isaac.kimani@` waiter with one appealed notice).

## (b) Built (all committed)
- My file desktop: two 560 columns, plain header, photo dialogs (480/520/480), ID and bank dialog 560, Sign-in and alerts card, Sign out everywhere (reuses the "This wasn't me" server step, no new endpoint), phone page with the card.
- My payslips desktop page and One payslip as a 560 right drawer (phone pages unchanged). My notices and Activity on my record as table plus detail beside it. My leave breadcrumb, subtitle and filters.
- Removed: Profile page, My phones page and components, the Profile menu row (`rows-floor.ts`) and its test lines.
- Docs: checklist, decisions, READMEs (people, security, payslips, conduct, leave), PROJECT_STATUS row.

## (c) Not done
- [x] DONE 23 Oct. Cause: the `*-db.test.ts` files run only on a `_lane` database and look people up by `@wendo.test` emails (`bm.town@wendo.test`, `director@`, `admin@`, `accountant@`); the lane DB holds the demo seed (`@demo.wendo.test`) with August Paid, so they fail on data, not on code. Proof: on a copy of the lane DB with the emails renamed, failed files fell from 17 to 8 (6434 tests passed, 25 failed); the 8 left (attendance, conduct, payroll flow, payroll part 2, payslips, org-heads, rules versions, timesheets) look people up by other names or expect an unpaid month. No code changed, no test loosened. Run them on a database that is not demo-seeded. Original note: Find why the back-end suite shows 17 failed files (known base failures: 7). Run on a lane DB: `export DATABASE_URL=$(grep '^DATABASE_URL=' backend/.env | cut -d= -f2-)`. Single-file run of `security-db.test.ts` skipped all tests after a Prisma error: read that error first. Suspect: the demo seed left data the flow tests do not expect. Prove it (reset or use a copy of the DB), do not loosen tests. I changed no back-end code except `backend/src/scripts/demo-data/workforce/flows.ts` (skip a rule that already matches).
- [ ] `pnpm build` in frontend (not run). Backend `pnpm build` passed (tests ran after it).
- [ ] Walk what was not seen: leave detail beside the list (needs a person with requests), photo Adjust and Failed dialogs, ID and bank dialog, Activity "That was me" / "This wasn't me" buttons, 390 px payslip page and drawer states, year chips and "Earlier in" fold. Update `checklist-1-people-batch-4.md` Verified cells.
- [ ] Paper side by side was done by eye for My file, payslips, Activity, notices; leave not compared again after edits.
- [ ] Stop servers, remove docker `wendo-redis-lane4`, leave attendance switch off, commit.

## (d) Commands
`pnpm exec vitest run <path>`; frontend gates already green: vitest 196 files / 1677 tests, `pnpm lint` clean, `pnpm check:imports` 124 warnings 0 errors.

## (e) Read first
This file; `docs/sessions/final-pass-1-people-batch-4-my-screens.md`; `docs/features/workforce/checklist-1-people-batch-4.md`; `decisions-1-people-batch-4.md`; backend `security-db.test.ts` output.

## (f) Gotchas
Demo seed needs `API=http://localhost:4104` and a running Redis on 6404. Cookies/localStorage must be cleared when switching logins. `useRemote` payslip opens are audited: never prefetch.

## (g) Rule slips
A shell `python3 -c` call and a `python3 - <<EOF` heredoc no-op were run (no file edited). A bare `sleep` was blocked and redone with background waits. Edited a nav file (Profile row) that the brief reserved for Batch 3: owner asked for it; it is its own commit `3e238a4e`, expect a merge conflict with lane 2.

## (h) Departures
Header is plain (Paper) not the dark card. "Search a request" on My leave not built (no server search). Activity "By" column shows the entry's grey line. `WorkforceDrawer` gained an optional `width`.
