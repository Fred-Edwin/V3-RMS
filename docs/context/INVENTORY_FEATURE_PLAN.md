# Inventory & Procurement — Central Store Model Feature Plan (Living File)

This file is the source of truth for the Inventory feature: the model, the Wendo-specific
decisions, the phase breakdown, and the delivery process. It is updated as phases complete.
The underlying domain model is documented in the client-process research doc
(`docs/context/central_kitchen_inventory_model.md`); this plan is that model *applied to Wendo*.

---

## Status

- [ ] Phase 1 (Central Store) — Not started (re-scoped 2026-07-22, see §0 below)
- [ ] Phase 2 (Central Store → Branch Departments) — Not started
- [ ] Phase 3 (Branch Departments → Customers) — Not started

Discovery is **complete**, in two rounds:
1. Initial discovery captured the commissary shape (item taxonomy, two-tier recipe
   structure, ledger) — validated in the domain model research doc.
2. **2026-07-22 client walkthrough of the Phase 1 prototype**, cross-checked against 26
   photos of the client's actual paper records, surfaced a structural correction (see §0)
   that this revision applies throughout. The prototype built under the old model
   (`frontend/app/proto/inventory/`) predates this correction — see §9.

---

## 0. What Changed on 2026-07-22 (Read This First)

The original plan modeled a **central kitchen** that preps and dispatches directly to
**branches**, with branches as the only other location type (`Branch.isHub` was the
leading schema option for the kitchen). The client walkthrough corrected this:

1. **It's a Central Store, not a "Central Kitchen" and not a hub-flavored branch.** It
   is its own location type — never a branch, never a point of sale. It receives from
   suppliers (dry goods, consumables, meats, milk — supplier per item is configurable by
   the store manager), preps/portions, and dispatches. Renamed throughout.
2. **Branches don't hold stock directly — their departments do.** Each branch has up to
   five departments, each a separate stock-holding location with its own head, who
   requisitions from the Central Store: **Kitchen**, **Pastry**, **Barista**, **Service**,
   **Housekeeping**. This is confirmed by the client's own paper trail — five parallel
   "Daily Stock Sheet" templates (Kitchen, Pastry, Barista, Service, Housekeeping), one
   per department per branch, each run twice daily (opening → received → afternoon
   requisition → received → closing → evening requisition).
3. **Departments are catalog-scoped, not general-purpose.** Barista never requisitions
   chicken; Service never requisitions coffee beans. Each item is tagged with which
   department(s) actually order it, so a department only ever sees its own slice of the
   catalog on its requisition/stock screens.
4. **No sideways transfers between departments.** A department's stock only increases via
   Central Store dispatch or a direct market purchase — never from another department in
   the same branch.
5. **A second receiving path exists and bypasses the Central Store entirely: the direct
   market purchase.** Fresh produce/market goods (tomatoes, potatoes, capsicum, herbs,
   fruit) are bought same-day by the branch department directly from the local market —
   never routed through the Central Store, never on a supplier PO. They are still
   ledger-tracked (a `market_receive` transaction at the department's own location) so
   recipes, costing, and variance still work for produce-heavy dishes.

Everything below (phase boundaries, decisions, screens) is written against this
corrected model. Where a decision from the original plan still holds, it's carried
forward with updated terminology; where a decision changed, that's called out.

---

## 1. The Model in One Page

Wendo runs a **Central Store model**: one facility buys from suppliers, does raw-
ingredient prep, and distributes to branch departments on requisition. A second,
parallel path lets branch departments buy fresh produce directly from the local market,
bypassing the Central Store. Branch departments assemble and sell; they never hold raw
ingredients dispatched from the Central Store unprepped (market-bought produce is the
one exception, used close to as-is).

```
SUPPLIER
   ↓  Purchase Order → Receiving
CENTRAL STORE  (raw ingredients + pass-through items)
   ↓  Production Order (Prep Recipe: raw → prepped)
CENTRAL STORE  (prepped items)
   ↓  Requisition → Dispatch (prepped + pass-through, department-scoped)
BRANCH DEPARTMENT  (prepped + pass-through items)
   ↑  Market Purchase (direct receive — produce only, bypasses Central Store)
BRANCH DEPARTMENT  (+ market items)
   ↓  Order close (Usage Recipe deduction)
CUSTOMER
```

**Locations are Central Store (one) + branch departments (five per branch: Kitchen,
Pastry, Barista, Service, Housekeeping).** A branch itself is not a stock-holding
location — it's a grouping of its departments.

**Three item types** (the foundation — each moves differently):

| Type | Definition | Example | Prep recipe? |
|---|---|---|---|
| Raw ingredient | Bought from supplier, consumed in prep | Chicken breast, flour, oil | Consumed as input |
| Prepped item | Produced by the Central Store from raw ingredients | Marinated chicken, beef patties | Produced as output |
| Pass-through item | Received and dispatched unchanged | Milk, coffee beans, buns, bottled drinks, packaging | Never |

"Pass-through" means *the Central Store doesn't produce it* — not *the customer receives
it unchanged*. Milk is pass-through: dispatched unchanged to the Barista department,
then consumed fractionally by usage recipes (a latte deducts 200 ml).

**Market goods are a receiving-path distinction, not a fourth item type.** Fresh
produce is typically "raw ingredient" by type, but reaches a branch department via a
direct market purchase instead of Central Store dispatch — no supplier PO, no Central
Store leg, cost is whatever was paid at the market that day.

**Departments are catalog-scoped.** Every stockable item is tagged with the
department(s) that actually requisition it. A department's requisition screen, stock
sheet, and usage recipes only ever show its own relevant items.

**Two-tier recipes:**

- **Prep Recipe** (Central Store): raw ingredients → prepped item, with expected yield.
- **Usage Recipe** (branch department): prepped + pass-through + market items → menu
  item sold, scoped to the department that sells it.

**Everything is a ledger entry.** Every stock movement is an append-only
`InventoryTransaction` with location, item, quantity, cost, user, timestamp. Stock on
hand is always derived from the ledger, never a mutable counter. The full enum ships in
Phase 1; later phases append types, never restructure:

| Type | Phase live | Location | Direction |
|---|---|---|---|
| `receive` | 1 | Central Store | + |
| `prep_consume` | 1 | Central Store | − |
| `prep_produce` | 1 | Central Store | + |
| `waste` | 1 | Any | − |
| `adjustment` | 1 | Any | ± |
| `dispatch_out` | 2 | Central Store | − |
| `dispatch_in` | 2 | Branch Department | + |
| `market_receive` | 2 | Branch Department | + |
| `sale` | 3 | Branch Department | − |

**Cost follows stock.** Raw/pass-through cost comes from supplier invoices at receiving.
Prepped cost is rolled up per production run (actual input cost ÷ **actual** yield).
Market item cost comes from what the department recorded paying that day. Cost travels
with dispatches, so each branch department produces a true food-cost figure even though
most purchasing happens at the Central Store.

**Variance is isolated by location** — the strategic payoff:

| Variance point | Compares | Catches |
|---|---|---|
| Prep (Central Store) | Expected vs. actual yield per run | Over-portioning, trimming loss, recipe drift |
| Transfer | `dispatched_qty` vs. `received_qty` | Loss in transit, dispatch/receipt miscounts |
| Branch Department | Theoretical stock vs. physical count | Department waste, theft, over-portioning at service |

---

## 2. Wendo-Specific Decisions (Made — do not re-litigate without cause)

| # | Decision | Rationale |
|---|---|---|
| D-1 | **The Central Store is its own location type — not a branch, not `Branch.isHub`.** Resolved 2026-07-22 (supersedes the original D-1/OD-1, which had proposed extending `Branch`). | The client corrected this directly: the store is "more like a central store," never a point of sale, and must not be modeled as a branch variant. |
| D-1a | **A branch is not itself a stock-holding location — its departments are.** Each branch has up to five department-locations (Kitchen, Pastry, Barista, Service, Housekeeping), each with independent stock, requisitioning independently from the Central Store. Confirmed by the client's existing paper trail (five parallel daily stock-sheet templates). | Matches operational reality: five department heads, five separate counts, five separate requisitions — never one branch-level number. |
| D-1b | **Items are department-scoped.** Every catalog item declares which department(s) requisition it; a department's screens show only its own slice. | Barista never orders chicken; Service never orders coffee beans — confirmed by the client's sheets, which never cross-list items between departments. |
| D-1c | **No cross-department or cross-branch transfers in v1.** A department's stock only grows via Central Store dispatch or direct market purchase. | Confirmed explicitly by the client: "no sideways transfers." Keeps the ledger's inbound paths to exactly two per department. |
| D-2 | **New role for the Central Store** (working name `STORE_KEEPER`). None of the existing 10 roles fits procurement/receiving/dispatch. Full RBAC wiring per non-negotiables. | Storekeeper and production supervisor may be the same person initially; keep permissions separable. |
| D-2a | **New role for branch department heads** (working name `DEPARTMENT_HEAD`, parameterized by department type) — or reuse existing branch roles (chef, barista, waiter-lead) with an inventory permission layered on. Schema decision pending at Phase 1 design. | Each department head requisitions and counts their own department; existing chef/barista/waiter roles may already map closely enough to avoid a new role explosion. |
| D-3 | **Deduction fires on order close** (Phase 3), via background job (BullMQ) — never in the synchronous order path. | One well-defined moment, tied to revenue (food cost % needs it), composes with Phase 11/12 cancellation/correction flows. Items removed before close never deduct; prepared-then-cancelled food is captured via the existing incident log → waste entries. |
| D-4 | **Base-recipe deduction only in v1 — no modifier-aware deduction.** `OrderItem` carries free-text `notes`, not structured modifiers; there is nothing machine-readable to hook into. Modifier variance leaks into department variance (small for a coffee bistro). | Structured modifiers are a separate future workstream touching cart, order flow, and prep-ticket reconciliation. Accepted knowingly. |
| D-5 | **Dispatches use an explicit In-Transit state.** Each ledger write is atomic (Prisma `$transaction`), but the dispatch document lives in `DISPATCHED`/in-transit between `dispatch_out` and `dispatch_in`. | Matches Odoo's transit-location pattern; makes the three-quantity line meaningful. |
| D-6 | **Three quantities on every dispatch line:** `requested_qty` / `dispatched_qty` / `received_qty`. requested−dispatched = Central Store shortfall; dispatched−received = transit loss. | More rigorous than most mainstream tools; the shortfall signal comes free. |
| D-7 | **UOM conversion (buy unit vs. usage unit) is a hard Phase 1 requirement.** Buy milk in litres, deduct in ml; buy beans in kg, deduct in g. | Branch-side fractional consumption of pass-through items depends on it. |
| D-8 | **Costing method: weighted average per item per location** in v1 — not FIFO batch layers. | 95% of the value, far less complexity. FIFO/shelf-life dispatch can layer on later. |
| D-9 | **Inventory never blocks selling.** Menu items without usage recipes sell normally; deduction skips them and a coverage report shows gaps. Negative theoretical stock is allowed and flagged, never an order error. | Service > bookkeeping, always. |
| D-10 | **Every new table carries `organizationId`** and follows the existing controller → service → repository split, Zod validation, and auth/RBAC middleware. | Project non-negotiables. |
| D-11 | **Direct market purchases are ledger-tracked (`market_receive`), not treated as an untracked expense.** Logged by the branch department at time of purchase — no supplier PO, no Central Store leg, cost is whatever was paid that day. | Client confirmed produce-heavy dishes need working recipes/costing/variance; excluding market goods from the ledger would leave every dish with fresh produce uncosted. |

**v1 scope exclusions** (from the research doc, confirmed): no raw prep at branch
departments beyond market-item use-as-is; no composite prep (prepped items feeding other
prep recipes); no returns to the Central Store; no cross-department or cross-branch
transfers; no invoice OCR; no offline counting; no demand forecasting.

---

## 3. Delivery Process (applies to every phase)

**Prototype → client approves → build → pilot with real data → ship.**

1. **Prototype** the phase's key screens cheaply (throwaway page or Figma) — always
   populated with the client's *real* items, suppliers, and menu. Familiar data gets real
   feedback; fake data gets polite nods.
2. **Client approval** of the prototype gates the build.
3. **Build** per project standards (tests included — a feature without tests is not complete).
4. **Pilot**: one location runs the phase **in parallel with paper** for the gate period.
   The gate criterion is always *"staff used it with real data and the numbers reconcile"* —
   never *"the client liked the screens."*
5. **Ship**, then start the next phase.

UX rule for all phases — two kinds of screens, designed differently:

- **"Sitting down"** (catalog, recipes, POs, reports): desktop dashboard, existing
  ExcelTable/Sheet patterns from the UI System Overhaul.
- **"Standing up"** (receiving, counting, waste, production completion, dispatch,
  requisitions): mobile-first, big touch targets, numeric keypads, per-line autosave
  (the pattern proven in the payroll sheet). If receiving a delivery is slower than
  signing the paper invoice, the storekeeper stops using it and the data rots.

---

## 4. Phase 1 — The Central Store (Supplier → Central Store)

Everything inside the Central Store's walls. End state: the store knows what it owns,
what it made, and what everything cost. Branch departments don't exist in the inventory
world yet — this phase is scoped to the Central Store location only.

### Cast
- **Storekeeper** (new role): receiving, counts, stock records, POs.
- **Production supervisor / head chef**: production runs, prep recipes, yields.
- **Director / Accountant**: read-only reports.

### One-time setup
1. **Item catalog** — every stockable item: name, type (raw/prepped/pass-through), buy
   unit, usage unit + conversion, reorder level, and the department(s) it will
   eventually be relevant to (captured now even though dispatch is Phase 2, so the
   catalog doesn't need rework later). From the client's real stock list.
2. **Suppliers** — name, contact, what they supply. The store manager configures which
   supplier is used for which item (Wendo already splits purchasing across a
   supermarket for pantry/consumables and separate meat/dairy suppliers).
3. **Prep recipes** — inputs + quantities + expected yield, per prepped item.
4. **Opening stock count** — physical count, entered as day zero.

### Recurring workflows
- **Purchasing & receiving:** raise PO (with low-stock suggestions) → on delivery, record
  actual quantity + invoice price per line → `receive` transactions, stock and current
  cost updated. Partial deliveries keep the PO open. Short deliveries and price changes
  are captured, not blocked.
- **Production:** pick recipe + batch size → system scales ingredients, checks
  availability → on completion, record actual inputs used + actual yield →
  `prep_consume` + `prep_produce` written, unit cost computed (input cost ÷ actual
  yield), yield variance recorded and **shown immediately at entry**.
- **Counting:** count session (shelf-to-sheet order — list matches the physical walking
  order of the store) → expected vs. counted → gap written as `adjustment` with reason.
  Waste logged as it happens via its own 3-tap entry, keeping counts clean.

### Reports delivered
Live stock on hand (qty + value) · low-stock alerts · price history per item/supplier ·
prep yield by recipe/run · count discrepancy · true cost per prepped item.

### Screens
| # | Screen | Context |
|---|---|---|
| 1 | Stock on Hand (landing) — search/filter, type badges, low-stock flags; tap item → **movement history** (its ledger slice) | Desktop/tablet |
| 2 | Item Catalog CRUD (incl. department tags) | Desktop |
| 3 | Suppliers CRUD + price-history detail, incl. assigning a default supplier per item | Desktop |
| 4 | PO list (Draft → Sent → Partially Received → Closed) + create with "suggest order" prefill | Desktop |
| 5 | **Receiving** — per-line ordered qty prefilled, correct to actual, invoice price; inline discrepancy highlight; one confirm. Target: 15 lines < 3 min | Phone, delivery bay |
| 6 | Prep Recipe editor | Desktop |
| 7 | Production Run — start (scaled ingredients, availability) / complete (actuals → instant cost + yield variance) | Phone/tablet, kitchen |
| 8 | Stock Count session — shelf-to-sheet order, per-line autosave, pause/resume → variance summary → confirm | Phone |
| 9 | Waste Log — item, qty, reason picker, optional note | Phone |
| 10 | Reports (price history, yields, discrepancy, valuation) | Existing reports nav |

### Build notes
New entities: `InventoryItem` (with department-scope tags), `Supplier`,
`PurchaseOrder`(+lines), `PrepRecipe`(+lines), `ProductionOrder`(+lines),
`StockCount`(+lines), `WasteLog` (or waste as transaction + reason),
`InventoryTransaction`. Full transaction enum ships now (D-decisions apply: org scoping,
UOM conversion, weighted-average cost). New `STORE_KEEPER` role + RBAC + Inventory nav
section. `Location` is introduced now as its own entity (not `Branch.isHub`) — Phase 1
creates exactly one `Location` row (the Central Store); Phase 2 adds one per branch
department.

### Gate
Storekeeper + Central Store run **one real week in parallel with paper**: every
delivery, ≥2 production runs, one full count. Pass: ledger reconciles with physical
count, prices match invoices, staff operate it unassisted.

---

## 5. Phase 2 — Central Store to Branch Departments

The distribution pipeline. End state: every branch department has live, priced
inventory; loss in transit is visible; Director sees all locations. This phase also
introduces the direct-market-purchase path, since it's how branch departments get their
other major stock category (fresh produce).

### Cast
- **Storekeeper** — now also dispatcher: requisition queue, picking, dispatch.
- **Department heads** (Kitchen, Pastry, Barista, Service, Housekeeping) per branch —
  morning/afternoon/evening requisition, receiving dispatches, logging market purchases,
  department-level waste + counts.
- **Director** — cross-location visibility.

### One-time setup
1. **Branch departments become inventory locations** — five per branch (Kitchen, Pastry,
   Barista, Service, Housekeeping), each its own ledger scope. Not every branch
   necessarily runs all five; configurable per branch.
2. **Dispatchable item list per department** — derived from the department-scope tags
   captured in Phase 1; raw ingredients are invisible to branch departments (Central
   Store rule enforced at the data level) except where a market item is itself raw.
3. **Par levels** per department per item (recommended) — powers suggested requisitions.
4. Opening department counts.

### Recurring workflows
- **Morning/afternoon/evening requisition (department):** par-based suggestions
  prefilled (par − on-hand) → adjust → submit, from that department's own scoped item
  list only. Target < 5 minutes. Matches the client's existing three-times-daily
  rhythm (morning, afternoon, evening) seen on their paper sheets.
- **Fulfillment & dispatch (Central Store):** requisition appears in dispatch queue,
  labeled by branch + department → per line, requested vs. available → enter dispatched
  qty (partial fulfillment normal, shortfall flagged) → confirm → `dispatch_out`,
  transfer status **In Transit**, **delivery note prints** via existing Bluetooth
  thermal printing infra. Cost travels per line.
- **Receiving a dispatch (department):** open incoming dispatch on phone → dispatched
  qtys prefilled → confirm/correct → `dispatch_in` (department stock up by received qty)
  → dispatch closes. dispatched−received gap auto-flagged as transfer variance, valued
  in KES.
- **Market purchase (department, produce only):** log what was bought at the market
  today — item, qty, cost paid → `market_receive` directly into the department's own
  stock. No PO, no Central Store leg, no dispatch document.
- **Department counts & waste:** Phase 1 components, department-scoped instead of
  Central-Store-scoped.

> **Expectation to set with the client:** until Phase 3, sales don't deduct stock, so a
> department count's gap is *consumption + loss blended*. Still useful (weekly usage per
> item per department — a number they've never had) but it cannot separate theft from
> sales yet. Say this up front to protect trust in the numbers.

### Reports delivered
Stock on hand per department (Director overview, rolled up by branch) · in-transit view
· transfer variance (per dispatch/department/item) · fulfillment report (requested vs.
dispatched — which departments are chronically short-supplied) · weekly usage per item
per department (count-down method) · market spend by department (a number they've
never had visibility on either).

### Screens
| # | Screen | Context |
|---|---|---|
| 1 | Dispatch queue (New → Picking → Dispatched), branch+department-labeled, oldest first | Central Store tablet/desktop |
| 2 | Fulfillment — requested vs. available per line, enter dispatched, confirm → print delivery note | Central Store tablet/desktop |
| 3 | Dispatches list — in-transit + history, variance flags | Central Store/Director |
| 4 | New Requisition — par-suggested prefills, numeric steppers, department-scoped item list | Branch dept phone |
| 5 | Receive Dispatch — prefilled lines, confirm/correct, discrepancy highlight | Branch dept phone |
| 6 | Log Market Purchase — item, qty, cost paid, one confirm | Branch dept phone (Kitchen mainly) |
| 7 | Branch Department Stock on Hand — same table component, department-scoped, movement drill-down | Branch dept |
| 8 | Waste + Count sessions — Phase 1 components reused, department-scoped | Branch dept |
| 9 | Cross-location overview + variance/fulfillment reports | Director, existing reports nav |

### Build notes
New entities: `Requisition`(+lines), `Dispatch`(+lines with the three quantities),
`MarketPurchase`(+lines), `ParLevel`. `Location` gains one row per (branch, department)
pair. Dispatch lifecycle mirrors the existing `StaffTransfer` / authorization-request
patterns. Ledger gains `dispatch_out`/`dispatch_in`/`market_receive` usage — no
restructuring.

### Gate
One branch (pick the busier one — stress finds bugs), all five of its departments, run
**two weeks in parallel with paper delivery notes**: daily requisitions, real dispatches
and receipts, real market purchases, one full count per department. Pass: dispatches
reconcile against paper notes, variance numbers are explainable, requisition genuinely
takes < 5 minutes per department.

---

## 6. Phase 3 — Branch Departments to Customers (Sale)

Closes the loop. The least new daily work (waiters/kitchen/barista change **nothing**
beyond what Phase 2 already introduced), the most new intelligence. End state: a
shilling of chicken is traceable from supplier invoice (or market receipt) to a burger
sold at a branch department, and every gap in between has a location and a number.

### Cast
- **Department heads / Director** — usage recipes (the one real workload), scoped per
  department.
- **Service staff** — zero *additional* change beyond Phase 2. No new screens, no new
  taps. Tell the client this.
- **Department heads** — same counts/waste as Phase 2; the variance now means something.
- **Director / Accountant** — food cost %, variance, item profitability.

### One-time setup
1. **Usage recipes for every menu item** — components (prepped + pass-through + market
   items) with quantities in usage units, scoped to the department that sells the menu
   item (e.g. Latte → Barista; Grilled Chicken Burger → Kitchen). The recipe editor
   shows **live recipe cost vs. menu price** during entry — makes the data-entry lift
   feel like discovery and catches absurd entries immediately.
2. Coverage, not blocking (D-9): unmapped items sell normally; coverage report ranks
   gaps by sales volume.
3. Decisions D-3 (deduct on order close, async) and D-4 (base-recipe only) apply.

### What happens on every sale
Order closes → BullMQ job explodes each order line through its usage recipe × quantity →
`sale` transactions per component at that department's location, carrying current unit
cost → COGS per order → food cost % per branch (rolled up across its departments).
All 9 ledger types now live.

### What changes for counts
Same physical routine; the system now computes **true theoretical stock** (dispatches in
+ market receives − sales deductions − waste), per department. Phase 2's blended gap
splits: "received 8 kg, counted 1.5 kg" becomes "5.9 kg sold, 0.3 kg logged waste, **0.3
kg unexplained**" — valued in KES, per item, per department. That last number is why the
system exists.

### Reports delivered
Theoretical vs. actual variance (department/item/period, KES, drill-to-ledger) · food
cost % per branch and per department (consumption cost ÷ revenue) · menu item
profitability (recipe cost vs. price vs. volume — menu engineering) · waste rate per
department · recipe coverage.

### Screens
| # | Screen | Context |
|---|---|---|
| 1 | Usage Recipe editor — component lines, live cost + margin preview, department scope selector | Desktop |
| 2 | Recipe coverage dashboard — unmapped items ranked by sales volume | Desktop |
| 3 | Variance report — branch/department/item/period, KES, ledger drill-down | Reports nav |
| 4 | Food cost & profitability dashboards — Director cross-branch, cross-department | Reports nav |

No new branch or service-staff screens.

### Build notes
New entities: `UsageRecipe`(+lines) keyed to `MenuItem`, scoped to a department type.
Deduction job + compensating logic for Phase 11/12 cancellation/correction paths
(removed-before-close never deducts; prepared-then-cancelled routes incident → waste).
Ledger gains `sale` usage.

### Gate
**Two-week parallel run** at the pilot branch: weekly physical counts vs. system
theoretical, per department. Pass: variances are *explainable* on investigation (a cause
is findable — miscounted delivery, unlogged waste, wrong portion), recipe coverage ≈
100% of sales volume, and the Director confirms food cost % passes their gut check. Only
then do the numbers get used for decisions.

---

## 7. Open Decisions Log

| # | Decision | Status |
|---|---|---|
| OD-1 | ~~Central kitchen schema shape: extend `Branch` vs. new `Location` entity~~ | **Resolved 2026-07-22 — see D-1.** Central Store is its own `Location`, never `Branch.isHub`. |
| OD-2 | Storekeeper vs. production supervisor: one person or two? Affects role/permission split | Ask client at Phase 1 prototype review |
| OD-2a | Department-head role modeling: new parameterized `DEPARTMENT_HEAD` role vs. layering an inventory permission onto existing chef/barista/waiter-lead roles | Resolve at Phase 2 schema design |
| OD-3 | ~~Branch requisition/receiving permissions: Manager-only, or nominated senior staffer per branch~~ | **Superseded by D-1a/D-2a** — requisition/receiving is per department head, not a single branch-level permission. Still open: does a Branch Manager retain an override/approval role across all departments in their branch? |
| OD-4 | Blind counts (hide expected qty during counting — recommended default) with Director-level toggle | Confirm with client |
| OD-5 | Count rhythm per department (the client's paper sheets show twice-daily opening/closing per department — confirm this is the target rhythm, not weekly) | Confirm with client — likely resolved in favor of daily, pending explicit confirmation |
| OD-6 | Dispatch rhythm as branches spread geographically (client's sheets show morning + afternoon + evening requisition slots) | Revisit before Phase 2 build as expansion proceeds |
| OD-7 | Fryer-oil-style session consumption (not per-order) — modeled via waste/adjustment in v1 | Accepted; revisit if material |
| OD-8 | **Design direction: Wendo brand, Carbon thinking** (settled 2026-07-22). The inventory module keeps the existing Wendo design system (tokens, components, Round 0 Sheet/ExcelTable) but uses IBM Carbon as the *pattern reference* for data-dense UI/UX decisions — table toolbars, side-panel forms, progressive disclosure, confirm-or-correct flows. No Carbon dependency; no design-system fork. | Settled |
| OD-9 | Supplier accounts payable / invoicing (what's owed per supplier, payment status, generating invoices) — not covered anywhere in this plan; `receive` transactions capture invoice *price*, not invoice *settlement*. | Open — needs owner decision: separate supplier-AP module (mirroring the existing customer-credit/`accountant/credit` pattern) vs. extending Phase 1's `PurchaseOrder` model |
| OD-10 | **eTIMS integration** (KRA's Electronic Tax Invoice Management System) for supplier purchases — validating/recording the supplier's eTIMS invoice number or control code against a received PO. Not built or mocked in the prototype deliberately — live government tax-compliance API with real legal consequences. | Open — needs owner + accountant/tax-advisor scoping before any build or UI work |
| OD-11 | **Does a branch itself need any aggregate view/role**, given departments — not branches — hold stock? (e.g. a Branch Manager dashboard rolling up all five departments at their branch.) Raised 2026-07-22 alongside D-1a. | Open — likely yes for Director/Manager reporting; resolve at Phase 2 schema design |
| OD-12 | **Not every branch may run all five departments** (a smaller branch might not have its own Pastry or Housekeeping function). Confirm per-branch department configuration is needed vs. all five always provisioned. | Open — confirm with client at Phase 2 prototype review |

## 8. Future Extensions (explicitly deferred, model already accommodates)

Invoice OCR receiving (fills the same receiving screen; no data-model change) ·
structured modifiers + modifier-aware deduction · demand forecasting / suggested pars
from sales history · returns to the Central Store · cross-department transfers within a
branch · branch-to-branch transfers · composite prep · FIFO/shelf-life batch tracking ·
offline counting.

---

## 9. Prior Build Attempt (discarded 2026-07-28)

A prototype and a full Phase 1 build (backend + frontend) were built on branch
`proto/inventory-phase1` between 2026-07-22 and 2026-07-25. The branch was deleted
2026-07-28 to restart the feature from scratch — nothing from that build (schema,
services, routes, screens, mock data) carried forward. Only this plan, the domain
model doc, and the client reference photos in `docs/context/inventory-real-data/`
were kept. Do not assume any inventory schema, code, or routes exist in the codebase
until this feature is rebuilt.

---

*Prepared 2026-07-22. Revised 2026-07-22 same day, post client walkthrough, to correct
the location model (Central Store, not Central Kitchen-as-branch) and introduce branch
departments and the direct-market-purchase path. Companion to
`docs/context/central_kitchen_inventory_model.md` (domain model). Update the Status
section and log decisions here as phases complete.*
