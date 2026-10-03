You are building Session 3 of the Central Store Catalog, suppliers and restock levels flow: Part B items B9 to B13 (services and contracts, backend only). B1 to B8 shipped in Session 2 (PR #52, merged). No frontend code (that is Part C, later sessions). No new migration unless you stop and ask first.

Note on numbering: the plan's §5 calls the frontend "Session 3". We renumbered: this session is the second half of Part B. Frontend sessions follow.

Read first (only these parts)
CLAUDE.md (non-negotiables).
docs/features/inventory/central-store/catalog-suppliers-restock-plan.md §0 (all 11 assumed answers STAND, assumption 7 is the Housekeeping head), §3 rows B9 to B13, §6.
docs/features/inventory/central-store/session-2-log.md (what Session 2 built, decisions made, how DB evidence was produced).
docs/API_CONTRACT.md §28 (written in Session 2; add §29 or extend §28 for this session) and the restock-level endpoints.
docs/DATA_MODEL.md: RestockLevel, InventoryItem, DepartmentTag, UserRole.
backend/src/modules/inventory/: inventory-service.ts, inventory-repository.ts, inventory-validators.ts, inventory-routes.ts, thresholds-service.ts, stock-scope.ts, and their tests. backend/src/middleware/allow-department-head.ts and rbac.ts. Read before changing any caller.

Step 0 — start state
Session 2 is merged to main and deployed (migration receipt_line_pack_and_preferred_audit). git checkout main && git pull, confirm npx prisma migrate status is up to date locally, then branch feat/central-store-catalog-services-2 from main. The owner has deferred the inventory module restructure (docs/features/inventory/module-restructure-move-map.md): it runs after this session merges. Work on the current flat layout under backend/src/modules/inventory/ and do NOT move or rename files; add new files in the same flat style. Check git log first in case that has changed. Untracked owner files: do not touch or commit them. Do not switch branches in the shared working tree mid-session; if the tree changes under you, stop and tell the owner.

What the code already does (verified 2 Oct 2026, re-verify before relying on it)
- DepartmentTag and the item validators already include HOUSEKEEPING (inventory-validators.ts). UserRole already has HOUSEKEEPING. B9 may be mostly a verification and gap-fill job.
- A "department head" is NOT a role. It is `isDepartmentHead` + `departmentTag` carried on a base role (WAITER, CHEF, ...), set at authentication. Restock-level routes use allowDepartmentHead(requireRole('STORE_MANAGER')).
- POST /inventory/items is Store Manager only today. The attendant cannot create items at all.

Order of work
Contract first: update docs/API_CONTRACT.md for every endpoint and response change below, before any code.

B9 Housekeeping. Check every place that lists departments or filters by them (used-by on items, list filters, restock levels, requisition and stock scoping). Make HOUSEKEEPING accepted everywhere the other departments are. Check how Kitchen/Service heads are modelled and mirror it for a Housekeeping head. If a Housekeeping head needs a new UserRole value or a schema change, STOP and ask first with a recommendation.

B10 Store Manager sets any department's restock levels. The endpoint takes `scope = CENTRAL_STORE | <DepartmentTag>`. Each change is logged with who changed it and for whom. Department heads stay limited to their own department. Read how restock levels are scoped today (locations per department, Central Store location) before designing the request shape. A new audit table would be a schema change: stop and ask, with the alternative of the existing audit log or a structured log line.

B11 KPI strips (counts). Catalog: items tracked, needs setup, low or out, added this week. Restock levels: out, low, no level, suggestions differ. Suppliers: active, on hold, profile not finished, owed. Supplier Catalog tab: items they sell, price alerts, last receipt, spend 90 days. One endpoint per screen or a `summary` block on the list response; reuse existing queries (item catalog meta, supplier summary, restock list). "Needs setup" means an item with placeholder units from seeding: define it precisely in the contract (state which fields/values make an item "needs setup") and flag the definition to the owner. Sort "needs setup" oldest first (assumption 11).

B12 Attendant item creation. The attendant may create only STOCKED and RAW_INGREDIENT items; PREPPED is rejected (403 or 422, say which in the contract). Because the route is Store Manager only today, this means opening POST /inventory/items to STORE_ATTENDANT with a service-level type rule. Confirm the attendant stays blind to money fields (currentCost, prices, restock levels they may not set) in the response and the request. If the plan's intent is unclear, stop and ask.

B13 Review-a-change summary. When an item has no stock, no receipts and no open orders, the summary returns those counts as zero so the UI can show the no-history wording (step "9b"). Find the existing summary for unit/pack/type/retire changes (inventory-service.ts) and extend it. Zero counts, never null or missing.

Rules
TypeScript strict, no any. pnpm only. POSIX shell. Business logic in services, queries in repositories (a $transaction in a service is fine), organizationId in every repository query, a Zod schema per endpoint, authenticate + requireRole on every route. Every B item above gets tests, including role and hub-scope (D-15) negative tests. Use a todo list and keep it updated. Do not decide open questions: if the plan conflicts with the code, stop and ask the owner with a recommendation (Session 2 found three such conflicts; expect more). Do not run migrate dev or reset against production. Do not merge unless the owner says so. If a change seems to need a schema change, stop and ask first.

Gate before reporting done
cd backend && pnpm build && pnpm test pass (the whole working tree compiles). Postgres checks with output pasted into the log. The Postgres MCP is read-only: exercise the real services against a scratch clone (CREATE DATABASE scratch TEMPLATE wendo_rms, run a throwaway script, query with psql, then drop the clone and delete the script) and also run the MCP against wendo_rms. Evidence needed: HOUSEKEEPING item and restock row; a Store Manager saving another department's level and the logged change; each KPI count against a hand-checked SQL count; an attendant creating a RAW_INGREDIENT and being refused PREPPED; the zero-count review summary. git diff --stat shows only inventory module code and tests, docs/API_CONTRACT.md, docs/DATA_MODEL.md if it changed, and the log. Explain any file outside the module.

Deliverables
Committed work on the branch, commit message ending with the attribution line from the session's system reminder. docs/features/inventory/central-store/session-3-log.md: what changed, questions asked and answers, commands run, Postgres outputs, every file touched, anything surprising. A short message to the owner: the branch to review, behaviours the frontend sessions must know, and the open decisions. Stop when done. Do not start Part C.
