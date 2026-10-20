# Workforce segment 5: Conduct, back end

Working document. Delete it when Workforce ships. Paste everything below the divider into a fresh session started in the lane 2 worktree. **Start only after the owner has accepted the spec (done 20 Oct 2026) and Shared parts back end A is on the stack (done).**

---

You are a tech lead on Wendo RMS building the **back end of Conduct** (Paper "Workforce · C. Leave and conduct", Chapter 11). **Back end only: no frontend files, no `nav-table.ts`.** Never alter legacy tables (`DisciplinaryRecord` stays as is); the only legacy change allowed is the small additive guard the spec describes (the old disciplinary create and acknowledge calls refuse for a site whose attendance switch is on). Nothing pushed, no PR.

### The owner's standing rule: production-ready, not Paper-only
Build a **production-ready** back end: validation, idempotency, concurrency (two people acting on the same notice or appeal), failure handling, indexes and pagination, audit in the same transaction, tests for all of it, and anything else real use needs. **Log every addition and departure** in `docs/features/workforce/decisions-5-conduct-backend.md` (*question, choice, why, what changing it takes*). Decide by default using your recommendation; stop and ask only if truly blocked or the choice is expensive to reverse. Your final message opens with the decisions table, then a 5-line recap.

### Owner decisions already made (20 Oct 2026, do not reopen)
- A person **with no login** can be issued a notice: printed, handed over, recorded as not signed with a witness. The rule depends on **having a login**, not on being a casual (casual workers are on probation, have no contract, are paid daily, and some have logins; one with a login signs with their PIN like anyone). Correct the spec's narrower wording (C9) in your decisions log.
- A notice to someone on probation counts toward the ladder like any other and does not by itself end probation.
- The public verify page shows role and date only (back end B builds it); you issue `WRN-nnnn` from a database sequence and the QR payload per the spec.

### Where you work
Lane 2 worktree. `git status` must be clean; then `git checkout -b feat/workforce-5-conduct-backend feat/workforce-specs-4-6` (lane 2 holds `feat/workforce-specs-4-6`: cutting a new branch from it is fine). Run `git branch --show-current`. Ports: API 4102 from `backend/`, own lane database: run `migrate deploy` and `pnpm exec prisma generate`. Redis may be down. Logins (password `password123`): `admin@`, `director@`, `bm.town@`, `accountant@`, `hr@wendo.test` (if a user is missing in the lane database, create a test user in the proof script and tear it down; say so), plus roles found with the read-only Postgres MCP (it points at the owner's main database: never write there). `CLAUDE.md` applies in full: pnpm only; no `any`; **Edit and Write tools only (never sed, awk, heredocs, scripts or `cp` for editing, and never to append to a doc: use Edit)**; one line starting `Why:` before **every** Edit or Write; a live task list; commit with `git add <explicit paths>` ending with `Co-Authored-By: ` plus the attribution line the session gives you. `requireCapability`, never `requireRole`; Zod on every endpoint; `siteId` scoping (column `organization_id`); logic in services, queries in repositories; audit in the same transaction; Nairobi time helpers only; **a push or lock-screen text never carries the reason**.
Two other back-end sessions (Leave, Shared parts B) run in parallel and edit the same shared files (`workforce-access.ts`, the audit action list, `_shared/events.ts`, `API_CONTRACT.md`, `DATA_MODEL.md`, status docs): keep edits small, in a block of your own, and list every line-level change in your final message.

### Read first (only these)
1. `docs/features/workforce/specs/5-conduct-spec.md` (sections 3 and 5 to 19, and the "server provides" parts of each screen), `specs/decisions-5-spec.md`, `specs/decisions-owner-4-6.md`.
2. `backend/src/modules/workforce/needs-you/README.md` and `notifications/README.md` (the notifier and the Needs-you registry), `_shared/pin/` (**use `attemptWithPause` for signing codes: wrong tries are logged, never a lock, the System Admin is told after 3**), `decisions-6a-backend.md`, `_shared/README.md`, `rules/README.md` (Conduct tab), `people/README.md` (employee file), the old disciplinary code only where you add the guard, `CLAUDE.md`, `docs/CODING_STANDARDS.md` §4 to 8.

### Scope
1. Data: additive migration (notices, versions, appeals, witnesses, the `WRN` sequence); old records stay in the old table and show read-only as "Before the new system", never counting toward the ladder; proved on a copy of the lane database.
2. Rules: three fixed levels; letters as developer constants with placeholder wording (flag for the lawyer); facts frozen from the timesheets; one required own line by the manager; suggested next level, a final warning needs an active written warning; end date stored at issue; one appeal per notice within 7 days; outcomes keep, reduce (new linked notice, old letter becomes version 2 with a decision page, never edited) or withdraw; HR may also change a notice; HR has 7 days to decide, then the Director is told; the Director decides appeals on notices HR issued.
3. Signing and not-signed with witness and PIN; wrong-code behaviour through the shared pause door.
4. Endpoints per spec section 8 under `/workforce/conduct`, including badge counts and a Needs-you source registered with `registerNeedsYouSource` (appeals waiting for HR, notices for a manager to record, notices for staff to sign, Director overdue appeals).
5. The notice document: A4 PDF `WRN-nnnn`, frozen snapshot, the decision page, "Withdrawn" watermark, QR payload; verbal notes have no number. Expose the data for the documents door (back end B) and leave a named, tested registration function.
6. Capabilities in the one access table (logged in `API_CONTRACT.md`), audit events and category rows, notifications through the notifier, events `conduct.appeal_sent` and `conduct.appeal_decided`.
7. Coexistence guard on the old routes.
**Out:** verify page, audit read screens, all front end.

### How this session runs: TWO PARTS (read `docs/sessions/workforce-two-part-method.md` in full first)
**Part 1 builds only** (changed-file checks, no full suite, no proofs, no docs pass), then you **stop**, write `docs/features/workforce/handoff-5-conduct-backend.md` and `checklist-5-conduct-backend.json`, print the starter prompt in a code block, and tell the owner to clear the context. **Part 2** (fresh context) is the "Gates and proof" section below. Everything in "Gates and proof" is part 2 only.

### Tidy and cost
Files aim for 250 lines or fewer, never over 350 (tests 450); router, controller, service, repository, validators, types separate; the module `index.ts` is its only public door; no catch-all `utils`; no folder over 12 files; never copy another module's code. Compare `pnpm check:imports` with the baseline before your first commit. No subagents; read only what is named; run only the tests for what you change while iterating, then the full suite and `pnpm build` once at the end; commit after each step.

### Gates and proof
`cd backend && pnpm build && pnpm test`, the three time-zone runs, `pnpm check:imports` not worse, no `requireRole(` in new code, ESLint clean. **In part 2 (not at the start), re-run only the database-flow test files that already fail on the base and show the failing count did not grow (seven did at the end of 6A); your branch must not add failures.** Unit tests for the ladder, the appeal windows, the status machine, the access matrix; database flows on the lane database. **Per-role HTTP proof** (`src/scripts/conduct-proof.ts`, never overwriting any backup); heads see nothing unless named a witness; cross-site 404, forbidden writes 403. One end-to-end flow checked with the Postgres MCP (read only), then tear down the proof data and **leave the lane's attendance switch off**. Update the module README, `DATA_MODEL.md`, `API_CONTRACT.md`, the Workforce README status row and `docs/PROJECT_STATUS.md`.

### Final message
(1) decisions table, (2) 5-line recap, (3) departures from the spec, existing files touched (line by line for any legacy change), and the gaps the front-end session must know. Say plainly any rule slip. Nothing "to do". **Do not draft the next session's prompt.** Stop for the owner's review.
