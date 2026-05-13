# Product Requirements Document
## Wendo Coffee Bistro — Restaurant Management System (RMS)
**Version:** 2.0  
**Status:** Live — Phase 8 Complete  
**Date:** 2026-05-04  
**Author:** System Architect  
**Changelog:** v2.0 — added Phase 7 (Credit Accounts), Phase 8 (Operations Expansion: Other Income, Discounts, HR Module, Internal Communications, Staff Transfers), new roles (HR_MANAGER, ACCOUNTANT, KITCHEN_DISPLAY, BARISTA_DISPLAY); updated scope, user stories, and open questions to reflect current system state.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Goals & Success Metrics](#3-goals--success-metrics)
4. [Users & Roles](#4-users--roles)
5. [Scope — Current System](#5-scope--current-system)
6. [Functional Requirements](#6-functional-requirements)
7. [Non-Functional Requirements](#7-non-functional-requirements)
8. [User Stories](#8-user-stories)
9. [Out of Scope](#9-out-of-scope)
10. [Assumptions & Constraints](#10-assumptions--constraints)
11. [Open Questions & Future Considerations](#11-open-questions--future-considerations)

---

## 1. Executive Summary

Wendo Coffee Bistro (commonly known as "Wendo") is a premium coffee bistro and restaurant currently operating two branches in Nyeri, Kenya — Kingz and Town. The business is planning to expand incrementally to 10 branches starting next month.

Wendo currently runs on paper-based order management, manual record keeping, and shared POS devices. As the business scales, these processes are becoming unsustainable. This document defines the requirements for a **Restaurant Management System (RMS)** — a digital platform that will replace paper operations, streamline order management across all stations, provide real-time operational visibility to management, and collect data to drive informed business decisions.

The system will be built as a multi-branch, mobile-first platform with a web dashboard for management, designed for reliability, scalability, and performance from day one.

---

## 2. Problem Statement

### Current State
Wendo's operations are driven entirely by paper and manual processes:

- Waiters handwrite orders, print receipts, and physically walk them to the Kitchen and Barista Station — which are some distance apart. This is physically tiring and slow.
- There is no real-time visibility into order status. Waiters cannot tell if an order is being prepared or is ready without physically checking.
- Chefs and Baristas have no structured queue. Orders pile up on paper with no clear prioritisation.
- Inventory is tracked manually, making it difficult to manage stock across two branches. The manager cited this as the most significant pain point.
- Staff performance cannot be measured. There is no data on prep times, order volumes per staff member, or attendance.
- The business collects almost no operational data — making it impossible to identify what to improve or where to invest.
- A single shared POS device per branch creates bottlenecks.
- Managing two branches simultaneously is difficult. The Director has no consolidated view of how both branches are performing.

### The Core Problem
**Wendo is scaling without the infrastructure to support it.** What works for 2 branches managed manually will break at 5 or 10 branches. The business needs a reliable digital system before the next expansion begins.

---

## 3. Goals & Success Metrics

### Primary Goals
1. Eliminate paper orders and replace with a fast, intuitive digital order flow
2. Route orders automatically to the correct preparation stations in real time
3. Give every staff member the tools they need on their personal device
4. Give management real-time visibility into branch operations remotely
5. Collect structured operational data to enable informed decisions
6. Build a system that can scale from 2 to 10+ branches without re-architecture

### Success Metrics
| Metric | Target |
|---|---|
| Order submission time (waiter to kitchen/barista station) | Under 2 seconds |
| Order status visibility | Real-time, always accurate |
| System uptime | 99.5% or above during operating hours |
| New branch onboarding time | Under 1 day |
| Staff onboarding to system | Under 30 minutes per user |
| Report generation | Under 10 seconds |

---

## 4. Users & Roles

The system has six distinct roles, each with scoped access and a primary interface.

The system has **ten distinct roles**, each with scoped access and a primary interface. Roles added after the initial V1 design are marked *(Added Phase N)*.

### 4.1 System Admin
**Who:** The technical operator/developer who runs the platform.  
**Interface:** Web dashboard.  
**Responsibilities:**
- Creates and manages branches in the system
- Creates Director and Manager accounts
- Manages the master menu at the system level (categories, items, prep station routing)
- Configures system-wide settings
- Has full access to everything in the system

**Access scope:** All branches, all data, all settings.

---

### 4.2 Director
**Who:** The business owner or executive overseeing all branches.  
**Interface:** Web dashboard.  
**Responsibilities:**
- Views real-time operations across all branches
- Accesses cross-branch reports and analytics
- Designates which branch is the hub branch
- Can manage the master menu alongside the System Admin

**Access scope:** All branches — read access on everything, write access on menu and branch settings.

---

### 4.3 Manager
**Who:** One manager per branch, responsible for day-to-day branch operations.  
**Interface:** Web dashboard (primary), with remote access so they do not need to be physically present.  
**Responsibilities:**
- Creates and manages staff accounts for their branch
- Deactivates accounts when staff leave
- Schedules shifts and assigns staff
- Manages delivery zones and fees for their branch
- Marks menu items as unavailable at their branch
- Monitors live order activity on their branch
- Performs manager overrides for geofencing clock-in/out when needed
- Accesses branch-level reports

**Access scope:** Their branch only. No visibility into other branches.

---

### 4.4 Waiter
**Who:** Front-of-house staff who take orders and serve customers.  
**Interface:** Mobile-first web app (accessible from any smartphone browser — no app install required).  
**Responsibilities:**
- Takes orders from customers (dine-in, take-away, delivery)
- Submits orders to the preparation stations digitally
- Tracks order preparation status in real time
- Modifies orders before preparation begins
- Records payment method and confirms payment manually
- Manages their assigned tables and active orders

**Access scope:** Their branch. Own orders and active tables only.

---

### 4.5 Chef
**Who:** Kitchen staff responsible for preparing food orders.  
**Interface:** Shared Android tablet (KDS) + personal mobile-first web app.  
**Responsibilities:**
- Views incoming food orders on the Kitchen Display System (KDS) or personal phone
- Claims orders by selecting their name from the on-shift staff dropdown or directly from their phone
- Marks orders as Ready when preparation is complete
- Receives notifications for new incoming orders

**Access scope:** Their branch. Food orders only.

---

### 4.6 Barista
**Who:** Barista station staff responsible for preparing drink orders.  
**Interface:** Shared Android tablet (BDS) + personal mobile-first web app.  
**Responsibilities:**
- Views incoming drink orders on the Barista Display System (BDS) or personal phone
- Claims orders by selecting their name from the on-shift staff dropdown or directly from their phone
- Marks orders as Ready when preparation is complete
- Receives notifications for new incoming orders

**Access scope:** Their branch. Drink orders only.

---

### 4.7 Kitchen Display *(Added Phase 3)*
**Who:** A shared service account used by the KDS tablet at each branch.  
**Interface:** Shared Android tablet (browser, always-on).  
**Responsibilities:**
- Passive display of all KITCHEN-station prep tickets for the branch
- No claim or state-change capability from the shared device (performed by individual Chef accounts)

**Access scope:** Their branch. KITCHEN station orders only. Read-only operational view.

---

### 4.8 Barista Display *(Added Phase 3)*
**Who:** A shared service account used by the BDS tablet at each branch.  
**Interface:** Shared Android tablet (browser, always-on).  
**Responsibilities:**
- Passive display of all BARISTA-station prep tickets for the branch

**Access scope:** Their branch. BARISTA station orders only. Read-only operational view.

---

### 4.9 HR Manager *(Added Phase 8)*
**Who:** The human resources officer or HR administrator for the business.  
**Interface:** Web dashboard.  
**Responsibilities:**
- Manages employee profiles across all branches (contracts, emergency contacts, bank details)
- Processes leave requests (approve/reject) across all branches
- Records disciplinary incidents
- Uploads and manages HR documents (offer letters, contracts) per staff member
- Views attendance analytics across branches

**Access scope:** Cross-branch HR data. No access to financial data, orders, or menu management.

---

### 4.10 Accountant *(Added Phase 7)*
**Who:** The business accountant or finance officer.  
**Interface:** Web dashboard.  
**Responsibilities:**
- Views financial reports and revenue data across all branches (read-only)
- Settles corporate credit accounts (marks outstanding balances as settled)
- Settles customer credit accounts

**Access scope:** Cross-branch financial read access. Write access limited to credit account settlement only.

---

## 5. Scope — Current System

The system has grown through 8 phases. The following represents the complete scope of the live system as of Phase 8.

### Implemented and Live
- Digital order management — Dine-In, Take-Away, Delivery
- Automated order routing to Kitchen Display System (KDS) and Barista Display System (BDS)
- Real-time order tracking and status progression
- Order modification (while preparation not yet started per station)
- Manual payment recording — Cash, Mpesa, Card, Split, House Account, Corporate Account, Customer Credit
- Kitchen Display System (KDS) — Android tablet app (web app, browser-based)
- Barista Display System (BDS) — Android tablet app (web app, browser-based)
- Waiter interface — mobile-first web app (no install required)
- Chef and Barista personal phone interface — mobile-first web app
- Manager web dashboard
- Director web dashboard
- HR Manager web dashboard
- Accountant web dashboard
- Menu management (System Admin and Director at system level; Manager for branch availability)
- Menu item images (Cloudinary hosted)
- Staff accounts and role-based access control (RBAC) — 10 roles
- Geofencing clock-in/out (50m radius)
- Shift scheduling, tracking, and week/month copy
- Push notifications (Firebase Cloud Messaging)
- Delivery zones per branch with automatic fee calculation
- Reporting and analytics (branch-level and cross-branch)
- Report export (PDF and CSV)
- Offline resilience — clear error states, graceful degradation
- Receipt printing — Bluetooth thermal printer via Android companion app (“Wendo Printer”)
- **Credit Accounts System** — House Accounts (staff benefits), Corporate Accounts (company billing), Customer Credit Accounts (customer tabs)
- **AWAITING_AUTHORIZATION order flow** — house account, staff discount, and approval-required customer discounts require Manager/Director approval before order is closed
- **Other Income** — non-order revenue (events, pool tables, etc.) with category management and split payment support
- **Discounts** — named customer discount schemes and per-order staff discounts; both tracked with authorization records
- **HR Module** — employee profiles, leave management (working-day-aware), disciplinary records, HR documents (Cloudinary)
- **Internal Communications** — 1:1 direct messages, broadcast messages (company/branch/role-scoped), formal notices with BullMQ-driven 24h/48h escalation reminders
- **Staff Transfers** — branch-to-branch staff transfers with full history tracking
- **Incident Log** — order-item removal incidents and payment rejection incidents with reason records

### Still Out of Scope
- Inventory management
- Payment processing (Pesapal/Mpesa STK Push integration)
- Grubba delivery API integration
- Branch-to-branch stock transfers (distinct from staff transfers)

---

## 6. Functional Requirements

### 6.1 Menu Management

**FR-MEN-01:** The system shall maintain a single master menu shared across all branches.

**FR-MEN-02:** The System Admin and Director shall be able to create, edit, and delete menu categories.

**FR-MEN-03:** Each menu category shall be assigned to exactly one preparation station — Kitchen or Barista. All items within that category automatically route to the assigned station.

**FR-MEN-04:** The System Admin and Director shall be able to create, edit, and delete menu items within categories.

**FR-MEN-05:** Each menu item shall have: name, description, price, category, and an active/inactive status.

**FR-MEN-06:** Menu pricing is universal across all branches.

**FR-MEN-07:** A branch Manager shall be able to mark individual menu items as **unavailable at their branch**. Unavailable items are hidden from that branch's order-taking interface but remain on the master menu.

**FR-MEN-08:** The Manager shall be able to restore unavailable items to available status.

---

### 6.2 Order Management

**FR-ORD-01:** The system shall support three order types: Dine-In, Take-Away, and Delivery.

**FR-ORD-02:** Orders shall be numbered daily per branch, resetting to #1 at the start of each new day (e.g., Order #1, #2, #3...).

**FR-ORD-03 — Dine-In Order Flow:**
1. Waiter opens the menu, adds items to a cart
2. Waiter opens the cart modal, reviews items and quantities
3. Waiter adds a table number (free-text) and optional comments or instructions
4. Waiter submits the order
5. System splits the order internally — food items route to KDS, drink items route to BDS
6. The waiter sees the order as a single unified order throughout
7. Chef/Barista claims and prepares
8. Waiter is notified when ready
9. Waiter records payment method and marks as paid

**FR-ORD-04 — Take-Away Order Flow:**  
Same as Dine-In except no table number is required. Waiter packs the order instead of serving.

**FR-ORD-05 — Delivery Order Flow:**
1. Waiter creates a delivery order (typically via phone call from customer)
2. Waiter selects the delivery zone — delivery fee is added automatically to the order total
3. Waiter manually confirms payment has been received (Mpesa only for delivery)
4. Only after payment confirmation is the order submitted to the prep stations
5. After preparation, waiter marks the order as **Handed to Grubba**
6. Order is marked Closed

**FR-ORD-06:** Payment methods for Dine-In and Take-Away shall be: Mpesa, Cash, Card, Split (2 methods), or Guest Split (N guests each paying their own share). Payment method for Delivery shall be: Mpesa only.

**FR-ORD-06a — Guest Split:** When a table wishes to split the bill between multiple guests, the waiter selects "Split between guests", sets the number of guests (2–20), and records each guest's payment individually (Mpesa, Cash, or Card). Each payment is persisted immediately as a `SplitPaymentLine` record. The order is closed only when all lines sum to the order total (±1 KES tolerance). The receipt prints a breakdown of each guest's name, amount, and payment method.

**FR-ORD-07:** The waiter shall be able to track the preparation status of their submitted orders in real time from an order details view. The view shall show the status of each station (food: Pending / In-Progress / Ready; drinks: Pending / In-Progress / Ready).

**FR-ORD-08 — Order Modification:**
- A waiter may modify an order (add items, increase quantities, update comments) as long as the order is not `CLOSED` or `CANCELLED`
- Station-aware rules:
  - While a station ticket is `PENDING` (not yet claimed), the waiter may freely edit that station’s portion (add/remove/decrease/increase)
  - Once a station has a ticket in `IN_PROGRESS` or `READY`, the waiter may not remove/decrease items already on the order for that station
  - Additions for a started/ready station create a new follow-up prep ticket batch for that station (so KDS/BDS receives a new card)
- When a modification occurs, the affected prep station (KDS or BDS) shall receive a notification of the change
**FR-ORD-09:** Order statuses shall be: `Pending` → `In-Progress` → `Ready` → `Closed`, with controlled hold states for `Awaiting Authorization` and `Awaiting Cancellation Approval`.

**FR-ORD-10:** An order is marked **Closed** when the waiter confirms payment (or marks as Handed to Grubba for delivery).

**FR-ORD-10a — Cancellation Approval:** A waiter may request cancellation for an active order they created, but the order shall not become `Cancelled` until a Manager or Director approves the request. While cancellation approval is pending, the order is locked from payment, item editing, split payment line edits, and duplicate cancellation requests. If approved, the order becomes `Cancelled` and the cancellation audit records the requester, approver, reason, and timestamps. If rejected, the order returns to its previous status and the waiter is notified to continue handling it. Managers and Directors may cancel active `Pending`, `In-Progress`, or `Ready` orders directly with a required reason and audit trail; payment/discount authorization holds must be resolved through their own approval flows.

**FR-ORD-11 — Receipt Printing:**
- After payment is recorded, the waiter shall see a "Print Receipt" button on the order detail screen
- Tapping the button creates a print job in the database (status: PENDING)
- A dedicated Android app ("Wendo Printer") installed on the branch work phone polls for pending jobs every 3 seconds and sends ESC/POS commands to the Bluetooth-connected thermal printer
- Receipts print on 80mm thermal paper and include: branch name, phone, order number, order type, date/time, waiter first name, itemised list with quantities and amounts, subtotal, delivery fee (if applicable), total, payment method, and a QR code linking to `https://www.wendoz.co.ke/`
- For Guest Split orders, receipts include a per-guest breakdown (label, amount, method, M-Pesa code where applicable)
- Print jobs are persisted in the DB — if the printer is offline, jobs queue and print when reconnected
- Jobs older than 24 hours are automatically expired
- Managers configure the print station from the branch settings page — a QR code is generated for one-tap app setup

---

### 6.3 Kitchen Display System (KDS) & Barista Display System (BDS)

**FR-KDS-01:** The KDS shall display only food order items. The BDS shall display only drink order items.

**FR-KDS-02:** Each display shall have three queues displayed simultaneously: **Pending**, **In-Progress**, and **Ready**.

**FR-KDS-03:** Each order card on the display shall show: order number, order type (Dine-In / Take-Away / Delivery), table number (if dine-in), list of items with quantities, special instructions/comments, and a timestamp showing how long the order has been waiting.

**FR-KDS-04:** When a new order arrives, the KDS/BDS shall play an audio notification and the new order card shall appear in the Pending queue.

**FR-KDS-05 — Claiming an Order:**
- A Chef (on KDS or personal phone) clicks **Claim** on an order card
- A dropdown appears showing the names of staff currently on shift at that branch for that role (Chefs for KDS, Baristas for BDS)
- The staff member selects their name
- The order immediately moves from Pending to In-Progress
- The order disappears from the shared Pending queue for all other staff (first claim wins)
- The claimed order appears under the claiming staff member's personal In-Progress queue on their phone

**FR-KDS-06:** A Chef/Barista shall mark an order as **Ready** from either the shared KDS/BDS or their personal phone. This moves the order to the Ready queue and triggers a push notification to the waiter.

**FR-KDS-07:** Chef and Barista personal phone accounts shall mirror the shared display for their respective station — they can view Pending orders, claim from their phone, view their In-Progress orders, and mark Ready from their phone.

**FR-KDS-08:** All state changes (claim, mark ready) shall reflect in real time on both the shared display and all personal phones simultaneously.

---

### 6.4 Staff Management

**FR-STF-01:** Each staff member shall have a personal account with: full name, role, assigned branch, phone number, and account status (active/inactive).

**FR-STF-02:** Account creation permissions are role-scoped:
- System Admin creates Director and Manager accounts
- Director can create Manager accounts
- Manager creates Waiter, Chef, and Barista accounts for their own branch

**FR-STF-03:** Managers can deactivate staff accounts for their branch. Deactivated accounts cannot log in.

**FR-STF-04 — Geofencing Clock-In/Out:**
- Staff tap **Clock In** on their app
- The system checks the device GPS coordinates against the branch coordinates (default 50m radius, configurable by environment)
- If within range, clock-in is recorded with a GPS-verified flag
- If outside range, clock-in is blocked and the user sees a clear distance-based error
- The app distinguishes geofence rejection, GPS permission denial, GPS timeout, unavailable device location, and attendance-state conflicts
- If a staff member has more than one shift on the same day, they must clock each shift separately against the correct assignment
- A Manager can perform a manual override from their dashboard — this is recorded with an "Override" flag, requires a reason note, and only presents the valid override action for the current attendance state
- Clock-out follows the same geofencing rules

**FR-STF-05 — Shift Scheduling:**
- Managers create shifts with a name, start time, and end time (e.g., Morning 6:00am–2:00pm)
- Shift times are editable by the Manager
- Managers assign specific staff members to specific shifts per day using a spreadsheet-style weekly roster
- HR Managers can view and edit shift definitions and weekly rosters across all branches by selecting the target branch
- Roster rows are branch staff grouped by role (`CHEF`, `WAITER`, `BARISTA`) and sorted alphabetically within each role
- Roster cells display shift definition names rather than raw time ranges; selecting `OFF` clears the assignment for that staff member and day
- Roster edits autosave, with an explicit "Save now" action available for immediate persistence
- Users can Shift-click or Shift-drag roster cells to select multiple cells and clear their shifts in one action
- Past-date cells are read-only, and assignments with clock records cannot be cleared or changed
- Staff can view their own upcoming shifts in their app
- The system records scheduled hours vs actual hours worked (calculated from clock-in/out timestamps)

**FR-STF-06:** Staff can only clock in if they are assigned to a shift for that business day at their branch, or if the manager performs an override.
Only one open attendance record is allowed per staff member at a time across all assignments.

---

### 6.5 Delivery Zone Management

**FR-DEL-01:** Each branch shall maintain its own independent list of delivery zones.

**FR-DEL-02:** A delivery zone entry shall contain: zone name/area, and delivery fee (KES).

**FR-DEL-03:** The branch Manager shall be able to create, edit, and delete delivery zones for their branch.

**FR-DEL-04:** When a waiter selects a delivery zone on a delivery order, the delivery fee shall be automatically added to the order total.

---

### 6.6 Notifications

**FR-NOT-01:** The system shall use Firebase Cloud Messaging (FCM) for push notifications to Android devices.

**FR-NOT-02:** The following events shall trigger push notifications:

| Event | Recipients |
|---|---|
| New order submitted | Chef (KDS audio + visual) / Barista (BDS audio + visual) |
| Order prep started (claimed) | Waiter who submitted the order |
| Food portion ready | Waiter who submitted the order |
| Drinks portion ready | Waiter who submitted the order |
| Both portions ready | Waiter (single combined notification) |
| Order modified (while Pending) | Chef or Barista for the affected station |
| Shift reminder | Staff member (24 hours before shift start) |

**FR-NOT-03:** KDS and BDS shall play an audio sound on new order arrival in addition to the visual notification.

---

### 6.7 Reporting & Analytics

**FR-REP-01:** Manager reports are scoped to their branch. Director reports cover all branches individually and in aggregate.

**FR-REP-02 — Manager Dashboard (Live):**
- Active orders feed with real-time status
- Number of orders today by type (Dine-In, Take-Away, Delivery)
- Staff currently clocked in
- Average order prep time today

**FR-REP-03 — Daily Sales Summary (Manager & Director):**
- Total revenue
- Order count by type
- Top 5 selling menu items
- Revenue by payment method

**FR-REP-04 — Staff Performance Report (Monthly):**
- **Waiters:** Number of orders handled, average order value
- **Chefs:** Number of food orders prepared, average food prep time
- **Baristas:** Number of drink orders prepared, average drink prep time
- Attendance summary — scheduled hours vs actual hours worked

**FR-REP-05 — Director Cross-Branch Reports:**
- All branch-level reports viewable per branch
- Aggregated summary across all branches
- Branch performance comparison (revenue, order volume, average prep time)

**FR-REP-06:** All reports shall be exportable as PDF and CSV.

---

### 6.8 Offline Resilience

**FR-OFF-01:** The waiter app, KDS, and BDS shall detect loss of internet connectivity and display a clear "You are offline" indicator.

**FR-OFF-02:** Orders that have already been submitted and received by the KDS/BDS shall remain visible from local cache during a connectivity loss.

**FR-OFF-03:** New orders shall not be submittable while the device is offline. The waiter shall see a clear error message preventing submission.

**FR-OFF-04:** When connectivity is restored, the app shall automatically sync and reflect the latest state from the server.

---

### 6.9 Credit Accounts System *(Added Phase 7)*

**FR-CRD-01 — House Accounts:** Each branch may maintain one House Account per staff member for benefits-in-kind (meals, drinks). Managers and Directors create and manage house accounts. Balances are tracked; outstanding balances report is available to Accountant, Manager, and Director.

**FR-CRD-02 — Corporate Accounts:** Corporate accounts are system-level (not branch-scoped) — one account per company. Orders charged to corporate accounts can span branches. Only System Admin, Director, or Accountant can settle a corporate account balance. Corporate credit orders are excluded from branch revenue totals.

**FR-CRD-03 — Customer Credit Accounts:** Branch-scoped credit tabs for trusted repeat customers. Manager and Director create accounts. Accountant, Manager, or Director can settle. Customer credit orders are excluded from branch revenue totals.

**FR-CRD-04 — AWAITING_AUTHORIZATION Flow:** When a waiter selects a House Account, Staff Discount, or an approval-required Customer Discount as payment/discount method, the order transitions to `AWAITING_AUTHORIZATION` status. A Manager or Director must approve or reject. On approval, the order is closed and the credit balance is updated. On rejection, the order returns to the waiter for re-payment.

**FR-CRD-05:** House account and customer credit account orders are not included in revenue totals since they represent internal credit, not cash received. Corporate account orders are also excluded from branch revenue.

**FR-CRD-06:** The system shall provide an Outstanding Balances report showing all outstanding amounts across house, corporate, and customer credit accounts, filterable by account type and branch.

---

### 6.10 Other Income *(Added Phase 8)*

**FR-OTH-01:** Managers and Directors shall be able to record non-order revenue at their branch — e.g., pool table income, event hire, rental income. This is called "Other Income."

**FR-OTH-02:** Other Income entries shall be categorized (categories managed by Manager/Director). Each entry records: category, amount, description, payment method, and date.

**FR-OTH-03:** Other Income entries support split payments (e.g., part Mpesa, part Cash), using the same split payment model as orders.

**FR-OTH-04:** Other Income is included in branch revenue totals and appears in daily/monthly sales reports.

---

### 6.11 Discounts *(Added Phase 8)*

**FR-DIS-01 — Customer Discounts:** The System Admin or Director can create named discount schemes (e.g., "Corporate 10%", "Loyalty 15%") with a percentage value. Waiters can apply a named discount to an order.

**FR-DIS-02 — Staff Discounts:** Staff members are entitled to a staff discount on their own orders. The waiter records that the order is for a staff member and selects the beneficiary from the staff list. This triggers an `AWAITING_AUTHORIZATION` flow requiring Manager/Director approval.

**FR-DIS-03:** All discount applications are recorded in the system with: who applied it, the beneficiary (for staff discounts), who approved it, and when.

**FR-DIS-04:** Discounts that require approval (staff discounts, or customer discounts flagged as requiring authorization) block order closure until a Manager or Director approves via the authorization dashboard.

---

### 6.12 HR Module *(Added Phase 8)*

**FR-HR-01 — Employee Profiles:** Each staff member has an extended employee profile beyond their user account: employment type, contract dates, emergency contacts, bank account details, and notes. HR Managers and Directors manage profiles.

**FR-HR-02 — Leave Management:**
- System supports multiple leave types (Annual, Sick, Maternity, Paternity, Unpaid, Compassionate, Study).
- Leave balances are seeded automatically per staff member per year per leave type.
- Staff submit leave requests specifying dates, leave type, and reason.
- HR Manager or Director approves or rejects requests.
- Leave duration is calculated in **working days only** (Monday–Friday; weekends do not count).
- Leave balances are automatically decremented on approval.

**FR-HR-03 — Disciplinary Records:** HR Manager and Director can create disciplinary records against staff members: incident type, severity, description, and any corrective action taken. Records are only visible to HR Manager and Director.

**FR-HR-04 — HR Documents:** HR Manager and Director can upload documents against a staff member (offer letters, contracts, warning letters). Documents are stored on Cloudinary and linked to the staff member's profile.

**FR-HR-05 — Attendance Analytics:** HR Module provides an attendance analytics view: scheduled vs actual hours worked per staff per period, clock-in/out history, late arrivals, and absenteeism trends. Available to HR Manager, Manager (own branch), and Director.

---

### 6.13 Internal Communications *(Added Phase 8)*

**FR-COM-01 — Direct Messages:** Staff can send 1:1 direct messages to any other staff member within the same organization. Messages are delivered in real time via WebSocket. Message history is persisted.

**FR-COM-02 — Broadcasts:** Managers, HR Managers, and Directors can send broadcast messages scoped to: the whole company, a specific branch, or a specific role group (e.g., all Waiters). Recipients see the broadcast in their Comms inbox. Delivery status per recipient is tracked.

**FR-COM-03 — Formal Notices:** Directors and HR Managers can send formal notices requiring explicit acknowledgement from recipients. The system shall:
- Track whether each recipient has acknowledged the notice
- Send a push notification reminder after 24 hours to any recipient who has not acknowledged
- Send a second reminder after 48 hours
- Reminders are processed by a BullMQ background job

**FR-COM-04:** All communication is organization-scoped — staff cannot message or receive messages from staff at different organizations.

---

### 6.14 Staff Transfers *(Added Phase 8)*

**FR-TRF-01:** Directors and System Admins can transfer a staff member from one branch to another within the same organization.

**FR-TRF-02:** A transfer record captures: the staff member, the originating branch, the destination branch, the effective date, the reason, and who authorized it.

**FR-TRF-03:** On transfer, the staff member's assigned branch is updated and they gain access to the new branch's data. Prior branch access is revoked.

---

### 6.15 Incident Log *(Added Phase 8)*

**FR-INC-01 — Order Item Removal:** When a Manager or Director removes a line item from a closed or in-progress order (correction), the system records an incident: the removed item, quantity, reason, and who removed it.

**FR-INC-02 — Payment Rejection:** When a Manager or Director rejects an authorization request (house account, staff discount, customer discount), the rejection is recorded as a payment rejection incident with a reason.

---

## 7. Non-Functional Requirements

### 7.1 Performance
- API response time for order submission: under 500ms under normal load
- Real-time order status updates: delivered within 2 seconds of the state change
- Dashboard report load time: under 10 seconds

### 7.2 Reliability
- System uptime target: 99.5% during operating hours (6am–10pm)
- No data loss on network interruption — all submitted orders are persisted before acknowledgement
- Graceful error handling — all failures surface a meaningful message, never a blank screen or crash

### 7.3 Scalability
- The system must support 2 branches at launch and scale to 10+ branches without re-architecture
- The data model and architecture must isolate branch data cleanly (multi-tenancy pattern)
- The backend must be stateless and horizontally scalable

### 7.4 Security
- All API routes are authenticated via JWT
- Access tokens expire in 15 minutes; refresh tokens in 7 days (HTTP-only cookies)
- Role-based access control (RBAC) enforced on every endpoint
- Branch data isolation enforced in every database query — a user at Branch A can never access Branch B data
- All user input validated and sanitised before processing
- Passwords hashed with bcrypt (minimum 12 rounds)
- No sensitive data in URLs or client-accessible storage

### 7.5 Maintainability
- Layered architecture with strict separation of concerns
- Every significant architectural decision recorded in Architecture Decision Records (ADRs)
- Clear, consistent code style and naming conventions throughout
- System designed so new branches, roles, or order types can be added without restructuring core logic

### 7.6 Observability
- Structured logging on all API requests, errors, and significant events
- Slow query detection and logging (queries exceeding 200ms)
- Error tracking to capture and surface unexpected failures
- Audit trail for sensitive operations (account deactivation, manager overrides, payment recording)

---

## 8. User Stories

### Waiter
- As a waiter, I want to take an order on my phone so I don't have to walk to the kitchen with a paper receipt.
- As a waiter, I want to see when my order is being prepared and when it's ready, so I can serve the customer on time.
- As a waiter, I want to modify an order before it's claimed so I can handle customer changes without confusion.
- As a waiter taking a delivery order, I want the delivery fee to be added automatically when I select the zone, so I don't have to calculate it manually.
- As a waiter, I want to record how a customer paid so we have a record for end-of-day.
- As a waiter, I want to print a receipt immediately after recording payment so I can hand it to the customer without delays.

### Chef
- As a chef, I want to see incoming food orders on the kitchen tablet or my phone so I always know what to prepare.
- As a chef, I want to claim an order with my name so everyone knows who is responsible for it.
- As a chef, I want to mark an order as ready from my phone so I don't have to walk to the KDS tablet.

### Barista
- As a barista, I want to see only drink orders so I'm not distracted by food items.
- As a barista, I want to claim and manage my orders from my personal phone so I can work efficiently.

### Manager
- As a manager, I want to see all active orders at my branch from my dashboard so I can oversee operations without being on the floor.
- As a manager, I want to schedule staff shifts and see who is clocked in so I can manage my team effectively.
- As a manager, I want to see a daily sales summary so I can review how the branch performed.
- As a manager, I want to override a staff clock-in when GPS fails so a legitimate staff member isn't blocked from working.
- As a manager, I want to mark a menu item as unavailable at my branch when we run out of an ingredient.
- As a manager, I want to set up the branch thermal printer by scanning a QR code so I don't have to type long configuration tokens manually.

### Director
- As a director, I want to compare performance across all branches in one dashboard so I can identify where to focus my attention.
- As a director, I want to export monthly reports so I can review them in detail or share with stakeholders.
- As a director, I want to designate which branch is the hub so the system reflects our operational structure.
- As a director, I want to approve or reject staff discount requests from my authorization dashboard so I maintain control of staff benefits.
- As a director, I want to send a formal notice to all staff and track who has acknowledged it.
- As a director, I want to transfer a staff member to another branch when operational needs change.

### Manager *(expanded)*
- As a manager, I want to see pending house account and staff discount authorization requests so I can approve or reject them quickly.
- As a manager, I want to record other income (pool tables, events) at my branch so it is included in the day's revenue totals.
- As a manager, I want to create a house account for a staff member who is entitled to meal benefits.
- As a manager, I want to send a broadcast message to all staff at my branch so I can communicate operational updates efficiently.

### HR Manager *(Added Phase 8)*
- As an HR manager, I want to view and approve leave requests from all branches so staff absences are managed consistently.
- As an HR manager, I want to upload an employment contract to a staff member's HR profile so all documents are in one place.
- As an HR manager, I want to create a disciplinary record so incidents are documented formally.
- As an HR manager, I want to view attendance analytics across all branches so I can identify patterns and take action.
- As an HR manager, I want to edit shift definitions and weekly schedules for every branch so scheduling standards can be managed centrally.

### Accountant *(Added Phase 7)*
- As an accountant, I want to view the outstanding balances report so I know what is owed across all credit accounts.
- As an accountant, I want to mark a corporate account balance as settled after receiving payment so the ledger stays accurate.

---

## 9. Out of Scope

The following features are explicitly excluded from the current system and planned for future releases:

| Feature | Reason / Status |
|---|---|
| Inventory management | High complexity; requires dedicated design sprint — planned V2 |
| Mpesa STK Push (Pesapal) | Payment integration deferred to V2 |
| Grubba delivery API integration | Awaiting Grubba API documentation |
| Branch-to-branch stock transfers | Dependent on inventory module |
| iOS native app | Not applicable — system is web-based and works on any modern mobile browser |
| Full payroll processing | Out of scope — system handles payslip visibility only (Phase 9, see §11) |

---

## 10. Assumptions & Constraints

| # | Assumption / Constraint |
|---|---|
| A-01 | All operational staff use smartphones with a modern browser (Chrome on Android recommended) |
| A-02 | Each branch has two Android tablets available for KDS and BDS — running Chrome browser |
| A-03 | Reliable internet connectivity is available at all branches during operating hours |
| A-04 | The system will be built in English; no localisation required in V1 |
| A-05 | Branch coordinates (GPS) for geofencing will be provided during setup |
| A-06 | Delivery orders are always paid via Mpesa before preparation begins |
| A-07 | One Director account for V1; multi-director support planned for V2 |
| A-08 | Menu pricing is universal across all branches |
| A-09 | Each branch operates independently with its own staff, shifts, and delivery zones |
| A-10 | All amounts are in Kenyan Shillings (KES) |

---

## 11. Open Questions & Future Considerations

| # | Question / Consideration | Status |
|---|---|---|
| OQ-01 | Grubba API — once documentation is available, delivery tracking integration should be scoped for V2 | Open |
| OQ-02 | Multi-director support — if the business brings on additional directors or executives, the role model will need to support multiple directors | Open |
| OQ-03 | iOS support — system is web-based and works on iPhone browsers; native iOS app not needed | Resolved: not needed |
| OQ-04 | Customer-facing features — loyalty programmes, digital menus, or order history for regular customers | Open — V3+ |
| OQ-05 | Offline order submission — full offline-first capability (submitting orders without internet) | Open — V3+ |
| OQ-06 | Integration with accounting software — exporting financial reports to QuickBooks or Wave | Open — V2+ |
| OQ-07 | Payslip Visibility Module (Phase 9) — staff view their own payslips (gross pay, statutory deductions: PAYE, SHA, Housing Levy, HELB, net pay) and print them. Admin enters data manually. Full payroll processing is out of scope. | Planned — Phase 9 |
| OQ-08 | Inventory management — stock tracking per branch, low-stock alerts, consumption against orders | Planned — V2 |
| OQ-09 | Mpesa STK Push — real-time payment initiation from waiter device rather than manual confirmation | Planned — V2 |

---

*This document is the authoritative source of product requirements for the Wendo RMS. Any scope changes must be reviewed and updated here before development begins. Version 2.0 reflects the completed Phase 8 system state.*
