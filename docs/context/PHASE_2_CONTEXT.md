# Phase 2 — Context (Living File)

This file is updated as tasks are completed. It is the agent's source of truth about what has been done and what decisions were made during this phase.

---

## Status
- [x] Phase 2 In Progress
- [x] Phase 2 Complete

---

## Completed Tasks
### Backend - Menu Feature
- [x] Added menu validation schemas in `backend/src/validators/menu-schemas.ts`:
  - create/update category
  - create/update item
  - availability toggle
  - menu query parsing (`categoryId`, `branchId`)
  - route `id` param parsing
- [x] Added menu repository in `backend/src/repositories/menu-repository.ts`:
  - category and item CRUD helpers
  - soft delete behavior (`MenuCategory.isActive=false`, `MenuItem.deletedAt`)
  - active-item delete guard support
  - menu + branch-override query
  - availability upsert by unique `(organizationId, menuItemId)`
- [x] Added menu service in `backend/src/services/menu-service.ts`:
  - `getMenu(actor, query)` with branch resolution and visibility-mode behavior
  - Redis cache-aside (`TTL 1 hour`) using key pattern `menu:{branchId}:{visibilityMode}:{categoryId|all}`
  - branch-scoped and global cache invalidation helpers
  - business rules for category delete conflict, item/category existence checks, and manager-branch availability toggle guard
  - exported pure merge helper `mergeMenuAvailability`
- [x] Added menu controller in `backend/src/controllers/menu-controller.ts` (thin parse + delegate + respond pattern).
- [x] Added menu routes in `backend/src/routes/menu-routes.ts` with `authenticate`, `branchScope`, and `requireRole` on all endpoints.
- [x] Registered menu routes in `backend/src/routes/index.ts`.

### Frontend - Menu Management UI
- [x] Added menu types in `frontend/types/menu.ts`.
- [x] Added typed menu API service in `frontend/services/menuService.ts`.
- [x] Built admin/director menu page in `frontend/app/app/admin/menu/page.tsx`:
  - category table with prep-station/status/item-count/actions
  - create/edit category modal
  - delete category confirm dialog (shows backend 409 conflict message via toast)
  - per-category item list with create/edit/delete flows
  - design-system components (`SidebarLayout`, `PageLayout`, `PageHeader`, `Table`, `Modal`, `ConfirmDialog`, `Input`, `Select`, `Textarea`, `Toggle`, `PriceDisplay`, `Button`)
- [x] Replaced manager menu placeholder with availability interface in `frontend/app/app/manage/menu/page.tsx`:
  - grouped categories with `MenuItemCard`
  - per-item availability `Toggle`
  - optimistic update + revert on API error
  - unavailable visual state + badge text
- [x] Updated `frontend/middleware.ts` to allow `DIRECTOR` access to `/app/admin/menu` while preserving existing protections for other admin paths.
- [x] Standardized menu-page data-loading hook pattern:
  - `frontend/app/app/admin/menu/page.tsx` now uses `useToast()` in `loadCategories` and includes `toast` in dependencies.
  - This matches `frontend/app/app/manage/menu/page.tsx` and relies on stable `useToast` callback references to avoid refetch/flicker loops.

### Tests
- [x] Added route-level menu tests in `backend/tests/menu.test.ts`:
  - SA create category success
  - WAITER blocked from category create
  - category delete returns 409 conflict
  - manager availability toggle own branch success
  - manager cross-branch availability toggle blocked
  - waiter `GET /menu` available-only payload path
  - manager `GET /menu` payload path with unavailable items
- [x] Added service unit tests in `backend/src/services/menu-service.test.ts`:
  - merge availability logic
  - cache-aside behavior
  - branch invalidation on availability toggle
  - global invalidation on master menu updates
  - cache invalidation no-op when no keys exist

### Verification
- [x] `pnpm --dir backend test` (38 passing)
- [x] `pnpm --dir backend build` (success)
- [x] `pnpm --dir frontend typecheck` (success)
- [x] `pnpm --dir frontend build` (success)

---

## Decisions Made
- Used role-aware menu visibility:
  - `WAITER`, `CHEF`, `BARISTA`, `KITCHEN_DISPLAY`, `BARISTA_DISPLAY` receive available-only menu payloads.
  - `MANAGER`, `DIRECTOR`, `SYSTEM_ADMIN` receive all active master items with per-item `isAvailable`.
- Kept branch resolution strict:
  - branch-scoped roles use JWT `organizationId` and cannot override via query.
  - `SYSTEM_ADMIN`/`DIRECTOR` must provide `branchId` query param for `GET /menu`.
- Applied cache segmentation by branch + visibility + category filter to prevent cross-role payload collisions.
- Used soft-delete strategy:
  - categories: `isActive = false`
  - items: `isActive = false` and `deletedAt = now`

---

## Blockers / Issues
- No functional blockers.
- Test runs still emit existing `ioredis` connection warnings in this environment when Redis is unreachable; tests pass and behavior is unchanged from previous phases.

---

## Notes for Next Phase (Phase 3)
- Menu backend endpoints are live and wired under `/api/v1/menu*`.
- Admin menu management UI is in `/app/admin/menu` and is shared by `SYSTEM_ADMIN` and `DIRECTOR`.
- Manager availability UI is in `/app/manage/menu` with optimistic toggles.
- Cache invalidation currently uses Redis `KEYS` pattern matching for simplicity; if branch count grows significantly, migrate to SCAN-based invalidation.
