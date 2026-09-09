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
| 2 | Costing & ledger core (backend) | 1 | Complete |
| 3 | CRUD backend: Catalog, Suppliers, PO, Receiving | 2 | Complete |
| 4 | CRUD backend: Prep, Stock Count, Waste, Supplier AP | 2 | Complete |
| 5 | RBAC audit + Reports + test hardening | 3, 4 | Complete |
| 6 | Frontend: Attendant mobile screens | 5 | Complete |
| 7 | Frontend: Manager desktop screens | 5 | Complete |
| 8 | Frontend: Manager mobile screens | 7 | Complete |
| 9 | Integration pass + Gate prep | 6, 7, 8 | Complete |

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

Completed 2026-07-28. No schema changes — this session is service/repository
code only, per Scope. New files:

- `backend/src/repositories/inventory-transaction-repository.ts` — append-only
  `create`/`createMany` (both accept an optional `Prisma.TransactionClient`,
  defaulting to the singleton `prisma` client, matching the existing
  `house-account-repository.ts` pattern for atomic multi-write callers) plus
  `findByItemAndLocation` and `sumQuantityByItemAndLocation` (derives on-hand
  qty from the ledger — there is no mutable stock counter anywhere, per
  feature plan §1).
- `backend/src/repositories/inventory-item-repository.ts` — a deliberately
  narrow slice of `InventoryItem` access (`findById`, `updateCurrentCost`)
  scoped to what costing needs. **Full catalog CRUD is Session 3's job** —
  this file should not grow beyond costing's needs; Session 3 should add its
  own repository (or extend this one thoughtfully) rather than assuming this
  is the complete `InventoryItem` repository.
- `backend/src/utils/inventory-uom.ts` — pure UOM conversion helpers (D-7):
  `buyToUsageQty`, `usageToBuyQty`, `costPerUsageUnit`, `costPerBuyUnit`.
  Confirmed against the domain model doc (§6): `InventoryItem.currentCost` is
  stored **per usage unit**, buy-side quantities/prices come in per buy unit,
  so `conversionFactor` is usage units per one buy unit (e.g. buy in kg,
  usage in g → `conversionFactor = 1000`).
- `backend/src/services/inventory-transaction-service.ts` — the session's
  core deliverable:
  - `weightedAverageCost(onHandQty, oldAvgCost, incomingQty, incomingUnitCost)`
    — pure function (exported for direct unit testing), D-8. Falls back to
    the incoming unit cost whenever prior on-hand is zero or negative (first
    receive, or a corrected/negative balance), rather than blending against a
    meaningless base.
  - `recordReceive(...)` — one `receive` transaction per PO/delivery line.
    Converts buy-unit qty/price to usage-unit qty/cost via the UOM helpers,
    reads current on-hand (summed from the ledger) and current cost, computes
    the new weighted average, and writes the transaction row +
    `InventoryItem.currentCost` update inside one `prisma.$transaction`.
  - `recordPrep(...)` — D-12. Validates every input line and the output item
    exist and yield/quantities are positive, computes
    `totalInputCost = Σ(inputQty × inputItem.currentCost)` and
    `unitCost = totalInputCost / actualYield`, then in one `$transaction`:
    creates the `PrepRecord` + `PrepRecordLine` rows, writes one
    `PREP_CONSUME` transaction per input (negative quantity) and one
    `PREP_PRODUCE` transaction for the output, and rolls the output item's
    `currentCost` into its weighted average against whatever was on hand
    *before* this run (read once, before any writes, to avoid having to
    subtract this run's own `prep_produce` back out).
  - `getRollingAverageForOutputItem(organizationId, outputItemId, sampleSize)`
    — averages `actualYield` and total input quantity across the last N
    `PrepRecord`s (default N=5) for a given output item, most-recent first.
    Returns `{ sampleCount: 0, avgTotalInputQty: null, avgActualYield: null }`
    when there's no history yet. This is the backend half of the "Typical:
    ~6kg → ~5.6kg" hint — Sessions 6/7 wire it into the Prep entry UI.
- Tests: `inventory-transaction-service.test.ts` (18 cases — weighted-average
  math incl. the zero-on-hand and negative-on-hand fallback cases, multi-receive
  blending, buy→usage conversion on receive, prep cost rollup incl. rolling the
  output item's own cost into a weighted average against prior on-hand stock,
  validation errors, rolling-average calc incl. the empty-history case) and
  `inventory-uom.test.ts` (8 cases — incl. fractional usage-unit deduction
  such as 200ml off a litre-bought item, non-integer buy quantities, and a
  conversion factor that doesn't divide evenly, to confirm Decimal precision
  is preserved rather than silently truncated).
- No controllers, routes, or Zod validators — out of scope per this session,
  confirmed against feature plan §8.3 (Sessions 3/4 own the HTTP layer).
- `organizationId` scoping: every repository read/write in this session's
  code takes `organizationId` and passes it to Prisma's `where`, per
  CLAUDE.md non-negotiable #3. `sumQuantityByItemAndLocation` and
  `findById` both scope by it explicitly rather than trusting a caller-passed
  `locationId`/`inventoryItemId` alone.
- `pnpm build` and `pnpm test` both clean (484 tests passing across the
  backend suite, including this session's 26 new tests). See Deviations log
  for a note on how `pnpm build` was actually invoked in this sandbox.

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

Completed 2026-07-28. Full repository → service → controller → route →
validator stack for Item Catalog, Suppliers/SupplierItem, and PurchaseOrder
(+ receiving), following `customer-credit-*` as the structural reference per
the session brief. New files:

**Repositories**
- `backend/src/repositories/inventory-item-repository.ts` — **extended**
  Session 2's narrow costing-only file in place (decision below) rather than
  adding a separate catalog repository. Added `findAllByOrganization`,
  `findLowStock` (filters a pre-fetched item list against a caller-supplied
  on-hand map — see service layer), `create` (with an inline optional
  `defaultSupplierId` → nested `SupplierItem` create), `update`
  (`updateMany` + not-found-check pattern, per `customer-credit-repository`),
  and `deactivate` (soft delete, calls `update` with `isActive: false`).
  Session 2's `findById`/`updateCurrentCost` untouched.
- `backend/src/repositories/supplier-repository.ts` (new) — `Supplier` CRUD
  (same `updateMany`+recheck pattern) plus the `SupplierItem` join-table
  operations: `findSupplierItem`, `findItemsForSupplier`,
  `findSuppliersForItem`, `assignSupplierItem` (transactional — unsets any
  other default for that item first if `isDefault: true`, then
  upserts), `removeSupplierItem`, `findDefaultSupplierForItem`.
- `backend/src/repositories/purchase-order-repository.ts` (new) —
  `PurchaseOrder` + `PurchaseOrderLine` access: `findAllByOrganization`,
  `findById` (both with `lines`+`inventoryItem`+`supplier` includes),
  `create` (nested `lines: { create: [...] }`, one call, per the
  `recordPrep`-style "parent + child lines" pattern), `transitionStatus`
  (generic `updateMany` scoped by `id` + `organizationId` + `status: { in:
  fromStatuses }` → `toStatus`, returns a boolean so the service can
  distinguish "not found" from "wrong status" — i.e. 404 vs. 409),
  `updateLineReceipt` (increments `receivedQty`, sets `invoicePrice`/
  `receivedAt`), `findLineById`.

**Services**
- `backend/src/services/inventory-item-service.ts` — `list`, `getById`,
  `create` (validates `defaultSupplierId` resolves to a real supplier before
  creating), `update`, `deactivate`, and `listLowStock(actor, locationId)` —
  sums on-hand per active item via Session 2's
  `inventoryTransactionRepository.sumQuantityByItemAndLocation` (the plan
  brief referred to this as `sumQuantityByLocation`; the actual Session 2
  export is `sumQuantityByItemAndLocation` — used as built, not renamed),
  then filters to items at/under `reorderLevel`. No second stock counter
  anywhere in this file.
- `backend/src/services/supplier-service.ts` — `list`, `getById`, `create`,
  `update`, `deactivate`, `getItemsForSupplier`, `assignSupplierItem`
  (validates both supplier and item exist first), `removeSupplierItem`.
- `backend/src/services/purchase-order-service.ts` — `list`, `getById`,
  `create` (validates supplier + every line's item exist; generates
  `poNumber` locally — see Deviations log), `send` (DRAFT→SENT,
  Manager-only, enforced at the route), `cancel` (DRAFT/SENT→CANCELLED),
  `suggestOrderLines(actor, locationId)` (low-stock items via the same
  ledger-derived on-hand approach, suggests topping up to 2× reorderLevel —
  a simple, explainable default, not a forecasting model), and
  `receiveLine` — the receiving flow. **Calls
  `inventoryTransactionService.recordReceive` directly** (Session 2's
  service, unmodified) for the ledger write + weighted-average cost update,
  then in a **separate** `prisma.$transaction` updates the PO line's
  `receivedQty`/`invoicePrice` and recomputes PO status: all lines'
  `receivedQty >= orderedQty` → `CLOSED` (+ `closedAt`), otherwise →
  `PARTIALLY_RECEIVED`. See Deviations log for why this is two transactions,
  not one nested transaction.

**Controllers/Routes/Validators** — one set per entity
(`inventory-item-*`, `supplier-*`, `purchase-order-*`), following
`customer-credit-controller.ts`'s shape exactly (`requireActor` helper,
`.parse()` inline, `{ success, data, message? }` response, no manual
try/catch — Express 5 auto-forwards rejected promises). RBAC per §8.3,
applied literally:
- Item Catalog: view (`GET /inventory-items`, `/inventory-items/:id`,
  `/inventory-items/low-stock`) — both roles. Create/update/delete
  (`POST`/`PATCH`/`DELETE /inventory-items/:id`) — `STORE_MANAGER` only.
- Suppliers: view (`GET /suppliers`, `/suppliers/:id`, `/suppliers/:id/items`)
  — both roles. Create/update/delete + assign/remove supplier-item — Manager
  only.
- Purchase Orders: view + create (draft) — both roles. Send/cancel — Manager
  only. Receiving (`POST /purchase-orders/:id/lines/:lineId/receive`) — both
  roles (per the Session 3 brief's explicit "Manager-only write, both roles
  read... Receiving flow" language treating receiving as an operational task,
  matching §8.3's "Receiving | Record quantity + invoice price | ✅ | ✅").
- Route params validated with local Zod UUID schemas
  (`InventoryIdParamSchema`, `SupplierIdParamSchema`,
  `PurchaseOrderIdParamSchema`, etc.) per-file, matching the codebase's
  existing convention of no shared UUID-param middleware.
- All routes registered in `backend/src/routes/index.ts`
  (`inventory-item-routes`, `supplier-routes`, `purchase-order-routes`).

**Decision — narrow repository extended, not split (per the brief's
"decide and document" instruction):** Session 2's
`inventory-item-repository.ts` was **extended in place**, not superseded by
a separate catalog repository. Rationale: it's the same Prisma model
(`InventoryItem`), the same `organizationId`-scoping rules, and Session 2's
two methods (`findById`/`updateCurrentCost`) are a strict subset of what
catalog CRUD needs — a second repository would just be two files racing to
stay in sync on one table. Session 2's methods are untouched; only new
methods were added.

**`currentCost` is never client-settable:** `CreateInventoryItemSchema`/
`UpdateInventoryItemSchema` (validators/inventory-item-schemas.ts) have no
`currentCost` field at all, so it cannot reach the service even if a client
sends it — confirmed by an explicit test
(`tests/inventory-item.test.ts` → "currentCost is never accepted from the
client").

**Delete is soft delete everywhere, not a hard delete:** `InventoryItem` and
`Supplier` "delete" routes call `deactivate` (`isActive: false` via
`updateMany`), never `prisma.*.delete`. This was surfaced explicitly to the
project owner mid-session (they want Manager-level self-service undo for
mistakes without calling the developer) — hard delete was ruled out because
receiving/prep/PO-line rows hold FKs into `InventoryItem`/`Supplier`, so
deleting the row would corrupt historical cost/ledger data. A mistaken
Purchase Order is handled the same way conceptually: there's no PO "delete"
at all, only `cancel` (a status transition with an audit trail), which is
the equivalent instant, non-destructive undo for that entity.

**Test coverage** (all in `tests/inventory-item.test.ts`,
`tests/supplier.test.ts`, `tests/purchase-order.test.ts`, plus a
service-level `src/services/purchase-order-service.test.ts` for the
receiving-delegates-to-Session-2 assertion): RBAC 403/401 per §8.3 for every
route, happy-path CRUD, 400s for missing/invalid fields and empty
update-bodies, PO status transitions (DRAFT→SENT, DRAFT/SENT→CANCELLED,
wrong-status→409, unknown-id→404), partial receipt→`PARTIALLY_RECEIVED` and
full receipt→`CLOSED`, and a dedicated test asserting
`purchaseOrderService.receiveLine` calls
`inventoryTransactionService.recordReceive` with the expected args and never
calls `inventoryItemRepository.updateCurrentCost` directly (proving
`currentCost` changes only as `recordReceive`'s own side effect, not
reimplemented here).

`pnpm test` equivalent (`npx vitest run`, per Session 2's documented
`ERR_PNPM_IGNORED_BUILDS` workaround — same sandbox issue, same fix): **544
tests passing** across 52 files (60 new tests this session, up from
Session 2's 484 across 48 files). `npx tsc -p tsconfig.json --noEmit` clean.

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

Completed 2026-07-28. Full repository → service → controller → route →
validator stack for PrepRecord (+ optional PrepRecipe promote), StockCount,
WasteLog, and Supplier AP (SupplierInvoice/SupplierPayment), following
Session 3's `customer-credit-*`/`purchase-order-*` structural conventions
(repository `updateMany` + not-found-check, thin Zod-validated controllers,
local per-file UUID param schemas, `{ success, data, message? }` response
shape). New files:

**Repositories**
- `backend/src/repositories/prep-record-repository.ts` (new) — `PrepRecord`
  read access (`findAllByOrganization`, `findById`, both with output item +
  input lines included) plus `PrepRecipe` access
  (`findAllRecipesByOrganization`, `findRecipeById`,
  `createRecipeFromRecord` — the "promote" write). Deliberately has no
  `create` for `PrepRecord` itself: Session 2's
  `inventoryTransactionService.recordPrep` already creates the `PrepRecord`
  + lines as part of its own atomic transaction, so this repository only
  ever reads records back, never writes them.
- `backend/src/repositories/stock-count-repository.ts` (new) — `StockCount`
  + `StockCountLine` access: `findAllByOrganization`, `findById`, `create`
  (nested line create, `expectedQty` passed in per line), `transitionStatus`
  (same generic scoped-`updateMany` + returns-boolean pattern as
  `purchase-order-repository.transitionStatus`), `updateLineCount`,
  `findLineById`. No blind-count logic here — D-14 hiding lives entirely in
  the service layer (see below), matching Session 1's As Built note that
  the schema carries `expectedQty` unconditionally.
- `backend/src/repositories/waste-log-repository.ts` (new) —
  `findAllByOrganization` (accepts an optional `loggedById` filter — this is
  how the service enforces Attendant's own-entries-only default, not a
  separate query path), `findById`, `create`.
- `backend/src/repositories/supplier-invoice-repository.ts` (new, **not**
  an extension of Session 3's `supplier-repository.ts` — see Decision
  below) — `SupplierInvoice` + `SupplierPayment` access:
  `findAllByOrganization`, `findById`, `create`,
  `updateAmountPaidAndStatus`, `createPayment`.

**Services**
- `backend/src/services/prep-record-service.ts` — `list`/`getById` (thin
  reads), `create` (**delegates entirely to Session 2's
  `inventoryTransactionService.recordPrep`** — never reimplements prep
  costing or the consume/produce transaction pair, confirmed by a
  service-level test asserting the exact call args and that the returned
  record's `unitCost`/`actualYield` are exactly what `recordPrep` produced),
  `getRollingAverage` (thin pass-through to Session 2's
  `getRollingAverageForOutputItem`), and the PrepRecipe promote path
  (`listRecipes`, `getRecipeById`, `promoteRecord` — Manager-only at the
  route, copies the source `PrepRecord`'s own input lines/output/yield onto
  the new `PrepRecipe`, defaulting `expectedYield` to the record's
  `actualYield` if not explicitly overridden).
- `backend/src/services/stock-count-service.ts` — `list`/`getById` (both
  run every result through `applyBlindCount`), `create` (Manager-only at the
  route; derives each line's `expectedQty` from Session 2's
  `sumQuantityByItemAndLocation` at session-creation time — never a second
  counter), `submitCounts` (both roles at the route; computes
  `gapQty = countedQty - expectedQty` and writes it regardless of caller
  role — the value is needed for Manager approval later, D-14 only governs
  what's returned in a response, not what's stored), `approve`
  (Manager-only at the route; posts one `ADJUSTMENT` transaction per line
  with a non-zero `gapQty`, skips zero-gap lines, using
  `inventoryTransactionRepository.create` directly since `adjustment` has
  no dedicated Session 2 costing function — it's a straight ledger write at
  the item's current cost).
  - **D-14 enforcement**: `applyBlindCount(count, actor)` deletes the
    `expectedQty` **and** `gapQty` keys (via object destructuring +
    rest-spread, not setting them to `null`/`undefined`) from every line
    when `actor.role === 'STORE_ATTENDANT'`, applied uniformly across
    `list`, `getById`, and the response of `submitCounts`. A dedicated test
    (`tests/stock-count.test.ts` and the service-level
    `stock-count-service.test.ts`) asserts
    `Object.prototype.hasOwnProperty.call(line, 'expectedQty') === false`
    for an Attendant response — not just a falsy check — confirming the key
    is actually absent from the serialized JSON, matching the letter of
    D-14 ("the API response itself omits `expectedQty`").
  - `gapQty` is hidden alongside `expectedQty` for the same caller, even
    though the plan text only names `expectedQty` explicitly — leaving
    `gapQty` visible would let an Attendant back-derive the hidden
    `expectedQty` (`expectedQty = countedQty - gapQty`) from their own
    submission, defeating the blind-count intent. Logged as a Deviation
    below since it's an interpretation, not literal text.
- `backend/src/services/waste-log-service.ts` — `create` (both roles;
  writes the `WasteLog` row and a `WASTE` ledger transaction — negative
  quantity, at the item's current cost — atomically in one
  `prisma.$transaction`), `list`/`getById` (Manager sees every entry;
  Attendant's `list` is filtered to `loggedById = actor.id` at the
  repository call, and `getById` additionally 404s — not 403s, to avoid
  confirming the entry exists — if an Attendant requests another user's
  entry by id).
  - **Visibility default resolved**: the feature plan's §8.3 footnote left
    "Attendant sees own entries only" as a recommended default pending
    client confirmation. Flagged to the project owner mid-session per the
    task brief's explicit instruction; owner confirmed **own-entries-only**
    is correct — shipped as specified, not a guess.
- `backend/src/services/supplier-invoice-service.ts` — `list`/`getById`/
  `create` (validates `supplierId`, and `purchaseOrderId` if provided,
  resolve to real rows first — same cross-entity FK validation pattern as
  Session 3's `purchase-order-service.create`), `recordPayment` (writes a
  `SupplierPayment` row and re-derives `SupplierInvoice.status` from
  `amountPaid` vs. `amount` in one transaction; rejects a payment against an
  already-`PAID` invoice). Status derivation
  (`UNPAID → PARTIALLY_PAID → PAID`) is a pure function of
  `amountPaid`/`amount` — `PAID` once `amountPaid >= amount`,
  `PARTIALLY_PAID` once `amountPaid > 0`, else `UNPAID` — recomputed fresh
  on every payment rather than incrementally tracked, so it can never drift
  out of sync with the actual sum of payments.

**Controllers/Routes/Validators** — one set per entity
(`prep-record-*`, `stock-count-*`, `waste-log-*`, `supplier-invoice-*`),
following `purchase-order-*`'s shape exactly. RBAC per §8.3, applied
literally:
- Prep: log a record — both roles. PrepRecipe view — both roles (Attendant
  view-only, no create/edit route exposed to it). PrepRecipe promote —
  `STORE_MANAGER` only.
- Stock Count: view + execute/submit — both roles. Session creation +
  approve — `STORE_MANAGER` only.
- Waste Log: log entry — both roles. View (list/getById) — both roles, but
  the *service* layer scopes what an Attendant actually sees (own entries
  only) rather than blocking the route itself.
- Supplier AP (`supplier-invoice-routes.ts`): **every single route** —
  list, getById, create, recordPayment — uses `managerOnly`. There is no
  "both roles" tier defined anywhere in this router, unlike every other
  Session 3/4 router, which is the literal shape of D-2/D-13/§8.3's "zero
  access, not even read-only." Verified by a dedicated test file
  (`tests/supplier-invoice.test.ts`) asserting 403 for an Attendant token on
  all four routes, grouped under its own `describe` block for visibility.
- Route params validated with local Zod UUID schemas per-file
  (`PrepRecordIdParamSchema`, `StockCountIdParamSchema`,
  `WasteLogIdParamSchema`, `SupplierInvoiceIdParamSchema`).
- All routes registered in `backend/src/routes/index.ts`
  (`prep-record-routes`, `stock-count-routes`, `waste-log-routes`,
  `supplier-invoice-routes`). `prep-record-routes.ts` registers
  `/prep-recipes` and `/prep-recipes/:id` **before** `/prep-records/:id`,
  matching Express's route-matching order, to avoid `/prep-recipes` being
  swallowed by the `:id` param route.

**Decision — Supplier AP gets its own repository, not an extension of
`supplier-repository.ts`** (per the brief's "decide and document"
instruction): unlike Session 3's `InventoryItem` catalog CRUD (the *same*
Prisma model Session 2 had already touched, extended in place),
`SupplierInvoice`/`SupplierPayment` are distinct models with their own
lifecycle (status derivation, payment history) and zero query overlap with
`Supplier`/`SupplierItem` CRUD. A new `supplier-invoice-repository.ts` file
was judged cleaner than growing `supplier-repository.ts` into a
grab-bag covering three unrelated tables. This mirrors Session 3's own
stated reasoning for the opposite call it made on `InventoryItem` — same
model, extend; different model, new file.

**`purchaseOrderLineId`/`stockCountLineId` FK question (flagged by
Sessions 2/3)**: this session **writes** `stockCountLineId` for the first
time (`stockCountService.approve`'s `ADJUSTMENT` transactions), still as a
plain string, no FK — consistent with the schema as Session 1 left it.
Left unresolved again, now for Session 5's RBAC/reports audit or later;
nothing in this session's scope included a migration step.

**Test coverage**: `tests/prep-record.test.ts`, `tests/stock-count.test.ts`,
`tests/waste-log.test.ts`, `tests/supplier-invoice.test.ts` (route-level:
RBAC 403/401 per §8.3 for every route including the full
Attendant-zero-access sweep on Supplier AP, happy-path CRUD, 400s for
invalid input, 409s for illegal status transitions) plus service-level
`prep-record-service.test.ts` (delegation-to-Session-2 proof, PrepRecipe
promote copying input lines), `stock-count-service.test.ts` (D-14 key-
absence proof at the service layer, approval posting exactly one
`ADJUSTMENT` per non-zero-gap line and skipping zero-gap lines), and
`waste-log-service.test.ts` / `supplier-invoice-service.test.ts` (own-
entries filter proof, atomic ledger write proof, status-derivation proof
across partial/full payment). 63 new tests this session.

`npx vitest run`: **607 tests passing** across 60 files (up from Session
3's 544 across 52 files). `npx tsc -p tsconfig.json --noEmit` clean. Same
sandbox `ERR_PNPM_IGNORED_BUILDS`/Redis-unavailable environment notes as
Sessions 2/3 apply unchanged — verified via the same direct
`prisma generate` + `tsc` + `vitest run` sequence, not literal `pnpm build`.

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

Completed 2026-07-28.

**RBAC audit result: no deviations found.** Every route in all 7 Phase 1
routers (`inventory-item-routes.ts`, `supplier-routes.ts`,
`purchase-order-routes.ts`, `prep-record-routes.ts`, `stock-count-routes.ts`,
`waste-log-routes.ts`, `supplier-invoice-routes.ts`) was read line-by-line
and checked against every row of the §8.3 permissions matrix. Every
`requireRole(...)` call matched its matrix row exactly — including the
subtle cases the brief called out specifically: Receiving is `bothRoles` (not
accidentally `managerOnly`) on both the PO router; PrepRecipe promote is
`managerOnly` while Prep Record creation is `bothRoles`; Stock Count session
creation/approve are `managerOnly` while execute/submit is `bothRoles`;
Supplier AP has no `bothRoles` tier anywhere in its router (by design, per
D-2/D-13). No route required a fix, so no new regression test was needed for
this part of the scope — Sessions 3/4's existing RBAC test coverage (403 for
wrong role on every route) already stands as the proof and was re-verified
by running the full suite, not re-written.

Also re-verified beyond route-level RBAC (response-shape correctness, not
just the `requireRole` gate): `stockCountService.applyBlindCount`
(`stock-count-service.ts`) still strips both `expectedQty` and `gapQty` via
destructuring/rest-spread for `STORE_ATTENDANT` across `list`, `getById`,
and `submitCounts` — D-14 and Session 4's Deviation-logged `gapQty`
extension both intact, unchanged by this session.

**`stockCountLineId`/`purchaseOrderLineId` FK question — resolved: FKs
added, not deferred again.** Carried as an open item since Session 2. Given
this session explicitly needed to decide "does the audit/reports work need
the FK," and the count-discrepancy and price-history reports turned out not
to strictly require it (they read `StockCountLine`/`PurchaseOrderLine`
directly, not via the ledger back-link), the FK was added anyway because (a)
Session 4 already started **writing** `stockCountLineId` values into
`InventoryTransaction` with no constraint backing them, so unconstrained
writes were accumulating every stock-count approval; (b) this is the
explicitly-flagged last realistic point before Session 6+ frontend work
assumes the current shape; and (c) deferring a fourth time was itself the
thing the task brief asked this session to stop doing. Added
`purchaseOrderLine`/`stockCountLine` relations on `InventoryTransaction`
(both `onDelete: SetNull`, matching the existing `prepRecord`/`wasteLog`
back-link pattern) plus the reverse `transactions InventoryTransaction[]`
relations on `PurchaseOrderLine` and `StockCountLine`. Migration:
`backend/prisma/migrations/20260728150000_inventory_transaction_line_fks/migration.sql`
— two `ADD CONSTRAINT ... FOREIGN KEY ... ON DELETE SET NULL ON UPDATE
CASCADE` statements, additive-only, no data migration needed (existing
`purchaseOrderLineId`/`stockCountLineId` values already reference real rows,
since Session 3/4's code only ever wrote real IDs into those columns).
Generated via the same disposable-shadow-database `prisma migrate diff`
technique Session 1 used (see that session's Deviations entry) rather than
`prisma migrate dev` directly, because the local dev DB still carries the
pre-existing, unrelated `payslips` column-default drift Session 1 flagged —
not this session's to fix, and `migrate dev`'s drift check blocks on it
unconditionally. Applied to local `wendo_rms` directly via `psql`, then
reconciled into migration history with `prisma migrate resolve --applied`.
`prisma migrate status` confirms clean afterward.

**Reports layer — all 7 §4/§8.3 reports implemented, Manager-only.** New
files, following Session 3/4's structural conventions (thin Zod-validated
controller, `{ success, data }` response, local per-file UUID/query Zod
schemas, `requireActor` helper) rather than the older, more elaborate
multi-branch `report-service.ts`/`report-repository.ts` pattern (that one
serves Director/Accountant/multi-branch reporting and is out of scope here —
Phase 1 reports are single-location, Manager-only, and much simpler):

- `backend/src/repositories/inventory-report-repository.ts` — read-only
  query helpers: `findActiveItemsByOrganization`,
  `sumQuantityByItemGrouped` (ledger `groupBy` on `InventoryTransaction`,
  the multi-item analogue of Session 2's
  `sumQuantityByItemAndLocation`), `findReceivedLinesForItem`,
  `findPrepRecordsForOutputItem`, `findDistinctPrepOutputItems`,
  `findCountLinesForOrganization`, `findInvoicesForAging`. No report reads
  from anything but `InventoryTransaction`, `PurchaseOrderLine`,
  `PrepRecord`/`PrepRecordLine`, `StockCountLine`, or `SupplierInvoice`
  directly — never a second aggregate table.
- `backend/src/services/inventory-report-service.ts` — one function per
  report: `getStockValuation`, `getLowStockAlerts`, `getPriceHistory`,
  `getPrepYield`, `getCountDiscrepancy`, `getTrueCostPerPreppedItem`,
  `getSupplierApAging`. `getPrepYield`'s rolling-average figure is a direct
  pass-through call to Session 2's
  `inventoryTransactionService.getRollingAverageForOutputItem` — never
  recomputed here, confirmed by a dedicated test (see below). AP aging
  buckets are `0-7`/`8-30`/`31+` days outstanding per §4a, computed fresh
  from `invoiceDate`/`amount`/`amountPaid` on every call, matching Session
  4's "recomputed fresh, never incrementally tracked" status-derivation
  philosophy.
- `backend/src/validators/inventory-report-schemas.ts` — `LocationQuerySchema`,
  `PriceHistoryQuerySchema`, `PrepYieldQuerySchema`,
  `CountDiscrepancyQuerySchema`.
- `backend/src/controllers/inventory-report-controller.ts` +
  `backend/src/routes/inventory-report-routes.ts` — 7 `GET` routes under
  `/inventory-reports/*` (`stock-valuation`, `low-stock-alerts`,
  `price-history`, `prep-yield`, `count-discrepancy`, `prepped-item-cost`,
  `supplier-ap-aging`), every one `authenticate` → `branchScope` →
  `requireRole('STORE_MANAGER')` → controller, matching Supplier AP's
  no-`bothRoles`-tier shape (§8.3: "Reports ... | ✅ | ❌"). Registered in
  `backend/src/routes/index.ts`.

**Test coverage**: `tests/inventory-report.test.ts` — table-driven
(`describe.each`) over all 7 report routes, 3 cases each (200 for Manager,
403 for Attendant with the service spy asserted **not called**, 401 with no
token) = 21 tests. `src/services/inventory-report-service.test.ts` — 6 tests:
stock valuation derives on-hand from `sumQuantityByItemGrouped` (the ledger
groupBy) rather than any counter, including a zero-on-hand/no-ledger-activity
case; low-stock filters correctly against `reorderLevel`; prep yield asserts
`inventoryTransactionService.getRollingAverageForOutputItem` is called with
the right args (the delegation-proof pattern from Sessions 3/4, applied to
confirm the rolling average is never recomputed in the reports layer) and
that a per-run `yieldRatio` computes correctly; count discrepancy proves
`gapValue` is computed from the `StockCountLine` row's own
`gapQty`/`inventoryItem.currentCost`, not a separate stored figure; AP aging
proves the day-bucket boundaries and the per-supplier `totalOutstanding`
rollup.

`npx tsc -p tsconfig.json --noEmit`: clean. `npx vitest run`: **634 tests
passing** across 62 files (up from Session 4's 607 across 60 files — 27 new
tests this session: 21 route-level + 6 service-level). Same sandbox
`ERR_PNPM_IGNORED_BUILDS`/Redis-unavailable notes as every prior session
apply unchanged — verified via `npx prisma generate` + `npx tsc` +
`npx vitest run`, not literal `pnpm build`.

**Backend is now fully demoable via Postman/Thunder Client for every Phase 1
workflow across both roles** — this session's audit found the RBAC surface
already correct end-to-end (Sessions 3/4 got it right the first time), and
the reports layer that was genuinely missing is now shipped. This is the
checkpoint Sessions 6–8 (frontend) build against.

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

Completed 2026-07-28. All 6 screens from §8.2 built and manually exercised
in-browser at a 390×844 mobile viewport (Chromium via Playwright, logged in
as the seeded `store.attendant@wendo.test` account). Design references:
UI mockups were generated for all 6 screens
(`docs/context/INVENTORY-FEATURE/mockups/`) before build — each page follows
its mockup's layout, not an original design.

**New role wiring (prerequisite work, not in the original scope list but
required before any screen could render):**
- Added `STORE_MANAGER`/`STORE_ATTENDANT` to frontend `types/auth.ts`
  `AppRole` and to `middleware.ts`'s `allRoles` + a new `/app/inventory`
  path rule (`STORE_MANAGER || STORE_ATTENDANT` only — Session 7/8 will
  extend this once Manager screens exist). Without this, every request to
  `/app/inventory/*` was silently redirected to `roleHome` before ever
  reaching a page component.
- Added a `STORE_ATTENDANT` entry to `app/app/layout.tsx`'s `mobileRoleTabs`
  (6 tabs: Stock/Purchase Orders/Receiving/Prep/Count/Waste, no overflow —
  all 6 fit the primary bar) and to `lib/role-home.ts`'s `roleHome` map
  (both new roles land on `/app/inventory/stock`, since Manager desktop/
  mobile screens don't exist yet). No `sidebarSectionsByRole` entry for
  either role — confirmed this correctly keeps both roles on the
  mobile-only `MobileLayout` shell per §8.0, never the desktop sidebar.
- Added `STORE_MANAGER`/`STORE_ATTENDANT` to the `roleLabels` map in
  `app/app/profile/page.tsx` (a `Record<AppRole, string>` — would not have
  compiled otherwise once the two roles were added to `AppRole`).

**Backend gaps found and closed before frontend work could start** (both
flagged to the user via the escape hatch rather than guessed, since they'd
have committed Sessions 7/8 to a wrong shape):
- `GET /inventory-items` had no on-hand quantity at all — only
  `GET /inventory-items/low-stock` attached `onHandQty`, and only for
  already-low-stock items, not the full catalog Stock on Hand needs.
  Extended `inventoryItemService.list` to accept an optional `locationId`
  and, when given, attach `onHandQty` to every item via Session 5's
  `inventoryReportRepository.sumQuantityByItemGrouped` (one grouped query,
  not a per-item loop like `listLowStock` uses). Both roles already had
  route access, so no RBAC change. New tests:
  `tests/inventory-item.test.ts` (route-level passthrough) and
  `src/services/inventory-item-service.test.ts` (new file — enrichment
  logic, including the no-`locationId`/no-`onHandQty`-key case and the
  no-ledger-activity/zero-on-hand case).
- No frontend-reachable way existed to discover the Central Store's
  `Location.id` at all — no `GET /locations` route, and no seed script had
  ever created the one Phase 1 `CENTRAL_STORE` row Session 1's schema
  anticipated. Every other inventory endpoint needs this id (`locationId`
  query params / body fields). Built a full read-only
  repository → service → controller → route stack
  (`location-repository.ts`/`location-service.ts`/`location-controller.ts`/
  `location-routes.ts`, `GET /locations` + `GET /locations/:id`, both roles
  per the same reasoning as Item Catalog/Suppliers reads) plus
  `tests/location.test.ts` (7 tests: RBAC, happy path, 404, 400). Added
  `@@unique([organizationId, type])` on `Location` (migration
  `20260728160000_inventory_location_unique_org_type`, generated via the
  same disposable-shadow-DB technique Sessions 1/5 used, to sidestep the
  same pre-existing `payslips` drift they already flagged) so the seed's
  upsert can't create a second Central Store row per organization.
  Extended `seed-dev.ts` (not a new script) to upsert the Central Store
  `Location` row and two global dev accounts
  (`store.manager@wendo.test` / `store.attendant@wendo.test`,
  password `password123`) on the hub org, following the existing Director
  account's "one global account" pattern.

**Screens built** (`frontend/app/app/inventory/`):
1. **Stock on Hand** (`stock/page.tsx`) — read-only card list, search,
   type-filter pills, red left-border + "LOW STOCK" badge when
   `onHandQty <= reorderLevel`. No edit actions anywhere, per spec.
2. **Purchase Orders** — list (`purchase-orders/page.tsx`, status badges,
   a distinct "Waiting for manager to send" callout on `DRAFT` rows so the
   Attendant knows it's pending, not stuck), new-draft creation
   (`purchase-orders/new/page.tsx`, supplier picker → catalog browse → line
   editor → Save Draft — **no Send action rendered anywhere on this
   screen**), and a minimal, not-mockup-designed detail page
   (`purchase-orders/[id]/page.tsx`, built so the list's tap-through has
   somewhere to land — flagged to the user as out-of-mockup-scope and
   approved before building).
3. **Receiving** — list of SENT/PARTIALLY_RECEIVED POs
   (`receiving/page.tsx`) and the execution screen
   (`receiving/[id]/page.tsx`): ordered qty + invoice price prefilled per
   line, red border + inline discrepancy note
   (`"X {unit} less/more than ordered"`) when actual ≠ ordered, per-line
   debounced autosave calling `POST /purchase-orders/:id/lines/:lineId/receive`
   individually per line (not a bulk endpoint — this API is inherently
   per-line, unlike Stock Count's submit), following the payroll sheet's
   `idle|dirty|saving|saved|error` row-state + serialized-per-row-save-queue
   pattern, adapted from "one bulk upsert for the whole sheet" to "one call
   per line." Confirm Receipt flushes any pending debounced saves before
   navigating away.
4. **Prep entry** (`prep/page.tsx`) — numbered 3-step flow (output item →
   repeatable input lines → actual yield), a shared bottom-sheet item
   picker component reused for both the output picker and each input
   line's picker, and the rolling-average soft-reference hint
   (`GET /prep-records/rolling-average`) rendered as plain informational
   text above the yield field — never a validation gate, and correctly
   absent (not a broken/blank state) when an output item has no prep
   history yet.
5. **Stock Count execution** — list of sessions
   (`stock-counts/page.tsx`) and execution
   (`stock-counts/[id]/page.tsx`): shelf-order line list, numbered pending
   badge → green checkmark once a line has a value, progress bar, Pause/
   Resume (local UI state only — a paused session's counted values stay in
   component state, nothing is discarded), Submit disabled until every
   line has a value, single bulk `POST /stock-counts/:id/submit` call on
   Submit (matching the actual API shape — this endpoint takes all lines
   in one call, unlike Receiving's per-line endpoint, so "per-line
   autosave" here means local per-line state tracking + one bulk
   persistence call, not a debounced network call per keystroke).
   **D-14 verified directly on the wire before writing any of this
   screen's code** (not assumed from Session 4/5's As Built notes): created
   a real stock count session via the Manager API, then fetched it three
   ways with an Attendant token —
   `GET /stock-counts/:id`, `GET /stock-counts` (list), and the response of
   `POST /stock-counts/:id/submit` — and confirmed via
   `Object.keys()` inspection that `expectedQty` and `gapQty` are genuinely
   absent keys, not `null`/falsy, in all three. Cross-checked the same
   session with a Manager token and confirmed both keys are present there.
   The component's own code never reads or references `expectedQty`/
   `gapQty` at all (there's nothing in the response to hide).
6. **Waste Log entry** (`waste/page.tsx`) — numbered 3-step flow (item
   search-or-recent-items → quantity → reason, 5 tappable chips matching
   §8.2's exact list: Spoiled/Prep Error/Dropped/Expired/Other), optional
   note field collapsed by default so it never reads as required.

**Shared components added** (`frontend/components/inventory/`,
`frontend/components/ui/`):
- `IconTile.tsx` — new shared component in `components/ui/`, consolidating
  a "soft-square tile with a centered icon" pattern that was previously
  copy-pasted inline with inconsistent sizing/shape across
  `SidebarNav.tsx`/`NoticeDetailSheet.tsx`/`ConversationList.tsx`. Holds a
  generic Lucide icon per item type for now (`item-type-icon.tsx`'s
  `itemTypeIcon` map) — a deliberate placeholder until a custom
  per-item-type icon set is designed later (decided with the user: ship
  Lucide now, swap the icon set later without touching call sites).
- `QuantityInput.tsx` — the numeric-entry pattern used across Receiving,
  Prep, Stock Count, and PO creation: `inputMode="decimal"`,
  select-all-on-focus, unit suffix, tabular-nums right-aligned display.
  Built on the existing `Input` component (`components/ui/Input.tsx`), not
  a new base component. **A quantity stepper (+/-) was explicitly ruled
  out and dropped from the plan mid-session** — a stepper is fine for a
  3-item cart but wrong for these screens' 15+ line, exact-measured-value
  entries (typing "4.7" beats tapping a stepper 47 times); this was a
  user-directed correction, not an independent design call.
- `PurchaseOrderStatusBadge.tsx` — maps `PurchaseOrderStatus` to the
  existing `Badge` component's `tone` prop (no new badge component needed;
  `Badge` already supported this via `tone` + custom children).
- No new Zustand store/slice was created this session. Both Stock on Hand
  and Purchase Orders were assessed against CLAUDE.md's Frontend Hook
  Stability Rules and found not to need one — each screen's state (search
  text, filters, form drafts, per-line save state) is genuinely local to
  that one page, never shared across components, so a Zustand slice would
  have been an unrequired abstraction (CLAUDE.md: "don't add abstractions
  beyond what the task requires"). Receiving's and Stock Count's per-line
  state machinery instead follows the payroll sheet's `useState`-based
  `idle|dirty|saving|saved|error` pattern directly in the page component,
  per the task brief's explicit instruction to reuse that pattern rather
  than inventing a new one.

**API-shape bug found and fixed during manual verification (this is exactly
what the manual-testing requirement is for):** the Receiving execution
screen initially assumed `PurchaseOrderLine.inventoryItem` was a full
`InventoryItem` (with `type`, `usageUnit`, etc.), copying the shape from
Stock on Hand's `GET /inventory-items` response. It compiled and typechecked
cleanly (no runtime shape validation on `apiClient` responses), but crashed
with a live "Element type is invalid" React error in the browser, because
`purchase-order-repository.ts`'s `detailInclude` only selects
`{ id, name, buyUnit }` on that nested relation. Fixed by narrowing
`types/inventory.ts`'s `PurchaseOrderLine.inventoryItem` to the real shape
and removing the Receiving screen's dependency on `type`/`usageUnit` for
that field (uses a plain `Package` icon instead of the per-type icon map,
and `buyUnit`, which does exist, instead of `usageUnit`). Left a comment on
the type documenting which backend file constrains this shape, so a future
session doesn't reintroduce the same mismatch.

**Verification performed** (per this session's Done-when criteria):
- `pnpm build` equivalent (`npx next build`, same `ERR_PNPM_IGNORED_BUILDS`
  sandbox workaround as every backend session) — clean, all 10 new
  `/app/inventory/*` routes present in the route manifest.
- `npx tsc --noEmit` — clean.
- Every screen manually exercised in-browser at a 390×844 mobile viewport
  via Playwright (Chromium), logged in as `store.attendant@wendo.test`
  against real seeded data (10 catalog items spanning all 3 types, a 4-line
  SENT PO, a fresh 10-line IN_PROGRESS stock count session, 4 POs across
  DRAFT/SENT/PARTIALLY_RECEIVED/CLOSED). Edge cases specifically exercised,
  not just the golden path: a Receiving discrepancy (actual ≠ ordered → red
  border + note appeared correctly), a Stock Count line where the counted
  value happened to exactly match true on-hand (zero-gap — renders
  identically to any other counted line, since the Attendant has no
  expected value to compare against and shouldn't), and Prep entry with no
  rolling-average history yet for the selected output item (hint area
  correctly absent, not a broken/loading state).
- New backend test coverage from this session's prerequisite backend work:
  `tests/inventory-item.test.ts` (+2), `src/services/inventory-item-service.test.ts`
  (new file, +2), `tests/location.test.ts` (new file, +7) — 11 new backend
  tests, all passing alongside the full existing suite (656 tests across
  65 files).

**Deviation logged — see Deviations log below**: two backend gaps
(`onHandQty` on the catalog list endpoint, and the entire `Location` read
API + its missing seed data) were discovered and closed during this
session, even though Session 6's scope was frontend-only. Both were
flagged to the user via the escape hatch before being built, since guessing
either shape wrong would have committed Sessions 7/8 to rework.

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

Completed 2026-07-29. **Deviation from scope, decided with the user
mid-session: no mockups were used.** The original plan was mockup-driven
(mirroring Session 6), but the user redirected mid-session to design freely
against `docs/DESIGN_SYSTEM.md` directly — "build the best screens you can
using the current design system and components." All 9 screens below (the
Dashboard, screen #1, had already been built in a prior part of this
session before the mockup-vs-design-system decision) were designed and
built without a mockup reference.

**Screens built** (`frontend/app/app/inventory/`):
1. **Stock on Hand** (`stock/StockOnHandDesktop.tsx`) — dense `ExcelTable`
   (search, type-filter pills, sortable columns, totals row) + a slide-over
   side panel showing an item's full ledger history on row click, via a
   **new backend endpoint** (see Backend gap below).
2. **Item Catalog** (`catalog/page.tsx`) — full `ExcelTable` + a slide-over
   form panel for create/edit (all `CreateInventoryItemInput` fields,
   department-tag pills, read-only current cost on edit), soft-delete via
   `ConfirmDialog`.
3. **Suppliers** (`suppliers/page.tsx`) — **merged with Supplier
   Invoices/AP into one screen**, a deliberate deviation from the scope
   list's two separate line items. Roster + detail panel with a
   `TabBar`: "Items & Pricing" (assigned items, default-supplier star,
   last price, `PriceTrendChart`) and "Accounts Payable" (invoice list,
   record-invoice/record-payment modals), the AP tab rendered only when
   `role === 'STORE_MANAGER'`. Decided with the user after they questioned
   why these were two screens when `SupplierInvoice.supplierId` is a
   direct FK — see the Deviations log entry below for the full reasoning
   (particularly why AP is a conditionally-rendered tab, not a
   route-level split, given Attendant's zero-access AP boundary).
4. **Purchase Orders** (`purchase-orders/PurchaseOrdersDesktop.tsx`) —
   `ExcelTable` list (status filter, search) + a slide-over detail panel:
   DRAFT shows Send/Cancel actions with `ConfirmDialog`s and a static line
   list; SENT/PARTIALLY_RECEIVED shows the same receiving flow inline
   (prefilled ordered qty/invoice price, red discrepancy highlight,
   per-line Confirm) rather than a separate desktop receiving screen — per
   §8.1 row 7's "same core flow as mobile... on desktop it can show the
   full PO alongside a wider discrepancy table." The standalone
   `/app/inventory/receiving` route now **redirects** Manager to
   `/app/inventory/purchase-orders` (Attendant's own receiving flow at
   that route is untouched); the Manager desktop sidebar and mobile
   tab-bar fallback both dropped their now-redundant "Receiving" entry
   (mobile tab-bar's slot backfilled with "Reports").
5. **Prep Entry** (`prep/PrepEntryDesktop.tsx`) — two-column layout: a
   form (output item, repeatable input lines, actual yield, rolling-average
   hint) beside a live-updating "Running Cost" panel (per-line cost
   breakdown, total input cost, cost-per-unit-yield vs. the item's current
   catalog cost) per §8.1 row 8's explicit ask.
6. **Stock Count** (`stock-counts/StockCountsDesktop.tsx`) — `ExcelTable`
   of sessions + a "New Count Session" modal (label, date, full-catalog
   checkbox picker) + a slide-over detail panel with a variance table
   (expected/counted/gap, net variance value) and an Approve action
   (`ConfirmDialog`) that posts adjustments.
7. **Waste Log** (`waste/WasteLogDesktop.tsx`) — filterable `ExcelTable`
   (reason filter, search, total cost) + a "Log Waste" modal reusing the
   same 5-reason chip picker as the Attendant screen.
8. **Reports** (`reports/page.tsx`) — all 7 report endpoints from Session
   5, one `TabBar` per report: Stock Valuation, Low Stock Alerts, Price
   History (item picker + `PriceTrendChart`), Prep Yield, Count
   Discrepancy (non-zero gaps only), True Cost per Prepped Item, Supplier
   AP Aging (with a total-outstanding stat + bucket coloring). **CSV
   export only, not PDF** — no existing PDF-generation utility fit this
   report shape without building new machinery out of scope for this
   session; `ExportMenu`'s PDF option was not used. CSV export reuses the
   existing `lib/payroll-csv.ts`'s `downloadCsv` browser-download helper.
   **Not built: Prep Recipe editor** — explicitly dropped from scope by
   the user mid-session (see Deviations log).

**New shared component:**
- `components/inventory/PriceTrendChart.tsx` — no charting library is
  installed (flagged as an open gap in the original session brief). Built
  a lightweight single-series SVG line chart from scratch (hover
  crosshair + tooltip, gridlines, gradient fill under the line) rather
  than adding a dependency, since Price History's need (one series, one
  hue, magnitude-over-time) didn't justify pulling in a full charting
  library. Followed the `dataviz` skill's method: Espresso as the single
  series hue (no legend needed for one series per the skill's own rule),
  recessive gridlines, direct value labels only on hover.

**Backend gap found and closed before Stock on Hand could be built**
(same escape-hatch pattern Session 6 used — flagged to the user rather
than guessed, since this blocked the very first screen): **no endpoint
existed at all** for per-item ledger history. `GET
/inventory-items/:id/transactions` was added
(`inventory-item-controller.ts`/`-service.ts`, route registered before the
existing `:id` route to avoid a param-swallowing conflict), reusing
Session 2's already-existing `inventoryTransactionRepository
.findByItemAndLocation` — zero new repository code, just a new
controller/route/service wrapper plus a `locationId` query-param schema.
Two new tests added to `tests/inventory-item.test.ts` (happy path +
missing-locationId 400); full suite (647 tests, up from 645) still passes.

**Architecture bug found during manual verification, fixed properly (not
worked around) — this is exactly what the manual-testing requirement is
for:** `app/app/layout.tsx` mounts `{children}` **twice** for every
dual-shell role (MANAGER, DIRECTOR, ACCOUNTANT, HR_MANAGER,
SYSTEM_ADMIN, STORE_MANAGER) — once inside the desktop `SidebarLayout`,
once inside a CSS-hidden (`lg:hidden`) mobile `MobileLayout` — so that a
resize can flip between them without a re-mount. Every desktop screen
built this session is genuinely desktop-only (no responsive/mobile
variant exists yet; that's Session 8's job), so each one was silently
double-mounted, doubling every data-fetch and creating duplicate DOM
element ids (caught by a Playwright test hitting `locator('#actual-yield')
resolved to 2 elements`). The first fix attempt — a `useIsDesktopViewport`
hook reading `window.matchMedia` — was **wrong and reverted**: both
mounted copies observe the identical viewport width, so the hook couldn't
tell which shell instance it was running inside and both copies still
rendered. The real fix is `lib/shell-context.tsx`, a tiny React context
(`ShellProvider`/`useIsDesktopShell`) that `app/app/layout.tsx` provides
with a literal `'desktop'` or `'mobile'` value at each of the two
`{children}` call sites — a value the two mounted copies necessarily
receive differently, unlike a viewport query. All 8 new/updated
Manager-desktop page components (the `catalog`/`suppliers`/`reports`
`page.tsx` files directly, and the 5 `*Desktop.tsx` components via their
dispatcher `page.tsx`) now check `useIsDesktopShell()` and render `null`
in the mobile-shell copy — an inner-component split (`XPage` guard +
`XPageInner` body) was used everywhere to avoid violating rules-of-hooks
with an early return. `suppliers/page.tsx` needed a narrower guard
(`role === 'STORE_MANAGER' && !isDesktop`) since STORE_ATTENDANT reaches
the same route through the single-shell `MobileLayout` path (never
double-mounted) and must always render. Verified post-fix via Playwright:
duplicate DOM id count dropped 2→1, and the Catalog screen's
`inventory-items` GET call count dropped to exactly what React Strict
Mode's dev-only double-invoke produces for a single real mount (2, not
4) — confirmed against a `Search input count` / `Sidebar count` DOM
assertion of 1, not repeated fetch counts alone (Strict Mode
double-invoking a single effect looks identical to two real mounts by
call-count alone). This bug was never role-scoped to only my new
screens — it is a pre-existing property of `layout.tsx` shared by every
dual-shell role — but no earlier session's pages happened to hit it,
because Manager's own dashboard/report pages are written as one
genuinely-responsive component (no hardcoded element `id`s, no assumption
that data only loads once) rather than a desktop-only component. Flagging
this for Session 8: any Manager mobile screen built as a **second**,
separate component (rather than making the existing desktop component
responsive) will need the same `useIsDesktopShell()` guard, mirrored
(`if (isDesktop) return null`), on its own component.

**Role-dispatcher pattern for the 6 routes shared with Attendant**
(decided with the user before building): `stock`, `purchase-orders`,
`prep`, `stock-counts`, `waste` (`receiving` ended up redirecting instead,
see above) already had Attendant mobile screens from Session 6 at the
same URL. Since STORE_MANAGER's dual shell renders both the desktop
sidebar and the mobile bottom-nav shell simultaneously (CSS-hidden per
breakpoint, not conditionally mounted — see `usesDualShell` in
`layout.tsx`), each shared route's `page.tsx` is a thin, hookless
dispatcher: `if (role === 'STORE_MANAGER') return <XDesktop />; return
<XAttendant />` — with the pre-existing Attendant screen's body renamed
into its own `XAttendant` function so neither branch violates
rules-of-hooks. `catalog`, `suppliers`, and `reports` have no Attendant
equivalent (Catalog/Suppliers view access is shared per §8.3, but no
Attendant UI was built for them since Session 6 didn't need to; Reports
is Manager-only) so those three are plain Manager-only pages, gated only
by nav visibility and backend RBAC — consistent with how the existing
Suppliers-AP-tab boundary and every other role-gated feature in this
codebase already works (no in-page "access denied" convention exists
anywhere to imitate; backend 403s are the real enforcement layer).

**Verification performed** (per this session's Done-when criteria):
- `npx tsc --noEmit` — clean, both before and after the shell-context fix.
- `npx next build` — clean, all 11 `/app/inventory/*` routes present
  (only 2 ESLint unused-import fixes needed along the way).
- Backend: `npx vitest run` — 64 files, 647 tests, all passing (2 new
  tests from the transactions endpoint).
- Every screen manually exercised in-browser via Playwright (Chromium) at
  a 1600×1000 desktop viewport, logged in as `store.manager@wendo.test`
  against real seeded data (10 catalog items, 2 suppliers, 5 POs across
  DRAFT/SENT/PARTIALLY_RECEIVED/CLOSED, a Central Store location). Beyond
  the golden-path screenshots: sent a real DRAFT PO end-to-end (button →
  `ConfirmDialog` → toast → status flip to SENT → panel transitions to
  the receiving view with prefilled quantities — a live state-changing
  action, not just a static render); filled a real Prep Entry cost
  calculation (5L Fresh Milk @ Ksh 210 → Ksh 1,050 total, 4.5kg yield →
  Ksh 233.33/kg, correctly compared against the catalog's Ksh 350/kg);
  opened a Supplier's detail panel and confirmed the AP tab only appears
  for Manager; re-ran the full 9-screen zero-console-error sweep after
  the shell-context fix to confirm no regression. Also re-verified
  STORE_ATTENDANT's mobile Stock on Hand screen at a 390×844 viewport
  post-fix, confirming the `ShellProvider` change is a no-op for
  single-shell roles.

---

## Session 8 — Frontend: Manager Mobile Screens

**Depends on:** Session 7. **Blocks:** Session 9.

### Scope
Per feature plan §8.1 mobile column — genuinely separate designs from
Session 7, not a reflow:
- Mobile variants of every screen in Session 7 per the table (card lists,
  sparkline price history, compact AP status chips, step-by-step PO item
  picker, single-metric report summary cards with tap-through).
- **Prep Recipe editor was not built in Session 7** (dropped from scope by
  the user — see Session 7's As Built and the Deviations log). There is
  nothing to view on mobile yet; skip this row entirely rather than
  building a view-only screen for data that can't exist. Revisit only if
  a future session builds the desktop editor first.
- Flag in As Built any report that's desktop-only in v1 (feature plan
  explicitly allows deferring full mobile report parity).
- Read Session 7's As Built note on the `app/app/layout.tsx` dual-shell
  double-mount bug before writing any mobile component: if a screen's
  mobile version is a **separate component** from its desktop counterpart
  (not the same component made responsive), it needs the same
  `useIsDesktopShell()` guard mirrored on the mobile side
  (`if (isDesktop) return null`) or the desktop copy and mobile copy will
  both render into the same shell mount.
- `pnpm build` clean before marking Complete. Manually exercise each screen
  in-browser (mobile viewport).

### As Built

Completed 2026-07-29. All 9 screens from §8.1's mobile column built and
manually exercised in-browser at a 390×844 mobile viewport (Chromium via
Playwright), logged in as `store.manager@wendo.test`. No mockups — built
directly against `docs/DESIGN_SYSTEM.md`, following Session 7's
build-now/restyle-later precedent (§8.0), reusing Session 6's Attendant
mobile component library (`IconTile`, `QuantityInput`,
`PurchaseOrderStatusBadge`, the espresso-header-band + numbered-step-flow +
bottom-sheet visual patterns) rather than inventing new primitives.

**Screens built** (`frontend/app/app/inventory/`):
1. **Stock on Hand** (`stock/page.tsx`) — Manager mobile reuses the exact
   same card-list component Session 6 built for Attendant (§8.1 row 1:
   "Same card list view as Manager's mobile layout"), extracted into a
   shared `StockOnHandMobile({ isManager })` component. The only behavioral
   difference: Manager's cards are tappable (`Card`'s built-in `onClick`
   interactive mode) into a new full-screen movement-history feed
   (chronological transaction list, not the desktop side-panel), fetched
   via Session 7's `GET /inventory-items/:id/transactions`; Attendant's
   cards stay non-interactive per §8.2 row 1.
2. **Purchase Orders** — list (`purchase-orders/page.tsx`) reuses
   Session 6's card list + floating "New Purchase Order" action almost
   unchanged, with role-aware copy (Manager never sees "waiting for
   manager to send"). New-draft creation (`purchase-orders/new/page.tsx`,
   already shared and mostly role-agnostic) got the same copy treatment.
   The detail page (`purchase-orders/[id]/page.tsx`, Session 6's
   flagged-minimal placeholder) was rebuilt with Manager-only Send/Cancel
   actions (§8.3) behind a **lightweight bottom confirm sheet** — not
   `ConfirmDialog`, which is a centered `Modal` (the desktop pattern used
   in `PurchaseOrdersDesktop.tsx`) — per §8.1 row 6's explicit mobile-column
   ask. For SENT/PARTIALLY_RECEIVED orders, a "Receive this delivery" link
   card routes into the existing `/app/inventory/receiving/[id]` flow
   (role-agnostic, built in Session 6) rather than duplicating receiving —
   matches §8.1 row 7's "same core flow" note.
3. **Item Catalog** (`catalog/page.tsx`) — brand new: card list (search,
   tap → edit) plus a floating "Add Item" action, and a **4-step
   full-screen form** (identity → units → departments → supplier) with a
   segmented progress bar and Back/Next/Save controls, per §8.1 row 2's
   explicit ask to avoid "one long form" on a small screen. Field-level
   validation only advances past the identity/units steps once required
   fields are valid; department tags and default-supplier are optional
   steps with no gate.
4. **Suppliers** (`suppliers/page.tsx`) — brand new: card list → detail
   screen with an Items & Pricing / Accounts Payable `TabBar` (AP tab only
   for Manager, matching the desktop screen's role gate), a
   `PriceTrendChart` sparkline (reused as-is — its `viewBox` + `w-full`
   SVG scaling already reads as a compact sparkline in a narrow mobile
   container, so no separate compact-chart component was needed, resolving
   the open question in this session's brief), and compact `Badge`
   status chips per invoice (§8.1 row 4: "not a separate chart") with a
   Record Payment bottom sheet. Also added a bottom-sheet "Add Supplier"
   flow, floating-action-triggered — not explicitly called for by §8.1's
   table, but omitting supplier creation entirely from Manager mobile would
   have been a real capability gap (the desktop screen's primary action),
   not a deliberate simplification, so it was built to keep functional
   parity with desktop for Manager's own screens.
5. **Prep entry** (`prep/page.tsx`) — Manager mobile reuses Attendant's
   existing step-flow screen unchanged, per §8.1 row 8 ("no running-cost
   panel on mobile, soft-reference hint only"). See the Deviations log for
   a bug found and fixed in this dispatcher during verification.
6. **Stock Count** — list (`stock-counts/page.tsx`) reuses Session 6's
   card list with role-aware empty-state copy (Manager can't create a
   session from mobile per §8.1 row 10 — "Manager creates from desktop" —
   so the empty state points there instead of "your manager creates").
   The `[id]` detail route now branches by role at the top: Attendant keeps
   the unmodified count-execution flow; Manager gets a new **approval
   view** — a compact variance list (expected/counted/gap per line, D-14's
   blind-count rule doesn't apply here since Manager always sees
   `expectedQty`), a net-variance-value card, and an "Approve & Post
   Adjustments" action behind a bottom confirm sheet, matching §8.1 row 11's
   mobile column exactly ("Compact variance summary list, tap a line for
   detail" — detail-per-line was simplified to inline expected/counted/gap
   on each row rather than a further drill-down, since the variance list
   itself is already the "detail" at this data density).
7. **Waste Log** (`waste/page.tsx`) — Manager mobile reuses Attendant's
   existing 3-step entry screen unchanged, per §8.1 row 12 ("Manager can
   log waste same as Attendant"); full-log review stays desktop-only
   (`WasteLogDesktop.tsx`, Session 7), per the same row's note that
   reviewing the full log is a desktop task. See the Deviations log for a
   bug found and fixed in this dispatcher during verification.
8. **Reports** (`reports/page.tsx`) — brand new: a 2-column grid of 7
   single-metric summary cards (Total Stock Value, Items Low on Stock,
   Price History item count, Prep Runs Logged, Count Variances, Prepped
   Items Costed, Owed to Suppliers), each tapping through to a simplified
   per-report mobile view, per §8.1 row 13's explicit mobile-column spec.
   **3 of 7 reports get full simplified mobile views** (Stock Valuation as
   a list, Low Stock Alerts as a list, Price History as an item picker +
   `PriceTrendChart` sparkline) — these are the report shapes that read
   naturally as a list/chart on a phone. **The other 4 are flagged
   desktop-only for v1** (Prep Yield, Count Discrepancy, True Cost per
   Prepped Item, Supplier AP Aging): their summary card still shows the
   real headline number, but tapping through shows a "Full report on
   desktop" message instead of cramming an `ExcelTable`-shaped report onto
   a phone. This is the exact deferral the feature plan explicitly allows
   (§8.1 row 13: "Not a priority to fully replicate every desktop report on
   mobile in v1 — flag any report that's desktop-only") — flagged here as
   directed rather than treated as a gap to close.
9. **Prep Recipe editor** (§8.1 row 9) — **skipped entirely**, per this
   session's amended scope note and Session 7's Deviations log entry (the
   desktop editor itself was never built — nothing exists to view on
   mobile). Revisit only if a future session builds the desktop editor
   first.

**Dashboard — built at explicit user request mid-session (originally out of
scope; not in §8.1's screen table).** `dashboard/page.tsx` predates §8.1's
screen list and had no mobile design; the first pass at this session
guarded it to render nothing on the mobile shell and redirected Manager's
mobile copy to Stock on Hand (see the Deviations log's double-mount entry
below for why the guard itself was necessary regardless). The user then
asked for a real mobile screen, so `InventoryDashboardMobile` was built: the
same 6 headline stats as the desktop stat row in a 2-column card grid
(Total Stock Value, Items Needing Reorder, POs in Flight, Recent Stock
Counts, Accounts Payable with an overdue-31+-days caption, Waste Cost 30d),
plus three tap-through panels (Low Stock Alerts, POs Awaiting Delivery,
Recent Stock Counts) linking into their real screens rather than
duplicating them, and a floating "New Purchase Order" action matching the
desktop header's primary action. `layout.tsx`'s `mobileRoleTabs.STORE_MANAGER`
was updated accordingly: Dashboard is the primary landing tab (matching
`lib/role-home.ts`, which sends STORE_MANAGER to `/app/inventory/dashboard`
on both shells), with Stock/Orders/Reports alongside it and Item
Catalog/Suppliers/Prep/Stock Count/Waste Log/Profile in overflow.

**Verification performed** (per this session's Done-when criteria):
- `npx tsc --noEmit` — clean.
- `npx next build` — clean, all 11 `/app/inventory/*` routes present (one
  fix needed along the way: a stray `export function` on a non-default
  export inside a `page.tsx` file broke Next.js's route-file type
  generation — `StockOnHandMobile` had to drop its `export` keyword, since
  Next.js page files may only export `default` and a small allow-listed
  set of names).
- Every screen manually exercised in-browser via Playwright (Chromium) at
  a 390×844 viewport, logged in as `store.manager@wendo.test` against real
  seeded data — dispatched to a fresh-session subagent per the user's
  request (see Deviations log for the worktree-isolation pitfall hit on
  the first attempt). Two real bugs were found and fixed as a result (see
  Deviations log); both fixes were then independently re-verified live
  (screenshot + DOM bounding-box checks) before this session was marked
  complete. Desktop and Attendant were also spot-checked post-session to
  confirm no regression: Manager's desktop Stock/Catalog/Suppliers screens
  still render the Session 7 table/panel UI unchanged, and Attendant's
  mobile Stock/Purchase-Orders screens are pixel-for-pixel unchanged from
  Session 6.

**Deviations logged — see Deviations log below**: the worktree-isolation
pitfall on the first verification attempt; two real bugs found during
verification (a blank-screen dispatcher bug on Prep/Waste, and a z-index
bug hiding several fixed action bars/FABs behind the mobile nav bar); and
the Dashboard mobile screen being built mid-session at explicit user
request after initially being scoped out.

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

Completed 2026-07-29. Split across two parallel workstreams by explicit user
direction: this agent owned real-data seeding, end-to-end workflow
walkthrough, Gate assessment, and doc updates; a second agent (running
concurrently) owned the three known seam-bug classes flagged in this
session's brief (z-index sweep, `STORE_MANAGER`/`useIsDesktopShell()` double-
mount grep, API-shape drift sweep) — see that work folded into the findings
below, verified by this agent's own subsequent pass rather than taken on
faith.

**Real data seeded, replacing the Session 6-8 placeholder catalog.**
Transcribed `docs/context/INVENTORY-FEATURE/inventory-real-data/` images 1-9
(images 10+ are branch/departmental sheets, Phase 2 scope, explicitly
excluded per user decision) — three source documents after de-duplicating
repeat photos of the same physical paper: two Samrat Supermarket deliveries
(07-Jul-2026 and 21-Jul-2026, dry goods/consumables) and one Summer Limited
delivery (16-Jul-2026, bulk/butchery/cleaning supplies). No meat/dairy
supplier invoice was in the photo set even though CLAUDE.md references one
existing in real life — per user decision, invented a clearly-flagged
placeholder supplier ("Nyeri Fresh Meat & Dairy") with a few RAW items, so
Prep entry (which needs raw inputs) has something to consume; swap for the
real invoice when available. `backend/src/scripts/seed-inventory-demo.ts`
was rewritten wholesale (not extended) with this real data: 3 suppliers, 24
catalog items across all three types (RAW/PREPPED/PASS_THROUGH), two
dated receiving events per item that appears in both Samrat deliveries at
different real prices (per user decision, kept as two separate events, not
collapsed, so weighted-average cost and price-history have genuine
multi-point data), a PREPPED item ("Prepped Simple Syrup") with an initial
Prep Record, POs across DRAFT/SENT/CLOSED, a Supplier Invoice with a partial
payment, a Waste Log entry, and a separate "Opening Physical Count" Stock
Count session with deliberate real gaps (per user decision — invented
variances, not derived from received quantities, to exercise the
gap/adjustment workflow properly). The old placeholder catalog (Arabica
Coffee Beans, Kilimanjaro Coffee Co., etc.) was deleted first via a one-off
cleanup script (not committed — scoped to inventory tables only, users/
Location untouched), per explicit user decision to replace rather than
let old and new data coexist. Every seeded number was cross-checked by
hand: Kamal Gram Flour's weighted-average cost landed at exactly 243
(matches (3×259+2×219)/5), Prepped Simple Syrup's prep cost at exactly
81.5789 (matches 5×155÷9.5).

**Full live workflow walkthrough, both roles, both shells, driven through
the actual UI (not just seeded-state inspection).** Logged in as both
`store.manager@wendo.test` and `store.attendant@wendo.test`, at both
390×844 and 1600×1000 viewports, via Playwright scripts under
`frontend/.scratch/` (gitignored). Exercised, with real clicks/fills, not
mocked: Catalog + Suppliers (setup), a live PO send (DRAFT→SENT with a
toast + status flip), a live receive with a deliberate 1L-short delivery +
price bump (Fresh Milk 39/40L @ Ksh 78 vs. PO's Ksh 75 — confirmed the
weighted-average cost recomputed to exactly 76.7206, confirmed the PO
correctly stayed `PARTIALLY_RECEIVED` rather than `CLOSED` since one line
was still short), the same PO's second line received to completion via
Attendant mobile (Chicken Breast 15/15kg, full per-line autosave→Confirm
Receipt flow), a second Prep Record on the same output item to confirm the
rolling-average hint text ("Typical for this item: ~5.0 L input → ~9.5 L
output — Based on rolling average of last 1 prep records") renders
correctly on a 2nd run and updates to reflect 2 records afterward, a second
Waste Log entry logged live by the Attendant and confirmed visible to the
Manager's full-log review screen (own-entries-only boundary intact), and
Supplier AP's seeded partial payment confirmed showing correctly
(PARTIALLY_PAID, Ksh 35,670 invoiced / Ksh 20,000 paid) in the Suppliers
screen's AP tab. All 7 reports spot-checked against real seeded numbers on
both desktop (full report set) and mobile (summary cards + 3 of 7 full
mobile views, 4 correctly flagged "Full report on desktop" per §8.1 row
13's explicit v1 deferral) — Reports landing showed Total Stock Value Ksh
108,687, Items Low on Stock 8, Prep Runs Logged 1→2, Count Variances 3,
all matching hand-computed expectations from the seed.

**One real bug found and fixed — a genuine "staff can operate it
unassisted" blocker, exactly what this session's manual-testing requirement
exists to catch.** Prep Entry's `ItemPickerSheet` (`frontend/app/app/
inventory/prep/page.tsx`, used for both the output-item and each
input-item picker) renders its bottom-sheet overlay at `z-40`, but the
page's own fixed "Confirm Prep" action bar sits at `z-50` — so the sheet's
item list, which extends to the bottom of the viewport, is physically
covered by the disabled Confirm Prep button and cannot be clicked. Caught
by Playwright's own `subtree intercepts pointer events` failure on a
real click attempt, not by any visual/screenshot inspection (a static
screenshot of the open sheet looks fine — search box and title both
visible; only the unreachable list is hidden beneath the fold). This is
the same z-index-under-fixed-bar bug class Session 8 already fixed on
several screens, just manifesting through a sheet-over-sheet interaction
rather than a plain "FAB under nav" one, so it wasn't caught by the
z-index sweep the other agent ran (that sweep checked fixed-bar bounding
boxes against the nav bar, not sheet-vs-sheet stacking). Fixed by raising
`ItemPickerSheet`'s overlay to `z-[60]` (one line). Confirmed via grep this
is the only usage of `ItemPickerSheet` in the codebase (both picker call
sites in the same file), and confirmed no other screen with a fixed bottom
bar also uses an overlay-style item picker — Waste Log and PO-new both use
an inline search-as-you-type list instead, not a sheet, so they were never
exposed to this bug class.

**Gate criteria (feature plan §4) assessed against seeded real data — all
three met at the code level:**
- *Ledger reconciles with a physical count*: the Opening Physical Count
  session (5 items, real gaps) submitted, approved, and posted exactly 3
  non-zero `ADJUSTMENT` transactions (skipping the 2 zero-gap lines
  correctly); Stock on Hand immediately reflected the adjusted quantities.
  D-14 blind-count enforcement re-confirmed live (Attendant's submitted-
  session view never carries `expectedQty`/`gapQty` keys).
- *Prices match invoices*: weighted-average costing verified against real,
  hand-transcribed multi-date invoice prices (both the seeded two-delivery
  history and one live receive with a genuine price variance), matching
  hand-calculated expected values exactly in every case checked.
- *Staff can operate it unassisted*: walked every core workflow using only
  on-screen affordances, as a first-time user would; found and fixed the
  one real blocker (Prep's picker) that would have stopped an Attendant
  cold. No other blocking interaction issues found in this pass.
  **Not yet run: the actual one-real-week-in-parallel-with-paper trial**
  (feature plan §4's literal Gate text) — that's an operational next step
  for the client, not something a code session can complete; this
  session's job was confirming the trial is achievable, which it is.

**Verification**: `npx vitest run` (backend) — 647 tests passing across 64
files, unchanged pass count from Session 8 (this session added no new
backend code, only seed-script and one frontend line). `npx tsc --noEmit`
(frontend) — clean. `npx next build` — clean, all 12 `/app/inventory/*`
routes (11 + dashboard) present in the route manifest, exit code 0, zero
errors/warnings in the full build log.

**Docs updated**: `INVENTORY_FEATURE_PLAN.md` Status section — Phase 1
checked off complete with date. `CLAUDE.md` "Current Phase" — moved to
Phase 2 (Central Store → Branch Departments), planning-only, no session
plan built yet per this session's brief ("don't build Phase 2's session
plan unless asked; just flag it as follow-up").

**Flagged for whoever starts Phase 2 planning**: the invented placeholder
meat/dairy supplier and its 3 RAW items are clearly commented in
`seed-inventory-demo.ts` as non-client data — replace with the real
supplier's paperwork before the Gate trial or any client-facing demo, not
just before Phase 2 code starts. `INVENTORY_FEATURE_PLAN.md` §8.1's screen
table still doesn't list Dashboard as a formal row (flagged already by
Session 8 — still unresolved, low priority).

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

**Session 2, 2026-07-28 — `pnpm build` failed at pnpm's own install-gate, not
at the build.** In this sandbox, `pnpm build` (and `pnpm install`) aborted
with `[ERR_PNPM_IGNORED_BUILDS]` because a handful of transitive deps
(`@prisma/client`, `@prisma/engines`, `esbuild`, `msgpackr-extract`, etc.)
have postinstall scripts pnpm refuses to run without an explicit
`pnpm approve-builds`. This is a environment/lockfile policy issue unrelated
to this session's code. Verified the actual build was clean by running the
same steps `pnpm build` chains together directly: `npx prisma generate` then
`npx tsc -p tsconfig.json` (zero errors) — and ran the full suite via
`npx vitest run` (48 files, 484 tests, all passing). If a future session hits
the same `ERR_PNPM_IGNORED_BUILDS` wall, this is the workaround; fixing it
properly (`pnpm approve-builds`) is an environment change outside this
session's scope, left for whoever owns that call.

**Session 2, 2026-07-28 — `purchaseOrderLineId`/`stockCountLineId` back-links
left as plain columns, not resolved to FKs.** Session 1's As Built flagged
these as an open question. Session 2 does not write `stockCountLineId` at
all (that's Session 4's `adjustment` transactions) and writes
`purchaseOrderLineId` only as a plain string passed through from the caller
(Session 3 owns `PurchaseOrderLine`, which doesn't exist as a queryable
relation from this session's code). Left unresolved for Session 3/4 to decide
when they build the models these fields actually reference.

**Session 3, 2026-07-28 — `purchaseOrderLineId` FK left unresolved, as
Session 2 flagged; not addressed this session either.** Confirmed
`InventoryTransaction.purchaseOrderLineId` is still a plain `String?`
column, no FK, in the current schema. `purchase-order-service.receiveLine`
passes it through to `inventoryTransactionService.recordReceive` (which
accepts it as an optional plain string per Session 2's existing signature)
purely for audit traceability; no code in this session reads it back via a
relation. Left as-is — adding the FK is a schema/migration change outside
this session's CRUD-only scope, and neither Session 3 nor Session 4 (per the
brief) owns a migration step. Flagging again for whoever eventually revisits
the schema (likely Session 5's RBAC/reports audit, or later).

**Session 3, 2026-07-28 — PO numbering is a locally-generated string
(`PO-<yymmdd>-<4-char random suffix>`), not a counter table.** The brief's
"Follow customer-credit-* as the structural reference" didn't cover document
numbering, and the only precedent in the codebase is `order-repository.ts`'s
`allocateNextDailyNumber` + `OrderCounter` table — built for a
high-concurrency, must-never-collide path (every order, every day). Purchase
orders are created far less frequently by a small Central Store staff (1-2
people), so a per-organization counter table + retry/savepoint loop (the
`OrderCounter` pattern) was judged as more machinery than the problem needs.
`generatePoNumber()` in `purchase-order-service.ts` produces a
human-readable, date-prefixed string with a random suffix instead — collision
probability is negligible at this volume, and `poNumber` has no `@@unique`
constraint enforcing global uniqueness beyond `@@unique([organizationId,
poNumber])`, which a retry-on-conflict could be added for later if it ever
matters in practice. Flagging this as a deliberate simplification, not an
oversight, in case Session 5's audit or a future session wants a stricter
guarantee.

**Session 3, 2026-07-28 — receiving is implemented as two separate
`prisma.$transaction` calls, not one.** `inventoryTransactionService
.recordReceive` (Session 2) opens and commits its own `$transaction`
internally for the ledger write + `currentCost` update. `purchase-order
-service.ts`'s `receiveLine` cannot nest a second `$transaction` inside that
same interactive transaction from the outside (Prisma's interactive
transactions don't compose across separate `$transaction` calls on the same
client), so `receiveLine` calls `recordReceive` to completion first (its own
atomic unit), then opens a **second**, independent `$transaction` to update
the `PurchaseOrderLine`'s `receivedQty`/`invoicePrice` and the parent PO's
status. Practical effect: if the process crashes between the two
transactions, the `InventoryTransaction`/`currentCost` write would have
already committed while the PO line/status update would not have — leaving
the PO looking stale (still `SENT`) even though stock was received. This is
an accepted, narrow window (matches the brief's instruction to call Session
2's service rather than reimplementing its transaction), not something this
session attempted to close; worth a look if Session 5's audit wants a
reconciliation job or idempotency key for receiving.

**Session 4, 2026-07-28 — `gapQty` is hidden from Attendant alongside
`expectedQty`, though D-14's text only names `expectedQty`.** If `gapQty`
stayed visible on a submitted/approved count response, an Attendant could
recover the hidden `expectedQty` themselves via
`expectedQty = countedQty - gapQty` (they already know `countedQty`, since
they entered it), which would defeat the blind-count intent as surely as
returning `expectedQty` directly. Treated this as implied by D-14's spirit
rather than asked the user, since it's a straightforward algebraic
consequence, not a judgment call with real alternatives — flagged here so
a later session doesn't "fix" it back to spec-literal and reopen the leak.

**Session 4, 2026-07-28 — Waste Log Attendant visibility confirmed as
own-entries-only**, per the task brief's explicit instruction to flag
this rather than guess (feature plan §8.3 footnote). Asked the user
directly; confirmed own-entries-only over full-log-for-Attendant. Shipped
as `wasteLogService.list` filtering to `loggedById = actor.id` for a
`STORE_ATTENDANT` caller, `undefined` (no filter) for `STORE_MANAGER`.

**Session 4, 2026-07-28 — Supplier AP given its own repository file,
diverging from the "extend the narrow existing file" precedent Session 3
set for `InventoryItem`.** See this session's As Built "Decision" note
above for the full reasoning — different Prisma models with no shared
query surface, unlike Session 2/3's shared `InventoryItem` table.

**Session 5, 2026-07-28 — resolved the `purchaseOrderLineId`/`stockCountLineId`
FK question by adding the FKs, closing an open item carried since Session
2.** Neither report that could have used the back-link (count discrepancy,
price history) strictly needed it — both read `StockCountLine`/
`PurchaseOrderLine` directly. Added the FKs anyway because Session 4 had
already started writing unconstrained `stockCountLineId` values with no
schema guarantee they pointed at real rows, and this session was explicitly
flagged as the last realistic point to close this before Session 6+
frontend work assumes the current shape. See this session's As Built for
the migration details and why `prisma migrate dev` couldn't be used
directly (pre-existing, unrelated `payslips` drift from Session 1).

**Session 5, 2026-07-28 — reports layer built as its own simpler
`inventory-report-*` stack rather than extending the existing
`report-service.ts`/`report-repository.ts`.** The existing report layer
serves Director/Accountant/multi-branch reporting with significant
machinery (caching, date-range validation, export/PDF, branch-scoping
resolution) that Phase 1's reports don't need — Phase 1 is one location,
Manager-only, no date ranges on most reports. Extending the existing file
would have meant either bending its Director/Accountant-shaped API to fit a
Manager-only/single-location shape, or adding a pile of inventory-specific
branches to an already-large shared file. A new, small, self-contained
stack (repository → service → controller → route → validator, ~7 report
functions) was judged cleaner and matches Session 3/4's own repeated
precedent of "new model/domain, new file" when there's no real query
overlap.

**Session 6, 2026-07-28 — two backend gaps closed mid-frontend-session
rather than deferred, because Session 6's screens could not be built
without them.** (1) `GET /inventory-items` had no `onHandQty` field at all;
only `GET /inventory-items/low-stock` attached it, and only to items
already at/under reorder level. Stock on Hand needs it on every item.
Resolved by adding an optional `locationId` param to
`inventoryItemService.list` — see this session's As Built for the full
reasoning and why this was flagged to the user first rather than guessed.
(2) No `GET /locations` route existed, and no seed script had created the
one Phase 1 `CENTRAL_STORE` `Location` row Session 1's schema anticipated
— every other inventory screen needs this id. Built a full read-only
`location-*` stack plus a schema addition
(`@@unique([organizationId, type])`, migration
`20260728160000_inventory_location_unique_org_type`) and extended
`seed-dev.ts` to create it. Both gaps were pre-existing holes in the
Session 1–5 handoff, not something Session 6 was expected to introduce —
flagging here so Session 7/8 don't rediscover the same "wait, where does
this id come from" question.

**Session 6, 2026-07-28 — `PurchaseOrderLine.inventoryItem`'s frontend
type was initially wrong (assumed the full `InventoryItem` shape) and only
caught by manual in-browser testing, not by `tsc`.** `purchase-order-
repository.ts`'s `detailInclude` only ever selected
`{ id, name, buyUnit }` on that relation — Session 3 built it narrow on
purpose (this endpoint doesn't need the full item), but nothing on the
frontend side enforces response shapes at compile time (`apiClient.get<T>`
is an unchecked cast). The Receiving screen crashed with a live React error
until this was found and fixed. Flagging this not as a one-off bug but as a
standing risk for Sessions 7/8: any nested/partial-select relation from the
backend needs its frontend type written from the actual repository
`include`/`select`, not copied from that model's "full" shape used
elsewhere — and the only way this class of bug reliably surfaces is
exercising the screen in a real browser, which is why that step isn't
optional busywork.

**Session 7, 2026-07-29 — the session's original mockup-driven brief was
overridden by the user mid-session; screens were designed directly against
`docs/DESIGN_SYSTEM.md` instead.** Not a scope change in what got built
(all 9 remaining screens from §8.1 minus Prep Recipe, see below), only in
how — no mockup images were generated or referenced for any of this
session's screens.

**Session 7, 2026-07-29 — Suppliers and Supplier Invoices/AP were merged
into one screen, diverging from §8.1's two separate rows (#3 and #4).**
The user questioned the split after seeing `SupplierInvoice.supplierId`
is a direct FK — AP is inherently supplier-scoped data, not a separate
domain. Resolved as one `/app/inventory/suppliers` screen: a roster +
detail panel, with a `TabBar` inside the panel switching between "Items &
Pricing" (both roles) and "Accounts Payable" (Manager-only). The AP tab
is a conditionally-rendered UI element (`role === 'STORE_MANAGER'`)
rather than the RBAC boundary living at the route level, specifically
because §8.3 draws AP's Attendant boundary as strict zero-access, not
just no-edit — the user was asked directly whether that changes the
merge decision and confirmed the single-screen-with-conditional-tab
approach over keeping two routes. No backend change needed; the existing
Manager-only `supplier-invoice-routes.ts` RBAC middleware is the actual
enforcement, the frontend tab is just presentation.

**Session 7, 2026-07-29 — Prep Recipe editor (§8.1 row 9) was not
built; the user explicitly directed it be skipped.** Reasoning discussed
before the decision: a `PrepRecipe` is a derivative, "promote a
already-logged Prep Record" artifact (D-12 — recipes are never a
precondition for prepping), so on a fresh install the recipe list is
empty until a Prep Record exists to promote. The user agreed this made
it reasonable to defer entirely rather than build an empty-by-default
screen this session. `/app/inventory/prep-recipes` was removed from both
the Manager desktop sidebar and mobile tab-bar fallback in
`app/app/layout.tsx`; the backend `prep-recipes` read/promote routes from
Session 4 are untouched and unused by any Session 7 screen. Flagging for
whoever eventually revisits this: the promote action was meant to live on
a Prep Record's own detail view (§8.1 row 9's note, "Accessible from a
Prep Record's detail view via 'Save as Recipe'"), and Session 7's Prep
Entry screen doesn't have a Prep Record detail/history view at all yet —
that would need to exist before a recipe editor does.

**Session 7, 2026-07-29 — found and fixed a pre-existing architecture bug
in `app/app/layout.tsx` shared by every dual-shell role, not just
STORE_MANAGER.** `{children}` is mounted twice (desktop `SidebarLayout` +
CSS-hidden mobile `MobileLayout`) for MANAGER, DIRECTOR, ACCOUNTANT,
HR_MANAGER, SYSTEM_ADMIN, and STORE_MANAGER alike. Every desktop-only page
built this session (no mobile variant exists yet) was silently
double-mounted, double-fetching data and producing duplicate DOM element
ids. Fixed via a new `lib/shell-context.tsx` (`ShellProvider`/
`useIsDesktopShell`) that `layout.tsx` now provides at both `{children}`
call sites; all 8 affected Session 7 pages gate on it and render `null`
in the inapplicable mount. This was not scoped to Session 7's pages by
the bug itself — it's a property of the shared layout — but no earlier
session's Manager pages happened to trigger it, because they're written
as one genuinely-responsive component per screen (no desktop-only
components, no hardcoded element ids) rather than the "separate
purpose-built desktop and mobile component per screen" approach §8.0
calls for. Flagging explicitly for Session 8: a **second**, separate
mobile component for any of these screens (rather than making the
existing desktop component itself responsive) will need the mirrored
guard (`if (isDesktop) return null`) on the mobile side too, or the same
double-mount bug reappears in reverse.

**Session 8, 2026-07-29 — dashboard was scoped out, then built anyway at
explicit user request mid-session; feature plan §8.1 still doesn't list
it.** `dashboard/page.tsx` predates §8.1's screen table and was never
part of the Session 6/7/8 spec — Session 7's As Built explicitly frames
its own screen list as starting at Stock on Hand. This session initially
found it live-broken for STORE_MANAGER on mobile (no shell guard at all,
so it double-mounted/double-fetched, the same bug class Session 7's
`useIsDesktopShell()` fix addressed everywhere else) and applied the
minimal fix: guard it, redirect the mobile copy to Stock on Hand. The user
then directed that a real mobile Dashboard screen be built instead of a
redirect. Built as `InventoryDashboardMobile` (see this session's As
Built above) and wired into `mobileRoleTabs.STORE_MANAGER` as the primary
landing tab. Flagging for whoever next touches `INVENTORY_FEATURE_PLAN.md`
§8.1: that table should probably gain a Dashboard row now that both a
desktop and mobile version genuinely exist, so a future session doesn't
rediscover this same "is this in scope" question from scratch.

**Session 8, 2026-07-29 — a worktree-isolated verification subagent cannot
see uncommitted changes; re-dispatch without isolation for any
in-progress-branch work.** The first attempt at this session's in-browser
verification step was dispatched with `isolation: "worktree"`, which git-
worktrees the *committed* state of the current branch into a separate
checkout. Since this entire session's work was still uncommitted in the
main working tree, the isolated agent landed on a stale, unrelated commit
(`feature/inventory-phase1` at a point before this feature existed at all)
and correctly refused to proceed rather than force its way into the main
checkout. Re-dispatched without `isolation`, pointed explicitly at
`/home/edwinfred/projects/V3-RMS` (the main checkout) — this succeeded.
Flagging for any future session: subagent worktree isolation is for
committed-history-safe parallel work, not for verifying uncommitted
in-progress changes: use no isolation (or commit first) when the code
under test isn't committed yet.

**Session 8, 2026-07-29 — two real bugs found by the dispatched verification
agent, both fixed and independently re-verified.**
1. **Prep and Waste entry rendered completely blank for STORE_MANAGER on
   mobile.** `prep/page.tsx` and `waste/page.tsx`'s dispatchers routed
   `role === 'STORE_MANAGER'` unconditionally to `PrepEntryDesktop`/
   `WasteLogDesktop` regardless of shell — those desktop components
   correctly self-guard to `null` on the mobile shell (per Session 7's
   pattern), but nothing in the dispatcher ever rendered the shared
   Attendant mobile UI for Manager's mobile-shell copy. This session's own
   original As Built claim that "Manager mobile already reuses Attendant's
   existing screens via the pre-existing dispatcher, unchanged" was wrong
   — the dispatcher never had a mobile-shell branch to begin with; nobody
   had traced the render path all the way through for Manager-on-mobile
   specifically before the verification pass. Fixed by adding
   `useIsDesktopShell()` to both dispatchers: `role === 'STORE_MANAGER' &&
   isDesktop` now gates the desktop branch, so Manager's mobile-shell copy
   correctly falls through to the shared Attendant component (verified
   safe for `STORE_ATTENDANT` too — it's a single-shell role that always
   gets `isDesktop === false` from `ShellProvider value="mobile"`, so the
   role check alone already excluded it; the shell check only changes
   Manager's behavior). Re-verified live post-fix: both screens now render
   their full step-flow content for `store.manager@wendo.test` on mobile.
2. **Several fixed-bottom action bars and floating action buttons rendered
   underneath the mobile nav bar, not above it.** `components/ui/
   MobileLayout.tsx`'s bottom tab bar is `z-40`; this session's new
   fixed-bottom confirm bars/sheets (Item Catalog's save bar, Suppliers'
   and Catalog's FABs, Stock Count's approval bar, PO detail's Send/Cancel
   bar) and reused-but-untouched Session 6 bars (Prep's confirm bar,
   Receiving's confirm bar, New PO's save bar) were all `z-30` —
   underneath the nav bar, not above it. Stock Count's Approve button was
   confirmed **fully unclickable** (a scripted click at its own on-screen
   coordinates was intercepted by the nav bar's container). Fixed by
   raising every full-width fixed-bottom bar and bottom-sheet overlay
   touched or introduced this session to `z-50` (clearly above the nav's
   `z-40`), and floating action buttons (`bottom-6 right-4`) to `bottom-24
   z-40` to sit visually above the nav bar with clearance, matching the
   `bottom-24` pattern the working Purchase-Orders-list FAB already used.
   Re-verified live post-fix via bounding-box checks: the Catalog FAB's
   bottom edge (y=748) now sits above the nav bar's top edge (y=780) with
   a 32px gap; Stock Count's Approve & Post Adjustments button is fully
   visible and positioned correctly in a live screenshot. Flagging for
   Session 9's integration pass: this `z-30`-under-a-`z-40`-nav pattern may
   still exist on any Session 6 mobile screen this session didn't touch —
   worth a final sweep.

**Session 9, 2026-07-29 — a second, distinct z-index bug class found:
sheet-over-fixed-bar, not fixed-bar-under-nav.** Session 8's z-index sweep
(re-run and confirmed clean at the start of Session 9 by a second agent
working in parallel) checked every fixed-bottom bar/FAB against the mobile
nav's `z-40`. It did not — and had no reason to, given its own scope — check
whether a *sheet or overlay opened on top of an already-fixed-bottom-bar
screen* itself clears that bar. Prep Entry's `ItemPickerSheet` (`frontend/
app/app/inventory/prep/page.tsx`) is exactly this case: the page's own
"Confirm Prep" bar is correctly `z-50` (already fixed, not part of this
bug), but the item-picker sheet that opens on top of it — for both the
output-item and every input-item selection — was `z-40`, one layer
*beneath* that bar, so the sheet's item list was physically unclickable
across its full height. Caught only by a real Playwright click attempt
(`subtree intercepts pointer events`), not by any screenshot — the sheet's
header and search box render fine; only the list underneath is affected,
and a static screenshot doesn't reveal that it's unclickable. Fixed by
raising the sheet to `z-[60]`. Flagging the general pattern for future
sessions: any bottom-sheet/modal opened *from* a screen that already has
its own fixed-bottom action bar needs a z-index strictly above that bar,
not just above the nav — z-index sweeps that only compare against the nav
bar's `z-40` will miss this class entirely.

---

*Created 2026-07-28. Companion to
`docs/context/INVENTORY-FEATURE/INVENTORY_FEATURE_PLAN.md` (the feature spec)
— this file is the session-sequencing/handoff mechanism only. Update the
Status table and per-session As Built sections as each session completes; do
not let this file drift out of sync with actual progress, since it is the
only thing the next session reads to know where to resume.*
