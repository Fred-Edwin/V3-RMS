# Workforce slice 1b (Departments and heads): front-end session

Working document. Delete it when Workforce ships. Paste everything below the divider into a fresh session started in the lane worktree.

---

You are a tech lead on Wendo RMS building the **screens of Workforce slice 1b**: Chapter 3 of the approved Paper designs ("Departments and heads"), against the **real back end that already exists** (Organisation O1 to O15, built and accepted). Do not edit `backend/` except to fix a small gap inside `backend/src/modules/workforce/people/organisation/` (own commit labelled `fix(workforce-org):`, with tests; no migrations).

### Where you work
- The lane worktree on branch **`feat/workforce-1b-frontend`**. It already contains the kit, the Chapter 1 frame, the 1a back and front end, and the 1b back end. Run `git branch --show-current` and confirm `frontend/features/workforce/people/` and `backend/src/modules/workforce/people/organisation/` exist.
- Ports: front end `pnpm exec next dev -p 3101`, API on 4101 from this worktree's `backend/`. The lane database may be missing 1b data: run `migrate deploy` there if needed (lane database only, never production). Seeded logins (password `password123`): `hr@wendo.test`, `director@wendo.test`, `bm.town@wendo.test`, `accountant@wendo.test`, `store.manager@wendo.test`, `admin@wendo.test`; find a department head with the read-only Postgres MCP.
- `CLAUDE.md` applies in full: pnpm only; no `any`; **Edit and Write tools only (never sed, awk or scripts)**; one line starting `Why:` before each Edit or Write; a live task list; commit with `git add <explicit paths>` ending with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; **nothing pushed**; end with a plain-English recap of about 5 lines. Do not touch the owner's main folder, other lanes, or production.

### Finish everything; decide, don't hand back
The owner wants **nothing pending** at the end: every screen, state, hover, role walk, keyboard walk, test, README and ledger row in scope is complete, **including every dialog opened and checked against Paper** (no "same kit, not opened" shortcuts, no gate left red).
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

### The per-screen loop (every screen and every dialog, before the next)
1. Exact values from Paper via `get_jsx` and `get_computed_styles`; use the kit and `wds-` tokens, no hard-coded hex.
2. Build every state (loading, empty, error, no permission, offline) and hover, focus-visible, pressed, disabled; list anything built beyond Paper.
3. Compare at 1440 (spot-check 1024 and 820; 390 where Paper draws a phone screen) by eye and by `getComputedStyle`. **No automated pixel-diff, ever.**
4. Keyboard-only walk, screen-reader names, zero console errors, with the real API. **Walk each role** that can see the screen (HR, Branch Manager, Store Manager, Director, Accountant, a department head, a staff login) and check against "Who sees what". **Open every dialog** and check it against its Paper node.
5. Tick the parity manifest row in `features/workforce/people/README.md` (or an `organisation` README) and commit.

### Gates and finish
- `pnpm exec tsc --noEmit && pnpm lint && pnpm test && pnpm build` all pass, **lint included**; size checks clean.
- One flow end to end in the browser on the lane database: add a department, assign a head (preview first), name an acting head, end the head, check Home's gap card and the Organisation counts change.
- READMEs, the ledger rows, the status rows in `docs/PROJECT_STATUS.md` and `docs/features/workforce/README.md` updated.
- Final message: (1) decisions table, (2) 5-line recap, (3) beyond-Paper items, back-end fixes made, legacy pages now unreachable. Nothing "to do". **Do not draft the next session's prompt.** Stop for the owner's review.
