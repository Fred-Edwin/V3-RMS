# Phase 8 — Customer Discount Feature

**Status:** Complete  
**Implemented:** 2026-04-10

---

## Overview

Directors can define named discount types (percentage or fixed amount), scoped to all branches or a specific branch. Waiters apply discounts at checkout via a discount picker. Discounts that require approval enter an `AWAITING_AUTHORIZATION` state — managers approve/reject via a dashboard widget (same UX as staff discount and house account auth flows). Auto-apply discounts are applied instantly with no interruption to the checkout flow.

Staff discount (30%) remains unchanged and coexists with customer discounts.

---

## Data Model

### New tables

**`discounts`**
```
id                UUID PK
organization_id   UUID FK → organizations (nullable — null = all branches)
name              TEXT
type              DiscountType  (PERCENTAGE | FIXED_AMOUNT)
value             DECIMAL(10,2)
requires_approval BOOLEAN
is_active         BOOLEAN default true
created_by_id     UUID FK → users
created_at        TIMESTAMPTZ
updated_at        TIMESTAMPTZ
```

**`customer_discount_auth_requests`**
```
id                UUID PK
organization_id   UUID FK → organizations
order_id          UUID FK → orders
discount_id       UUID FK → discounts
requested_by_id   UUID FK → users
discount_percent  DECIMAL(5,2) nullable
discount_fixed    DECIMAL(10,2) nullable
original_amount   DECIMAL(10,2)
discount_amount   DECIMAL(10,2)
status            CustomerDiscountAuthStatus (PENDING | APPROVED | REJECTED)
resolved_by_id    UUID FK → users nullable
resolved_at       TIMESTAMPTZ nullable
created_at        TIMESTAMPTZ
updated_at        TIMESTAMPTZ
```

### Modified tables

**`orders`**: added `discount_id UUID FK → discounts` (nullable). Distinguishes customer discounts (`discount_id IS NOT NULL`) from staff discounts (`discount_id IS NULL, discounted_by_id IS NOT NULL`).

### Migrations
- `backend/prisma/migrations/20260410100000_add_discounts_table/migration.sql`
- `backend/prisma/migrations/20260410110000_add_customer_discount_auth_request/migration.sql`

---

## API Endpoints

### Discount Management (Director only for write)

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/discounts` | WAITER, MANAGER, DIRECTOR | List discounts. Waiters see active only; others see all. |
| POST | `/discounts` | DIRECTOR | Create a discount |
| PATCH | `/discounts/:discountId` | DIRECTOR | Update a discount |
| DELETE | `/discounts/:discountId` | DIRECTOR | Soft-deactivate a discount |

### Customer Discount Auth

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/customer-discount-auth` | MANAGER, DIRECTOR | List pending requests |
| GET | `/customer-discount-auth/:authRequestId` | MANAGER, DIRECTOR | Get single request |
| GET | `/orders/:orderId/customer-discount-auth` | WAITER, MANAGER, DIRECTOR | Get pending request for an order |
| POST | `/customer-discount-auth/:authRequestId/override` | MANAGER, DIRECTOR | Approve or reject |

### Modified Endpoint

**`POST /orders/:orderId/payment`** — added optional `applyDiscountId: string (uuid)`. Mutually exclusive with `applyStaffDiscount`. Cannot be combined with house/corporate/credit payment methods.

---

## Service Logic

### Discount scoping

`organizationId: null` = all branches. `findByBranch` returns `OR: [{ organizationId: branchId }, { organizationId: null }]` — both branch-specific and all-branch discounts.

### Auto-apply vs approval flow

In `customerDiscountAuthService.createAuthRequest`:
- If `discount.requiresApproval = false`: calls `orderRepository.applyDiscount` directly (order stays `READY`). No auth request created.
- If `discount.requiresApproval = true`: creates `CustomerDiscountAuthRequest`, transitions order to `AWAITING_AUTHORIZATION`, emits `order:customer_discount_pending` socket event.

### AWAITING_AUTHORIZATION disambiguation

When an order is in `AWAITING_AUTHORIZATION`, there are three possible causes:
1. **Customer discount** — `order.discountId IS NOT NULL` → try `customerDiscountAuthService.getPendingByOrderId`
2. **Staff discount** — `order.discountId IS NULL` and `staffDiscountAuthService.getPendingByOrderId` succeeds
3. **House account** — fall through to `houseAccountAuthService.getPendingByOrderId`

### Report disambiguation

Staff discounts: `WHERE discountId IS NULL AND discountedById IS NOT NULL`  
Customer discounts: `WHERE discountId IS NOT NULL`  
Both are reported separately in `DailySummaryReport` (`staffDiscountTotal`, `customerDiscountTotal`).

---

## Socket Events

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `order:customer_discount_pending` | Server → Client | `{ orderId, authRequestId, discountName, dailyNumber }` | Emitted when approval required. Sent to manager userRoom + branch room |
| `order:customer_discount_resolved` | Server → Client | `{ orderId, dailyNumber, approved, discountedTotal? }` | Emitted on approve/reject. Sent to requesting waiter's userRoom + branch room |

---

## Frontend Changes

### New pages/components

- **`/app/admin/discounts`** — Director CRUD: create/edit/deactivate discount types. Scope dropdown (all branches vs specific branch). `requiresApproval` toggle.

### Modified components

- **`OrderDetailBottomSheet`** — replaced single "Staff Discount (30%)" checkbox with a unified radio-button discount picker. Shows staff discount (owner only) + all available customer discounts. Each option shows savings amount and whether approval is needed. Confirm button label updates based on selection.

- **`/app/orders/page.tsx`** — loads available discounts on mount, socket listener for `order:customer_discount_resolved`, `handleOpenOrder` uses `order.discountId` to disambiguate `AWAITING_AUTHORIZATION` orders, `handleCustomerDiscountOverride` handler.

- **`/app/manage/dashboard/page.tsx`** — added "Customer Discount Requests" widget (same UX as staff discount widget). Loads pending on mount, synced via socket.

---

## Key Files

```
backend/src/
  types/discount.types.ts
  validators/discount-schemas.ts
  repositories/discount-repository.ts
  repositories/customer-discount-auth-repository.ts
  services/discount-service.ts
  services/customer-discount-auth-service.ts
  controllers/discount-controller.ts
  controllers/customer-discount-auth-controller.ts
  routes/discount-routes.ts
  routes/customer-discount-auth-routes.ts
  services/discount-service.test.ts
  services/customer-discount-auth-service.test.ts

frontend/
  types/discount.ts
  services/discountService.ts
  services/customerDiscountAuthService.ts
  app/app/admin/discounts/page.tsx
  components/orders/OrderDetailBottomSheet.tsx (modified)
  app/app/orders/page.tsx (modified)
  app/app/manage/dashboard/page.tsx (modified)
```

---

## Testing Accounts (Local Seed)

Assumes seed data from `seed-admin.js`:
- **Director**: can access `/app/admin/discounts`
- **Manager**: sees pending discount widgets on `/app/manage/dashboard`
- **Waiter**: sees discount picker when closing orders on `/app/orders`
