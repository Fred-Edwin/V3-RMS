# Build Order
## Wendo Coffee Bistro — Restaurant Management System V2
**Version:** 2.0
**Status:** Draft
**Date:** 2026-03-22
**Author:** System Architect

---

## Table of Contents

1. [Principles](#1-principles)
2. [Testing Strategy](#2-testing-strategy)
3. [Definition of Done](#3-definition-of-done)
4. [Phase Overview](#4-phase-overview)
5. [V2.1 — Inventory Management](#5-v21--inventory-management)
6. [V2.2 — HR Management](#6-v22--hr-management)
7. [V2.3 — Payment Processing](#7-v23--payment-processing)
8. [V2.4 — Communications & Notifications](#8-v24--communications--notifications)
9. [Dependency Map](#9-dependency-map)

---

## 1. Principles

All V1 principles apply. V2-specific additions:

**V2 is additive, never destructive.** V1 is live in production with real data. Every migration is additive — new tables, new columns, new enum values. No existing column, table, or enum value is removed or renamed without an explicit migration strategy reviewed in advance.

**Each V2 phase is independent at the feature level.** Unlike V1 where phases had hard dependencies (you cannot build orders without a menu), V2 phases are largely independent. They share the same schema and auth layer, but V2.2 HR does not depend on V2.1 Inventory being complete. The sequence below reflects business priority, not technical dependency.

**The Store Manager role is Central Kitchen only.** Code that handles `STORE_MANAGER` must never assume an `organizationId` pointing to a branch. The Store Manager operates at the hub (`organization.isHub = true`). Every inventory route guard must explicitly include `STORE_MANAGER` where Central Kitchen access is required.

**Public endpoints are the exception, not the rule.** The Mpesa callback endpoint in V2.3 is deliberately unauthenticated. This is the only intentional exception to the authentication rule. Document it clearly at the route level with a comment.

**E2E tests are introduced in V2.** V1 deferred E2E testing. V2 is the right point to introduce it, starting with the most critical user journeys: the inventory requisition flow and the Mpesa payment flow.

---

## 2. Testing Strategy

Inherits V1 testing strategy. V2 additions:

### E2E Tests — Introduced in V2
Using Playwright, targeting the two highest-risk user flows:
1. Morning requisition: Branch Manager submits → Store Manager dispatches → Branch Manager confirms receipt
2. Mpesa payment: Waiter triggers STK push → callback received → order auto-confirmed

### Integration Test Coverage — V2 Additions
Every new API endpoint group gets full integration test coverage:
- `/inventory/*` — all requisition state transitions, stock deduction on PrepTicket READY, stocktake submission
- `/hr/*` — assessment creation, disciplinary record creation, profile queries
- `/payments/mpesa/*` — STK push initiation, callback handling, timeout handling
- `/communications/*` — broadcast creation, direct message, acknowledgement

### Test File Convention
Same as V1 — test files live alongside the source file they test.

---

## 3. Definition of Done

A V2 phase is complete when:

- [ ] All Prisma migrations are committed and applied to production
- [ ] All backend routes are implemented with `authenticate` + `requireRole` middleware
- [ ] All Zod schemas are defined for every new endpoint
- [ ] All repositories include `organizationId` in branch-scoped queries
- [ ] All business logic is in services — not controllers, not repositories
- [ ] All new endpoints have integration tests
- [ ] All new complex business logic has unit tests
- [ ] Frontend TypeScript compiles with zero errors (`pnpm typecheck`)
- [ ] Frontend builds without errors (`pnpm build`)
- [ ] Backend builds without errors (`pnpm build`)
- [ ] No `any` types introduced
- [ ] All open questions for the phase are resolved or explicitly deferred with a note
- [ ] `CLAUDE.md` current phase is updated

---

## 4. Phase Overview

| Phase | Feature | Key Dependency | Status |
|---|---|---|---|
| V2.1 | Inventory Management | V1 complete, PrepTicket READY event | Planning |
| V2.2 | HR Management | V1 User, Shift, ClockRecord models | Pending |
| V2.3 | Payment Processing (Mpesa STK) | V1 Order/PaymentMethod, Daraja API decision | Pending |
| V2.4 | Communications & Notifications | V1 FCM infrastructure, V2.2 HR (for formal notices) | Pending |

---

## 5. V2.1 — Inventory Management

**Goal:** Full end-to-end stock visibility from supplier delivery to branch consumption and daily reconciliation.

**Pre-conditions:**
- Daraja vs Pesapal decision is NOT a blocker for this phase
- Conversion ratios (ingredient → portions) must be seeded or configured before the system can calculate fulfilment capacity
- `STORE_MANAGER` role enum value must be added before any routes are implemented

### 5.1 Database

- [ ] Add `STORE_MANAGER` to `UserRole` enum
- [ ] Add `STORE_MANAGER` to `StocktakeStation` — wait, that is a new enum. Add new enum `StocktakeStation`: `KITCHEN`, `BARISTA`, `WAITER`
- [ ] Add `RequisitionStatus` enum: `PENDING`, `APPROVED`, `DISPATCHED`, `RECEIVED`, `PARTIAL`
- [ ] Add `DisciplinaryType` enum (for V2.2 — do not defer schema if sharing a migration)
- [ ] Create `Supplier` model
- [ ] Create `RawIngredient` model (Central Kitchen stock)
- [ ] Create `IngredientConversion` model (recipe table: menuItem ↔ ingredient ratio)
- [ ] Create `SupplierDelivery` model (log of deliveries received at CK)
- [ ] Create `Requisition` model (branch requisition header)
- [ ] Create `RequisitionItem` model (line items: requested, dispatched, received)
- [ ] Create `BranchStock` model (live stock per branch per menu item)
- [ ] Create `Consumable` model (non-portioned items: oil, serviettes, etc.)
- [ ] Create `ConsumableStock` model (branch-level consumable quantities)
- [ ] Create `StocktakeSession` model (one session per branch per day)
- [ ] Create `StocktakeEntry` model (per-item count within a session)
- [ ] Run `prisma migrate dev` locally, commit migration file

### 5.2 Backend — Central Kitchen (Store Manager)

- [ ] `GET /inventory/ingredients` — list all raw ingredients with current CK stock
- [ ] `POST /inventory/suppliers` — create supplier
- [ ] `GET /inventory/suppliers` — list suppliers
- [ ] `POST /inventory/deliveries` — log a supplier delivery (increments ingredient stock)
- [ ] `GET /inventory/deliveries` — list delivery history
- [ ] `GET /inventory/requisitions` — list all requisitions (all branches, today or date range)
- [ ] `GET /inventory/requisitions/:id` — view a requisition with fulfilment capacity check
- [ ] `POST /inventory/requisitions/:id/dispatch` — approve and dispatch (deducts CK stock, sets dispatched quantities)
- [ ] `GET /inventory/stocktake/central` — view CK end-of-day count sessions
- [ ] `POST /inventory/stocktake/central` — submit CK end-of-day ingredient count

### 5.3 Backend — Branch (Branch Manager / Head Waiter)

- [ ] `POST /inventory/requisitions` — submit a requisition (branch manager only, before 6 AM cutoff)
- [ ] `GET /inventory/requisitions/branch` — list own branch's requisitions
- [ ] `POST /inventory/requisitions/:id/receive` — confirm delivery received (actual quantities)
- [ ] `GET /inventory/stock/branch` — get live stock levels for own branch
- [ ] `POST /inventory/stocktake` — submit end-of-day stocktake session (all three stations)
- [ ] `GET /inventory/stocktake` — list past stocktake sessions for own branch

### 5.4 Backend — Stock Depletion Hook

- [ ] In `prepTicketService.markReady()`: after updating ticket status to READY, deduct portions from `BranchStock` inside a `prisma.$transaction`
- [ ] If `BranchStock.currentQty` reaches zero: set `BranchMenuItem.isAvailable = false` automatically
- [ ] If `BranchStock.currentQty` drops to threshold: emit Socket.io event `inventory:low_stock` to branch room
- [ ] Add low-stock threshold field to `BranchStock` or `MenuItem` (configurable per branch item)

### 5.5 Backend — Management / Reporting

- [ ] `GET /inventory/overview` — cross-branch summary: requisition status, discrepancies, shrinkage (Director + Store Manager)
- [ ] `GET /inventory/reports/shrinkage` — shrinkage by branch, item, date range
- [ ] `GET /inventory/reports/discrepancies` — dispatch vs received gaps

### 5.6 Frontend — Store Manager Views

- [ ] `/app/store/dashboard` — CK overview: raw ingredient stock levels, today's requisitions
- [ ] `/app/store/ingredients` — manage raw ingredients and reorder thresholds
- [ ] `/app/store/suppliers` — manage suppliers
- [ ] `/app/store/deliveries` — log incoming deliveries
- [ ] `/app/store/deliveries/new` — delivery logging form
- [ ] `/app/store/requisitions` — list all branch requisitions for today
- [ ] `/app/store/requisitions/[id]` — review and dispatch a requisition
- [ ] `/app/store/stocktake` — CK end-of-day count form

### 5.7 Frontend — Branch Manager Views

- [ ] `/app/manage/inventory` — branch stock overview (live levels per item)
- [ ] `/app/manage/requisitions` — list own branch's requisitions
- [ ] `/app/manage/requisitions/new` — morning requisition form (portions per item)
- [ ] `/app/manage/requisitions/[id]` — view requisition status, confirm receipt
- [ ] `/app/manage/stocktake` — end-of-day stocktake form (tabbed: Kitchen / Barista / Waiter)
- [ ] `/app/manage/stocktake/history` — past stocktake sessions with variance report

### 5.8 Frontend — Director Views

- [ ] `/app/admin/inventory` — cross-branch inventory overview dashboard
- [ ] `/app/admin/inventory/reports` — shrinkage and discrepancy reports

### 5.9 Tests

- [ ] Integration: POST /inventory/deliveries — stock increments
- [ ] Integration: POST /inventory/requisitions — branch creates requisition
- [ ] Integration: GET /inventory/requisitions/:id — fulfilment capacity calculated correctly
- [ ] Integration: POST /inventory/requisitions/:id/dispatch — CK stock deducted, items dispatched
- [ ] Integration: POST /inventory/requisitions/:id/receive — discrepancy recorded when quantities differ
- [ ] Integration: PrepTicket READY event deducts BranchStock, sets isAvailable=false at zero
- [ ] Integration: POST /inventory/stocktake — session created, variance calculated
- [ ] Unit: fulfilment capacity calculation (ingredient stock / conversion ratio)
- [ ] Unit: variance calculation (expected - actual)

---

## 6. V2.2 — HR Management

**Goal:** Digital HR profiles for every staff member, covering performance, supervisory assessments, and disciplinary records.

**Pre-conditions:** V1 User, Shift, ShiftAssignment, ClockRecord, Order, PrepTicket models must be stable (they are — V1 is complete).

### 6.1 Database

- [ ] Create `PerformanceAssessment` model
- [ ] Create `DisciplinaryRecord` model with `DisciplinaryType` enum: `VERBAL`, `WRITTEN`, `FINAL_WRITTEN`
- [ ] Run `prisma migrate dev` locally, commit migration file

### 6.2 Backend

- [ ] `GET /hr/staff/:userId/profile` — full HR profile: performance metrics from V1 data, assessments, disciplinary history
- [ ] `POST /hr/assessments` — submit supervisory assessment
- [ ] `GET /hr/assessments?userId=` — list assessments for a staff member
- [ ] `POST /hr/disciplinary` — issue a disciplinary record
- [ ] `GET /hr/disciplinary?userId=` — list disciplinary records for a staff member
- [ ] `GET /hr/reports/performance` — performance ranking report (branch or cross-branch)
- [ ] `GET /hr/reports/disciplinary` — disciplinary activity summary
- [ ] `GET /hr/reports/attendance` — attendance trends from ClockRecord data

### 6.3 Frontend

- [ ] `/app/admin/hr` — HR overview dashboard (Director/Manager)
- [ ] `/app/admin/hr/staff/[userId]` — individual staff HR profile
- [ ] `/app/admin/hr/staff/[userId]/assess` — submit assessment form
- [ ] `/app/admin/hr/staff/[userId]/disciplinary/new` — issue disciplinary record
- [ ] `/app/admin/hr/reports` — HR reports (attendance, performance, disciplinary)

### 6.4 Tests

- [ ] Integration: POST /hr/assessments — assessment created, linked to staff
- [ ] Integration: POST /hr/disciplinary — record created with correct type and issuer
- [ ] Integration: GET /hr/staff/:userId/profile — returns aggregated V1 performance data + HR records
- [ ] Integration: RBAC — supervisor can only assess staff they supervise (branch scope)

---

## 7. V2.3 — Payment Processing

**Goal:** Waiter-initiated Mpesa STK push from within the app, auto-confirmed on callback.

**Pre-conditions:**
- Daraja vs Pesapal decision must be made and documented before development begins
- Each branch must have Mpesa credentials configured (till/paybill, consumer key, consumer secret)
- Safaricom Daraja sandbox credentials obtained for development

### 7.1 Database

- [ ] Add `mpesaTillNumber`, `mpesaConsumerKey`, `mpesaConsumerSecret`, `mpesaPasskey` to `Organization` model (or a separate `MpesaConfig` model for security)
- [ ] Add `mpesaRequestId` and `mpesaCallbackPayload` (Json) to `Order` model for callback tracking
- [ ] Run `prisma migrate dev` locally, commit migration file

### 7.2 Backend

- [ ] `POST /payments/mpesa/stk-push` — initiate STK push (authenticate + requireRole WAITER/MANAGER)
- [ ] `POST /payments/mpesa/callback` — receive Safaricom callback (**public endpoint, no authenticate middleware**) — verify Safaricom signature, mark order paid, emit Socket.io `payment:confirmed` event
- [ ] `POST /payments/mpesa/stk-push/:requestId/retry` — resend STK push
- [ ] `GET /payments/mpesa/status/:orderId` — poll payment status (for waiter UI timeout handling)

### 7.3 Frontend

- [ ] Update `OrderDetailBottomSheet` — add Mpesa STK push option in payment flow
- [ ] Phone number input field with Kenyan number validation
- [ ] Pending payment state (waiting for customer to complete on their phone)
- [ ] Auto-confirm UI when `payment:confirmed` Socket.io event received
- [ ] Timeout UI at 120 seconds: offer Resend or Switch Payment Method

### 7.4 Tests

- [ ] Integration: POST /payments/mpesa/stk-push — validates phone number, calls Daraja API (mocked in tests)
- [ ] Integration: POST /payments/mpesa/callback — order marked paid, socket event emitted
- [ ] Integration: callback with failed status — order not marked paid, waiter notified
- [ ] Unit: Kenyan phone number normalisation (0712... → 254712...)

---

## 8. V2.4 — Communications & Notifications

**Goal:** In-app broadcast announcements, direct messages, HR formal notices, and enhanced operational notifications.

**Pre-conditions:** V1 FCM infrastructure must be stable. V2.2 HR models should be complete (formal notices link to disciplinary records).

### 8.1 Database

- [ ] Create `Announcement` model
- [ ] Create `AnnouncementAck` model
- [ ] Create `DirectMessage` model
- [ ] Run `prisma migrate dev` locally, commit migration file

### 8.2 Backend

- [ ] `POST /communications/announcements` — create broadcast (Director/Manager)
- [ ] `GET /communications/announcements` — list announcements relevant to the authenticated user
- [ ] `POST /communications/announcements/:id/ack` — acknowledge an announcement
- [ ] `POST /communications/messages` — send a direct message
- [ ] `GET /communications/messages` — list conversations for authenticated user
- [ ] `GET /communications/messages/:userId` — get message thread with a specific user
- [ ] Enhanced FCM dispatch: send push notification on new announcement or direct message

### 8.3 Frontend

- [ ] `/app/communications` — inbox (announcements + direct messages)
- [ ] `/app/communications/announcements/new` — compose broadcast (Director/Manager)
- [ ] `/app/communications/messages/[userId]` — direct message thread
- [ ] Notification badge on Communications nav item (unread count)
- [ ] Acknowledgement prompt for announcements with `requiresAck = true`

### 8.4 Tests

- [ ] Integration: POST /communications/announcements — scoped correctly to target roles/branches
- [ ] Integration: POST /communications/announcements/:id/ack — ack recorded, not duplicated
- [ ] Integration: POST /communications/messages — RBAC enforced (waiter cannot initiate to Director)
- [ ] Integration: GET /communications/announcements — user only sees announcements relevant to their role and branch

---

## 9. Dependency Map

```
V1 (Complete)
├── User / Roles / Auth          ← V2 STORE_MANAGER extends this
├── Organization (isHub)         ← V2.1 Central Kitchen operations
├── MenuItem / BranchMenuItem    ← V2.1 inventory depletion + auto-hide
├── PrepTicket (READY event)     ← V2.1 stock deduction trigger
├── Order / PaymentMethod        ← V2.3 Mpesa payment path
├── ShiftAssignment / ClockRecord ← V2.2 HR attendance data
└── FCM Push Notifications       ← V2.4 enhanced notifications

V2.1 Inventory
└── BranchStock                  ← feeds V2.4 inventory alerts

V2.2 HR
└── DisciplinaryRecord           ← feeds V2.4 formal notices

V2.3 Payments
└── Mpesa callback               ← no downstream V2 dependencies

V2.4 Communications
├── depends on V2.2 (formal notices linked to disciplinary records)
└── enhances V2.1 alerts (requisition dispatched, delivery confirmed)
```
