# Central Store go-live: Step 3 (Purchasing and Receiving back-end), handoff prompt

You are a tech lead on Wendo RMS. Read `CLAUDE.md` first (its rules apply: `Why:` line before every Edit/Write, Edit/Write tools only, pnpm only, a task list kept live, a 5-line plain-English recap at the end). Read only the sections you need, not whole documents.

## Where we are
- Branch: continue on `feat/central-store-go-live` (or the branch the owner names). Never commit on `main`. Do not stage the two modified `.claude/` files. Do not push until the owner says so. End commit messages with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Step 1 (no prices on the LPO sent to the supplier) and step 2 (access table, `catalog.see_costs` for the Attendant, the shared blind rule in `backend/src/modules/inventory/_shared/blind-rule.ts`) are done. Do not re-open them.
- The client approved the Purchasing mock at the 6 Oct 2026 demo. This step builds the real back-end for it. Steps 4 to 8 (front-end swap, Prep, Stock, Counting, Waste) are NOT part of this step.
- Do exactly what is asked. If something looks bigger than this brief, ask before widening it.

## Owner decisions that apply
1. The Store Attendant sees item costs and prices; financial data (what we owe, invoices, payments, supplier balances and payment details) and stock figures stay hidden from them. Use the shared blind rule (`blindnessOf`, `withoutFinancials`, `withoutStockFigures`), never a new `isAttendant` check. Note the mock still shows the Attendant "no money while receiving" (Q-02); the back-end follows the new rule, and the difference is a front-end matter for step 4. Flag it, do not fix it here.
2. Access is ONE table (`_shared/central-store-access.ts`). The order capabilities already exist (`orders.read/request/approve/cancel/receive`, `payables.record_deposit`, plus the existing `payables.*` and `suppliers.*`). Use `requireCapability(...)` on every route and `requireHubReader` / `requireHubActor` in services. Never add a `requireRole(...)` list. Add a new capability only if a screen truly needs one, and say so.
3. The LPO output carries no prices, no total, no amount in words (same rule as step 1).
4. Stock moves only through `postStockMovement` (`backend/src/modules/inventory/stock/ledger/`), never `inventoryTransaction.create`. Receiving a delivery is a ledger movement. Fix a wrong entry with a linked correction, never SQL.
5. Nothing is deleted: cancel, void and reverse with a reason as a new linked entry.
6. Central Store data lives on the hub Site (D-15). Every repository query includes `siteId` (column `organization_id`).

## Phase A: understand the contract from the front-end (do this first, write no code yet)
The mock front-end is the specification of what the back-end must supply. Review it before planning.
1. Read `docs/features/inventory/purchasing-mock/backend-rules.md` fully (it is the owner's rule list for the back-end).
2. Read `docs/API_CONTRACT.md` section 31 and `docs/DATA_MODEL.md` for the purchasing tables (only those sections). Note where they disagree with the mock; the approved mock wins, and record each disagreement.
3. Walk the mock screens and types in `frontend/features/inventory/purchasing/` (especially `mock/` fixtures, types, hooks and services, and the README there). For every screen (need to payment, new order, approval, order list, purchase file / closed file, receiving including every exception, supplier orders and statement, advances and deposits, invoices, payments, reversals, disputes, audit log, the Attendant phone views), list:
   - the data it reads (fields, shapes, derived totals, statuses, filters, sorting, pagination);
   - the actions it performs (each becomes an endpoint) and the rule or validation behind each;
   - who may see or do it (map to a capability) and what the blind rule hides from the Attendant;
   - what the mock computes on the client that the server must compute instead (totals, balances, statuses, reference numbers).
4. Inspect the existing back-end for purchasing and receiving: `backend/src/modules/inventory/purchasing/` and anything it touches (receiving, expected deliveries, last-price, supplier statement code, `backend/src/modules/inventory/suppliers/`). Note what is reusable and what the owner expects deleted ("old purchasing code deleted").
5. Check the local database for the current purchasing tables and data (Postgres MCP, read-only).
Deliverable of Phase A: a short written contract summary in the conversation (not a new doc unless the owner asks): entities and statuses, the endpoint list with request and response shapes, the capability for each, the rules to enforce, the disagreements found, and open questions for the owner. Stop and ask the owner about any open question that changes the design.

## Phase B: plan, task list, then build
1. Write the implementation plan: schema changes, migration order, module layout under `backend/src/modules/inventory/purchasing/` (split into sub-folders named for what the user does where the playbook says so; read `docs/FEATURE_REDO_PLAYBOOK.md` §9 and `docs/CODING_STANDARDS.md` §4 for the layout), endpoints, the order in which to build them, the test plan, and what old code gets deleted and when. Keep the plan in `docs/features/inventory/purchasing-plan.md` (or the existing plan file, if one exists).
2. Create the task list (TaskCreate), one task per deliverable, and keep it updated live.
3. Show the owner the plan and wait for approval before building.
4. **Before any migration, give the owner the SSH command to read the production database (read-only queries) and wait for the go-ahead.** Check production data that the migration must preserve or convert (existing orders, receipts, supplier payments). Never run `prisma migrate dev` against production; follow the migration workflow in `CLAUDE.md` exactly (edit the schema file in `backend/prisma/schema/inventory/`, generate the migration locally, commit it beside the schema folder).
5. Build, in this order unless the plan justifies another: schema and migration; repositories (`siteId` in every query); services (business logic, `prisma.$transaction` where several writes must succeed together); Zod validators; controllers and routes (`authenticate` plus `requireCapability`); receiving through `postStockMovement`; the LPO output without prices; response shaping through the blind rule; then delete the old purchasing code and update `ledger-guard.test.ts`'s allow-list if a purchasing write leaves it.
6. Tests: every service rule, every route's capability matrix (role by endpoint), the blind rule on every response the Attendant can reach (no financial keys, no stock figures; item costs present), the ledger door for receiving, hub scoping (a non-hub actor is refused), reversals and disputes, and the LPO having no price fields. A feature without tests is not complete.
7. Docs, in the same change: the purchasing README (spec, status, endpoints, access), `docs/API_CONTRACT.md` section 31 if the built contract differs, `docs/DATA_MODEL.md` for new tables, and tick step 3 in `docs/PROJECT_STATUS.md`.
8. Run `cd backend && pnpm build && pnpm test`. Verify the endpoints against the local database (Postgres MCP) and with real requests as at least the Store Manager, Accountant and Attendant. Frontend changes are out of scope, so also confirm `cd frontend && pnpm build` still passes (the frontend must not break because a type or endpoint moved).

## Out of scope
Swapping the mock for the real API, the demo bar, the Attendant desktop screens (step 4); Prep, Stock, Counting, Waste, Requisitions, Dispatch, Branch day; any change to the approved screens.

## Finish
- Commit in logical commits on the branch (never on `main`), not pushed.
- End with the 5-line recap, then outline step 4 only, in plain words, for the owner. Do not write a handoff file or start step 4.
- Step 4 (preview, expand it in the outline): Purchasing front-end live. The mock is swapped for the real API, the demo bar removed, and the Attendant desktop screens built to the new access rule; the owner approves the built screens.
