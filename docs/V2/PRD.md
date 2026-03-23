# Product Requirements Document
## Wendo Coffee Bistro — Restaurant Management System V2
**Version:** 2.0
**Status:** Draft
**Date:** 2026-03-22
**Author:** System Architect

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement — What V1 Does Not Solve](#2-problem-statement--what-v1-does-not-solve)
3. [Goals & Success Metrics](#3-goals--success-metrics)
4. [Users & Roles — V2 Changes](#4-users--roles--v2-changes)
5. [Scope — V2](#5-scope--v2)
6. [Functional Requirements](#6-functional-requirements)
7. [Non-Functional Requirements](#7-non-functional-requirements)
8. [Out of Scope — V2](#8-out-of-scope--v2)
9. [Assumptions & Constraints](#9-assumptions--constraints)
10. [Open Questions](#10-open-questions)

---

## 1. Executive Summary

V1 of the Wendo RMS digitised core operations: order management, kitchen display, staff scheduling, menu management, reporting, and credit accounts. It replaced paper-based processes and gave Wendo the infrastructure to manage two branches digitally.

V2 targets the gaps that remain after V1. Wendo still has no visibility into stock movement across branches, HR management is still entirely paper-based, payment collection requires a separate POS device for every Mpesa transaction, and internal staff communication happens through WhatsApp with no structure or record. As Wendo scales toward 10 branches, these gaps become increasingly costly.

V2 is not a rebuild. It is a targeted expansion of a live system. Every feature is additive — new models, new routes, new screens — layered onto a working V1 foundation without disrupting existing operations.

---

## 2. Problem Statement — What V1 Does Not Solve

### Inventory Blindness
The business has no digital visibility into stock. Raw ingredients arrive at the Central Kitchen, portions are prepared and dispatched to branches, and the branches consume stock throughout the day — but none of this is tracked in the system. Management cannot see how much stock is at any branch, cannot detect losses or theft, and has no record of discrepancies between what was dispatched and what arrived. Inventory is tracked on paper and entirely dependent on the Store Manager and branch managers being diligent and honest.

### HR Operated Entirely Offline
Staff performance, conduct, and HR events are managed through memory and informal records. There is no structured process for supervisory assessments, no formal disciplinary record system, and no data-driven way to identify top performers or underperformers. As branches scale, management cannot rely on direct observation of every staff member. Decisions about warnings, promotions, and recognitions are made without documentary evidence.

### Payment Collection is a Two-Device Process
Waiter staff must manage two separate devices for every Mpesa payment: the RMS on their phone and a Pesapal POS device in their hand. These are disconnected workflows. The order lives in the RMS; the payment happens outside it. Manual confirmation is required to reconcile them. This creates friction, slows service, and introduces error.

### No Internal Professional Communication Channel
Critical business communications — policy changes, HR notices, formal warnings, meeting schedules — go through WhatsApp groups alongside personal conversations. Information gets lost. Formal correspondence has no record. The business has no professional communication layer that reflects its organisational structure.

---

## 3. Goals & Success Metrics

### Inventory
- Stock movement is fully recorded from supplier delivery to branch consumption
- Management can see live stock levels at every branch at any time without calling the branch
- Every discrepancy between dispatched and received quantities is automatically flagged
- Losses and shrinkage are recorded and visible in daily reports
- Branches cannot serve items that are out of stock — auto-hide prevents it

### HR
- Every staff member has a digital HR profile with performance data, assessments, and disciplinary history
- Supervisory assessments are submitted through the system, not informally
- Disciplinary records are timestamped, permanent, and auditable
- Top performers can be identified from system data rather than guesswork

### Payments
- Waiter can trigger an Mpesa STK push from within the app — no Pesapal device needed for Mpesa
- Payment confirmation is automatic — no manual reconciliation by the waiter
- Each branch collects payments into its own account, giving the Director branch-level financial visibility

### Communications
- Management can broadcast announcements to all staff or specific role groups
- Direct messages between managers and staff are logged within the system
- Formal HR notices are timestamped and attached to staff records
- Critical notifications cannot be silently dismissed

---

## 4. Users & Roles — V2 Changes

V1 defined eight roles. V2 adds one new role.

| Role | Change | Description |
|---|---|---|
| `SYSTEM_ADMIN` | Unchanged | Full system access |
| `DIRECTOR` | Unchanged | Cross-branch visibility, inventory overview, HR reports |
| `MANAGER` | Expanded | Branch-level inventory, HR, communications access |
| `STORE_MANAGER` | **New** | Central Kitchen only. Logs supplier deliveries, reviews and dispatches requisitions, manages raw ingredient stock. No access to branch order management. |
| `WAITER` | Expanded | Mpesa STK push initiation. Can receive deliveries at branch. |
| `CHEF` | Unchanged | — |
| `BARISTA` | Unchanged | — |
| `KITCHEN_DISPLAY` | Unchanged | — |
| `BARISTA_DISPLAY` | Unchanged | — |

### Store Manager — Key Characteristics
- The Store Manager operates at the Central Kitchen (`organization.isHub = true`)
- They have no `organizationId` in the sense of a branch — they are assigned to the hub organisation
- Inventory routes for Central Kitchen operations use `requireRole('STORE_MANAGER', 'DIRECTOR')`
- They cannot access branch order management, the KDS, or branch reporting

---

## 5. Scope — V2

### V2.1 — Inventory Management
End-to-end stock tracking from supplier delivery to branch consumption. Includes:
- Supplier and raw ingredient management at the Central Kitchen
- Ingredient-to-portion conversion table (recipe mapping)
- Morning requisition flow: branch submits → Central Kitchen reviews → dispatches
- Branch delivery confirmation with discrepancy recording
- Automatic stock depletion as orders are completed
- Low-stock alerts and auto-hide on zero stock
- End-of-day stocktake per station (Kitchen, Barista, Waiter)
- Management dashboard: live stock levels, discrepancies, shrinkage

### V2.2 — HR Management
Staff performance and conduct management. Includes:
- Supervisory assessment forms (structured, per-staff, periodic or event-triggered)
- Disciplinary record creation and history (VERBAL → WRITTEN → FINAL_WRITTEN)
- Performance profile per staff member surfacing V1 data (orders, prep times, attendance)
- HR reporting: attendance trends, disciplinary summaries, performance rankings

### V2.3 — Payment Processing (Mpesa STK Push)
Native Mpesa integration within the waiter app. Includes:
- STK push initiation from the order detail screen
- Per-branch Mpesa configuration (till/paybill number per branch)
- Automatic order payment confirmation on Mpesa callback
- Failed/expired STK push handling
- Card payments unchanged — remain on Pesapal hardware

### V2.4 — Communications & Notifications
Internal communication layer and enhanced notifications. Includes:
- Broadcast announcements (company-wide or branch-scoped, role-targeted)
- Direct messages between managers and staff (on-record)
- HR formal notices (timestamped, attached to staff record)
- Acknowledgement requirements for critical notifications
- Enhanced operational alerts: requisition dispatched, delivery confirmed, rider ready

---

## 6. Functional Requirements

### 6.1 Inventory Management

**Central Kitchen — Store Manager**
- Log a supplier delivery: select ingredient, enter quantity, select supplier, confirm
- View current raw ingredient stock levels at the Central Kitchen
- View all incoming branch requisitions for the day
- Review a requisition: see what can be fully/partially fulfilled based on current stock
- Approve and dispatch a requisition: system deducts stock, records dispatch quantities
- Receive a low-stock alert when an ingredient drops below its reorder threshold
- Perform end-of-day raw ingredient stock count

**Branch — Branch Manager**
- Submit a morning requisition by 6:00 AM (portions per menu item)
- Submit an unplanned mid-day requisition
- Receive notification when requisition is dispatched
- Confirm delivery: enter actually received quantities per item
- Flag discrepancy when received quantity differs from dispatched
- View live branch stock levels during service
- Perform end-of-day stocktake across Kitchen, Barista, and Waiter stations
- Record a note against any stocktake variance

**Branch — Head Waiter**
- Confirm delivery on behalf of the Branch Manager (same delivery confirmation flow)

**Director / Store Manager**
- View inventory overview dashboard: all branches, live stock, requisition status, discrepancies, shrinkage
- View Central Kitchen raw ingredient stock levels
- View shrinkage trends by branch, by item, over time

**System (Automatic)**
- Deduct branch stock when a PrepTicket is marked READY
- Alert Branch Manager when item stock drops below threshold
- Auto-hide menu item at branch when stock reaches zero
- Restore menu item visibility when stock is replenished (via requisition receipt)

### 6.2 HR Management

**Supervisor (Head Chef, Assistant Chef, Head Waiter, Assistant Waiter)**
- Submit a structured assessment for a staff member they supervise
- View assessments they have previously submitted

**Branch Manager / HR (Director)**
- View a staff member's full profile: performance metrics, assessments, disciplinary history
- Issue a disciplinary warning (VERBAL, WRITTEN, FINAL_WRITTEN)
- View HR reports: attendance, disciplinary summaries, performance rankings

**Staff Member**
- (Pending scoping decision) View their own performance data

### 6.3 Payment Processing

**Waiter**
- Trigger an Mpesa STK push from the order detail screen
- Enter a customer phone number and confirm
- See payment confirmation appear automatically when customer pays
- Resend STK push if customer does not respond
- Switch to alternative payment method if STK push fails

**System (Automatic)**
- Route STK push through the correct branch Mpesa configuration
- Receive Safaricom callback and mark order as paid
- Record Mpesa transaction code against the order

**Director / Manager**
- View branch-level Mpesa collection reports
- Configure branch Mpesa credentials (till/paybill, API keys)

### 6.4 Communications

**Director / HR (Director role)**
- Send a broadcast to all staff, a specific branch, or a specific role group
- Send a direct message to any staff member
- Deliver formal HR notices (linked to disciplinary records)

**Branch Manager**
- Send a broadcast to their branch staff
- Send a direct message to any staff member within their branch

**Staff Member**
- Receive broadcasts and direct messages
- Reply to direct messages from managers/supervisors
- Acknowledge required notifications

---

## 7. Non-Functional Requirements

These inherit all V1 non-functional requirements. V2 additions:

- **Inventory stock deduction must be atomic** — no partial updates. If a PrepTicket is marked READY and the stock deduction fails, the ticket status must roll back. Use `prisma.$transaction`.
- **Mpesa callback endpoint is public** — it does not require authentication. Verify Safaricom's callback signature instead.
- **STK push timeout** — if no callback is received within 120 seconds, surface a timeout to the waiter UI.
- **Message delivery** — direct messages and announcements must be delivered via FCM push even when the recipient is not actively using the app.

---

## 8. Out of Scope — V2

- Full POS system (card reader integration beyond Pesapal hardware)
- Customer-facing ordering app
- Loyalty programme or points system
- Supplier portal (suppliers do not access the system)
- Automated reordering (system identifies low stock but does not place orders)
- Payroll integration
- Leave management
- E2E browser tests (deferred — as noted in V1 BUILD_ORDER)

---

## 9. Assumptions & Constraints

- The V1 system is live in production. All V2 changes must be backward-compatible. No existing V1 functionality may be broken.
- Prisma migrations are additive — new tables and columns only. No destructive migrations without explicit approval.
- The Central Kitchen is represented in the system as an `Organization` with `isHub = true`. It already exists in the schema.
- Portion sizes are fixed per menu item (defined in SOPs) and do not vary day to day.
- The Branch Manager is the only person who submits requisitions. Head Chefs do not.
- Morning requisitions have a 6:00 AM cutoff.
- End-of-day stocktake covers three stations (Kitchen, Barista, Waiter). The Branch Manager performs all three counts.
- The Store Manager decides stock allocation when two branches compete for the same limited item.
- Mid-day emergency requisitions are expected to be fulfilled same-day.
- The Daraja vs. Pesapal decision for Mpesa integration must be made before V2.3 development begins.
- V2 inherits the V1 design system unchanged. No new UI components are introduced without extending the design system first.

---

## 10. Open Questions

| # | Question | Blocks |
|---|---|---|
| 1 | Daraja direct vs Pesapal intermediary for Mpesa STK push — which route? | V2.3 architecture |
| 2 | Till number vs paybill per branch — which Mpesa structure does Wendo use? | V2.3 implementation |
| 3 | Does the Prep Kitchen always portion before seeing that day's requisitions, or sometimes after? | V2.1 Central Kitchen workflow |
| 4 | Full list of non-order consumables (cooking oil, seasoning, sugar, etc.) — to audit in workshop | V2.1 consumables tracking |
| 5 | Full list of waiter station items (serviettes, condiments, straws, packaging, etc.) | V2.1 stocktake model |
| 6 | Assessment form structure — dimensions, frequency, event-triggered or scheduled? | V2.2 HR assessments |
| 7 | Can staff see their own HR records (performance, assessments, disciplinary history)? | V2.2 permissions |
| 8 | Who can issue a disciplinary warning — HR only, or branch managers too? | V2.2 RBAC |
| 9 | Delivery rider access model — formal role, lightweight account, or external? | V2.4 communications |
| 10 | Which notification types require explicit acknowledgement? | V2.4 notifications |
