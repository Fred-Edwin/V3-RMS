You are building Session 7 of the Central Store Catalog, suppliers and restock levels flow: Part C, Session D — the phones, the "when things go wrong" screens, the cross-role integration pass, and the cleanup. Frontend work first; a small backend change only where listed or after the owner says yes in the session. Never make a backend change without that yes: stop and ask with a recommendation.

Where this fits: Sessions 1–6 are merged to main (6 = PR #62; the module restructure = PR #63, so every path below is the NEW layout). Session 7 is the last session of this flow. Do not start the Purchasing rebuild, Receiving, or the production demo.

Read first (only these parts)
- CLAUDE.md (non-negotiables, hook stability rules, MCP tools, deploys are automatic on push to main).
- docs/features/inventory/README.md, decisions.md, and the READMEs of the sub-modules you touch: catalog, restock, suppliers (backend/src/modules/inventory/<sub>/README.md).
- docs/API_CONTRACT.md §27–§30 (suppliers, catalog, restock; §30.9–§30.11 are Session 6's additions).
- The Session 6 log: `git show 33a57d3:docs/features/inventory/central-store/session-6-log.md` (the folder was removed by the restructure). Read "Decisions", "Deferred" and "For Session 7".
- docs/DESIGN_SYSTEM.md, and the existing code you will extend: frontend/features/inventory/suppliers/ (page screen, `supplier-ui.tsx`, `use-async.ts`), frontend/features/inventory/catalog/ and restock/ (drawer parts, item drawers, restock screens).
- Interaction baseline for every screen: the "interaction baseline" (§4.2) in the milestone-6 plan if it still exists in git history; otherwise: hover, focus, in-flight and error states on every control, errors at the top of drawers with input kept, one shared loading/empty/error kit, no offline states.

Design source (read with the Paper MCP by artboard NAME, never from memory or screenshots)
Master = "Wendo RMS · Approved designs" (`01M3TP8J54R83RHC9FJ7RAHGKG`), page "Inventory . Catalog, suppliers and restock levels" (page id `p-7-0`).
- Chapter 6 · The attendant adds a missing item (phone: Not found, Name it, Back to the delivery).
- Chapter 7 · The department head sets their levels (phone: steppers, suggestion under each item, review sheet, saved, history with Put back; plus the Housekeeping head, same screens).
- Chapter 8 · When things go wrong (retire / restore dialogs and drawer, duplicate-supplier warning, archive blocked, Audit log; reference tables are copy only).
Read each artboard's tree with get_tree_summary / get_children, then get_jsx and get_computed_styles on the anchors. Visual parity per `visual-parity-protocol` rules: per screen as you go, by eye plus computed styles. pnpm visual-diff / pixelmatch / any automated pixel diff is permanently banned.

Step 0 — start state
1. `git checkout main && git pull`; confirm the log shows #62, #63 and the deploy-cleanup PR (#64 if merged). Branch `feat/central-store-phones-and-cleanup`. Untracked owner files in docs/: do not touch or commit.
2. Local stack: `docker compose up -d postgres redis`; backend `cd backend && pnpm exec tsx watch src/server.ts` (restart it after backend edits); frontend `cd frontend && pnpm dev`. Check ports 3000/4000 first (`ss -ltnp | grep -E ':(3000|4000)'`); never run two Next dev servers on one .next; after `pnpm build` or deleting files, stop the dev server, `rm -rf .next`, start again. Never kill a process you did not start.
3. Browser: chrome-devtools MCP directly. Logins (password `password123`): store.manager@wendo.test, store.attendant@wendo.test, kitchen.head.town@wendo.test, accountant@wendo.test, director@wendo.test. Use isolated browser contexts for a second role. Do not print tokens.

Scope (build in this order; check each screen against Paper before the next)
A. Chapter 6, attendant phone. Receiving search finds nothing → "Add as a new item": name, what it is (Stocked or Raw ingredient only, each with its explainer; Prepped is not offered), how it arrives ("1 tin = 400 g"). No prices, no stock. Back to the delivery to count. Backend already allows this for the attendant (§29.4) and the new item shows under "Needs setup".
B. Chapter 7, department head phone: restock levels with big minus/plus steppers, the suggestion under each item, review sheet, saved state, history with Put back. Includes the Housekeeping head. The Store Manager desktop page and its endpoints exist (restock/); reuse them. The phone screen `department-restock-levels-screen` is the OLD one: replace it in place.
C. Chapter 8:
   - Retire / restore dialogs and drawer for items and for suppliers. Put on hold / Archive / make active on the supplier page header (Session 6 deliberately left these off; `changeSupplierStatus` is already in the supplier service). Archive is blocked while invoices are unpaid (409 `SUPPLIER_HAS_OPEN_INVOICES`, `details.openInvoices`): show the "archive blocked" state.
   - Duplicate-supplier warning (409 `DUPLICATE_SUPPLIER`; Session 6 already shows matches and "Create anyway" in the New supplier drawer: check that it matches the Paper state and adjust).
   - Audit log screen "under Catalog, Suppliers and Restock levels, with who, when and why". CHECK FIRST whether the backend has a read endpoint that unions item history, supplier audit rows and restock changes. If it does not, stop and ask the owner with a recommendation (a small backend endpoint is likely the answer).
D. Open items to settle with the owner in the session (ask once, early, with recommendations): (1) show WHO signed/recorded automatic rows on the supplier Documents tab (needs `actor` on receipt/invoice/payment timeline entries); (2) square corners (Paper) vs 2px (system) and the small shared Topbar differences, open since Session 4; (3) the Accountant's real name in the "Accountant is told" box (needs a backend field).
E. Cross-role integration pass in a real browser with Postgres MCP checks (audit rows exist and carry who/when/why; every query scoped by organizationId; the attendant sees no money anywhere, including the supplier list). Roles: Store Manager, Store Attendant, Department Head (Kitchen and Housekeeping), Accountant, Director. Write down each role's result.
F. Cleanup (do this LAST, after A–E work):
   - Remove the deprecated supplier API keys `contactName`, `phone`, `email`, `location`, `retiredAt` and the legacy `DELETE /suppliers/:id` and `POST /suppliers/:id/restore` aliases from the API (suppliers/ validators, serializers, service, routes, tests) and update API_CONTRACT.md §27.
   - FIRST move their frontend users to the new shape: New purchase's quick-add (`createSupplier` / `CreateSupplierInput` in the purchasing/inventory services sends `contactName / phone / location`) and the old `Supplier` type used by the item drawers' supplier picker and `use-new-purchase-form`. Use `contacts: [...]` and `address` / the supplier list row type instead. `git grep` every usage before deleting.
   - Delete `supplier-form.tsx` and `aging-bucket-*` together with the dev galleries `app/dev/wds*` that import them, if nothing else uses them (search first).
   - Delete any other old catalog / restock / supplier screens, hooks and mocks that nothing imports. Keep what Receiving, Prep and other features still import (Receiving is rebuilt later; do not touch its routes).

Out of scope: the Purchasing rebuild (LPO print, WhatsApp text, payment advice, statement, orders — the backend endpoint `GET /expected-deliveries/:id/supplier-document` is ready), Receiving, Prep, the production demo, another restructure.

Rules
- TypeScript strict, no `any`. pnpm only. POSIX shell. Business logic in services, queries in repositories, Zod schema per endpoint, organizationId on every query, tests for every backend change.
- Hooks stable per CLAUDE.md (stable action references, only the latest request writes state, Zustand selectors). Reuse `useLoader` / `useAction` in frontend/features/inventory/suppliers/hooks/use-async.ts rather than writing new fetch plumbing.
- Money: decimals are strings on the wire; no float arithmetic for amounts; account numbers hidden until Show.
- Load these skills before building UI: emil-design-eng, building-components, vercel-composition-patterns, web-design-guidelines.
- Do not decide open questions. If the plan, the design and the backend disagree, stop and ask the owner with a recommendation. If a screen needs something the backend lacks, ask (small approved backend change) or hide that piece and log it as deferred.
- Use a todo list, updated live. Test rows are named "S7 Test …" and stay in the local database; never seed production.
- Commit messages end with: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; PR descriptions end with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Open a PR; do not merge unless the owner says so. Merging deploys to production automatically: check the deploy run (`gh run list --branch main`) and server disk (`ssh wendo df -h /`) afterwards.

Gate before reporting done
- `cd frontend && pnpm build && pnpm test`, lint clean for files you touched; `cd backend && pnpm build && pnpm test`.
- Browser: every screen above with real data, as each role in E; zero console errors apart from deliberate failed requests.
- Parity notes per screen in a new log `docs/features/inventory/session-7-log.md` (what was built, questions and answers, decisions, commands, parity, browser results, files touched/deleted, deferred list, anything surprising).
- Final message to the owner: the PR, what is left (Purchasing rebuild, Receiving, production demo), open decisions. Stop when done.
