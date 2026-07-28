# Inventory Phase 1 — Session Plan (Living File)

This file is the session-by-session implementation plan for **Phase 1 (Central
Store)** of the Inventory feature. It exists because Phase 1 is too large for
one session and will be built across multiple, strictly sequential sessions —
**no parallel sessions.** This file is how each session hands off to the next.

The feature spec (the "what" and "why") lives in
`docs/context/INVENTORY-FEATURE/INVENTORY_FEATURE_PLAN.md` — read that in
full before touching any session below; it is not duplicated here. This file
is only the "who does what, in what order, and what's already done."

All inventory-related docs live together in `docs/context/INVENTORY-FEATURE/`
— this session plan, the feature spec, and the client reference photos in
`inventory-real-data/`. Any new inventory doc (design notes, phase-2 planning,
etc.) should go in that same folder, not loose under `docs/context/`.

---

## Read This First (every session, in this order)

1. `CLAUDE.md` — non-negotiables, project structure.
2. `docs/context/INVENTORY-FEATURE/INVENTORY_FEATURE_PLAN.md` — full read, this is the spec.
3. **This file's Status table below** — find the first session that is not
   `Complete`. That is your session.
4. That session's own **Scope** section only, plus the **As Built** section
   of every prior `Complete` session (short — they're handoff notes, not
   essays).
5. The **Deviations from Plan** log at the bottom, if any entry references
   your session number.

Do not start a session whose Status is not `Not Started`. Do not start a
session if an earlier session is not `Complete`. If you finish a session
only partially, mark it `Blocked` (not `Complete`) and write exactly what's
left in that session's As Built section — the next agent to pick it up
(possibly you, in a new context) resumes from that note, not from scratch.

---

## Status

| # | Session | Depends On | Status |
|---|---|---|---|
| 1 | Schema + migration | — | Complete |
| 2 | Costing & ledger core (backend) | 1 | Not Started |
| 3 | CRUD backend: Catalog, Suppliers, PO, Receiving | 2 | Not Started |
| 4 | CRUD backend: Prep, Stock Count, Waste, Supplier AP | 2 | Not Started |
| 5 | RBAC audit + Reports + test hardening | 3, 4 | Not Started |
| 6 | Frontend: Attendant mobile screens | 5 | Not Started |
| 7 | Frontend: Manager desktop screens | 5 | Not Started |
| 8 | Frontend: Manager mobile screens | 7 | Not Started |
| 9 | Integration pass + Gate prep | 6, 7, 8 | Not Started |

Update the Status column the moment a session starts (`In Progress`) and the
moment it ends (`Complete` or `Blocked`). This table is the first thing every
agent reads — keep it accurate above all else in this file.

---

## Session 1 — Schema + Migration

**Depends on:** nothing. **Blocks:** everything.

### Scope
- Add to `backend/prisma/schema.prisma`:
  - `Location` (own entity — **not** `Organization.isHub`, see feature plan
    D-1). Phase 1 creates exactly one row, type `CENTRAL_STORE`.
    `organizationId` required (D-10).
  - `InventoryItem` — name, `type` enum (`RAW`/`PREPPED`/`PASS_THROUGH`),
    buyUnit, usageUnit, conversionFactor, reorderLevel, department tags
    (captured now, unused until Phase 2), currentCost, organizationId.
  - `Supplier`, `SupplierItem` (default-supplier-per-item join).
  - `PurchaseOrder` + `PurchaseOrderLine` (status: `DRAFT`/`SENT`/
    `PARTIALLY_RECEIVED`/`CLOSED`/`CANCELLED`).
  - `SupplierInvoice`, `SupplierPayment` (§4a of feature plan).
  - `PrepRecipe` + `PrepRecipeLine` (optional, Manager-authored).
  - `PrepRecord` + `PrepRecordLine` (actuals-first, D-12 — mandatory entry).
  - `StockCount` + `StockCountLine` (expectedQty column exists in schema;
    D-14 hiding is enforced in Session 4's service layer, not here).
  - `WasteLog`.
  - `InventoryTransaction` — ship the **full** ledger enum now (`receive`,
    `prep_consume`, `prep_produce`, `waste`, `adjustment`, `dispatch_out`,
    `dispatch_in`, `market_receive`, `sale`) even though only the first five
    are used in Phase 1 — see feature plan §1 table. Do not add the later
    ones "when needed"; add them now so Phase 2/3 never touch this enum.
  - Add `STORE_MANAGER`, `STORE_ATTENDANT` to `UserRole` enum.
- One `prisma migrate dev --name inventory_phase1_schema`, migration file
  committed.
- **No services, controllers, routes, or frontend code this session.**
- `pnpm build` in backend must pass (schema compiles, Prisma client
  generates) before marking Complete.

### As Built

Completed 2026-07-28. Migration file:
`backend/prisma/migrations/20260728101631_inventory_phase1_schema/migration.sql`.

All models from the Scope section were added to `backend/prisma/schema.prisma`
largely as specified, with these naming/shape notes for later sessions:

- **`Location`** — added `LocationType` enum (`CENTRAL_STORE` / `BRANCH_DEPARTMENT`)
  rather than a bare string, so Phase 2's per-department rows are typed from
  day one. Phase 1 seeding (Session 3+) should create exactly one
  `Location` row with `type: CENTRAL_STORE`.
- **Department tags** — modeled as `departmentTags DepartmentTag[]` (native
  Postgres enum array) on `InventoryItem`, not a join table. `DepartmentTag`
  enum has the five values (`KITCHEN`, `PASTRY`, `BARISTA`, `SERVICE`,
  `HOUSEKEEPING`). No `Department` entity exists yet — Phase 2 will decide
  whether department rows need their own table beyond `Location`.
- **`SupplierItem`** is the default-supplier-per-item join table (name chosen
  over `SupplierInventoryItem` for brevity); carries `isDefault` + `lastPrice`.
- **`PurchaseOrderLine`** carries both `unitPrice` (PO-time price) and
  `invoicePrice` (nullable, filled at receiving) plus `receivedQty` — Session
  3's receiving flow writes `receivedQty`/`invoicePrice`/`receivedAt` on
  receipt and leaves `unitPrice` as the original PO price for variance.
- **`PrepRecipe.promotedFromId`** is a unique FK back to the `PrepRecord` it
  was promoted from (nullable — most `PrepRecipe` rows, if any exist in v1,
  will trace back to one). `PrepRecord.promotedTo` is the reverse one-to-one.
- **`StockCountLine.expectedQty`/`countedQty`/`gapQty`** are all nullable
  Decimals, present in schema per D-14 but with **no hiding logic** — that's
  explicitly Session 4's job at the service/API layer, not this migration.
- **`InventoryTransaction`** ships the full 9-value `InventoryTransactionType`
  enum now (`RECEIVE`, `PREP_CONSUME`, `PREP_PRODUCE`, `WASTE`, `ADJUSTMENT`,
  `DISPATCH_OUT`, `DISPATCH_IN`, `MARKET_RECEIVE`, `SALE`) per plan — only the
  first five are written by Phase 1 logic (Session 2+), the rest are reserved.
  The transaction row carries optional back-links (`purchaseOrderLineId`,
  `prepRecordId`, `wasteLogId`, `stockCountLineId`) for audit traceability;
  note only `prepRecordId` and `wasteLogId` got actual FK constraints in this
  migration (`purchaseOrderLineId`/`stockCountLineId` are plain columns, no FK)
  — Session 2 should decide if those need FKs added or stay soft references.
- **Roles**: `STORE_MANAGER` and `STORE_ATTENDANT` added to `UserRole` enum,
  additive only.
- **Costing fields** (`InventoryItem.currentCost`, `PrepRecord.unitCost`,
  `PrepRecordLine.unitCost`) exist in schema now but are unpopulated by any
  logic — Session 2 owns the weighted-average/prep-cost calculations.

**Deviation logged — see Deviations log below**: the local dev database had
stray tables/enums left over from the discarded prototype build (branch
`proto/inventory-phase1`, deleted 2026-07-28 per feature plan §10) that were
never rolled back locally even though the migration file itself was deleted
with the branch. This blocked `prisma migrate dev` and required manual
cleanup — documented in the Deviations log so later sessions aren't
surprised if they see references to it in history.

---

## Session 2 — Costing & Ledger Core (Backend)

**Depends on:** Session 1. **Blocks:** Sessions 3, 4.

### Scope
- `InventoryTransaction` repository + service — append-only writes, always
  atomic (`$transaction`) when paired with a stock mutation.
- Weighted-average costing (D-8): recompute `InventoryItem.currentCost` on
  every `receive` transaction.
- UOM conversion (D-7): buy unit → usage unit, applied consistently in cost
  and quantity displays.
- Prep costing (D-12): given a `PrepRecord`'s input lines + actual yield,
  compute `unitCost = totalInputCost / actualYield`; write `prep_consume`
  (per input) + `prep_produce` (output) atomically.
- Rolling-average soft-reference calc: average of the last N `PrepRecord`s
  for a given output item (for the "Typical: ~6kg → ~5.6kg" hint — Session
  6/7 UI consumes this, but the calc is a backend service function).
- **No controllers/routes yet.** Test these as services directly.
- Unit tests: weighted-average costing across multiple receives, prep cost
  rollup, UOM conversion edge cases (e.g. fractional usage-unit deduction).
- `pnpm build && pnpm test` clean before marking Complete.

### As Built
*(fill in when complete)*

---

## Session 3 — CRUD Backend: Catalog, Suppliers, PO, Receiving

**Depends on:** Session 2. **Blocks:** Session 5.

### Scope
- `InventoryItem` CRUD (Manager-only write, both roles read — §8.3).
- `Supplier` + `SupplierItem` CRUD (Manager-only write, both roles read).
- `PurchaseOrder` + lines: create (draft, both roles), send/cancel
  (Manager-only), low-stock-based "suggest order" prefill.
- Receiving flow: record actual qty + invoice price per PO line →
  `receive` transactions via Session 2's service. Partial receipt keeps PO
  open (`PARTIALLY_RECEIVED`).
- Full layering per CLAUDE.md: repository → service → controller (thin,
  Zod-validated) → route (`authenticate` + `requireRole` per §8.3) →
  validator.
- `pnpm build && pnpm test` clean before marking Complete.

### As Built
*(fill in when complete)*

---

## Session 4 — CRUD Backend: Prep, Stock Count, Waste, Supplier AP

**Depends on:** Session 2. **Blocks:** Session 5.

### Scope
- `PrepRecord` (+ optional `PrepRecipe` "promote" action, Manager-only edit)
  endpoints, using Session 2's costing service.
- `StockCount` endpoints: session creation (Manager-only), execution/submit
  (both roles), approval (Manager-only, posts `adjustment` transactions).
  **D-14 enforcement lives here**: the Attendant-authenticated response for
  a count session must omit `expectedQty` entirely at the API layer — write
  a test that asserts the field is absent (not just falsy) in an Attendant
  response.
- `WasteLog` entry (both roles) + review (Manager sees all; Attendant sees
  own entries only — confirm this default per §8.3 footnote, flag to user
  if full-log-for-Attendant is wanted instead).
- Supplier AP (§4a): `SupplierInvoice` create (Manager-only), `SupplierPayment`
  record (Manager-only), status derivation `UNPAID → PARTIALLY_PAID → PAID`.
  Attendant gets **zero access**, not even read — test this explicitly (403
  on every AP route for an Attendant token).
- `pnpm build && pnpm test` clean before marking Complete.

### As Built
*(fill in when complete)*

---

## Session 5 — RBAC Audit + Reports + Test Hardening

**Depends on:** Sessions 3, 4. **Blocks:** Sessions 6, 7.

### Scope
- Line-by-line audit of every Phase 1 route against the §8.3 permissions
  matrix in the feature plan — treat that table as the literal spec, not a
  guideline. Fix any route that doesn't match exactly.
- Reports endpoints: stock valuation (qty + value), low-stock alerts, price
  history per item/supplier, prep yield by output item/run, count
  discrepancy, true cost per prepped item, supplier AP aging. Manager-only
  (§8.3).
- Close any test gaps found during the audit.
- End of this session: backend should be fully demoable via Postman/Thunder
  Client for every Phase 1 workflow. This is the checkpoint before any
  frontend work starts.
- `pnpm build && pnpm test` clean before marking Complete.

### As Built
*(fill in when complete)*

---

## Session 6 — Frontend: Attendant Mobile Screens

**Depends on:** Session 5. **Blocks:** Session 9.

### Scope
Per feature plan §8.2 — mobile-only, reuse the existing Waiter/Chef bottom-
tab nav pattern:
- Stock on Hand (read-only card list).
- Purchase Orders (draft-only — item picker, no send action visible).
- Receiving (prefilled qty from PO, invoice price entry, discrepancy
  highlight — target 15 lines under 3 minutes per feature plan).
- Prep entry (output picker → input lines, repeatable → actual yield →
  confirm; numeric keypad; soft-reference hint from Session 2's rolling
  average).
- Stock Count execution (blind — **verify the frontend never receives
  `expectedQty`** in the API response for this role, don't just hide it in
  the UI).
- Waste Log entry (3-tap: item, qty, reason picker, optional note).
- New Zustand slices per CLAUDE.md Frontend Hook Stability Rules — stable
  action selectors, no whole-store destructuring.
- `pnpm build` clean in frontend before marking Complete. Manually exercise
  each screen in-browser (mobile viewport) per CLAUDE.md's UI-testing rule.

### As Built
*(fill in when complete)*

---

## Session 7 — Frontend: Manager Desktop Screens

**Depends on:** Session 5. **Blocks:** Session 8, 9.

### Scope
Per feature plan §8.1 desktop column:
- Stock on Hand (ExcelTable, side-panel movement history).
- Item Catalog CRUD (ExcelTable inline edit + side-panel form).
- Suppliers CRUD + price history (reuse `PriceTrendChart`).
- Supplier Invoices/AP (table + totals-by-supplier + aging view, modals for
  record-invoice/record-payment).
- Purchase Orders list + send/cancel actions.
- Prep entry (Manager variant with running cost panel).
- Prep Recipe editor ("promote" a Prep Record — desktop-only, no mobile
  create/edit per feature plan).
- Stock Count session creation + approval (variance summary table).
- Waste Log review (filterable table).
- Reports dashboard (full ExcelTable-driven, exportable PDF/CSV per
  existing project convention).
- `pnpm build` clean before marking Complete. Manually exercise each screen
  in-browser (desktop viewport).

### As Built
*(fill in when complete)*

---

## Session 8 — Frontend: Manager Mobile Screens

**Depends on:** Session 7. **Blocks:** Session 9.

### Scope
Per feature plan §8.1 mobile column — genuinely separate designs from
Session 7, not a reflow:
- Mobile variants of every screen in Session 7 per the table (card lists,
  sparkline price history, compact AP status chips, step-by-step PO item
  picker, single-metric report summary cards with tap-through).
- Prep Recipe editor: view-only on mobile (no create/edit) — confirm this
  is still respected.
- Flag in As Built any report that's desktop-only in v1 (feature plan
  explicitly allows deferring full mobile report parity).
- `pnpm build` clean before marking Complete. Manually exercise each screen
  in-browser (mobile viewport).

### As Built
*(fill in when complete)*

---

## Session 9 — Integration Pass + Gate Prep

**Depends on:** Sessions 6, 7, 8.

### Scope
- End-to-end walkthrough of every Phase 1 workflow across both roles,
  desktop and mobile.
- Fix any seam issues between sessions (e.g. API shape drift between what
  Session 5 shipped and what Sessions 6-8 assumed).
- Seed realistic catalog/supplier data from the client's real stock list
  (see `docs/context/INVENTORY-FEATURE/inventory-real-data/`) to prepare for
  the Gate trial.
- Confirm the Gate criteria from feature plan §4 are achievable: ledger
  reconciles with a physical count, prices match invoices, staff can
  operate it unassisted.
- Update `docs/context/INVENTORY-FEATURE/INVENTORY_FEATURE_PLAN.md` Status
  section to mark Phase 1 checkbox complete, with date.
- Update `CLAUDE.md` "Current Phase" section to point at Phase 2.

### As Built
*(fill in when complete)*

---

## Deviations from Plan

Record here any point where a session discovered the Scope above (or the
feature plan itself) was wrong, so later sessions don't rediscover the same
issue. Format: **Session #, date — what changed and why.**

**Session 1, 2026-07-28 — stray local DB state from the discarded prototype
blocked migration generation.** The local dev Postgres (`wendo_rms`) still
had 15 `inventory_*` tables and several enums (`Department`,
`ProductionOrderStatus`, etc.) from the prototype build on the deleted
`proto/inventory-phase1` branch (feature plan §10). The migration file that
created them had been deleted along with the branch, so `prisma migrate
status` showed "up to date" while the live schema still had orphaned objects
— `prisma migrate dev` refused to proceed without a full `migrate reset`
(which would have wiped unrelated local dev data, so it was not used).
Resolved by manually dropping the 15 stray tables and 8 stray enum types,
generating the migration SQL via a disposable shadow database (`prisma
migrate diff` against a scratch DB seeded from the 48 real committed
migrations), and hand-applying the result. A partial first `migrate dev`
attempt also left the two new `UserRole` enum values (`STORE_MANAGER`,
`STORE_ATTENDANT`) applied to the live DB without the matching tables/other
enums — reconciled via `prisma migrate resolve --applied` after manually
finishing the DDL. Net effect: local `wendo_rms` and the committed migration
file both end up correct and consistent; no data was lost. Also noted in
passing, out of scope for this session: the local DB has a pre-existing,
unrelated drift on `payslips` column defaults (`id`, `nssf_tier1`,
`nssf_tier2`, `sha`) not caused by this work — flagged here in case Session 2
onward hits it during their own `migrate dev` runs.

---

*Created 2026-07-28. Companion to
`docs/context/INVENTORY-FEATURE/INVENTORY_FEATURE_PLAN.md` (the feature spec)
— this file is the session-sequencing/handoff mechanism only. Update the
Status table and per-session As Built sections as each session completes; do
not let this file drift out of sync with actual progress, since it is the
only thing the next session reads to know where to resume.*
