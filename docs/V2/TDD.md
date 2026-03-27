# Technical Design Document — Addendum
## Wendo Coffee Bistro — RMS V2
**Version:** 2.0
**Status:** Draft
**Date:** 2026-03-22
**Extends:** `docs/TDD.md` (V1 — all V1 architectural decisions remain in force)

---

## Overview

This document covers only new architectural decisions introduced in V2. Read `docs/TDD.md` first. The V1 stack (Next.js, Express, PostgreSQL, Prisma, Redis, Socket.io, BullMQ) is unchanged. V2 adds new subsystems on top.

---

## 1. Inventory Architecture

### 1.1 Stock Depletion — Event-Driven via PrepTicket

**Decision:** Branch stock depletion is triggered by the existing `PrepTicket.status → READY` transition, not by order placement or by a separate inventory event.

**Rationale:** When a `PrepTicket` is marked READY, it means the food has been prepared and is leaving the kitchen. That is the correct moment to deduct stock — not when the order is placed (food may not be prepared if an order is cancelled) and not when the order is closed (too late to prevent the last portion going undetected). Hooking into the existing `markReady` service method is precise and requires no new event infrastructure.

**Implementation:** `prepTicketService.markReady()` is extended to include a `BranchStock` deduction inside a `prisma.$transaction`. If stock is not found for an item, the system logs a warning and proceeds (avoids blocking service if stock tracking is not yet set up for an item). If stock reaches zero, `BranchMenuItem.isAvailable` is set to `false` in the same transaction.

```
PrepTicket → READY
  └── prisma.$transaction
        ├── update PrepTicket.status = READY
        ├── decrement BranchStock.currentQty
        └── if currentQty === 0:
              set BranchMenuItem.isAvailable = false
              emit socket: inventory:out_of_stock
```

### 1.2 Low Stock Alerts — Socket.io + FCM

**Decision:** Low stock alerts are delivered via Socket.io (real-time if the manager has the app open) and FCM push (if the app is backgrounded). The threshold check happens in the `inventoryService` after the stock deduction.

**Rationale:** Socket.io is already in use for real-time operational events (order updates, prep tickets). Reusing it for inventory alerts keeps the real-time layer consistent. FCM is the fallback for background delivery, already configured for operational notifications in V1.

### 1.3 Requisition State Machine

```
PENDING → DISPATCHED → RECEIVED
       → PARTIAL (if receivedQty < dispatchedQty for any item)
```

`APPROVED` is an optional intermediate state for cases where the Store Manager wants to acknowledge a requisition before preparing the dispatch. It may be omitted in the initial implementation if the workflow proves unnecessary.

### 1.4 Ingredient Conversion — Pull Not Push

**Decision:** The system calculates how many portions can be fulfilled from current raw stock on demand (when the Store Manager opens a requisition), not continuously in the background.

**Rationale:** Calculating fulfilment capacity continuously as stock changes would require background jobs and caches that add complexity. Since the Store Manager reviews a requisition once per day, an on-demand calculation at review time is accurate, simple, and requires no background infrastructure.

**Calculation:**
```
canFulfilQty(menuItemId) = min over all ingredients:
  floor(ingredient.currentStockCk / conversion.quantityPerPortion)
```

If a menu item uses multiple ingredients, the limiting ingredient determines the fulfilment capacity.

---

## 2. Mpesa Integration Architecture

### 2.1 Daraja vs Pesapal — Open Decision

**Status: Unresolved.** This decision must be made before V2.3 development begins.

**Option A — Safaricom Daraja API (Direct)**

```
Waiter App → POST /payments/mpesa/stk-push
  → Backend calls Daraja STK Push API directly
  → Customer receives prompt on phone
  → Daraja calls POST /payments/mpesa/callback (public endpoint)
  → Backend marks order paid, emits socket event
```

Pros: No Pesapal transaction fees. Direct relationship with Safaricom. Per-branch configuration is straightforward (each branch has its own Daraja credentials).

Cons: Daraja integration requires Safaricom business account approval. More backend code to maintain. Certificate management for the callback URL.

**Option B — Pesapal Payment API (Intermediary)**

```
Waiter App → POST /payments/mpesa/stk-push
  → Backend calls Pesapal STK push API
  → Pesapal handles Daraja internally
  → Pesapal calls our callback endpoint
  → Backend marks order paid
```

Pros: Pesapal integration is already partially understood from V1 POS device usage. Possibly faster to implement. Pesapal handles Daraja compliance.

Cons: Per-transaction fee. Dependency on Pesapal's uptime. Per-branch configuration requires separate Pesapal accounts per branch or a custom sub-account model.

**Recommendation:** Daraja direct is the better long-term architecture. Pesapal is acceptable for a faster V2.3 launch if Daraja approval timelines are a constraint.

### 2.2 Callback URL Security

The Mpesa callback endpoint is public (no auth token). Security is achieved by:
1. **IP whitelist** — restrict the callback route to Safaricom's known IP ranges at the API gateway or load balancer level
2. **Signature validation** — validate the Daraja callback signature if Safaricom provides one

Both should be implemented. IP whitelisting is the primary defence.

### 2.3 STK Push Timeout Handling

If no callback is received within 120 seconds:
- Frontend polls `GET /payments/mpesa/status/:orderId` every 10 seconds from second 30 onwards
- At 120 seconds the UI shows a timeout prompt: Resend or Switch Payment Method
- The order remains unpaid; no automatic cancellation

This is a deliberate choice — customers sometimes complete payment after a delay. The waiter can observe the customer's phone and decide whether to resend or switch.

### 2.4 Per-Branch Mpesa Configuration

Each `Organization` row stores its own Mpesa credentials. The `inventoryService` (or a new `mpesaService`) retrieves the credentials for the waiter's branch from the authenticated user's `organizationId` when processing an STK push.

Credentials (`mpesaConsumerSecret`, `mpesaPasskey`) must be stored encrypted in the database or, preferably, as environment variables per branch managed via a secrets manager. For the initial implementation, database storage with column-level encryption is acceptable if a secrets manager is not available.

---

## 3. HR Architecture

### 3.1 Performance Metrics Are Derived, Not Stored

**Decision:** The performance profile (order counts, prep times, attendance rate) shown on a staff member's HR profile is computed from existing V1 data at query time, not pre-computed and stored in a separate table.

**Rationale:** V1 already stores all the necessary data: `Order` records reference `createdById`, `PrepTicket` records have `claimedAt`/`readyAt` timestamps, `ClockRecord` tracks attendance. A reporting query over existing data is sufficient and avoids data duplication.

For future optimisation, a pre-computed monthly summary table can be added if query performance becomes a concern at scale.

### 3.2 Assessment Dimensions Schema

The `dimensions` field on `PerformanceAssessment` is `Json`. The exact keys are not enforced at the database level — validation occurs at the API layer via Zod. This allows the assessment form structure to be refined without a schema migration.

Once the assessment form dimensions are finalised in the V2.2 discovery workshop, the Zod schema is updated to enforce the exact shape. The `Json` field remains flexible for future changes.

---

## 4. Communications Architecture

### 4.1 Delivery — Socket.io + FCM (Same as V1 Operational Notifications)

**Decision:** New direct messages and announcements are delivered via the same dual-path already used for operational notifications: Socket.io for real-time in-app delivery, FCM for background push.

**Rationale:** No new infrastructure is needed. The FCM push handler in the backend already supports custom notification payloads. Adding a new notification type is an extension, not a new system.

### 4.2 Message Storage — PostgreSQL (Not a Chat Database)

**Decision:** Direct messages are stored in the standard PostgreSQL database, not a dedicated messaging store (Redis, DynamoDB, etc.).

**Rationale:** Direct messaging between managers and staff is not high-frequency chat. The volume is low (professional workplace communications, not a social network). PostgreSQL with appropriate indexes handles this comfortably. A dedicated messaging infrastructure would be over-engineering for this use case.

### 4.3 Announcements Are Fan-Out at Query Time

**Decision:** When a user requests their announcements, the system filters by `targetRoles` and `organizationId` at query time. There is no pre-computed fan-out that creates one row per recipient per announcement.

**Rationale:** Given the scale (tens of staff, not millions), a query-time filter is perfectly efficient and avoids the complexity of a fan-out write operation. If announcements grow to include thousands of recipients, a fan-out table (`AnnouncementRecipient`) can be introduced without changing the API contract.

### 4.4 Acknowledgements

`AnnouncementAck` has a `UNIQUE([announcementId, userId])` constraint. The `POST /communications/announcements/:id/ack` endpoint is idempotent — a duplicate ack is silently accepted (no error, no second write). This makes the frontend safe to retry without worry.

---

## 5. Architecture Decision Records (V2)

### ADR-V2-001: `STORE_MANAGER` as a New Enum Value
**Decision:** Add `STORE_MANAGER` to the `UserRole` enum rather than reusing `MANAGER` with an `isHub` check.
**Rationale:** Clean, unambiguous RBAC. Every `requireRole` call for Central Kitchen routes is explicit. No hidden conditional logic that could grant a branch manager unintended inventory access. The enum value is the authority — not a runtime check on the user's branch.

### ADR-V2-002: `BranchStock` as a Separate Table
**Decision:** Track live branch stock in a dedicated `BranchStock` table rather than adding a field to `BranchMenuItem`.
**Rationale:** `BranchMenuItem` is configuration; `BranchStock` is operational state. They change at different frequencies for different reasons. Separating them keeps the configuration layer clean and makes stock depletion writes fast and simple.

### ADR-V2-003: Stock Deduction Hooked Into PrepTicket READY
**Decision:** Trigger stock deduction from the existing `prepTicketService.markReady()` path rather than a new event or job.
**Rationale:** `PrepTicket → READY` is the most accurate moment (food physically leaving the kitchen). No new infrastructure. The existing `prisma.$transaction` pattern handles atomicity.

### ADR-V2-004: Mpesa Credentials in Organisation Row
**Decision:** Store per-branch Mpesa credentials on the `Organization` model rather than a separate `MpesaConfig` table.
**Rationale:** Simpler to query (no join needed), and each organisation has at most one Mpesa configuration. If the configuration grows significantly or needs versioning, a separate table can be introduced.

### ADR-V2-005: HR Performance Data Computed at Query Time
**Decision:** Do not pre-compute or cache HR performance metrics.
**Rationale:** V1 data is sufficient and already indexed. The HR profile is viewed infrequently (not in a hot path). Computing at query time avoids a second source of truth and keeps the data model clean.
