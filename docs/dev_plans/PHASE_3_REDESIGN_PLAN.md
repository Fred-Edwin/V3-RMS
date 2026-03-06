# Order Lifecycle Redesign — Implementation Plan

## Context

During a production readiness review of Phase 3 (Order Management), we found race conditions, missing features, and UX gaps confirmed by staff onboarding feedback. The core problem: the system lacks single-ownership enforcement, so concurrent actors can corrupt order state. Additionally, kitchen staff cannot reject or unclaim tickets, waiters have no way to request modifications on in-progress orders, cancellation reasons are discarded, and managers have no incident visibility.

This plan redesigns the order lifecycle around a **single-ownership model**: only the creating waiter can mutate their own order, kitchen staff own their claimed tickets, and every non-happy-path event is logged for manager review.

---

## Batch 1: Schema + Race Condition Fixes + findActive Bounding

**Goal:** Fix critical backend bugs, add all new DB models/columns. No new features exposed yet.

### 1.1 Prisma Schema Changes

**File:** `backend/prisma/schema.prisma`

**New enum values:**
- Add `REJECTED` to `PrepTicketStatus` enum
- Add new enums: `IncidentType`, `ModificationRequestStatus`

**New columns on `Order`:**
- `cancelReason String? @map("cancel_reason")`
- `cancelledById String? @map("cancelled_by_id")` + relation to User via `"OrderCancelledBy"`

**New columns on `PrepTicket`:**
- `rejectedById String? @map("rejected_by_id")` + relation to User via `"PrepTicketRejectedBy"`
- `rejectedReason String? @map("rejected_reason")`
- `rejectedAt DateTime? @map("rejected_at")`

**New model `OrderModificationRequest`:**
- id, organizationId, orderId, requestedById, description (String), status (ModificationRequestStatus default PENDING), reviewedById?, reviewedAt?, reviewNote?, createdAt, updatedAt
- Indexes: organizationId, orderId, [organizationId, status]

**New model `IncidentLog`:**
- id, organizationId, orderId?, type (IncidentType), actorId, details (Json), createdAt
- Indexes: organizationId, [organizationId, type], orderId, createdAt

**New model `IdempotencyKey`:**
- id, key (unique), orderId, createdAt
- Index: key

**Add corresponding relations** on User, Order, Organization models.

**Migration:** Single migration file covering all changes. All new columns are nullable, all new tables — safe to run on production with existing data.

### 1.2 Race Condition Fixes

**File:** `backend/src/repositories/order-repository.ts`

1. **`recordPayment`** (line ~440): Add `status: OrderStatus.READY` to `updateMany` WHERE clause
2. **`cancel`**: Change signature to accept `allowedStatuses: OrderStatus[]`, `cancelReason: string`, `cancelledById: string`. Add `status: { in: allowedStatuses }` to WHERE clause, add `cancelReason` and `cancelledById` to data
3. **`updateItems`** (line ~366): Inside the transaction, after re-fetching existingOrder, re-verify that all relevant prep tickets are still PENDING before proceeding with the delete/create

### 1.3 findActive Bounding

**File:** `backend/src/repositories/order-repository.ts`

Modify `findActive` and `findActiveSummary` (lines ~329-357):
- Add `orderDate: normalizeOrderDate(new Date())` to WHERE
- Add `take: 200` safety limit

Pass `orderDate` as parameter or compute inline (keep util function `normalizeOrderDate` from order-service).

### 1.4 Update Serialization

**File:** `backend/src/services/order-service.ts`

- Update `serializeOrder` to include `cancelReason` and `cancelledBy` fields
- Update `serializeOrderSummary` similarly

**File:** `backend/src/types/order.types.ts`

- Add `cancelReason: string | null` and `cancelledBy: { id: string; name: string } | null` to `OrderRecord` and `OrderSummaryRecord`

### 1.5 Update Cancel Flow (Minimal)

**File:** `backend/src/services/order-service.ts`

- Update `cancel` to accept and pass through `reason` string to repository
- Pass `actor.id` as `cancelledById`
- Use `[OrderStatus.PENDING]` as allowed statuses for WAITER, `[PENDING, IN_PROGRESS, READY]` for MANAGER (full redesign in Batch 2)

**File:** `backend/src/controllers/order-controller.ts`

- Line ~104: Use the parsed `CancelOrderSchema` result, pass `reason` to service

**File:** `backend/src/validators/order-schemas.ts`

- No change yet (current schema requires reason string, which is fine for now)

### 1.6 Update orderInclude for New Fields

**File:** `backend/src/repositories/order-repository.ts`

- Add `cancelledBy: { select: { id: true, name: true } }` to `orderInclude` and `orderSummaryInclude`
- Add `cancelReason: true` to selects (implicit in Prisma includes)

### Verification — Batch 1
- `pnpm build` in backend passes
- Run existing order + prep-ticket tests — all pass with updated signatures
- New tests: concurrent recordPayment returns 409 on second call, cancel stores reason, findActive returns only today's orders
- Apply migration locally: `docker compose exec api npx prisma migrate deploy`

---

## Batch 2: Single Ownership + Cancellation Redesign + Incident Log

**Goal:** Enforce ownership server-side, redesign cancellation with predefined reasons, add incident logging infrastructure.

### 2.1 Ownership Enforcement

**File:** `backend/src/services/order-service.ts`

Add helper:
```typescript
const assertOwnership = (order: FullOrderPrismaRecord, actor: Actor): void => {
  if (actor.role === 'MANAGER' || actor.role === 'DIRECTOR') return;
  if (order.createdById !== actor.id) {
    throw new ForbiddenError('Only the waiter who created this order can perform this action');
  }
};
```

Apply in: `updateItems`, `recordPayment`, `cancel` (before any other logic).

### 2.2 Cancellation Redesign

**File:** `backend/src/validators/order-schemas.ts`

Replace `CancelOrderSchema`:
```typescript
export const CancelOrderSchema = z.object({
  reason: z.enum([
    'Customer changed their mind',
    'Customer left',
    'Duplicate order',
    'Wrong items ordered',
    'Item unavailable',
    'Other',
  ]),
  reasonDetail: z.string().min(1).max(500).optional(),
}).refine(
  (data) => data.reason !== 'Other' || (data.reasonDetail && data.reasonDetail.trim().length > 0),
  { message: 'Please provide details for "Other" reason', path: ['reasonDetail'] },
);
```

**File:** `backend/src/services/order-service.ts`

Redesign `cancel`:
- Compose final reason string: if "Other" → `"Other: {reasonDetail}"`, else use predefined string
- WAITER: ownership check + only allow `[OrderStatus.PENDING]`
- MANAGER: allow `[PENDING, IN_PROGRESS, READY]` — force cancel
- On force cancel of IN_PROGRESS/READY: emit `order:force_cancelled` to stations + waiter
- Log incident in all cases

### 2.3 Incident Log Backend

**New files:**
- `backend/src/repositories/incident-repository.ts` — `create`, `findMany` (paginated, filterable by type/date/orderId)
- `backend/src/services/incident-service.ts` — `log` (fire-and-forget, catches errors internally), `getMany`
- `backend/src/types/incident.types.ts` — `IncidentLogRecord`, `CreateIncidentDto`
- `backend/src/validators/incident-schemas.ts` — `IncidentQuerySchema` (type?, startDate?, endDate?, page, perPage)
- `backend/src/controllers/incident-controller.ts` — `getIncidents`
- `backend/src/routes/incident-routes.ts` — `GET /incidents` (MANAGER, DIRECTOR)

**Register** in `backend/src/routes/index.ts`.

**Integrate incident logging** into `order-service.cancel` — call `incidentService.log` after successful cancellation.

### 2.4 Socket Events

**File:** `backend/src/sockets/socket-service.ts`

Add:
- `emitOrderForceCancelled(organizationId, stations, waiterId, payload)` — emits `order:force_cancelled` to station rooms + waiter user room
- `emitIncident(organizationId, payload)` — emits `incident:new` to branch room (managers filter client-side)

**File:** `backend/src/sockets/socket.ts`

No changes needed — branch room already exists and managers join it.

### 2.5 FCM Push for Force Cancel

**File:** `backend/src/services/fcm-service.ts`

Add `sendOrderForceCancelledPush(waiterId, payload)` — notifies waiter their order was force-cancelled by manager.

### Verification — Batch 2
- Test: waiter cannot modify/pay/cancel another waiter's order → 403
- Test: waiter cancel on PENDING succeeds, on IN_PROGRESS fails → 409
- Test: manager cancel on IN_PROGRESS succeeds
- Test: cancel reason with "Other" requires reasonDetail
- Test: incident log created on every cancellation
- Test: `GET /incidents` returns paginated, filtered results
- Socket test: force cancel emits to correct rooms

---

## Batch 3: Ticket Rejection + Ticket Unclaim

**Goal:** Kitchen/barista can reject unavailable items and fix wrong-name claims.

### 3.1 Ticket Rejection

**File:** `backend/src/validators/order-schemas.ts`

Add `RejectPrepTicketSchema = z.object({ reason: z.string().min(1).max(500) })`

**File:** `backend/src/repositories/prep-ticket-repository.ts`

Add `reject(id, organizationId, rejectedById, reason)` — `updateMany` with `status: { in: [PENDING, IN_PROGRESS] }`, sets REJECTED + rejectedById/Reason/At

**File:** `backend/src/services/prep-ticket-service.ts`

Add `reject(ticketId, reason, actor)`:
- Validate ticket exists, belongs to actor's station
- Call repository reject
- Check if ALL tickets for the order are now REJECTED → if yes, auto-cancel order (reason: "All prep tickets rejected by kitchen/barista")
- Emit `ticket:rejected` to waiter user room
- Log incident
- Notify manager

**File:** `backend/src/controllers/prep-ticket-controller.ts` — add `rejectPrepTicket`

**File:** `backend/src/routes/prep-ticket-routes.ts` — add `PATCH /prep-tickets/:id/reject`

**File:** `backend/src/sockets/socket-service.ts`

Add `emitTicketRejected(waiterId, payload)` — emits `ticket:rejected`

### 3.2 Ticket Unclaim

**File:** `backend/src/repositories/prep-ticket-repository.ts`

Add `unclaim(id, organizationId)` — `updateMany` with `status: IN_PROGRESS`, sets `status: PENDING, claimedById: null, claimedAt: null`

**File:** `backend/src/services/prep-ticket-service.ts`

Add `unclaim(ticketId, actor)`:
- Validate ticket exists, belongs to actor's station, status is IN_PROGRESS
- Check 2-minute window from `claimedAt` — reject if expired
- Call repository unclaim
- If all tickets for order are now PENDING, revert order status to PENDING
- Emit `ticket:unclaimed` to waiter user room
- Log incident

**File:** `backend/src/controllers/prep-ticket-controller.ts` — add `unclaimPrepTicket`

**File:** `backend/src/routes/prep-ticket-routes.ts` — add `PATCH /prep-tickets/:id/unclaim`

**File:** `backend/src/sockets/socket-service.ts`

Add `emitTicketUnclaimed(waiterId, payload)` — emits `ticket:unclaimed`

### 3.3 Update Active Query Exclusions

**File:** `backend/src/repositories/order-repository.ts`

Update `findActive`/`findActiveSummary` WHERE to exclude REJECTED from prep ticket sub-queries if needed.

**File:** `backend/src/repositories/prep-ticket-repository.ts`

Ensure `findByStation` with `activeOnly: true` excludes REJECTED tickets — update the `order.status` notIn to also handle ticket-level REJECTED status.

### Verification — Batch 3
- Test: reject ticket from correct station succeeds, wrong station → 403
- Test: reject stores reason and rejectedById
- Test: all tickets rejected → order auto-cancelled with reason
- Test: unclaim within 2 min succeeds, after 2 min → 409
- Test: unclaim reverts order status to PENDING when appropriate
- Test: incident log entries created for both actions

---

## Batch 4: Order Modification Redesign + Idempotency

**Goal:** Two-path modification flow + duplicate submission prevention.

### 4.1 Modification Request Backend

**New files:**
- `backend/src/repositories/modification-request-repository.ts` — `create`, `findById`, `findPendingByOrder`, `review`
- `backend/src/services/modification-request-service.ts` — `create`, `review`, `getPendingByOrder`
- `backend/src/types/modification-request.types.ts`
- `backend/src/validators/modification-request-schemas.ts` — `CreateModRequestSchema`, `ReviewModRequestSchema`
- `backend/src/controllers/modification-request-controller.ts`
- `backend/src/routes/modification-request-routes.ts`:
  - `POST /orders/:orderId/modification-requests` (WAITER)
  - `GET /orders/:orderId/modification-requests` (WAITER, CHEF, BARISTA, KITCHEN_DISPLAY, BARISTA_DISPLAY, MANAGER)
  - `PATCH /modification-requests/:id/review` (CHEF, BARISTA, KITCHEN_DISPLAY, BARISTA_DISPLAY)

Register in `backend/src/routes/index.ts`.

**Modification request create logic:**
- Waiter must own the order
- Order must be IN_PROGRESS (at least one ticket claimed)
- No other PENDING modification request on this order
- Creates record, emits `modification:requested` to relevant station rooms
- Logs incident

**Review logic:**
- Chef/barista at the correct station can approve or reject
- On APPROVE: emit `modification:reviewed` (status: APPROVED) to waiter — waiter can now edit
- On REJECT: emit `modification:reviewed` (status: REJECTED) with note to waiter
- Log incident for both

### 4.2 Update Order Modification Gating

**File:** `backend/src/services/order-service.ts`

Modify `updateItems`:
- If all tickets PENDING: allow direct edit (existing flow, with ownership check from Batch 2)
- If any ticket non-PENDING: check if there's an APPROVED modification request for this order. If yes, allow edit (and mark request as consumed). If no, return 409 with message: "Order is being prepared. Submit a modification request."

### 4.3 Socket Events for Modification

**File:** `backend/src/sockets/socket-service.ts`

Add:
- `emitModificationRequested(organizationId, stations, payload)` — to station rooms
- `emitModificationReviewed(waiterId, payload)` — to waiter user room

### 4.4 Idempotency Key

**New file:** `backend/src/repositories/idempotency-repository.ts` — `findByKey`, `create`, `pruneOlderThan`

**File:** `backend/src/services/order-service.ts`

Modify `create`: accept optional `idempotencyKey` param. If provided, check for existing key → return existing order. After creation, store key. Prune keys older than 60s lazily on each call (or via BullMQ scheduled task).

**File:** `backend/src/controllers/order-controller.ts`

Extract `X-Idempotency-Key` header from request, pass to service.

**File:** `frontend/lib/apiClient.ts`

Add optional `headers` parameter to `request` and `post`:
```typescript
post: <T>(path: string, body: unknown, token?: string, extraHeaders?: Record<string, string>): Promise<T>
```

**File:** `frontend/services/orderService.ts`

Update `create` to generate `crypto.randomUUID()` and pass as `X-Idempotency-Key` header.

### Verification — Batch 4
- Test: create mod request on IN_PROGRESS order succeeds
- Test: create mod request on PENDING order fails (400)
- Test: approve mod request allows waiter to edit
- Test: reject mod request blocks waiter edit
- Test: duplicate mod request on same order fails
- Test: idempotent creation returns same order on duplicate key
- Test: stale idempotency keys are pruned

---

## Batch 5: Frontend Updates

**Goal:** Surface all new backend features in the UI.

### 5.1 Socket Reconnect Fix

**File:** `frontend/hooks/useActiveOrders.ts` (line ~74)

In `onReconnect` callback, add room re-joins before reload:
```typescript
joinBranchRoom(organizationId);
joinUserRoom(userId);
```

**File:** `frontend/hooks/usePrepTickets.ts` (line ~99)

In `onReconnect` callback, add:
```typescript
joinStationRoom(organizationId, station);
```

### 5.2 Type Updates

**File:** `frontend/types/order.ts`

- Add `'REJECTED'` to `PrepTicketStatus`
- Add `cancelReason`, `cancelledBy` to `OrderSummary` and `OrderDetail`
- Add `rejectedReason`, `rejectedBy`, `rejectedAt` to `PrepTicketDetail` and `PrepTicketSummary`

**File:** `frontend/types/socket.ts`

Add new `ServerToClientEvents`:
- `ticket:rejected`, `ticket:unclaimed`, `order:force_cancelled`
- `modification:requested`, `modification:reviewed`
- `incident:new`

### 5.3 Cancellation UI

**New file:** `frontend/components/orders/CancelOrderSheet.tsx`

Bottom sheet with:
- Radio group for 6 predefined reasons
- Conditional text input when "Other" selected
- "Cancel Order" confirmation button (red/destructive)

**File:** `frontend/components/orders/OrderDetailBottomSheet.tsx`

- Add "Cancel Order" button (visible when order is PENDING and user is creator, or user is MANAGER for any non-terminal status)
- Opens `CancelOrderSheet`
- Add `onCancel` callback prop

**File:** `frontend/services/orderService.ts`

Update `cancel` to accept `{ reason, reasonDetail? }` instead of just `reason` string.

**File:** `frontend/app/app/orders/page.tsx`

Wire up cancel action from order detail.

### 5.4 KDS Reject + Unclaim

**File:** `frontend/services/prepTicketService.ts`

Add:
- `reject(id, reason, accessToken)` — PATCH `/prep-tickets/{id}/reject`
- `unclaim(id, accessToken)` — PATCH `/prep-tickets/{id}/unclaim`

**File:** `frontend/components/ui/KDSCard.tsx`

- Add "Reject" button on PENDING and IN_PROGRESS tickets
- Add "Unclaim" button on IN_PROGRESS tickets (show only within 2 min of claim — compare `claimedAt`)

**New file:** `frontend/components/kitchen/RejectTicketSheet.tsx`

Bottom sheet with reason text input + confirm button.

**File:** `frontend/components/kitchen/DisplayBoard.tsx`

- Wire up reject and unclaim handlers
- Add loading states for reject/unclaim actions

**File:** `frontend/store/kitchenStore.ts`

- Update `partitionTickets` to handle REJECTED status (exclude from active columns)

**File:** `frontend/hooks/usePrepTickets.ts`

- Add socket handlers for `ticket:rejected` (remove from store), `ticket:unclaimed` (move back to pending)
- Add handler for `order:force_cancelled` (remove tickets)

### 5.5 Modification Request UI

**New file:** `frontend/services/modificationRequestService.ts`

- `create(orderId, description, token)`, `getPending(orderId, token)`, `review(requestId, status, reviewNote, token)`

**New file:** `frontend/components/orders/ModificationRequestSheet.tsx`

Bottom sheet for waiters: text area for description, submit button.

**File:** `frontend/components/orders/OrderDetailBottomSheet.tsx`

- When order is IN_PROGRESS: show "Request Modification" button instead of "Edit Order"
- When modification was approved: show "Edit Order" button again

**New file:** `frontend/components/kitchen/ModificationRequestBadge.tsx`

Small overlay/badge on KDS card when there's a pending modification request. Shows description + Approve/Reject buttons.

**File:** `frontend/components/kitchen/DisplayBoard.tsx`

- Fetch pending mod requests for visible tickets
- Show ModificationRequestBadge on relevant cards
- Handle socket `modification:requested` event

**File:** `frontend/hooks/useActiveOrders.ts`

- Add socket handler for `modification:reviewed` to show toast notification

### 5.6 Edit Order Page Fix

**File:** `frontend/app/app/orders/[id]/edit/page.tsx`

- Only accessible when order is PENDING (all tickets PENDING) OR when a modification request was approved
- Improve UX: show current items with inline +/- quantity controls, remove button, and "Add Items" to browse menu
- Add clear feedback when order is locked

### 5.7 KDS Station Label

**File:** `frontend/components/kitchen/DisplayBoard.tsx`

In the tablet layout `<TopBar>`: add station label prop:
```tsx
<TopBar branchName={organizationName} stationLabel={station === 'KITCHEN' ? 'Kitchen Display' : 'Barista Display'} ... />
```

**File:** `frontend/components/ui/TopBar.tsx` (if it doesn't already support a subtitle/label)

Add optional `stationLabel` prop, render below or beside branch name.

### 5.8 Notification Policy Updates

**File:** `frontend/lib/notifications/types.ts`

Add new event types.

**File:** `frontend/lib/notifications/policy.ts`

Add policies for: `ticket:rejected` (waiter gets toast+sound), `order:force_cancelled` (waiter gets toast+sound), `modification:requested` (prep role gets toast+sound), `modification:reviewed` (waiter gets toast).

**File:** `frontend/hooks/useNotifications.ts`

Wire up new socket events to `dispatchNotificationEvent`.

### 5.9 History Page — REJECTED Status

**File:** `frontend/app/app/history/page.tsx` (line ~20)

Add REJECTED to `prepStatusVariantMap`:
```typescript
REJECTED: 'cancelled', // or a new variant
```

### Verification — Batch 5
- Manual: socket reconnect → rooms re-joined, events flow
- Manual: cancel order as waiter (PENDING) with each reason type
- Manual: manager force-cancel IN_PROGRESS order
- Manual: KDS reject ticket → waiter notified
- Manual: KDS unclaim ticket within 2 min → ticket returns to PENDING
- Manual: waiter requests modification → KDS shows badge → chef approves → waiter can edit
- Manual: KDS station label visible on tablet layout
- `pnpm typecheck` and `pnpm build` pass in frontend

---

## Batch 6: Manager Incident Log Page + Documentation

**Goal:** Manager-facing incident visibility + update project docs.

### 6.1 Incident Log Frontend

**New file:** `frontend/types/incident.ts`

```typescript
export type IncidentType = 'ORDER_CANCELLED' | 'TICKET_REJECTED' | 'MODIFICATION_REQUESTED' | 'MODIFICATION_APPROVED' | 'MODIFICATION_REJECTED' | 'TICKET_UNCLAIMED' | 'ORDER_STALE';
export interface Incident { id, orderId, type, actor: { id, name }, details: Record<string, unknown>, createdAt }
```

**New file:** `frontend/services/incidentService.ts`

- `getMany(params, token)` — GET `/incidents?type=...&startDate=...&endDate=...&page=...`

**New file:** `frontend/app/app/manage/incidents/page.tsx`

Manager page:
- Date range filter, incident type dropdown, pagination
- List of incident cards showing: timestamp, type badge, order number, actor name, details summary
- Tap to expand full details
- Real-time: new incidents appear at top via `incident:new` socket event

**New file:** `frontend/store/incidentStore.ts`

```typescript
interface IncidentStore { unreadCount: number; incrementUnread: () => void; resetUnread: () => void; }
```

### 6.2 Navigation Badge

**File:** Identify the nav/sidebar component used for MANAGER layout

- Add badge on "Incidents" nav item showing `unreadCount` from `incidentStore`
- Reset count when navigating to incidents page
- Increment on `incident:new` socket event (wire in `useNotifications` or a dedicated hook)

### 6.3 Documentation Updates

**File:** `docs/context/PHASE_3_CONTEXT.md`

Add a section documenting the lifecycle redesign:
- New models added
- New API endpoints
- Updated status transitions
- Ownership model

**File:** `docs/API_CONTRACT.md`

Add documentation for new endpoints:
- `PATCH /prep-tickets/:id/reject`
- `PATCH /prep-tickets/:id/unclaim`
- `POST /orders/:orderId/modification-requests`
- `GET /orders/:orderId/modification-requests`
- `PATCH /modification-requests/:id/review`
- `GET /incidents`

**File:** `docs/DATA_MODEL.md`

Add new models: `OrderModificationRequest`, `IncidentLog`, `IdempotencyKey`. Document new columns on Order and PrepTicket.

### Verification — Batch 6
- Manual: incidents page loads, filters work, pagination works
- Manual: cancellation creates incident → appears on page in real-time
- Manual: nav badge increments on new incident
- All docs updated and accurate
- Final: `pnpm build` passes in both backend and frontend
- Final: `pnpm test` passes in backend

---

## New Files Summary

### Backend (13 new files)
1. `backend/prisma/migrations/YYYYMMDD_order_lifecycle_redesign/migration.sql`
2. `backend/src/repositories/incident-repository.ts`
3. `backend/src/repositories/modification-request-repository.ts`
4. `backend/src/repositories/idempotency-repository.ts`
5. `backend/src/services/incident-service.ts`
6. `backend/src/services/modification-request-service.ts`
7. `backend/src/types/incident.types.ts`
8. `backend/src/types/modification-request.types.ts`
9. `backend/src/validators/incident-schemas.ts`
10. `backend/src/validators/modification-request-schemas.ts`
11. `backend/src/controllers/incident-controller.ts`
12. `backend/src/controllers/modification-request-controller.ts`
13. `backend/src/routes/incident-routes.ts`
14. `backend/src/routes/modification-request-routes.ts`

### Frontend (10 new files)
1. `frontend/components/orders/CancelOrderSheet.tsx`
2. `frontend/components/orders/ModificationRequestSheet.tsx`
3. `frontend/components/kitchen/RejectTicketSheet.tsx`
4. `frontend/components/kitchen/ModificationRequestBadge.tsx`
5. `frontend/services/modificationRequestService.ts`
6. `frontend/services/incidentService.ts`
7. `frontend/types/incident.ts`
8. `frontend/store/incidentStore.ts`
9. `frontend/app/app/manage/incidents/page.tsx`
10. `frontend/types/modificationRequest.ts` (if needed separate from incident types)

### Modified Files (key ones)
- `backend/prisma/schema.prisma`
- `backend/src/repositories/order-repository.ts` — race fixes, findActive bounding, cancelledBy include
- `backend/src/repositories/prep-ticket-repository.ts` — reject, unclaim methods
- `backend/src/services/order-service.ts` — ownership, cancel redesign, updateItems gating, idempotency
- `backend/src/services/prep-ticket-service.ts` — reject, unclaim methods
- `backend/src/controllers/order-controller.ts` — cancel reason passthrough, idempotency header
- `backend/src/controllers/prep-ticket-controller.ts` — reject, unclaim handlers
- `backend/src/validators/order-schemas.ts` — cancel schema redesign, reject/unclaim schemas
- `backend/src/sockets/socket-service.ts` — all new events
- `backend/src/routes/order-routes.ts` — no route changes needed
- `backend/src/routes/prep-ticket-routes.ts` — 2 new routes
- `backend/src/routes/index.ts` — register new route modules
- `backend/src/types/order.types.ts` — cancelReason, cancelledBy fields
- `backend/src/services/fcm-service.ts` — new push methods
- `frontend/lib/apiClient.ts` — add optional extra headers param
- `frontend/types/order.ts` — REJECTED status, cancel fields
- `frontend/types/socket.ts` — new events
- `frontend/services/orderService.ts` — cancel params, idempotency key
- `frontend/services/prepTicketService.ts` — reject, unclaim methods
- `frontend/store/kitchenStore.ts` — handle REJECTED
- `frontend/store/orderStore.ts` — no structural changes needed
- `frontend/hooks/useActiveOrders.ts` — socket reconnect room re-join, new event handlers
- `frontend/hooks/usePrepTickets.ts` — socket reconnect room re-join, new event handlers
- `frontend/hooks/useNotifications.ts` — new event dispatch
- `frontend/lib/notifications/types.ts` — new event types
- `frontend/lib/notifications/policy.ts` — new policies
- `frontend/components/orders/OrderDetailBottomSheet.tsx` — cancel/modify buttons
- `frontend/components/ui/KDSCard.tsx` — reject/unclaim buttons
- `frontend/components/kitchen/DisplayBoard.tsx` — new handlers, station label, mod request overlay
- `frontend/app/app/orders/[id]/edit/page.tsx` — UX improvements
- `frontend/app/app/history/page.tsx` — REJECTED status handling
- `docs/context/PHASE_3_CONTEXT.md`
- `docs/API_CONTRACT.md`
- `docs/DATA_MODEL.md`
