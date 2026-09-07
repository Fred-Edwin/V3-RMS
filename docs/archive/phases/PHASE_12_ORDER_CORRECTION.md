# Phase 12 — Order Correction Console

**Status**: Complete  
**Implemented**: 2026-05-14  
**Role**: SYSTEM_ADMIN only

---

## Why This Feature Exists

Before Phase 12, all order corrections (wrong M-Pesa code, wrong payment method, ghost-blocked order status) required direct SSH access to the production PostgreSQL database — unaudited, risky, and only accessible to engineers. Phase 12 provides a safe, audited UI where every change is permanently logged to `incident_logs` with `type: ORDER_CORRECTION`.

---

## Feature Scope

### Order list (left pane)
- Lists orders across **all branches** — intentionally no `organizationId` filter (SYSTEM_ADMIN cross-branch view)
- Filterable by branch, status, date range, and free-text search
- Paginated (default 50/page)

### Detail sheet (right split pane, fixed 420px)
Opens on row click. Shows:
- 2-line header: order number + status badge / branch + table + date + waiter
- Items table (always visible)
- Single action dropdown (only shows applicable corrections)
- Inline form appears below for selected action
- Audit tab: timeline of all corrections applied to this order

### Corrections available
| Action | Guard |
|---|---|
| Correct M-Pesa code | Order is CLOSED + paid by MPESA/SPLIT/GUEST_SPLIT |
| Change payment method | Order is CLOSED |
| Force order READY | IN_PROGRESS + ≥1 REJECTED ticket + all non-REJECTED already READY |
| Revert AWAITING_AUTHORIZATION | AWAITING_AUTHORIZATION + pending HouseAccountAuthRequest exists |
| Remove item | Not CANCELLED/PENDING + order has >1 item |
| Adjust total | Not CANCELLED |

### Hard constraints
- 7-day correction window enforced in service layer
- Every correction atomically writes `IncidentLog` row (`type: ORDER_CORRECTION`)
- Can never delete an order
- Can never change who placed the order
- Reason field required (min 10 chars) on every action

---

## Files Added/Modified

### Backend
| File | Change |
|---|---|
| `backend/prisma/schema.prisma` | Added `ORDER_CORRECTION` to `IncidentType` enum |
| `backend/prisma/migrations/20260514100000_add_order_correction_incident_type/migration.sql` | `ALTER TYPE "IncidentType" ADD VALUE IF NOT EXISTS 'ORDER_CORRECTION'` |
| `backend/src/validators/order-correction-schemas.ts` | Zod schemas for all 7 endpoints + list query |
| `backend/src/repositories/order-correction-repository.ts` | Cross-branch findMany, findById, findAuditLog, 6 write methods (all transactional) |
| `backend/src/services/order-correction-service.ts` | Business logic + 7-day window guard |
| `backend/src/controllers/order-correction-controller.ts` | 9 thin handlers |
| `backend/src/routes/order-correction-routes.ts` | 9 routes, all `requireRole('SYSTEM_ADMIN')` |
| `backend/src/routes/index.ts` | Registered `orderCorrectionRoutes` |
| `backend/tests/order-correction.test.ts` | 35 tests: RBAC, happy paths, guard failures, validation |

### Frontend
| File | Change |
|---|---|
| `frontend/types/orderCorrection.ts` | TypeScript types for all API shapes |
| `frontend/services/orderCorrectionService.ts` | API client functions (9 methods) |
| `frontend/app/app/admin/order-corrections/page.tsx` | Order Correction Console page |
| `frontend/app/app/admin/page.tsx` | Added "Order Corrections" nav button |
| `frontend/components/ui/Table.tsx` | Added `onRowClick` and `getRowClassName` props |

---

## Key Technical Decisions

### Cross-branch list query
`findMany` in the repository omits `organizationId` when no `branchId` filter is passed. This is intentional — SYSTEM_ADMIN must see orders across all branches. All write operations include `organizationId` (pulled from the order record) for tenant safety.

### PATCH instead of DELETE for item removal
`apiClient.delete` has no body parameter. Item removal uses `PATCH /:id/items/:itemId/remove` so the mandatory reason can be transmitted.

### Decimal arithmetic
Item removal recalculates `subtotal` and `total` using `Decimal` arithmetic (`@prisma/client/runtime/library`) — never floating-point.

### Migration applied directly due to local DB drift
The local development database had extra tables from a parallel inventory branch (11 extra tables, extra enums). `prisma migrate dev` was blocked. The migration SQL was applied directly via `psql`, then `prisma generate` was run. The committed migration file ensures `prisma migrate deploy` works correctly on production.

### Force-ready guard (3 conditions must all be true)
1. Order is `IN_PROGRESS`
2. At least one prep ticket is `REJECTED`
3. All non-`REJECTED` tickets are already `READY`

This ensures force-ready is only used to bypass a ghost-rejected ticket — not to skip legitimate in-progress work.

### Revert-auth transaction
Atomically: deletes `HouseAccountAuthRequest` row + sets order status to `READY` + writes `IncidentLog`.

---

## API Reference

See `docs/API_CONTRACT.md` → "Order Correction Console (SYSTEM_ADMIN)" for full endpoint documentation.

---

## Test Coverage (`backend/tests/order-correction.test.ts`)

- 401 when no token provided
- 403 for waiter and chef on every endpoint (18 RBAC tests)
- 404 when order not found
- 409 for 7-day correction window exceeded (on mpesa, method, force-ready, revert-auth, adjust-total)
- 409 for guard failures (force-ready: wrong status, non-rejected not ready, no rejected; revert-auth: wrong status, no pending auth; remove-item: CANCELLED, last item)
- 400 for invalid Zod inputs (non-alphanumeric code, reason too short, negative total)
- 200 happy paths for all 9 endpoints
