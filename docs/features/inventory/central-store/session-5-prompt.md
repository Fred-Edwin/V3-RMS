You are building Session 5 of the Central Store Catalog, suppliers and restock levels flow: Part C, Session B — the Restock levels page (chapter 3 of the approved design: steps 11, 12 and 13). Frontend only. The backend for it is finished and merged. Do not change backend code; if you find the backend cannot do something a screen needs, stop and ask the owner.

Where this fits: Part C is four sessions (4 to 7). Session 4 (catalog and item screens, plus its follow-up that built the pieces the backend now supports) is merged. This is Session 5. Suppliers and Purchasing (Session 6) and phones plus cleanup (Session 7, which includes the Department Head phone screens, chapter 7) are NOT part of this session. Do not build them, even where a screen links to them.

Read first (only these parts)
- CLAUDE.md (non-negotiables, frontend hook stability rules, MCP tools).
- docs/FEATURE_REDO_PLAYBOOK.md §9 and docs/CODING_STANDARDS.md §9 (frontend feature folders).
- docs/features/inventory/central-store/README.md, then catalog-suppliers-restock-plan.md §0, §4 (Part C table, "Retiring the old screens") and §5 (all the "Decisions fixed by the owner" are final; do not reopen them).
- docs/features/inventory/central-store/visual-parity-protocol.md (binding).
- docs/features/inventory/catalog-suppliers-restock-walkthrough-decisions.md (what each screen does; "Restock levels", "Department Head" and "Fixing mistakes" sections).
- docs/features/inventory/central-store/session-3-log.md (§29 backend: restock scope, strip, suggestions), session-4b-log.md (history and put back) and session-4c-log.md (what the last frontend session did and left open).
- docs/API_CONTRACT.md §29.2 (restock levels for any department), §29.3 (the restock strip), §29.5 (suggested level), §30.5 (restock level history and put back). Every request and response shape you need is there; the Zod schemas in backend/src/modules/inventory/inventory-validators.ts are authoritative.
- docs/DESIGN_SYSTEM.md (tokens, ui2 primitives), docs/features/inventory/milestone-6-plan.md §4.2 (interaction baseline; applies to every screen).
- Existing code to read before writing any: frontend/features/inventory/components/catalog/ (the drawer and strip patterns Session 4 built; reuse them, do not fork them), components/screens/restock-levels-screen.tsx (the old drawer you will replace), components/restock-level-grid.tsx, hooks/use-restock-levels.ts, hooks/use-central-store-location.ts, components/screens/department-restock-levels-screen.tsx (the Department Head phone screen: leave it alone), the stock screens that open the old drawer, frontend/components/ui2/, frontend/services/branchService.ts.

Design source (read with the Paper MCP, never from memory or screenshots)
Master = "Wendo RMS · Approved designs" file, page "Inventory . Catalog, suppliers and restock levels" (link in README.md). Find artboards by NAME, not id. Chapter 3 · Restock levels: "11 · Restock levels · desktop · Store Manager", "12 · Review level changes · desktop dialog", "13 · Level history · desktop drawer". Use get_jsx and get_computed_styles for exact values. Chapter 7 (phone) is Session 7: do not build it.

Step 0 — start state
1. PR #57 (Session 4 follow-up) must be merged. Run: git checkout main && git pull, and confirm the log shows "catalog UI follow-up — suppliers column, chip counts, usual and their price…". If it is not merged, stop and tell the owner.
2. Branch feat/central-store-restock-ui from main. Untracked owner files in docs/features/inventory/: do not touch or commit them. Do not switch branches in the shared working tree mid-session; if the tree changes under you, stop and tell the owner.
3. Local stack: the compose `api` image cannot be pulled without a registry login, so run the backend from source: docker compose up -d postgres redis; cd backend && pnpm dev; cd frontend && pnpm install && pnpm dev. npx prisma migrate status must say up to date (the item history migration is part of main).
4. Browser: use the chrome-devtools MCP directly (the run-frontend-browser skill is not wanted). Real local logins, password `password123`: store.manager@wendo.test (Store Manager), store.attendant@wendo.test (Store Attendant), kitchen.head.town@wendo.test (Kitchen head, Nyeri Town). Do not print network request headers (they hold bearer tokens); read bodies with evaluate_script.

Decisions already made by the owner (3 Oct 2026; final, do not reopen). The owner agreed with all five recommendations:
1. Branch for a department. The design's "Whose levels" switch (Central Store, Kitchen, Pastry, Barista, Service, Housekeeping) has no branch picker, but the backend needs `scope` + `branchId` (each branch has its own Kitchen). Decision: when a department chip is chosen, show a small branch select beside the switch (branches from GET /branches, non-hub; today Nyeri Town and Nyeri Highway), defaulting to the first. This is not drawn in Paper: say so in the log.
2. "Change history". Step 13 draws one item's history drawer. Decision: clicking an item's name opens that item's history drawer; the page header's "Change history" button opens the same drawer showing the recent changes across items at this location (the endpoint supports both).
3. How a suggestion is applied and worded. The API gives `suggestedLevel` and the note NEEDS_HISTORY only. Decision: show "{suggested} {unit}" plus "{suggested ÷ 15} {unit} a day, 15 days of cover" (15 is the backend's fixed cover; per-item cover is not modelled, so Paper's "5 days of cover" lines cannot be reproduced yet and the "at lunch" wording is left out; list per-item cover in the log as deferred to the backend session). Clicking the suggested figure fills the level field. Word it "applied" when the typed level equals it, "matches" when equal to the saved level, "close" within 20%, "you chose higher" when more than 20% above. No use at all (no suggestion, no note): "No use recorded yet".
4. Sidebar. Decision: no new sidebar item; the page is reached from the item page link and from the "Restock levels" buttons on the stock screens.

One thing still to check yourself, and ask the owner only if it is false: the review dialog's warning ("… will show on Needs restocking right away. Low items are what the Purchasing page suggests for the next order."). Look at the Purchasing page as it is today. If it does suggest Low items, ship the copy as drawn. If it does not, stop and ask the owner for the wording; do not ship a claim that is not true.

Scope (build in this order; check each screen against Paper before the next)
A. Foundation (no UI yet):
- Mirror the backend shapes by hand in frontend/features/inventory/types: restock row (status, suggestedLevel, suggestionNote), the "whose levels" query (scope, branchId), save input (scope, branchId, reason), summary, history entry, put back. Services for summary, history, put back and branches. Hooks with stable references.
- Pure logic with unit tests: what a change does to the status (Stays Low / Becomes Low / Becomes OK / Becomes Out, from on hand and the new level, same rule as the backend: level set and on hand ≤ 0 is Out; 0 < on hand < level is Low), suggestion wording, "suggestions differ" (more than 20% apart, level 0 differs when a suggestion exists), and the "Low and Out first" order.
B. The page, step 11. Route /app/inventory/stock/restock-levels (the existing /app/inventory/restock-levels is the Department Head phone route: do not touch it).
- Topbar breadcrumb Central Store / Stock & counts / Restock levels and the "Change history" button; title and subtitle; the "Whose levels" switch and note.
- The four-number strip from GET /restock-levels/summary (Out, Low, No level set, Suggestions differ); cells are one-tap filters of the rows below (the list is not paged, so filter on the client).
- Tabs "Low and Out first" / "All items {n}" / "No level set {n}", and search (the list takes `search`).
- The table: item (with unit and type), on hand, status (dot + word), the level input (a changed row is tinted and shows the old value "150 →"), the suggestion column.
- The unsaved bar at the bottom: "N changes not saved · Nothing changes until you review and save", Discard, Review changes. Nothing is saved until Review. Leaving with unsaved edits needs a guard (small decision for you; say what you chose).
C. Review dialog, step 12: table of Item / Now / After / Effect, the warning box, an optional note (sent as `reason`, ≤ 200 characters), Back and "Save N changes". One PUT /restock-levels with only the changed levels. An error stays in the dialog and keeps the input.
D. Level history drawer, step 13, with Put back: per item (and the location's recent changes from the header button); "Put back 150" on each row that has an earlier level; the first level has none. A put back adds a new entry, so the list refreshes; show the 409 ("already at that level") and 400 messages inline. Use the Session 4 drawer pieces.
E. Entry points and retiring the old drawer:
- Replace every use of the old RestockLevelsDrawer with navigation to the new page: the item page's "Restock levels →" link (opened from the Catalog screen) and the "Restock levels" buttons on the stock screens (stock-hub, stock-items, stock-counts, spot-count, stock-ledger). The Catalog's Low-or-out strip cell is a catalog filter now: leave it.
- Delete components/screens/restock-levels-screen.tsx (the drawer) and its export once nothing uses it.
- KEEP restock-level-grid.tsx, use-restock-levels.ts and department-restock-levels-screen.tsx: the Department Head phone screen uses them until Session 7 (the dev gallery pages import the grid too). Do not break the phone screen. Check with a search that nothing else imports what you delete.
Out of scope: the Department Head phone screens (chapter 7), suppliers screens, Purchasing, anything in backend/.

Rules
- Frontend feature folder: frontend/features/inventory/ (components/screens, components/catalog or a new components/restock folder, hooks, services, lib). New design-system primitives go in frontend/components/ui2/ only when no existing ui2 primitive fits; tokens are the wds- tokens. Do not add to legacy components/ui/.
- TypeScript strict, no any. pnpm only. POSIX shell.
- Hooks stable per CLAUDE.md "Frontend Hook Stability Rules": stable action references, no unstable inline functions in effect deps, Zustand selectors. Only the latest request may write state (typing in search fires requests).
- One shared states kit (loading / empty / error) with a per-screen copy table; never an artboard per state. No offline states. Errors in dialogs and drawers show at the top of the body and keep the input.
- Roles: the page is the Store Manager's. An attendant must not reach it or see a restock level anywhere; a department head keeps their phone screen.
- Load these skills before building UI: emil-design-eng, building-components, vercel-composition-patterns, web-design-guidelines.
- Visual parity per visual-parity-protocol.md, per screen as you go, by eye plus get_computed_styles. pnpm visual-diff / pixelmatch / any automated pixel diff is permanently banned.
- Shared Paper values worth knowing (checked in Session 4): Paper's `--color-text-muted` is wds `text-secondary`; its `--color-primary` (#B0610F) is the `wds-selected-edge` token; Paper draws square corners but the system uses 2px (left as is, owner to confirm); the shared Topbar differs slightly from Paper (left, owner to confirm).
- Use a todo list and keep it updated live.
- Do not decide open questions. If the plan, the design and the backend disagree, stop and ask the owner with a recommendation. If a screen needs something the backend does not have, do not invent data: hide that piece, list it in the log as "deferred to the backend session" (what the backend needs, which frontend piece waits), and keep building. The owner batches those into one small backend session.
- Do not print secrets or tokens. Use names like "S5 Test …" for any rows you create; they stay in the local database.

Gate before reporting done
- cd frontend && pnpm build passes; pnpm test passes; pnpm lint clean for files you touched.
- cd backend && pnpm build && pnpm test still pass if you changed nothing there (they should, you did not touch it).
- In a real browser as the Store Manager: open the page; set levels for the Central Store and review and save them (check restock_level_changes with the Postgres MCP); the strip cells and tabs filter; search; open an item's history and put a level back; the 409 and 400 cases; a department scope with a branch; Discard; the unsaved-changes guard; every entry point lands on the new page. Zero console errors; check network calls and role-correct responses.
- As the Store Attendant: no way into the page and no restock level anywhere. As the Kitchen head on the phone route (/app/inventory/restock-levels): the old phone screen still works.
- Parity notes per screen in the log (what was checked, what differed, what you decided).
- git diff --stat shows only frontend/ files, docs for the log, and nothing in backend/.

Deliverables
- Committed work on the branch; commit messages end with the attribution line from the session's system reminder. Open a PR but do not merge unless the owner says so.
- docs/features/inventory/central-store/session-5-log.md: what was built, questions asked and answers, commands run, parity notes per screen, browser verification results, files touched and deleted, the deferred-to-backend list if any, anything surprising.
- A short message to the owner: the PR, what Session 6 (suppliers and Purchasing) must know, and open decisions. Stop when done. Do not start Session 6.
