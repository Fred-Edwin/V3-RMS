# Feature Spec: Inventory Management
## Wendo Coffee Bistro — RMS V2.1
**Status:** Draft — Open questions remain (see Section 9)
**Phase:** V2.1
**Last Updated:** 2026-03-22

---

## 1. Overview

The Inventory Management feature gives Wendo end-to-end visibility of stock from the moment raw ingredients arrive at the Central Kitchen to the moment portions are consumed at a branch. It replaces a paper-based process with a digital chain of custody where every handover is recorded and every discrepancy is surfaced automatically.

**Primary problem it solves:** Management currently has no way to detect stock losses, verify that branches received what was sent, or know what stock levels are across branches without calling each branch individually.

---

## 2. Actors

| Actor | Role | What They Do |
|---|---|---|
| Store Manager | `STORE_MANAGER` | Logs supplier deliveries, reviews and dispatches branch requisitions, performs CK end-of-day count |
| Branch Manager | `MANAGER` | Submits morning and mid-day requisitions, confirms delivery receipt, performs end-of-day stocktake |
| Head Waiter | `WAITER` | Can receive deliveries on behalf of the Branch Manager |
| Director | `DIRECTOR` | Views inventory overview dashboard, receives low-stock alerts for raw ingredients |
| System | — | Deducts branch stock on PrepTicket READY, auto-hides menu items at zero stock, sends low-stock alerts |

---

## 3. Confirmed Business Rules

These are locked decisions — do not change without explicit client sign-off:

1. Morning requisitions must be submitted before **6:00 AM**
2. Only **Branch Managers** can submit requisitions — Head Chefs cannot
3. When two branches compete for limited stock, the **Store Manager decides** the allocation
4. **Branch Manager** is the primary delivery receiver; **Head Waiter** can receive on their behalf; Head Chef cannot
5. Portion sizes are **fully fixed** — defined in SOPs and never vary
6. End-of-day stocktake covers **three stations: Kitchen, Barista, Waiter** — the Branch Manager conducts all three counts
7. Mid-day emergency requisitions are expected to be **fulfilled same-day**
8. The **Central Kitchen performs a daily end-of-day raw ingredient count**

---

## 4. End-to-End Workflow

### 4.1 Supplier Delivers to Central Kitchen

A supplier delivers raw ingredients. The Store Manager logs each item:
- Select ingredient from the ingredient list
- Enter quantity received
- Select supplier
- Add optional notes
- Confirm

On confirmation, `RawIngredient.currentStockCk` is incremented and a `SupplierDelivery` record is created for audit.

### 4.2 Conversion Table (Set Once by Management)

For each menu item that uses raw ingredients, a conversion entry defines how much of each ingredient one portion consumes:

```
Chicken Burger = 0.15 kg of Chicken Breast
Chicken Pizza  = 0.20 kg of Chicken Breast + 0.05 kg of Cheese
```

These are set once by the Director or system admin and revised only when SOPs change. The system uses them to automatically calculate how many portions the Central Kitchen can fulfil from current raw stock.

### 4.3 Branch Submits Morning Requisition (by 6:00 AM)

Each morning the Branch Manager opens the requisition form and specifies:
- Quantities per menu item (in portions, not raw ingredient weights)
- Optional notes (e.g. expected events, large groups)

The system rejects submissions after the 6:00 AM cutoff unless the `isMidDay` flag is set (for emergency requisitions).

### 4.4 Central Kitchen Reviews and Dispatches

The Store Manager sees all branch requisitions for the day in one inbox, sorted by submission time.

When opening a requisition, the system displays for each line item:
- `requestedQty` — what the branch asked for
- `canFulfilQty` — what CK can provide from current raw stock (computed on demand)
- `dispatchedQty` — what the Store Manager commits to sending (editable)

The Store Manager sets dispatched quantities and confirms. On confirmation (inside `prisma.$transaction`):
- `RawIngredient.currentStockCk` is decremented for each ingredient used
- `Requisition.status` is set to `DISPATCHED`
- Each `RequisitionItem.dispatchedQty` is recorded
- FCM push is sent to the Branch Manager: "Your requisition has been dispatched"

### 4.5 Branch Receives and Confirms Delivery

When the delivery arrives, the Branch Manager (or Head Waiter) opens the delivery confirmation screen. It shows each dispatched item with a field to enter what was actually received.

If `receivedQty < dispatchedQty` for any item:
- A discrepancy is recorded and flagged to both the Branch Manager and Store Manager
- The system prompts: "Beef Stew is short 3 portions. Mark as unavailable on menu?"

On confirmation:
- `BranchStock.currentQty` is incremented for each received item
- Items that were previously hidden due to zero stock have `BranchMenuItem.isAvailable` restored to `true`
- `Requisition.status` is set to `RECEIVED` or `PARTIAL`

### 4.6 Stock Depletes During Service (Automatic)

No staff action required. When `PrepTicket.status → READY`, the service layer:
1. Deducts the portion from `BranchStock.currentQty` (inside `prisma.$transaction`)
2. If `currentQty === 0`: sets `BranchMenuItem.isAvailable = false`, emits `inventory:out_of_stock`
3. If `currentQty <= lowStockThreshold`: emits `inventory:low_stock` Socket.io event + FCM push to Branch Manager

### 4.7 Low Stock Alert and Auto-Hide

When stock drops to the low-stock threshold (default: 5 portions), the Branch Manager receives:
- An in-app Socket.io notification
- An FCM push notification if the app is in the background

Message: *"[Item] is down to [N] portions. Submit a mid-day requisition or mark it unavailable."*

When stock hits zero, the item is automatically hidden from the branch menu. Waiters cannot take orders for it. The Branch Manager is notified. The item is restored when new stock is received from the next requisition.

### 4.8 Mid-Day Emergency Requisition

If a branch runs out of a high-demand item unexpectedly, the Branch Manager can submit an emergency requisition at any time during the day. The same review-and-dispatch flow applies. The Store Manager is expected to fulfil it same-day.

### 4.9 End-of-Day Stocktake

At the end of each day, the Branch Manager performs a physical count across three stations in sequence within a single stocktake session:

**Kitchen station:** Remaining food portions (Chicken Burgers, Beef Stew, etc.)
**Barista station:** Remaining drink portions (Cappuccino, Latte, etc.)
**Waiter station:** Remaining consumables (serviettes, condiments, etc.)

For each item, the system shows the expected quantity (opening stock for the day minus completed orders). The Branch Manager enters the actual physical count. The system calculates:
```
variance = actualQty - expectedQty
```
A negative variance is shrinkage (loss). The Branch Manager must add a note for any variance before submitting.

The Central Kitchen Store Manager performs the same process for raw ingredients at the CK level.

### 4.10 Management Dashboard

The Director and Store Manager see a cross-branch overview:
- All branches: today's requisition status, discrepancy count, total shrinkage this week
- Central Kitchen: current raw ingredient levels, items below reorder threshold
- Clicking into a branch shows its live stock levels and recent stocktake history

---

## 5. Data Models

See `docs/V2/DATA_MODEL_ADDENDUM.md` Section 2 for full model definitions.

Key models:
- `Supplier`, `RawIngredient`, `IngredientConversion` — Central Kitchen setup
- `SupplierDelivery` — delivery audit log
- `Requisition`, `RequisitionItem` — requisition lifecycle with three quantity fields
- `BranchStock` — live branch stock per menu item
- `Consumable`, `ConsumableStock` — non-portioned items
- `StocktakeSession`, `StocktakeEntry` — end-of-day reconciliation

---

## 6. API Endpoints

See `docs/V2/API_CONTRACT_ADDENDUM.md` Section 1 and 2 for full endpoint specs.

Key endpoints:
- `POST /inventory/deliveries` — log supplier delivery
- `POST /inventory/requisitions` — branch submits requisition
- `GET /inventory/requisitions/:id` — view with `canFulfilQty` calculation
- `POST /inventory/requisitions/:id/dispatch` — CK dispatches
- `POST /inventory/requisitions/:id/receive` — branch confirms receipt
- `GET /inventory/stock/branch` — live branch stock
- `POST /inventory/stocktake` — end-of-day submission

---

## 7. Frontend Screens

### Store Manager (`/app/store/`)
- `/app/store/dashboard` — daily requisitions inbox + raw stock overview
- `/app/store/ingredients` — manage raw ingredients and conversion ratios
- `/app/store/suppliers` — manage supplier list
- `/app/store/deliveries/new` — log a delivery
- `/app/store/requisitions` — all branch requisitions for today
- `/app/store/requisitions/[id]` — review and dispatch form
- `/app/store/stocktake` — CK end-of-day ingredient count

### Branch Manager (`/app/manage/`)
- `/app/manage/inventory` — live branch stock levels
- `/app/manage/requisitions` — own branch's requisition history
- `/app/manage/requisitions/new` — morning/mid-day requisition form
- `/app/manage/requisitions/[id]` — view status + confirm receipt
- `/app/manage/stocktake` — end-of-day stocktake (tabbed: Kitchen / Barista / Waiter)
- `/app/manage/stocktake/history` — past sessions with variance report

### Director (`/app/admin/`)
- `/app/admin/inventory` — cross-branch inventory overview
- `/app/admin/inventory/reports` — shrinkage and discrepancy reports

---

## 8. Consumables — Implementation Notes

Consumables are items consumed at a branch that are not tied to specific orders (cooking oil, serviettes, condiments, etc.). They follow a simpler flow:

- No automatic depletion — they are counted manually at stocktake only
- No requisition via the portion system — they are requested via a separate consumables requisition (same `Requisition` model but linked to `Consumable` not `MenuItem`)
- The waiter station stocktake covers consumables managed by front-of-house

The full list of consumables must be compiled during the V2.1 discovery workshop before implementation begins.

---

## 9. Open Questions

These must be answered before or during V2.1 development:

| # | Question | Impact |
|---|---|---|
| 1 | Does the Prep Kitchen always portion before seeing that day's requisitions, or sometimes after? | Determines whether CK sees stock capacity before or during dispatch |
| 2 | Full list of non-order consumables (cooking oil, seasoning, sugar, etc.) | Required to seed `Consumable` table and design stocktake form |
| 3 | Full list of waiter station items (serviettes, condiments, straws, packaging, etc.) | Required to seed `Consumable` table for WAITER station |
