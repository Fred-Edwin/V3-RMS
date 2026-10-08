# Central Store go-live: Step 3 (Purchasing back-end), CONTINUATION handoff

You are a tech lead on Wendo RMS, continuing a build already under way. Read `CLAUDE.md` first (its rules apply: a `Why:` line before every Edit/Write, Edit/Write tools only, pnpm only, a live task list, a 5-line plain-English recap at the end). Then read `docs/sessions/central-store-go-live-step-3.md` (the original brief) and `docs/features/inventory/purchasing-plan.md` (the **owner-approved plan**, with the owner's answers and the production check). Read only the sections you need.

## State (6 Oct 2026)
Branch `feat/central-store-go-live`, **not pushed**, six commits ahead of `47a4735`. Never commit on `main`. Do not stage the two modified `.claude/` files or `docs/sessions/*.md`. End commits with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

**Done and committed** (backend tests green, `tsc` clean):
- `backend/src/modules/inventory/purchasing/_shared/`: `order-state.ts` (statuses, stage, `canOf`, tracker, due labels), `money.ts` (Decimal maths, variance, advance, ageing, suggested qty), `purchasing-errors.ts` (`purchasingError(code, msg, details)`, `wrongStateError`, `invalidPinError`).
- `files/` (upload to R2/in-memory, signed links, blind rule on invoice and payment files), `needs-restocking/` (restock list, catalog, blind rule on `onHand`/`level`). Each has a README.
- Schema and migration `20261006100618_purchasing_orders_deliveries_payables` (additive; applied to the **local** DB only): `PurchaseOrder`, `PurchaseOrderLine`, `PurchaseDelivery`, `PurchaseDeliveryLine`, `PurchaseInvoice`, `PurchasePayment`, `PurchaseDocument`, `PurchaseFile`, `PurchasingAuditEntry`, plus `inventory_transactions.purchase_delivery_line_id`. Partial unique indexes: one open order per supplier, one live invoice per order.
- Ledger: `RECEIVE` accepts `purchaseDeliveryLineId` (old `goodsReceiptLineId` stays until step 7).
- `blind-rule.ts`: `STOCK_FIGURE_KEYS` gained `onHand`, `level`.

**Not built yet** (plan "Build order" 3 to 8): `orders/`, `receiving/`, `payables/`, `supplier-account/`, the supplier-page and audit-log repoint, the purchasing router mount, deleting the old code, the final drop-old-tables migration, docs, verification.

## Owner decisions (all in the plan; do not re-ask)
1. Attendant sees **item prices and order totals** (unit, last, previous, price change, line and order totals); blind to invoices, payments, balances, `money.invoiced/paid/stillToPay`, and stock figures.
2. `orders.read` = **every order, read-only**, blind rule applied. Writes by capability.
3. Supplier page: **repoint now** to the new tables, then drop the old ones.
4. **Option A:** the receiver types the supplier's price per line when it differs: receive line `{lineId, receivedQty, deliveredPrice: string | null, priceConfirmed}`; a differing price needs `priceConfirmed` (`PRICE_CHANGE_UNCONFIRMED`).
5. LPO output: no prices, no total, no amount in words. Reversal lines are `<original ref>-R` (no gap-free PAY number).
6. My call, owner may overrule: "orderable" = supplier sells it with a price, or the Store Manager types one; else `ITEM_SETUP_INCOMPLETE` (the catalog's "needs setup" rule matches 145 of 221 items, so it is not used).

## Production (read-only check done via `ssh wendo`; never write there)
Old purchasing tables are **empty** on production; the 10 `RECEIVE` ledger rows carry no receipt link; no `LPO/PAY/GRN` counters. **Nothing to convert.** Latest prod migration: `20261004120000_ledger_append_only_trigger`. **Go-live blocker, not a build item:** PINs exist for 1 of 2 Accountants only (Store Manager, Attendant, System Admin, Directors have none). Tell the owner in the final recap.
Production migration is the owner's push-and-deploy step (CI runs `migrate deploy`). Never run `prisma migrate dev` against production.

## How to build the next folders (conventions already established)
- Each folder: `<name>-routes.ts` (`router.use(authenticate)`, `requireCapability(...)` per route), `-controller.ts` (Zod parse, thin), `-service.ts`, `-repository.ts` (all Prisma, `siteId` in every query), `-validators.ts`, `<name>.types.ts`, `README.md`, tests beside. Services call `requireHubReader` / `requireHubActor`. Look at `needs-restocking/` and `files/` as the pattern; the route matrix test pattern is in `needs-restocking-service.test.ts`.
- The mock engine is the rules reference: `frontend/features/inventory/purchasing/mock/engine.ts` (create/update/submit/approve/return/send/cancel at ~659 to 790, deposit 792, receive 841, invoice/dispute/void 919 to 1004, payment/reverse 1009 to 1088, advice 1090, supplier owing/statement 1165 to 1230, audit 1231) and the wire shapes in `frontend/features/inventory/purchasing/types/index.ts` (these win over `API_CONTRACT.md` §31). Rules in plain English: `docs/features/inventory/purchasing-mock/backend-rules.md`.
- PIN: copy the pattern in `counting/count-service.ts` (`verifyPin`, `comparePin`). Build `_shared/pin.ts`: own PIN, and an **approver PIN** that must belong to a user holding `orders.approve` (reversal: Store Manager or System Admin).
- Numbers: `referenceCounterRepository.nextReference(tx, siteId, 'LPO'|'PAY'|'GRN')` inside the same `$transaction`. LPO number is given at submit (or at an approver's own-draft approval).
- Audit rows are written in the same transaction as the change (`_shared/purchasing-audit.ts`, to be written). The audit-log module (`modules/inventory/audit-log/`) is a fixed three-area aggregator and needs `PURCHASING` and `PAYMENTS`.
- Response shaping goes through one `_shared/order-view.ts` using `blindnessOf`. **Extend `FINANCIAL_KEYS`** (`blind-rule.ts`) with `invoice`, `money` (and any new financial key); keep order totals visible. Never write an `isAttendant` check.
- Receiving: one transaction: lines + delivery + GRN number + one `postStockMovement` per received line (`type: 'RECEIVE'`, `links: { purchaseDeliveryLineId }`, quantity in usage units = buy qty x pack, `unitCost` = confirmed price per usage unit) + supplier last price update + audit. Never `inventoryTransaction.create`.
- Mount all folders from one `purchasing/purchasing-routes.ts` under `/inventory/purchasing`, replacing `receivingRoutes` in `routes/index.ts` (line 35 and 79) in the delete step.

## Known risks and gotchas
- **Suppliers module is coupled to the old tables** (`suppliers/supplier-service.ts` lines ~25, 459, 613, 1077 to 1083, 1174, 1210, 1237; `supplier-summary`, `supplier-pay-history`, `supplier-repository`, their tests, `supplier-serializers`). Repointing may touch more than listed. Also `catalog/inventory-repository.ts`, `dispatch-repository.ts`, `stock-*` reference old models; grep `goodsReceipt|supplierInvoice|supplierPayment|expectedDelivery` before deleting. `SupplierDocument` links to old receipts and invoices.
- The front-end `suppliers/legacy-payables` was already deleted; `cd frontend && pnpm build` must still pass at the end.
- `ledger-guard.test.ts` allow-list: remove `receiving-service.ts` when the old receiving is deleted. Then drop `goodsReceiptLineId` from `LEDGER_LINKS`, the schema and the migration (write a **final migration** dropping the old tables and the old ledger column; production has no data in them).
- Local DB is migrated; Postgres MCP is read-only. zsh: quote globs (`--include='*.ts'`), `no matches found` otherwise. The local `.env` points at the Docker Postgres on 5433.
- In the previous session a migration edit was done with a shell heredoc (against rule 12). Use Edit/Write only.
- The old `purchasing/receiving-*.ts` files still compile and their 100+ tests pass; leave them untouched until the delete step.

## Remaining steps (in order)
1. `orders/` (list, file, LPO print data without prices, WhatsApp text, create/update/discard/submit/approve/return/send/cancel, `GET /summary`, `_shared/pin.ts`, `order-view.ts`, `purchasing-audit.ts`, one-open-order check, price flag vs last order, `previousPrice`).
2. `receiving/`. 3. `payables/` (deposit, invoice with duplicate warning and variance, settle, void, pay with overpay and cheque rules, reverse with approver PIN, advice). 4. `supplier-account/` (supplier orders tab, owing card, statement with ageing and CSV, payment details hidden from the Branch Manager).
5. Repoint suppliers and audit-log; mount the router; delete old code and routes; shrink the ledger guard; final migration.
6. Docs: folder READMEs, `purchasing/README.md` (rewrite), `API_CONTRACT.md` §31 (match the mock types; LPO without prices; delivered price), `DATA_MODEL.md`, `PROJECT_STATUS.md` (tick step 3), `docs/features/inventory/README.md` status.
7. Verify: `cd backend && pnpm build && pnpm test`; real requests as Store Manager, Accountant and Attendant against the local API (Postgres MCP to check rows); `cd frontend && pnpm build`.
8. Commit in logical commits; do not push. Finish with the 5-line recap (mention the PIN go-live blocker, the "orderable" decision, the Q-02 front-end difference, and the receive screen needing a price field), then outline step 4 (below) in plain words. Do not start step 4.

Step 4 (outline for the owner): Purchasing front-end live. The mock is swapped for the real API, the demo bar removed, the receive screen gains a typed-price field, the Attendant sees prices and order totals, the Attendant desktop screens are built to the new access rule, and the owner approves the built screens.
