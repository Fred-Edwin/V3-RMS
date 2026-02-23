# Phase 2 — Menu Management: Codex Task List

## Context
Phase 0 (foundation), Phase 1 (auth/branches/staff), and Phase 1.5 (component library) are complete.
All Prisma models for Phase 2 are already defined: `MenuCategory`, `MenuItem`, `BranchMenuItem`.
The `MenuItemCard` UI component already exists in `frontend/components/ui/`.
No menu backend endpoints or frontend pages exist yet.

**Goal:** Build the complete menu management vertical slice — backend endpoints, Redis caching, frontend pages, and tests.

---

## Overview

**Backend:** 9 menu API endpoints + Redis cache layer
**Frontend:** 2 pages — SA/Director menu management, Manager availability toggle
**Tests:** 6 integration tests + 1 unit test

---

## Numbered Task List for Codex

### BACKEND

**1. Read `docs/CODING_STANDARDS.md` (full) and `docs/API_CONTRACT.md` (menu sections) before writing any code.**

**2. Create `backend/src/validators/menu-schemas.ts`**
- Zod schema: `createCategorySchema` — `{ name: string, prepStation: PrepStation, displayOrder: number }`
- Zod schema: `updateCategorySchema` — partial of create
- Zod schema: `createItemSchema` — `{ name: string, description?: string, price: number, categoryId: string }`
- Zod schema: `updateItemSchema` — partial of create
- Zod schema: `availabilitySchema` — `{ isAvailable: boolean }`

**3. Create `backend/src/repositories/menu-repository.ts`**
- `findAllCategories(organizationId)` — all categories for org, ordered by displayOrder
- `findCategoryById(id, organizationId)` — single category
- `createCategory(data)` — insert MenuCategory
- `updateCategory(id, organizationId, data)` — update by id + org
- `deleteCategory(id, organizationId)` — delete by id + org
- `countActiveItemsInCategory(categoryId, organizationId)` — for delete guard
- `findAllItems(organizationId)` — all items with their category
- `findItemById(id, organizationId)` — single item
- `createItem(data)` — insert MenuItem
- `updateItem(id, organizationId, data)` — update by id + org
- `deleteItem(id, organizationId)` — soft or hard delete
- `findMenuWithBranchAvailability(organizationId, branchId)` — JOIN MenuCategory + MenuItem + BranchMenuItem, return merged availability
- `upsertBranchMenuItemAvailability(menuItemId, organizationId, branchId, isAvailable)` — upsert BranchMenuItem

**4. Create `backend/src/services/menu-service.ts`**
- `getMenu(organizationId, branchId)` — checks Redis cache first (`menu:{organizationId}:{branchId}`), falls back to repo, sets cache TTL 1h
- `getCategories(organizationId)` — list all categories
- `createCategory(organizationId, data)` — calls repo, returns created category
- `updateCategory(id, organizationId, data)` — calls repo, invalidates Redis cache for all branches of org
- `deleteCategory(id, organizationId)` — guards: calls `countActiveItems`, throws 409 AppError if > 0, then deletes
- `createItem(organizationId, data)` — calls repo, invalidates Redis cache
- `updateItem(id, organizationId, data)` — calls repo, invalidates Redis cache
- `deleteItem(id, organizationId)` — calls repo, invalidates Redis cache
- `setItemAvailability(menuItemId, organizationId, branchId, isAvailable)` — calls repo upsert, invalidates Redis cache key `menu:{organizationId}:{branchId}`

**5. Create `backend/src/controllers/menu-controller.ts`**
- `getMenu` — GET /menu: for MANAGER/WAITER/CHEF/BARISTA/display roles use `req.user.branchId` from token; for SYSTEM_ADMIN/DIRECTOR require `?branchId=` query param — return 400 `AppError` if missing
- `getCategories` — GET /menu/categories
- `createCategory` — POST /menu/categories: parses `createCategorySchema`, delegates to service
- `updateCategory` — PATCH /menu/categories/:id: parses `updateCategorySchema`
- `deleteCategory` — DELETE /menu/categories/:id
- `createItem` — POST /menu/items: parses `createItemSchema`
- `updateItem` — PATCH /menu/items/:id: parses `updateItemSchema`
- `deleteItem` — DELETE /menu/items/:id
- `setItemAvailability` — PATCH /menu/items/:id/availability: parses `availabilitySchema`

**6. Create `backend/src/routes/menu-routes.ts`**
- Mount all 9 endpoints under `/api/v1`
- Role guards:
  - `GET /menu` — all authenticated roles (WAITER, CHEF, BARISTA, MANAGER, DIRECTOR, SYSTEM_ADMIN, KITCHEN_DISPLAY, BARISTA_DISPLAY)
  - `GET /menu/categories` — MANAGER, DIRECTOR, SYSTEM_ADMIN
  - `POST /menu/categories` — SYSTEM_ADMIN, DIRECTOR
  - `PATCH /menu/categories/:id` — SYSTEM_ADMIN, DIRECTOR
  - `DELETE /menu/categories/:id` — SYSTEM_ADMIN, DIRECTOR
  - `POST /menu/items` — SYSTEM_ADMIN, DIRECTOR
  - `PATCH /menu/items/:id` — SYSTEM_ADMIN, DIRECTOR
  - `DELETE /menu/items/:id` — SYSTEM_ADMIN, DIRECTOR
  - `PATCH /menu/items/:id/availability` — MANAGER
- Register in `backend/src/routes/index.ts`

**7. Add Redis cache invalidation helper in `backend/src/services/menu-service.ts`**
- `invalidateMenuCache(organizationId, branchId?)` — deletes key(s) from Redis
- On availability toggle: delete `menu:{organizationId}:{branchId}`
- On item name/price update or delete: delete all `menu:{organizationId}:*` keys for the org

### FRONTEND

**8. Read `docs/DESIGN_SYSTEM.md` (sections on layout, typography, colours) before building any UI.**

**9. Create `frontend/services/menuService.ts`**
- `getMenu(branchId?)` — GET /api/v1/menu
- `getCategories()` — GET /api/v1/menu/categories
- `createCategory(data)` — POST /api/v1/menu/categories
- `updateCategory(id, data)` — PATCH /api/v1/menu/categories/:id
- `deleteCategory(id)` — DELETE /api/v1/menu/categories/:id
- `createItem(data)` — POST /api/v1/menu/items
- `updateItem(id, data)` — PATCH /api/v1/menu/items/:id
- `deleteItem(id)` — DELETE /api/v1/menu/items/:id
- `setItemAvailability(id, isAvailable)` — PATCH /api/v1/menu/items/:id/availability

**10. Create `frontend/types/menu.ts`**
- `MenuCategory`, `MenuItem`, `BranchMenuItem`, `MenuWithAvailability` TypeScript interfaces matching Prisma models

**11. Build `frontend/app/app/admin/menu/page.tsx` — SA/Director Menu Management (shared route; middleware allows both SYSTEM_ADMIN and DIRECTOR)**
- Branch selector `Select` at top of page — SA/Director choose which branch's availability context to view (populates `?branchId=` on `GET /menu` calls)
- Use `PageLayout` + `PageHeader` + `SidebarLayout`
- Category list using `Table` component: columns — name, prep station `Badge` (KITCHEN/BARISTA), item count, active status
- "Add Category" `Button` → `Modal` with `FormField` inputs: name `Input`, prep station `Select` (KITCHEN | BARISTA), display order `Input` (number)
- Edit category: same `Modal` pre-filled on row click
- Delete category: `ConfirmDialog` — call service, show error `Toast` if 409 (active items exist)
- Item list per category (expand row or sub-table): name, price (`PriceDisplay`), active status
- "Add Item" `Button` → `Modal`: name `Input`, description `Textarea`, price `Input`
- Edit item: same `Modal` pre-filled
- Delete item: `ConfirmDialog`

**12. Build `frontend/app/app/manage/menu/page.tsx` — Manager Menu Availability**
- Use `PageLayout` + `PageHeader` + `MobileLayout` (mobile-first)
- Fetch menu via `menuService.getMenu()`; group items by category
- Display each item as `MenuItemCard`
- Unavailable items: `opacity-45`, show "Unavailable" `Badge`
- `Toggle` per item — on change: immediately update local state (optimistic UI), call `menuService.setItemAvailability()`, revert + show error `Toast` on failure

### TESTS

**13. Create `backend/src/controllers/menu-controller.test.ts` — Integration Tests**
Follow the **hybrid existing style** — Vitest + Supertest against the test database with real Redis (matching the auth/branch/staff test patterns already in the repo). No mocking of Prisma or Redis; seed test data in `beforeEach`, clean up in `afterEach`.
- `POST /api/v1/menu/categories` — SYSTEM_ADMIN creates successfully (201)
- `POST /api/v1/menu/categories` — WAITER role returns 403
- `DELETE /api/v1/menu/categories/:id` — fails 409 when category has active items
- `GET /api/v1/menu` — MANAGER/branch-scoped role: uses token branchId, returns only available items
- `GET /api/v1/menu` — SYSTEM_ADMIN without `?branchId=` returns 400
- `GET /api/v1/menu` — SYSTEM_ADMIN with valid `?branchId=` returns available items for that branch
- `PATCH /api/v1/menu/items/:id/availability` — manager toggles own branch (200); attempting another branch returns 403
- `GET /api/v1/menu` (second call same branch) — response served from Redis cache (assert cache key exists)
- `PATCH /api/v1/menu/items/:id/availability` — after toggle, Redis cache key for branch is invalidated

**14. Create `backend/src/services/menu-service.test.ts` — Unit Test**
- `mergeMenuAvailability` (or equivalent pure function): given master menu items + branch overrides array → returns correct per-item `isAvailable` values
- Test case: item with branch override `false` → `isAvailable: false`
- Test case: item with no branch override → defaults to `true`
- Test case: item with branch override `true` explicitly → `isAvailable: true`

---

## Critical Files

| File | Action |
|---|---|
| `backend/src/validators/menu-schemas.ts` | Create |
| `backend/src/repositories/menu-repository.ts` | Create |
| `backend/src/services/menu-service.ts` | Create |
| `backend/src/controllers/menu-controller.ts` | Create |
| `backend/src/routes/menu-routes.ts` | Create |
| `backend/src/routes/index.ts` | Modify — register menu routes |
| `frontend/services/menuService.ts` | Create |
| `frontend/types/menu.ts` | Create |
| `frontend/app/app/admin/menu/page.tsx` | Create — shared SA + Director route |
| `frontend/app/app/manage/menu/page.tsx` | Create |
| `backend/src/controllers/menu-controller.test.ts` | Create |
| `backend/src/services/menu-service.test.ts` | Create |

## Reuse These Existing Patterns

- Auth/error pattern: `backend/src/utils/errors.ts` — use `AppError` with status codes
- Redis client: `backend/src/config/redis.ts` — import `redis` singleton
- Prisma client: `backend/src/config/database.ts` — import `prisma` singleton
- Route pattern: `backend/src/routes/auth-routes.ts` — same middleware stack
- Controller pattern: `backend/src/controllers/auth-controller.ts`
- Service pattern: `backend/src/services/auth-service.ts`
- Repository pattern: `backend/src/repositories/auth-repository.ts`
- Frontend service pattern: `frontend/services/authService.ts`
- Toast usage: `frontend/store/toastStore.ts` — `useToastStore.getState().addToast(...)`

## Verification

1. `pnpm --filter backend test` — all 7 new tests pass
2. `pnpm --filter backend dev` — `GET /api/v1/health` returns 200
3. Manual: login as SYSTEM_ADMIN, create a category and item via `/app/admin/menu`
4. Manual: login as MANAGER, toggle item availability via `/app/manage/menu` — optimistic UI responds instantly
5. Redis: verify cache key `menu:{orgId}:{branchId}` is set after first GET, deleted after availability toggle
6. `pnpm --filter frontend build` — no TypeScript errors
