# Workforce slice 1b (Departments and heads): front-end session

Working document. Delete it when Workforce ships. Paste everything below the divider into a fresh session started in the lane worktree.

---

You are a tech lead on Wendo RMS building the **screens of Workforce slice 1b**: Chapter 3 of the approved Paper designs ("Departments and heads"), against the **real back end that already exists** (Organisation O1 to O15, built and accepted). Do not edit `backend/` except to fix a small gap inside `backend/src/modules/workforce/people/organisation/` (own commit labelled `fix(workforce-org):`, with tests; no migrations).

### Where you work
- The lane worktree on branch **`feat/workforce-1b-frontend`**. It already contains the kit, the Chapter 1 frame, the 1a back and front end, and the 1b back end. Run `git branch --show-current` and confirm `frontend/features/workforce/people/` and `backend/src/modules/workforce/people/organisation/` exist.
- Ports: front end `pnpm exec next dev -p 3101`, API on 4101 from this worktree's `backend/`. The lane database may be missing 1b data: run `migrate deploy` there if needed (lane database only, never production). Seeded logins (password `password123`): `hr@wendo.test`, `director@wendo.test`, `bm.town@wendo.test`, `accountant@wendo.test`, `store.manager@wendo.test`, `admin@wendo.test`; find a department head with the read-only Postgres MCP.
- `CLAUDE.md` applies in full: pnpm only; no `any`; **Edit and Write tools only (never sed, awk or scripts)**; one line starting `Why:` before each Edit or Write; a live task list; commit with `git add <explicit paths>` ending with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; **nothing pushed**; end with a plain-English recap of about 5 lines. Do not touch the owner's main folder, other lanes, or production.

### Finish everything; decide, don't hand back
The owner wants **nothing pending** at the end: every screen, state, test, README and ledger row in scope is complete and no gate is left red.

### Speed and method (the owner's priority; read this twice)
The kit and the 1a screens already carry the look, hover, focus, motion and accessibility behaviour that Paper draws. **Your job is to assemble pages from them, not to re-verify them.**
- **Assemble from existing parts.** Page header, tabs, table, KPI strip, status pills, avatar, panels, callouts, wizard, "what changes" dialog, PIN dialog, reason chips, Undo toast, States kit, Picker, PadNumberInput: use them. Build a new component only when Paper shows something no existing part covers, and put it in the kit's `_shared/`. Do not restyle a kit part inside a screen.
- **Pull Paper values once per screen, not per component.** One `get_jsx` plus `get_computed_styles` pass on the screen's frame to get layout, spacing, copy and any value the kit does not already own. Do not re-measure kit parts (they were measured when the kit was built).
- **Compare once per screen.** Build the screen, take one screenshot at 1440, put it beside the Paper screenshot, fix visible differences, and spot-check one computed style on anything that looks off. That is the whole visual check. **Do not check dialogs, tabs or components one by one against Paper;** a dialog is checked only if it contains something the kit does not already provide. The owner has seen the designs and approved them.
- **Accessibility comes from the kit plus tests.** Use the kit's focus, labels and Esc behaviour. Do one keyboard-only run through each screen's main task (not each dialog), and add one test per new interactive component. No per-dialog audits.
- **Role checks:** walk only HR, Branch Manager and one role that must be refused, in the browser. Check the other roles through the API against "Who sees what", as 1a did, and say so.
- **Do not write long reports.** Parity manifest rows are one line per screen. No per-component prose.
- Time-box yourself: if a check is not likely to find a real problem, skip it.
- On a question the owner could answer, choose your recommendation, build it, and add one row to `docs/features/workforce/decisions-1b-frontend.md` (*question, choice, why, what changing it takes*). Stop and ask only if truly blocked or the choice is expensive to reverse.
- Your last message opens with the decisions table, then the 5-line recap.

### Keep the code tidy as you build
Files aim for 250 lines or fewer and never exceed 350 (tests 400); one main component per file; no catch-all `utils`/`helpers`; no folder over 12 files (group into `organisation/departments/`, `organisation/heads/`, `components/dialogs/`). Structure per sub-module: `components/ hooks/ lib/ services/ types/` plus `index.ts`; `app/` pages are thin shells; never import another feature's internals; reuse the kit and 1a's `people/_shared`, and add anything a later screen will need to the kit's `_shared/`. After each screen run the two size checks (five longest files, five fullest folders) and fix breaches before moving on; report the results in the README.

### Keep the cost down
No subagents or Explore agents. Read only what is named. Never re-read a file. While iterating run only the tests for the file you changed; run the full suite, `pnpm lint` and `pnpm build` once at the end. Commit after each screen.

### Read first (only these parts)
1. `backend/src/modules/workforce/people/README.md`: the Organisation endpoints (O1 to O15), who sees what, and Decisions; `docs/features/workforce/decisions-1b-backend.md` (all 21 rows: they shape the screens, e.g. standard departments cannot be retired, hub has no heads, acting head return day, candidates rule). For a request or response shape read `organisation/org-validators.ts` and `org.types.ts` only.
2. `frontend/features/workforce/_shared/README.md` and `index.ts`; `frontend/features/workforce/people/README.md` (how 1a did services, hooks, dialogs, the parity manifest) and `decisions-1a-frontend.md` (decisions that still apply: wire names say `organization`, no "she/her", Picker and PadNumberInput, no Enter-submits in dialogs); `frontend/features/workforce/home/README.md` ("how a slice registers a card").
3. `docs/features/workforce/chapter-1-ledger.md` (cards 1b owns), the Workforce README Chapter 3 row and decisions, `frontend/components/app/shell/nav-table.ts`, `lib/route-access.ts`, `docs/UI_BUILD_RULES.md` (states, shells, §4a table convention).
4. **Paper** (file `01M3TP8J54R83RHC9FJ7RAHGKG`, page "Workforce · A. The people"): call `get_guide` with `paper-mcp-instructions` first, then `get_tree_summary` to find **Chapter 3** and read every step live: the Organisation page (sites, departments, gaps), one department (people, head card, casual pool), assign a head, a head on leave, add a department, plus any retire/restore and position steps drawn.

### Scope
**In:**
1. **Organisation page** (O1): sites with their departments, heads, gaps (a gap = no head and no acting head), the four counts; hub shown as complete, no gap.
2. **One department** (O2): head card, people list (paged), casual pool, rates only for pay readers; edit, retire and restore (with the refusals as server messages); positions (O10 to O15): add, edit, link and unlink, "clocks in" change with the impact count acknowledged, "casuals allowed".
3. **Add a department** (O3) with positions.
4. **Heads:** assign a head with the preview of what changes (O6 to O8), name an acting head with a return day, end a head, promote the acting head; the candidates list; every refusal (`HUB_HAS_NO_HEADS`, `POSITION_HELD`, `DEPARTMENT_HAS_PEOPLE`, `DEPARTMENT_MANAGED_BY_INVENTORY`) shown in its own words.
5. **Navigation:** show the **Organisation** row (and **Positions** if Paper draws one) in the PEOPLE group and remove or redirect the legacy department/head entry points; extend `nav-table.test.ts` and the route-access test; list legacy pages that become unreachable.
6. **Home cards 1b owns** (for example "No head for Pastry"): register with real data and tick them "data wired" in the ledger.
7. Services, types, hooks and tests for all endpoints used; button visibility from the API's permissions, never role names.

**Out:** rota, attendance, leave, payroll, conduct; "heads on leave", "on shift", "waiting on the head" figures (they arrive with slices 3 to 5: show the dash and "arrives with Attendance/Leave" as 1a did); any back-end change beyond small gaps.

### The per-screen loop (once per screen, not per component)
1. One Paper pass on the screen's frame (layout, spacing, copy); use the kit and `wds-` tokens, no hard-coded hex.
2. Assemble the screen from existing parts with the States kit states (loading, empty, error, no permission). Anything Paper does not draw (a hover, a refusal message) is built in the kit's style and listed in one line in "Built beyond Paper".
3. One screenshot at 1440 beside Paper; fix visible differences. (390 only where Paper draws a phone screen.) **No automated pixel-diff, ever.**
4. One keyboard run of the screen's main task, zero console errors, with the real API.
5. One parity manifest line and commit; then the next screen.

### Gates and finish
- `pnpm exec tsc --noEmit && pnpm lint && pnpm test && pnpm build` all pass, **lint included** (fix any lint error you meet, even in the kit); size checks clean.
- One flow end to end in the browser on the lane database: add a department, assign a head (preview first), name an acting head, end the head, check Home's gap card and the Organisation counts change.
- READMEs, the ledger rows, the status rows in `docs/PROJECT_STATUS.md` and `docs/features/workforce/README.md` updated.
- Final message: (1) decisions table, (2) 5-line recap, (3) beyond-Paper items, back-end fixes made, legacy pages now unreachable. Nothing "to do". **Do not draft the next session's prompt.** Stop for the owner's review.
