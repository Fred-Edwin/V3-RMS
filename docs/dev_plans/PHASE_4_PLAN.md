# Phase 4 — Delivery Zones: Implementation Plan

## Context

Phase 3.5 is complete. The order creation flow supports DINE_IN, TAKE_AWAY, and DELIVERY types — but the DELIVERY path is a stub: there is no delivery zone management UI, no backend CRUD for zones, and the waiter create-order page does not render the zone selector or the pre-payment confirmation gate. The `DeliveryZone` model and FK on `Order` already exist in Prisma. The `deliveryZoneRepository` has one lookup method. The `CreateOrderSchema` already accepts `deliveryZoneId`. Phase 4 wires everything together.

## Feature Understanding

- **Manager** manages delivery zones (create, edit, deactivate) for their branch via `/app/manage/delivery-zones`.
- **Waiter** selects a delivery zone when placing a DELIVERY order. The zone's fee is added to the subtotal to form the total. Before submitting, the waiter confirms the customer has already paid via Mpesa (pre-payment gate — prep does not start until payment is confirmed).
- **Backend** enforces: zone must belong to the same branch, zone must be active, only MPESA is valid for delivery payment, delivery fee is snapshotted from the zone at order creation time.
- **Delete** (`DELETE /delivery-zones/:id`) is a soft-deactivate, blocked if the zone has associated orders.
- The create-order page already handles DELIVERY in its DTO type — it just needs the zone selector UI and the pre-payment confirmation sheet wired in.

---

## Numbered Task List

### Backend

1. Expand `deliveryZoneRepository` (`backend/src/repositories/delivery-zone-repository.ts`) with the following methods:
   - `findAllActiveByOrganization(organizationId)` — returns all active zones for a branch (used by GET /delivery-zones)
   - `create(organizationId, data: { name, fee })` — creates a new zone
   - `update(id, organizationId, data: { name?, fee?, isActive? })` — updates a zone (org-scoped)
   - `findById(id, organizationId)` — finds any zone (active or not) scoped to org (used by PATCH/DELETE)
   - `hasOrders(id)` — returns boolean, true if the zone has any associated orders (used by DELETE guard)

2. Create `backend/src/services/delivery-zone-service.ts` with:
   - `listZones(actor)` — calls `findAllActiveByOrganization` using `actor.organizationId`
   - `createZone(actor, input: { name, fee })` — creates zone; enforces actor has `organizationId`
   - `updateZone(actor, id, input: { name?, fee?, isActive? })` — updates zone; throws `NotFoundError` if not found
   - `deleteZone(actor, id)` — soft-deactivates; throws `ConflictError` if zone has orders (use `hasOrders`)

3. Create `backend/src/validators/delivery-zone-schemas.ts` with Zod schemas:
   - `CreateDeliveryZoneSchema`: `{ name: string (min 1, max 100), fee: string (regex decimal, positive) }`
   - `UpdateDeliveryZoneSchema`: all fields optional — `{ name?, fee?, isActive? }`
   - Export inferred types: `CreateDeliveryZoneInput`, `UpdateDeliveryZoneInput`

4. Create `backend/src/controllers/delivery-zone-controller.ts` with handlers:
   - `listZones` — calls service, responds `200` with array
   - `createZone` — validates body with `CreateDeliveryZoneSchema`, calls service, responds `201`
   - `updateZone` — validates `id` param + body with `UpdateDeliveryZoneSchema`, calls service, responds `200`
   - `deleteZone` — validates `id` param, calls service, responds `200`
   - Each handler: thin — validate → delegate → respond, no business logic

5. Create `backend/src/routes/delivery-zone-routes.ts`:
   - `GET /delivery-zones` — `authenticate, branchScope, requireRole('WAITER','CHEF','BARISTA','MANAGER','KITCHEN_DISPLAY','BARISTA_DISPLAY','DIRECTOR')` → `listZones`
   - `POST /delivery-zones` — `authenticate, branchScope, requireRole('MANAGER')` → `createZone`
   - `PATCH /delivery-zones/:id` — `authenticate, branchScope, requireRole('MANAGER')` → `updateZone`
   - `DELETE /delivery-zones/:id` — `authenticate, branchScope, requireRole('MANAGER')` → `deleteZone`

6. Register delivery zone routes in `backend/src/routes/index.ts` — add `import deliveryZoneRoutes` and `apiRouter.use(deliveryZoneRoutes)`

7. Validate delivery order enforcement in `backend/src/services/order-service.ts` — confirm `createOrder` already:
   - Validates `deliveryZoneId` belongs to the same `organizationId` using `deliveryZoneRepository.findActiveByIdAndOrganization`
   - Snapshots the zone `fee` into `Order.deliveryFee` at creation time
   - If anything is missing, add it now (do not defer)

8. Enforce Mpesa-only for delivery payment in `backend/src/services/order-service.ts` (`recordPayment`):
   - If `order.type === 'DELIVERY'` and `paymentMethod !== 'MPESA'`, throw `ValidationError('Delivery orders must be paid via Mpesa')`

9. Create integration tests in `backend/tests/delivery-zone.test.ts`:
   - `POST /delivery-zones` — manager creates for own branch → 201
   - `POST /delivery-zones` — WAITER role → 403
   - `GET /delivery-zones` — returns only active zones for branch
   - `PATCH /delivery-zones/:id` — manager updates, gets updated data
   - `DELETE /delivery-zones/:id` — zone with no orders → deactivated; zone with orders → 409
   - `POST /orders (DELIVERY)` — total = subtotal + zone fee
   - `POST /orders (DELIVERY)` — missing `deliveryZoneId` → 400
   - `POST /orders (DELIVERY)` — `deliveryZoneId` from another branch → 400 or 404
   - `PATCH /orders/:id/payment (DELIVERY)` — `CASH` → 400; `MPESA` → 200

---

### Frontend

10. Create `frontend/services/deliveryZoneService.ts`:
    - `DeliveryZone` type: `{ id: string; name: string; fee: string; isActive: boolean }`
    - `listZones(accessToken)` → `GET /delivery-zones` → `DeliveryZone[]`
    - `createZone(data: { name, fee }, accessToken)` → `POST /delivery-zones` → `DeliveryZone`
    - `updateZone(id, data: { name?, fee?, isActive? }, accessToken)` → `PATCH /delivery-zones/:id` → `DeliveryZone`
    - `deleteZone(id, accessToken)` → `DELETE /delivery-zones/:id` → void

11. Replace the stub in `frontend/app/app/manage/delivery-zones/page.tsx` with a full management UI:
    - `PageLayout` + `PageHeader` (title "Delivery Zones", subtitle "Manage delivery coverage and fee bands.")
    - `Table` component listing zones: Name, Fee (PriceDisplay), Status (Badge active/inactive), Actions column
    - "Add Zone" Button (Primary) in `PageHeader` action slot → opens create Modal
    - Create/Edit Modal (`Modal` component): Name `Input`, Fee `Input` (numeric), `isActive` `Toggle` (edit only)
    - Edit: pencil `IconButton` per row → pre-filled Modal → `PATCH`
    - Deactivate: `IconButton` per row → `ConfirmDialog` → `DELETE`; show error `Toast` on `ConflictError` (zone has orders)
    - Loading state: `SkeletonTable`; empty state: `EmptyState` ("No delivery zones yet" / "Add a zone to enable delivery orders")
    - All mutations use optimistic UI where appropriate; errors shown via `Toast`

12. Update `frontend/app/app/orders/new/page.tsx` to support DELIVERY order type:
    - Add `'DELIVERY'` option to the order type selector (alongside `'DINE_IN'` and `'TAKE_AWAY'`)
    - When `orderType === 'DELIVERY'`:
      - Show a `Select` dropdown for delivery zones (loaded from `deliveryZoneService.listZones` on mount, only when role is WAITER — zones always loaded regardless of type to avoid lag)
      - Show live fee + updated total in cart (derive from selected zone's `fee`)
      - `canSubmit` requires a `selectedZoneId` to be set
    - Wire `CreateOrderDelivery` DTO in `handleConfirmOrder`: `{ type: 'DELIVERY', deliveryZoneId: selectedZoneId, notes, items }`
    - Update `OrderConfirmBottomSheet` to accept and display delivery zone name and fee when order type is DELIVERY

13. Create a pre-payment confirmation sheet/modal for delivery orders:
    - Before `handleConfirmOrder` submits for DELIVERY orders, show a `BottomSheet` (mobile) titled "Confirm Payment"
    - Content: "Confirm the customer has paid KES [total] via Mpesa before sending to kitchen."
    - Two buttons: "Cancel" (Secondary) and "Confirm Payment & Submit" (Primary)
    - Only on confirm does the order POST fire
    - This gate is only shown for `orderType === 'DELIVERY'`; non-delivery orders skip it and go straight to submit

14. Update `frontend/types/order.ts` — add `DeliveryZone` type if not already exported (it's already in `OrderDetail` inline — extract it to a named export `DeliveryZoneSummary` and reuse in both `OrderDetail` and the delivery zone service)

---

## Critical Files

- `backend/src/repositories/delivery-zone-repository.ts` — expand
- `backend/src/services/delivery-zone-service.ts` — create
- `backend/src/validators/delivery-zone-schemas.ts` — create
- `backend/src/controllers/delivery-zone-controller.ts` — create
- `backend/src/routes/delivery-zone-routes.ts` — create
- `backend/src/routes/index.ts` — register routes
- `backend/src/services/order-service.ts` — verify/add delivery fee snapshotting + Mpesa enforcement
- `backend/tests/delivery-zone.test.ts` — create
- `frontend/services/deliveryZoneService.ts` — create
- `frontend/app/app/manage/delivery-zones/page.tsx` — replace stub
- `frontend/app/app/orders/new/page.tsx` — extend for DELIVERY type
- `frontend/types/order.ts` — minor type extraction

## Reuse

- `authenticate`, `branchScope`, `requireRole` middlewares — existing, reuse as-is
- `ConflictError`, `NotFoundError`, `ValidationError`, `ForbiddenError` from `backend/src/utils/errors.ts`
- `deliveryZoneRepository.findActiveByIdAndOrganization` — already called from `order-service.ts`; extend the same repository
- `Modal`, `ConfirmDialog`, `Table`, `SkeletonTable`, `EmptyState`, `Toast`, `Button`, `Input`, `Toggle`, `Badge`, `PageLayout`, `PageHeader` from `frontend/components/ui/`
- `apiClient` from `frontend/lib/apiClient.ts`
- Pattern for tests: mock service at module level with `vi.mock`, generate tokens with `signAccessToken` — same as `backend/tests/order.test.ts`

## Verification

1. Run `pnpm test` in `backend/` — all existing tests plus new `delivery-zone.test.ts` pass
2. Start backend + frontend dev servers
3. Log in as MANAGER → navigate to Delivery Zones → create zone "Kiganjo / KES 200", verify it appears in table
4. Edit zone fee, verify updated value shown
5. Deactivate zone, verify badge changes
6. Log in as WAITER → New Order → select DELIVERY type → zone dropdown appears with "Kiganjo" → select it → cart shows updated total with delivery fee
7. Tap Place Order → pre-payment confirmation sheet appears with correct total → confirm → order submitted → Toast "Order #X sent to the kitchen"
8. Attempt to record CASH payment on a DELIVERY order → expect 400 error
9. Attempt to POST /orders with DELIVERY type and no `deliveryZoneId` → expect 400
