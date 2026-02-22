# Phase 1 - Context (Living File)

This file is updated as tasks are completed. It is the agent's source of truth about what has been done and what decisions were made during this phase.

---

## Status
- [x] Phase 1 In Progress
- [x] Phase 1 Complete

---

## Completed Tasks
### Backend - Auth Foundation
- [x] Added auth/security env config in `backend/src/config/env.ts` and `backend/.env.example`:
  - `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
  - `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`
  - `BCRYPT_ROUNDS`
  - `SYSTEM_ADMIN_EMAIL`, `SYSTEM_ADMIN_PASSWORD`
- [x] Added typed application errors in `backend/src/utils/errors.ts`.
- [x] Updated global error handling in `backend/src/middleware/error-handler.ts` for:
  - `AppError` subclasses
  - `ZodError` validation failures
- [x] Added JWT utility in `backend/src/utils/jwt.ts`.
- [x] Added password utility in `backend/src/utils/password.ts`.
- [x] Added unit tests:
  - `backend/src/utils/jwt.test.ts`
  - `backend/src/utils/password.test.ts`

### Backend - Prisma / Migration / Seed
- [x] Updated `backend/prisma/schema.prisma`:
  - Added `RefreshToken` model
  - Added `User.fcmToken`
  - Added `User.refreshTokens` relation
  - Extended `UserRole` with `KITCHEN_DISPLAY`, `BARISTA_DISPLAY`
- [x] Created and applied migration:
  - `backend/prisma/migrations/20260222170529_add_auth_refresh_tokens_and_display_roles/migration.sql`
- [x] Added System Admin seed script `backend/src/scripts/seed-admin.ts`.
- [x] Added backend script `seed:admin` in `backend/package.json`.

### Backend - Middleware
- [x] Implemented `backend/src/middleware/authenticate.ts` to parse bearer token, verify JWT, and attach `req.user`.
- [x] Implemented `backend/src/middleware/rbac.ts` to enforce role-based route authorization.
- [x] Implemented `backend/src/middleware/branch-scope.ts` to enforce authenticated branch context.

### Backend - Auth Feature (Repository/Service/Validator/Controller/Route)
- [x] Added:
  - `backend/src/repositories/auth-repository.ts`
  - `backend/src/services/auth-service.ts`
  - `backend/src/validators/auth-schemas.ts`
  - `backend/src/controllers/auth-controller.ts`
  - `backend/src/routes/auth-routes.ts`
- [x] Implemented endpoints:
  - `POST /api/v1/auth/login`
  - `POST /api/v1/auth/refresh`
  - `POST /api/v1/auth/logout`
  - `PATCH /api/v1/auth/change-password`
  - `POST /api/v1/auth/register-device`
- [x] Added stricter login rate limit (10/minute).

### Backend - Branch Feature (Repository/Service/Validator/Controller/Route)
- [x] Added:
  - `backend/src/repositories/branch-repository.ts`
  - `backend/src/services/branch-service.ts`
  - `backend/src/validators/branch-schemas.ts`
  - `backend/src/controllers/branch-controller.ts`
  - `backend/src/routes/branch-routes.ts`
- [x] Implemented endpoints:
  - `GET /api/v1/branches`
  - `POST /api/v1/branches`
  - `PATCH /api/v1/branches/:id`
  - `PATCH /api/v1/branches/:id/set-hub`
- [x] Implemented transactional hub switch logic (unset old hub, set new hub).

### Backend - Staff Feature (Repository/Service/Validator/Controller/Route)
- [x] Added:
  - `backend/src/repositories/staff-repository.ts`
  - `backend/src/services/staff-service.ts`
  - `backend/src/validators/staff-schemas.ts`
  - `backend/src/controllers/staff-controller.ts`
  - `backend/src/routes/staff-routes.ts`
- [x] Implemented endpoints:
  - `POST /api/v1/staff`
  - `GET /api/v1/staff`
  - `GET /api/v1/staff/:id`
  - `PATCH /api/v1/staff/:id`
  - `PATCH /api/v1/staff/:id/deactivate`
  - `PATCH /api/v1/staff/:id/reactivate`
- [x] Enforced role + branch-scoping rules in service layer.
- [x] Ensured staff responses never return `passwordHash`.
- [x] Included `organizationName` in staff payloads where available.

### Backend - Route Registration
- [x] Wired auth/branch/staff routes in `backend/src/routes/index.ts`.

### Backend - Tests
- [x] Added integration tests:
  - `backend/tests/auth.test.ts`
  - `backend/tests/branch.test.ts`
  - `backend/tests/staff.test.ts`
- [x] Updated test include pattern in `backend/vitest.config.ts` to include unit tests under `src/**/*.test.ts`.
- [x] Added `backend/tests/setup.ts` — sets test-only env vars (JWT secrets) before suite runs; wired via `setupFiles` in vitest config.
- [x] Verified tests pass:
  - 6 test files
  - 26 tests passed

### Backend - Post-Review Fixes
- [x] Removed `.default()` from `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` in `backend/src/config/env.ts` — missing secrets now crash at startup instead of using a known insecure default.
- [x] Added JWT secrets and full auth env vars to `backend/.env` for local dev (dev-only values, must be replaced before Render deploy).
- [x] Removed incorrect SYSTEM_ADMIN role restriction in `backend/src/services/staff-service.ts` — SA can now create any role (was incorrectly limited to MANAGER and DIRECTOR only).

### Frontend - Services / Types / Utilities
- [x] Added role-home map `frontend/lib/role-home.ts`.
- [x] Added services:
  - `frontend/services/authService.ts`
  - `frontend/services/branchService.ts`
  - `frontend/services/staffService.ts`
- [x] Updated `frontend/lib/apiClient.ts` to use `credentials: 'include'` for cookie-based refresh/logout flow.
- [x] Updated frontend types:
  - `frontend/types/auth.ts` (`organizationName` support)
  - `frontend/types/api.ts` (standard envelope fields)

### Frontend - Auth Store and Middleware
- [x] Implemented `frontend/store/authStore.ts`:
  - refresh action
  - auto-refresh timer before token expiry
  - logout action
  - cookie mirroring for `accessToken`
- [x] Implemented role-based middleware in `frontend/middleware.ts`:
  - redirect unauthenticated users to `/login`
  - redirect authenticated users from `/login` to role landing page
  - enforce wrong-role redirect to own landing page

### Frontend - Phase 1 Pages
- [x] Implemented functional login page `frontend/app/(auth)/login/page.tsx`:
  - email/password form
  - validation and API error handling
  - offline banner
  - role-based redirect on success
- [x] Implemented profile page `frontend/app/app/profile/page.tsx`:
  - profile display
  - edit name/phone
  - change password flow
- [x] Implemented system admin page `frontend/app/app/admin/page.tsx`:
  - branch list/create/edit/set-hub
  - director/manager list/create/deactivate/reactivate
- [x] Implemented manager staff page `frontend/app/app/manage/staff/page.tsx`:
  - list/create/edit/deactivate/reactivate staff

### Verification
- [x] `pnpm --dir backend exec prisma migrate dev --name add_auth_refresh_tokens_and_display_roles`
- [x] `pnpm --dir backend test` — 26/26 passing
- [x] `pnpm --dir backend build` — clean
- [x] `pnpm --dir frontend typecheck` — clean
- [x] `pnpm --dir frontend build` — clean
- [x] `pnpm --dir backend seed:admin` — System Admin seeded (edwinfredofficial@gmail.com)

---

## Decisions Made
- Included display-account roles in Phase 1:
  - `KITCHEN_DISPLAY`
  - `BARISTA_DISPLAY`
- Kept access token in Zustand and mirrored to cookie for Next.js middleware role-routing.
- Included `organizationName` in auth/staff-facing payloads to support Phase 1 UI needs.
- Implemented auth errors and validation through typed errors + global error middleware (single envelope format).
- Kept Phase 1 UI intentionally functional (basic utility styling), deferring design polish to Phase 1.5.
- Kept business rules in services and DB queries in repositories to maintain layered architecture boundaries.
- JWT secrets are required (no defaults) — app crashes at startup if not set. Test suite uses a dedicated `tests/setup.ts` with test-only secret values.
- SYSTEM_ADMIN has unrestricted role creation; only validation is `organizationId` required when creating a MANAGER.

---

## Blockers / Issues
- Manual smoke validation across all real role accounts is pending until Render staging is configured.
- `backend/.env` JWT secrets are dev-only placeholders — must be replaced with strong secrets on Render before production deploy.
- Repository has no active `.git` metadata in this environment root, so in-session `git status` could not be used for local diff summary.

---

## Notes for Next Phase (Phase 1.5 — Design System & Component Library)
- Auth/RBAC/branch-scoping middleware is active and must be applied to all new protected routes.
- Display roles (`KITCHEN_DISPLAY`, `BARISTA_DISPLAY`) are in the Prisma enum and frontend routing map — Phase 1.5+ can use them directly.
- Refresh-token rotation is DB-backed (`refresh_tokens` table); refresh/logout depend on cookie flow (`credentials: include`).
- Phase 1 UI pages (login, profile, admin, manage/staff) are functional but unstyled — Phase 1.5 will restyle them using the component library.
- Before Render deploy: replace `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` in backend env with strong random secrets (min 32 chars).
