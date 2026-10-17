# Workforce slice 1a (Hire and the file): back-end session

Working document. Delete it when slice 1a ships. Paste everything below the line into a fresh session started in the new lane worktree (setup is in "Owner setup", not part of the paste).

**Owner setup (the owner runs this once, before starting the session).**
1. Run it only after the Workforce frame session has been approved. The branch chain is `docs/workforce-orchestration` then `feat/workforce-ui-kit` then `feat/workforce-frame` then this one; each is cut from the previous local branch (not `origin/main`, which does not have the Workforce docs or the kit yet).
2. Free the lane that held the previous session (`down` refuses if anything is uncommitted; the branch itself stays) and open a lane on the new branch:
   `cd ~/Projects/V3-RMS && scripts/lane.sh down 1 && git branch feat/workforce-1a-employees feat/workforce-frame && scripts/lane.sh up 1 feat/workforce-1a-employees`
3. Start the session with that lane's worktree (`~/Projects/V3-RMS-lanes/lane-1`) as the working directory.

---

You are a tech lead on Wendo RMS building **Workforce slice 1a (Hire and the file)**, **back end only, no screens**. The front end is a separate, later session.

### How this works now (owner decision, 17 Oct 2026)
There is **no contract session and no frozen contract**. The slice is built one vertical piece at a time: this back-end session, then the owner's check, then a front-end session. A contract for the whole of slice 1 was drafted earlier on branch `feat/workforce-people`. It is **reference material, not a spec you must obey**: it holds validated schema, backfill logic, endpoint tables and 17 reasoned decisions, so you use it instead of re-deriving them. Where you find it wrong or better done differently, build the better thing and record the decision (see "Record"). Do not edit that branch or file.

### Where you work
- The lane worktree on the fresh branch **`feat/workforce-1a-employees`**, cut from `feat/workforce-frame` (the previous approved Workforce branch, which itself descends from `main`). First run `git branch --show-current` (must print that) and confirm `backend/src/modules/workforce/_shared/` and `rules/` exist (slice 0, PR #86). If `origin/main` has moved in a way that affects Workforce or Access, tell the owner.
- Do not touch the owner's main folder (`~/Projects/V3-RMS`), production, any other lane, or files outside this slice, except the small Access edits listed below.
- `CLAUDE.md` applies in full: pnpm only; no `any`; **Edit and Write tools only** (no sed, awk, Python or heredoc scripts in Bash); one line starting `Why:` before each Edit or Write; a live task list; commit with `git add <explicit paths>` and end each commit message with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; **nothing is pushed, no PR**; end with a plain-English recap of about 5 lines (what changed, which files, how the owner verifies it).

### Read first (only these parts; never whole documents)
1. **Reference files from the old branch.** Read them without checking the branch out, into the scratchpad directory:
   `git show feat/workforce-people:docs/features/workforce/slice-1-contract.md` (the reference; read all of it once, it is long, then use sections 2, 3, 4.1, 4.2, 5, 6 and 11 as you build) and `git show feat/workforce-people:docs/features/workforce/handoff-slice-1-backend.md` (its "Build, in this order", "Gates" and "Proof to show the owner" lists are the checklist for this session, **except where this brief overrides them**).
2. `docs/features/workforce/slice-0-contract.md` (built and frozen): section 2 (conventions, models, legacy mapping), 3 (access table), 5 (audit writer, how actions are registered), 7 (door and events), 12 (amendments: the code wins).
3. `docs/features/workforce/README.md` (decisions) and `proposal.md` sections 0, 2.3 and 9.
4. `CLAUDE.md` (migration workflow, non-negotiables), `docs/CODING_STANDARDS.md` sections 4, 5, 6, 8; `docs/DATA_MODEL.md` and `docs/API_CONTRACT.md` only the parts you change.
5. Code to copy patterns from: `backend/src/modules/workforce/rules/`, `_shared/audit/`, `_shared/workforce-access.ts`, `_shared/permissions-routes.ts`, `_shared/tracks-time.ts`, `_shared/events.ts`; Inventory's `_shared/central-store-access.ts`.
6. The legacy code slice 1 replaces or calls: `services/hr-service.ts`, `repositories/hr-repository.ts` (profile and document parts), `services/staff-service.ts`, `services/staff-transfer-service.ts`, `services/auth-service.ts` (how claims reach the token), `utils/hr-constants.ts`.
7. **Paper is not needed** for a back-end session. When a screen's needs are unclear, read `docs/features/workforce/README.md` rows for Chapters 2 and 4 and the contract's section 8 (screens, read from Paper on 6 Oct 2026).

### Scope of 1a
**In:** the migration for **all thirteen slice 1 tables** (the contract's schema was validated as one block; do not split it by hand) and the **people backfill** with its proof; the employee file; contract record; pay profile and pay history with the Director's decision; hire and drafts; edit job; probation decision and notes; transfer, send to another site and loan; exit, undo, finalise and rehire; login creation; the employee's own file and photo; file requests; statutory verification; documents; the masking and reveal rules; the access amendment; the real "tracks time" resolver; the real `getEmployee` in the door; the scheduler tasks `activateStarted`, `finalizeExits`, `applyMoves`, `applyPayChanges` and `expireDrafts`. That is the contract's endpoints **R1 to R11 and W1 to W28**, and everything they need.

**Out (slice 1b, the next piece):** the Organisation endpoints **O1 to O9 and the positions endpoints**, assigning and ending heads and acting heads, `syncHeadClaims`, `setHeadClaims` in the gateway, the `reconcileHeadClaims` task, and `department.head_changed` emission. The `departments`, `positions` and `department_heads` tables are migrated now (and backfilled: departments from role, heads from today's flags), and `GET /workforce/people/lookups` reads them, but nothing in 1a changes a head. Keep `User.isDepartmentHead` and `departmentTag` untouched.

**Also out, for later slices:** PDFs and signed documents, notifications delivery, the first-sign-in email, anything from rota, clock, timesheets, leave, payroll or conduct. Where an approved screen shows data from those, return it empty, as the contract's section 8 says.

### Decisions (defaults, owner decision of 17 Oct 2026)
Every recommendation in the contract's section 11 is the default; build as drafted. Pay attention to questions 1 (pay set at hire is not Director-approved, only later changes are), 2 (a Branch Manager edits a file's job only while it is onboarding) and 3 (departments from role, not tags). If you disagree with one on the evidence, **stop on that point, build the rest, and ask the owner** in your report rather than silently changing it.

### Build order
Follow the old handoff's steps 0 to 10, with these changes:
- **Step 1 (schema, migration, proof):** as written, the whole schema. Generate with `npx prisma migrate dev --create-only --name workforce_people`, add the raw SQL and backfill by hand with the Edit tool, run the proof on a copy. The backfill proof runs against the lane database, never production.
- **Step 3 (access amendment):** as written (head scope from `headOfDepartmentIds`, the two new capabilities `payprofile.approve` and `probation.note`).
- **Step 4:** employees, hire and drafts, pay, lifecycle. **Skip organisation.**
- **Step 5 (gateway):** implement `createLogin`, `setActive` and `moveToSite`. Leave `setHeadClaims` a documented stub that throws "slice 1b". The contract's section 6.3 item 2 (HR cannot create accounts today): use the contract's fallback unless the owner says Access has changed.
- **Step 6 (endpoints):** R1 to R11, W1 to W28 only. `workforceOrgRouter` stays empty.
- **Step 7:** register the real tracks-time resolver; make `getEmployee` real. `registerImpactProvider` and the layering test as in the contract.
- **Step 8 (scheduler):** the five tasks above, each idempotent and tested.
- **Step 9 (tests) and 10 (docs):** as written, limited to the 1a scope.
- Layer rules: business logic in services only; Prisma queries in repositories only; `siteId` or `companyId` in every repository query (column `organization_id`); Zod on every endpoint; `authenticate`, `attachWorkforceSubject`, `requireCapability(...)`, **never `requireRole`**; every write through `runAudited`; never an amount, ID number, bank number, password or PIN in an audit entry or event; no `any`.

### Record (replaces "freeze the contract")
- Do **not** edit the old contract. Write what you built into: the `people/` sub-module `README.md` (what it does, endpoints, roles, a **Decisions** section listing every place you departed from the reference and why), `docs/DATA_MODEL.md` (the thirteen tables), `docs/API_CONTRACT.md` (the 1a endpoints), `docs/features/workforce/README.md` (status row) and `docs/PROJECT_STATUS.md` (the Workforce build table). Copy the access-table additions into the amendment log of `slice-0-contract.md` section 12 in the same commit as the access change.

### Gates (all pass before you report)
- `cd backend && pnpm build && pnpm test` and `pnpm test:workforce-tz`; `pnpm check:imports` with no new warnings against your recorded baseline.
- No `prisma` import outside `*-repository.ts` in the new code (the audit writer's `$transaction` is the named exception); no `requireRole(` in `people/`; only `people-account-gateway.ts` imports legacy `services/` or `repositories/`.
- The backfill proof passes (row counts before and after, nothing lost, a second run changes nothing) and `prisma migrate diff` is clean.
- The front end is untouched, so its build is not required; say so.

### Proof to show the owner
As in the old handoff: **per-role access results** with the real seeded logins (the same file, with the logins and the `password123` note), **sensitive fields hidden for each role** (the `locked` list, present and absent keys, cross-site `404`, a head seeing only their department, reveal and pay-open writing audit rows), **backfill counts**, and **one flow end to end** on the lane database: hire, edit, change pay with the Director's decision, probation decision, transfer, exit, undo, then show with the read-only Postgres MCP the audit chain links and verifies, that no amount or ID number appears in any audit row, and that the scheduler run twice changes nothing the second time. Drop the head-assignment steps (that is 1b).

### Finish
1. Commit in reviewable steps with explicit paths (suggested: schema, migration and proof; pure code; access amendment; each service group; gateway; endpoints and wiring; scheduler; docs). Nothing pushed.
2. Give the 5-line recap and the proof above, list every departure from the reference with the reason, and every question you need the owner to answer.
3. **Do not draft the next session's prompt.** The orchestrator writes the front-end prompts after the shared UI kit exists. **Stop for the owner's check.**
