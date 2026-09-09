# Phase 11 — Order Cancellation Approval Plan

**Status:** Planned  
**Date:** 2026-05-13  
**Client feedback:** Waiters can currently cancel orders directly. This is an operational loophole because prepared or in-progress orders can be removed from the live workflow with only an audit record after the fact.

---

## Goal

Require Manager or Director approval before a waiter-initiated order cancellation takes effect, using the same operational pattern as House Account and discount approvals while keeping cancellation approval in its own domain model.

---

## Product Rules

1. Waiters may request cancellation only for their own orders.
2. A waiter cancellation request does not immediately cancel the order.
3. Pending cancellation approval locks risky actions on the order: payment, item editing, split-line edits, and duplicate cancellation requests.
4. Managers and Directors may approve or reject waiter cancellation requests.
5. Managers and Directors may still cancel active orders directly from `PENDING`, `IN_PROGRESS`, or `READY`, with a required reason and full audit trail. Orders in `AWAITING_AUTHORIZATION` stay governed by their payment/discount authorization flow.
6. If approved, the order becomes `CANCELLED`, prep stations are notified, and the request is marked `APPROVED`.
7. If rejected, the order returns to the saved `previousStatus` and the waiter is notified to continue handling it.
8. Closed and already-cancelled orders cannot be cancelled or requested for cancellation.

---

## Recommended State Model

Add a new order status:

```prisma
AWAITING_CANCELLATION_APPROVAL
```

This is intentionally separate from `AWAITING_AUTHORIZATION`, which is reserved for payment and discount approvals. Cancellation is not a payment authorization and has different resolution behavior.

When a waiter requests cancellation:

```text
PENDING | IN_PROGRESS | READY
        -> AWAITING_CANCELLATION_APPROVAL
```

When a manager/director resolves it:

```text
APPROVE -> CANCELLED
REJECT  -> previousStatus
```

`previousStatus` must be stored on the request record so rejection restores the exact pre-request lifecycle state.

---

## Database Plan

Add `OrderCancellationRequest`:

```prisma
model OrderCancellationRequest {
  id             String                    @id @default(uuid())
  organizationId String                    @map("organization_id")
  orderId        String                    @map("order_id")
  requestedById  String                    @map("requested_by_id")
  reason         String
  reasonDetail   String?                   @map("reason_detail")
  previousStatus OrderStatus               @map("previous_status")
  status         CancellationRequestStatus @default(PENDING)
  resolvedById   String?                   @map("resolved_by_id")
  resolvedAt     DateTime?                 @map("resolved_at")
  resolutionNote String?                   @map("resolution_note")
  createdAt      DateTime                  @default(now()) @map("created_at")
  updatedAt      DateTime                  @updatedAt @map("updated_at")

  order       Order @relation(fields: [orderId], references: [id])
  requestedBy User  @relation("OrderCancellationRequestedBy", fields: [requestedById], references: [id])
  resolvedBy  User? @relation("OrderCancellationResolvedBy", fields: [resolvedById], references: [id])

  @@index([organizationId])
  @@index([orderId])
  @@index([requestedById])
  @@index([status])
  @@map("order_cancellation_requests")
}

enum CancellationRequestStatus {
  PENDING
  APPROVED
  REJECTED
}
```

Migration should also add a database-level partial unique index so each order can have at most one pending cancellation request:

```sql
CREATE UNIQUE INDEX order_cancellation_requests_one_pending_per_order
ON order_cancellation_requests(order_id)
WHERE status = 'PENDING';
```

The Prisma schema update must also add inverse relation arrays on `Order` and `User` for the named request/resolution relations.

---

## Backend Implementation Plan

1. Update Prisma schema and migration.
2. Add Zod schemas:
   - request cancellation body: `reason`, `reasonDetail`
   - cancellation request id param
   - override body: `decision: APPROVED | REJECTED`, optional `resolutionNote`
3. Add repository:
   - create pending request and move order to `AWAITING_CANCELLATION_APPROVAL` in one transaction
   - list pending requests by `organizationId`
   - find pending request by order
   - approve request and cancel order in one transaction
   - reject request and restore `previousStatus` in one transaction
4. Add service:
   - enforce waiter ownership
   - enforce manager/director approval roles
   - reject duplicate pending requests
   - reject terminal orders
   - emit sockets only after transaction commits
5. Update existing order service guards:
   - `recordPayment` rejects `AWAITING_CANCELLATION_APPROVAL`
   - `updateItems` rejects `AWAITING_CANCELLATION_APPROVAL`
   - split-line add/delete rejects `AWAITING_CANCELLATION_APPROVAL`
   - prep ticket claim/ready behavior remains ticket-driven, but order-level actions stay locked
6. Preserve direct manager/director cancellation for `PENDING`, `IN_PROGRESS`, and `READY` orders with audit. Pending payment/discount authorization should not be bypassed by this path.

---

## API Plan

Keep the existing waiter UI action path but change its server behavior:

| Method | Path | Roles | Behavior |
|---|---|---|---|
| `PATCH` | `/orders/:id/cancel` | `WAITER` | Creates a pending cancellation request; order moves to `AWAITING_CANCELLATION_APPROVAL` |
| `PATCH` | `/orders/:id/cancel` | `MANAGER`, `DIRECTOR` | Directly cancels an active `PENDING`, `IN_PROGRESS`, or `READY` order |
| `GET` | `/order-cancellation-auth` | `MANAGER`, `DIRECTOR` | Lists pending requests for the branch |
| `GET` | `/orders/:orderId/cancellation-auth` | `WAITER`, `MANAGER`, `DIRECTOR` | Gets the pending request for an order |
| `POST` | `/order-cancellation-auth/:authRequestId/override` | `MANAGER`, `DIRECTOR` | Approves or rejects the request |

---

## Frontend Implementation Plan

1. Add types and service functions for cancellation auth requests.
2. Update order status unions and badge styling for `AWAITING_CANCELLATION_APPROVAL`.
3. Update waiter cancel sheet copy:
   - button: "Request cancellation"
   - success toast: "Cancellation request sent"
4. Update order detail sheet:
   - show amber pending-cancellation state
   - disable payment/edit/split actions while pending
   - show rejected/approved resolution through socket refresh
5. Add manager dashboard widget using the existing authorization-card pattern:
   - request reason
   - order number, waiter, amount, status at request time
   - Approve and Reject actions
6. Add socket listeners:
   - `order:cancellation_pending`
   - `order:cancellation_resolved`

---

## Test Plan

Backend service tests:

- waiter creates a pending cancellation request for own active order
- waiter cannot request cancellation for another waiter's order
- waiter cannot request cancellation for closed/cancelled/pending-approval order
- duplicate pending request returns conflict
- manager approves request and order becomes `CANCELLED`
- manager rejects request and order restores `previousStatus`
- manager/director direct cancellation still works
- repository mutations include `organizationId`

Backend route/integration tests:

- route auth and role guards
- validation errors for missing reason and `Other` without detail
- tenant isolation for list/get/override

Frontend checks:

- waiter cancel sheet sends request and updates UI to pending
- payment/edit controls are disabled while pending
- manager dashboard can approve/reject
- socket events refresh waiter and manager views

---

## Rollout Notes

This requires a Prisma migration and should ship as a focused PR. Because production deploys run migrations automatically after merge to `main`, the generated migration must be committed with the code changes.
