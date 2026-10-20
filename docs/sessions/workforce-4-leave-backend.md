# Workforce segment 4: Leave, back end

Working document. Delete it when Workforce ships. Paste everything below the divider into a fresh session started in the lane 1 worktree. **Start only after the owner has accepted the spec (done 20 Oct 2026) and Shared parts back end A is on the stack (done).**

---

You are a tech lead on Wendo RMS building the **back end of Leave** (Paper "Workforce · C. Leave and conduct", Chapter 10). **Back end only: no frontend files, no `nav-table.ts`.** Never alter legacy tables; the only legacy change allowed is the one additive guard line the spec describes (the old leave code refuses writes for a site whose attendance switch is on). Nothing pushed, no PR.

### The owner's standing rule: production-ready, not Paper-only
Build a **production-ready** back end: validation, idempotency, concurrency (two people deciding the same request), failure handling, indexes and pagination, audit in the same transaction, tests for all of it, and anything else real use needs that Paper and the spec do not show. **Log every addition and departure** in `docs/features/workforce/decisions-4-leave-backend.md` (*question, choice, why, what changing it takes*). Decide by default using your recommendation; stop and ask only if truly blocked or the choice is expensive to reverse. Your final message opens with the decisions table, then a 5-line recap.

### Owner decisions already made (20 Oct 2026, do not reopen)
- Annual leave is granted **in full at the start of the year** (not built up monthly); prorate only for people who join mid-year. Read the Rules Leave tab accordingly and log how it maps.
- **Declining needs no PIN; adjusting a balance needs a PIN**, a reason and an audit entry.
- The public verify page shows role and date only (back end B builds it; you register the document and issue the `LVE-nnnn` number and QR payload per the spec).
- **Casual workers** (on probation, no contract, paid daily; some have logins) **have no leave balance or leave requests** until their contract starts; the endpoints answer with an empty, well-formed result for them, never an error page. Log this as a decision.

### Where you work
Lane 1 worktree. `git status` must be clean; then `git checkout -b feat/workforce-4-leave-backend feat/workforce-specs-4-6` (if the lane already holds a branch at that commit, say so and continue on it). Run `git branch --show-current`. Ports: API 4101 from `backend/`, own lane database: run `migrate deploy` and `pnpm exec prisma generate` (new tables arrive with this branch). Redis may be down. Logins (password `password123`): `admin@`, `director@`, `bm.town@`, `accountant@`, `store.manager@`, `hr@wendo.test` (if a user is missing in the lane database, create an inactive-able test user in the proof script and tear it down; say so), plus other roles found with the read-only Postgres MCP (note that MCP points at the owner's main database: never write there). `CLAUDE.md` applies in full: pnpm only; no `any`; **Edit and Write tools only (never sed, awk, heredocs, scripts or `cp` for editing, and never to append to a doc: use Edit)**; one line starting `Why:` before **every** Edit or Write; a live task list; commit with `git add <explicit paths>` ending with `Co-Authored-By: ` plus the attribution line the session gives you. `requireCapability`, never `requireRole`; Zod on every endpoint; `siteId` scoping (column `organization_id`); logic in services, queries in repositories; audit in the same transaction; Nairobi time helpers only; no balances or reasons in notifications.
Two other back-end sessions (Conduct, Shared parts B) run in parallel and edit the same shared files (`workforce-access.ts`, the audit action list, `_shared/events.ts`, `API_CONTRACT.md`, `DATA_MODEL.md`, status docs): keep edits small, in a block of your own, and list every line-level change in your final message.

### Read first (only these)
1. `docs/features/workforce/specs/4-leave-spec.md`, `4-leave-spec-screens.md` (only the "What the server must provide" parts), `specs/decisions-4-spec.md`, `specs/decisions-owner-4-6.md`.
2. `backend/src/modules/workforce/needs-you/README.md` and `notifications/README.md` (the notifier: `notify`, `notifyMany`, `nudgeUsers`; add each new kind to the wording table in `notifications/wording/`; the Needs-you registry: `registerNeedsYouSource`, source shape in its README), `decisions-6a-backend.md`, `_shared/README.md`, `rota/README.md`, `rules/README.md` (Leave tab), the old leave code only where you add the guard, `CLAUDE.md`, `docs/CODING_STANDARDS.md` §4 to 8.

### Scope
1. Data: additive migration for the new tables in spec section 2; the one-time copy of open old requests and balances for a switched-on site (old tables never edited); proved on a copy of the lane database.
2. Rules and engine: balances (all calendar days, proration, carry-over, frozen when a request is decided), minimum cover (warns only), overlap check, routing (Branch Manager decides; moves to HR after 72 hours; a manager's own leave goes to HR), cancel of approved leave, HR balance adjustment with PIN.
3. Endpoints: every one in spec section 12, under `/workforce/leave`, including `needs-you` and `badge` (register the Leave source with the Needs-you registry), Balances, Calendar, History, and the rota/Today-board/"On leave"/"Coming up" hooks.
4. The leave slip: `LVE-nnnn` at approval, frozen snapshot, QR payload, A4 PDF with the same PDF rules as the timesheet report, cancelled variant; register it with the documents door when back end B provides it (until then, expose the slip data and leave a clearly named, tested registration function).
5. Capabilities in the one access table (logged in `API_CONTRACT.md`), audit events, notifications through the notifier, events `leave.requested` and `leave.decided` (already declared in `_shared/events.ts`).
6. Coexistence guard on the old leave routes.
**Out:** the Needs-you card itself, verify page, audit read screens (Shared parts), all front end.

### How this session runs: TWO PARTS (read `docs/sessions/workforce-two-part-method.md` in full first)
**Part 1 builds only** (changed-file checks, no full suite, no proofs, no docs pass), then you **stop**, write `docs/features/workforce/handoff-4-leave-backend.md` and `checklist-4-leave-backend.json`, print the starter prompt in a code block, and tell the owner to clear the context. **Part 2** (fresh context) is the "Gates and proof" section below. Everything in "Gates and proof" is part 2 only.

### Tidy and cost
Files aim for 250 lines or fewer, never over 350 (tests 450); router, controller, service, repository, validators, types separate; the module `index.ts` is its only public door; no catch-all `utils`; no folder over 12 files; never copy another module's code: call it. Compare `pnpm check:imports` with the baseline before your first commit. No subagents; read only what is named; run only the tests for what you change while iterating, then the full suite and `pnpm build` once at the end; commit after each step.

### Gates and proof
`cd backend && pnpm build && pnpm test`, the three time-zone runs, `pnpm check:imports` not worse, no `requireRole(` in new code, ESLint clean. **In part 2 (not at the start), re-run only the database-flow test files that already fail on the base and show the failing count did not grow (seven did at the end of 6A: attendance, payroll x2, payslips, timesheets and others); your branch must not add failures.** Unit tests for balances, proration, cover, routing, the status machine, the access matrix; database flows on the lane database. **Per-role HTTP proof** (`src/scripts/leave-proof.ts`, never overwriting any backup) with real logins; cross-site 404, forbidden writes 403. One end-to-end flow checked with the Postgres MCP (read only), then tear down the proof data and **leave the lane's attendance switch off**. Update the module README, `DATA_MODEL.md`, `API_CONTRACT.md`, the Workforce README status row and `docs/PROJECT_STATUS.md`.

### Final message
(1) decisions table, (2) 5-line recap, (3) departures from the spec, existing files touched (line by line for any legacy change), and the gaps the front-end session must know. Say plainly any rule slip (a Bash edit, a missing `Why:`). Nothing "to do". **Do not draft the next session's prompt.** Stop for the owner's review.
