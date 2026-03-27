# Inventory Management — Feature Description

## Overview

Wendo operates a Central Kitchen that is the sole supply and preparation hub for all branches. All revenue flows through the branches; the Central Kitchen is a support function only. A Store Manager based at the Central Kitchen oversees raw stock, portioning, and fulfilment of branch requisitions.

The goal of this feature is to give the Director and Store Manager full end-to-end visibility of stock movement — from the moment raw ingredients arrive at the Central Kitchen to the moment portions are consumed at a branch — and to surface discrepancies, losses, and shortfalls automatically rather than waiting for them to be reported manually.

---

## The Central Kitchen

The Central Kitchen has two internal sections:

- **Prep Kitchen** — receives perishable raw ingredients (meat, dairy, vegetables), processes them, and portions them into ready-to-dispatch units tied to menu items.
- **Store** — receives and holds non-perishable consumables (tissue, serviettes, packaging, cleaning supplies) and dispatches them to branches as-is, with no transformation.

Every menu item that uses a raw ingredient has a defined conversion ratio — for example, 10 kg of an ingredient yields 100 portions. These ratios are set once by management and can be revised. The system uses them to automatically calculate how many portions of each menu item can be prepared from current raw stock, without any manual calculation by staff.

---

## Daily Workflow

### 1. Supplier Delivery — Central Kitchen Receives Raw Stock

When a supplier delivers ingredients to the Central Kitchen, the Store Manager logs the delivery in the system: item, quantity, supplier, and date. The system immediately updates the Central Kitchen's raw stock levels. Both Prep Kitchen items and Store items are logged here, under their respective categories.

### 2. Branch Submits Morning Requisition

Each morning, every branch manager submits a requisition specifying the items and quantities they need for the day's service. Requisitions are in terms of menu item portions (e.g. 40 Chicken Burgers), not raw ingredients. The system records the time of submission and holds the requisition for Central Kitchen review.

Branches may also submit an unplanned mid-day requisition if they unexpectedly run out of a high-demand item. This follows the same flow as the morning requisition and is treated as an exception.

### 3. Central Kitchen Reviews and Dispatches

The Store Manager sees all incoming requisitions from all branches in a single view. The system automatically checks current raw stock against each requisition and indicates which items can be fully fulfilled, partially fulfilled, or not fulfilled at all.

The Store Manager approves and dispatches. On approval, the system:
- Deducts the corresponding raw ingredient quantities from Central Kitchen stock
- Records the exact quantities dispatched to each branch
- Notifies the branch that their delivery is on the way

If stock is insufficient to fully meet two branches' requests for the same item, the Store Manager decides how to allocate. This decision is recorded.

### 4. Branch Receives and Confirms Delivery

When the delivery arrives at the branch, the receiving person — the Branch Manager, Head Chef, or Head Waiter — opens the system and confirms what was actually received against what was dispatched. Any discrepancy between dispatched and received quantities is recorded immediately and flagged to both the Branch Manager and the Store Manager. It does not disappear quietly.

If items are short, the system prompts the branch to mark the affected items as unavailable on the menu, building on the menu availability feature already present in V1.

### 5. Stock Depletes Automatically During Service

Once portioned items are at the branch, stock levels deplete automatically as orders are completed. Every time a prep ticket is marked Ready, the system deducts the corresponding portion from that branch's live stock count. No manual action is required from staff during service.

### 6. Low Stock Alerts and Auto-Hide

When a branch's stock for an item drops to a defined low threshold, the Branch Manager receives an alert and is prompted to either submit a mid-day requisition or mark the item unavailable. When stock hits zero, the item is automatically hidden from the branch menu, preventing waiters from taking orders for items that cannot be prepared.

### 7. End-of-Day Stocktake

At the close of each day, the Branch Manager performs a physical stock count per prep station and enters the actual quantities remaining. The system shows the expected quantity (opening stock minus completed orders) alongside the actual count. Any variance is recorded as shrinkage and requires a note. The Central Kitchen performs the same reconciliation on its raw ingredient stock.

---

## Management Visibility

The Director and Store Manager have a real-time overview dashboard showing, for every branch:

- Requisition status for the day (submitted, dispatched, received, partial)
- Any delivery discrepancies flagged
- Live stock levels during service
- End-of-day shrinkage figures

Across the Central Kitchen:

- Current raw ingredient stock levels
- Low-stock alerts and reorder prompts
- Cumulative shrinkage and discrepancy patterns over time, by branch and by item

---

## Non-Order Consumables

Some items consumed at branches — cooking oil, seasoning, coffee sugars — are not tied to individual orders and cannot be depleted automatically. These follow a manual requisition and stocktake flow only. The exact tracking method for these items is an open question to be resolved during the discovery workshop.

---

## What This Feature Prevents

| Problem | How the System Addresses It |
|---|---|
| Items going missing between the Central Kitchen and a branch | Dispatch vs. received comparison flags every discrepancy at the point of receipt |
| Staff taking orders for unavailable items | Item auto-hides from the menu when stock reaches zero |
| Stock disappearing mid-shift with no explanation | Daily stocktake at each branch creates a recorded paper trail |
| Management having no visibility into losses | Every variance is recorded and visible on the management dashboard |
| Branches over- or under-ordering | Historical requisition and consumption data informs future requests |
| The Central Kitchen running out of raw ingredients | Live raw stock levels and low-stock alerts prompt reordering before a shortage occurs |

---

## Confirmed Decisions

1. **Cutoff time** — Morning requisitions must be submitted by **6:00 AM**.
2. **Requisition authority** — Only the Branch Manager can submit a requisition. Head Chefs cannot.
3. **Allocation priority** — When two branches compete for limited stock, the **Store Manager** decides the allocation.
4. **Receiving responsibility** — The **Branch Manager** is the primary receiver. The **Head Waiter** can also receive on their behalf. Head Chefs cannot receive deliveries.
5. **Portion sizes** — Fully fixed. All portion sizes are defined in the branch SOPs and do not vary.
6. **Prep timing** — The Prep Kitchen portions items **before** seeing that day's requisitions. *(To confirm in workshop.)*
7. **Stocktake per prep station** — Yes. End-of-day stocktake is done separately per station: **Kitchen**, **Barista**, and **Waiter** stations. The **Branch Manager** does all three counts himself.
8. **Mid-day requisition urgency** — Yes. Mid-day emergency requisitions are expected to be fulfilled **same-day**.
9. **Central Kitchen stocktake** — Yes. The Store Manager performs a daily end-of-day raw ingredient count at the Central Kitchen.

---

## Open Questions — Still To Be Confirmed

1. **Prep timing** — Does the Prep Kitchen always portion before seeing requisitions, or does it sometimes wait for that day's requests before deciding how much to prep?
2. **Non-order consumables** — A full audit of these items is needed. Examples known so far: cooking oil, seasoning, coffee sugar. The discovery workshop must produce a complete list and agree on a tracking method. Options to explore:
   - Fixed daily allocation per branch (e.g. 1 litre of oil per day — branch logs if they used more or less)
   - Requisition-based (branch requests these items the same way as portioned food)
   - Periodic count only (no per-day tracking, just a weekly stocktake)
3. **Waiter station items** — A full list of items managed at the waiter station needs to be compiled (serviettes, condiments, straws, packaging, etc.) to determine whether they follow the Store dispatch flow or a separate consumables flow.
