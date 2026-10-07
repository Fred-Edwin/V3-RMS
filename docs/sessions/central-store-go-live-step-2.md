# Central Store go-live: Step 2 (access table), handoff prompt

You are a tech lead on Wendo RMS. Read `CLAUDE.md` first (its rules apply: `Why:` line before every Edit/Write, Edit/Write tools only, pnpm only, a 5-line plain-English recap at the end). Then read:
- `docs/PROJECT_STATUS.md`, section "Go-live sequence" (the 9 steps and the demo decisions)
- `backend/src/modules/inventory/_shared/central-store-access.ts` and its tests (`central-store-access.test.ts`, `permissions-routes.test.ts`)
- `docs/features/inventory/decisions.md`, section "Access"

## Where we are
- Branch `feat/central-store-go-live` already holds **step 1** (commit `1e38c68`): the printed LPO sent to the supplier no longer shows price, total or amount in words. **Only that document** changed. Internal screens keep their prices. Do not re-open it.
- The owner's goal: the approved Central Store parts (Purchasing and Receiving, Prep, Stock, Counting, Waste) built properly, front-end and back-end, live in production, one PR per step.
- Do exactly what is asked. In step 1 the scope was widened by mistake and had to be reverted. If something looks bigger than this brief, ask before widening it.

## Owner decisions that apply (6 Oct 2026)
1. **The Store Attendant may see cost and price figures per item.** Only financial and reporting data is hidden from them: what we owe, invoices, payments, supplier balances and payment details, financial reports. This **replaces** the older rule "attendants never see costs" (README "Standing rules", decisions.md "Access"). Memory note: `feedback_attendant_sees_item_costs.md`.
2. **The Attendant also needs desktop screens** (not only phone), built later in each rebuild. No separate Paper design pass. This step only makes sure the access table allows it.
3. Counting stays blind to expected stock (a count-integrity rule, not a money rule) unless the owner says otherwise.
4. Access is ONE table. Never add a new `requireRole(...)` list to a rebuilt Central Store route.

## What I (the previous session) found
- The order capabilities (`orders.read/request/approve/cancel/receive`) and `payables.record_deposit` **already exist** in `central-store-access.ts`. Older docs saying they are missing are stale.
- The Attendant today holds: `catalog.read`, `catalog.add_missing`, `suppliers.read_basic`, `suppliers.quick_add`, `orders.request`, `orders.receive`. The test `central-store-access.test.ts` ("keeps the Store Attendant narrow and blind to money") pins exactly that list and asserts `catalog.see_costs` is false for the Attendant. It must change.
- **Risk to check before editing:** `backend/src/modules/inventory/catalog/inventory-service.ts` uses `isBlindToMoney = !actorCan(actor, 'catalog.see_costs')` (around lines 183, 389, 467) to decide whether to return the stripped "attendant item" shape. That shape also removes on-hand and restock levels, not only prices. Giving the Attendant `catalog.see_costs` may silently give them the full manager shape (including on-hand and levels), and `GET /inventory/items/:id/history` is gated by `catalog.see_costs` too. Decide how to give the Attendant prices without giving them stock figures: for example a separate capability or a serializer change. Check the tests in `central-store-gaps.test.ts` and `central-store-b9-b13.test.ts` that pin "the attendant gets neither on hand nor any price field" and update them to the new rule deliberately.
- Prep, Stock, Counting, Waste and Dispatch routes still use old `requireRole` lists. Each rebuild (steps 5 to 8) adds its own capability rows, as decisions.md says. **Do not pre-build capabilities for screens that do not exist yet.**

## Scope of step 2 (keep it small)
1. Change the Attendant's capabilities to match decisions 1 and 2: item cost and price visible, desktop read access to what their screens need (for example `orders.read`, and `restock.read` only if a screen needs it; check, don't guess), and still no `payables.*`, no `suppliers.read` (it carries what-we-owe summaries), no `suppliers.read_payment_details`, no reports.
2. **One shared "blind" rule** (in `backend/src/modules/inventory/_shared/`). Today blindness is scattered: `isBlindToMoney` in the catalog service, `isAttendant` checks in waste, stock and counting, serializer-level stripping in receiving. Write one helper that every later rebuild (Prep, Stock, Counting, Waste, Purchasing) calls instead of writing its own check. Under the new rule it hides only two things from a caller without the matching capability: **stock figures** (on-hand, expected stock, restock levels) and **financial data** (what we owe, invoices, payments, supplier balances). Item costs and prices are NOT hidden from the Attendant. Move the catalog service onto it (this also solves the risk above: prices visible, stock figures still hidden). Do not rewrite the other sub-modules in this step; they adopt the helper when they are rebuilt, so only note in each README's "Built today" that it should. Add tests that fail if an Attendant response contains on-hand or levels, and a test that it does contain item costs.
3. Update the tests that pin the old rule.
4. Update the docs in the same change: `docs/features/inventory/README.md` ("Standing rules", Roles table), `docs/features/inventory/decisions.md` ("Access", and the line about Attendants being "no prices"), and tick step 2 in `docs/PROJECT_STATUS.md`.
5. Run `cd backend && pnpm build && pnpm test`. Check `GET /inventory/permissions/me` for the Attendant.

Out of scope: any screen, Prisma schema, migration, the Purchasing back-end, or the mock (the mock's "Attendant sees no money while receiving", Q-02, is revisited in steps 3 and 4).

## Finish
- Commit on `feat/central-store-go-live` (never on `main`). Do not stage the two modified `.claude/` files. End the commit message with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Do not push until the owner says so.
- End with the 5-line recap, then **outline step 3 only, in plain words, for the owner. Do not write a handoff file or start step 3.**
- Step 3 (preview, expand it in the outline): Purchasing and Receiving back-end. Schema and migration for orders, invoices, payments, advances, reversals and disputes; services, routes, validators, tests; receiving through `postStockMovement`; old purchasing code deleted; built from `docs/features/inventory/purchasing-mock/backend-rules.md` and `docs/API_CONTRACT.md` section 31; the LPO output carries no prices. **Before any migration**, give the owner the SSH command to read the production database (read-only queries) and wait for the go-ahead.
