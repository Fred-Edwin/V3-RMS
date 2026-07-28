# Central Store Inventory Model
### RMS Feature Planning Document

---

## 1. What Is the Central Store Model?

Wendo runs a **Central Store**: one facility that:
- Buys from suppliers — dry goods, consumables, meats, milk, etc. — with the supplier per
  item configurable by the store manager (e.g. Samrat Supermarket for pantry goods, a
  separate butchery/meat supplier, a dairy supplier)
- Preps and portions items (marinating, cutting into portions, making beef patties —
  most prep is marination + portioning; a few items like beef patties have a longer
  prep chain)
- Receives pass-through goods that need no prep and dispatches them as-is
- Dispatches both prepped and pass-through items to branch **departments** on requisition

The Central Store is **not a branch** and not a "hub" variant of one — it is its own
location type. It never sells to a customer and never appears as a point of sale. Its
only job is receive → (optionally prep) → dispatch.

**One category bypasses the Central Store entirely:** fresh produce / market goods
(tomatoes, potatoes, capsicum, herbs, fruit — the "Market Items" a branch buys same-day
from the local market). Branch departments buy these directly and log the purchase
themselves; the Central Store never sees them, never stocks them, never dispatches them.

**Used by:** regional restaurant chains, cloud/ghost kitchens, and multi-branch operators
that own and run a central production/distribution facility separate from their point-of-
sale locations.

---

## 2. Three Item Types

This model has **three** kinds of stockable item. Getting these distinctions right is the
foundation of the whole system, because each type moves through the store differently.

| Item Type | Definition | Example | Goes Through Production? |
|---|---|---|---|
| **Raw Ingredient** | Bought from a supplier, consumed during prep | Chicken Breast, Flour, Cooking Oil | Consumed as input |
| **Prepped Item** | Produced by the Central Store from raw ingredients | Marinated Chicken, Beef Patties | Produced as output |
| **Pass-Through Item** | Received from a supplier and dispatched to branch departments unchanged | Milk, Coffee Beans, Burger Buns, Bottled Drinks, Napkins | No — skips prep entirely |

> **Why pass-through items matter:** milk is neither raw (no department cooks it down)
> nor prepped (the Central Store doesn't produce it) — it's received and dispatched
> unchanged, then consumed fractionally by a branch department's usage recipe (a latte
> deducts 200 ml). Without an explicit pass-through type, items like buns, milk, coffee
> beans, and packaging have nowhere to live in the data model — yet they appear in
> nearly every requisition and usage recipe.

**Market goods are a separate case, not a fourth item type.** They are typically raw
(fresh produce) but purchased and received directly at the branch department, never
routed through the Central Store. They still carry a type (raw ingredient) and still
hit the ledger — just via a different receiving path (see §4, Path B).

---

## 3. Locations: Central Store, Branches, and Departments

The Central Store and each branch **department** are separate inventory locations, each
with their own stock levels. A branch is not itself a single stock-holding location —
its departments are.

```
SUPPLIER  ──┐
            ├─→ CENTRAL STORE ──dispatch──→ BRANCH DEPARTMENT ──sale──→ CUSTOMER
LOCAL MARKET ────────────────────direct receive──→ BRANCH DEPARTMENT
```

**Departments observed at Wendo** (per branch, each with a department head):

| Department | Run by | Typical items requisitioned |
|---|---|---|
| Kitchen | Chefs | Raw/prepped meats and proteins (chicken, beef, pork, fish), dry kitchen goods |
| Pastry | Pastry chefs | Flour, sugar, eggs, margarine, cocoa/compound, cake boxes & boards |
| Barista | Baristas | Coffee beans, milk, syrups, tea, cakes-for-sale, ice cream, spices |
| Service | Waitresses | Straws, thermal rolls, takeaway packaging, serviettes, condiment sachets, cutlery |
| Housekeeping | Housekeeping staff | Cleaning supplies, tissue, soap, disinfectant, sanitary items |

**Departments do not overlap in what they draw.** Barista never requisitions chicken;
Service never requisitions coffee beans. Each item in the Central Store catalog is
associated with the department(s) that actually order it, so a department's requisition
screen only ever shows items relevant to its own work — not the full catalog.

**No sideways transfers.** A department's stock only ever increases via Central Store
dispatch (Path A) or a direct market receive (Path B, produce only). Departments never
transfer stock to each other — if Kitchen has surplus chicken and Pastry needs some,
that is not a modeled flow in v1.

| Location | Holds | Stock Changes When... |
|---|---|---|
| Central Store | Raw ingredients + Prepped items + Pass-through items | PO received, Production run, Dispatch out |
| Branch Department (×5 per branch) | Prepped + pass-through items (its own subset) + market-bought produce | Dispatch received, Market purchase received, Sale made, Waste logged |

---

## 4. End-to-End Flow

### Path A — Through the Central Store (the default path)

#### Step 1 — Central Store Receives Stock from Suppliers
A Purchase Order is raised to a supplier — dry goods, consumables, meats, milk, etc.
The supplier used for a given item is configurable by the store manager (Wendo already
uses more than one: e.g. a supermarket for pantry/consumable goods, separate suppliers
for meat and dairy). On delivery, quantities are received into **Central Store Inventory**.

```
Chicken Breast   +50 kg      (raw ingredient)
Flour            +25 kg      (raw ingredient)
Milk             +40 litres  (pass-through item)
Burger Buns      +500 pcs    (pass-through item)
Bottled Soda     +240 pcs    (pass-through item)
```

Invoice prices captured at receiving time keep ingredient costs current.

#### Step 2 — Production Run (Prep Recipe)
The Central Store executes a **Production Order** using a Prep Recipe. Raw ingredients
are consumed and prepped items are created. Pass-through items are never involved in
production. Most Wendo prep is marination and portioning; a few items (e.g. beef
patties) have a longer prep chain with more ingredients.

```
Prep Recipe: Marinated Chicken (expected yield 1 kg)
  IN:  Chicken Breast 1.1 kg + Marinade 50 ml + Salt 5 g
  OUT: Marinated Chicken 1 kg  ← becomes a stockable prepped item
```

#### Step 3 — Branch Department Sends a Requisition
Each morning (and again in the afternoon, and sometimes evening) a branch department
submits a **Requisition** — an internal stock request — to the Central Store. A
requisition can mix prepped and pass-through items, but only from that department's own
relevant item set.

```
Kitchen Dept, Branch 1 — Morning Requisition:
  Marinated Chicken   8 kg      (prepped)
  Beef Patties        20 pcs    (prepped)

Barista Dept, Branch 1 — Morning Requisition:
  Milk                10 litres (pass-through)
  Coffee Beans        1 kg      (pass-through)
```

#### Step 4 — Central Store Fulfills via Dispatch
The store dispatches the items. The system records a **Dispatch** (internal transfer),
which atomically:
- Deducts from Central Store stock
- Adds to the requesting branch department's stock

The transfer line records three quantities so that shortfalls and receiving discrepancies
are captured (see §6, Transfer Accuracy):

```
Dispatch — Kitchen Dept/Branch 1, Marinated Chicken
  requested_qty:    8 kg
  dispatched_qty:   8 kg   → deducts 8 kg from Central Store
  received_qty:     7.6 kg → adds 7.6 kg to Kitchen Dept/Branch 1
  (0.4 kg discrepancy flagged as transfer variance)
```

### Path B — Direct Market Purchase (produce only, bypasses the Central Store)

A branch department (in practice, Kitchen) buys fresh produce directly from the local
market same-day — this never goes through the Central Store. The purchase is logged as
a **direct receive** at the department's own location:

```
Kitchen Dept, Branch 1 — Market Purchase (direct receive):
  Tomatoes     11 kg
  Capsicum     3.5 kg
  Garlic       1.4 kg
```

This still hits the ledger (so recipes/costing/variance work for produce-heavy dishes) —
it is simply a second, parallel receiving path that has no Central Store leg and no
supplier PO. Cost comes from whatever the department records paying at the market.

### Step 5 — Branch Department Sells to Customers (POS Deduction)
When a sale is made, the POS deducts items from the relevant branch department's
inventory using a **Usage Recipe**. The recipe may reference prepped, pass-through, and
market-sourced items, and deduction must account for **modifiers** (e.g. "extra cheese"
deducts an additional portion beyond the recipe default).

```
Usage Recipe: Grilled Chicken Burger  (Kitchen Dept)
  Marinated Chicken   200 g   (prepped, from Central Store)
  Tomato               2 slices (market, direct receive)
  Burger Bun           1 pc    (pass-through, from Central Store)

Usage Recipe: Latte  (Barista Dept)
  Milk                 200 ml  (pass-through, from Central Store)
  Coffee Beans         18 g    (pass-through, from Central Store)
```

---

## 5. Two-Tier Recipe Structure

This is the core concept that makes the model work:

```
TIER 1 — Prep Recipe (Central Store)
  Raw Ingredients  →  Prepped Items
  e.g. Chicken Breast + Marinade  →  Marinated Chicken

TIER 2 — Usage Recipe (Branch Department)
  Prepped Items + Pass-Through Items + Market Items  →  Menu Item sold to customer
  e.g. Marinated Chicken + Bun + Tomato  →  Grilled Chicken Burger
```

> Branch departments reference prepped items, pass-through items, and market items —
> never raw ingredients dispatched from the Central Store unprepped. Pass-through items
> appear in usage recipes but have no prep recipe, because the Central Store never
> produces them; market items appear in usage recipes but have no prep recipe either,
> because they're used as bought.

---

## 6. Item Costing

Cost must follow stock as it moves, or per-department food cost cannot be calculated
(revenue happens at the branch department, but most raw cost happens at the Central
Store; market cost happens at the department itself).

**Raw ingredient cost** comes directly from the supplier invoice at receiving time
(Central Store).

**Pass-through item cost** likewise comes from the supplier invoice — it carries through
unchanged to the branch department that receives it.

**Market item cost** comes from what the department records paying at the market at the
time of purchase — there is no supplier invoice to reference.

**Prepped item cost** is a *rolled-up cost*, derived from each production run at the
Central Store:

```
Prepped item unit cost = (sum of raw ingredient costs consumed) ÷ (actual yield)

e.g. Marinated Chicken:
  Chicken Breast 1.1 kg @ 650/kg  = 715
  Marinade 50 ml @ 2/ml           = 100
  Salt 5 g (negligible)           =   3
  Total input cost                = 818
  Actual yield                    = 0.95 kg
  → Unit cost = 818 ÷ 0.95        = 861 / kg
```

**Cost travels with the dispatch.** When stock moves from the Central Store to a branch
department, it carries its cost. A department's sale then draws down inventory valued
at the cost baked in at either the Central Store (dispatched items) or the market
(directly-received items), so each department produces its own true food-cost figure.

---

## 7. Core Data Entities

```
Location              → CentralStore, and one per (Branch × Department)
                        e.g. Branch1/Kitchen, Branch1/Pastry, Branch1/Barista,
                             Branch1/Service, Branch1/Housekeeping, Branch2/Kitchen, ...
Department            → KITCHEN | PASTRY | BARISTA | SERVICE | HOUSEKEEPING
                        (a type, not a location itself — a department only exists
                        as a location once scoped to a branch)

Ingredient            → raw items (Chicken Breast, Flour, Oil, Tomatoes)
PreparedItem          → prepped items (Marinated Chicken, Beef Patties); carries rolled-up cost
PassThroughItem       → received and dispatched unchanged (Milk, Coffee Beans, Buns, Napkins)

ItemDepartmentScope    → which department(s) a given item is relevant to
                        (drives what shows on each department's requisition screen)

PrepRecipe             → maps raw ingredients → prepped item output (Central Store only)
UsageRecipe            → maps prepped + pass-through + market items → menu item
                        (supports modifiers), scoped to the department that sells it

ProductionOrder        → a prep run at the Central Store
ProductionOrderItem    → ingredients consumed + item produced + expected vs actual quantities

Requisition             → branch department's request to the Central Store
RequisitionItem         → item requested + quantity

Dispatch                → fulfillment of a requisition (Central Store → branch department)
DispatchItem            → item, from_location (Central Store), to_location (branch dept),
                          requested_qty, dispatched_qty, received_qty

MarketPurchase           → a branch department's direct receive from the local market
                            (Path B — no supplier PO, no Central Store leg)
MarketPurchaseItem       → item, quantity, cost paid, department location

InventoryTransaction    → log of every stock movement at any location (see types below)
StockCount              → a physical count session at a specific location
StockCountItem          → counted quantity per item
WasteLog                → manually logged waste at any location
```

### InventoryTransaction movement types

Every stock movement is one of the following, and each carries a `location_id`,
timestamp, user, quantity, and cost. This enum is the backbone of every report:

| Type | Meaning | Location | Direction |
|---|---|---|---|
| `receive` | PO received from supplier | Central Store | + |
| `prep_consume` | Raw ingredient used in a production run | Central Store | − |
| `prep_produce` | Prepped item created by a production run | Central Store | + |
| `dispatch_out` | Sent to a branch department | Central Store | − |
| `dispatch_in` | Received from the Central Store | Branch Department | + |
| `market_receive` | Bought directly at the local market | Branch Department | + |
| `sale` | Deducted by a POS sale (via usage recipe) | Branch Department | − |
| `waste` | Manually logged loss | Any | − |
| `adjustment` | Manual correction after a stock count | Any | ± |

---

## 8. Industry Best Practices (Applied to This Model)

| Practice | Central Store | Branch Department |
|---|---|---|
| Recipe-level deduction | Prep recipes consume raw ingredients on production | Usage recipes deduct prepped + pass-through + market items on every sale |
| Theoretical vs Actual | Track prepped output vs raw ingredients used | Track received/purchased stock vs what sales should have consumed |
| Waste logging | Log trimming loss, prep errors, spoilage | Log spoilage, dropped dishes |
| Stock counts | Count raw + prepped + pass-through items | Count prepped + pass-through + market items, per department |
| Reorder points | Triggers PO to supplier | Triggers requisition to Central Store (or a market run for produce) |
| Audit trail | Log every PO, production run, dispatch out | Log every dispatch received, market purchase, sale, manual adjustment |
| UOM conversion | Buy in kg, recipes work in grams | Receive in kg/litres, recipes work in grams/ml |

### Additional Practices Specific to This Model

- **Atomic dispatches** — a dispatch must deduct and add as one operation. Never allow a
  state where stock has left the Central Store but not arrived at the branch department.
- **Partial fulfillment** — the Central Store may not have enough stock to fill a full
  requisition. The system must support fulfilling partial quantities and flagging the
  shortfall (captured via `requested_qty` vs `dispatched_qty`).
- **Receiving discrepancies** — what a department receives may differ from what was
  dispatched (`dispatched_qty` vs `received_qty`). Record both; the gap is transfer
  variance.
- **Separate stock counts per location** — never run a single count across all
  locations, and never run one count across all of a branch's departments. Each
  department is counted independently, matching the paper stock sheets already in use.
- **Department-scoped catalogs** — a department's requisition screen and stock sheet
  show only the items relevant to that department (Barista never sees chicken; Service
  never sees coffee beans).
- **Prepped & pass-through items have their own shelf life** — track production date
  (prepped) or receipt date (pass-through) so FIFO dispatch is enforced.
- **Modifier-aware deduction** — usage-recipe deduction at the POS must adjust for
  modifiers (extra cheese, no sauce, etc.).

---

## 9. Variance — Isolated by Location

The key advantage of this model is that loss can be traced to *where* it happened,
instead of producing one blended figure. There are three independent places variance
can arise:

| Variance Point | Compares | Catches |
|---|---|---|
| **Prep (Central Store)** | Expected yield vs actual yield of a production run | Over-portioning, trimming loss, recipe drift |
| **Transfer** | `dispatched_qty` vs `received_qty` | Loss in transit, miscounts at dispatch or receipt |
| **Branch Department** | Theoretical department stock (dispatches in + market receives − sales) vs physical count | Department-level waste, theft, over-portioning at service |

Keep theoretical and actual figures separately at every location — never overwrite one
with the other. The gap is the most valuable operational metric you have.

---

## 10. Key Metrics to Track

| Metric | Description |
|---|---|
| **Prep Yield** | Actual output ÷ expected output from a production run |
| **Transfer Accuracy** | `received_qty` ÷ `dispatched_qty` per dispatch line |
| **Department Variance** | Theoretical department stock vs actual count |
| **Food Cost %** | Cost of items consumed ÷ Revenue generated (computed per branch department, using cost carried by dispatch or market purchase) |
| **Waste Rate** | Waste logged ÷ Total stock received (dispatched + market-purchased) |

---

## 11. v1 Scope & Assumptions

These boundaries are explicit decisions, not permanent limits. Each can be revisited in
a later version.

- **No raw prep at branch departments (v1), except market items used as-is.** Branch
  departments assemble prepped, pass-through, and market items only; they perform no
  raw-ingredient prep beyond what a market item needs (e.g. slicing a tomato). Any raw
  ingredient dispatched from the Central Store (not yet prepped) has no place to be
  consumed at a branch department in v1.
- **No composite prep (v1).** A production order consumes raw ingredients only. If a
  prepped item (e.g. a house sauce) must feed into another prep recipe, allow production
  orders to consume prepped items — out of scope for now.
- **No returns and no cross-department or cross-branch transfers (v1).** Stock flows one
  way per path: Central Store → branch department (Path A), or market → branch
  department (Path B). Returns to the Central Store, department-to-department transfers
  within a branch, and branch-to-branch transfers are all deferred.

---

## 12. Summary Flow Diagram

```
SUPPLIER
   ↓  Purchase Order
CENTRAL STORE — Raw Ingredients + Pass-Through Items
   ↓  Production Order (Prep Recipe)  [raw only]
CENTRAL STORE — Prepped Items
   ↓  Dispatch (triggered by Requisition)  [prepped + pass-through, department-scoped]
BRANCH DEPARTMENT — Prepped + Pass-Through Items
   ↑  Market Purchase (direct receive)  [produce only, bypasses Central Store]
BRANCH DEPARTMENT — + Market Items
   ↓  POS Sale (Usage Recipe deduction, modifier-aware)
CUSTOMER
```

Every arrow = a tracked `InventoryTransaction` with: timestamp, user, location,
quantities, and cost.

---

*Document prepared for RMS inventory feature planning — Central Store Model.
Revised 2026-07-22 after client walkthrough: central kitchen renamed Central Store
(not a branch/hub), branch departments introduced as the true stock-holding locations,
and the direct-market-purchase path added alongside Central Store dispatch.*
