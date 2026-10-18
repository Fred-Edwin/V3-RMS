# Workforce slice 1b (Departments and heads): back-end session

Working document. Delete it when Workforce ships. Paste everything below the divider into a fresh session started in the lane worktree (setup is in the orchestrator's message, not part of the paste).

---

You are a tech lead on Wendo RMS building the **back end of Workforce slice 1b**: Chapter 3 of the approved Paper designs ("Departments and heads"): the Organisation page, a department's page, adding a department, and assigning, ending and acting heads, with the head claims kept in step. **Back end only. No frontend files, no `nav-table.ts`.** A separate front-end session builds the screens after this one.

### What the slice is, in plain words
Slice 1a (built, in this branch) already created the tables `departments` (Inventory's table, extended), `positions`, `department_positions` and `department_heads`, backfilled them (departments from role, heads from today's `isDepartmentHead` flags), and ends head rows when someone exits or transfers. Nothing yet **changes** a head. This slice adds: reading the organisation (sites, departments, heads, gaps), creating, editing, retiring and restoring departments and their positions, previewing and assigning a head, ending a head, an **acting head** (for example while the head is on leave), and the one place that writes `User.isDepartmentHead` / `departmentTag` and emits `department.head_changed`.

### Where you work
- The lane worktree on branch **`feat/workforce-1b-heads`**, cut from `feat/workforce-1a-employees` (so the finished 1a is underneath). Run `git branch --show-current` first.
- Lane 2 ports: API on 4102 from this worktree's `backend/`, its own lane database. Seeded logins (password `password123`): `admin@wendo.test`, `director@wendo.test`, `bm.town@wendo.test`, `accountant@wendo.test`, `store.manager@wendo.test`; find the HR Manager and a department head in the seed script or with the read-only Postgres MCP.
- **Another session is building the 1a screens in lane 1 at the same time and may make small fixes inside `people/`.** To avoid conflicts, build 1b in a new sub-folder `backend/src/modules/workforce/people/organisation/` (or `org/`, matching the layout the 1a README describes), and touch existing 1a files only where the work cannot be done otherwise (the head claims hook, `register-people.ts`, the router, the access table). Keep those edits small and list them in the README.
- `CLAUDE.md` applies in full: pnpm only; no `any`; **Edit and Write tools only**; one line starting `Why:` before each Edit or Write; a live task list; commit with `git add <explicit paths>` ending with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; **nothing pushed**, no PR; end with a plain-English recap of about 5 lines. Do not touch the owner's main folder, other lanes, or production. Migrations follow the `CLAUDE.md` workflow; a migration must pass the proof-on-a-copy step like 1a's.

### Finish everything; decide, don't hand back
The owner wants **nothing pending** at the end.
- When a question the owner could answer comes up (the draft contract is wrong or silent, two reasonable behaviours), **do not stop.** Choose your recommendation, build it, and add one row to `docs/features/workforce/decisions-1b-backend.md`: *question, what you chose, why, what changing it would take*. The draft contract's §11 recommendations are the defaults for anything it covers.
- Stop and ask mid-session only if truly blocked (missing access or secret, a missing dependency) or the choice is expensive to reverse (destroying data, changing live production behaviour).
- Your final message opens with the **decisions table**, then the 5-line recap.

### Keep the code tidy as you build (no refactor afterwards)
1a needed a clean-up pass because files grew too long. Build to these limits from the first file:
- A source file aims for **250 lines or fewer** and never exceeds **350** (tests may reach 450). Split before it grows: separate the router, controller, service, repository, validators and types per sub-module.
- No catch-all `utils`/`helpers` files; name files for their job. One main service per file.
- No folder holds more than **12 files** (tests count): group into sub-folders named for what they do (`org/departments/`, `org/heads/`).
- Shared logic (the access table, "today" helpers, the account gateway, the audit writer) is used from where it already lives, never copied.
- Check after each step: `find backend/src/modules/workforce/people -name '*.ts' | xargs wc -l | sort -rn | head -5` and the five fullest folders. Fix breaches before the next step; put the final results in the README.

### Keep the cost down
No subagents or Explore agents. **Do not read the old contract in full.** Fetch its heading list, then read only the parts below with `git show feat/workforce-people:docs/features/workforce/slice-1-contract.md` (it is read-only reference, not a spec; where it is wrong or you have a better design, build the better one and record the decision). Do not re-read files you have read. While iterating run only the tests of the file you change; run the full suite and `pnpm build` once at the end. Commit after each step.

### Read first (only these parts)
1. The old contract: §1 (scope), **§4.3 (O1 to O9)**, §5.1 (only the department and head flows), **§5.3 (events)**, **§5.4 (claims: how `department.head_changed` keeps the flags right)**, §5.6 (wiring: gateway `setHeadClaims`, impact hooks, the `reconcileHeadClaims` task), §6 (access-lane coupling), §8 rows 16 to 18 (the screens' needs), §9 (tests), §11 (open questions about heads and departments). Also `git show feat/workforce-people:docs/features/workforce/handoff-slice-1-backend.md`: only its "Gates" and "Proof" lists.
2. `backend/src/modules/workforce/people/README.md` (Decisions, the head sections, Layout, Coupling) and the 1a files named there: `head-claims.ts`, `people-account-gateway.ts` (`setHeadClaims` is a stub that throws "slice 1b"), `org-routes.ts` (the router the contract reserved), `people-door.ts`, `register-people.ts`, `people-access.ts`.
3. `docs/features/workforce/slice-0-contract.md` §3 (access table) and §5 (audit writer), only as needed; `CLAUDE.md` and `docs/CODING_STANDARDS.md` §4, 5, 6, 8; `docs/DATA_MODEL.md` §9 and `docs/API_CONTRACT.md` §35 (add to them, do not rewrite).
4. **Paper is not needed.** If a screen's needs are unclear read `docs/features/workforce/README.md` Chapter 3 row and the contract's §8.

### Scope
**In:**
1. **The Organisation endpoints O1 to O9** as in the contract (overview with gaps and counts, one department with its people and head, create, edit, retire and restore, head candidates, head preview, assign, end), plus whatever positions endpoints Chapter 3 needs (positions of a department, adding one while adding a department). Every route is `authenticate`, then the subject middleware, then `requireCapability`; **no new `requireRole`**. Zod on every endpoint. Capabilities `org.read`, `org.write`, `org.write_heads` and the matching rows of the access table; log each addition in `slice-0-contract.md` §12.
2. **Heads:** assign (with the preview of "what changes"), end, acting head with its end date, the Central Store / hub rules the contract states, and the rule that a head must be an existing active employee with a login.
3. **Claims in one place:** implement `setHeadClaims` in the account gateway and `syncHeadClaims`, so a head change writes `User.isDepartmentHead` and `departmentTag` and emits `department.head_changed` in the same transaction. Hook the 1a exit and transfer flows into it (the 1a README says head rows end now but claims wait for this slice).
4. **`reconcileHeadClaims`** as the sixth scheduler task (00:05 Nairobi, idempotent: a second run changes nothing).
5. **Audit:** every write through the audit writer in the same transaction, actions registered, no amounts or ID numbers in entries.
6. **Docs:** the people `README.md` (add the new endpoints, who sees what, Decisions), `DATA_MODEL.md` §9, `API_CONTRACT.md` §35, the Workforce `README.md` status row, `docs/PROJECT_STATUS.md` build table, the access amendment log.

**Out:** any frontend; rota, clock, leave, payroll, conduct; notification delivery; the legacy department endpoints (leave them running; list in the README anything that now duplicates them).

### Gates and proof
- `cd backend && pnpm build && pnpm test` pass; the time-zone test runs and `pnpm check:imports` do not get worse; no `requireRole(` in the new code; no Prisma import outside repositories; eslint clean on what you touched. Tests: unit (claims, preview, validation, access matrix) and database flows against the lane database (like 1a's `people-flow-db.test.ts`), including: assign, replace a head, end, acting head, exit of a head, transfer of a head, and the scheduler run twice.
- If you add a migration, prove it on a copy of the lane database as 1a did, and show the backfill counts do not change.
- **Per-role proof over HTTP** with the real seeded logins: each role sees only what the access table allows (HR, Branch Manager, Store Manager, Director, Accountant, a department head, a staff login); cross-site reads answer 404, forbidden writes 403.
- **One flow end to end** on the lane database: add a department, assign a head (preview first), a head goes on exit, the acting head covers, the claims and `department.head_changed` follow every step, the audit chain verifies, and the scheduler run twice changes nothing the second time. Show queries with the read-only Postgres MCP.
- The size checks above show no file over 350 lines and no folder over 12 files.
- Commit in reviewable steps. Nothing pushed.
- Final message in order: (1) the decisions table, (2) the 5-line recap, (3) departures from the draft contract, files touched in 1a, and any gap for the front-end session. Nothing is "to do". **Do not draft the next session's prompt.** Stop for the owner's review.
