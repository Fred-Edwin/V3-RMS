# Wendo RMS — Agent Briefing

## What This Project Is

A multi-tenant restaurant management system for Wendo Coffee Bistro,
a premium coffee bistro in Nyeri, Kenya, expanding from 2 to 10 branches.
Stack: Next.js + TypeScript (frontend), Node.js + Express + TypeScript
(backend), PostgreSQL + Prisma, Redis, Socket.io.

## Project Documents — Read ONLY THE SPECIFIED SECTION/LINES of the document Before Acting - Do not read the whole document to avoid wasting tokens.

Before implementing anything, read the document(s) specific sections/lines relevant to your task:

| Document                   | Read When                                      |
| -------------------------- | ---------------------------------------------- |
| `docs/PRD.md`              | Understanding what a feature is supposed to do |
| `docs/DATA_MODEL.md`       | Writing any Prisma schema or database query    |
| `docs/TDD.md`              | Making any architectural decision              |
| `docs/API_CONTRACT.md`     | Implementing any API endpoint                  |
| `docs/DESIGN_SYSTEM.md`    | Building any UI component or page              |
| `docs/BUILD_ORDER.md`      | Understanding what phase is being built        |
| `docs/CODING_STANDARDS.md` | Writing any code — always                      |
| `docs/context`             | Getting context for the previous phases        |

## Non-Negotiables (Read These Now)

1. TypeScript strict mode is always on. No `any` types.
2. Every API route has `authenticate` and `requireRole` middleware.
3. Every repository query includes `organizationId` in the where clause.
4. Business logic lives in services only — never controllers or repositories.
5. Database queries live in repositories only — never services or controllers.
6. Every endpoint has a Zod schema for input validation.
7. Passwords are never logged, returned in responses, or stored plain text.
8. A feature without tests is not complete.
9. Always use pnpm to install dependencies.
10. Always use pnpm to run scripts.
11. Always use pnpm to build the project.
12. Always use pnpm to run the project.
13. Use Windows PowerShell commands.

## Frontend Hook Stability Rules (Read Before Editing Pages/Hooks)

1. Hooks that return action functions used in `useEffect`/`useCallback` dependencies must return stable references (use selectors + `useCallback` when needed).
2. Do not silence dependency warnings by default. Prefer making dependencies stable instead of removing them.
3. Data-loading effects must not depend on unstable inline functions, or they can trigger repeated refetch loops and UI flicker.
4. For Zustand, prefer selecting specific actions (`useStore((s) => s.action)`) instead of destructuring the whole store object.
5. If you intentionally omit a dependency, add an inline comment explaining why it is safe.

## Project Structure

backend/src/
controllers/ — thin, validate + delegate only
services/ — all business logic
repositories/ — all Prisma queries
middleware/ — auth, rbac, error handler
routes/ — route definitions
validators/ — Zod schemas
sockets/ — Socket.io handlers
jobs/ — BullMQ background jobs
utils/ — pure utility functions
types/ — TypeScript types

frontend/
app/ — Next.js App Router pages
components/ — reusable UI components
ui/ — base components
orders/ — order components
kitchen/ — KDS/BDS components
menu/ — menu components
staff/ — staff components
dashboard/ — dashboard components
hooks/ — custom React hooks
services/ — API call functions
store/ — Zustand stores
lib/ — utilities (apiClient, socket, cn)
types/ — shared TypeScript types

## Current Phase

<!-- UPDATE THIS EVERY TIME A PHASE BEGINS -->

Phase: 6
Status: Complete
Context file: docs/context/PHASE_6_CONTEXT.md

## Current Deployment Model (Authoritative)

- Production is **DigitalOcean + Docker Compose** (not Render/Supabase/Upstash).
- Frontend: Vercel (`v3-rms.vercel.app`).
- API: Cloudflare tunnel (`https://api.wendo-rms.co.ke`) -> DigitalOcean droplet.
- Backend services on server: `api`, `worker`, `postgres`, `redis`.
- No dedicated staging environment is currently provisioned.

## Command Quick Reference (for Coding Agents)

### Local Dev - Core

```powershell
Set-Location "d:\AI applications\web\V3-RMS"
docker compose up -d postgres redis api worker
docker compose ps
Invoke-RestMethod http://localhost:4000/api/v1/health
```

Frontend:

```powershell
Set-Location "d:\AI applications\web\V3-RMS\frontend"
pnpm install
pnpm dev
```

Build checks:

```powershell
Set-Location "d:\AI applications\web\V3-RMS\backend"
pnpm build
pnpm test

Set-Location "d:\AI applications\web\V3-RMS\frontend"
pnpm typecheck
pnpm build
```

### Local DB - Migrations and Seed

```powershell
Set-Location "d:\AI applications\web\V3-RMS"
docker compose exec api npx prisma migrate deploy
docker compose exec api npx prisma migrate status
docker compose exec api node dist/scripts/seed-admin.js
```

Reset local DB/data volumes:

```powershell
docker compose down -v
docker compose up -d postgres redis api worker
```

### Prisma Studio (Important Distinction)

- **Local DB Studio** (run on local Windows machine):

```powershell
Set-Location "d:\AI applications\web\V3-RMS"
.\scripts\db-studio-local.ps1
```

- **Production DB Studio** (run on local Windows machine; opens SSH tunnel):

```powershell
Set-Location "d:\AI applications\web\V3-RMS"
.\scripts\db-studio.ps1
```

Do **not** run `.ps1` scripts inside Ubuntu server shell.

### Logs

Local Docker logs:

```powershell
Set-Location "d:\AI applications\web\V3-RMS"
docker compose logs -f api
docker compose logs -f worker
docker compose logs --tail=100 postgres
```

Production logs from local machine:

```powershell
Set-Location "d:\AI applications\web\V3-RMS"
.\scripts\logs.ps1
.\scripts\logs.ps1 worker
```

### Production Server - Safe DB Commands

```bash
cd ~/wendo-rms
docker compose exec api npx prisma migrate deploy
docker compose exec api npx prisma migrate status
docker compose exec postgres psql -U wendo_user -d wendo_rms
```

Never run `prisma migrate dev` on production.

### Demo Seed Data (Production/Server)

```bash
cd ~/wendo-rms
docker compose exec api sh -c "SEED_REPORTS_CONFIRM=YES ALLOW_PRODUCTION_SEED=true node dist/scripts/seed-report-orders.js --days=7 --min-orders=12 --max-orders=30"
docker compose exec api sh -c "SEED_REPORTS_CONFIRM=YES ALLOW_PRODUCTION_SEED=true node dist/scripts/seed-report-orders.js --reset-only"
```

### Local Network (Phone Testing)

Set phone-facing envs:
- `frontend/.env`:
  - `NEXT_PUBLIC_API_URL=http://<LAN_IP>:4000/api/v1`
  - `NEXT_PUBLIC_SOCKET_URL=http://<LAN_IP>:4000`
- `backend/.env`:
  - `FRONTEND_ORIGIN=http://<LAN_IP>:3000`

Then:

```powershell
Set-Location "d:\AI applications\web\V3-RMS"
docker compose up -d --force-recreate api worker
Set-Location "d:\AI applications\web\V3-RMS\frontend"
pnpm dev -- -H 0.0.0.0 -p 3000
```

### Known Gotchas

- Root `.env` must include `POSTGRES_PASSWORD=...` for Docker Compose.
- `backend/.env` must be valid dotenv (`KEY=value` only; no multiline SSH keys).
- Local Postgres is exposed on host `5433` for Prisma Studio local script.
