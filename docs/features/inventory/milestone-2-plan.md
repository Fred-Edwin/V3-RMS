# Inventory & Procurement — Milestone Two High-Level Plan (Step 5)

**Feature:** Inventory & Procurement (Feature 1 of the redo)
**Milestone:** **Two — Receiving & Supplier AP** — Stage 1 (Buying/estimate),
Stage 2 (Receiving), Stage 10 (Supplier payment). See `MILESTONES.md` for why
these three Stages are one ship unit.
**Step:** 5 of the per-feature pipeline — high-level plan
**Status:** APPROVED 2026-09-16 (all six §7 questions resolved). Step 7 build
underway: S0, S1, S2, S3, S5, S4, S6, S7, S8 complete (S8 landed 2026-09-18,
including a same-day backend amendment — see its own row below) — see §5 for
current session status. S9 (integration) is next.
**Date:** 2026-09-16

**Traces to:**
`01-description.md` (§3 Stage 1, Stage 2, Stage 10; §4 costing/units/tenancy; §7 removals) ·
`02-flows.md` (Flows 1, 2/2a/2b/2d/2e, 14, 15, 16, 17/17a) ·
`02-screens-by-role.md` (Store Manager screens 2–10; Store Attendant receiving worklist) ·
Paper page `Milestone Two · Receiving & Supplier AP` (`C-0`) in `01M1ZZJ6S3FZGF5C7PPBGTKY89` ·
`04-components.md` (Milestone One's built set; the Milestone Two gap — §6 below) ·
`milestone-1-plan.md` (the precedent this plan follows) ·
`docs/FEATURE_REDO_PLAYBOOK.md` §5, §7, §8, §9 ·
`docs/inventory/CENTRAL_STORE_SCOPING_DESIGN.md` (D-15) ·
`docs/CODING_STANDARDS.md`, `docs/API_CONTRACT.md` §1, `docs/TDD.md`.

**Terminology (owner decision 2026-09-16):** "AP" (accounts payable) and
"aging" are accountant's terms, not the product's. This plan and the screens
it describes use **"what we owe"** in place of "Supplier AP"/"AP position" and
**"how overdue"** in place of "aging" everywhere they describe what a Store
Manager, Attendant, or Director sees or does. The milestone's own name
("Receiving & Supplier AP") and the Paper page title are left as-is — renaming
those is a separate, larger change than this plan makes — and schema/URL
identifiers below (`SupplierApRow`, `/inventory/ap/…`) stay technical, since
those are never user-facing. Where the Accountant's own reconciliation
workflow needs the formal term later (out of scope this milestone, §7 Q6),
that's a call for that pass, not this one.

---

## 0. Scope

Ten screens on Paper page `C-0`, all walked through directly this session
(desktop and mobile, plus the loading/error states), in the page's own
workflow order:

| # | Screen | Desktop | Mobile | Surface |
|---|---|---|---|---|
| 1 | Purchasing hub | `U7V-0` (loading `WK4-0`, error `WPL-0`) | `WUL-0` | route (hub-landing) |
| 2 | New purchase | `UEP-0` | `X1O-0` | drawer / full-screen |
| 3 | Receiving worklist (Attendant) | `UMS-0` | `WSO-0` | route |
| 4 | New Goods Receipt | `UQE-0` | — (Attendant mobile via `WSO-0` entry) | route |
| 5 | Goods Receipt detail (signed) + print | `UVN-0` | — | route |
| 6 | Record supplier invoice | `UZJ-0` | `X2Y-0` | drawer / full-screen |
| 7 | Record supplier payment | `V7Z-0` | `X4O-0` | drawer / full-screen |
| 8 | Suppliers / AP landing | `VGE-0` | `WXO-0` | route |
| 9 | Supplier detail | `VND-0` | `WZF-0` | route |
| 10 | New / edit supplier | `VU2-0` | `X6B-0` | drawer / full-screen |

**In scope:** expected deliveries (Stage 1 estimates), goods receipts + their
ledger writes, supplier invoices with receipt bundling and disputes, supplier
payments with multi-invoice allocation and overpayment credit, the
what-we-owe / how-overdue read models, and receipt signing + print.

**Explicitly out of scope** — named so build sessions don't drift:
prep, requisitions, dispatch, counts, waste, branch receiving, the month-end
statement **reconciliation workspace** (Flow 17 — see §7 Q6), and the Reports
pass. **The Purchasing hub's `IN TRANSIT` KPI is dropped, not deferred** — see
§7 Q1: every purchase in this milestone goes straight from expected to
received in one step, so there's no in-transit state for it to count. That
concept belongs to Milestone Five's branch dispatch.

**This milestone is the first writer to the stock ledger.** Milestone One only
read `InventoryTransaction` (for on-hand). Every `RECEIVE` row in the system
originates here, and this milestone owns latest-price costing (§1.6).

---

## 1. Data model

Greenfield, as the orchestrator brief established and this session re-confirmed
against the live DB (§4). Five new models, one new enum, two new enum-ish
status types, and two small touches to Milestone One's surviving tables: one
orphaned ledger column re-pointed (§1.6), and one new field on `Supplier`
(`paymentDays`, §1.3, §7 Q3(b)) — everything else on `Supplier`,
`InventoryItem`, `Category`, `RestockLevel` is untouched.

### 1.1 `ExpectedDelivery` + `ExpectedDeliveryLine` — Stage 1

Derived from: New purchase drawer (`UEP-0`), Purchasing hub Inbound band
(`U7V-0`), Attendant worklist (`UMS-0`), Supplier detail purchase history
(`VND-0`, row `EXP-0091`).

The drawer is explicit that this is **not a PO**: *"Not a purchase order — an
estimate. Saves to the Inbound band."* It writes **no ledger entry** (Flow 1
step 3).

```
ExpectedDelivery
  id, organizationId, reference (EXP-0091, generated)
  supplierId            -> Supplier
  paymentTerms          SupplierPaymentTerms   // defaulted from supplier, per-record
  status                ExpectedDeliveryStatus // AWAITING | FULFILLED | CANCELLED
  expectedDate          DateTime?              // "due 11 Sep" on VND-0
  estimatedTotal        Decimal(12,2)          // stored, see below
  createdById           -> User
  createdAt, updatedAt
  @@unique([organizationId, reference])
  @@index([organizationId, status])

ExpectedDeliveryLine
  id, expectedDeliveryId, inventoryItemId
  quantity  Decimal(12,4)   // in the item's BUY unit ("4 crate")
  estimatedUnitPrice Decimal(12,4)
  lineOrder Int
```

- **`estimatedTotal` is stored, not derived.** It is an estimate that never
  needs to reconcile with anything (the receipt supersedes it), and the hub
  renders `~KES 8,100` on every Inbound row — storing it avoids a per-row line
  aggregation on the hub's hottest query. Every *money* figure that must
  reconcile is derived instead (§1.5).
- **`Overdue` is not a status** — it's `status = AWAITING AND expectedDate <
  now()`, computed in the read model. Storing it would need a cron to flip it.
  The hub shows `Overdue` and `Awaiting delivery` as different dots off the
  same row (`U7V-0`).

### 1.2 `GoodsReceipt` + `GoodsReceiptLine` — Stage 2

Derived from: New goods receipt (`UQE-0`), signed detail (`UVN-0`), hub Inbound
+ History bands, Attendant worklist.

```
GoodsReceipt
  id, organizationId, reference (GRN-1042, generated)
  supplierId            -> Supplier
  expectedDeliveryId?   -> ExpectedDelivery   // nullable: receiving without an estimate is allowed (Flow 1)
  paymentTerms          SupplierPaymentTerms  // defaulted from supplier, editable per receipt
  status                GoodsReceiptStatus
  supplierDocNumber     String?               // "INVOICE / DELIVERY NOTE No." — nullable per Flow 2a
  supplierDocDate       DateTime?
  receiptTotal          Decimal(12,2)         // snapshot at signing, immutable
  locationId            -> Location           // the CENTRAL_STORE location
  signedById?           -> User
  signedAt?             DateTime
  createdById           -> User
  createdAt, updatedAt
  @@unique([organizationId, reference])
  @@index([organizationId, status])
  @@index([supplierId])

GoodsReceiptLine
  id, goodsReceiptId, inventoryItemId
  quantityBuyUnit   Decimal(12,4)   // as entered ("18.0 kg", "2 pkt")
  quantityUsageUnit Decimal(12,4)   // computed at save via conversionFactor; what hits the ledger
  unitPrice         Decimal(12,4)   // per BUY unit, as invoiced
  lineTotal         Decimal(12,2)
  priceAlertPct     Decimal(6,2)?   // null = no alert fired
  priceAlertPrevPrice Decimal(12,4)?
  priceAlertAcceptedById? -> User
  lineOrder Int
```

**`GoodsReceiptStatus`:** `DRAFT | RECEIVED_INVOICE_PENDING | RECEIVED_PAID |
INVOICE_RECORDED | CANCELLED`.

- `DRAFT` is required by the screen: `UQE-0`'s top bar has **Save draft** and
  **Sign & save** as two distinct actions, and Flow 2a's offline path holds an
  unsigned draft. **No ledger rows exist while `DRAFT`.**
- The `RECEIVED_INVOICE_PENDING` vs `RECEIVED_PAID` split is the payment-terms
  branch: `01-description.md` Stage 2 — *"Invoice to follow → the receipt is
  `Received — invoice pending`… Pay now → …no AP is created."* (`01-description.md`'s
  own wording — this is the one place the source doc itself uses the term.)
  This status decides whether a what-we-owe row is ever created, and is set from
  `paymentTerms` at signing.
- `INVOICE_RECORDED` is what the hub History band shows once Flow 14 runs
  (`U7V-0`: GRN-1041 · "Invoice recorded"). It keeps the "Invoices to record"
  queue a simple status filter rather than a NOT-EXISTS subquery.
- **The price alert is persisted on the line, not recomputed.** `UVN-0` renders
  it as a permanent audit record on the signed receipt — *"Price alert at
  receipt · … 38% above last price (KES 1,049). Accepted by D. Kariuki."* The
  previous price it compared against is gone by then (latest-price costing has
  overwritten `InventoryItem.currentCost`), so it **must** be snapshotted at
  signing or the signed document becomes unreproducible.
- **No damaged-quantity or supplier-claim field.** `UVN-0` still shows one —
  that artboard is stale, predating the 2026-09-15 retirement of Flow 2c. See
  §7 Q2.

### 1.3 `SupplierInvoice` — Stage 10, Flow 14

Derived from: Record supplier invoice (`UZJ-0`), Supplier detail invoice list
(`VND-0`), the Suppliers screen (`VGE-0`), hub History band.

```
SupplierInvoice
  id, organizationId, supplierId
  invoiceNumber     String                 // supplier's own number
  invoiceDate       DateTime
  dueDate           DateTime               // computed once at creation, then stored — see below
  amountBilled      Decimal(12,2)          // as stated on their document
  status            SupplierInvoiceStatus  // UNPAID | PARTIALLY_PAID | PAID
  disputeStatus     DisputeStatus?         // null | OPEN | RESOLVED  -- NOT a status value
  disputeOurFigure  Decimal(12,2)?
  disputeReason     String?
  recordedById      -> User
  createdAt, updatedAt
  @@unique([organizationId, supplierId, invoiceNumber])   // Flow 14: duplicate blocked
  @@index([organizationId, status])
  @@index([supplierId, dueDate])

SupplierInvoiceReceipt        // join — an invoice bundles MANY receipts
  supplierInvoiceId, goodsReceiptId
  @@id([supplierInvoiceId, goodsReceiptId])
```

- **Receipt↔invoice is many-to-many, not an FK on the invoice.** `UZJ-0` has a
  "RECEIPTS TO BUNDLE" checkbox list, and Flow 14 states *"One invoice covers
  multiple receipts."* A `goodsReceiptId` column on the invoice cannot express
  this; the join table can.
- **Dispute is a separate field, not a `SupplierInvoiceStatus` member.** `VND-0`
  renders "Disputed" in the same column as "Unpaid"/"Partly paid", which reads
  like one enum — but Flow 17a says a disputed invoice *"still ages (it is
  still outstanding)"* and can still be paid. Collapsing them would make a
  disputed-and-partly-paid invoice unrepresentable. The UI renders
  `disputeStatus = OPEN` in preference to the payment status; the data keeps
  both. **This is the one place I deliberately diverge from a literal reading
  of the artboard**, and it's why the plan says so here.
- The unique constraint is scoped `(organizationId, supplierId, invoiceNumber)`
  — two different suppliers may legitimately both issue "INV-001".
- **`dueDate` comes from a new field on `Supplier` (owner decision, §7 Q3(b)):
  `paymentDays: Int`.** `SupplierPaymentTerms` says *whether* a supplier bills
  on account, never *when* it's due, and `VGE-0`'s aging columns are headed
  "DAYS OVERDUE" — that math needs a due date to measure from. `Supplier`
  gains one field, editable on the supplier form (`VU2-0`/`X6B-0`), defaulted
  for existing rows on migration (e.g. 30). `SupplierInvoice.dueDate` is
  computed **once**, at invoice creation, as `invoiceDate + supplier.
  paymentDays`, and stored rather than recomputed on read — a later change to
  the supplier's terms must not retroactively shift the due date of an
  invoice already on the books.

### 1.4 `SupplierPayment` + `SupplierPaymentAllocation` — Flow 15

Derived from: Record supplier payment (`V7Z-0`), Supplier detail payments panel.

```
SupplierPayment
  id, organizationId, supplierId
  amount        Decimal(12,2)     // may exceed the sum of allocations -> credit
  paidAt        DateTime
  method        SupplierPaymentMethod   // BANK | CASH | MPESA
  reference     String?                 // "EFT-88213"
  reversalOfId? -> SupplierPayment      // append-only correction (Flow 15)
  reversalReason String?
  recordedById  -> User
  createdAt
  @@index([organizationId, supplierId])

SupplierPaymentAllocation
  id, supplierPaymentId, supplierInvoiceId
  amount Decimal(12,2)   // negative allowed ONLY on a reversal payment
  @@unique([supplierPaymentId, supplierInvoiceId])
```

- **Payments are immutable.** Flow 15: *"payments are immutable once saved; the
  actor records a correcting reversal (negative allocation) with a reason."*
  Hence `reversalOfId` + no update endpoint. Nothing is ever deleted.
- **Overpayment is not a stored credit balance.** A payment whose `amount`
  exceeds the sum of its allocations leaves the remainder unallocated; the
  supplier's credit is then
  `Σ payments.amount − Σ allocations.amount` — derived, same as every other
  what-we-owe figure (§1.5). Storing a `creditBalance` column would need to stay in sync
  with an append-only ledger, which is precisely the drift Milestone One's
  "on-hand is always derived" rule exists to prevent.

### 1.5 What we owe and how overdue it is — derived, not stored

**Decision: computed at query time. No stored/cached balance.**

Reasoning, and the cross-check that drove it: the same figures appear on three
screens — the how-overdue buckets on `VGE-0`, the "What we owe" panel on `VND-0`, and
"Our figure"/"Amount due" on `UZJ-0`/`V7Z-0`. I verified they reconcile:
Kimathi Butchery 312,400 invoiced − 194,000 paid = 118,400 outstanding, and its
buckets 28,400 + 90,000 = 118,400 ✓. Samrat 26,180 current + 16,000 in 1–30 =
42,180, matching both its `VGE-0` row and its `VND-0` panel ✓.

Three views that must always agree is exactly the case for one derivation, not
three stored counters. The data volumes make it free: 14 suppliers, invoices in
the low hundreds per quarter. This mirrors `01-description.md` §4's ledger rule
("stock on hand is always derived… never a stored counter") applied to money.

Per invoice: `outstanding = amountBilled + Σ adjustments − Σ allocations`.
Aging bucket comes from `dueDate` (§1.3), since `VGE-0`'s columns are headed
**"— DAYS OVERDUE —"**, not days since invoice — `days overdue = today −
dueDate`, bucketed as **CURRENT (≤0) / 1–30 / 31–60 / 61–90 / 90+** (five
buckets, owner-resolved §7 Q4; the Supplier detail panel merges the last two
for display only, never in the underlying data). A supplier's credit position
(§1.4) is `Σ payments.amount − Σ allocations.amount`, the same
derive-don't-store rule applied to overpayment.

### 1.6 Ledger integration — latest-price costing

On **signing** a receipt, in one `prisma.$transaction`:
1. one `InventoryTransaction { type: RECEIVE }` per line, at the
   `CENTRAL_STORE` location, `quantity` in **usage units**, `unitCost` = the
   line's unit price converted to the usage unit;
2. `InventoryItem.currentCost` ← that unit cost (latest-price, §4). The prior
   value is preserved in the price-alert snapshot on the line (§1.2) and,
   historically, in the ledger rows themselves.

`InventoryTransaction.purchaseOrderLineId` is an orphaned nullable column left
by Milestone One. **Rename it to `goodsReceiptLineId` and make it a real FK**
— the schema comment already says each orphan *"is restored as a real FK when
the milestone that rebuilds that flow lands."* This is that milestone. It is a
column rename on an empty table, not a data migration.

### 1.7 Reference number generation

`GRN-1042` / `EXP-0091` are user-visible sequential refs per org. Use the
existing `OrderCounter` pattern already in the schema (a per-org counter row
incremented inside the same transaction) rather than a DB sequence, so the
numbers stay gap-free per organization and per document type.

---

## 2. Migration plan

One migration, `inventory_milestone_two_receiving_ap`, generated locally with
`npx prisma migrate dev` per `CLAUDE.md`'s workflow.

**Genuinely new (CREATE TABLE):** `expected_deliveries`,
`expected_delivery_lines`, `goods_receipts`, `goods_receipt_lines`,
`supplier_invoices`, `supplier_invoice_receipts`, `supplier_payments`,
`supplier_payment_allocations`.

**New enums:** `ExpectedDeliveryStatus`, `GoodsReceiptStatus`,
`SupplierInvoiceStatus`, `DisputeStatus`, `SupplierPaymentMethod`.

**FKs into Milestone One's surviving tables:** `Supplier` (receipts, invoices,
payments, expected deliveries), `InventoryItem` (both line tables),
`Location` (receipts → the `CENTRAL_STORE` row), `User` (signer, recorder,
price-alert accepter), `Organization` (every model).

**Two ALTERs:**
1. `inventory_transactions.purchase_order_line_id` → `goods_receipt_line_id`,
   plus the FK constraint (§1.6).
2. `suppliers` gains `payment_days INT NOT NULL DEFAULT 30` (§1.3, §7 Q3(b)).
   The default backfills every existing supplier row on migration — the owner
   can adjust per-supplier afterward via the supplier form. 30 is a starting
   assumption, not researched from real terms; flag to the owner as a value
   worth reviewing once real suppliers exist in production.

**Production impact: minimal.** The eight new tables don't exist in production
in any form (§4), so there are no rows to move — a pure additive migration,
closer to a from-scratch `migrate dev` than to Milestone One's evaluation.
ALTER 1 touches a column that is present but unused and, per §4, empty. ALTER 2
is the only one that touches live data (`suppliers`, populated in production)
— it's additive with a default, so existing rows aren't broken, but the
`payment_days = 30` default is applied blindly to every current supplier and
should be reviewed against their real terms before this ships.

**Rollback:** drop the new tables and rename the column back. Safe at any point
before the first real receipt is signed, since nothing else reads these tables.

---

## 3. API contract

Committed as `backend/src/modules/inventory/receiving-validators.ts` (Zod, the
source of truth) + `receiving.types.ts` (inferred types), mirrored by hand in
`frontend/features/inventory/types/`, following exactly the Milestone One
convention including its **wire-format rule: every decimal crosses the wire as
a string, never a JS number.**

Every route: `authenticate` + `requireRole` + Zod on body/query/params.
Every repository query filtered by `organizationId`. All of it hub-org scoped
per D-15.

### 3.1 Roles

| Role | Receiving | Purchasing/estimates | What we owe (Supplier AP) |
|---|---|---|---|
| `STORE_ATTENDANT` | create + sign receipts | read worklist | **none — not even read** |
| `STORE_MANAGER` | full | full | full |
| `ACCOUNTANT` | read | read | full (payments, disputes, adjustments) |
| `DIRECTOR` | read | read | read |

The Attendant exclusion is a hard rule (`01-description.md` Stage 10: *"Store
Attendants have zero access to this — not even read-only"*) and the walkthrough
shows it as a **different response shape, not just a hidden nav item**: on
`UMS-0` the Attendant's worklist row reads "Milk, cream, yoghurt · 6 lines"
where the Manager's identical row on `U7V-0` reads "…· ~KES 8,100". The
contract models this explicitly: `ExpectedDeliverySummary` has
`estimatedTotal: string | null`, and the serializer omits it for Attendants
rather than the frontend hiding a column it was sent.

### 3.2 Endpoints

**Purchasing hub / expected deliveries**
- `GET /inventory/purchasing/summary` → the 3 KPIs (`U7V-0`, per §7 Q1).
  Returns `expected{count,overdue}`, `awaitingInvoice{count,oldestDays}`,
  `owed{amount,over30Count}`.
- `GET /inventory/expected-deliveries` — query: `status`, `supplierId`,
  `search`, `limit`, `cursor`. Serves the hub Inbound band, the Attendant
  worklist, and mobile (same shape, mobile just passes a smaller `limit`).
- `POST /inventory/expected-deliveries` — body: `supplierId`, `paymentTerms`,
  `expectedDate?`, `lines[]{inventoryItemId, quantity, estimatedUnitPrice}`.
  → 201. Errors: 400 invalid, 404 supplier/item, 409 retired supplier/item.
- `POST /inventory/expected-deliveries/:id/cancel` → 200. 409 if not `AWAITING`.
- `GET /inventory/purchasing/history` — the History band: a **union** of
  receipts and expected deliveries (`U7V-0` mixes `GRN-` and `EXP-` refs in one
  table). Query: `search`, `supplierId`, `status`, `from`, `to`, `limit`,
  `cursor`.

**Goods receipts**
- `GET /inventory/goods-receipts` — query: `status`, `supplierId`, `limit`,
  `cursor`.
- `GET /inventory/goods-receipts/:id` — the signed detail (`UVN-0`), including
  lines, price-alert snapshots, signature, and linked invoice (or
  `"Not recorded yet"`).
- `POST /inventory/goods-receipts` — creates a **`DRAFT`**. Body: `supplierId`,
  `expectedDeliveryId?`, `paymentTerms`, `supplierDocNumber?`,
  `supplierDocDate?`, `lines[]`. **No ledger write.**
- `PATCH /inventory/goods-receipts/:id` — edit a draft only. 409 if signed.
- `POST /inventory/goods-receipts/:id/sign` — body: `pin`, and per alerted line
  an explicit `acceptedPriceAlerts[]`. **This is the ledger-writing endpoint**
  (§1.6) and the status transition to `RECEIVED_INVOICE_PENDING` /
  `RECEIVED_PAID`. Errors: 401 bad PIN, 409 already signed / empty receipt,
  422 no `CENTRAL_STORE` location.
- `GET /inventory/items/:id/last-price` — feeds the price-alert comparison and
  the New-purchase drawer's "Last purchase 2 Sep · KES 6,410" reference.
  (Also unblocks the `04-components.md` catalog "Last price" follow-up — §6.)
- **`GET /inventory/suppliers/:id/recent-items` — added post-freeze
  (AMENDMENT 2026-09-17, `receiving-validators.ts`), not part of the
  original frozen contract.** Feeds the New Purchase item combobox's
  "Recently purchased from this supplier" section, an owner-requested UI
  refinement on top of S5. Sourced from `ExpectedDeliveryLine`, same
  `authenticate`/`requireRole`/`organizationId`-scoping pattern as every
  other endpoint here. See `04-components.md`'s "Milestone Two — S5
  refinements (batch 2)" entry for the full build/verification record.

**What we owe (Supplier AP)**
- `GET /inventory/ap/summary` → `VGE-0`'s 4 KPIs.
- `GET /inventory/ap/suppliers` — the how-overdue table. Query: `search`, `terms`,
  `hasBalance`, `agingBucket`, `period`. Row: invoiced, paid, per-bucket
  amounts, outstanding, `disputedCount`.
- `GET /inventory/ap/suppliers/:id` — `VND-0`: profile, bucket panel, invoices,
  payments, purchase history.
- `GET /inventory/goods-receipts?status=RECEIVED_INVOICE_PENDING&supplierId=`
  — the "receipts to bundle" picker in `UZJ-0`.
- `POST /inventory/supplier-invoices` — body: `supplierId`,
  `goodsReceiptIds[]` (≥1), `invoiceNumber`, `invoiceDate`, `amountBilled`,
  `dispute?{ourFigure, reason}`.
  **The mismatch branch is this same endpoint with `dispute` set, not a second
  endpoint** — because the third button, *Hold*, is the genuine no-write branch
  (it just closes the drawer), and "Record at billed — open dispute" differs
  from plain "Save invoice" only by accompanying the identical invoice write
  with a dispute record. Two endpoints would duplicate the write path to carry
  one optional object. Errors: 409 duplicate invoice number, 409 receipt
  already invoiced, 400 receipts spanning different suppliers.
- `POST /inventory/supplier-payments` — body: `supplierId`, `amount`, `paidAt`,
  `method`, `reference?`, `allocations[]{supplierInvoiceId, amount}`.
  Overpayment (Σ allocations < amount) is **allowed**, not an error (Flow 15).
  Errors: 400 allocation exceeds an invoice's outstanding, 404, 409 invoice
  already `PAID`.
- `POST /inventory/supplier-payments/:id/reverse` — body: `reason`. Creates the
  mirrored negative-allocation payment.
- `POST /inventory/supplier-invoices/:id/adjustments` — the Accountant's
  reconciliation adjustment, **mandatory reason** (Flow 17 step 3). Role:
  `ACCOUNTANT` (+ `STORE_MANAGER`). This endpoint is in scope even though the
  full reconciliation *workspace* is not (§7 Q6) — without it a dispute opened
  by Flow 14 has no way to close.

### 3.3 Cross-cutting

- Response envelope per `API_CONTRACT.md` §1; a new **§22 Inventory —
  Milestone Two** section is added there and marked frozen at Step 6.
- Notifications: signing a receipt notifies the Store Manager (`UQE-0` footer:
  *"Store Manager notified"*). Reuses the existing notification infrastructure;
  no new model.

---

## 3a. Loading, empty, error, and permission-denied states

**This is a real addition, not restating what §3 already covers.** §3 lists
error *cases* per endpoint (400/403/409 conditions); it doesn't say which of
the ten screens needs which visual state, or which of Paper's "states" are
actually generic errors versus business states with their own data shape. Per
`04-components.md`'s placement rules (quoted, not re-derived): loading is a
**screen-mirroring skeleton** (feature-scoped, mirrors the real layout) by
default; empty/error/permission-denied are the **generic shared cards**
(`components/app/shell/shell-states.tsx`) unless a state changes the screen's
actual layout, in which case it's a real populated variant, not a "state."

**Screen-by-screen, checked against what page `C-0` actually drew (§0's
walkthrough), not assumed:**

| Screen | Loading | Empty | Error | Permission-denied | Business states (not generic — real layout variants) |
|---|---|---|---|---|---|
| 1 Purchasing hub | Bespoke, drawn (`WK4-0`) | Generic (`EmptyState`) — no purchases/receipts yet | Bespoke, drawn (`WPL-0`) | N/A (every role that reaches this hub can see it; Attendant sees a narrower shape, §3.1, not a denial) | — |
| 2 New purchase | N/A (a drawer form, nothing to load) | N/A | Generic, inline (save failed) | N/A | — |
| 3 Receiving worklist | Generic `LoadingState` — no bespoke skeleton drawn; build a screen-mirroring one anyway per the default rule, or flag to design if a bespoke one should be drawn | Generic — "Nothing expected today" | Generic | N/A (Attendant's own screen) | — |
| 4 New Goods Receipt | N/A (form) | N/A | Generic, inline | N/A | **`DRAFT` vs. `RECEIVED_*`** (§1.2) — not a loading/error state at all, a real status; **price-alert callout** — a populated variant, not a "state"; **Pay-now vs. Invoice-to-follow** — changes the header, not a state |
| 5 Goods Receipt detail (signed) | Generic `LoadingState` — build screen-mirroring skeleton | N/A (a receipt always has lines once it exists) | Generic | N/A | **Signed vs. unsigned** is not modeled here at all — an unsigned receipt is still `DRAFT` and belongs on screen 4, not this read-only view; confirm no route reaches this screen for a `DRAFT` receipt |
| 6 Record supplier invoice | N/A (drawer form) | N/A (opened from a receipt that exists) | Generic, inline | N/A | **Mismatch/dispute callout** — populated variant, not an error state (§3.2) |
| 7 Record supplier payment | N/A (drawer form) | N/A | Generic, inline | N/A | **Overpayment** — populated variant (§1.4), never an error |
| 8 Suppliers screen (what we owe) | **No bespoke artboard exists** — confirmed by reading the full `C-0` artboard list (25 total); only screen 1 got a drawn loading/error pair (`WK4-0`/`WPL-0`). Build the generic screen-mirroring skeleton per the default rule. | Generic — no suppliers with a balance | Generic (none drawn) | Generic `PermissionDeniedState` — **this is the one screen that actually needs it**: `STORE_ATTENDANT` hits this and must see a denial, not an empty list (§3.1) | — |
| 9 Supplier detail | **No bespoke artboard exists** — same check as row 8. Build the generic screen-mirroring skeleton. | N/A (a supplier detail always has the profile fields) | Generic (none drawn) | Generic `PermissionDeniedState` (same Attendant case) | **Submitting** — Milestone One's Supplier detail-equivalent screen had a `783`-pattern submitting state; not drawn on `C-0` for this milestone. Non-blocking: build without it, add if the owner wants it during the design pass. |
| 10 New/edit supplier | N/A (drawer form) | N/A | Generic, inline | N/A | — |

**Two things this table surfaces that weren't visible before this session:**

1. **Screen 8 is the one screen in this milestone where permission-denied is
   not theoretical.** Every other screen's audience is uniform (Attendants
   simply don't have the nav link); this one needs the actual `403` → denial
   card path tested and built, not just endpoint-level RBAC (§8 already lists
   the endpoint test; this is its UI counterpart).
2. **Confirmed by reading the full artboard list: only screen 1 (Purchasing
   hub) got bespoke loading/error artboards** (`WK4-0`/`WPL-0`). Screens 8 and
   9 have none — this is a checked fact now, not an open question. S0 builds
   the generic screen-mirroring skeleton default for both per the placement
   rules, rather than waiting on a redraw that isn't planned.

---

## 4. Production data check

Per playbook §7, agents do not SSH to the droplet. **I ran these read-only
against the local DB via the Postgres MCP and they came back clean** — no
receiving/AP-shaped table exists under any name or schema:

```sql
-- 1. Any receiving/AP-shaped table under any name, any schema?
SELECT table_schema, table_name FROM information_schema.tables
WHERE table_type='BASE TABLE'
  AND table_schema NOT IN ('pg_catalog','information_schema')
  AND (table_name ILIKE '%invoice%' OR table_name ILIKE '%payment%'
    OR table_name ILIKE '%receipt%' OR table_name ILIKE '%purchase%'
    OR table_name ILIKE '%supplier%' OR table_name ILIKE '%goods%'
    OR table_name ILIKE '%receiv%' OR table_name ILIKE '%expected%'
    OR table_name ILIKE '%dispute%' OR table_name ILIKE '%credit%')
ORDER BY 1,2;

-- 2. Is the ledger column this plan renames actually unused?
SELECT count(*) AS total,
       count(purchase_order_line_id) AS non_null_orphan_fk
FROM inventory_transactions;

-- 3. Supplier rows the new FKs will point at, and their current terms mix —
--    context for reviewing the paymentDays=30 default (§2 ALTER 2), not a
--    blocker.
SELECT default_payment_terms, count(*)
FROM suppliers WHERE deleted_at IS NULL
GROUP BY default_payment_terms;
```

Local results: query 1 returned only `suppliers` (Milestone One's) and three
unrelated customer-credit/orders tables. **Resolved, historical — no longer a
live ask.** This check gated migration `20260916031604_
inventory_milestone_two_receiving_ap` (§2), which has since been generated,
committed, and deployed through the normal CI/CD pipeline (S1, done) without
incident — the eight new tables and the two ALTERs landed cleanly, confirming
query 2's expectation (`non_null_orphan_fk = 0`) held in production too.
Query 3's `paymentDays = 30` blanket default (§2 ALTER 2) is live on every
supplier row; still worth the owner reviewing per-supplier via the supplier
form once real payment terms are known, but that's an ordinary data-quality
follow-up now, not a migration blocker.

---

## 5. Session breakdown (Step 7)

Serial up to the contract freeze, then backend and frontend run in parallel
(playbook §8).

**Run order (owner decision 2026-09-16): sequential, one agent/session at a
time — not backend-then-frontend, and not parallel pairs.** The dependency
graph below still holds (it's what makes the order safe), but since sessions
aren't run in parallel, each backend slice is built for real before its
paired frontend slice, rather than the frontend building against a mock it
would later discard: **S0 → S1 → S2 → S3 → S5 → S4 → S6 → S7 → S8 → S9.**
S0 runs alongside S1/S2 (no dependency between them); everything from S3
onward is strictly sequential.

| # | Session | Status | Depends on | Session prompt |
|---|---|---|---|---|
| **S0** | **Milestone Two component inventory** — write `04-components.md`'s Milestone Two section against page `C-0`; build only the genuinely new composites (§6). | **Done** | plan approved | `06-sessions/milestone-2-s0-component-inventory-prompt.md` |
| S1 | Schema + migration + reference-number counters (§1, §2). Backend only, no endpoints | **Done** — migration `20260916031604_inventory_milestone_two_receiving_ap`; build + all 697 tests pass | plan approved | (schema-only session, no separate prompt file) |
| S2 | Contract freeze (Step 6): commit `receiving-validators.ts` + `receiving.types.ts`, mirror to frontend, add `API_CONTRACT.md` §22 | **Done** — frozen 2026-09-16, all six §7 questions resolved and reflected in the shapes | S1 | (contract-only session, no separate prompt file) |
| S3 | Backend — expected deliveries + purchasing hub read models | **Done** | S2 | `06-sessions/milestone-2-s3-backend-expected-deliveries-prompt.md` |
| S5 | Frontend — Purchasing hub, New purchase, Receiving worklist (desktop + mobile), against **S3's real endpoints** | **Done** | S0, S3 | `06-sessions/milestone-2-s5-frontend-purchasing-hub-prompt.md` |
| S4 | Backend — goods receipts incl. signing, ledger write, latest-price costing (the riskiest session; own tests) | **Done** | S3 | `06-sessions/milestone-2-s4-backend-goods-receipts-prompt.md` |
| S6 | Frontend — Goods receipt entry + signed detail/print, against **S4's real endpoints**; needs S0's Sign sheet composite | **Done** — including the follow-up Receiving worklist/History redesign work (`06-sessions/milestone-2-s6-followup-receiving-history-handoff.md`) | S0, S4 | `06-sessions/milestone-2-s6-frontend-goods-receipt-prompt.md` |
| S7 | Backend — supplier invoices (bundling, disputes) + payments (allocation, overpayment, reversal) + what-we-owe/how-overdue read models | **Done** (2026-09-18) — `pnpm build` + `pnpm test` clean, 814/814 tests pass including the three-way what-we-owe reconciliation test and aging-bucket boundary tests | S4 | `06-sessions/milestone-2-s7-backend-invoices-payments-prompt.md` |
| S8 | Frontend — Suppliers screen (what we owe), Supplier detail, Record invoice, Record payment (desktop + mobile), against **S7's real endpoints** | **Done** (2026-09-18) — required a same-day backend amendment first: `GET /inventory/ap/suppliers/:id` was missing `paymentDays`/profile fields and purchase history (no schema/contract test existed for it at all), and `listSupplierAp` accepted but never applied `limit`/`cursor`. All three closed in `receiving-validators.ts`/`receiving-repository.ts`/`receiving-service.ts` (see file header for the amendment record) before the four screens were built. `backend`: `pnpm build` + `pnpm test` clean, 816/816 passing (2 new contract tests). `frontend`: `pnpm build` clean; real-browser verified (Playwright) — full invoice+payment round trip incl. a real mismatch/dispute and a real overpayment, cross-screen reconciliation confirmed by eye, `STORE_ATTENDANT` 403 → real `PermissionDeniedState` (required fixing a `middleware.ts` route guard that was silently redirecting Attendants away from `/app/inventory/suppliers` before the page could even render the denial card), duplicate-invoice-number/receipt-already-invoiced/cross-supplier failure paths confirmed with specific backend error text surfaced, not a generic toast. | S0, S7 | `06-sessions/milestone-2-s8-frontend-suppliers-screen-prompt.md` |
| S9 | Integration (playbook Step 8) — wire real backend, run Flows 1, 2a, 2b, 2d, 2e, 14, 15, 16 end to end | Not started | S3–S8 | not yet drafted |

**S0 exists because of a real gap, and I am naming it rather than assuming it
away.** Milestone One's Step 5 could plan against an already-verified
component inventory (verified by eye against Paper, per `04-components.md`'s
verification standard). `04-components.md` has **no Milestone Two
section** — confirmed this session. Of the three options the brief offered
(this session's output / a named Step-7 prerequisite / folded into the first
frontend session), **I recommend the named prerequisite session (S0)** and did
not fold it into S5: the inventory spans eight screens across two frontend
sessions (S5/S6 and S8), so folding it into S5 would make S8 silently depend on
work done under another session's scope — the exact ambiguity the brief warns
about. It is not this session's own output because building components is Step
4 work requiring live by-eye verification against running code (plus
`get_computed_styles` for exact values), not planning.

**`X7O-0` (Mobile Universal States) belongs to S5** — the first session that
ships a mobile screen needing a real empty/loading/error state (`WUL-0`,
`WSO-0`). Per `04-components.md` it goes in
`frontend/components/app/shell/mobile-states.tsx` as cross-feature shell, not
under the feature, and gets verified by eye against a running screen
rather than in isolation. S0 lists it; S5 builds it. It is not a separate
untracked task.

---

## 6. Component inventory (detail for S0)

**This section replaces a 2026-09-16 draft that listed likely-new composites
from the screen walkthrough alone.** That was a guess, not an audit — the
playbook's Step 4 discipline is to check the actual codebase, the same way
Milestone One did before writing its own component table. I've now read
`frontend/components/ui2/`, `frontend/components/app/shell/`, and
`frontend/features/inventory/components/` directly (`find` + reading exports),
not from memory of the screens. The table below is what S0 should start from,
not redo.

### 6.1 Reusable as-is — no new build, no re-diff

Per playbook §4's reuse rule, a primitive/composite already built and verified
for Milestone One is *referenced*, not rebuilt, by a later milestone that needs
the same thing.

| Component | File | Why it fits Milestone Two unchanged |
|---|---|---|
| KPI Strip | `features/inventory/components/kpi-strip.tsx` | Takes `KpiCellData[]` generically — already data-driven, not hard-coded to Milestone One's cells. Fits the Purchasing hub's 4-tile strip and the Suppliers screen's 4-tile strip directly. |
| Drawer Shell | `features/inventory/components/drawer-shell.tsx` | Every Milestone Two drawer (New purchase, Record invoice, Record payment, New/edit supplier) is the same slide-over shell Milestone One's 4 drawers used. |
| Inventory Shell (sidebar + topbar) | `features/inventory/components/inventory-shell.tsx` | Same hub-org shell; Milestone Two adds nav items (Receiving, Purchasing, What we owe) but not a new shell. |
| Skeletons | `features/inventory/components/skeletons.tsx` | Loading-state skeletons are screen-mirroring per `04-components.md`'s placement rules — but the row/card primitives it composes from are reusable. |
| Supplier Form | `features/inventory/components/supplier-form.tsx` | New/edit supplier (`VU2-0`/`X6B-0`) is the **same fields** Milestone One built (name, contact, category, phone, email, payment-terms toggle) — confirmed by reading the artboard, not assumed. Zero new fields this milestone (Q3(b)'s `paymentDays`, if approved, is the one addition — see §6.3). |
| Table primitive | `components/ui2/table.tsx` | Underlies every list screen (Purchasing history, the Suppliers screen, Supplier detail invoice/payment lists). |
| Status Dot | `components/ui2/status-dot.tsx` | Every status label in this milestone (`Awaiting delivery`, `Overdue`, `Received — invoice pending`, `Unpaid`, `Disputed`, …) is dot + label — the same primitive Milestone One used. |
| Toggle Group | `components/ui2/toggle-group.tsx` | The payment-terms segmented toggle (`Invoice` / `Paid on delivery`) already exists as a generic two-state control — built for Milestone One's supplier form, reused verbatim on the New purchase, New Goods Receipt, and Edit supplier screens. |
| Search Input, Combobox, Select | `components/ui2/*.tsx` | Supplier/item pickers throughout. |
| Mobile Hub Header, Mobile Task Header, Mobile Status Bar | `components/app/shell/mobile-headers.tsx`, `mobile-status-bar.tsx` | Cross-feature shell; Milestone Two's mobile screens are the same header pattern with a new title/subtitle. |

### 6.2 Related, but not reusable as-is — build fresh, informed by the pattern

| Existing component | Where it falls short for Milestone Two | Decision |
|---|---|---|
| `restock-level-grid.tsx` | Single editable number per row (item, on-hand, one input). The Goods Receipt line grid needs qty **+** buy-unit chip **+** unit price **+** computed subtotal **+** an inline price-alert badge per row — a materially different shape, not a prop addition. | Build a new **Receipt Line Grid** composite. Use this file as the pattern reference for row layout and the below-threshold tone convention (`warning-fg` desktop / `error-fg` mobile — confirm whether the price-alert tone should follow the same platform split). |
| `shell-states.tsx` (`EmptyState`/`LoadingState`/`ErrorState`/`PermissionDeniedState`) | Fixed `320×220` desktop card — confirmed by reading the component, not the Paper screenshot. `X7O-0` composites the same four states with the Mobile Hub Header, a genuinely different layout at 390px, not a resize of the desktop card. | Desktop states: reuse as-is. Mobile: build `mobile-states.tsx` per the existing `04-components.md` entry for `X7O-0` — confirmed still not built. |

### 6.3 Genuinely new — not found anywhere in the codebase

| Composite | Screens | Paper reference | Notes |
|---|---|---|---|
| **Sign sheet (PIN entry + signature render)** | New Goods Receipt (sign & save), signed Goods Receipt detail | `UQE-0` mid-signature state (on the Store Manager page, not cloned to `C-0` — pull from there), `UVN-0`'s signature block | **Nothing exists for this anywhere in the codebase** — confirmed by `grep` across `features/` and `components/` for any sign/PIN/signature component; every hit was unrelated (`assign`, `design`, etc.). This is the single largest net-new build in the milestone: PIN entry, a locked/immutable post-sign state, and rendering a name in the signature font. |
| **Signature font token** | Same screens | `--font-signature: 'Alex Brush', cursive` (Paper's token list) | Declared in Paper's tokens, **not present in `frontend/app/tokens.wds.css`** — confirmed by grep. Needs adding (font load + token) before the Sign sheet can render a signature at all. This is a one-line gap worth calling out on its own, since it'll silently break the signature render if missed. |
| Receipt Line Grid | New Goods Receipt | `UQE-0` | See §6.2 — pattern-informed, not reused. |
| Bundling checkbox list | Record supplier invoice, Record supplier payment | `UZJ-0`, `V7Z-0` | Both screens use the identical pattern (checkbox rows + a running "selected total" that recomputes live) — build once, use twice. |
| Mismatch/dispute callout | Record supplier invoice | `UZJ-0` | Warning-toned callout with two action buttons (Hold / Record at billed). |
| "How overdue" bucket table | Suppliers screen | `VGE-0` | Five-column bucket table (five-bucket, §7 Q4) — a `Table` composition, not a new primitive. |
| "What we owe" bucket panel | Supplier detail | `VND-0` | Four-column variant of the same buckets (pending Q4) — build the one bucket-cell component both screens share, per §7 Q4's five-bucket recommendation, rather than two separate layouts. |
| Mixed-type Inbound/History row | Purchasing hub | `U7V-0` | Renders an `ExpectedDelivery` row and a `GoodsReceipt` row in the same table with different fields per type (§3.1) — a discriminated-union row renderer, not two tables. |
| Mobile universal states | Every Milestone Two mobile screen | `X7O-0` | Cross-feature shell (§6.2) — lands in `components/app/shell/`, not under the feature. |

### 6.4 How S0 builds each §6.3 item — the procedure, not just the list

Naming a composite as "genuinely new" isn't the deliverable — building it is,
and the playbook already specifies exactly how (§4, Step 4). Stating it here
so S0 doesn't have to infer it: for every row in §6.3, in this order —

1. **Add the base shadcn/ui primitive via its own CLI** where one applies
   (`npx shadcn@latest add <component>` into `components/ui2/`) — never
   hand-write a primitive shadcn already ships. Most of §6.3 is composites
   built *from* existing `ui2/` primitives (Table, Button, Input, Badge), not
   new primitives themselves — the Sign sheet is the one exception likely to
   need a new primitive (a PIN-entry input), checked at build time.
2. **Read the exact Paper node's computed styles** — `get_computed_styles`,
   `get_node_info`, `get_jsx` on the real artboard node, never a screenshot —
   and map every value to an existing design token. A screenshot verifies the
   result; it never supplies the numbers.
3. **Build the composite**, styled to those values, in
   `frontend/features/inventory/components/` (or `components/app/shell/` for
   the two cross-feature items — Sign sheet's font token and Mobile Universal
   States).
4. **Verify it by eye against Paper** — `get_screenshot` of the Paper node vs.
   a screenshot of the running component, plus `get_computed_styles` for
   exact values — before marking it done. **The automated `pnpm
   visual-diff`/`pixelmatch` script is banned project-wide** (owner decision
   2026-09-16). This is the same by-eye standard `04-components.md`
   §"Verification standard: by-eye + computed-styles" already defines; S0
   doesn't invent a new one.
5. **Log it in `04-components.md`'s Status table**, the same live build log
   Milestone One's composites are recorded in, with its Paper reference and
   diff result — so Milestone Three's Step 5 planner can do what this session
   couldn't: plan against an already-verified inventory instead of auditing
   the codebase from scratch.

Two items in §6.3 need something *before* step 1 can even start:

- **Sign sheet** — its populated/mid-signature states aren't cloned onto page
  `C-0` at all; they live on the Store Manager desktop page
  (`4-0`, e.g. `UQE-0`'s mid-signature equivalent there). S0 goes and reads
  that page first.
- **Signature font token** — `--font-signature: 'Alex Brush', cursive` exists
  in Paper's token list but not in `frontend/app/tokens.wds.css` at all
  (confirmed by grep, not assumed). S0 adds the font load + token before
  building anything that renders a signature — otherwise the Sign sheet and
  the signed Goods Receipt detail both silently fall back to a default font
  with no build error, the same class of gap `FEATURE_REDO_PLAYBOOK.md` §9
  warns about for missed config wiring.

### 6.5 What this changes about the session breakdown

S0 (§5) now has a concrete, checked scope rather than a guess: five genuinely
new composites/tokens (6.3), two adapted-from-pattern (6.2), and confirmation
that everything else reuses Milestone One's set unchanged (6.1). **The Sign
sheet is the one item here big enough to worry about the S0/S4/S6 dependency
chain** — S4 (backend signing endpoint) and S6 (frontend receipt entry +
detail) both need it, and it touches a design-system-level gap (the font
token) that's easy to discover late if S0 doesn't build it first. S0's own
scope should explicitly include reading the Store Manager page's
mid-signature artboard for the Sign sheet (it's not cloned onto page `C-0`)
before starting.

**Related follow-up, already logged:** `04-components.md`'s owner follow-up
wants a "Last price" column on the Item Catalog Table. The
`GET /inventory/items/:id/last-price` endpoint in §3.2 is its natural source.
It is a Milestone One table fix and does not block this milestone — but S0
should not re-derive it from scratch.

---

## 7. Questions for the owner — RESOLVED 2026-09-16

All six went with the stated recommendation, owner-approved as the default.
Kept here as the record of what was decided and why; §1–§6 above already
reflect the resolutions.

**Q1 — `IN TRANSIT` is dropped.** The
Purchasing hub (`U7V-0`, `WUL-0`) showed a fourth KPI, `IN TRANSIT 0 ·
"nothing on the road"`. Confirmed: every purchase in this milestone goes
straight from `AWAITING` to `RECEIVED_*` in one step (Flow 2 — there is no
dispatched-but-not-arrived checkpoint for an inbound supplier delivery); the
concept belongs to Milestone Five's branch dispatch, a different flow
entirely (stock leaving the Central Store, not arriving at it). The KPI strip
is **three tiles** this milestone (Expected, Awaiting invoice, Owed), not
four. `PurchasingSummarySchema.inTransit` is removed from the contract (§3.2);
Paper's `U7V-0`/`WK4-0`/`WPL-0`/`WUL-0` artboards should drop the fourth tile
before S5 builds against them.

**Q2 — resolved: `UVN-0`'s damaged-goods line is stale, not a reversal.** The
signed-receipt artboard still has a line reading "Fresh Cream 250ml (2 damaged
— claim noted)" and a "Supplier claim" callout. `01-description.md` §3 Stage 2
and Flow 2c retired this on 2026-09-15 (*"no damaged-quantity field, no
supplier-claim note, and no print callout for damage on this screen"*). The
plan models no claim field (§1.2). **Action: `UVN-0` needs redrawing before S6
builds against it** — flag for the design pass.

**Q3 — resolved, two parts.**

  (a) *Naming — enum unchanged.* `INVOICE_TO_FOLLOW` / `PAY_NOW` stay as the
  enum values; Paper's "Invoice" / "Paid on delivery" are display labels only,
  applied at the presentation layer. Unlike Milestone One's `PASS_THROUGH` →
  `STOCKED` — where the owner had explicitly renamed the *concept* — nothing
  here says the concept changed, and "Invoice" alone would collide with the
  `SupplierInvoice` model this milestone introduces. No schema/code change.

  (b) *Due-date rule — `paymentDays` on `Supplier`.* Nothing previously
  determined when an invoice becomes overdue, though `VGE-0`'s aging columns
  are headed "DAYS OVERDUE". **Resolved: add `paymentDays: Int` to
  `Supplier`**, editable on the supplier form (`VU2-0`/`X6B-0`), defaulting a
  sensible value (e.g. 30) for existing suppliers. `SupplierInvoice.dueDate`
  is computed once at invoice creation as `invoiceDate + supplier.paymentDays`
  and stored (a due date must not silently shift if the supplier's terms
  change after the invoice is already on the books). This is now folded into
  §1 and §2 below as a real column, not an open question.

**Q4 — resolved: five-bucket how-overdue grouping, one shared bucket function.**
The Suppliers screen (`VGE-0`) used five buckets (CURRENT / 1-30 / 31-60 / 61-90 / 90+);
Supplier detail (`VND-0`, `VU2-0`) used four (merging the last two); Flow 16's
prose implied a third grouping. **Five buckets is now the single source of
truth** — `AgingBucketsSchema` (§3) already reflects this. The detail panel
merges 61-90 and 90+ for display only; the underlying data is never
four-bucket. `02-flows.md` Flow 16 should be corrected to match on the next
docs pass (non-blocking, noted here so it isn't lost).

**Q5 — resolved: model the credit correctly, no UI this milestone.** The
`VND-0` overpayment case (a payment larger than the invoice it's allocated to)
is handled correctly by the data model (§1.4 — credit is
`Σ payments.amount − Σ allocations.amount`, always derivable) but gets **no
dedicated screen or indicator in Milestone Two**. Flagged for the
Reports/reconciliation pass to surface.

**Q6 — resolved: the Flow 17 reconciliation workspace stays out of scope.**
`VND-0`'s "Reconcile statement" button has no screen behind it this milestone
and stays inert/hidden. The adjustment endpoint (§3.2) is scoped **in**, since
without it a dispute opened by Flow 14 has no way to close.

---

## 8. Test classification

Per playbook §5 and `TDD.md`. There is no prior Milestone Two build, so this is
overwhelmingly "new tests required".

**Keep, unchanged.** All of Milestone One's suites. I verified this session that
**no live test references the dropped `PurchaseOrder`/`SupplierInvoice`/
`SupplierPayment` shapes** — `grep` across `backend/src` found those names only
in historical migration SQL (immutable) and in the schema's own comments about
the orphaned columns. So nothing goes stale when this milestone lands models
under the same names.

**Watched, resolved.** `inventory-service.test.ts` and
`inventory-contract.test.ts` reference `defaultPaymentTerms:
'INVOICE_TO_FOLLOW'`. Q3(a) resolved as no rename (§7), so these needed no
change. Q3(b) added `paymentDays` to `Supplier` (§1.3, §2) — confirmed during
S7 that the existing supplier fixtures and contract test still pass
unmodified against the new column (it carries a default, so old fixtures
that don't set it explicitly remain valid).

**New — backend.** Per-model unit tests, plus specifically:
- **Signing writes the ledger exactly once, atomically** — including that a
  failure mid-transaction leaves no `RECEIVE` rows and the receipt in `DRAFT`.
- Latest-price costing updates `currentCost`, and buy→usage unit conversion is
  applied (the `18.0 kg` / `crate (12)` case from `UQE-0`).
- Price-alert snapshot persists the *previous* price and survives a later price
  change (the §1.2 reproducibility rule).
- `DRAFT` receipts write no ledger rows.
- Payment-terms branch: `PAY_NOW` creates no what-we-owe row; `INVOICE_TO_FOLLOW` puts the
  receipt in the invoice queue.
- Invoice bundling across multiple receipts; duplicate invoice number → 409;
  receipts from two different suppliers → 400.
- Partial payment → `PARTIALLY_PAID`; full → `PAID`; overpayment allowed and
  surfaces as credit; reversal restores the prior status.
- How-overdue buckets, including boundary days (0, 1, 30, 31, 90, 91).
- **The three what-we-owe views reconcile** — one test asserting the Suppliers-screen row, the
  supplier-detail panel, and the invoice list agree for the same supplier. This
  is the §1.5 invariant and the cross-check that motivated deriving it.

**New — RBAC/tenancy (required by `CODING_STANDARDS.md` §8).**
- `STORE_ATTENDANT` → 403 on every what-we-owe endpoint, and the worklist response
  **omits money fields** (§3.1) rather than merely hiding them client-side.
- `ACCOUNTANT` can post payments/adjustments but **cannot** sign a receipt or
  write stock (Flow 15's separation-of-duties rule).
- Cross-org isolation on every new endpoint; hub-org scoping per D-15.

**New — frontend.** Per-screen by-eye comparison against the `C-0`
artboards (playbook Step 7 — not the banned automated `pnpm visual-diff`
script, owner decision 2026-09-16), plus the mobile screens against `X7O-0`
states.

---

## 9. Structure

Backend: `backend/src/modules/inventory/` — extended, not duplicated.
Milestone One's `inventory-*` files stay; this milestone adds
`receiving-routes.ts`, `receiving-controller.ts`, `receiving-service.ts`,
`receiving-repository.ts`, `receiving-validators.ts`, `receiving.types.ts` and
their tests in the same module folder, wired through `routes/index.ts`.

Frontend: `frontend/features/inventory/` — new components under
`components/screens/`, hooks, and services alongside Milestone One's, exported
through the existing `index.ts`. Pages in `app/` stay thin routing shells.
`X7O-0` is the exception that lands in `components/app/shell/` (§5).

**Retirement plan: nothing to retire.** Milestone One already dropped the old
purchase-order/supplier-invoice code and tables. This milestone only adds.
