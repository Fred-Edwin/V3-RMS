# Handoff: People final pass, fix batch 1 (Part 1 and Part 2 done)

**(a) Where.** Worktree `lane-2`, branch `fix/workforce-1-people-batch-1` (merged with `origin/feat/workforce-stack-complete`), last commit: see `git log -1`. Ports 3102 / 4102, database `wendo_rms_lane2`. Nothing is pushed. Servers and the lane 2 Redis container are stopped.

**(b) Built.** Every row of `checklist-1-people-fix-1.md` is built. Part 2 added: 7-day expiry of an unused temporary password (migration `20261021120000_user_temporary_password_expiry`), the widened 260-word Swahili list (`sign-in/swahili-words.ts`), backfill of "Reports to" (`src/scripts/backfill-reports-to.ts`), Activity tab outcome and "by", recorded contract in Documents, O6b "people without a login" and its list in Assign head, My file form for National ID and bank, "Ask HR to change this", copy pass, bank list in the file's bank dialog, "Pay in the October run", the "trying again" note, shared in-flight reads (row 28), one top bar on Workforce Home for a head.

**(c) Not done or not seen.**
- [ ] Rows 4, 37 (signing PIN): HR and Director have no PIN in the lane, so not walked.
- [ ] Rows 5, 16, 17, 54, 46: no data or no way to provoke it in the lane; unit-tested only.
- [ ] Row 50: Chrome prints its own 404 line; the page cannot suppress it.
- [ ] Documents tab, bank dialog, Move dialog and Login dialog were not opened in the browser (copy checked by tests).
- [ ] The Director's Overview and the department head's My file were looked at only briefly; no screenshot was read for the Director's file.

**(d) Gates run.** Backend `pnpm build`, `pnpm test` (7 known DB-flow files fail as on the base; people-flow and org-heads-flow fail only when run in parallel and pass alone), `check:imports` 50 warnings 0 errors, ESLint on changed files. Front end `tsc`, `vitest` (1,611 passed), `pnpm build`, ESLint (one old `<img>` warning in `who-step.tsx`).

**(e) Read first.** `checklist-1-people-fix-1.md`; `final-pass/1-people-decisions.md`; `backend/src/modules/workforce/people/sign-in/`; `frontend/lib/apiClient.ts`.

**(f) Gotchas.** The lane's Redis container `wendo-lane-2-redis` must be started (`docker start wendo-lane-2-redis`) before the API is healthy. The window cannot be resized; use device emulation for 390 px. The attendance switch is on for the test branch "ZZ Pay2" (changed 20 Oct, not by this session); the Nyeri sites have no switch row.

**(g) Rule slips.** Three empty no-op Bash calls (a `sed` on /dev/null, an empty python heredoc, an empty `cat >>` heredoc); one migration file written with `printf` instead of the Write tool; one commit that carried a type error (fixed in the next commit); screenshots first saved in a mistyped scratchpad path (moved on).

**(h) Departures.** Cash only for casuals (monthly: Bank or M-Pesa). NSSF and SHA formats lenient. The word list is a draft for a Swahili speaker. The workforce public door is unchanged: the backfill script imports its function by path. The lane database was backfilled (9 rows) and Kelvin Kings's National ID was set during the walk.
