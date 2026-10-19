# Workforce ship preparation: tidy-up, last fixes and the ship checklist

Working document. Delete it when Workforce ships. Paste everything below the divider into a fresh session started in the lane 2 worktree.

---

You are a tech lead on Wendo RMS. Workforce slices 0 to 4a are built and accepted (back end and screens) and sit on a stack of local branches, none pushed. **No new features.** This session makes the stack ready to ship as one pull request and a safe pilot at Nyeri Town: it tidies the code built so far, fixes the known loose ends, and writes the owner a ship checklist. **Never touch production or the owner's main folder; never push.**

### Where you work
Lane 2 worktree. First run `git status` (must be clean) and `git checkout -b chore/workforce-ship-prep feat/workforce-4a-timesheets-frontend` (the top of the stack, which holds everything). Ports: API 4102 from `backend/`, own lane database. `CLAUDE.md` applies in full: pnpm only; no `any`; **Edit and Write tools only (never sed, awk, heredocs or scripts for editing; `git mv` is allowed for moving files)**; one line starting `Why:` before each Edit or Write; a live task list; commit with `git add <explicit paths>` ending with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; end with a plain-English recap of about 5 lines.

### Finish everything; decide, don't hand back
Nothing pending. On any question the owner could answer, choose your recommendation, do it, and log a row (*question, choice, why, what changing it takes*) in `docs/features/workforce/decisions-ship-prep.md`. Stop only if truly blocked or the choice is expensive to reverse. Your final message opens with the decisions table, then the 5-line recap. No subagents; read only what is named; commit after each step; run only the tests for what you change while iterating, then everything once at the end.

### Scope
**1. Tidy (behaviour must not change).** Measure all of `backend/src/modules/workforce/` and `frontend/features/workforce/`. Fix every file over 350 lines (tests over 450) and every folder over 12 files by splitting along real seams (known: `employees-service.ts` at 371 lines; `people/` 23 files; `_shared/time` 15; `rules` 13). Keep the public surface and imports through each module's `index.ts` the same; update README layout sections; no catch-all `utils` or `helpers`. All tests must pass before and after each split. Record before and after counts.

**2. Known loose ends.**
- The back-end database flow test that fails on the lane because legacy-carried rota weeks for 12 Oct already exist: make the flow clean up or ignore its pre-existing fixtures the right way and pass when run alone and in the documented order.
- The old proof script in which the Director switches the attendance clock on: switching is System Admin only now (owner decision 18 Oct 2026); update the script and check the other proof scripts still run (`attendance-proof`, `timesheets-proof`, the migration proofs).
- Re-run ESLint across all Workforce code (front and back) and fix anything red. `pnpm check:imports` must not be worse than the baseline you record first.

**3. Ship checklist** (`docs/features/workforce/ship-checklist.md`, plain English for the owner, exact commands in code blocks):
- The list of every Workforce migration in order, and what each adds (all additive; legacy `Shift`, `ShiftAssignment`, `ClockRecord` untouched).
- A **rehearsal on a copy of production** the owner runs from their own machine: how to dump production read-only with the existing scripts (check `scripts/` for what exists; write a new script only if none fits), restore to a scratch database, run `migrate deploy`, run the migration proof scripts against it, and what "good" looks like. You cannot run this yourself (no production access); rehearse the same commands on a copy of the lane database instead and state exactly what you ran.
- The pull request plan for the whole stack (branch order, the squash or merge choice you recommend, the known doc conflicts to expect with `main` including the Progress Hub README), and the CI/CD deploy steps from `docs/DEPLOYMENT.md` §7.
- **Switch-on plan for Nyeri Town:** who flips it (System Admin only, at `/app/workforce/attendance/switch`), the pre-flight (nobody clocked in on the old clock; the rota copied from today's shifts), what staff will see, what a manager does on day one, how to watch it (audit log, the Today board), and **rollback** (switch off at the same screen; the old clock resumes at once; today's new clocks are written back as legacy records; nothing is lost).
- Known risks and open items: the legacy lateness fix branch `fix/legacy-lateness-nairobi-time` (separate PR, tell Branch Managers the old HR attendance figures will change); other server-local date code in legacy files such as `staff-repository.ts getTodayRange` (list them, do not fix); rota change notices are batched in memory so a restart can lose a waiting notice; Redis-dependent jobs (attendance auto-close, timesheets sweep, escalation) need the worker running in production; notification delivery is log-only for timesheets.

**4. Status docs.** Update `docs/PROJECT_STATUS.md` and the Workforce README with this session's result.

### Gates
`cd backend && pnpm build && pnpm test`, the three time-zone runs (`pnpm test:workforce-tz`), `cd frontend && pnpm exec tsc --noEmit && pnpm lint && pnpm test && pnpm build`, all green, lint included. Size checks clean (five longest files, five fullest folders) at the end. Final message: decisions table, 5-line recap, before and after size counts, and what the owner must run from their own machine. **Do not draft the next session's prompt.** Stop for the owner's review.
