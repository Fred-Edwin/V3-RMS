# Prep rebuild — Slice 0 (plan, frozen contract, foundation)

You are a tech lead on Wendo RMS, starting the **Prep rebuild** of the Central Store (Inventory feature, sub-module `prep`). This file is your whole brief; the design and decision work is done and the owner approved the build order. Read `CLAUDE.md` first and obey it exactly: a `Why:` line before every Edit or Write, Edit and Write tools only (no sed, awk, Python or heredocs for edits), pnpm only, a visible task list (TaskCreate/TodoWrite if present, else say so once), and a 5-line plain-English recap at the end. Commit on the current branch with the attribution line from the system reminder; never stage `.claude/` or `docs/sessions/`; do not push; never SSH to the server.

## State
- Branch `feat/prep-rebuild`, branched from `main` at `47029c1` (Purchasing and Receiving are live in production). No code has changed yet. Stay on this branch for every slice; the whole rebuild merges to `main` once, at the end (Slice 5).
- Prep today is the OLD flow: `backend/src/modules/inventory/prep/` (5 endpoints, immutable `PrepRun`/`PrepRunInputLine`, writes `inventoryTransaction` directly, `requireRole` lists) and `frontend/features/inventory/prep/` (4 screens, old design). It is in production with real data, so every migration must be additive and safe while the old flow still runs.
- The owner dropped "mock first". Do **not** build a mock front end or demo bar. Typed test fixtures used while developing are fine; they never reach a screen.

## Read before planning (specific sections only, do not read whole documents)
- `docs/FEATURE_REDO_PLAYBOOK.md` §5 Steps 3 to 9, §6, §7, §8, §9. This is the governing process.
- `docs/features/inventory/README.md` (standing rules, roles), `docs/features/inventory/decisions.md` ("Access", "One screen set", Q5), `backend/src/modules/inventory/prep/README.md` and `DESIGN-NOTES.md`, `backend/src/modules/inventory/stock/README.md` (ledger door), `backend/src/modules/inventory/_shared/central-store-access.ts`, `_shared/blind-rule.ts`.
- `docs/CODING_STANDARDS.md` §4 and §9, `docs/UI_BUILD_RULES.md`, `docs/DATA_MODEL.md` and `docs/API_CONTRACT.md` for the sections you touch.
- Memory (auto-loaded): especially device priority per role, the Prep redesign chapters, per-screen visual gate, no automated pixel-diff.
- Current code to understand: `prep-service.ts`, `prep-repository.ts`, `backend/prisma/schema/inventory/prep.prisma`, `stock/ledger/` (`postStockMovement`, `ledger-guard.test.ts`), `frontend/components/app/shell/sidebar-nav.tsx` and `nav-table.ts`, `audit-log` module.

## The design (Paper file `01M3TP8J54R83RHC9FJ7RAHGKG`, page "Inventory · Prep", source of truth for UI)
Use the Paper MCP (`get_guide` first, `get_jsx` and `get_computed_styles` for values, `get_screenshot` to look). Never take values from screenshots.
- **Approved Chapters 1 to 7** (23 screens, "Screens index · Prep"). Attendant phone flow, manager Needs a look, review drawer, History, Correct and Cancel, warnings, states table. Their manager desktop screens (10, 11, 12, 17, 18) now carry the new sidebar.
- **Chapter 8, "Set the usual recipe"** (artboard `1TAH-0`): steps 24 (Usual recipes list WITH search and filters: search, Show = All recipes / Has a recipe / No recipe yet, Changed = Any time / Last 30 days / Older, Clear filters), 25 (edit drawer, scaling preview, reason chips), 26 (first recipe, "Use these" from last run), 27 (read-only recipe line on the Catalog item, Prep tab).
- **Chapter 10** (artboard `1U86-0`): steps 39 and 40 (Attendant PHONE: scaled target; no-recipe fallback), 35 to 38 (Attendant on tablet and computer: responsive reflow, live "This run" panel replacing the confirm sheet), 41 (manager's New prep run drawer, same form), 42 (rules and wording table; read it).
- **Chapter 9 is PARKED** (manager on tablet and phone). Do not build from it.
- **Sidebar**: artboard "Parts · Prep sidebar states" (`1UZ1-0`) and "Parts · sidebar nav states" on page "Inventory . Stock and Counting" (`MR1-0`). Prep gets sub-links Runs, Usual recipes, History in the geometric sidebar, with a filled square node on the ACTIVE sub-link. Needs-a-look count badge sits on Runs when open and on Prep when collapsed, manager only (never the Attendant). Other nav states must show Prep with a ">" chevron.
- Step 9 (Dashboard) is superseded (Dashboard link stays hidden, decision N2). Step 19 (Audit log) belongs to the audit-log sub-module.

## Decisions already made (do not re-open)
1. **Usual recipe with scaling.** The Store Manager (and System Admin only) writes a recipe per prepped item: ingredients with amounts for one batch, a target yield, and one **main ingredient**. Expected yield for any run = `targetYield × (mainIngredientUsed ÷ recipeMainAmount)`. No recipe = fall back to the average of the last 10 runs or 30 days (existing behaviour, labelled "past runs"). Changing a recipe needs a reason chip (Better recipe, Portion size changed, New supplier, Other); a first recipe needs none. Every change is logged (who, when, reason, before and after). Old runs keep the expected figure and recipe version they were judged against.
2. **Yield checks** use the expected figure: within 15% = on target; over 15% = warning plus manager flag; over 35% = also "notify" (in-app flag and badge only, no push). A **typo check** warns, never blocks, when made is over 3x or under a third of expected. A **repeat warning** when the same output with the same input amounts was already recorded the same Nairobi day. **Silent flag** (manager only, Attendant sees nothing, run still saves) when an input used exceeds expected stock.
3. **Run numbers** PREP-nnnn per site, sequential, backfilled for existing runs. Status RECORDED, CORRECTED, CANCELLED. Correct = reverse the old run and post a new linked one; cancel = reverse and keep on record; nothing is deleted. Output cost updates only if it is the latest run of that item. Cancelling may push stock negative (allowed, marked). A corrected run counts in typical yield, a cancelled one does not.
4. **Windows and roles.** Attendant: records, corrects or cancels OWN runs for 24 hours; others' runs open read-only. After 24 hours "Ask the Store Manager". Store Manager and System Admin: any run, any age, review, recipes. Every desktop role reads everything (one-table rule); Attendant reads Runs, Usual recipes (read-only) and History, never expected stock or stock figures; per Paper the Attendant views carry no run costs. No PIN anywhere in Prep. Reasons: yield (Trimmed more, Spillage, Burnt, Other), correct (Typo, Wrong item, Wrong quantity, Other), cancel (Entered twice, Never made, Wrong item, Other).
5. **Double-submit guard**: confirm carries an idempotency key; a second tap or retry records one run.
6. **Steppers**: step size follows the unit (0.5 for kg and L, 1 for portions), tap the number to type it.
7. **Wording**: role names not first names ("the Store Manager"). Usual recipes states: empty "No usual recipes yet. Set one so runs are judged against it.", filtered empty "No usual recipes match these filters. Clear filters.", error "Couldn't load the usual recipes. Try again.", save error "Not saved. Nothing changed. Try again." (form keeps what was typed). Other Prep states are in step 23.
8. **Devices**: Attendant PHONE is primary; tablet and computer reflow (no centred phone column). Manager is desktop only. One component set, responsive, not separate apps.
9. **Standing rules to honour**: stock moves only through `postStockMovement` (lower the Prep count in `ledger-guard.test.ts`); access only through the permissions table and `requireCapability`/`requireHubReader`/`requireHubActor`, never a new `requireRole` list; `blind-rule.ts` for Attendant responses; every repository query includes the site column (`organization_id`); Zod on every endpoint; services hold logic, repositories hold queries; the Audit log gets a "Prep" area (Recorded, Corrected, Cancelled, Reviewed, Recipe set, Recipe changed).

## Build order (owner approved; the whole thing is one branch, one final merge)
- **Slice 0 (this session)**: plan, frozen contract, foundation.
- **Slice 1 Usual recipes**: recipe model, scaling function (pure, table-tested), recipes endpoints, manager recipe screens (list with search and filters, both drawers), Catalog read-only line.
- **Slice 2 Record a run**: atomic record through the ledger door, flags, repeat and typo, idempotency; Attendant phone, tablet and computer; manager New prep run drawer.
- **Slice 3 Fix a slip**: correct and cancel with the 24-hour rule, linked entries; Attendant and manager screens.
- **Slice 4 Oversight**: Needs a look, Mark reviewed, manager Runs and History (filters, CSV export), Audit log Prep area, sidebar badge.
- **Slice 5 Hardening and release**: walk both roles at 390, 820 and 1440 against Paper, ledger and DB checks with the Postgres MCP, migration on a restored production copy, docs close-out, PR, deploy, owner watches a real user.
Inside each slice build back end and front end in parallel as two agents (worktrees) against the frozen contract, then integrate that slice before moving on.

## Slice 0 deliverables
### Part 1 — plan and contract (then STOP for owner approval)
Write the temporary `docs/features/inventory/prep-plan.md` (deleted at close-out) containing:
1. Data model changes with a per-slice, additive migration plan and the backfill for existing runs (run numbers, status). Models to cover: recipe, recipe line, recipe change log, new run fields (number, status, replaces and replaced-by links, reasons, review fields, expected yield snapshot, recipe version, flags, idempotency key). Say how the old flow keeps running until the final merge.
2. The **API contract**: every endpoint (method, path, request, response, errors, capability) as shared Zod and TS types placed where `CODING_STANDARDS.md` says. Include: recipes list (with `search`, `status`, `changed` filters and paging), recipe get, recipe set and edit (with reason), run record, run list and detail, run history with filters and CSV, correct, cancel, review, needs-a-look list and count, prep-again suggestions (3 most-made outputs), and the expected-yield preview used live by the form. Payloads must respect the blind rule per role.
3. The capability rows to add to `central-store-access.ts` and which role gets which.
4. Session breakdown per slice with the back-end and front-end sub-tasks and dependencies, test classification, sub-module placement (`backend/src/modules/inventory/prep/<sub>/`, `frontend/features/inventory/prep/<sub>/`, subs named for what the user does), and the retirement plan for old files (old code is deleted in the slice that replaces it).
5. A component inventory per `UI_BUILD_RULES.md` with the Paper node for each piece, and what is reused (shadcn primitives, `components/ui2`, states kit, the shell).
6. The **exact read-only SQL** the owner should run on production before Slice 1 (row counts of `prep_runs`, `prep_run_input_lines`, prepped items, enum usage). The owner runs them; you never SSH.
7. Any contract question you cannot settle from this brief. Keep it short; settle everything you can from the brief and the code.
Then stop and ask the owner to approve the plan and contract. Do not start Part 2 until they do.

### Part 2 — foundation (after approval; same session)
1. Commit the frozen contract types and mark them frozen in `API_CONTRACT.md`.
2. Prisma schema in `backend/prisma/schema/inventory/`, migration generated with `pnpm`/`npx prisma migrate dev` locally, additive and backfilling, tested on the local database; verify with the Postgres MCP.
3. Capability rows in the access table plus a role-by-capability test.
4. Move Prep ledger writes onto `postStockMovement` and lower its count in `ledger-guard.test.ts`; keep the old endpoints working.
5. Sidebar: update `sidebar-nav.tsx` so the active sub-link shows a filled square node (values from Paper `MR1-0` states via `get_jsx`), add count-badge support to sub-items, add Prep's three sub-links to `nav-table.ts` (rows keep `oldHref` until the page exists; update `nav-table.test.ts`), and update the comment that says the master draws no sub-links. Check Stock & counts still renders correctly in a browser.
6. `pnpm build` and `pnpm test` in `backend` and `pnpm build` (plus lint and the shell tests) in `frontend` must pass.
7. Commit in small logical commits. Update `docs/PROJECT_STATUS.md` (Prep row) and the Prep README "Built today". Write the Slice 1 session prompt as `docs/sessions/prep-rebuild-slice-1.md` in the same shape as this file (state, decisions already made, deliverables, verification), ready to paste.

## Verification you must do
Run the real app (backend on its own port from source, frontend dev server; see `docs/sessions/central-store-go-live-step-4-parity.md` for the method and test logins) and confirm the sidebar change in a real browser with the chrome-devtools MCP at 1440 and at a phone width. Report anything you could not verify. Finish with the 5-line recap.
