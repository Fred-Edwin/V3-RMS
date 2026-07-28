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
   predated this correction and no longer exists in the codebase — see §10.

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
   ↓  Prep (raw → prepped, logged as actuals — see D-12)
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

| Type | Definition | Example | Appears in Prep? |
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

**Prep is actuals-first, no recipe required (D-12); Usage Recipe is the one true
recipe tier:**

- **Prep** (Central Store): raw ingredients → prepped item. Logged as a `PrepRecord` —
  the attendant records what was actually used and actually produced, no predefined
  recipe needed. An optional, Manager-authored `PrepRecipe` can exist purely as a
  soft reference (typical quantities), never a precondition. See §4 and D-12.
- **Usage Recipe** (branch department): prepped + pass-through + market items → menu
  item sold, scoped to the department that sells it. This one *is* a predefined recipe
  (Phase 3) — it drives automatic deduction on order close, which needs a plan to
  explode against, unlike Prep which is recorded after the fact.

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
Prepped cost is rolled up per Prep Record (actual input cost ÷ **actual** yield, logged
at the time of prepping — see D-12). Market item cost comes from what the department
recorded paying that day. Cost travels with dispatches, so each branch department
produces a true food-cost figure even though most purchasing happens at the Central
Store.

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
| D-1a | **A branch is not itself a stock-holding location — its departments are.** Every branch runs all five departments (Kitchen, Pastry, Barista, Service, Housekeeping) — confirmed 2026-07-28, no per-branch configuration needed (resolves OD-12). Each is its own location with independent stock, requisitioning independently from the Central Store. Confirmed by the client's existing paper trail (five parallel daily stock-sheet templates). | Matches operational reality: five department heads, five separate counts, five separate requisitions — never one branch-level number. |
| D-1b | **Items are department-scoped.** Every catalog item declares which department(s) requisition it; a department's screens show only its own slice. | Barista never orders chicken; Service never orders coffee beans — confirmed by the client's sheets, which never cross-list items between departments. |
| D-1c | **No cross-department or cross-branch transfers in v1.** A department's stock only grows via Central Store dispatch or direct market purchase. | Confirmed explicitly by the client: "no sideways transfers." Keeps the ledger's inbound paths to exactly two per department. |
| D-2 | **Two roles at the Central Store — resolved 2026-07-28, no `STORE_KEEPER`/production-supervisor split (closes OD-2).** `STORE_MANAGER` — full control: catalog, suppliers, supplier AP/invoicing, PO send/approval, prep, stock-count approval, reports. `STORE_ATTENDANT` — day-to-day labour: receiving, prep entry, stock-count submission, waste logging; sees operational cost/price data (current cost, PO prices, invoice prices at receiving) but has **no access at all to Supplier AP** (invoicing, amounts owed, settlement — not even read-only). Full detail in §8. | One manager in charge of everything, one attendant doing the floor work — matches how the client actually staffs the store. The only walled-off data is accounts-payable/settlement, not operational costs. |
| D-2a | **New role for branch department heads** (working name `DEPARTMENT_HEAD`, parameterized by department type) — or reuse existing branch roles (chef, barista, waiter-lead) with an inventory permission layered on. Schema decision pending at Phase 2 design. | Each department head requisitions and counts their own department; existing chef/barista/waiter roles may already map closely enough to avoid a new role explosion. |
| D-3 | **Deduction fires on order close** (Phase 3), via background job (BullMQ) — never in the synchronous order path. | One well-defined moment, tied to revenue (food cost % needs it), composes with Phase 11/12 cancellation/correction flows. Items removed before close never deduct; prepared-then-cancelled food is captured via the existing incident log → waste entries. |
| D-4 | **Base-recipe deduction only in v1 — no modifier-aware deduction.** `OrderItem` carries free-text `notes`, not structured modifiers; there is nothing machine-readable to hook into. Modifier variance leaks into department variance (small for a coffee bistro). | Structured modifiers are a separate future workstream touching cart, order flow, and prep-ticket reconciliation. Accepted knowingly. |
| D-5 | **Dispatches use an explicit In-Transit state.** Each ledger write is atomic (Prisma `$transaction`), but the dispatch document lives in `DISPATCHED`/in-transit between `dispatch_out` and `dispatch_in`. | Matches Odoo's transit-location pattern; makes the three-quantity line meaningful. |
| D-6 | **Three quantities on every dispatch line:** `requested_qty` / `dispatched_qty` / `received_qty`. requested−dispatched = Central Store shortfall; dispatched−received = transit loss. | More rigorous than most mainstream tools; the shortfall signal comes free. |
| D-7 | **UOM conversion (buy unit vs. usage unit) is a hard Phase 1 requirement.** Buy milk in litres, deduct in ml; buy beans in kg, deduct in g. | Branch-side fractional consumption of pass-through items depends on it. |
| D-8 | **Costing method: weighted average per item per location** in v1 — not FIFO batch layers. | 95% of the value, far less complexity. FIFO/shelf-life dispatch can layer on later. |
| D-9 | **Inventory never blocks selling.** Menu items without usage recipes sell normally; deduction skips them and a coverage report shows gaps. Negative theoretical stock is allowed and flagged, never an order error. | Service > bookkeeping, always. |
| D-10 | **Every new table carries `organizationId`** and follows the existing controller → service → repository split, Zod validation, and auth/RBAC middleware. | Project non-negotiables. |
| D-11 | **Direct market purchases are ledger-tracked (`market_receive`), not treated as an untracked expense.** Logged by the branch department at time of purchase — no supplier PO, no Central Store leg, cost is whatever was paid that day. | Client confirmed produce-heavy dishes need working recipes/costing/variance; excluding market goods from the ledger would leave every dish with fresh produce uncosted. |
| D-12 | **Prep has no predefined recipe requirement — resolved 2026-07-28.** The Store Attendant does not work from an authored recipe. They log a **Prep Record**: the output item, the inputs actually used (item + quantity per input), and the actual yield produced. Cost is computed the same way as before (total input cost ÷ actual yield) — this math only needs actuals, not a plan. See §4 for the full mechanic, including the optional "promote to Prep Recipe" path. | Matches how the client's kitchen actually works — nobody there authors a recipe before prepping; they just prep and it gets recorded. Forcing a recipe-first flow would be inventing a step that doesn't exist in the real process. |
| D-13 | **Supplier AP/invoicing is in v1 scope, resolved 2026-07-28 (closes OD-9).** A `SupplierInvoice` tracks what Wendo owes a given supplier — separate from `receive` transactions, which only capture unit price. Full mechanic in §4a. Store Manager only; Store Attendant has zero access (not even read-only). | Client wants to track what's owed per supplier, not just what was paid per item — otherwise there's no answer to "how much do we owe Supplier X right now." |
| D-14 | **Blind counting is a permanent role rule, not a toggle — resolved 2026-07-28 (closes OD-4).** During a stock count, `expectedQty` is **always hidden from Store Attendant** and **always visible to Store Manager** — never a per-session or Director-level setting. Enforced server-side (the API response itself omits `expectedQty` for an Attendant-authenticated request), not just hidden in the UI. | The attendant should not know what the system expects before they count, so the count reflects what they actually find, not what they think they should report. A frontend-only hide isn't sufficient — same principle as any role-restricted field. |

**v1 scope exclusions** (from the research doc, confirmed): no composite prep (prepped
items feeding other prep runs); no returns to the Central Store; no cross-department or
cross-branch transfers; no invoice OCR; no offline counting; no demand forecasting.

---

## 3. UX/UI Approach

See §8 for the full decision and the per-screen desktop/mobile breakdown. In short:
Store Attendant is mobile-only, so every Attendant screen is designed mobile-first with
big touch targets, numeric keypads, and per-line autosave (the pattern proven in the
payroll sheet). Store Manager works on both desktop and mobile, and — because visual
quality is a competitive priority here — Manager screens get **two separate,
purpose-built UIs** (a dense desktop layout and a distinct mobile layout), not one
responsive layout stretched across breakpoints. Build now against the current design
system; expect a restyling pass once the planned whole-product design-system redo
reaches this module (decision logged 2026-07-28: proceed now, don't block on the redo).

---

## 4. Phase 1 — The Central Store (Supplier → Central Store)

Everything inside the Central Store's walls. End state: the store knows what it owns,
what it prepped, and what everything cost. Branch departments don't exist in the
inventory world yet — this phase is scoped to the Central Store location only.

### Cast
- **Store Manager**: full control — catalog, suppliers, supplier AP, PO send/approval,
  stock-count approval, reports.
- **Store Attendant**: day-to-day labour — receiving, prep entry, stock-count
  submission, waste logging. Sees operational cost/price data throughout (current cost,
  PO prices, invoice prices); has zero access to Supplier AP. Full role/screen detail
  in §8.
- **Director / Accountant**: read-only reports.

### One-time setup
1. **Item catalog** — every stockable item: name, type (raw/prepped/pass-through), buy
   unit, usage unit + conversion, reorder level, and the department(s) it will
   eventually be relevant to (captured now even though dispatch is Phase 2, so the
   catalog doesn't need rework later). From the client's real stock list.
2. **Suppliers** — name, contact, what they supply. The Store Manager configures which
   supplier is used for which item (Wendo already splits purchasing across a
   supermarket for pantry/consumables and separate meat/dairy suppliers).
3. **Opening stock count** — physical count, entered as day zero.

No prep-recipe setup step — see D-12 and the Prep mechanic below; recipes are optional
and created later, if at all.

### Recurring workflows
- **Purchasing & receiving:** raise PO (with low-stock suggestions) → on delivery, record
  actual quantity + invoice price per line → `receive` transactions, stock and current
  cost updated. Partial deliveries keep the PO open. Short deliveries and price changes
  are captured, not blocked.
- **Prep (D-12 — no predefined recipe required):** attendant picks the *output* item
  being prepped → logs the inputs actually used (item + quantity, as many lines as
  needed) → logs the actual yield produced → confirms. This writes `prep_consume` (per
  input) + `prep_produce` (the output) in one atomic transaction, and computes unit cost
  = total input cost ÷ actual yield. The entry screen shows a **soft reference**
  ("Typical: ~6kg chicken → ~5.6kg output"), computed as a rolling average over the last
  N Prep Records for that same output item — informational only, never blocking, never
  required to match. Once a pattern is established for a given output item, the Store
  Manager can **promote** a representative Prep Record into a saved `PrepRecipe`
  (optional, Manager-authored, used only for the soft-reference nudge and future
  standardization/training — never a precondition for prepping).
- **Counting:** count session (shelf-to-sheet order — list matches the physical walking
  order of the store) → expected vs. counted → gap written as `adjustment` with reason.
  Waste logged as it happens via its own 3-tap entry, keeping counts clean.

### Reports delivered
Live stock on hand (qty + value) · low-stock alerts · price history per item/supplier ·
prep yield by output item/run · count discrepancy · true cost per prepped item · supplier
AP aging (see §4a).

### Screens
Full screen-by-screen detail (desktop + mobile, per role) lives in §8 — Roles &
Screens. Phase 1's screens: Stock on Hand, Item Catalog, Suppliers, Supplier
Invoices/AP, Purchase Orders, Receiving, Prep entry, Stock Count session, Waste Log,
Reports.

### Build notes
New entities: `InventoryItem` (with department-scope tags), `Supplier`,
`SupplierInvoice`(+payments, see §4a), `PurchaseOrder`(+lines), `PrepRecipe`(+lines,
optional/Manager-authored), `PrepRecord`(+lines — the actuals-only entry attendants
log), `StockCount`(+lines), `WasteLog` (or waste as transaction + reason),
`InventoryTransaction`. Full transaction enum ships now (D-decisions apply: org scoping,
UOM conversion, weighted-average cost). New `STORE_MANAGER` + `STORE_ATTENDANT` roles +
RBAC + Inventory nav section. `Location` is introduced now as its own entity (not
`Branch.isHub`) — Phase 1 creates exactly one `Location` row (the Central Store); Phase 2
adds one per branch department.

### Gate
Store Manager + Store Attendant run **one real week in parallel with paper**: every
delivery, ≥2 prep entries, one full count. Pass: ledger reconciles with physical
count, prices match invoices, staff operate it unassisted.

---

## 4a. Supplier AP / Invoicing

A running tab per supplier — the same mental model as the existing Customer Credit /
Corporate Account tabs, pointed the other direction (money Wendo owes, not money owed to
Wendo). Store Manager only; Store Attendant has zero access, not even read-only (D-2,
D-13).

**How it works:**
1. Receiving happens as normal (Attendant or Manager) — quantities and invoice price per
   line are recorded against the PO, exactly as in the base receiving flow.
2. The Store Manager separately records the **supplier invoice** for that delivery: the
   amount the supplier is billing and the invoice/reference number. This creates a
   `SupplierInvoice` linked to the PO, status `UNPAID`.
3. Whenever Wendo actually pays the supplier (which may be days or weeks after
   delivery), the Store Manager records a payment against that invoice: amount, method,
   date. Partial payments are supported.
4. Status updates automatically from the payments recorded: `UNPAID` →
   `PARTIALLY_PAID` → `PAID`.
5. A report shows, per supplier: total invoiced, total paid, total outstanding, and an
   aging view (how long each unpaid invoice has been outstanding) — the number that
   actually matters operationally, since a supplier owed money for 45 days behaves
   differently than one owed for 3.

Build notes: `SupplierInvoice` (linked to `PurchaseOrder`, amount, reference number,
status) + `SupplierPayment` (linked to `SupplierInvoice`, amount, method, date). No new
ledger transaction type needed — this tracks money owed, not stock movement, so it's
parallel to `InventoryTransaction`, not part of it.

---

## 5. Phase 2 — Central Store to Branch Departments

The distribution pipeline. End state: every branch department has live, priced
inventory; loss in transit is visible; Director sees all locations. This phase also
introduces the direct-market-purchase path, since it's how branch departments get their
other major stock category (fresh produce).

### Cast
- **Store Manager / Store Attendant** — now also dispatch: requisition queue, picking,
  dispatch (Manager sends/confirms; Attendant can fulfill day-to-day per the same split
  as Phase 1 — see §8).
- **Department heads** (Kitchen, Pastry, Barista, Service, Housekeeping) per branch, all
  five departments always provisioned (D-1a) — morning/afternoon/evening requisition,
  receiving dispatches, logging market purchases, department-level waste + counts.
- **Director** — cross-location visibility.

### One-time setup
1. **Branch departments become inventory locations** — five per branch (Kitchen, Pastry,
   Barista, Service, Housekeeping), each its own ledger scope. Every branch runs all
   five, always provisioned — no per-branch configuration (D-1a, resolves OD-12).
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
| OD-2 | ~~Storekeeper vs. production supervisor: one person or two? Affects role/permission split~~ | **Resolved 2026-07-28 — see D-2.** Two roles, `STORE_MANAGER` and `STORE_ATTENDANT`, no separate production-supervisor role. |
| OD-2a | Department-head role modeling: new parameterized `DEPARTMENT_HEAD` role vs. layering an inventory permission onto existing chef/barista/waiter-lead roles | Resolve at Phase 2 schema design |
| OD-3 | ~~Branch requisition/receiving permissions: Manager-only, or nominated senior staffer per branch~~ | **Superseded by D-1a/D-2a** — requisition/receiving is per department head, not a single branch-level permission. Still open: does a Branch Manager retain an override/approval role across all departments in their branch? |
| OD-4 | ~~Blind counts (hide expected qty during counting — recommended default) with Director-level toggle~~ | **Resolved 2026-07-28 — see D-14.** Not a toggle — a permanent role rule: expected qty is hidden from Store Attendant always, visible to Store Manager always. |
| OD-5 | Count rhythm per department (the client's paper sheets show twice-daily opening/closing per department — confirm this is the target rhythm, not weekly) | Confirm with client — likely resolved in favor of daily, pending explicit confirmation |
| OD-6 | Dispatch rhythm as branches spread geographically (client's sheets show morning + afternoon + evening requisition slots) | Revisit before Phase 2 build as expansion proceeds |
| OD-7 | Fryer-oil-style session consumption (not per-order) — modeled via waste/adjustment in v1 | Accepted; revisit if material |
| OD-8 | **Design direction: Wendo brand, Carbon thinking** (settled 2026-07-22, reaffirmed 2026-07-28 alongside the dual desktop/mobile UI decision in §8). The inventory module keeps the existing Wendo design system as its baseline (tokens, components, Round 0 Sheet/ExcelTable) but uses IBM Carbon as the *pattern reference* for data-dense UI/UX decisions — table toolbars, side-panel forms, progressive disclosure, confirm-or-correct flows. No Carbon dependency; no design-system fork. Superseded in part by the whole-product design-system redo being planned separately — this module builds against the current system now and gets restyled once the redo lands (decision logged 2026-07-28). | Settled |
| OD-9 | ~~Supplier accounts payable / invoicing (what's owed per supplier, payment status, generating invoices)~~ | **Resolved 2026-07-28 — see D-13 and §4a.** In v1 scope; `SupplierInvoice` + `SupplierPayment`, Store Manager only. |
| OD-10 | **eTIMS integration** (KRA's Electronic Tax Invoice Management System) for supplier purchases — validating/recording the supplier's eTIMS invoice number or control code against a received PO. Deliberately not built or scoped yet — live government tax-compliance API with real legal consequences. | Open — needs owner + accountant/tax-advisor scoping before any build or UI work |
| OD-11 | **Does a branch itself need any aggregate view/role**, given departments — not branches — hold stock? (e.g. a Branch Manager dashboard rolling up all five departments at their branch.) Raised 2026-07-22 alongside D-1a. | Open — likely yes for Director/Manager reporting; resolve at Phase 2 schema design |
| OD-12 | ~~Not every branch may run all five departments — confirm per-branch configuration is needed~~ | **Resolved 2026-07-28 — see D-1a.** Every branch always runs all five departments; no per-branch configuration. |

## 8. Roles & Screens (Store Manager, Store Attendant — Phase 1 scope)

This section is the single source of truth for what each Central Store role sees and
can do, screen by screen. It supersedes Phase 1's old "Screens" table (§4 now points
here) — Phase 2's and Phase 3's Screens tables (§5, §6) are unchanged and still stand
for their own phases. Phase 2/3 department-head and Director/Accountant screens will
get their own version of this section when those phases are designed — this section
covers Phase 1 (Store Manager, Store Attendant) only.

### 8.0 UI approach (read before designing any screen)

**Decision (2026-07-28):** visual design quality is a competitive priority — the client
actively compares this product against others in the market — so this module does not
take the usual pragmatic shortcut of one responsive layout reflowed across breakpoints.

- **Store Attendant is mobile-only.** Every Attendant screen is designed mobile-first,
  full stop: big touch targets, numeric keypad inputs, one thing at a time, per-line
  autosave (the pattern already proven in the payroll sheet). There is no desktop
  version of an Attendant screen to design, because Attendant never has permission to
  reach a screen that would need one (see the permissions matrix in §8.3 — the RBAC
  boundary and the mobile-only boundary line up exactly).
- **Store Manager uses both desktop and mobile, and gets two separate, purpose-built
  UIs per screen** — a dense desktop layout and a distinct mobile layout — not one
  component stretched to fit both. This is a deliberate cost: every Manager-facing
  screen is two designs and two implementations to build and keep visually consistent,
  not one. §8.1 below documents both layouts for every Manager screen up front, before
  build starts.
- **Design system timing:** build now against the current Wendo design system
  (tokens, ExcelTable/Sheet, Round 0 components — see `docs/DESIGN_SYSTEM.md`), using
  IBM Carbon only as a pattern reference for data-dense UI decisions (OD-8). Do not
  block this feature on the planned whole-product design-system redo. Expect a
  restyling pass on these screens once that redo reaches this module — this is an
  accepted, deliberate rebuild-later cost, not an oversight.

### 8.1 Store Manager — screens (desktop + mobile per screen)

| # | Screen | Desktop layout | Mobile layout |
|---|---|---|---|
| 1 | **Stock on Hand** (landing) | Dense ExcelTable: search/filter, type badges (raw/prepped/pass-through), low-stock flags, sortable columns (name, category, on-hand qty, current cost, value). Row click opens a side panel with the item's movement history (full ledger slice, paginated). | Card list, one item per card: name, type badge, on-hand qty, low-stock flag prominent. Tap card → full-screen movement history (chronological feed, not a table). Search bar pinned to top. |
| 2 | **Item Catalog CRUD** | Full ExcelTable with inline edit; side panel for create/edit (name, type, buy unit, usage unit, conversion factor, reorder level, department tags, default supplier, current cost shown read-only). Bulk actions (e.g. bulk department-tag assignment) available. | List view, tap item → full-screen edit form, one field group per step (identity → units → department tags → default supplier) rather than one long form, since small-screen long forms are error-prone. |
| 3 | **Suppliers CRUD + price history** | Table of suppliers (name, contact, item count) + detail side panel with price-history chart per item (reuses the existing `PriceTrendChart` pattern) and "assign as default supplier" action. | List → tap supplier → detail screen, price history as a simple sparkline + list (not a full chart — screen real estate), assign-default action as a button, not inline. |
| 4 | **Supplier Invoices / AP** (Manager-only, §4a) | Table of invoices (supplier, PO reference, amount, status, days outstanding) with a totals-by-supplier summary panel and an aging view (0–7/8–30/31+ days). Record-invoice and record-payment as modals. | List of invoices, status badge prominent (UNPAID/PARTIALLY_PAID/PAID), tap → detail screen with a "Record Payment" primary action. Aging shown as a compact status chip per invoice, not a separate chart. |
| 5 | **Purchase Orders** — list | Table: PO number, supplier, status (Draft/Sent/Partially Received/Closed/Cancelled), total value, date. Filter by status. "Create PO" opens a full-screen form with a "suggest order" prefill button (low-stock items). | List of PO cards (number, supplier, status badge). "New PO" is a prominent floating action button → step-by-step item picker (search, tap to add, quantity stepper) rather than a dense multi-row form. |
| 6 | **Purchase Orders** — send/cancel action | Inline action buttons on the PO detail view (desktop side panel). | Single primary action button on the PO detail screen, with a confirm step (send/cancel are consequential, so a lightweight confirm sheet, not a full modal). |
| 7 | **Receiving** | Same core flow as mobile (this is inherently a floor task — see §8.0), but on desktop it can show the full PO alongside a wider discrepancy-highlight table if the Manager is doing receiving from the office (rare, but the desktop layout should not break if used this way). | **Primary surface for this screen.** Per-line ordered qty prefilled, correct to actual, invoice price entry; inline discrepancy highlight (red if actual ≠ ordered); one confirm button at the bottom. Target: 15 lines in under 3 minutes. |
| 8 | **Prep entry** (D-12 — output item, inputs used, actual yield) | Desktop version exists for completeness (Manager reviewing/backfilling), shown as a form with a running cost calculation panel beside it, plus the rolling-average soft-reference shown as a small inline note. | **Primary surface.** Step flow: pick output item → add input lines (item + qty, repeatable, numeric keypad) → enter actual yield → confirm. Soft reference ("Typical: ~6kg → ~5.6kg") shown as a subtle hint above the yield field, never blocking. |
| 9 | **Prep Recipe editor** (optional, Manager-only — "promote" a Prep Record into a recipe) | Full editor: input lines with quantities, expected yield, batch label, instructions (rich text acceptable). Accessible from a Prep Record's detail view via "Save as Recipe." | Not designed for mobile — this is a deliberate, occasional desktop-only task (recipe authoring is reflective work, not floor work); Manager can view (not create/edit) a saved recipe on mobile if needed. |
| 10 | **Stock Count** — session creation | Desktop form: label, scheduled date, item selection (by department scope or full catalog), shelf-location ordering. No blind-count toggle — expected qty visibility is a fixed role rule (D-14), not a per-session setting. | Not typically initiated from mobile — session creation is a planning task; Manager creates from desktop, Attendant/Manager execute the count itself on mobile (see §8.2 screen 3). |
| 11 | **Stock Count** — approval | Desktop: variance summary table (expected vs. counted vs. gap, valued in KES), approve action posts adjustment transactions. Drill into any line for its full ledger history. | Compact variance summary list, tap a line for detail, single "Approve" action pinned to bottom of screen. |
| 12 | **Waste Log** — review | Desktop table: item, qty, reason, note, logged-by, date — filterable by reason/date range, feeds the waste-cost-by-category report. | Manager can log waste same as Attendant (§8.2 screen 4) but reviewing the full log is a desktop task. |
| 13 | **Reports** | Full dashboard: stock valuation, low-stock alerts, price history, prep yield by output item, count discrepancy, true cost per prepped item, supplier AP aging — existing reports-nav pattern, ExcelTable-driven, exportable PDF/CSV per project convention. | Single-metric summary cards (e.g. "Total stock value," "3 items low stock," "KES 42,000 owed to suppliers") with tap-through to a simplified single-report mobile view. Not a priority to fully replicate every desktop report on mobile in v1 — flag any report that's desktop-only in the build notes when reached. |

### 8.2 Store Attendant — screens (mobile only)

Every screen below is the *same mobile layout* the Store Manager sees for the
equivalent "standing up" task (§8.1 rows 7, 8, 10 count-execution, 12) — there is no
separate Attendant-specific design, only Attendant-specific *permissions* layered on
top (see §8.3). Attendant's nav is a simplified bottom-tab shell (same pattern as the
existing Waiter/Chef mobile nav) showing only the screens they can act on.

| # | Screen | What Attendant sees/does |
|---|---|---|
| 1 | **Stock on Hand** (read) | Same card-list view as Manager's mobile layout (§8.1 row 1) — full visibility into quantities, current cost, value. Read-only: no edit actions. |
| 2 | **Purchase Orders** — draft only | Can view PO list and create a new draft PO (item picker, quantities, prices visible) — cannot send it. No "Send" action appears; a pending-send status is visible so Attendant knows it's waiting on the Manager. |
| 3 | **Receiving** | Full receiving flow (§8.1 row 7 mobile layout) — quantities and invoice prices, both visible and editable. This is Attendant's core daily task. |
| 4 | **Prep entry** | Full Prep entry flow (§8.1 row 8 mobile layout) — this is Attendant's other core daily task. Cannot author or edit a saved Prep Recipe (view-only if one exists, as a soft reference). |
| 5 | **Stock Count — execution** | Opens a count session created by the Manager, enters counted quantities per line — **expected qty is never shown** (D-14, always blind for Attendant), pauses/resumes, submits when done. Cannot create a new session and cannot approve — submission hands off to the Manager. |
| 6 | **Waste Log — entry** | 3-tap entry: item, quantity, reason (picker: spoiled/prep error/dropped/expired/other), optional note. Same screen Manager uses to log waste themselves. |

**Explicitly not in Attendant's nav:** Item Catalog CRUD, Suppliers CRUD, Supplier
Invoices/AP (zero access, not even read-only — D-2, D-13), PO send/cancel, Prep Recipe
editor, Stock Count session creation/approval, Reports.

### 8.3 Permissions matrix

The authoritative table for RBAC middleware — every row is an endpoint-group ×
role check.

| Area | Action | Store Manager | Store Attendant |
|---|---|---|---|
| Item Catalog | View (incl. current cost) | ✅ | ✅ |
| Item Catalog | Create / edit / delete | ✅ | ❌ |
| Suppliers | View | ✅ | ✅ |
| Suppliers | Create / edit / delete / assign default | ✅ | ❌ |
| Supplier AP (invoices, payments, aging) | Any access, incl. read-only | ✅ | ❌ (zero access) |
| Purchase Orders | View (incl. prices) | ✅ | ✅ |
| Purchase Orders | Create (draft) | ✅ | ✅ |
| Purchase Orders | Send / cancel | ✅ | ❌ |
| Receiving | Record quantity + invoice price | ✅ | ✅ |
| Prep entry | Log a Prep Record (inputs, yield) | ✅ | ✅ |
| Prep Recipe | Create / edit ("promote" a record) | ✅ | ❌ (view-only, as soft reference) |
| Stock Count | Create session | ✅ | ❌ |
| Stock Count | Execute / submit | ✅ | ✅ |
| Stock Count | Approve (posts adjustments) | ✅ | ❌ |
| Waste Log | Log entry | ✅ | ✅ |
| Waste Log | View full log / review | ✅ | View own entries only (recommended default — confirm with client if full-log view is wanted) |
| Reports (stock valuation, yields, discrepancy, AP aging, etc.) | Any access | ✅ | ❌ |

## 9. Future Extensions (explicitly deferred, model already accommodates)

Invoice OCR receiving (fills the same receiving screen; no data-model change) ·
structured modifiers + modifier-aware deduction · demand forecasting / suggested pars
from sales history · returns to the Central Store · cross-department transfers within a
branch · branch-to-branch transfers · composite prep · FIFO/shelf-life batch tracking ·
offline counting.

---

## 10. Prior Build Attempt (discarded 2026-07-28)

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
departments and the direct-market-purchase path. Revised again 2026-07-28: closed
OD-2/OD-9/OD-12 (two Central Store roles, Supplier AP in scope, all five departments
always provisioned per branch), replaced the recipe-first Prep model with an
actuals-first Prep Record (D-12), added §4a (Supplier AP) and §8 (Roles & Screens —
full desktop/mobile spec for Store Manager and Store Attendant), and logged the
build-now/restyle-later decision on the pending design-system redo. Companion to
`docs/context/central_kitchen_inventory_model.md` (domain model). Update the Status
section and log decisions here as phases complete.*
