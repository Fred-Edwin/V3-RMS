# Template: back-end brief

Copy to `docs/sessions/<feature>-<segment>-backend.md` on the stack, fill the `<…>` parts, commit. One session per brief; split a very large back end into part 1 (engine, stages) and part 2 (publish, corrections, exports). Start it only after the owner accepted the spec.

---

# <Feature> segment <n>: <name>, back end<, part 1>

Working document. Delete it when the feature ships. Paste everything below the divider into a fresh session started in the <lane> worktree. **Start only after the owner has accepted the spec.**

---

You are a tech lead on Wendo RMS building the **back end of <name>** (Paper "<page>", <chapters>). **Back end only: no frontend files, no `nav-table.ts`.** Never alter legacy tables; the only legacy change allowed is the small additive guard the spec describes. Nothing pushed, no PR.

### The owner's standing rule: production-ready, not Paper-only
Paper is a demonstration. Build a **production-ready** back end: validation, idempotency, concurrency (two people acting on the same record), failure handling, indexes and pagination for realistic volumes, audit in the same transaction, tests for all of it, and anything else real use needs that Paper and the spec do not show. **Log every addition and departure** in `docs/features/<feature>/decisions-<n>-backend.md` (*question, choice, why, what changing it takes*). Decide by default using your recommendation; stop and ask only if truly blocked or the choice is expensive to reverse. Your final message opens with the decisions table, then a 5-line recap.

### Where you work
Lane <n> worktree. `git status` must be clean; then `git checkout -b <branch> <top-of-stack-branch>`. Run `git branch --show-current`. Ports: API 410<n> from `backend/`, own lane database: run `migrate deploy` and `pnpm exec prisma generate`. Redis may be down (run sweeps directly). Logins (password `password123`): `admin@`, `director@`, `bm.town@`, `accountant@`, `store.manager@`, `hr@wendo.test`, plus other roles found with the read-only Postgres MCP. `CLAUDE.md` applies in full: pnpm only; no `any`; **Edit and Write tools only (never sed, awk, heredocs, scripts or `cp` for editing; `git mv` is allowed for moving files)**; one line starting `Why:` before **every** Edit or Write; a live task list; commit with `git add <explicit paths>` ending with the attribution line the session gives you; recap in plain English. `requireCapability`, never `requireRole`; Zod on every endpoint; `siteId` scoping (column `organization_id`); business logic in services, queries in repositories; audit writer in the same transaction; Nairobi time helpers only; no money figures in notifications or logs.
<If another session edits the same shared files in parallel, name the files and say: keep edits small, on separate lines, and list every line-level change.>

### Read first (only these)
1. `docs/features/<feature>/specs/<n>-<name>-spec.md` ("What the server must provide", the permissions table, the status machine, the documents section, the gap list) and its decisions file.
2. <The README and decisions of each module this one reads or extends, `_shared/README.md`, `_shared/<access table>`, the legacy code only where you add the guard>, `CLAUDE.md`, `docs/CODING_STANDARDS.md` §4 to 8.

### Scope
<Numbered list: data (additive migration, proved on a copy of the lane database), the rules and engine, the endpoints, the access capabilities (one table, role by capability; log each in the contract), audit events (never money figures), events and notifications, the coexistence guard, the documents. Then **Out:** what belongs to other sessions.>

### Tidy and cost
Source files aim for 250 lines or fewer, never over 350 (tests 450); separate router, controller, service, repository, validators and types per sub-module; **the module's `index.ts` is its only public door**; no catch-all `utils`; **no folder over 12 files**; never copy `_shared` or another module's code: call it. Size checks after each step. Compare `pnpm check:imports` with the baseline before your first commit. No subagents; read only what is named; never re-read a file; run only the tests for what you change while iterating, then the full suite and `pnpm build` once at the end; commit after each step.

### Gates and proof
`cd backend && pnpm build && pnpm test`, the three time-zone runs, `pnpm check:imports` not worse, no `requireRole(` in new code, ESLint clean on the feature's code. Unit tests for the rules, the status machine, the access matrix, validators; database flows on the lane database. Migration additive and proved on a copy of the lane database (legacy tables identical, a second run changes nothing). **Per-role HTTP proof** with real logins: each role sees and does only what the table allows; cross-site 404, forbidden writes 403. **One end-to-end flow** checked with the read-only Postgres MCP, then tear down the proof data and leave the feature switch off. Update the module READMEs, `DATA_MODEL.md`, `API_CONTRACT.md`, the feature README status row and `docs/PROJECT_STATUS.md`.

### Final message
(1) decisions table, (2) 5-line recap, (3) departures from the spec, existing files touched (line by line for any legacy change), and the gaps the front-end session must know. Nothing "to do". **Do not draft the next session's prompt.** Stop for the owner's review.
