# Wendo RMS — Agent Briefing

## What This Project Is

A multi-tenant restaurant management system for Wendo Coffee Bistro,
a premium coffee bistro in Nyeri, Kenya, expanding from 2 to 10 branches.
Stack: Next.js + TypeScript (frontend), Node.js + Express + TypeScript
(backend), PostgreSQL + Prisma, Redis, Socket.io.

## Project Documents — Read THE SPECIFIED SECTION of the document Before Acting - Do not read the whole document to avoid wasting tokens.

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

## Critical Domain Knowledge (Read Before Touching These Areas)

### Prep Ticket Model — One Ticket Per Order-Item Line
`PrepTicket` records are created **one per order-item line per station**, not one per station.
An order with `Latte x2 + Cappuccino + Fries` produces **3 tickets** (2 BARISTA + 1 KITCHEN).

- `Latte x2` → 1 ticket with `items: [{ name: "Latte", quantity: 2 }]`
- `Cappuccino` → 1 ticket with `items: [{ name: "Cappuccino", quantity: 1 }]`
- `Fries` → 1 ticket with `items: [{ name: "Fries", quantity: 1 }]`

**Do not** revert to grouping all station items into one ticket. This was an intentional workload-fairness design. See `docs/context/PHASE_3_ENHANCEMENT_TICKET_SPLITTING.md` for full rationale.

The `@@unique([orderId, station, sequence])` constraint on `PrepTicket` supports multiple tickets per station via the `sequence` field. When bulk-creating tickets with `createMany`, you **must** assign per-station sequence numbers explicitly — the default `sequence: 1` will cause a unique constraint violation for the second ticket of the same station.

**Duplicate item lines are distinct tickets, not quantity increments.** If a waiter taps `Cappuccino` twice, the result is **two separate cart lines → two separate tickets** on the BDS — not one ticket with `quantity: 2`. Each tap via `addToCart` always appends a new line (keyed by `lineId`). The backend reconciliation in `orderService.updateItems` uses occurrence-indexed keys `(menuItemId, notes, N)` to distinguish them.

- To get **one ticket with quantity 2**: tap once, then use the **+** stepper in the cart review sheet.
- To get **two separate tickets of quantity 1**: tap the item twice.

Do not revert `addToCart` to merge by `menuItemId` — this was the root cause of the BDS missing-ticket bug (fixed 2026-04-08, commits `7ef34bf` + `df226e1`).

---

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

Phase: 8
Status: Complete
Context file: docs/context/PHASE_8_CONTEXT.md

Previous phases:
- Phase 7 Complete → docs/context/PHASE_7_CONTEXT.md
- Phase 3 Enhancement (Ticket Splitting) Complete → docs/context/PHASE_3_ENHANCEMENT_TICKET_SPLITTING.md
- UI/UX Refinements (cross-phase) → docs/context/REFINEMENT_CONTEXT.md
- ACCOUNTANT Role (cross-phase, Phase 7–8) → docs/context/PHASE_8_ACCOUNTANT_ROLE.md
- Staff Discount Feature (post-Phase 8) → docs/context/PHASE_8_STAFF_DISCOUNT.md

## Current Deployment Model (Authoritative)

- Production is **DigitalOcean + Docker Compose** (not Render/Supabase/Upstash).
- Frontend: Vercel (`v3-rms.vercel.app`).
- API: Cloudflare tunnel (`https://api.wendo-rms.co.ke`) -> DigitalOcean droplet.
- Backend services on server: `api`, `worker`, `postgres`, `redis`.
- No dedicated staging environment is currently provisioned.
- **Deployments are fully automated via GitHub Actions CI/CD.** Every push to `main` triggers: validate → build Docker image → push to ghcr.io → SSH into server → `git pull` + migrate + restart containers. No manual server commands needed after pushing. Monitor at: GitHub → repo → Actions tab. See `docs/DEPLOYMENT.md` §7 for full pipeline details.

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

Build checks (run BOTH before every push — `typecheck` alone is not sufficient):

```powershell
Set-Location "d:\AI applications\web\V3-RMS\backend"
pnpm build
pnpm test

Set-Location "d:\AI applications\web\V3-RMS\frontend"
pnpm build
```

### Local DB - Migrations and Seed

**MIGRATION WORKFLOW — ALWAYS follow this order:**

1. Edit `backend/prisma/schema.prisma` locally
2. Generate the migration SQL file locally:
   ```powershell
   Set-Location "d:\AI applications\web\V3-RMS\backend"
   npx prisma migrate dev --name describe_your_change
   ```
3. Commit the generated migration file in `backend/prisma/migrations/`
4. Push to GitHub
5. On production server, apply with:
   ```bash
   docker compose exec api npx prisma migrate deploy
   ```

**Never run `prisma migrate dev` on production — it will prompt to reset (wipe) the database.**
**Never run `prisma migrate deploy` without a committed migration file — it will report "No pending migrations" and the schema change won't apply.**

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
Production Prisma Studio tunnels to server host port `5433`.

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

### Push Notifications (FCM) — Ops Reference

**VAPID key:** The `NEXT_PUBLIC_FIREBASE_VAPID_KEY` must be the **public key** (88 chars)
from Firebase Console → Project Settings → Cloud Messaging → Web Push certificates.
The private key (44 chars) shown below it must never be used here.

**Staff onboarding:** Each staff member must visit Profile → Push Notifications and tap
**Enable Notifications** once on their device. Tokens are stored per-device in `users.fcm_token`.

**Check who has registered:**
```bash
docker compose exec postgres psql -U wendo_user -d wendo_rms -c \
  "SELECT name, role, CASE WHEN fcm_token IS NOT NULL THEN 'YES' ELSE 'NO' END as notifications_enabled FROM users WHERE is_active = true AND role IN ('WAITER','CHEF','BARISTA','KITCHEN_DISPLAY','BARISTA_DISPLAY') ORDER BY notifications_enabled, role, name;"
```

**Service worker:** `frontend/public/firebase-messaging-sw.js` is the committed fallback with
real config baked in. `next.config.mjs` regenerates it from `firebase-messaging-sw.template.js`
at build time when env vars are present. The `no-cache` header prevents CDN/browser caching.

**If a device stops receiving pushes:** Token may be stale. Staff should re-visit Profile →
Push Notifications — if it shows Enabled, they can log out and back in to re-register.

### Known Gotchas

- Root `.env` must include `POSTGRES_PASSWORD=...` for Docker Compose.
- `backend/.env` must be valid dotenv (`KEY=value` only; no multiline SSH keys).
- Local Postgres is exposed on host `5433` for Prisma Studio local script.
- FCM VAPID key: use the **public** key (88 chars), not the private key (44 chars).
