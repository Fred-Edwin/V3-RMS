# Staff Discount Feature — Context (Post-Phase 8 Addendum)

This feature was implemented as an addendum after Phase 8 completed. It integrates the 30% employee discount into the RMS with a manager approval gate, mirroring the House Account deferred-authorization pattern.

---

## Status
- [x] Complete (implemented 2026-04-10)

---

## What This Feature Does

Staff at Wendo Coffee Bistro receive a 30% discount on their own purchases. The flow:

1. Waiter opens a READY order they created themselves and selects "Staff Discount (30%)" checkbox in the payment sheet
2. Waiter submits — order transitions to `AWAITING_AUTHORIZATION`; socket notifies branch managers
3. Manager sees the pending request in a widget on the Manager Dashboard and taps Approve or Reject
4. On **Approve**: discount is written to the order, order returns to `READY` at the discounted total; waiter pays normally
5. On **Reject**: order returns to `READY` at full price; no discount applied

---

## Files Created

| File | Purpose |
|------|---------|
| `backend/prisma/migrations/20260410080000_add_order_discount_fields/migration.sql` | Adds `discount_percent`, `discount_amount`, `discounted_by_id` (TEXT FK) to `orders` |
| `backend/prisma/migrations/20260410090000_add_staff_discount_auth_request/migration.sql` | Creates `StaffDiscountAuthStatus` enum + `staff_discount_auth_requests` table |
| `backend/src/types/staff-discount-auth.types.ts` | TypeScript interface for auth request record + `STAFF_DISCOUNT_PERCENT = 30` constant |
| `backend/src/validators/staff-discount-auth-schemas.ts` | Zod schema for `decision` input (`APPROVED` \| `REJECTED`) |
| `backend/src/repositories/staff-discount-auth-request-repository.ts` | `create`, `findById`, `findPendingByOrderId`, `findPendingByOrganization`, `resolveIfPending` (atomic) |
| `backend/src/services/staff-discount-auth-service.ts` | `createAuthRequest`, `managerApprove`, `_applyDecision` |
| `backend/src/controllers/staff-discount-auth-controller.ts` | Thin controller: `listPending`, `getById`, `getPendingByOrderId`, `override` |
| `backend/src/routes/staff-discount-auth-routes.ts` | 4 routes (see API section below) |
| `backend/src/services/staff-discount-auth-service.test.ts` | 9 service tests |
| `frontend/types/staffDiscountAuth.ts` | Frontend types mirroring backend |
| `frontend/services/staffDiscountAuthService.ts` | `listPending`, `getById`, `getPendingByOrderId`, `override` |

---

## Files Modified

| File | Change |
|------|--------|
| `backend/prisma/schema.prisma` | Added discount fields to `Order`; back-relations on `User` ("OrderDiscountedBy") and `Organization`; `StaffDiscountAuthStatus` enum; `StaffDiscountAuthRequest` model with back-relations on `User` x2 and `Order` |
| `backend/src/validators/order-schemas.ts` | Added `applyStaffDiscount: z.boolean().optional()` to `RecordPaymentSchema`; superRefine rejects if combined with credit payment methods |
| `backend/src/services/order-service.ts` | Handles `applyStaffDiscount: true` flag in `recordPayment` — delegates to `staffDiscountAuthService.createAuthRequest` and returns early; `serializeOrder` now includes `discountPercent`, `discountAmount`, `discountedById` |
| `backend/src/repositories/order-repository.ts` | Added `applyDiscount(orderId, organizationId, discountPercent, discountAmount, discountedById)` — decrements total in-place using `Prisma.Decimal`, writes discount fields |
| `backend/src/sockets/socket-service.ts` | Added `emitStaffDiscountAuthPending` (event: `order:staff_discount_pending`) and `emitStaffDiscountAuthResolved` (event: `order:staff_discount_resolved`); both emit to `userRoom(waiterId)` + `branchRoom(organizationId)` |
| `backend/src/routes/index.ts` | Registered `staffDiscountAuthRoutes` |
| `backend/src/types/report.types.ts` | Added `staffDiscountTotal: string` and `staffDiscountOrderCount: number` to `DailySummaryReport`; `staffDiscountTotal: string` to `BranchOverviewRow` |
| `backend/src/repositories/report-repository.ts` | `getDailySummaryByDate` aggregates `discountAmount` on closed orders; `getBranchOverview` adds `staffDiscountTotal` per branch |
| `backend/src/services/order-service.test.ts` | Extended: mock for `staffDiscountAuthService`; test for `applyStaffDiscount: true` path |
| `backend/src/services/report-service.test.ts` | Added `staffDiscountTotal: '0.00'` and `staffDiscountOrderCount: 0` to `sampleDailySummary` fixture |
| `frontend/types/order.ts` | Added `discountPercent: string \| null`, `discountAmount: string \| null`, `discountedById: string \| null` to `OrderDetail` |
| `frontend/types/report.ts` | Added `staffDiscountTotal`, `staffDiscountOrderCount` to `DailySummary`; `staffDiscountTotal` to `BranchOverviewRow` |
| `frontend/types/socket.ts` | Added `order:staff_discount_pending` and `order:staff_discount_resolved` to `ServerToClientEvents` |
| `frontend/components/orders/OrderDetailBottomSheet.tsx` | Discount toggle checkbox; amber preview card; manager Approve/Reject inline buttons; discount display on closed orders |
| `frontend/app/app/orders/page.tsx` | State + handlers for staff discount flow; socket listener for `order:staff_discount_resolved`; `handleOpenOrder` tries staff discount fetch before house account |
| `frontend/app/app/manage/dashboard/page.tsx` | Staff Discount Authorizations widget with real-time Approve/Reject; socket listeners for pending/resolved events |

---

## API Routes

```
GET  /staff-discount-auth                              MANAGER, DIRECTOR           — list pending requests for branch
GET  /staff-discount-auth/:authRequestId               MANAGER, DIRECTOR, WAITER, CHEF, BARISTA, ACCOUNTANT
GET  /orders/:orderId/staff-discount-auth              MANAGER, DIRECTOR, WAITER, CHEF, BARISTA
POST /staff-discount-auth/:authRequestId/override      MANAGER, DIRECTOR           — approve or reject
```

---

## Socket Events

| Event | Direction | Payload | Recipients |
|-------|-----------|---------|------------|
| `order:staff_discount_pending` | Server → Client | `{ orderId, dailyNumber, authRequestId, originalAmount, discountAmount }` | `userRoom(waiterId)` + `branchRoom(organizationId)` |
| `order:staff_discount_resolved` | Server → Client | `{ orderId, dailyNumber, approved, discountedTotal? }` | `userRoom(waiterId)` + `branchRoom(organizationId)` |

---

## Data Stored

**`orders` table** (on every approved+closed discounted order):
- `discount_percent` — always `30.00`
- `discount_amount` — KES amount saved
- `discounted_by_id` — manager who approved
- `total` — already reflects the post-discount amount

**`staff_discount_auth_requests` table** (every request, approved or rejected):
- `requested_by_id` — staff member who requested
- `resolved_by_id` — manager who decided
- `status` — `PENDING` / `APPROVED` / `REJECTED`
- `original_amount`, `discount_amount` — for audit
- `created_at`, `resolved_at` — timestamps

**Report surfaces:**
- `staffDiscountTotal` + `staffDiscountOrderCount` in Daily Summary
- `staffDiscountTotal` per branch in Branch Overview

---

## Key Design Decisions

**New `StaffDiscountAuthRequest` table (not reusing `HouseAccountAuthRequest`)**: House Account carries `houseAccountId` FK and credit-balance write logic. Mixing the two flows would add nullable FK coupling and make both harder to reason about. A separate table keeps each authorization path isolated.

**Manager approves inline in the Dashboard widget (not a separate page)**: Managers are physically on-site. The House Account pattern requires navigating to an external flow because the account holder approves from their own device. Staff discounts are a manager decision made at the POS — an inline widget is faster and more appropriate.

**Discount applied at approval time, not request time**: The order's `total` is decremented only when the manager approves. The DB is never in a state where the discount is "pending but the total is wrong." If rejected, no discount fields are written at all.

**Post-approval flow — order returns to READY, waiter pays normally**: Avoids storing payment method at request time. The waiter simply re-submits payment (MPESA/Cash) at the now-reduced total. Simpler than holding payment intent across an async gap.

**`discounted_by_id` is TEXT not UUID**: All `id` columns in this project are `TEXT` (Prisma UUIDs stored as strings). The initial migration SQL incorrectly used `UUID` type — corrected to `TEXT` before pushing to production. The migration file is authoritative.

**`applyStaffDiscount` rejected for credit payment methods**: If a waiter selects House Account, Corporate Account, or Customer Credit alongside a discount request, the Zod superRefine rejects with a validation error. Discounts only apply to cash-collectible payments.

**AWAITING_AUTHORIZATION disambiguation**: An order can be `AWAITING_AUTHORIZATION` for either a House Account charge or a Staff Discount request. The frontend `handleOpenOrder` tries `staffDiscountAuthService.getPendingByOrderId` first; on 404, falls back to `houseAccountAuthService.getPendingByOrderId`. The two paths render different UI sections in `OrderDetailBottomSheet`.

---

## Blockers / Issues Encountered

**Local DB drift from inventory branch**: The local Postgres instance had a `20260322072523_add_inventory_v2` migration recorded in `_prisma_migrations` that does not exist in the current branch. `prisma migrate deploy` refused to apply the new migrations, reporting drift. **Fix**: ran `prisma migrate resolve --applied` for both new migrations (marks them as applied in the migrations table without running SQL), then manually executed the migration SQL via `psql` directly.

**`UUID` vs `TEXT` column type mismatch**: The migration SQL used `UUID` for `discounted_by_id` and the `staff_discount_auth_requests.id` column, but the `users.id` PK is `TEXT`. The FK constraint failed with "incompatible types." **Fix**: changed both to `TEXT` in the migration SQL files and re-ran via `psql`.

**Container running stale compiled image**: After adding new routes and report repository changes, the running `wendo-api` container served old JS from its `dist/` directory. Daily summary and staff-discount-auth endpoints returned 500. **Fix**: `docker compose build api && docker compose up -d api worker`. Always rebuild the container after backend changes before testing locally.

**Prisma Decimal `toString()` drops trailing zeros**: `new Prisma.Decimal('300.00').toString()` returns `'300'`, not `'300.00'`. Three test assertions in `staff-discount-auth-service.test.ts` expected `'300.00'` — corrected to `'300'`.
