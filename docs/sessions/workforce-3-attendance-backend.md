# Workforce slice 3 (Attendance): back-end session

Working document. Delete it when Workforce ships. Paste everything below the divider into a fresh session started in the lane worktree.

---

You are a tech lead on Wendo RMS building the **back end of Workforce slice 3: Attendance** (Chapters 6 "A day at work" and 7 "Today board and fixing time" of the approved Paper designs): clocking in and out against the new rota, undo, the shift-end prompt, lateness, the Today board, and fixing time. **Back end only. No frontend files, no `nav-table.ts`.** A front-end session follows.

### Safety first: this is the riskiest slice, because the legacy clock is live
Waiters, chefs and baristas clock in today through the **legacy** `ClockRecord`, `Shift` and `ShiftAssignment` tables and `clock-service.ts` / `shift-assignment-service.ts` (routes `clock-routes.ts`). Production runs these every day. Pay and lateness may already depend on them.
- **Do not drop, rename or alter the legacy tables, and do not change what the legacy clock endpoints do while a site is not switched over.** All new tables and code are additive.
- The new attendance runs behind a **per-site switch** (default **off**, stored where the Rules store or site settings pattern fits; record the choice). While a site's switch is off, nothing changes for that site: the legacy clock stays authoritative. When it is on, that site clocks against the new rota, and the legacy clock endpoints for that site **answer with a clear refusal or delegate** (decide, record, and make it reversible by turning the switch off). The owner will **pilot at one branch** before any wider switch-on, so switching a site on and off again must be safe and must never lose or double-count a clock event.
- Carry any clock event written under one engine so the other can read it for that day (record how), or refuse to switch a site on in the middle of an open clock-in.
- **Possible production bug to verify (do not fix legacy in production silently):** the legacy lateness code may use server-local time, and production runs in UTC, so lateness may be wrong. Read the legacy code, write a test that shows what it computes for a Nairobi 06:00 shift on a UTC server, and **report the finding** in the decisions table with the evidence and a recommendation. Your new code uses only the Nairobi time helpers in `workforce/_shared/time/`.

### Where you work
- The lane worktree on branch **`feat/workforce-3-attendance`**, cut from `feat/workforce-2-rota` (people, departments, heads and the new rota underneath). Run `git branch --show-current` first.
- Lane 2 ports: API on 4102 from `backend/`, own lane database. Logins (password `password123`): `admin@`, `director@`, `bm.town@`, `accountant@`, `store.manager@`, `hr@wendo.test`, plus a department head and a waiter/staff login found with the read-only Postgres MCP.
- Another session builds the Rota screens in lane 1 and may make small fixes in `rota/`. Build attendance in a new module folder **`backend/src/modules/workforce/attendance/`** (sub-folders such as `clock/`, `board/`, `fixes/`, `lateness/`), touching existing files only where unavoidable (router registration, the access table, audit actions, events, the legacy clock only for the per-site delegation) and listing them in the README.
- `CLAUDE.md` applies in full: pnpm only; no `any`; **Edit and Write tools only (never sed, awk or scripts)**; one line starting `Why:` before each Edit or Write; a live task list; commit with `git add <explicit paths>` ending with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; **nothing pushed**, no PR; end with a plain-English recap of about 5 lines. Do not touch the owner's main folder, other lanes, or production. Migrations follow the `CLAUDE.md` workflow, are additive, and pass the proof-on-a-copy step like 1a and the Rota did.

### Finish everything; decide, don't hand back
Nothing may be left pending. On a question the owner could answer (Paper is silent, two reasonable behaviours), choose your recommendation, build it, and add a row to `docs/features/workforce/decisions-3-attendance-backend.md` (*question, choice, why, what changing it takes*). Stop and ask only if truly blocked or the choice is expensive to reverse (destroying data, changing live production behaviour). Your final message opens with the decisions table, then the 5-line recap.

### Keep the code tidy as you build
Source files aim for 250 lines or fewer and never exceed 350 (tests 450); separate router, controller, service, repository, validators and types per sub-module; no catch-all `utils`/`helpers`; no folder over 12 files; reuse `_shared` (access table, time engine, audit writer, events, `tracks-time`) and the rota's read functions; never copy them. Run `find backend/src/modules/workforce/attendance -name '*.ts' | xargs wc -l | sort -rn | head -5` and the five fullest folders after each step; fix breaches before moving on. Also fix the five old ESLint errors named below so the gates are fully green.

### Keep the cost down
No subagents or Explore agents. Read only what is named; never re-read a file; run only the tests for the file you change while iterating, the full suite and `pnpm build` once at the end; commit after each step.

### Read first (only these parts)
1. **Paper** (file `01M3TP8J54R83RHC9FJ7RAHGKG`, page "Workforce · B. Schedule and time", artboards **Chapter 6 · A day at work** `19CE-0` and **Chapter 7 · Today board and fixing time** `19ZT-0`; call `get_guide` with `paper-mcp-instructions` once): read the steps live, only to learn **what data and rules each screen needs** (the clock card, clock in and out, undo, the shift-end prompt, the Today board with its states, fixing time with a reason). You are not building UI. The rota was redrawn without a publish step; ignore any "published" wording.
2. `docs/features/workforce/README.md` (Chapters 6 and 7 rows and decisions) and `docs/features/workforce/proposal.md` §5.2 (clock and mistake-proofing), §5.3 (shift-end prompt: unavoidable), §5.4 (manager's day), §5.6 (lateness and deductions), §7 (time zone and timers), §9 (access).
3. `backend/src/modules/workforce/rota/README.md` (what the rota exposes: entries per person and day, templates, `payAmountOn`/tracks-time rules), `people/README.md` (Layout, Coupling, the `tracks-time` resolver), `docs/features/workforce/slice-0-contract.md` §2, §3 (access table), §5 (audit writer), §7 (door and events), §12 (amendments: code wins), `backend/src/modules/workforce/_shared/README.md` and the time engine.
4. The legacy code **only as far as needed** to preserve it and design the switch: `backend/src/services/clock-service.ts`, `shift-assignment-service.ts`, `routes/clock-routes.ts`, the Prisma models `Shift`, `ShiftAssignment`, `ClockRecord` in `backend/prisma/schema/workforce.prisma`.
5. `CLAUDE.md`, `docs/CODING_STANDARDS.md` §4, 5, 6, 8; `docs/DATA_MODEL.md` §8 to §10 and `docs/API_CONTRACT.md` §32, §35, §36 (add to them, do not rewrite).

### Scope
**In:**
1. **Data (new, additive tables):** clock events (the fact: employee, rota entry or none, in/out, instant, source, who recorded it, undo link), the per-site switch, and whatever fixing time and lateness need. Employee, not legacy user, is the subject; only people who `tracks time` clock.
2. **Clock:** clock in and out against today's rota entry (with the early/late rules from Paper), undo within its window, the unavoidable shift-end prompt (due state, not a notification), a forgotten clock-out handled as Paper draws, double-tap and offline-retry safety (idempotency keys), and reading "my day" for the phone's clock card (next shift, state, hours so far, week bars).
3. **Lateness:** computed in Nairobi time only, from the rota entry's start and the event, with the grace and rules read from the Rules store; exposed as data, with deductions left to slice 4.
4. **Today board:** per site and department, who is on, late, not yet in, on leave (empty until slice 5), with a state per person and counts; a head sees only their department; the Branch Manager sees their site.
5. **Fixing time:** a manager corrects a clock event with a required reason; nothing is silently changed or deleted (a correction is a new linked record), every fix audited with before and after (no pay figures); past-period locks are slice 4's, so expose the hook but do not build timesheets.
6. **Endpoints:** every route `authenticate`, then the subject middleware, then `requireCapability` (add attendance capabilities to the access table and log each in `slice-0-contract.md` §12; **no new `requireRole`**), Zod on all.
7. **Events and audit:** events through the Workforce events door (`attendance.clocked_in`, `clocked_out`, `late`, `fixed`, and so on); every write through the audit writer in the same transaction.
8. **Switch and delegation** as described above, with tests that turn a site on, clock, turn it off, and show the legacy tables unchanged and no event lost.
9. **Fix the old lint errors** so ESLint is fully clean: unused `_id`/`_hash` in `_shared/audit/audit-hash.ts` and `audit-hash.test.ts`, and the `namespace` in `_shared/workforce-access.ts` (convert to module exports without changing behaviour; the access tests must still pass).
10. **Docs:** an `attendance/README.md` (what it does, endpoints, who sees what, layout, Decisions, the switch and rollback), `DATA_MODEL.md`, `API_CONTRACT.md`, the Workforce README status row, `docs/PROJECT_STATUS.md`, the access amendment log.

**Out:** any frontend; timesheets, overtime, report a problem, approvals (slice 4); leave data (return none until slice 5); payroll; notification delivery (log only); changing legacy tables or services except the per-site delegation.

### Gates and proof
- `cd backend && pnpm build && pnpm test` pass; the time-zone test runs pass (include a Nairobi-vs-UTC lateness case); `pnpm check:imports` does not get worse; no `requireRole(` in new code; no Prisma import outside repositories; **ESLint fully clean** on all Workforce code. Unit tests (lateness, clock rules, idempotency, undo window, board states, fix rules, validators, access matrix) and database flows against the lane database.
- Migration proof on a copy of the lane database as before: legacy tables identical before and after, the switch default off changes nothing, a second run changes nothing.
- **Per-role proof over HTTP** with real seeded logins (HR, Branch Manager, Store Manager, Director, Accountant, a department head, a waiter): each sees only what the table allows; cross-site 404, forbidden writes 403.
- **One flow end to end** on the lane database, checked with the read-only Postgres MCP: switch a site on, a staff member clocks in on their rota entry (late), clocks out via the prompt, a manager fixes a time with a reason, the Today board matches, undo works inside its window, switch off and legacy clocking works again, the audit chain verifies, no legacy rows changed. Tear the proof data down.
- Size checks clean. Commit in reviewable steps. Nothing pushed.
- Final message: (1) decisions table, **including the lateness finding with evidence**, (2) 5-line recap, (3) departures, existing files touched, how to switch a site on and off, gaps for the front-end session. Nothing "to do". **Do not draft the next session's prompt.** Stop for the owner's review.
