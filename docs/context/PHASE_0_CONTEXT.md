# Phase 0 Context - Canonical Tracker

This file is the authoritative progress log for Phase 0.

## Status
- [x] Phase 0 In Progress
- [ ] Phase 0 Complete

## Completed Tasks
### Backend - Project Setup
- [x] Initialised `backend/` Node.js + Express + TypeScript project.
- [x] Configured strict TypeScript (`tsconfig.json`) with strict checks enabled.
- [x] Configured ESLint + Prettier.
- [x] Created backend folder structure per TDD.

### Backend - Database (Prisma + Supabase)
- [x] Installed and configured Prisma.
- [x] Implemented full `prisma/schema.prisma` from `docs/DATA_MODEL.md`.
- [x] Generated initial migration: `backend/prisma/migrations/20260222150243_init_phase_0/migration.sql`.
- [x] Applied migration to Supabase (`prisma migrate dev` + `prisma migrate deploy`).
- [x] Verified schema presence in Supabase (13 expected tables, 45 indexes, no missing tables).

### Backend - Redis
- [x] Implemented Redis client singleton (`src/config/redis.ts`).
- [x] Implemented Redis-backed BullMQ connection (`src/config/queues.ts`).
- [x] Verified Redis connectivity via live health check (`services.redis = up`).

### Backend - Express Foundation
- [x] Implemented Express app with JSON body parsing.
- [x] Implemented request logging middleware (Pino HTTP).
- [x] Implemented CORS config (frontend origin from env).
- [x] Implemented rate limiting middleware.
- [x] Implemented response compression.
- [x] Implemented global 404 and error handlers.

### Backend - Health Endpoint
- [x] Implemented `GET /api/v1/health` at `/api/v1/health`.
- [x] Health payload includes:
  - `status` (`ok` | `degraded`)
  - `timestamp` (ISO string)
  - `services.database` (`up` | `down`)
  - `services.redis` (`up` | `down`)
- [x] Endpoint is intentionally unauthenticated for infrastructure monitoring in Phase 0.

### Backend - Socket.io
- [x] Attached Socket.io to HTTP server.
- [x] Implemented branch room structure `branch:{organizationId}`.
- [x] Implemented `join:branch` payload validation with Zod.
- [x] Added local verification client script (`pnpm socket:test-client`).
- [x] Verified client connection and room join.

### Backend - BullMQ
- [x] Created queue skeletons: `notificationQueue`, `reportQueue`.
- [x] Added worker skeletons in `src/jobs/workers.ts`.
- [x] Worker startup is optional (`START_BULLMQ_WORKERS=true`).

### Backend - Tests
- [x] Configured Vitest + Supertest.
- [x] Added integration tests for `GET /api/v1/health`:
  - healthy dependencies -> `ok`
  - database down path -> `degraded`
  - redis down path -> `degraded`
- [x] `pnpm test` passing.

### Backend - Documentation
- [x] Added `backend/README.md` with setup and verification runbook.
- [x] Added `.env.example` with required variables.

### Frontend - Project Setup
- [x] Initialised `frontend/` with Next.js 14 App Router + TypeScript.
- [x] Added strict TypeScript checks and `typecheck` script.
- [x] Installed and configured Tailwind CSS.
- [x] Installed and configured Zustand.
- [x] Installed `lucide-react`.
- [x] Installed `socket.io-client`.
- [x] Added `clsx` + `tailwind-merge` and created `lib/cn.ts`.
- [x] Created frontend structure per coding standards:
  - `app/`
  - `components/ui`, `components/orders`, `components/kitchen`, `components/menu`, `components/staff`, `components/dashboard`
  - `hooks`, `services`, `store`, `lib`, `types`

### Frontend - Design System Foundation
- [x] Applied full Tailwind `theme.extend` from `docs/DESIGN_SYSTEM.md` Section 13 in `frontend/tailwind.config.ts`.
- [x] Updated global styles in `frontend/app/globals.css` to warm baseline (`Crema` background, `Stone` text).
- [x] Configured Google fonts (`Cormorant Garamond`, `DM Sans`) in `frontend/app/layout.tsx`.

### Frontend - Route Skeletons
- [x] Added auth/app route group scaffold with placeholder pages:
  - `/login`
  - `/app/dashboard`
  - `/app/orders`
  - `/app/orders/new`
  - `/app/history`
  - `/app/performance`
  - `/app/shifts`
  - `/app/clock`
  - `/app/profile`
  - `/app/kitchen`
  - `/app/barista`
  - `/app/manage/dashboard`
  - `/app/manage/staff`
  - `/app/manage/menu`
  - `/app/manage/shifts`
  - `/app/manage/delivery-zones`
  - `/app/manage/reports`
  - `/app/director`
  - `/app/admin`
- [x] Added root route redirect from `/` to `/login`.

### Frontend - Middleware / API / Socket / Store Skeletons
- [x] Implemented `frontend/middleware.ts` auth protection skeleton for `/app/*`.
- [x] Implemented `frontend/lib/apiClient.ts` typed fetch wrapper skeleton.
- [x] Implemented `frontend/lib/socket.ts` with `connectSocket`, `disconnectSocket`, `joinBranchRoom`.
- [x] Added minimal shared types:
  - `frontend/types/auth.ts`
  - `frontend/types/api.ts`
  - `frontend/types/socket.ts`
- [x] Added `frontend/store/authStore.ts` Zustand auth scaffold (`setAuth`, `clearAuth`).

### Frontend - Verification
- [x] `pnpm lint` passing.
- [x] `pnpm typecheck` passing.
- [x] `pnpm build` passing.
- [x] Dev smoke checks completed:
  - `/login` returned `200`
  - Protected `/app/*` routes returned `307` redirect when unauthenticated (expected middleware behavior).

### Frontend - Documentation
- [x] Added `frontend/.env.example` with `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SOCKET_URL`.
- [x] Updated `frontend/README.md` with setup/validation and pending cloud runbook notes.

## Decisions Made
- Prisma pinned to `6.16.2` to keep stable datasource-in-schema workflow for this phase.
- Health route kept unauthenticated to support external uptime checks.
- Socket room naming convention fixed as `branch:{organizationId}`.
- BullMQ workers are not auto-run in dev by default to avoid duplicate processors.
- Redis/BullMQ use TLS `rediss://` endpoint compatible with Upstash redis endpoint.
- Frontend manager route convention uses `/app/manage/*` — aligned with BUILD_ORDER.md spec.
- Frontend cloud tasks are local-verify only for Phase 0 in-repo work; Vercel/staging setup remains manual.

## Blockers / Issues
- Render/Vercel CI/CD wiring is still pending (external console actions).
- Staging deployment verification is pending until Render service is configured.
- `create-next-app` initialized a nested `frontend/.git` repository; retained as-is because removal was blocked by shell policy in this environment.

## Verification Commands Run
```powershell
pnpm install
pnpm prisma validate
pnpm prisma:generate
pnpm prisma migrate dev --name init_phase_0 --create-only
pnpm prisma migrate dev
pnpm prisma migrate deploy
pnpm prisma migrate status
pnpm lint
pnpm build
pnpm test
pnpm verify:schema
pnpm socket:test-client
```

```powershell
# Frontend
pnpm add zustand lucide-react socket.io-client clsx tailwind-merge
pnpm lint
pnpm typecheck
pnpm build
pnpm dev
```

## Notes for Next Phase (Phase 1)
- Staging URL (backend): pending
- Staging URL (frontend): pending
- Database connection: confirmed (live)
- Redis connection: confirmed (live)
- Socket.io connectivity: confirmed (local end-to-end)
- Frontend Phase 0 scaffold: confirmed local.
- Next backend focus: Auth/RBAC middleware hardening, branch-scoped auth context, and auth endpoints.
