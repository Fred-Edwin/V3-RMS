# Workforce final pass: the access change (Director and System Admin)

Working document. Delete it when Workforce ships. Paste everything below the divider into a fresh session started in the **lane 2** worktree. **Small back-end session. No design, no new screens.**

---

You are a tech lead on Wendo RMS. The owner decided on 21 Oct 2026 (current and final): **the Director and the System Admin read and write everything in Workforce.** This reverses earlier decisions D2 and D15 (the System Admin had no pay, IDs or bank). Today the access table still holds the old rights. Your job is to put the decision into the one access table and prove it. Read, once: `docs/sessions/workforce-two-part-method.md` (fresh servers, background commands, no cheating, known gotchas; this session is small, so build and verify in one go with no handoff; there is no call cap) and `docs/features/workforce/final-pass/1-people-decisions.md` (findings 42 and 75), and the "Owner decisions" block in `1-people-findings.md` (search `System Admin (findings 75`).

### Where you work
Lane 2 worktree. `git status` must be clean; then `git checkout -b feat/workforce-access-change origin/feat/workforce-stack-complete`. Run `pnpm exec prisma generate` in `backend/`. Ports: front end 3102, API 4102, database `wendo_rms_lane2`. Nothing is pushed; commit before the final message.

### Read first (only these)
1. `backend/src/modules/workforce/_shared/workforce-access.ts`: the `DIRECTOR` block (around line 287), the `SYSTEM_ADMIN` block (around line 328), `SENSITIVE_GROUPS` and `lockedGroupsFor`, `assertNotSelf`, `hiddenFromUnitManager`. **This file is already over 350 lines: do not make it longer; if you must add, move something out into a new file in the same folder and say so.**
2. `docs/features/workforce/specs` and module READMEs only where a rule you change is documented (search for "System Admin" and "Director" in `backend/src/modules/workforce/*/README.md`).
3. `frontend/lib/route-access.ts` and `frontend/components/app/shell/nav-table.ts`: only to see that the menu follows the table (`nav-table.test.ts`). **Do not add menu rows or screens**: the menu redesign is Batch 2, and the design says the System Admin does not get the Director's screens in the menu (it acts as users instead).

### What to build
1. **Director: every Workforce capability at the widest scope** (hire, edit, exit, rehire, transfer, change pay, departments, positions, heads, rota edits, attendance fixes, timesheet and leave and conduct decisions where a role may decide, Rules writes, audit reads, documents). **System Admin: the same set**, including pay, IDs and bank (remove the locked groups for both roles in `lockedGroupsFor`; the audited Show buttons stay).
2. **Rules that must still hold** (write a test for each):
   - Nobody approves, decides or signs their **own** request or file: `assertNotSelf` applies to the real actor. A Director's own pay, own file, own leave and own conduct cannot be changed by themselves.
   - A step that is a PIN step stays a PIN step (payroll approval, pay change, Rules change, warnings, appeals): the actor's own PIN, never skipped.
   - **Second pair of eyes:** a pay change made by a Director applies at once (no Director approval step for themselves) and notifies HR and the Accountant (a notification with no amounts). A pay change HR requests still needs a Director other than the requester. The System Admin cannot be both requester and approver of the same change.
   - Payroll approval stays the Accountant's decision with a PIN, and Mark as paid stays as designed; the Director and System Admin may read all of payroll but **do not take over the Accountant's approval steps** unless the access table already lets the Director do so. If unsure, keep the step with the role that has it today and list it in your decisions table.
   - A Branch Manager or Store Manager still cannot reach either of them (`hiddenFromUnitManager`).
   - Every write by either role is audited with the actor's name (existing audit door); no pay figure, PIN or ID number in the entry.
3. **`GET /permissions/me`** returns the new grants for both roles, and `frontend/features/workforce/_shared` reads them. Fix any front-end test that pinned the old rights. Do not add UI.
4. **Docs:** the access section of the Workforce README and `docs/features/workforce/decisions-access-change.md` (a decisions table: choice, why, what you kept).

### Verify (same session)
`pnpm exec tsc --noEmit` (back and front), the access tests, the People, Rules, Leave, Conduct and Attendance flow tests that exist (set `DATABASE_URL` to the lane database as in the method file), `pnpm build` (back end), ESLint on changed files, `pnpm check:imports` not worse. Then a quick HTTP proof on fresh servers: as Director and as System Admin, one write in each area (hire, change pay with your own PIN, end a head, a Rules draft) returns success; as Branch Manager and Store Manager the same writes against them return 403 or 404; a self-approval returns 403. Create test users in a helper that ends by itself and say so; never write to the owner's main database. Leave the attendance switch off and the servers stopped.

### Rules
Edit and Write tools only; a live task list; no subagents; files at most 350 lines and folders at most 12 files for anything you add; commit with `git add <explicit paths>` ending with the attribution line you were given. Delete only after a search shows nothing else reads it, and list "Deleted" and "Kept, because X still uses it".

### Final message
(1) decisions table, (2) 5-line recap, (3) the rights before and after for both roles, the tests that prove the rules, the gates run with counts, rule slips and gaps. Nothing "to do". **Do not draft the next session's prompt.** Stop for the owner's review.
