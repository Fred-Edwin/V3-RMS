# Product Requirements Document
## Wendo Coffee Bistro — Restaurant Management System (RMS)
**Version:** 1.0  
**Status:** Draft  
**Date:** 2026-02-22  
**Author:** System Architect  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Goals & Success Metrics](#3-goals--success-metrics)
4. [Users & Roles](#4-users--roles)
5. [Scope — V1](#5-scope--v1)
6. [Functional Requirements](#6-functional-requirements)
7. [Non-Functional Requirements](#7-non-functional-requirements)
8. [User Stories](#8-user-stories)
9. [Out of Scope — V1](#9-out-of-scope--v1)
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
- Claims orders by selecting their name from the on-shift staff dropdown
- Marks orders as Ready when preparation is complete
- Receives notifications for new incoming orders

**Access scope:** Their branch. Food orders only.

---

### 4.6 Barista
**Who:** Barista station staff responsible for preparing drink orders.  
**Interface:** Shared Android tablet (BDS) + personal mobile-first web app.  
**Responsibilities:**
- Views incoming drink orders on the Barista Display System (BDS) or personal phone
- Claims orders by selecting their name from the on-shift staff dropdown
- Marks orders as Ready when preparation is complete
- Receives notifications for new incoming orders

**Access scope:** Their branch. Drink orders only.

---

## 5. Scope — V1

### In Scope
- Digital order management — Dine-In, Take-Away, Delivery
- Automated order routing to Kitchen Display System (KDS) and Barista Display System (BDS)
- Real-time order tracking and status progression
- Order modification (while status is Pending)
- Manual payment recording (no actual payment processing)
- Kitchen Display System (KDS) — Android tablet app (web app, browser-based)
- Barista Display System (BDS) — Android tablet app (web app, browser-based)
- Waiter interface — mobile-first web app (no install required)
- Chef and Barista personal phone interface — mobile-first web app
- Manager web dashboard
- Director web dashboard
- Menu management (System Admin and Director at system level; Manager for branch availability)
- Staff accounts and role-based access control (RBAC)
- Geofencing clock-in/out (50m radius)
- Shift scheduling and tracking
- Push notifications (Firebase Cloud Messaging)
- Delivery zones per branch with automatic fee calculation
- Reporting and analytics (branch-level and cross-branch)
- Report export (PDF and CSV)
- Offline resilience — clear error states, graceful degradation

### Out of Scope — V1 (Planned for V2)
- Inventory management
- Payment processing (Pesapal/Mpesa STK Push integration)
- Receipt printing (thermal printer integration)
- Grubba delivery integration
- Branch-to-branch stock transfer

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

**FR-ORD-06:** Payment methods for Dine-In and Take-Away shall be: Mpesa, Cash, or Card. Payment method for Delivery shall be: Mpesa only.

**FR-ORD-07:** The waiter shall be able to track the preparation status of their submitted orders in real time from an order details view. The view shall show the status of each station (food: Pending / In-Progress / Ready; drinks: Pending / In-Progress / Ready).

**FR-ORD-08 — Order Modification:**
- A waiter may modify an order (add/remove items, change quantities, update comments) only while that station's portion is in **Pending** status (not yet claimed)
- Each station's portion is independently modifiable based on its own status
- If the food portion is still Pending but drinks are In-Progress, the waiter may still modify the food portion
- Once a station's portion moves to In-Progress, it cannot be modified
- When a modification occurs, the affected prep station (KDS or BDS) shall receive a notification of the change

**FR-ORD-09:** Order statuses shall be: `Pending` → `In-Progress` → `Ready` → `Closed`.

**FR-ORD-10:** An order is marked **Closed** when the waiter confirms payment (or marks as Handed to Grubba for delivery).

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
- The system checks the device GPS coordinates against the branch coordinates (50m radius)
- If within range, clock-in is recorded with a GPS-verified flag
- If outside range, clock-in is blocked and an error message is displayed
- A Manager can perform a manual override from their dashboard — this is recorded with an "Override" flag and requires the manager to enter a reason note
- Clock-out follows the same geofencing rules

**FR-STF-05 — Shift Scheduling:**
- Managers create shifts with a name, start time, and end time (e.g., Morning 6:00am–2:00pm)
- Shift times are editable by the Manager
- Managers assign specific staff members to specific shifts per day
- Staff can view their own upcoming shifts in their app
- The system records scheduled hours vs actual hours worked (calculated from clock-in/out timestamps)

**FR-STF-06:** Staff can only clock in if they are assigned to a shift for that day at their branch, or if the manager performs an override.

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

### Director
- As a director, I want to compare performance across all branches in one dashboard so I can identify where to focus my attention.
- As a director, I want to export monthly reports so I can review them in detail or share with stakeholders.
- As a director, I want to designate which branch is the hub so the system reflects our operational structure.

---

## 9. Out of Scope — V1

The following features are explicitly excluded from Version 1 and planned for a future release:

| Feature | Reason |
|---|---|
| Inventory management | High complexity; requires dedicated design sprint |
| Mpesa STK Push (Pesapal) | Payment integration deferred to V2 |
| Receipt/thermal printer integration | Deferred to V2 |
| Grubba delivery API integration | Awaiting Grubba API documentation |
| Branch-to-branch stock transfers | Dependent on inventory module |
| iOS support | Not applicable — system is web-based and works on any modern mobile browser |

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

| # | Question / Consideration |
|---|---|
| OQ-01 | Grubba API — once documentation is available, delivery tracking integration should be scoped for V2 |
| OQ-02 | Multi-director support — if the business brings on additional directors or executives, the role model will need to support multiple directors |
| OQ-03 | iOS support — if waiters or managers begin using iPhones, an iOS app or PWA will need to be considered |
| OQ-04 | Customer-facing features — loyalty programmes, digital menus, or order history for regular customers are not in scope but could add significant value |
| OQ-05 | Offline order submission — full offline-first capability (submitting orders without internet) is a complex but potentially valuable feature for V3 |
| OQ-06 | Integration with accounting software — exporting financial reports to tools like QuickBooks or Wave for accounting purposes |

---

*This document is the authoritative source of product requirements for the Wendo RMS V1. Any scope changes must be reviewed and updated here before development begins.*
