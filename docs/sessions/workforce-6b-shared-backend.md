# Workforce segment 6: Shared parts, back end B ("Audit read, documents and verify")

Working document. Delete it when Workforce ships. Paste everything below the divider into a fresh session started in the lane 3 worktree. **Start only after the owner has accepted the spec (done 20 Oct 2026) and back end A is on the stack (done).**

---

You are a tech lead on Wendo RMS building **back end B of Shared parts** (Paper "Workforce · E. Trust and shared parts", Chapters 14 and 17). **Back end only: no frontend files, no `nav-table.ts`.** Never alter legacy tables. Nothing pushed, no PR.

### The owner's standing rule: production-ready, not Paper-only
Build a **production-ready** back end: validation, idempotency, concurrency, failure handling, indexes and pagination for a very large log, audit in the same transaction, tests for all of it, and anything else real use needs. **Log every addition and departure** in `docs/features/workforce/decisions-6b-backend.md` (*question, choice, why, what changing it takes*). Decide by default using your recommendation; stop and ask only if truly blocked or the choice is expensive to reverse. Your final message opens with the decisions table, then a 5-line recap.

### Owner decisions already made (20 Oct 2026, do not reopen)
- **The public verify page shows role and date only**: number, version, date, the signer's role, replaced or not. Never a name, a figure or a head count, and never the "total differs" message. It confirms only when the number and the hash in the QR both match. This departs from Paper Chapter 17 on purpose.
- Retention is 7 years. One company-wide audit log with an Area filter. Nobody is ever locked out for wrong codes.

### Where you work
Lane 3 worktree. `git status` must be clean; then `git checkout -b feat/workforce-6b-shared-backend feat/workforce-specs-4-6` (this is the stack top; it contains back end A). Run `git branch --show-current`. Ports: API 4103 from `backend/`, own lane database: run `migrate deploy` and `pnpm exec prisma generate`. Redis may be down. Logins (password `password123`): `admin@`, `director@`, `bm.town@`, `accountant@`, `hr@wendo.test` (create and tear down a test user in the proof script if missing, and say so); the read-only Postgres MCP points at the owner's main database: never write there. `CLAUDE.md` applies in full: pnpm only; no `any`; **Edit and Write tools only (never sed, awk, heredocs, scripts or `cp` for editing, and never to append to a doc: use Edit)**; one line starting `Why:` before **every** Edit or Write; a live task list; commit with `git add <explicit paths>` ending with `Co-Authored-By: ` plus the attribution line the session gives you. `requireCapability`, never `requireRole`; Zod on every endpoint; `siteId` scoping (column `organization_id`); logic in services, queries in repositories; Nairobi time only; no money figures in logs or notifications.
Two other back-end sessions (Leave, Conduct) run in parallel and edit the same shared files (`workforce-access.ts`, the audit action list, `_shared/events.ts`, `API_CONTRACT.md`, `DATA_MODEL.md`, status docs): keep edits small, in a block of your own, and list every line-level change in your final message. **You own the documents door and the verify endpoints; Leave and Conduct only expose their data and a named registration function for you to call.**

### Read first (only these)
1. `docs/features/workforce/specs/6a-audit-and-security-spec.md` (the audit read, Activity on my record, digest, viewers), `6c-documents-and-verify-spec.md` (all of D1 to D4, X1 to X4, X7), `specs/decisions-6-spec.md`, `specs/decisions-owner-4-6.md`.
2. `backend/src/modules/workforce/notifications/README.md`, `security/README.md` and `_shared/audit` (the `describeEntry` wording function and entry index back end A built), `decisions-6a-backend.md`, `payslips/README.md` (the opens log), `_shared/README.md` and its `documents` folder, `CLAUDE.md`, `docs/CODING_STANDARDS.md` §4 to 8.

### Scope
1. **Audit read:** list (Area and Event filters, who, date range, flagged, search, numbered pager with exact counts to 50,000), detail with entry number and hash, facets, CSV export (capped at 50,000, escaped, protected), "Check the chain" endpoint and the nightly check job, role visibility per area (the Director reads all, read only), **Activity on my record** with its chips and the answers ("This wasn't me" calls back end A's `wasntMe`), and the Director's **payslip-opens digest** (`GET /payslips/opens` range extension).
2. **Documents door and read model:** one index of every issued document (payslips PS, casual sheets CPS, payroll PAY, timesheets TSH, leave slips LVE, warning notices WRN, letters), the backfill so every already-issued number is indexed, the Signed documents index endpoint (search, filters, download, 7-year retention), and the registration function Leave and Conduct will call (agree its signature in your decisions log and README; build it so their sessions can call it, with a test that uses a stub).
3. **Verify endpoints:** public, rate limited, seven outcomes (genuine, replaced, voided, unknown, malformed, hash mismatch, rate limited), no data leakage, role and date only.
4. Capabilities in the one access table (logged in `API_CONTRACT.md`), audit events, the three module READMEs.
**Out:** all front end; the Needs-you, notifier and security work (done in A).

### How this session runs: TWO PARTS (read `docs/sessions/workforce-two-part-method.md` in full first)
**Part 1 builds only** (changed-file checks, no full suite, no proofs, no docs pass), then you **stop**, write `docs/features/workforce/handoff-6b-shared-backend.md` and `checklist-6b-shared-backend.json`, print the starter prompt in a code block, and tell the owner to clear the context. **Part 2** (fresh context) is the "Gates and proof" section below. Everything in "Gates and proof" is part 2 only.

### Tidy and cost
Files aim for 250 lines or fewer, never over 350 (tests 450); router, controller, service, repository, validators, types separate; the module `index.ts` is its only public door; no catch-all `utils`; no folder over 12 files; never copy another module's code. Compare `pnpm check:imports` with the baseline before your first commit. No subagents; read only what is named; run only the tests for what you change while iterating, then the full suite and `pnpm build` once at the end; commit after each step.

### Gates and proof
`cd backend && pnpm build && pnpm test`, the three time-zone runs, `pnpm check:imports` not worse, no `requireRole(` in new code, ESLint clean. **In part 2 (not at the start), re-run only the database-flow test files that already fail on the base and show the failing count did not grow (seven did at the end of 6A); your branch must not add failures.** Unit tests for the filters, role visibility, the CSV escaping, the verify outcomes (including no leakage), the chain check; a large-log test (5,000 generated rows plus an `EXPLAIN` check that the list and count queries use the index; no 60,000-row run). **Per-role HTTP proof** (`src/scripts/shared-6b-proof.ts`, never overwriting any backup); cross-site 404, forbidden 403. One end-to-end flow checked with the Postgres MCP (read only), then tear down the proof data. Update the module READMEs, `DATA_MODEL.md`, `API_CONTRACT.md`, the Workforce README status row and `docs/PROJECT_STATUS.md`.

### Final message
(1) decisions table, (2) 5-line recap, (3) the documents-door registration signature Leave and Conduct must call, departures from the spec, existing files touched (line by line for any legacy change), and the gaps the front-end session must know. Say plainly any rule slip. Nothing "to do". **Do not draft the next session's prompt.** Stop for the owner's review.
