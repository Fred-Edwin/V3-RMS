# Inventory & Procurement — High-Level Plan (Step 5)

**Feature:** Inventory & Procurement (Feature 1 of the redo)
**Milestone:** **One — Catalog, Suppliers & Restock Levels**
**Step:** 5 of the per-feature pipeline — high-level plan
**Status:** Draft — **owner approval required before Step 6/7**
**Date:** 2026-09-15

**Traces to:**
`01-description.md` (§3 Stage 1, §4 item types/units/par levels, §7) ·
`02-flows.md` (Flow 18 catalog maintenance, Flow 19 par-level maintenance) ·
`02-screens.md` (F1, F2, F3, A3-create/edit) ·
`03-design.md` + Paper page `B-0` (`01M1ZZJ6S3FZGF5C7PPBGTKY89`) ·
`04-components.md` (the built component set this plan targets) ·
`docs/FEATURE_REDO_PLAYBOOK.md` §5 Step 5, §7, §9 ·
`docs/inventory/CENTRAL_STORE_SCOPING_DESIGN.md` (D-15).

---

## 0. Scope of this milestone

Six screens, all on Paper page `B-0`, all reviewed directly this session:

| # | Screen | Artboard | Surface |
|---|---|---|---|
| 1 | Item catalog · desktop | `SFQ-0` | route |
| 2 | Item create/edit · desktop | `SKV-0` | drawer (500px) |
| 3 | Manage categories · desktop | `SRB-0` | drawer (420px) |
| 4 | New/edit supplier · desktop | `SX5-0` | drawer (460px) |
| 5 | Restock levels (Central Store) · desktop | `T52-0` | drawer (440px) |
| 6 | Restock levels (department) · mobile | `TD1-0` | full-screen route |
| 1m–5m | Mobile counterparts (Store Manager) | `TLT-0` `TLU-0` `TLV-0` `TLW-0` `TLX-0` | full-screen routes |

Paper's own page guide (`TEK-0`) states the scope precisely: *"Foundational
reference data: item types/units/department scoping (Flow 18), supplier records,
and restock levels (Flow 19). Everything else in the feature references items and
suppliers defined here."*

**In scope:** the catalog (items + categories), supplier records, restock levels
at both the Central Store and the department, and the read models the six screens
need (item counts, category counts, supplier count, per-item on-hand).

**Explicitly out of scope for Milestone One** — named here so build sessions
don't drift into them: goods receipts, purchasing, supplier AP/invoices/payments,
prep, requisitions, dispatch, counts, waste, the ledger's *write* paths, signing,
and printing. Milestone One only ever **reads** the ledger (for the on-hand column
on the restock screens).

---

## 1. Schema evaluation — keep, extend, or replace

### 1.1 What is actually there

Confirmed by direct inspection of `backend/prisma/schema.prisma` and the local
database this session (not taken from the orchestrator brief):

- Migration `20260728101631_inventory_phase1_schema` and successors are applied.
  An earlier schema was already dropped once —
  `20260728101630_drop_legacy_inventory_v2` — so **drop-and-replace of inventory
  tables has a direct precedent in this codebase.**
- 23 inventory tables exist. **All are empty locally** (verified via
  `pg_stat_user_tables`: every inventory table `n_live_tup = 0`; the whole local
  DB holds 1 user and 0 organizations).
- Legacy backend code is **fully wired into live routes** — `routes/index.ts`
  mounts 12 inventory routers (`inventory-item`, `supplier`, `purchase-order`,
  `prep-record`, `stock-count`, `waste-log`, `supplier-invoice`,
  `inventory-report`, `location`, `department`, `requisition`, `dispatch`).
- **Dependency isolation is excellent.** The only files outside the inventory
  code itself that reference inventory models are `routes/index.ts` and four
  demo-seed scripts (`seed-pilot-demo.ts`, `seed-pilot-demo-local.ts`,
  `seed-price-history-demo.ts`, `teardown-pilot-demo.ts`). No orders, HR, comms,
  reports, or auth code touches an inventory model. Retiring inventory code does
  not ripple into any other feature.

### 1.2 The three structural mismatches — confirmed, with a fourth found

The orchestrator brief flagged three and asked me to confirm rather than assume.
All three confirmed; **a fourth, larger one found**:

1. **No `Category` model exists — confirmed.** Nothing in the schema stores a
   category. Paper's `SRB-0` shows categories as first-class, owner-named,
   renameable, retireable records carrying a live item count ("Dry goods · 38
   items · Rename", "Seasonal (retired) · 0 items · Restore"). This cannot be a
   string column on `InventoryItem`: renaming must update every item at once, and
   a retired category with zero items must still exist as a row.
2. **`InventoryItemType` naming mismatch — confirmed, and the concepts *do*
   match.** Schema is `RAW / PREPPED / PASS_THROUGH`; Paper and the built
   components use `Raw ingredient / Prepped item / Stocked item`. I checked
   whether `PASS_THROUGH` and "Stocked" are genuinely the same concept before
   mapping them: `01-description.md` §4 is explicit — *"The third category was
   previously called 'pass-through' … It is now a **stocked item**: something
   held and issued exactly as it was bought"* — and §7 lists *"'Pass-through' is
   renamed 'stocked item'"* under renames, not under behaviour changes. **Same
   concept, new name.** So this is a rename, not a remodel. (It still requires a
   destructive enum change, since Postgres enum values cannot be renamed through
   Prisma's generated migration without a hand-written step.)
3. **Hub-org scoping is structurally present but never exercised by real data —
   confirmed.** `Organization.isHub` exists, the one-Central-Store partial unique
   index exists (migration `20260731090000`), and service guards exist. Zero
   organizations exist locally, so **none of it has ever been exercised against
   real rows anywhere.** Treat D-15 enforcement as unverified code, not as
   proven-working infrastructure — Milestone One is the first thing that will
   genuinely test it, and its tests must cover it explicitly (§6).
4. **(New) `InventoryItem.departmentTags` is a `DepartmentTag[]` array column,
   with no constraint tying it to item type.** The approved design requires that
   a raw ingredient can *never* be department-scoped (`01-description.md` §4:
   *"enforced at the data level, not by convention"*; Flow 18's error path:
   *"Trying to scope a raw ingredient to a department → blocked"*). A bare array
   column enforces nothing. This is the single most important new data-level rule
   in the milestone and the current schema cannot express it.

Two further mismatches worth stating:

5. **`reorderLevel` is a non-null column on `InventoryItem`** — one global number
   per item. The approved design has restock levels **per (item, location)**, set
   by different people (Store Manager for the store, each department head for
   their own department), and **optional**. `ParLevel` already models exactly
   this, correctly keyed `@@unique([locationId, inventoryItemId])`. So
   `InventoryItem.reorderLevel` is a redundant second source of truth for the
   same fact and must go.
6. **`Supplier` has no `category`, no `location`, and no `defaultPaymentTerms`.**
   All three appear on Paper: `SX5-0`'s drawer has a Category select and a
   Default-payment-terms toggle; the supplier detail behind it shows a
   `LOCATION · Nyeri town` field. Payment terms is load-bearing beyond this
   milestone — it pre-fills the per-receipt toggle in Stage 2 receiving.

### 1.3 Decision, per table

The governing facts: **no real client data has ever existed in these tables**
(`01-description.md` §0: *"deployed to production but has never been used — not
one real delivery, prep run, or count"*), local is confirmed empty, and there is
an in-repo precedent for dropping inventory schema wholesale.

Given that, preserving a schema that doesn't match the approved design buys
nothing and costs a permanent compatibility tax. **The decision is
drop-and-replace for everything this milestone owns, additive-only elsewhere.**

| Table | Decision | Why |
|---|---|---|
| `InventoryItem` | **Drop & replace** | Needs `categoryId`, `packSize`, `preferredSupplierId`, nullable conversion, `deletedAt`; loses `reorderLevel`; `departmentTags` becomes constrained. More changed than kept. |
| `Supplier` | **Drop & replace** | Needs `categoryId`, `location`, `defaultPaymentTerms`, `deletedAt`. |
| `ParLevel` | **Drop & replace as `RestockLevel`** | Right shape, wrong name for the approved vocabulary, and needs `deletedAt` semantics + a nullable-clearing story. Renaming is the same migration cost as replacing. |
| `Category` | **Create (new)** | Doesn't exist. |
| `InventoryItemType` enum | **Drop & replace** (`RAW_INGREDIENT / PREPPED / STOCKED`) | Rename only; Postgres enums can't be safely renamed in place via Prisma. |
| `Location`, `DepartmentTag`, `LocationType` | **Keep unchanged** | Correct as-is and already carry the D-15 partial unique index. Milestone One reads them; a later milestone may extend them. |
| `InventoryTransaction` | **Keep unchanged this milestone** | Milestone One only reads it (on-hand). Its redo belongs to the milestone that owns the ledger's write paths. |
| `SupplierItem` | **Drop, not replaced** | Its only real job was `lastPrice` + default-supplier. Default supplier becomes `InventoryItem.preferredSupplierId` (Paper: *"a default reference only"*). Price history belongs to the receiving milestone, against goods receipts, not to a catalog join table. |
| `PurchaseOrder`, `PurchaseOrderLine`, `PurchaseOrderStatus` | **Drop, not replaced** | `01-description.md` §7: *"Purchase orders are removed entirely … [Biggest deletion — check this first]"*. |
| `MarketPurchase`, `MarketPurchaseLine` | **Drop, not replaced** | §7: *"Direct market purchase is removed"* — single inbound funnel. |
| `PrepRecipe`, `PrepRecipeLine` | **Drop, not replaced** | §3 Stage 3: prep is recorded after the fact, never from a recipe. |
| `SupplierInvoice`, `SupplierPayment`, `PrepRecord(+Line)`, `StockCount(+Line)`, `WasteLog`, `Requisition(+Line)`, `Dispatch(+Line)` | **Drop now, replace in their own milestone** | All empty, all being redesigned, all currently referencing tables this milestone replaces. Keeping them would force FK gymnastics against a schema they'll be rewritten against anyway. |

> **⚠ This is the one genuinely irreversible decision in this plan and the one
> most worth the owner's attention.** It is safe *because* no real data exists —
> which is asserted by `01-description.md` §0 and verified locally, but **not yet
> verified on production**. §2.1's production query must come back clean before
> any migration is written. If production turns out to hold rows the owner wants
> to keep, this decision reopens.

### 1.4 Legacy backend code retirement

Per the playbook (*"old code is removed in the same PR that ships its
replacement"*), retirement is part of this milestone, not a later cleanup.

**Removed in the PR that ships Milestone One's backend** (they query tables this
milestone drops, so they cannot survive it):

- `routes/`: `inventory-item-routes.ts`, `supplier-routes.ts`,
  `purchase-order-routes.ts`, `prep-record-routes.ts`, `stock-count-routes.ts`,
  `waste-log-routes.ts`, `supplier-invoice-routes.ts`,
  `inventory-report-routes.ts`, `requisition-routes.ts`, `dispatch-routes.ts`
  (+ their `routes/index.ts` wiring)
- matching `controllers/`, `services/`, `repositories/`, `validators/` files
- `repositories/par-level-repository.ts`,
  `services/inventory-transaction-service.ts` +
  `repositories/inventory-transaction-repository.ts`

**Kept:** `location-routes.ts` / `department-routes.ts` and their layers — they
serve `Location`/`DepartmentTag`, which this milestone keeps. They migrate into
`modules/inventory/` in the milestone that owns locations properly; moving them
now would be the "separate refactor" the playbook forbids.

**Demo-seed scripts** (`seed-pilot-demo.ts`, `seed-pilot-demo-local.ts`,
`seed-price-history-demo.ts`, `teardown-pilot-demo.ts`, `seed-inventory-demo.ts`)
reference dropped models and will not compile. They are **deleted**, replaced by
one new seed built from the reference photos (§4).

**Frontend retirement** is deferred to the frontend session (§5) — those pages
call endpoints that disappear, so they're removed in the same PR as their
replacement screens. `app/app/inventory/{catalog,suppliers}` are replaced by
Milestone One; the rest (`purchase-orders`, `receiving`, `prep`, `stock-counts`,
`stock`, `waste`, `reports`, `dashboard`, `attendant-dashboard`, `staff`) call
endpoints this milestone removes and must come down with them. **This leaves a
visible functionality gap in the app between Milestone One and the milestones
that restore those screens — that is a direct consequence of the never-used
feature being rebuilt, and the owner should confirm they accept it.** (It is the
option the description already chose in §0; flagged here because it becomes real
at merge time, not at plan time.)

---

## 2. Production data check — **RESULTS IN, 2026-09-15**

**Owner ran the queries; drop-and-replace is confirmed GO.** Findings:

| Table | Rows | | Table | Rows |
|---|---|---|---|---|
| `inventory_items` | 23 | | `stock_count_lines` | 56 |
| `inventory_transactions` | 37 | | `stock_counts` | 4 |
| `supplier_items` | 23 | | `supplier_invoices` | 3 |
| `purchase_order_lines` | 14 | | `prep_records` | 3 |
| `purchase_orders` | 6 | | `supplier_payments` | 2 |
| `suppliers` | 3 | | `waste_logs`, `prep_recipes`, `locations` | 1 each |
| `par_levels`, `requisitions`, `dispatches`, `market_purchases` | 0 | | | |

**Confirmed demo data, not real client data.** The item names are invented
showcase names — *Sunrise Cooking Oil*, *Golden Crown Sugar*, *Millers Choice
Baking Flour*, *Aberdare Fresh Farm Supplies* — none of which appear on any real
invoice in `reference-photos/`, and every supplier email is `*.example`. Nothing
here is worth preserving. **§1.3's drop-and-replace proceeds as written.**

Three findings that change the plan:

1. **`inventory_transactions` holds 37 rows, and §4 step 2 assumed it was
   empty.** It isn't. Those 37 rows are demo ledger entries pointing at items
   that are about to be deleted, so they cannot be kept — they'd be orphaned
   history describing products Wendo never bought. **§4 is amended: truncate
   `inventory_transactions` as an explicit step rather than relying on it being
   empty.** This is the one place the original migration sketch would have
   failed on a FK constraint.
2. **The enum distribution confirms the type mapping is a pure rename:**
   `RAW` 16 · `PASS_THROUGH` 6 · `PREPPED` 1. Three values in use, three values
   in the new enum, no value in production that the new enum can't express.
3. **The unit vocabulary settles §3.2 decisively — units must stay free text.**
   19 distinct buy-unit/usage-unit pairs across just 23 items, including
   `bale (12x2kg)`, `ctn (12x1L)`, `box (72x100g)`, `20L jerrican`, `kg pkt`,
   `tray`, `pouch`, `cup`. No enum survives this, and it matches the reference
   photos exactly.

**One query did not run** — `SELECT ... is_hub FROM organizations` failed with
`column "is_hub" does not exist` (the column is quoted-camelCase `"isHub"`, which
is a real inconsistency in the schema: `Organization.isHub` has no `@map`, unlike
every other column). **The hub/location/role checks are therefore still
outstanding and remain a hard precondition** (§4). The corrected query:

```bash
cd ~/wendo-rms
docker compose exec postgres psql -U wendo_user -d wendo_rms -c '
SELECT id, name, "isHub", "isActive" FROM organizations ORDER BY "isHub" DESC, name;
SELECT l.id, l.type, l.department_tag, l.name, o.name AS org, o."isHub"
  FROM locations l JOIN organizations o ON o.id = l.organization_id ORDER BY l.type;
SELECT role, count(*) FROM users
  WHERE role IN (''STORE_MANAGER'',''STORE_ATTENDANT'',''DEPARTMENT_HEAD'') GROUP BY role;'
```

`locations` having exactly 1 row is consistent with a single Central Store, but
**which org owns it is the thing still unverified** — if it sits on a non-hub org,
that's a blocker to fix before deploy, not after.

<details>
<summary>Original queries (kept for the record)</summary>

### Queries as originally issued

Per playbook §7, agents don't SSH. Please run these on the droplet and paste the
output back. **I already expect these rows to be your own demo seed, not real
client data** — this is checking volume and shape (and that nothing unexpected
accumulated), not authenticity.

```bash
cd ~/wendo-rms
docker compose exec postgres psql -U wendo_user -d wendo_rms -c "
SELECT 'inventory_items' t, count(*) FROM inventory_items
UNION ALL SELECT 'suppliers', count(*) FROM suppliers
UNION ALL SELECT 'supplier_items', count(*) FROM supplier_items
UNION ALL SELECT 'par_levels', count(*) FROM par_levels
UNION ALL SELECT 'locations', count(*) FROM locations
UNION ALL SELECT 'purchase_orders', count(*) FROM purchase_orders
UNION ALL SELECT 'purchase_order_lines', count(*) FROM purchase_order_lines
UNION ALL SELECT 'supplier_invoices', count(*) FROM supplier_invoices
UNION ALL SELECT 'supplier_payments', count(*) FROM supplier_payments
UNION ALL SELECT 'inventory_transactions', count(*) FROM inventory_transactions
UNION ALL SELECT 'stock_counts', count(*) FROM stock_counts
UNION ALL SELECT 'stock_count_lines', count(*) FROM stock_count_lines
UNION ALL SELECT 'waste_logs', count(*) FROM waste_logs
UNION ALL SELECT 'prep_records', count(*) FROM prep_records
UNION ALL SELECT 'prep_recipes', count(*) FROM prep_recipes
UNION ALL SELECT 'requisitions', count(*) FROM requisitions
UNION ALL SELECT 'dispatches', count(*) FROM dispatches
UNION ALL SELECT 'market_purchases', count(*) FROM market_purchases
ORDER BY 1;"
```

```bash
# Shape checks — enum distribution, unit vocabulary, and hub/location state.
docker compose exec postgres psql -U wendo_user -d wendo_rms -c "
SELECT type, count(*) FROM inventory_items GROUP BY type;
SELECT buy_unit, usage_unit, count(*) FROM inventory_items
  GROUP BY 1,2 ORDER BY 3 DESC LIMIT 30;
SELECT id, name, is_hub, is_active FROM organizations ORDER BY is_hub DESC, name;
SELECT l.id, l.type, l.department_tag, l.name, o.name AS org, o.is_hub
  FROM locations l JOIN organizations o ON o.id = l.organization_id ORDER BY l.type;
SELECT role, count(*) FROM users
  WHERE role IN ('STORE_MANAGER','STORE_ATTENDANT','DEPARTMENT_HEAD') GROUP BY role;"
```

```bash
# Sample rows — the shape of what's actually in the catalog today.
docker compose exec postgres psql -U wendo_user -d wendo_rms -c "
SELECT name, type, buy_unit, usage_unit, conversion_factor, reorder_level,
       department_tags, current_cost, is_active
  FROM inventory_items ORDER BY created_at LIMIT 25;
SELECT name, contact_name, phone, email, is_active FROM suppliers LIMIT 25;"
```

**What each answer changes:**

- **All zero / only demo rows** → §1.3's drop-and-replace proceeds as written.
- **Any table non-trivially populated with rows you want to keep** → stop; §1.3
  reopens and we design a data-preserving migration instead.
- **`organizations.is_hub` has no `true` row, or more than one** → a **blocker**
  for D-15. Every Milestone One write is hub-scoped; there must be exactly one
  hub org before any of this can run in production.
- **No `CENTRAL_STORE` location, or one on a non-hub org** → same blocker class;
  the restock-level screens have no location to write against.
- **`buy_unit`/`usage_unit` distribution** → informs the seed's unit vocabulary
  and confirms free-text units (§3.2) rather than an enum.

</details>

---

## 3. Data model

### 3.1 New and changed models

Target Prisma shape. Field names are the contract; exact `@db` types follow
existing conventions (`Decimal(12,4)` for quantities, `Decimal(12,2)` for money).

```prisma
enum InventoryItemType {
  RAW_INGREDIENT   // Central Store only — never department-scoped
  PREPPED          // produced by a prep run
  STOCKED          // held and issued exactly as bought (was PASS_THROUGH)
}

enum SupplierPaymentTerms {
  INVOICE_TO_FOLLOW   // billed, settled later on account
  PAY_NOW             // paid on the spot; no AP created
}

/// Owner-named labels for organising the catalog. Shared by items and
/// suppliers (Paper SRB-0 + SX5-0 both draw from one list).
model Category {
  id             String    @id @default(uuid())
  organizationId String    @map("organization_id")
  name           String
  deletedAt      DateTime? @map("deleted_at")   // retire; never hard-delete
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")

  organization Organization    @relation(fields: [organizationId], references: [id])
  items        InventoryItem[]
  suppliers    Supplier[]

  // Case-insensitive uniqueness among LIVE categories only — enforced by a
  // partial unique index on lower(name) WHERE deleted_at IS NULL (raw SQL;
  // not expressible in the Prisma DSL). A retired "Seasonal" must not block
  // creating a new "Seasonal".
  @@index([organizationId])
  @@map("categories")
}

model InventoryItem {
  id                  String            @id @default(uuid())
  organizationId      String            @map("organization_id")
  name                String
  type                InventoryItemType
  categoryId          String?           @map("category_id")
  preferredSupplierId String?           @map("preferred_supplier_id")

  buyUnit          String   @map("buy_unit")          // free text: bag, crate, jerrican, ctn
  usageUnit        String   @map("usage_unit")        // free text: kg, L, ml, pcs
  conversionFactor Decimal? @map("conversion_factor") @db.Decimal(12, 4)  // null = "no conversion"
  packSize         Decimal? @map("pack_size") @db.Decimal(12, 4)          // null = "—"

  departmentTags DepartmentTag[] @map("department_tags")  // MUST be [] when type = RAW_INGREDIENT
  currentCost    Decimal         @default(0) @map("current_cost") @db.Decimal(12, 4)

  deletedAt DateTime? @map("deleted_at")   // retire; history preserved
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")

  organization      Organization   @relation(fields: [organizationId], references: [id])
  category          Category?      @relation(fields: [categoryId], references: [id])
  preferredSupplier Supplier?      @relation(fields: [preferredSupplierId], references: [id])
  restockLevels     RestockLevel[]
  transactions      InventoryTransaction[]

  @@index([organizationId])
  @@index([categoryId])
  @@index([organizationId, deletedAt])   // the catalog list's default filter
  @@map("inventory_items")
}

model Supplier {
  id             String               @id @default(uuid())
  organizationId String               @map("organization_id")
  name           String
  contactName    String?              @map("contact_name")
  categoryId     String?              @map("category_id")
  phone          String?
  email          String?
  location       String?                                    // free text, e.g. "Nyeri town"
  defaultPaymentTerms SupplierPaymentTerms @default(INVOICE_TO_FOLLOW) @map("default_payment_terms")

  deletedAt DateTime? @map("deleted_at")
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")

  organization   Organization    @relation(fields: [organizationId], references: [id])
  category       Category?       @relation(fields: [categoryId], references: [id])
  preferredForItems InventoryItem[]

  @@index([organizationId])
  @@index([organizationId, deletedAt])
  @@map("suppliers")
}

/// Replaces ParLevel. One per (location, item). Set by whoever owns the stock:
/// Store Manager for the Central Store, each department head for their own
/// department (01-description.md §4).
model RestockLevel {
  id              String   @id @default(uuid())
  organizationId  String   @map("organization_id")
  locationId      String   @map("location_id")
  inventoryItemId String   @map("inventory_item_id")
  level           Decimal  @map("level") @db.Decimal(12, 4)  // in the item's usage unit
  setById         String   @map("set_by_id")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  organization  Organization  @relation(fields: [organizationId], references: [id])
  location      Location      @relation(fields: [locationId], references: [id])
  inventoryItem InventoryItem @relation(fields: [inventoryItemId], references: [id])
  setBy         User          @relation("RestockLevelSetBy", fields: [setById], references: [id])

  @@unique([locationId, inventoryItemId])
  @@index([organizationId])
  @@index([inventoryItemId])
  @@map("restock_levels")
}
```

### 3.2 Model decisions, with rationale

**Category is a table, not a string, and is shared by items and suppliers.**
`SRB-0` requires rename-updates-every-item, retire-keeps-history, and a live item
count per category — all of which need a row. `SX5-0`'s supplier drawer shows a
Category select whose values ("Dairy") match the item categories, and the
reference photos corroborate this grouping (photo 20 shows the client's own paper
sheets sectioned as "MARKET ITEMS" / "DRY ITEMS"). Two separate category tables
would be a guess; one shared list is what the design draws. **Flagged as an
assumption worth an explicit owner nod** — if supplier categories are meant to be
a different vocabulary (e.g. "Butchery", "Supermarket"), say so and this splits
into `Category` + `SupplierCategory` before the contract freezes.

**Units are free text, not an enum.** The reference photos settle this: Samrat's
invoice (photo 1) prices in `KG`, `LTR`, `BOX`, `SACH`, `CTN`, `PKT`, `POUCH`,
`GM`, `PCS`; Summer Limited's (photo 5) uses `bls`, `j.can`, `ctn`. Paper's own
catalog shows `bag`, `crate`, `jerrican`, `bottle`, `litres`, `kg`, `L`, `ml`,
`pcs`. No closed set survives contact with this business. The §2 production query
on the existing unit distribution is the final check.

**`conversionFactor` and `packSize` are nullable.** `SFQ-0` renders "Coffee beans
· kg · no conversion" and "Chicken stock · litres · no conversion · —" for pack.
A prepped item measured in one unit has no buy/usage conversion at all. The
current non-null `conversionFactor` cannot represent this.

**`InventoryItem.reorderLevel` is deleted.** Restock levels are per-location
(§1.2 point 5). Keeping a global column alongside `RestockLevel` would guarantee
the two disagree.

**Raw ingredients cannot be department-scoped — enforced at three layers**, since
the description demands data-level enforcement and a Postgres array column can't
express it alone:
1. **Service** — `ValidationError` on any create/update where
   `type === RAW_INGREDIENT && departmentTags.length > 0`, and on a type change
   *into* `RAW_INGREDIENT` while tags are non-empty.
2. **Zod** — a discriminated refinement on the request body, so it fails at the
   edge with a field-level message the form can render.
3. **Database** — a `CHECK` constraint added by raw SQL in the migration:
   `CHECK (type <> 'RAW_INGREDIENT' OR cardinality(department_tags) = 0)`.
   This is the layer that makes it a data rule rather than a convention.

**Soft delete via `deletedAt`, never `isActive`.** `02-screens.md` F1/F2 and
Flow 18 both specify `deleted_at` semantics and "no hard delete". The existing
`isActive` boolean loses *when* something was retired, which `SFQ-0` renders
("Retired 04 Aug · history kept"). `isActive` is dropped on all three models.

**Case-insensitive uniqueness among live rows only.** Applies to `Category.name`
and `Supplier.name` (partial unique index on `lower(name) WHERE deleted_at IS
NULL`). Item names are deliberately **not** unique — Flow 18 specifies duplicate
item names are *warned, then allowed with a qualifier*, which is a service-level
soft check returning a warning, not a constraint.

**`InventoryTransaction` keeps its existing `InventoryItem` FK** and is otherwise
untouched. Its `type` enum still contains values for dropped flows
(`market_receive` etc.); that cleanup belongs to the ledger's own milestone, not
here — changing it now would be scope creep with no screen behind it.

### 3.3 Indexes and constraints — summary

| Object | Purpose |
|---|---|
| `@@index([organizationId])` on all four models | Non-negotiable #3's access path |
| `@@index([organizationId, deletedAt])` on items, suppliers | Catalog/supplier lists default to live-only |
| `@@index([categoryId])` on items | Category filter chip + per-category item count |
| `@@unique([locationId, inventoryItemId])` on `RestockLevel` | One level per item per location; the upsert key |
| Partial unique `lower(name) WHERE deleted_at IS NULL` on categories, suppliers | Live-name uniqueness that a retired row doesn't block |
| `CHECK (type <> 'RAW_INGREDIENT' OR cardinality(department_tags) = 0)` | Data-level raw-ingredient rule |
| Existing one-Central-Store partial unique index | Unchanged — D-15 |

---

## 4. Migration plan

This is a **drop-and-recreate against a live deployed schema**, not a
from-scratch migration. It must be a real, committed, hand-checked migration
file, and it follows `CLAUDE.md`'s workflow exactly: edit schema locally →
`npx prisma migrate dev --name …` → **hand-edit the generated SQL** → commit →
push → CI runs `prisma migrate deploy`.

**Preconditions:**
1. ~~§2's production counts returned, confirming no rows worth keeping.~~
   **✅ Done 2026-09-15** — all demo data, nothing worth preserving.
2. ~~Exactly one `organizations."isHub" = true` row exists in production.~~
   **✅ Confirmed 2026-09-15** — one hub org, `"Central Store"`
   (`2223e6f9-1567-42a8-b1b6-50a86b288863`), alongside three branch orgs
   (King'ong'o, Nyeri Town, Wendo Nyahururu).
3. ~~A `CENTRAL_STORE` location exists on **that** hub org.~~
   **✅ Confirmed 2026-09-15** — exactly one `locations` row,
   `f4e55452-3d51-4a8f-9e30-3b46fa445b88`, type `CENTRAL_STORE`, `department_tag`
   null, owned by the hub org. Precisely the D-15 shape.

**All migration preconditions are met. Session 2 is clear to write the
migration.**

**One residual check, not a blocker.** The store/department **user** query has
not returned yet (a shell-quoting error, twice). It matters because D-15 also
requires `STORE_MANAGER` / `STORE_ATTENDANT` accounts to live on the hub org, and
that has never been verified against real rows — but it gates **deploy**, not the
migration, and Session 3's D-15 tests (§6.2) assert the rule independently of
what production currently holds. Run before Session 6:

```bash
cd ~/wendo-rms
docker compose exec -T postgres psql -U wendo_user -d wendo_rms <<'SQL'
SELECT u.role, u.name, o.name AS org, o."isHub"
 FROM users u JOIN organizations o ON o.id = u."organizationId"
 WHERE u.role IN ('STORE_MANAGER','STORE_ATTENDANT','DEPARTMENT_HEAD')
 ORDER BY u.role;
SQL
```

Any `STORE_MANAGER`/`STORE_ATTENDANT` on a non-hub org is a data fix before
deploy (reassign to the hub org), not a plan change.

**One migration, named `inventory_milestone_one_catalog`**, in this order:

1. `DROP TABLE` (CASCADE, explicit order respecting FKs): `dispatch_lines`,
   `dispatches`, `requisition_lines`, `requisitions`, `market_purchase_lines`,
   `market_purchases`, `waste_logs`, `stock_count_lines`, `stock_counts`,
   `prep_record_lines`, `prep_records`, `prep_recipe_lines`, `prep_recipes`,
   `supplier_payments`, `supplier_invoices`, `purchase_order_lines`,
   `purchase_orders`, `supplier_items`, `par_levels`.
2. **`TRUNCATE inventory_transactions;`** — then drop its FK to
   `inventory_items`, then `DROP TABLE inventory_items`, `DROP TABLE suppliers`.
   **Amended after §2's results:** the table holds **37 demo ledger rows**, not
   zero as originally assumed. They reference items being deleted, so they are
   orphaned history about products Wendo never bought — truncated, not migrated.
   The table itself is preserved (the ledger's redo owns its schema, not this
   milestone). *Without this step the migration fails on a FK constraint.*
3. `DROP TYPE` for the now-unreferenced enums: `InventoryItemType`,
   `PurchaseOrderStatus`, `SupplierInvoiceStatus`, `StockCountStatus`,
   `WasteReason`, `RequisitionStatus`, `DispatchStatus`.
4. `CREATE TYPE "InventoryItemType"` with the new values;
   `CREATE TYPE "SupplierPaymentTerms"`.
5. `CREATE TABLE categories`, `suppliers`, `inventory_items`, `restock_levels`
   with all FKs and indexes from §3.
6. Raw SQL, appended by hand (Prisma won't generate these):
   - `CREATE UNIQUE INDEX categories_org_name_live_key ON categories (organization_id, lower(name)) WHERE deleted_at IS NULL;`
   - `CREATE UNIQUE INDEX suppliers_org_name_live_key ON suppliers (organization_id, lower(name)) WHERE deleted_at IS NULL;`
   - `ALTER TABLE inventory_items ADD CONSTRAINT inventory_items_raw_no_department CHECK (type <> 'RAW_INGREDIENT' OR cardinality(department_tags) = 0);`
7. Re-add `inventory_transactions`' FK to the new `inventory_items`.

**Rollback path:** the migration is destructive and not reversible by a down
migration. The rollback is **restore from the nightly backup** — which is
acceptable only because the tables are empty. **Take a fresh backup immediately
before deploy regardless** (playbook §7: *"Test every migration against a
restored production backup before deploy"*).

**Verification before deploy:** run the migration against a **restored production
copy**, not just a clean local DB — that's the only way to catch a row or FK the
§2 counts didn't surface. Then `prisma migrate status` clean, `pnpm build`,
`pnpm test` green.

**✅ DONE 2026-09-15.** Owner pulled the nightly backup
(`~/backups/wendo/wendo_rms_2026-09-15_02-00.sql.gz`, taken 02:00 that morning —
the actual current production data, not a stale or synthetic snapshot) and
handed it over. Restored into a disposable local Postgres 16 container (isolated
from dev, torn down after). Confirmed pre-migration: 23 `inventory_items`, 3
`suppliers`, 4 `organizations` — matching §2's production counts exactly — old
schema shape (`reorder_level`, `is_active`, no `categories` table), 59 of 60
migrations already applied (this one the only pending delta). `prisma migrate
deploy` **applied cleanly, zero errors**, including the amended step 2 truncate
of `inventory_transactions`' 37 real rows (the exact scenario that step was
added to handle — confirmed it actually works, not just reasoned about).
Post-migration, verified directly: `inventory_items`/`suppliers`/`categories`/
`restock_levels`/`inventory_transactions` all correctly empty; new schema shape
present (`category_id`, `preferred_supplier_id`, nullable `conversion_factor`/
`pack_size`, `deleted_at`); the `inventory_items_raw_no_department` CHECK
constraint live; both `categories_org_name_live_key` /
`suppliers_org_name_live_key` partial unique indexes live; `prisma migrate
status` clean afterward. **This precondition is closed — the migration is
proven safe to run on real production.**

**Seed — reference photos, not the production rows. [OWNER CONFIRMED 2026-09-15]**
The question was raised whether to carry the production catalog forward, since it
was itself derived from the photos. It was *inspired by* them, not extracted from
them: the production names are invented stand-ins (*Sunrise Cooking Oil*,
*Millers Choice Baking Flour*) that appear on no real invoice, with `*.example`
supplier emails. The photos have the actual products, the actual suppliers
(Samrat Supermarket Ltd, Summer Limited), the actual pack sizes and prices. Going
back to the photos costs one session and yields fixtures that match what the
client will recognise on day one; carrying the production rows forward would bake
placeholder names into every later milestone's test data. **Photos win.**

The old demo scripts are deleted (§1.4). One replacement,
`backend/src/scripts/seed-inventory-catalog.ts`, built **from
`docs/inventory/reference-photos/`** — real supplier names (Samrat Supermarket
Ltd, Summer Limited), their real categories, and real line items with their real
units and pack sizes (e.g. *Kabras Sugar 1 kg*, *Prestige Margarine 10 kg box*,
*Golden Drop Oil 20 ltr*, *Zesta Chilli Sauce Sachets 300×15 g*, *Highlands Water
12×1 ltr*), plus the client's own category vocabulary from the paper sheets
("Dry items", "Market items"). Guarded by the existing
`ALLOW_PRODUCTION_SEED`/confirm-env pattern. This gives every later milestone,
and every test fixture, data shaped like what Wendo actually buys.

---

## 5. API contract

### 5.1 Conventions

Existing envelope (`API_CONTRACT.md` §1) unchanged: `{ success, data, message? }`
/ `{ success, data, pagination }` / `{ success, error: { code, message, details } }`.
Base path `/api/v1`. **Decimals cross the wire as strings**, per the existing
frontend type comment (`types/inventory.ts`) — never as JS numbers.

**Contract location.** There is no pnpm workspace and no shared package in this
repo (verified: no `pnpm-workspace.yaml`, frontend and backend are independent
projects; types are hand-mirrored on the frontend side).
Introducing a workspace is a repo-wide change and **not** something to smuggle
into a feature milestone. So for Milestone One:

- **Source of truth:** `backend/src/modules/inventory/inventory-validators.ts`
  (Zod) + `inventory.types.ts` (types inferred via `z.infer`).
- **Frontend mirror:** `frontend/features/inventory/types/`, with a header
  comment pointing at the backend file as authoritative. (Amended 2026-09-15 —
  the frontend is now modularized by feature; the legacy `frontend/types/
  inventory.ts` stays in place for the not-yet-removed legacy pages. See
  `FEATURE_REDO_PLAYBOOK.md` §9.)
- A **contract test** in the backend asserts each response serializer satisfies
  its declared type, so drift shows up as a test failure rather than at runtime.

**Flagged for the owner:** a real shared package would be better and is the
playbook's intent (*"shared Zod/TS types"*). Recommended as its own small task
after Milestone One proves the pipeline — not inside it.

### 5.2 Roles

| Surface | Roles |
|---|---|
| Catalog read (items, categories) | `STORE_MANAGER`, `STORE_ATTENDANT` |
| Catalog write (items, categories) | `STORE_MANAGER` |
| Suppliers read | `STORE_MANAGER`, `ACCOUNTANT`, `DIRECTOR` |
| Suppliers write | `STORE_MANAGER` |
| Central Store restock levels (read + write) | `STORE_MANAGER` |
| Department restock levels (read + write) | `DEPARTMENT_HEAD` — own department only |

Per `02-screens.md` F1 ("permission-denied for non–Store-Manager") and A3
("permission-denied (Attendant)" on supplier screens). **Note:** the Attendant is
given catalog *read* because they receive goods against items; they are denied
suppliers entirely, consistent with the AP wall in `01-description.md` §2. Every
route carries `authenticate` + `requireRole`; every input has a Zod schema.

**D-15 enforcement on every endpoint:** catalog, category, supplier, and
Central-Store restock endpoints resolve scope from the actor's hub org and
**reject a non-hub actor with 403**, rather than silently returning an empty
list. Department restock endpoints scope to the actor's branch org **and** their
own `departmentTag`.

### 5.3 Endpoints

**Categories**

| Method | Path | Role | Notes |
|---|---|---|---|
| `GET` | `/inventory/categories` | SM, SA | `?includeRetired=bool`. Returns each category with `itemCount` (live items only) — `SRB-0` renders it. |
| `POST` | `/inventory/categories` | SM | `{ name }`. 409 if a live category has that name (case-insensitive). |
| `PATCH` | `/inventory/categories/:id` | SM | `{ name }` — rename; updates every item by reference, no data copy. |
| `DELETE` | `/inventory/categories/:id` | SM | Retire (`deletedAt`). Items keep the reference; the label just stops being offered. |
| `POST` | `/inventory/categories/:id/restore` | SM | Restore. 409 if a live category now holds that name. |

**Items**

| Method | Path | Role | Notes |
|---|---|---|---|
| `GET` | `/inventory/items` | SM, SA | Filters `?type&categoryId&departmentTag&includeRetired&search`; paginated. Returns the F1 row shape + the four KPI counts in `meta`. |
| `GET` | `/inventory/items/:id` | SM, SA | Single item. |
| `POST` | `/inventory/items` | SM | Create. `categoryName` accepted as an alternative to `categoryId` (Paper: *"type a new name to add it"*) — creates the category in the same transaction. |
| `PATCH` | `/inventory/items/:id` | SM | Update. Type changes validated (§5.4). |
| `DELETE` | `/inventory/items/:id` | SM | Retire. |
| `POST` | `/inventory/items/:id/restore` | SM | Restore. |

**Suppliers**

| Method | Path | Role | Notes |
|---|---|---|---|
| `GET` | `/inventory/suppliers` | SM, ACC, DIR | `?includeRetired&search`; paginated. |
| `GET` | `/inventory/suppliers/:id` | SM, ACC, DIR | Single supplier. **AP/invoice/payment panels on `SX5-0`'s background are a later milestone** — this endpoint returns the profile only. |
| `POST` | `/inventory/suppliers` | SM | Create. |
| `PATCH` | `/inventory/suppliers/:id` | SM | Update. |
| `DELETE` | `/inventory/suppliers/:id` | SM | Retire. 409 if any live item still names it as preferred supplier — with the blocking item names in `details`, so the UI can say which. |
| `POST` | `/inventory/suppliers/:id/restore` | SM | Restore. |

**Restock levels**

| Method | Path | Role | Notes |
|---|---|---|---|
| `GET` | `/inventory/restock-levels` | SM, DH | `?locationId` (SM, must be the Central Store) or implicit own-department (DH). Each row: item, usage unit, **`onHandQty`** (derived live from the ledger), current `level`. |
| `PUT` | `/inventory/restock-levels` | SM, DH | **Bulk upsert** — `{ locationId, levels: [{ inventoryItemId, level }] }`. Both `T52-0` and `TD1-0` are one "Save restock levels" button over many edited rows; a per-row endpoint would misrepresent the screen. Atomic (`$transaction`). `level: null` clears the row (Flow 19: *"par set to zero / removed → allowed"*). |

**Route-mount note:** these live under a `/inventory` prefix, unlike the legacy
flat `/inventory-items` and `/suppliers`. That's deliberate — it namespaces the
module and avoids colliding with the legacy routes during the transition.

### 5.4 Cross-cutting validation rules

Each is a screen-visible rule, not defensive coding:

1. **Raw ingredient + department tags** → 422, field-level on `departmentTags`.
   Backed by the DB `CHECK` (§3.2).
2. **Type change that would strand department stock** → 403/409. F2's `blocked`
   state. Milestone One's ledger is empty in practice, so the rule is: changing
   *away from* a department-scoped type while the item holds non-zero on-hand at
   any `BRANCH_DEPARTMENT` location is blocked. **This is the one rule whose real
   teeth arrive with the ledger's own milestone** — implemented now, genuinely
   exercised later.
3. **Duplicate item name** → **200 with a `warnings` array**, not an error. Flow
   18: *"warned; allowed only with a distinguishing qualifier."* The form shows
   the warning; the save still succeeds. F2's `duplicate-name (warned)` state.
4. **Conversion supplied without both units**, or `packSize` ≤ 0, or
   `conversionFactor` ≤ 0 → 422.
5. **Department head setting a level on an item not scoped to their department**
   → 403. Flow 19's error path.
6. **Store Manager setting a Central Store level on an item that's
   department-only** → 422. (Every item exists at the Central Store per §4's
   table, so this should be unreachable; asserted rather than assumed.)

---

## 6. Test classification

### 6.1 Existing tests

Total inventory test surface today: **110 service-level cases** across 11 files
and **~120 integration cases** across 10 `tests/*.test.ts` files.

| File | Cases | Verdict |
|---|---|---|
| `services/inventory-item-service.test.ts` | 4 | **Rewrite** — new module, new fields, new rules. |
| `tests/inventory-item.test.ts` | 23 | **Rewrite** — richest existing suite; its tenancy/RBAC/404 patterns are the template for the new one. |
| `services/supplier-service` (none exists) / `tests/supplier.test.ts` | 14 | **Rewrite** against the new supplier shape. |
| `repositories/par-level-repository.ts` (no tests) | 0 | **New tests required** — `RestockLevel` ships with real coverage. |
| `services/purchase-order-service.test.ts` + `tests/purchase-order.test.ts` | 34 | **Delete** — feature removed entirely (§1.3). |
| `services/prep-record-service.test.ts` + `tests/prep-record.test.ts` | 16 | **Delete now, rewrite in the prep milestone.** |
| `services/stock-count-service.test.ts` + `tests/stock-count.test.ts` | 23 | **Delete now, rewrite in the counts milestone.** |
| `services/waste-log-service.test.ts` + `tests/waste-log.test.ts` | 12 | **Delete now, rewrite in its milestone.** |
| `services/supplier-invoice-service.test.ts` + `tests/supplier-invoice.test.ts` | 16 | **Delete now, rewrite in the AP milestone.** |
| `services/requisition-service.test.ts` | 17 | **Delete now, rewrite in the requisition milestone.** |
| `services/dispatch-service.test.ts` | 14 | **Delete now, rewrite in the dispatch milestone.** |
| `services/inventory-report-service.test.ts` + `tests/inventory-report.test.ts` | 10 | **Delete** — reports are rebuilt per `02-reports-spec.md` in a later milestone. |
| `services/inventory-transaction-service.test.ts` | 21 | **Delete now, rewrite with the ledger.** Its on-hand-derivation cases are worth reading before writing Milestone One's `onHandQty` query — the maths is the same. |
| `services/department-service.test.ts` | 12 | **Keep** — `Location`/`DepartmentTag` are unchanged (§1.3). |
| `tests/location.test.ts` | 7 | **Keep** — same reason. |
| `tests/prep-ticket.test.ts` | — | **Keep** — orders/KDS, unrelated to inventory despite the name. |

**Net: ~19 kept, ~41 rewritten as new Milestone One tests, ~170 deleted.** A
large deletion count is the expected shape of removing four dropped features and
deferring six others — not a coverage regression, since the code under those
tests is deleted in the same PR.

> The deleted-now/rewrite-later suites are **listed in this plan as the
> authoritative record of what each future milestone owes.** Each milestone's own
> plan must restate its share; this doc is where the debt is booked.

### 6.2 New tests required

**Service unit tests** (`modules/inventory/inventory-service.test.ts`):
raw-ingredient/department-tag rejection (both directions) · type-change blocking ·
duplicate-name **warning, not failure** · category rename propagating by
reference · retire/restore round-trips · live-name uniqueness ignoring retired
rows · supplier retire blocked while referenced as preferred · bulk restock upsert
atomicity · `level: null` clearing a row · department head scope rejection.

**Integration tests** (`tests/inventory-catalog.test.ts`,
`tests/inventory-suppliers.test.ts`, `tests/inventory-restock-levels.test.ts`):
happy path per endpoint · 401 unauthenticated · 403 per disallowed role on every
route (explicitly including Attendant → suppliers, and Department Head →
Central Store levels) · 422 validation per rule in §5.4 · 409 conflicts ·
**tenant isolation: a branch-org actor cannot read or write hub-org catalog data,
and a department head cannot touch another department's levels** · pagination ·
`includeRetired` filtering.

**D-15-specific tests** — required because §1.2 point 3 established the rule has
**never been exercised against real rows**: a non-hub `STORE_MANAGER` is
rejected; catalog writes land on the hub org; a second Central Store cannot be
created.

**Contract test:** each serializer's output satisfies its declared Zod schema
(§5.1's drift guard).

**Frontend:** the six screens' components are already built and verified
(`04-components.md`). Frontend session tests cover wiring only — loading/empty/
error/permission-denied per screen, the conditional "Where it may exist" field,
and the bulk-save drawer's dirty-state handling.

---

## 7. Session breakdown

Serial up to the contract freeze, then backend and frontend run in parallel
(playbook §8).

| # | Session | Depends on | Parallel with |
|---|---|---|---|
| **0** | ~~Owner: run §2's production queries; approve this plan~~ **✅ DONE 2026-09-15** | — | — |
| **1** | ~~**Step 6 — freeze the contract.**~~ **✅ DONE 2026-09-15** — `inventory-validators.ts` + `inventory.types.ts` committed and marked frozen; `API_CONTRACT.md` §21 added. Frontend mirror is written by Session 4 in `features/inventory/types/`, against the frozen schemas. | 0 | — |
| **2** | **Backend A — schema & migration.** Prisma models, the hand-edited migration, raw-SQL indexes + CHECK, `seed-inventory-catalog.ts` from the reference photos. Migration verified against a restored production copy. | 1 | 4 |
| **3** | **Backend B — module build.** `modules/inventory/` routes/controller/service/repository, all §5.3 endpoints, all §5.4 rules, §6.2 tests. **Deletes the legacy inventory code and its tests (§1.4) in this same PR.** | 2 | 4 |
| **4** | **Frontend — six screens.** Assemble the built composites into real screens against a mock of the frozen contract: route + drawer chrome (Save/Cancel, search boxes) the composites deliberately don't own, wiring, states. Visual-diff each screen against its `B-0` artboard. | 1 | 2, 3 |
| **5** | **Integration.** Wire frontend to the real backend, run Flow 18 + Flow 19 end to end in a browser, fix the seams, remove the superseded frontend pages (§1.4). | 3, 4 | — |
| **6** | **Migrate, deploy, observe.** Backup → migrate on a production copy → CI/CD deploy → owner watches a real user use it. | 5 | — |
| **7** | **Docs.** `DATA_MODEL.md`, `API_CONTRACT.md` (frozen→shipped), `CLAUDE.md` current-work pointer, mark this milestone complete. | 6 | — |

**Session 3 is the largest** and may split into 3a (items + categories) and
3b (suppliers + restock levels) if it runs long — the seam is clean, and 3b
depends on 3a only for the shared repository scaffold.

---

## 8. Blocking dependencies & open questions

### 8.1 ~~BLOCKER~~ — WCAG AA contrast — **RESOLVED 2026-09-15**

**Owner chose option (b); implemented and verified. Session 4 is unblocked.**

Two new AA-passing copy tokens were added, and every non-decorative usage across
all 14 affected component files was swapped to them:

| Token | Value | on `--wds-surface` | on `--wds-surface-sunken` |
|---|---|---|---|
| `--wds-text-copy-faint` | `#756E66` | 5.03:1 | 4.61:1 |
| `--wds-text-copy-muted` | `#5E5852` | 7.01:1 | 6.44:1 |

`--wds-text-faint` / `--wds-text-muted` keep their values and are now documented
in `tokens.wds.css` as **decorative-only**. The 9 remaining uses are all
legitimately AA-exempt: input/select placeholders, the search icon, the Select
`▾`, the Sheet `×`, the Select scroll arrows, and the topbar `/` separator.

**Verified in a real browser, not inferred from CSS:** all **129** copy elements
across every Milestone One composite measure **4.91–9.06:1** against their
actual rendered backgrounds. 0 failures, 0 console errors, `pnpm build` clean.
The faint/muted hierarchy Paper draws is preserved — `-copy-faint` is still
lighter than `-copy-muted`.

**Follow-up:** Paper's own `--color-text-faint` / `--color-text-muted` still hold
the old values. Update the design file before the next milestone's design pass so
Paper and code don't drift.

<details>
<summary>Original finding (kept as the record of why this changed)</summary>

`04-components.md`'s Known-issues section carried this as a still-open finding
blocking **Session 4 (frontend)**, not the backend sessions:

- `--wds-text-faint` (`#A8A39B`) is **2.51:1 on white / 2.30:1 on sunken** —
  below even the 3:1 large-text floor, so no font size rescues it.
- `--wds-text-muted` (`#847E76`) is **4.02:1 / 3.69:1** — under the 4.5:1
  normal-text minimum at every size it's actually used.

These are not decorative uses. They carry real helper and caption copy on
**every screen in this milestone**: Item Form and Supplier Form helper text
("Pick from your list, or type a new name…", "A default reference only…"), the
Restock Level Grid's unit captions and helper-note band, and the Item Catalog
Table's Department Scope column.

**This needs an owner decision before Session 4 touches a screen using those
tokens for real copy.** The two options `04-components.md` sets out:

- **(a)** Darken `--wds-neutral-400` (and likely `-500`) until they pass —
  simplest, but changes the neutral scale's appearance site-wide, well beyond
  this milestone.
- **(b)** Introduce a distinct AA-compliant token for non-decorative faint/muted
  *copy*, and reserve the current values for placeholder/decorative use only —
  narrower blast radius, and probably what the values were intended for.

**Recommendation: (b)**, decided in Paper so the design file and the code stay in
step, exactly as Phase 0's token approval was handled. Session 4 can begin on
screens/states that don't use those tokens for copy, but cannot be marked done
until this resolves.

</details>

### 8.2 Questions for the owner — each with a recommended default

**Recommended answers stand as decided unless the owner says otherwise.**

| # | Question | Recommendation | Status |
|---|---|---|---|
| 1 | Schema drop-and-replace (§1.3) | Proceed | ✅ **Owner approved 2026-09-15**, production counts confirm |
| 2 | One shared `Category` list for items *and* suppliers, or two vocabularies? | **One shared list** | ⬜ default stands |
| 3 | Interim gap — screens come down with their endpoints (§1.4) | Accept | ✅ **Owner approved 2026-09-15** ("we're going to replace all these screens anyway") |
| 4 | Supplier `location` — on the detail header, absent from the drawer | **Store it; add the field to the drawer** | ⬜ default stands |
| 5 | Contract sharing — hand-mirrored types + drift test? | **Yes, for this milestone** | ⬜ default stands |

**2 — one shared category list.** Paper's supplier drawer (`SX5-0`) shows
Category = "Dairy", which is also an item category; the same control, the same
vocabulary. The client's own paper sheets group by "Market items" / "Dry items" —
one axis, describing *what kind of goods*, which applies equally to a product and
to the supplier who sells it. Two vocabularies would mean two management screens,
and Paper only draws one. *Cheap to reverse:* splitting later is an additive
migration (`SupplierCategory` + a data copy), not a destructive one — so the
default is the simpler model, and the more complex one stays available.

**4 — store it and add the field.** It's real data the store manager needs
("which market is this supplier at?"), it's already drawn on the detail header,
and a stored-but-uneditable field would be strictly worse than either extreme.
The design amendment is one input in an existing two-column row — small enough to
fold into Session 4 rather than reopening Step 3. **Flagged as a design
amendment, not a silent addition** — the Paper drawer and `04-components.md`'s
Supplier Form entry both need updating to match.

**5 — hand-mirrored + drift test.** The alternative is introducing a pnpm
workspace, which restructures both projects' builds, CI, and Docker layers. That
is a repo-wide change and does not belong inside a feature milestone. The drift
test makes the mirror safe in the meantime (a mismatch fails CI, it doesn't reach
runtime). **Recommend booking the shared package as its own small task after
Milestone One ships** — by then the pipeline is proven and the contract's real
shape is known, which makes the package easier to design correctly.

### 8.3 Assumptions made (vetoable)

- Store Attendant gets catalog **read**, no supplier access at all (§5.2).
- Restock levels save in **bulk**, matching the single "Save restock levels"
  button on both `T52-0` and `TD1-0`.
- `onHandQty` on the restock screens is **derived live from the ledger** on read,
  never stored — consistent with `01-description.md` §4 (*"Stock on hand is
  always derived from the ledger, never a stored counter"*).
- Item names are **not** uniquely constrained; duplicates warn (Flow 18).
- `/inventory`-prefixed routes rather than reusing the legacy flat paths.

---

## 9. Definition of done for Milestone One

- [x] §2's production queries returned — all demo data, drop-and-replace GO
- [x] Owner approved drop-and-replace (§1.3) and the interim screen gap (§1.4)
- [x] §8.1 contrast decision made and applied — AA verified in-browser, 129/129
- [ ] Hub-org + Central Store preconditions confirmed (§4 preconditions 2 and 3)
- [ ] Owner approves the rest of this plan (§8.2 defaults 2, 4, 5 stand if silent)
- [ ] Supplier `location` field added to the Paper drawer (§8.2 q4)
- [ ] Contract frozen (Step 6) and mirrored to the frontend
- [x] Migration written, run against a restored production copy, committed — ✅ 2026-09-15, clean
- [ ] `modules/inventory/` built to contract; legacy inventory code deleted in the same PR
- [ ] Tests classified per §6, new tests green, `pnpm build` + `pnpm test` clean both projects
- [ ] Six screens assembled, visual-diffed against their `B-0` artboards
- [ ] Flow 18 and Flow 19 verified end to end in a real browser
- [ ] Deployed via CI/CD; owner has watched a real user use it
- [ ] `DATA_MODEL.md`, `API_CONTRACT.md`, `CLAUDE.md` updated
