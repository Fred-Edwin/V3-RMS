# Inventory Management — User Guide

## Roles & Capabilities

### Store Manager (Central Kitchen)

The Store Manager operates the Central Kitchen (CK) — the hub that supplies all branches with prepared stock.

| Area | What They Can Do |
|---|---|
| **Suppliers** | Add, edit, and manage supplier companies |
| **Ingredients** | Create and manage raw ingredients with units and reorder thresholds |
| **Conversions** | Link ingredients to menu items and set quantity per portion |
| **Deliveries** | Log incoming supplier deliveries to update CK stock levels |
| **Requisitions** | Review branch requests, check CK capacity, dispatch stock to branches |
| **Stocktake** | Conduct physical ingredient counts at the CK to correct stock levels |

---

### Manager (Branch)

The Manager runs a single branch and manages its menu item stock levels.

| Area | What They Can Do |
|---|---|
| **Live Stock** | View real-time stock levels for all menu items (In Stock / Low Stock / Out of Stock) |
| **Requisitions** | Submit stock requests to the CK, confirm receipt of deliveries |
| **Stocktake** | Conduct physical menu item counts to correct branch stock levels |

---

### Director

Cross-branch oversight. Read-only visibility into all branches and the CK.

| Area | What They Can See |
|---|---|
| **Inventory Overview** | Reorder alerts, branch requisition statuses, CK ingredient levels, recent stocktakes |
| **Reports → Shrinkage** | All stocktake entries where actual count differed from expected, filterable by date |
| **Reports → Discrepancies** | All requisitions where received quantity didn't match dispatched quantity |
| **Alerts** | Real-time notification (in-app + push) when a branch stocktake has >10% variance on any item |

---

---

## Setup — Step by Step (Do This Once Before Going Live)

Complete these steps in order before the first day of live operation.

---

### Step 1 — Store Manager: Add Suppliers

Navigate to **Suppliers** and add every company that delivers raw ingredients to the Central Kitchen.

> Examples: Dormans Coffee, Brookside Dairy, Kevian Kenya

For each supplier, enter:
- Company name
- Phone number *(optional)*
- Email address *(optional)*

---

### Step 2 — Store Manager: Add Raw Ingredients

Navigate to **Ingredients** and create every ingredient used in production.

For each ingredient, enter:
- Name
- Unit of measurement (kg, litres, pieces, etc.)
- Reorder threshold — the quantity at which the Director is alerted to reorder

> Examples:
> - Coffee Beans — kg — reorder at 10
> - Full Cream Milk — litres — reorder at 20
> - Simple Syrup — litres — reorder at 5

---

### Step 3 — Store Manager: Set Ingredient Conversions

For each ingredient, define which menu items consume it and how much per portion. This allows the system to calculate how many portions the CK can produce from current stock when reviewing branch requisitions.

Navigate to **Ingredients**, select an ingredient, and add conversions.

> Examples:
> - Coffee Beans → Espresso = 0.018 kg per portion
> - Coffee Beans → Americano = 0.018 kg per portion
> - Full Cream Milk → Latte = 0.2 litres per portion
> - Full Cream Milk → Cappuccino = 0.15 litres per portion

---

### Step 4 — Manager (Each Branch): Submit Opening Stocktake

Each branch Manager navigates to **Stocktake**, physically counts every menu item on hand, and submits. This is the opening stock count that seeds the branch's live stock levels.

Items are grouped by menu category and the form supports search for large menus. Enter 0 for any item not currently in stock.

> After submission, the **Live Stock** page will immediately reflect accurate figures for that branch.

---

### Step 5 — Store Manager: Log Opening Inventory

If there is already stock at the CK, log it as a supplier delivery so the ingredient levels reflect reality from day one.

Navigate to **Deliveries → Log Delivery**, select the ingredient, supplier, and quantity on hand.

---

**Setup is complete. The system is now live.**

---

---

## Daily Workflow

### Morning — Branch Manager

1. Open **Stock** — check for any items showing Low Stock or Out of Stock from the previous day
2. If restocking is needed, go to **Requisitions → New Requisition**
   - Select the items needed and the quantities
   - Add any notes for the Store Manager (e.g. "urgent — running out by noon")
   - Submit the requisition

---

### Morning — Store Manager

1. Open **Requisitions** — review all Pending requests from branches
2. For each requisition, check CK capacity (the system shows how many portions each ingredient can cover)
3. Dispatch each requisition:
   - Enter the quantity being sent for each item
   - Confirm dispatch — the branch Manager is notified and the requisition moves to **Dispatched**

---

### When Stock Arrives at the Branch — Manager

1. Go to **Requisitions** and find the dispatched order
2. Tap **Confirm Receipt**
3. Enter the actual quantities received for each item
4. Submit — the system records receipt and flags any items where the received quantity is less than what was dispatched as a **discrepancy**

---

### When a Supplier Delivers to the CK — Store Manager

1. Navigate to **Deliveries → Log Delivery**
2. Select the ingredient, supplier, and quantity received
3. Submit — CK stock levels update immediately

---

### Weekly (or as needed) — Branch Manager: Stocktake

1. Physically count every menu item at the branch
2. Navigate to **Stocktake**
3. Items are grouped by category — work through each category, entering the actual count
4. Use the search bar to find specific items quickly
5. Submit — branch stock levels update to match the physical count, and a variance report is saved
6. If any item has a variance greater than 10% from what was expected, the Director is alerted automatically via notification

---

### Weekly (or as needed) — Store Manager: CK Stocktake

1. Physically count all raw ingredients at the Central Kitchen
2. Navigate to **Stocktake**
3. Enter the actual quantity for each ingredient
4. Submit — CK ingredient levels update to match the physical count

---

### Ongoing — Director

The **Inventory Overview** page gives a live picture at any time. No regular action is required unless:

| Alert | Action |
|---|---|
| **Reorder alert** (amber banner) | Follow up with Store Manager to place a supplier order for the flagged ingredient |
| **Stocktake variance notification** | Review the flagged branch's recent stocktake — investigate if loss pattern repeats |
| **Discrepancy count on a branch** | Run **Reports → Discrepancies** filtered to that branch to identify the affected requisitions |

Run **Reports → Shrinkage** at end of week or month to review losses across all branches and identify patterns of waste, miscounting, or theft.
