You are building Session 4 of the Central Store Catalog, suppliers and restock levels flow: Part C, Session A — the catalog and item screens (chapters 0, 1 and 2 of the approved design). Frontend only. The backend for this is finished and merged (Sessions 1 to 3). Do not change backend code; if you find the backend cannot do something a screen needs, stop and ask the owner.

Where this fits: Part C is four sessions (4 to 7). This is the first. Restock levels (Session 5), suppliers and Purchasing (Session 6), and phones plus cleanup (Session 7) are NOT part of this session. Do not build them, even where a screen links to them.

Read first (only these parts)
- CLAUDE.md (non-negotiables, frontend hook stability rules, MCP tools).
- docs/FEATURE_REDO_PLAYBOOK.md §9 and docs/CODING_STANDARDS.md §9 (frontend feature folders).
- docs/features/inventory/central-store/README.md, then catalog-suppliers-restock-plan.md §0, §4 (Part C table, "Retiring the old screens") and §5 (all the "Decisions fixed by the owner" are final; do not reopen them).
- docs/features/inventory/central-store/visual-parity-protocol.md (binding: the parity check for every screen).
- docs/features/inventory/catalog-suppliers-restock-walkthrough-decisions.md (what each screen does, the fixing-mistakes table, wording).
- docs/features/inventory/central-store/session-2-log.md and session-3-log.md (what the backend now does, and what surprised the last two agents).
- docs/API_CONTRACT.md §21 (items, categories), §28 (pack lines, search, their names/codes) and §29 (strips, needs setup, attendant, change review). Every request and response shape you need is there; the Zod schemas in backend/src/modules/inventory/inventory-validators.ts are authoritative.
- docs/DESIGN_SYSTEM.md (tokens, ui2 primitives), docs/features/inventory/milestone-6-plan.md §4.2 (interaction baseline; applies to every screen).
- Existing code to read before writing any: frontend/features/inventory/ (components/screens/item-catalog-screen.tsx, item-form-screen.tsx, category-manager-screen.tsx; components/item-catalog-table.tsx, item-form.tsx, kpi-strip.tsx, drawer-shell.tsx, category-manager-list.tsx; hooks/use-item-catalog.ts, use-item-form.ts, use-categories.ts; services/), frontend/components/ui2/, frontend/app/app/inventory/(shell)/catalog/page.tsx.

Design source (read with the Paper MCP, never from memory or screenshots)
Master = "Wendo RMS · Approved designs" file, page "Inventory . Catalog, suppliers and restock levels" (link in README.md). Find artboards by NAME, not id. Use get_jsx and get_computed_styles for exact values. The V3-RMS working copy is for the design agent only. Artboard step numbers (1b, 9b, 18b) may still be un-renumbered; match by caption.

Step 0 — start state
1. PR #54 (Session 3 backend) must be merged. Run: git checkout main && git pull, and confirm the log shows "central store catalog services — Housekeeping…" (B9–B13). If it is not merged, stop and tell the owner.
2. Branch feat/central-store-catalog-ui-1 from main. Untracked owner files in docs/features/inventory/: do not touch or commit them. Do not switch branches in the shared working tree mid-session; if the tree changes under you, stop and tell the owner.
3. Local stack: docker compose up -d postgres redis api worker; cd frontend && pnpm install && pnpm dev. The api container must run the merged code (docker compose up -d --build api if needed) and the migration restock_level_changes must be applied locally (npx prisma migrate status).
4. Use the run-frontend-browser skill for the dev server and browser gotchas.

Scope (build in this order; check each screen against Paper before the next)
Chapter 0 — Type labels: one shared label map. Stocked / Raw ingredient (phone: "Raw") / Prepped, used everywhere in the inventory UI. The database/API values stay STOCKED, RAW_INGREDIENT, PREPPED.
Chapter 1 — The catalog:
- Catalog page with the four-number strip (items tracked, needs setup, low or out, added this week) from the list response `meta`; strip cells are one-tap filters (decisions doc: assumption; build them as filters). Needs setup uses ?needsSetup=true (oldest first). `lowOrOut` is null for non-Store-Managers: handle it.
- Filters and search; a row matched by a supplier's code or name shows "Matched Samrat code 190035" from `matchedOn` (step 1b).
- Add item drawer ("Fill in the item"): three type chips with one-line explainers, fields that change with the type (Prepped hides buying fields, Raw ingredient hides Used by), pack size and conversion as one entry with the price per usage unit shown while typing, category, Used-by chips including Housekeeping, restock level, similar-name warning inside the drawer, then the "Item added" state.
Chapter 2 — The item:
- Item page in its states: nobody sells it yet; with history; their name and code under each supplier; "To confirm / first receipt sets it" for an unpriced line; "Preferred · confirm" marker. History of changes is shown only if the data exists; do not invent a history source.
- Add who sells it (drawer, with their name and code; a different pack gets its own line; 409 PACK_LINE_EXISTS message is shown inline).
- Edit item (same form, filled in).
- Review a risky change: pack/unit/type/retire changes show a summary first and ask for a reason. Counts come from GET /inventory/items/:id/change-review; when `hasHistory` is false show the no-history wording (step 9b). There is NO reason field in the backend today: see "Open question" below.
- Manage categories (restyle/rebuild to the design).
Out of scope: restock levels page, suppliers screens, Purchasing, phones.

Rules
- Frontend feature folder: frontend/features/inventory/ (the flat inventory folder, components/screens/hooks/services). New design-system primitives go in frontend/components/ui2/ only when no existing ui2 primitive fits; tokens are the wds- tokens. Do not add to legacy components/ui/.
- TypeScript strict, no any. pnpm only. POSIX shell.
- Hooks stable per CLAUDE.md "Frontend Hook Stability Rules": stable action references, no unstable inline functions in effect deps, Zustand selectors.
- One shared states kit (loading / empty / error) with a per-screen copy table; never an artboard per screen per state. No offline states.
- Attendants never see costs or stock. The attendant responses omit money fields; do not add UI that assumes they exist.
- Roles: this session's screens are the Store Manager's. Keep the attendant read-only paths working (the item picker in receiving still works; they now receive items without cost).
- Frontend types mirror the backend by hand (frontend/types or the feature's types): update them for the §29 shapes (meta, matchedOn, suppliers[] on item, change-review, attendant item shape).
- Load these skills before building UI: emil-design-eng, building-components, vercel-composition-patterns, web-design-guidelines, run-frontend-browser.
- Visual parity per visual-parity-protocol.md, per screen as you go, by eye plus get_computed_styles. pnpm visual-diff / pixelmatch / any automated pixel diff is permanently banned.
- Retire what you replace: each old screen/hook/mock/service you supersede is deleted at the end of the session (plan §4 "Retiring the old screens"). Replace in place only after the new version passes parity; the app must keep working between commits. Do not remove the deprecated supplier keys or aliases yet (Session 7).
- Use a todo list and keep it updated live.
- Do not decide open questions. If the plan, the design and the backend disagree, stop and ask the owner with a recommendation.

Open question to raise first (do not guess)
The design asks for a reason on risky item changes, and "a history of every change" on the item page. Today PATCH /inventory/items/:id takes no reason and there is no item-change history table. Ask the owner whether to (a) show the review step and reason field in the UI but not send the reason yet and omit the history panel, or (b) pause for a small backend session to add reason + history. Recommend (a), with the backend added later.

Gate before reporting done
- cd frontend && pnpm build passes; pnpm lint clean for files you touched.
- cd backend && pnpm build && pnpm test still pass if you changed nothing there (they should, you did not touch it).
- Every screen in scope used in a real browser as the Store Manager (Playwright or chrome-devtools MCP): add an item of each type, search by a supplier code, filter Needs setup, edit and retire/restore with the review step, add who sells it with two pack lines, manage categories. Zero console errors; check network calls and role-correct responses.
- Also open the catalog as the Store Attendant and confirm no cost or restock level appears anywhere.
- Parity notes per screen in the log (what was checked, what differed, what you decided).
- git diff --stat shows only frontend/ files, docs for the log, and nothing in backend/.

Deliverables
- Committed work on the branch; commit messages end with the attribution line from the session's system reminder. Open a PR but do not merge unless the owner says so.
- docs/features/inventory/central-store/session-4-log.md: what was built, questions asked and answers, commands run, parity notes per screen, browser verification results, files touched and deleted, anything surprising.
- A short message to the owner: the PR, what the next session (restock levels) must know, and open decisions. Stop when done. Do not start Session 5.
