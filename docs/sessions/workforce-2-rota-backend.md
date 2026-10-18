# Workforce slice 2 (Rota): back-end session

Working document. Delete it when Workforce ships. Paste everything below the divider into a fresh session started in the lane worktree.

---

You are a tech lead on Wendo RMS building the **back end of Workforce slice 2: the Rota** (Chapter 5 of the approved Paper designs): shift templates, building and publishing a week, amending after publishing, warnings, and the printed rota's data. **Back end only. No frontend files, no `nav-table.ts`.** A front-end session follows.

### Safety first: legacy shifts are live
Production already runs the **legacy** `Shift`, `ShiftAssignment` and `ClockRecord` tables (`backend/prisma/schema/workforce.prisma`) and their services, which waiters, chefs and baristas depend on for clocking in. **Do not drop, rename or alter them, and do not change what the legacy clock or shift services read or write.** Slice 3 (Attendance) is where the clock moves to the new rota. This slice builds the new rota in **new tables** and decides, as a logged decision, how today's shifts and assignments are carried over (recommended default: a one-way, repeatable copy of the templates and the not-yet-past assignments into the new tables, proved on a copy, with the legacy tables untouched and still authoritative for the clock until slice 3). Any migration is additive and passes the proof-on-a-copy step like 1a's.

### Where you work
- The lane worktree on branch **`feat/workforce-2-rota`**, cut from `feat/workforce-1b-heads` (people, departments, positions and heads underneath). Run `git branch --show-current` first.
- Lane 2 ports: API on 4102 from `backend/`, own lane database. Seeded logins (password `password123`): `admin@`, `director@`, `bm.town@`, `accountant@`, `store.manager@`, `hr@wendo.test` (create the HR login in the lane database if missing), plus a department head and a staff login found with the read-only Postgres MCP.
- Another session builds the 1b screens in lane 1 and may make small fixes in `people/organisation/`; build the rota in a new module folder **`backend/src/modules/workforce/rota/`** (sub-folders such as `templates/`, `weeks/`, `warnings/`), touching existing files only where unavoidable (router registration, the access table, audit actions, events) and listing them in the README.
- `CLAUDE.md` applies in full: pnpm only; no `any`; **Edit and Write tools only (never sed, awk or scripts)**; one line starting `Why:` before each Edit or Write; a live task list; commit with `git add <explicit paths>` ending with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; **nothing pushed**, no PR; end with a plain-English recap of about 5 lines. Do not touch the owner's main folder, other lanes, or production.

### Finish everything; decide, don't hand back
Nothing may be left pending. On a question the owner could answer (Paper is silent, two reasonable behaviours), choose your recommendation, build it, and add one row to `docs/features/workforce/decisions-2-rota-backend.md` (*question, choice, why, what changing it takes*). Stop and ask only if truly blocked or the choice is expensive to reverse. Your final message opens with the decisions table, then the 5-line recap.

### Keep the code tidy as you build
Source files aim for 250 lines or fewer and never exceed 350 (tests 450); separate router, controller, service, repository, validators and types per sub-module; no catch-all `utils`/`helpers`; no folder over 12 files; reuse `_shared` (access table, time engine, audit writer, events, `tracks-time`) and never copy it. Run `find backend/src/modules/workforce/rota -name '*.ts' | xargs wc -l | sort -rn | head -5` and the five fullest folders after each step; fix breaches before moving on; report the results in the README.

### Keep the cost down
No subagents or Explore agents. Read only what is named; never re-read a file; run only the tests for the file you change while iterating, the full suite and `pnpm build` once at the end; commit after each step.

### Read first (only these parts)
1. **Paper** (file `01M3TP8J54R83RHC9FJ7RAHGKG`, page "Workforce · B. Schedule and time", artboard **Chapter 5 · Rota**): call `get_guide` with `paper-mcp-instructions` once, then `get_tree_summary` and read the steps live, only to learn **what data each screen needs** (templates, the week grid, publish and the summary of who is notified, amend after publishing, warnings, printed rota). You are not building UI.
2. `docs/features/workforce/README.md` (Chapter 5 row and decisions) and `docs/features/workforce/proposal.md`: §0, §5.1 (rota flows and click budgets), §7 (time zone and timers), §9 (access). Rules that matter: warns, does not block (approved leave, thin coverage, weekly hours above contract, double shift; an override needs a reason); past days are read-only; no overnight shifts; no availability; hours per person and people per shift per day always visible; cost only for roles that may see pay.
3. `docs/features/workforce/slice-0-contract.md` §2, §3 (access table), §5 (audit writer), §7 (door and events), §12 (amendments: code wins); `backend/src/modules/workforce/_shared/README.md`; `backend/src/modules/workforce/people/README.md` (Layout, Coupling, `payAmountOn`, `tracks-time` resolver, head and department lookups); the legacy rota/shift services only as far as needed to design the carry-over and to avoid breaking them.
4. `CLAUDE.md`, `docs/CODING_STANDARDS.md` §4, 5, 6, 8; `docs/DATA_MODEL.md` §8 and §9 and `docs/API_CONTRACT.md` §32 and §35 (add to them, do not rewrite).

### Scope
**In:**
1. **Data:** new tables for shift templates (name, start and end in Nairobi local time, colour from the kit's shift palette, per site or department), rota weeks (draft, published, amended with history), and rota entries (employee, date, template, who set it, published version). Employee, not legacy user, is the subject; a rota entry only for people who `tracks time`.
2. **Endpoints**, every route `authenticate`, then the subject middleware, then `requireCapability` (add rota capabilities to the access table and log them in `slice-0-contract.md` §12; **no new `requireRole`**), Zod on all: list and CRUD templates; read a week (grid, hours per person, people per shift per day, warnings, cost only for pay readers); set, clear and fill cells (brush for a row, standing pattern); start a week from last week with a **preview** ("31 shifts, 2 clashes", clashes shown not copied); publish with a summary of who is told; amend after publishing (3-click flow, names who is notified, reason where required); warnings (leave, thin coverage, weekly hours, double shift) with an override reason; printed-rota data; a staff member's own upcoming shifts; read-only past days.
3. **Events and notifications:** publish and amend emit events through the Workforce events door; delivery only logs until Notifications exist.
4. **Audit:** every write through the audit writer in the same transaction; no pay figures in entries.
5. **Scheduling rules** in the Nairobi time helpers only (no server-local time).
6. **Docs:** a `rota/README.md` (what it does, endpoints, who sees what, layout, Decisions), `DATA_MODEL.md`, `API_CONTRACT.md`, the Workforce README status row, `docs/PROJECT_STATUS.md`, the access amendment log.

**Out:** any frontend; clock in and out and the Today board (slice 3); timesheets, leave (leave warnings read nothing until slice 5: return none), payroll; changing legacy tables or services.

### Gates and proof
- `cd backend && pnpm build && pnpm test` pass; the time-zone test runs pass; `pnpm check:imports` does not get worse; no `requireRole(` in new code; no Prisma import outside repositories; eslint clean on what you touched. Unit tests (warnings, week-copy preview, publish and amend, validators, access matrix) and database flows against the lane database (build a week, copy it, publish, amend, the legacy tables unchanged, the carry-over run twice changes nothing).
- Migration proof on a copy of the lane database as 1a did; the legacy tables' row counts are identical before and after.
- **Per-role proof over HTTP** with real seeded logins (HR, Branch Manager, Store Manager, Director, Accountant, a department head, a staff login): each sees only what the table allows; cross-site reads 404, forbidden writes 403; pay-gated cost appears only for pay readers.
- **One flow end to end** on the lane database, checked with the read-only Postgres MCP: create templates, build a week for five people, copy it to next week with a clash, publish, amend with a notify summary, confirm the audit chain verifies and nothing legacy changed.
- Size checks clean. Commit in reviewable steps. Nothing pushed.
- Final message: (1) decisions table, (2) 5-line recap, (3) departures, existing files touched, gaps for the front-end session. Nothing "to do". **Do not draft the next session's prompt.** Stop for the owner's review.
