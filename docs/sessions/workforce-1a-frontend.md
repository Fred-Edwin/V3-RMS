# Workforce slice 1a (Hire and the file): front-end session

Working document. Delete it when Workforce ships. Paste everything below the divider into a fresh session started in the lane worktree (setup is in the orchestrator's message, not part of the paste).

---

You are a tech lead on Wendo RMS building the **screens of Workforce slice 1a**: Chapter 2 (Hire) and Chapter 4 (the Employee file) of the approved Paper designs, against the **real back end that already exists**. **Front end first.** If the screens expose a back-end gap (a missing field, a wrong status code, a missing filter), **fix it yourself** in `backend/src/modules/workforce/people/` with tests, in its own commit labelled `fix(workforce-people):`. No migrations and no changes outside the people module and its docs; if a gap needs a migration or another module, build the best front-end workaround and record it as a decision (see below).

### Finish everything; decide, don't hand back
The owner wants **nothing pending** at the end: every screen, state, hover, role walk, test, README and ledger row in scope is complete.
- When you hit a question the owner could answer (Paper is silent or contradicts the API, two reasonable behaviours, a missing wording), **do not stop and do not leave it open.** Choose your recommendation, build it, and append one row to `docs/features/workforce/decisions-1a-frontend.md`: *what the question was, what you chose, why, what it would take to change it*. Commit that file as you go.
- Ask the owner **mid-session** (stop and ask) only if you are truly blocked: you cannot proceed without access, a secret, or a missing dependency, or the choice would be expensive to reverse (deleting data, changing a live production behaviour, a migration). Otherwise decide.
- Your last message opens with the **decisions table** (the same rows, so the owner cannot miss them), then the 5-line recap.

### Where you work
- The lane worktree on branch **`feat/workforce-1a-frontend`**. It already contains the approved UI kit, the approved Chapter 1 frame and the finished 1a back end. Run `git branch --show-current` and confirm `frontend/features/workforce/_shared/`, `frontend/features/workforce/home/` and `backend/src/modules/workforce/people/` exist.
- Lane ports and gates: front end `pnpm exec next dev -p 3101`, API from this worktree's `backend/` on 4101 (the lane database already holds the backfilled employees). Every commit passes `cd frontend && pnpm exec tsc --noEmit && pnpm lint && pnpm test`; `pnpm build` before you report. Seeded logins (password `password123`): `admin@wendo.test`, `director@wendo.test`, `bm.town@wendo.test`, `accountant@wendo.test`, `store.manager@wendo.test`. Find the HR Manager and floor-staff logins in the seed script or with the read-only Postgres MCP. If a role has no login in the lane database, create one in the lane database only and say so.
- `CLAUDE.md` applies in full: pnpm only; no `any`; **Edit and Write tools only**; one line starting `Why:` before each Edit or Write; a live task list; commit with `git add <explicit paths>` ending with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; **nothing pushed**; end with a plain-English recap of about 5 lines. Do not touch the owner's main folder, other lanes, or production.

### Keep the code tidy as you build (no refactor afterwards)
The 1a back end needed a clean-up pass because files grew too long and folders too crowded. Do not repeat that. Build to these limits from the first file:
- **File size:** a component, hook or service file aims for **250 lines or fewer** and never exceeds **350**. A test file may reach 400. When a file nears 250, split it before adding more: sub-components in their own files, pure helpers in `lib/`, hooks apart from the JSX.
- **One main component per file**, named for what it is. No catch-all `utils.ts` or `helpers.tsx`: name helper files for their job (`probation-dates.ts`).
- **Folder size:** no folder holds more than **12 files** (tests count). Past that, group into sub-folders named for what the user does (`file/tabs/`, `file/dialogs/`, `hire/steps/`). Each screen gets a folder of its own; the tabs of the file each get a file inside `file/tabs/`.
- **Layout:** each sub-module follows `components/`, `hooks/`, `lib/`, `services/`, `types/` with an `index.ts` as its public face; `app/` pages stay thin routing shells; never import another feature's internals.
- **Reuse before writing:** use the kit, `components/ui2/` and what the frame built; if a piece will be needed by another Workforce screen, add it to the kit's `_shared/` rather than copying it here.
- **Check as you go:** after each screen run `find frontend/features/workforce/people -name '*.ts*' | xargs wc -l | sort -rn | head -5` and `for d in $(find frontend/features/workforce/people -type d); do echo "$(ls $d | wc -l) $d"; done | sort -rn | head -5`. Fix any breach before the next screen. Run both again before you finish and put the results in the README.

### Keep the cost down
No subagents or Explore agents. Read only the parts named below; never re-read a file you already read. While iterating run only the tests of the file you are changing; run the full suite and `pnpm build` once at the end. Commit after each screen so a context compaction loses nothing.

### Read first (only these parts)
1. `backend/src/modules/workforce/people/README.md`: **Endpoints**, **Who sees what**, **Decisions** and the owner decisions at its end. This is your API contract (it replaces any contract document). For one endpoint's exact request and response shape read its validator in `people-validators.ts` and the response type in `people.types.ts`; do not read whole controllers.
2. `frontend/features/workforce/_shared/README.md` and `index.ts` (the kit: use it, do not rebuild it) and `frontend/features/workforce/home/README.md` ("how a slice registers a card").
3. `docs/features/workforce/chapter-1-ledger.md` (the Home cards slice 1a owns, listed below) and `docs/features/workforce/README.md` rows for Chapters 2 and 4 and its decisions.
4. `docs/sessions/one-shell-navigation.md` and `frontend/components/app/shell/nav-table.ts` (rows move from `oldHref` to `newHref`), `lib/route-access.ts`, `docs/UI_BUILD_RULES.md` (states, shells, §4a the one table convention), `docs/CODING_STANDARDS.md` section 9 (frontend modules).
5. **Paper** (file `01M3TP8J54R83RHC9FJ7RAHGKG`, page "Workforce · A. The people"). Call `get_guide` with `paper-mcp-instructions` first. Use `get_tree_summary` on the page to find the artboards **Chapter 2 · Hire** and **Chapter 4 · The employee file** (Chapter 2 step 1 is node `QX1-0`, step 2 `R5O-0`, Chapter 4 starts at `Y8C-0`). Read every step of both chapters live, never from memory.

### Scope
**In:**
1. **Chapter 2, Hire:** every step as drawn: the entry from the Employees list, the stepper wizard with drafts (W1 to W4), the duplicate check (R4), HR's pay and login parts, the review step, the done state, and the "Waiting for HR" or onboarding states the chapter draws.
2. **Chapter 4, the Employee file:** the Employees list and its summary (R1, R2), the file with every tab Paper draws (job, pay, contract, documents, probation, timeline and the rest), the completeness ring and probation bar, **locked** groups shown the way Paper draws them, masked numbers with the audited **reveal** (W28), edit job (W6) with the `FIELD_NOT_ALLOWED` refusal shown as a message, pay profile and Director-approved pay changes (W9 to W11, R11) with the owner's rule that **pay shows "starts <date>" before its start day**, contract and probation decision and notes (W12 to W14), transfer, loan and moves with their previews (W15 to W18), exit with preview, checklist and 7-day undo (W19 to W22), rehire (W23), create login (W24), file requests (W25), statutory verification (W26), documents upload (W27), photo (W8), and the person's own file (`me`, R6, W7) if Paper draws it. Use the kit's "what changes" dialog, PIN dialog, reason chips and 30-second Undo toast exactly as the Interaction spec says.
3. **Navigation:** move the legacy people rows in `nav-table.ts` to the new Employees page (`oldHref` to `newHref`), show the **Employees** row, keep `nav-table.test.ts` and the route-access test green and extended. Do not delete legacy pages; list any that become unreachable in your report.
4. **Home cards 1a owns:** register them in the frame's card registry with real data hooks and tick them "data wired" in the ledger: Onboarding, No contract yet, People by branch, Probation ends (read the ledger for the exact list), and the People numbers in the KPI strip.
5. **Frontend services and types** for the endpoints above in `features/workforce/people/` (sub-modules named for what the user does, e.g. `hire/`, `employees/`, `file/`), with tests for the services, the permission-driven visibility and every non-trivial hook. Visibility of buttons comes from the permissions the API returns (`usePermissions()` pattern), never from role names.

**Out:** Organisation, departments, positions and heads (slice 1b); rota, attendance, leave, payroll, conduct; documents as PDFs and signing; notifications delivery; any back-end change.

### The per-screen loop (every screen and every tab, before the next; do not batch)
1. Pull exact values from Paper: `get_jsx` and `get_computed_styles` on the node. Every number from computed styles, never from a screenshot. Use the kit and `wds-` tokens; no hard-coded hex.
2. Build it with every state from the kit's States kit (loading, empty, error, no permission, offline) and hover, focus-visible, pressed and disabled on every interactive element. Where Paper does not draw a state or hover, build it in the same style and list it in the README's "Built beyond Paper" table.
3. Compare at the Paper width (1440 desktop; 390 for phone screens; spot-check 1024 and 820) by eye against the screenshot and by `getComputedStyle` against Paper's computed styles. **No automated pixel-diff, ever.**
4. Keyboard-only walk, screen-reader names in the accessibility snapshot, zero console errors (chrome-devtools MCP directly), with the real API and the seeded logins. **Walk each role that sees the screen** (HR Manager, Branch Manager, Store Manager, Director, Accountant, a department head if one exists, and one staff login for the own-file screens) and check what each may and may not do against the people README's "Who sees what".
5. Tick the row in the parity manifest in `features/workforce/people/README.md` and commit.

### Gates and finish
- `pnpm exec tsc --noEmit && pnpm lint && pnpm test && pnpm build` pass. Say which back-end fixes you made, if any, and run `cd backend && pnpm build && pnpm test` if you did.
- The size checks above show no file over 350 lines and no folder over 12 files (back-end fixes follow the same limits).
- Prove one flow end to end in the browser on the lane database with the real API: hire (as a Branch Manager), HR adds pay, Director approves a pay change, probation decision, transfer, exit, undo, and that the Home cards change accordingly.
- READMEs written with the behaviour: `features/workforce/people/README.md` (spec, status, endpoints used, parity manifest, built-beyond-Paper table, gaps found in the back end), the ledger rows ticked, and the status rows in `docs/PROJECT_STATUS.md` and `docs/features/workforce/README.md`.
- Commit in reviewable steps. Nothing pushed.
- Final message, in this order: (1) the **decisions table**, (2) the 5-line recap, (3) built-beyond-Paper items, back-end fixes made and legacy pages now unreachable. Nothing is "to do"; if something could not be finished, that is a blocker you should have asked about during the session. **Do not draft the next session's prompt.** Stop for the owner's review.
