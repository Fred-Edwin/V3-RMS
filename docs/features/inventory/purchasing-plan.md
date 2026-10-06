# Purchasing and Receiving back-end: implementation plan (Step 3)

Written 6 Oct 2026. Status: **awaiting owner approval, nothing built.** Sources: `purchasing-mock/backend-rules.md`, the mock's `types/index.ts` (the wire shapes; wins over `API_CONTRACT.md` §31 where they differ), Paper `p-3-0`, `FEATURE_REDO_PLAYBOOK.md` §9, `CODING_STANDARDS.md` §4.

## Owner answers that shape this plan (6 Oct 2026)
1. **Attendant money:** sees item prices (unit, last, previous, price change) **and order totals and line totals**. Still blind to invoices, payments, balances, what we owe, and stock figures. So `orderedTotal`, `lineTotal`, `deliveredTotal`, `notSuppliedTotal` and the order-level summary figures reach the Attendant; `invoice`, `payments`, `money.invoiced / paid / stillToPay` and every `FINANCIAL_KEYS` field do not. (The mock still hides everything: a step 4 front-end matter.)
2. **Attendant scope:** `orders.read` means **every order, read-only**, with the blind rule applied. Writes stay by capability (`orders.request` on own drafts, `orders.receive`).
3. **Supplier page:** the supplier owing card, pay history, summary and statement are **repointed to the new tables in this step**, then the old tables are dropped after the production check.
4. LPO output: no prices, no total, no amount in words (step 1). Payment advice keeps amount in words (it is a payment document, not the LPO).
5. **Delivery price (answered 6 Oct 2026, Option A):** the receiver **types the supplier's price on a line when it differs** from the order. Each receive line is `{lineId, receivedQty, deliveredPrice: string | null, priceConfirmed}`. A `deliveredPrice` that differs from the order's price needs `priceConfirmed: true` (`PRICE_CHANGE_UNCONFIRMED` otherwise); the confirmed price becomes `confirmedPrice` and values the delivery. Prices are visible to the Attendant, so this works on the phone. The mock's `deliveryPrice` stand-in goes; step 4 gives the receive screen a price field per line.
7. **"Orderable" (my decision while building, 6 Oct 2026):** the catalog has no durable "setup done" flag, and its "needs setup" rule matches 145 of 221 live items (including legitimate kg/kg items such as "Chicken, cut"), so it is **not** used to block ordering. An order line is accepted when the supplier sells the item with a last price, or the person raising the order types a price (Store Manager); otherwise `ITEM_SETUP_INCOMPLETE`. The Needs list shows every item below level, with "No supplier yet" for items nobody sells us. Owner may overrule.
6. Reversal lines carry the original payment's reference plus `-R` (as the mock does) and do not use a gap-free `PAY` number.

## Production check (6 Oct 2026, read-only, server `wendo`)
- Old purchasing tables are **empty in production**: `goods_receipts`, `goods_receipt_lines`, `expected_deliveries`, `supplier_invoices`, `supplier_payments`, `supplier_payment_allocations`, `supplier_invoice_adjustments` all 0 rows. **Nothing to convert**; the old tables can be dropped outright.
- `inventory_transactions` has 10 `RECEIVE` and 7 `DISPATCH_IN` rows, **none with a `goods_receipt_line_id`**, so repointing that column's foreign key to the new delivery lines affects no data. (The ledger is append-only: the migration changes the constraint, never a row.)
- Reference counters on production: `DAY`, `SUPPLIER` only. `LPO`, `PAY`, `GRN` start from 1.
- Latest migration applied: `20261004120000_ledger_append_only_trigger`.
- **Go-live note, not a build item:** PINs are set for 1 of 2 Accountants and **nobody else** (Store Manager, Store Attendant, System Admin and the 6 Directors have none). Approving, receiving, voiding and reversing all need a PIN, so these accounts need PINs set before the flow can be used.

## Layout (the refactor structure)
One sub-module, `backend/src/modules/inventory/purchasing/` (receiving, orders and supplier AP stay merged as the playbook says). Inside it, **folders named for what the user does**, each with the layer-suffixed files and its own `README.md` (spec, status, endpoints, coupling), tests beside the code:

```
purchasing/
  README.md                       sub-module map, status, who can do what
  _shared/                        used by several folders below
    order-state.ts                the state machine, stage and tracker derivation, `can{}` flags
    order-numbers.ts              LPO / PAY / GRN via the reference counter (same transaction)
    pin.ts                        verify own PIN; verify an approver PIN holds a capability
    order-view.ts                 builds Order / OrderRow / PurchaseFile, applies the blind rule
    money.ts                      Decimal helpers: totals, variance, advance applied, ageing
    purchasing-audit.ts           writes one audit row inside the caller's transaction
    purchasing-errors.ts          the §31.6 error codes
  needs-restocking/               "Needs restocking" + catalog for New order (reads)
  orders/                         raise, edit, submit, approve, return, send, cancel, LPO print, WhatsApp text, list, file
  receiving/                      receive a delivery (PIN, note, photo, price confirms) -> ledger
  payables/                       advance, invoice, settle, void, pay, reverse, payment advice
  supplier-account/               supplier Orders tab, owing card, statement (+CSV, ageing)
  files/                          upload to R2, purchase documents
```

Each folder: `<name>-routes.ts`, `-controller.ts`, `-service.ts`, `-repository.ts`, `-validators.ts`, `<name>.types.ts`, `README.md`. A `$transaction` lives in a service only; all Prisma in repositories; every query carries `siteId` (column `organization_id`). Cross-folder imports only through each folder's exports and listed in its README *Coupling*. Routes mount in `routes/index.ts` in place of `receivingRoutes`. The audit log (`modules/inventory/audit-log/`) gains areas `PURCHASING` and `PAYMENTS`, fed by the new audit table.

## Schema (`backend/prisma/schema/inventory/purchasing.prisma`, rewritten)
New: `PurchaseOrder` (status enum, supplier, raiser, notes, expected date, sent via/at, returned note, cancel reason/note/by/at, approver and signed-at, `reference` unique per site, nullable until submit), `PurchaseOrderLine` (price, previous price, pack, ordered qty, received qty, confirmed price, result), `Delivery` + `DeliveryLine` (GRN reference, delivery note no. and file, received by; `DeliveryLine.id` is what `postStockMovement` links as `goodsReceiptLineId`), `PurchaseInvoice` (one per order, disputed flag, variance, settlement, void; voided rows kept, unique `(siteId, supplierId, number)` only where not voided), `PurchasePayment` (kind ADVANCE / INVOICE / REVERSAL, method, refs, cheque no., proof file, `reversesId`, reason, approver), `PurchaseDocument`, `PurchasingAudit`, `PurchaseFile` (uploaded object keys). `ReferenceCounter` is reused (prefixes `LPO`, `PAY`, `GRN`).
Ledger: `LEDGER_LINKS` keeps `goodsReceiptLineId` but points at `DeliveryLine`; `findLinkOwnerSites` in `ledger-repository.ts` is updated in the same change, with `ledger-door.db.test.ts`.
Dropped (after the production check, last migration): `ExpectedDelivery(+Line)`, `GoodsReceipt(+Line)`, `SupplierInvoice`, `SupplierInvoiceReceipt`, `SupplierInvoiceAdjustment`, `SupplierPayment`, `SupplierPaymentAllocation` and their enums.
Local data to convert or discard: 2 receipts, 1 invoice, 2 payments (all on the S6 test supplier). Production is unchecked.

## Endpoints and capabilities (38; shapes from the mock types)
- **needs-restocking:** `GET /summary` (`orders.read`), `GET /needs-restocking`, `GET /catalog` (`orders.request`).
- **orders:** `GET /orders`, `GET /orders/:id`, `GET /orders/:id/lpo`, `GET /orders/:id/whatsapp`, `POST /orders`, `PATCH /orders/:id`, `DELETE /orders/:id` (draft only), `POST /orders/:id/{submit,approve,return,send,cancel}`. Caps: `orders.read`, `.request`, `.approve`, `.cancel`.
- **receiving:** `POST /orders/:id/receive` (`orders.receive`); the receive route moves the order to `DELIVERED`, writes `GRN-nnnn`, posts one `RECEIVE` row per received line, updates supplier last price, all in one transaction.
- **payables:** `POST /orders/:id/deposits` (`payables.record_deposit`), `POST /orders/:id/invoice`, `POST /invoices/:id/{settle-dispute,void}` (`payables.record_invoice`), `POST /invoices/:id/payments`, `POST /payments/:id/reverse` (`payables.record_payment`), `GET /payments/:id/advice` (`payables.read`).
- **supplier-account:** `GET /suppliers/:id/orders` (`orders.read`), `GET /suppliers/:id/statement` (`payables.read`, `?format=csv`; payment-method detail only with `suppliers.read_payment_details`).
- **files:** `POST /uploads`, `POST /orders/:id/documents`.
- **audit:** purchasing and payments rows through the existing `GET /inventory/audit-log` (`audit.read`).
No new capability is needed. Services call `requireHubReader` / `requireHubActor`. Every response goes through `order-view.ts`, which uses `blindnessOf` / `withoutFinancials` (never an `isAttendant` check), with a new `PURCHASING_FINANCIAL_KEYS` extension if the shared key list needs `invoice`, `money`, `deliveredPrice` style keys.

## Build order (one commit per step, branch `feat/central-store-go-live`, not pushed)
1. Schema + migration for the new tables only (old tables stay) after the production read-only check.
2. `_shared/` (state machine, numbers, pin, money, audit, errors), with tests.
3. `files/`, `needs-restocking/`, `orders/` (repository, service, validators, controller, routes).
4. `receiving/` through `postStockMovement`; update ledger link owner lookup.
5. `payables/` (deposit, invoice, settle, void, pay, reverse, advice).
6. `supplier-account/`; repoint `suppliers/` (summary, pay-history, owing, `supplier-service` AP calls) and audit-log areas onto the new tables.
7. Delete old code: `purchasing/receiving-*`, `purchase-documents*`, old routes (`/inventory/ap/*`, expected-deliveries, goods-receipts, purchasing history); remove `purchasing/receiving-service.ts` from the `ledger-guard.test.ts` allow-list; final migration drops old tables.
8. Docs: folder READMEs, `purchasing/README.md`, `API_CONTRACT.md` §31 (match the mock types; LPO without prices), `DATA_MODEL.md`, `PROJECT_STATUS.md` step 3 ticked.

## Test plan
- Service rules: every transition and error code; PIN (own, approver, wrong); one-open-order; hold and incomplete item; short, over-delivery, price confirm; advance cap and carry-over; variance, dispute, settle, void; pay, overpay, cheque no.; reversal links and re-opens the invoice; numbers gap-free under retry.
- Route capability matrix: role by endpoint (SM, SA, ATT, ACC, DIR, BM), including a non-hub actor refused.
- Blind rule on every Attendant-reachable response: no `invoice`, `payments`, `money.invoiced/paid/stillToPay`, no stock figures; prices and order totals present.
- Ledger door: receiving posts one `RECEIVE` per line, rolls back with the transaction, guard test allow-list shrinks.
- LPO print has no price, total or words keys.
- Branch Manager never gets payment-method details; DB test for hub scoping.
- Gate: `cd backend && pnpm build && pnpm test`, real requests as Store Manager, Accountant and Attendant, and `cd frontend && pnpm build` unchanged.

## Task list
- [ ] Production read-only check, then migration (new tables)
- [ ] `_shared/`
- [ ] `files/`, `needs-restocking/`, `orders/`
- [ ] `receiving/` + ledger link
- [ ] `payables/`
- [ ] `supplier-account/` + suppliers and audit-log repoint
- [ ] Delete old code, shrink ledger guard, drop old tables
- [ ] Docs, verification, commits

## Risks to watch
- The suppliers module is coupled to the old tables (`supplier-service.ts`, `supplier-summary`, `supplier-pay-history`, their tests); step 6 is the riskiest and may touch more files than listed.
- `frontend` still calls nothing real for purchasing, but `suppliers/` legacy payables screens may call the old `/ap` routes: checked in step 7 by `pnpm build` and a grep before deleting.
- Step 4 front-end must change the Attendant mock to match answer 1.
