# Central Store catalog — Session 4b log (backend gaps from Session 4, plus Session 5's backend task)

Date: 2026-10-03 · Branch: `feat/central-store-backend-gaps` (from `main` @ `53a43c9`, PR #55 merged and deployed) · Backend only. One migration.
Contract written first: `docs/API_CONTRACT.md` §30. Data model: `docs/DATA_MODEL.md` §4.51b and the `supplier_items` entry.

## Decisions (owner, in session)
Owner: "go with your recommendations on the three questions", and Session 5's backend task goes into this session. The recommendations that were built:
1. **Usual price on item create** — optional, **per buy unit**, Store Manager only (an attendant sending it gets 403). The service stores `currentCost = usualPrice ÷ (conversionFactor ?? 1)` per usage unit (4 dp). It does **not** create a supplier line.
2. **Hand-set supplier price** — Store Manager, per pack line, on add or edit; stamps who and when (`last_price_set_by_id`); writes a supplier audit row `LINE_PRICE_SET` and an item history row. A signed receipt still overwrites the price and now clears "set by". An unchanged price writes nothing; a price cannot be cleared.
3. **Reason and history** — new `inventory_item_changes` table (create, edit, retire, restore, supplier added, price set). `reason` is accepted but **optional** everywhere (the screens may leave it out, per the Session 4 decision). The history is the "Logged for …" source; no separate Audit log entry yet.

## What was built (by gap from the Session 4 log)
| # | Gap | Built |
|---|---|---|
| 1 | Suppliers column | `supplierCount` on every list row (all roles) |
| 2 | Chip counts | `meta.typeCounts` |
| 3 | "added by an attendant" | `meta.addedByAttendant` (from the history's `CREATED` rows whose creator was a Store Attendant) |
| 4 | Usual price | `usualPrice` on `POST /items` (§30.2) |
| 5 | Their price | `price` on `POST` / `PUT /suppliers/:id/items`, `lastPriceSetBy` on catalog rows and the item page (§30.3) |
| 6 | "Their name" on a code match | `matchedOn.supplierItemName` |
| 7 | Reason and history | `reason` on `PATCH` / `DELETE ?reason=` / restore body, `GET /items/:id/history` (§30.4) |
| 8 | Newest first | `sort=newest` (default `name`; `needsSetup` alone still oldest first) |
| 9 | Low or out filter | `lowOrOut=true`, Store Manager only (403 otherwise); intersects with `needsSetup` |
| 10 | Central Store on hand | `centralStoreOnHand` on `GET /items/:id` (Store Manager only) |
| 11 | "Logged for …" | satisfied by the history (each row has who and when) |
| + | Session 5 backend | `GET /restock-levels/history` and `POST /restock-levels/changes/:id/put-back` (§30.5) |

## Files
Schema: `backend/prisma/schema.prisma`, migration `20261003050720_item_history_price_source` (enum `InventoryItemChangeKind`, table `inventory_item_changes`, `supplier_items.last_price_set_by_id` FK `ON DELETE SET NULL`, `SupplierAuditAction` + `LINE_PRICE_SET`). The SQL was reviewed before applying: only those changes, no stray drops.
New: `item-history.ts` (the sentences, pure), `item-history-repository.ts`, tests `item-history.test.ts`, `central-store-gaps.test.ts`.
Edited (inventory module): `inventory-service.ts`, `inventory-repository.ts`, `inventory-validators.ts`, `inventory.types.ts`, `inventory-controller.ts`, `inventory-routes.ts`, `supplier-service.ts`, `supplier-repository.ts`, `supplier-serializers.ts`, `supplier-validators.ts`; tests/fixtures `inventory-service.test.ts`, `central-store-b9-b13.test.ts`, `inventory-contract.test.ts`, `supplier-service.test.ts`, `supplier-contract.test.ts`, `supplier-test-fixtures.ts`. Docs: `API_CONTRACT.md` §30, `DATA_MODEL.md`.
No file outside `backend/` and `docs/`.

## Commands run
`git pull --rebase` · `npx prisma migrate dev --create-only --name item_history_price_source` (reviewed) · `npx prisma migrate dev` (local) · `npx tsc --noEmit` · `pnpm build && pnpm test` · scratch-clone run (below).
**Result: `pnpm build` clean; `pnpm test` 104 files / 1506 tests passed** (was 102 / 1455 at the end of Session 3; +51 new tests).

## Postgres evidence
The Postgres MCP is read-only, so the **real services** were run against a scratch clone (`CREATE DATABASE scratch_4b TEMPLATE wendo_rms`, backend stopped so the template was free), then queried with `psql`. Script and clone deleted (`pg_database like 'scratch%'` → 0).
- Usual price: 8,900 per 50 kg bag → `current_cost` `178` per kg; no supplier line created by the create.
- Hand price: Samrat line added at 8,900 (preferred), then 9,100; the repeat of 9,100 wrote nothing. Tables: `supplier_audit_logs` has two `LINE_PRICE_SET` rows (8900, 9100); `inventory_item_changes` has exactly one `SUPPLIER_PRICE_SET`.
- Item page as Store Manager: `lastPriceSetBy` = the manager, `centralStoreOnHand` `"0"`; as attendant: no on-hand, no price fields, no set-by.
- A signed-receipt price write (`setLinePrice`) set `last_price` 9200 and `last_price_set_by_id` NULL.
- History, newest first: restored · retired `[Added twice]` · changed the pack from 1 bag = 50 kg to 1 bag = 48 kg `[Supplier changed the pack]` · added …(packet of 2 kg) · set …'s price to KES 9,100 per bag (was KES 8,900) · added … (bag of 50 kg) at KES 8,900 per bag, preferred · created the item. A same-name edit wrote no row (one `UPDATED` in total).
- Attendant created an item: a `CREATED` row by `STORE_ATTENDANT`; list meta `addedByAttendant: 1`; the attendant sending `usualPrice` → 403.
- List: `sort=newest` put the newest first; rows show `supplierCount` (1 for the new sugar); `typeCounts` `{STOCKED 186, RAW_INGREDIENT 8, PREPPED 27}`; `search=190021` returns `matchedOn.supplierItemName: "Sugar Brown 50KG"`; `lowOrOut=true` lists the items with a level and nothing on hand; as attendant → 403.
- Restock history and put back (Central Store): history newest first (`120 → 150`, `100 → 120 [Bigger orders]`, `— → 100`); put back of the newest wrote a new row `150 → 120 [Put back]`; put back of the first level → 400 "Nothing to put back"; a put back of a change whose earlier level is not the current one is allowed (`100`), and the 409 "already at that level" (current level equal to the change's earlier level) is covered by a unit test.
- Kitchen head (Town): own history `— → 14`, `14 → 18`; put back `18 → 14`; tries a Central Store change → 403; an attendant → 403.

## Surprising / for the next session
- **Frontend follow-up (next, same Part C run):** mirror the new shapes in `frontend/features/inventory/types` (`supplierCount`, `matchedOn.supplierItemName`, `meta.typeCounts` / `addedByAttendant`, `centralStoreOnHand`, `lastPriceSetBy`, history entry, restock history entry) and build the pieces Session 4 hid: Suppliers column, chip counts, Usual price in Add item, Their price in Add who sells it and "Price set by … on …", the history panel, the "Logged for …" line, the newest-first narrowing after Create (replace the search-by-name workaround), the Low or out cell as a real filter, and the "Their name:" line under a code match. The reason field stays out unless the owner reverses that.
- Session 5 (restock levels) can now start from the frontend: history and put back exist; the suggestions and statuses were already there (Session 3).
- `usualPrice` sets the cost only at create. Editing it later is not an edit field; prices after that come from signed receipts or a hand-set supplier price. If the owner wants an editable usual price on Edit item, that is another small change.
- A signed receipt's price change is **not** written to the item history yet (only hand-set prices are). Easy to add if the owner wants the receipt price moves in the same list.
- The put-back service checks the actor itself (Store Manager or department head), not only the route.
- Existing tests mock the repositories wholesale, so every test file that exercises the services needed one extra `vi.mock('./item-history-repository', …)` line.
- Local `wendo_rms` already has the new table (`migrate dev`). Production gets it from `migrate deploy` on merge.
