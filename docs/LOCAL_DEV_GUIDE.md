# Local Development Guide
## Wendo RMS — Developer Workflow

**Status:** Authoritative
**Audience:** Solo developer (Edwin)

---

## Philosophy

**Localhost is your staging environment.**

Production (DigitalOcean) is for real users only. All feature development,
testing, demos, and multi-role walkthroughs happen on your local Docker stack.
The local stack is identical to production — same Docker images, same Prisma
schema, same environment structure — just pointed at a local database.

There is intentionally no separate staging server. The cost and maintenance
overhead is not justified for a single-developer project at this scale.

---

## Table of Contents

1. [Starting the Stack](#1-starting-the-stack)
2. [Dev Seed Accounts](#2-dev-seed-accounts)
3. [Multi-Role Testing (Logging in as Everyone at Once)](#3-multi-role-testing)
4. [Feature Flags](#4-feature-flags)
5. [Testing Against Production-like Data](#5-testing-against-production-like-data)
6. [Resetting the Local Database](#6-resetting-the-local-database)
7. [Common Errors](#7-common-errors)

---

## 1. Starting the Stack

Docker runs only the infrastructure (Postgres + Redis). The API runs directly on
your machine via `tsx watch` so every file save hot-reloads instantly — no build
step, no container restart.

**Terminal 1 — infrastructure:**

```powershell
Set-Location "d:\AI applications\web\V3-RMS"
docker compose up -d postgres redis
```

**Terminal 2 — backend (hot-reload):**

```powershell
Set-Location "d:\AI applications\web\V3-RMS\backend"
pnpm dev
```

**Terminal 3 — frontend:**

```powershell
Set-Location "d:\AI applications\web\V3-RMS\frontend"
pnpm dev
```

Verify:

```powershell
Invoke-RestMethod http://localhost:4000/api/v1/health
```

Open: `http://localhost:3000`

### Why not `docker compose up -d api worker`?

Running the API in Docker requires a `pnpm build` + container restart for every
backend change. Running directly with `tsx watch` gives instant reload on save.
The `docker-compose.override.yml` still mounts `./backend/dist` for cases where
you need to run the API in Docker (e.g. testing Docker-specific behaviour) — but
for day-to-day development, the direct approach is faster.

### backend/.env — local vs Docker hostnames

When running the backend directly, `backend/.env` must use `localhost` URLs:

```dotenv
DATABASE_URL=postgresql://wendo_user:PASSWORD@localhost:5433/wendo_rms
REDIS_URL=redis://localhost:6379
```

The production server's `backend/.env` uses Docker service names (`postgres`,
`wendo-redis`) — those are correct on the server and must not be changed.
Your local `backend/.env` is gitignored, so changes here never affect production.

---

## 2. Dev Seed Accounts

After starting the stack, run the dev seed once to create all test accounts:

```powershell
Set-Location "d:\AI applications\web\V3-RMS"
docker compose exec api node dist/scripts/seed-dev.js
```

This is **idempotent** — safe to re-run. Already-existing accounts are skipped.

### Accounts Created

All accounts use the password: **`password123`**

Accounts are created for **every active branch**. The email pattern is:

```
<role><n>.<branch-slug>@dev.test
```

The branch slug is the org name lowercased with spaces/special characters
removed. For the two current branches:

| Branch     | Slug        |
| ---------- | ----------- |
| Nyeri Town | `nyeritown` |
| Kingz      | `kingz`     |

**Per-branch accounts (example for Nyeri Town):**

| Role              | Emails                                              | Count |
| ----------------- | --------------------------------------------------- | ----- |
| `DIRECTOR`        | director1.nyeritown@dev.test                        | 1     |
| `MANAGER`         | manager1.nyeritown@dev.test                         | 1     |
| `WAITER`          | waiter1–4.nyeritown@dev.test                        | 4     |
| `CHEF`            | chef1–4.nyeritown@dev.test                          | 4     |
| `BARISTA`         | barista1–4.nyeritown@dev.test                       | 4     |
| `KITCHEN_DISPLAY` | kds1.nyeritown@dev.test                             | 1     |
| `BARISTA_DISPLAY` | bds1.nyeritown@dev.test                             | 1     |

Same pattern repeats for every other active branch (e.g. `...kingz@dev.test`).

**Central Store accounts (global, not per-branch):**

| Role              | Email                        | Count |
| ----------------- | ----------------------------- | ----- |
| `STORE_MANAGER`   | store.manager@wendo.test      | 1     |
| `STORE_ATTENDANT` | store.attendant@wendo.test    | 1     |

These two are seeded once on the hub org (same password `password123`),
following the existing Director account's "one global account" pattern —
the Central Store is a single shared location, not one per branch.

> The script prints a full account list when it runs — copy it for reference.

### Prerequisites

An active organization must exist before running seed-dev. If you are starting
from a blank database:

```powershell
# 1. Run migrations
docker compose exec api npx prisma migrate deploy

# 2. Seed the system admin (creates the SYSTEM_ADMIN account)
docker compose exec api node dist/scripts/seed-admin.js

# 3. Log in as system admin, create an organization and staff via the UI
#    OR import a production snapshot (see Section 5)

# 4. Then run dev seed
docker compose exec api node dist/scripts/seed-dev.js
```

---

## 3. Multi-Role Testing

Your JWT-based auth means every browser tab/window maintains its own independent
session. You can be logged in as all roles simultaneously.

### Browser Assignment

| Role              | Browser / Profile           |
| ----------------- | --------------------------- |
| Manager / Director | Chrome (default profile)   |
| Waiter            | Chrome Profile 2            |
| Chef              | Firefox                     |
| Barista           | Firefox Private Window      |
| KDS screen        | Edge                        |
| BDS screen        | Edge InPrivate              |

### How to Create a Chrome Profile

1. Click your avatar icon (top-right of Chrome)
2. **Add** → give it a name (e.g. "Waiter")
3. Opens a new Chrome window with its own independent session storage
4. Log in as `waiter@dev.test` / `password123`

### Typical Multi-Role Walkthrough

1. **Waiter** (Chrome Profile 2) — place a dine-in order
2. **Chef** (Firefox) — watch prep ticket appear on KDS, claim it, mark done
3. **Barista** (Firefox Private) — do the same for coffee items on BDS
4. **Manager** (Chrome) — see order status update, view reports
5. **Waiter** — confirm order is complete, close it out

All Socket.io events fire in real time across all windows. This is your
integration test environment.

---

## 4. Feature Flags

Unpaid/in-development features are gated behind environment variable flags in
`backend/.env` (local) and on the production server's `backend/.env`.

### Current Flags

```bash
# backend/.env
SKIP_SHIFT_VALIDATION=false   # true = bypass geofence/shift checks (useful for desk testing)
```

### Adding a New Feature Flag

**Step 1** — Add to `backend/src/config/env.ts`:

```typescript
FEATURE_ADVANCED_ANALYTICS: z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true'),
```

**Step 2** — Gate the feature in the service or route:

```typescript
import { env } from '../config/env';

if (!env.FEATURE_ADVANCED_ANALYTICS) {
  throw new ForbiddenError('This feature is not enabled.');
}
```

**Step 3** — Local dev: set `FEATURE_ADVANCED_ANALYTICS=true` in `backend/.env`,
restart containers.

**Step 4** — When client pays: SSH into the production server, set the flag to
`true` in `~/wendo-rms/backend/.env`, restart the API container:

```bash
# On production server
cd ~/wendo-rms
nano backend/.env   # flip FEATURE_X=true
docker compose up -d --force-recreate api worker
```

No code change, no deployment needed — the feature is already in the binary.

---

## 5. Testing Against Production-like Data

When you need realistic data locally (e.g. testing reports, seeded orders), pull
a snapshot from production:

```powershell
# Step 1 — Export from production into a local file
ssh edwinfred@104.248.29.42 "cd ~/wendo-rms && docker compose exec -T postgres pg_dump -U wendo_user -d wendo_rms" > .\prod_snapshot.sql

# Step 2 — Copy into the local postgres container
docker cp .\prod_snapshot.sql wendo-postgres:/tmp/prod_snapshot.sql

# Step 3 — Restore
docker compose exec postgres psql -U wendo_user -d wendo_rms -f /tmp/prod_snapshot.sql

# Step 4 — Re-run dev seed to ensure dev accounts exist
docker compose exec api node dist/scripts/seed-dev.js

# Step 5 — Clean up the snapshot file (treat it as sensitive)
Remove-Item .\prod_snapshot.sql
```

> **Important:** Do not run `seed-admin.js` after importing production data —
> the admin account already exists in the snapshot.

---

## 6. Resetting the Local Database

When you want a completely clean slate (e.g. testing a new migration from zero):

```powershell
Set-Location "d:\AI applications\web\V3-RMS"

# Destroy all containers and data volumes
docker compose down -v

# Start fresh
docker compose up -d postgres redis api worker

# Run migrations
docker compose exec api npx prisma migrate deploy

# Seed system admin
docker compose exec api node dist/scripts/seed-admin.js

# Seed dev accounts (requires an org to exist first — create one via UI or import snapshot)
docker compose exec api node dist/scripts/seed-dev.js
```

---

## 7. Common Errors

### `ENOTFOUND wendo-redis` or `ECONNREFUSED 127.0.0.1:6379`

Your `backend/.env` has Docker-internal hostnames. When running the backend
directly (not in Docker), update `backend/.env`:

```dotenv
DATABASE_URL=postgresql://wendo_user:PASSWORD@localhost:5433/wendo_rms
REDIS_URL=redis://localhost:6379
```

Also ensure Redis is exposed to the host — `docker-compose.override.yml` should
have a `redis: ports: ["6379:6379"]` entry. Recreate the Redis container if you
just added that:

```powershell
docker compose up -d redis
```

### `No active organization found` (seed-dev)

You ran `seed-dev` before creating an organization. Log in as system admin,
create an org, then re-run the seed.

### `POSTGRES_PASSWORD variable is not set`

Create `d:\AI applications\web\V3-RMS\.env` with:

```dotenv
POSTGRES_PASSWORD=your_local_password
```

### `open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file`

Docker Desktop is not running. Start it, wait for initialization, then retry.

### `failed to read backend/.env ... unexpected character "/"`

Your `backend/.env` has invalid content (likely a multiline SSH key pasted in).
Keep `.env` as single-line `KEY=value` pairs only.

### API returns 401 on all requests after DB reset

JWTs issued before the reset reference users that no longer exist. Clear
`localStorage` in the browser (DevTools → Application → Local Storage → Clear).

### Socket events not firing across browser windows

Check that the frontend `NEXT_PUBLIC_SOCKET_URL` in `frontend/.env` points to
`http://localhost:4000`, not the production tunnel URL.


---

# Docker Primer

_(merged from DOCKER_TUTORIAL.md)_

# Docker Tutorial for Wendo RMS (Beginner-Friendly)

This guide is for your **local development workflow** in this repository.
It focuses on what you actually need day to day, using PowerShell on Windows.

---

## 1. Mental Model (What Docker Is Doing Here)

In this project, Docker runs backend infrastructure and services as containers:

- `wendo-postgres` -> local PostgreSQL database
- `wendo-redis` -> local Redis cache/queue backend
- `wendo-api` -> backend API server (Express + Socket.io)
- `wendo-worker` -> BullMQ background workers

Think of containers as isolated mini-servers on your machine.

---

## 2. One-Time Prerequisites

1. Install Docker Desktop
2. Start Docker Desktop and wait until it says Running
3. Make sure these files are valid:
- root `.env` must contain:
```dotenv
POSTGRES_PASSWORD=your_password_here
```
- `backend/.env` must be valid `KEY=value` format (no multiline SSH keys, no random pasted blocks)

---

## 3. Core Commands You Will Use Most

Run from project root:

```powershell
Set-Location "d:\AI applications\web\V3-RMS"
```

Start services:

```powershell
docker compose up -d postgres redis api worker
```

Check status:

```powershell
docker compose ps
```

Stop services (keep data):

```powershell
docker compose stop
```

Start again after stop:

```powershell
docker compose start
```

Stop and remove containers/network (keep data volumes):

```powershell
docker compose down
```

Full reset (delete DB + Redis data volumes):

```powershell
docker compose down -v
```

---

## 4. Verify Backend Health

```powershell
Invoke-RestMethod http://localhost:4000/api/v1/health
```

Expected healthy result:
- `status: ok`
- `services.database: up`
- `services.redis: up`

---

## 5. Database Setup on Fresh Local DB

After `docker compose down -v`, your DB is empty. Re-apply schema and seed:

```powershell
docker compose exec api npx prisma migrate deploy
docker compose exec api node dist/scripts/seed-admin.js
```

---

## 6. Frontend + Backend Together (Local)

Backend (Docker):

```powershell
docker compose up -d postgres redis api worker
```

Frontend (Next.js dev server):

```powershell
Set-Location "d:\AI applications\web\V3-RMS\frontend"
pnpm install
pnpm dev
```

Open:
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:4000/api/v1`

---

## 7. Useful Logs and Debug Commands

API logs (live):

```powershell
docker compose logs -f api
```

Worker logs (live):

```powershell
docker compose logs -f worker
```

Postgres logs:

```powershell
docker compose logs --tail=100 postgres
```

Redis logs:

```powershell
docker compose logs --tail=100 redis
```

Show last 100 API lines:

```powershell
docker compose logs --tail=100 api
```

Prisma Studio against local DB:

```powershell
.\scripts\db-studio-local.ps1
```

If Prisma Studio local access fails after compose changes, recreate postgres to apply port mapping:

```powershell
docker compose up -d --force-recreate postgres
```

---

## 8. Common Problems and Fixes

### A) `POSTGRES_PASSWORD variable is not set`
Cause: missing root `.env`.
Fix: create/update root `.env` with `POSTGRES_PASSWORD=...`.

### B) `unexpected character "/" in variable name` while reading `backend/.env`
Cause: invalid `.env` content (often pasted SSH private key block).
Fix: keep only single-line `KEY=value` entries.

### C) `dockerDesktopLinuxEngine ... cannot find the file specified`
Cause: Docker Desktop not running.
Fix: start Docker Desktop.

### D) Health says `database=down` but redis is up
Cause: DB credentials mismatch (`DATABASE_URL` password vs `POSTGRES_PASSWORD`).
Fix:
1. align passwords
2. recreate containers or run `docker compose down -v` then `up` again

### E) `TLS handshake timeout` during image pull
Cause: transient network/proxy issue.
Fix: retry pulls, restart Docker Desktop, check VPN/proxy/network.

---

## 9. Test on Your Phone (Same Wi-Fi)

`localhost` on phone is not your laptop.
Use laptop IPv4 (example `192.168.0.105`).

1. Get laptop IP:

```powershell
ipconfig
```

2. Set frontend env (`frontend/.env`):

```dotenv
NEXT_PUBLIC_API_URL=http://192.168.0.105:4000/api/v1
NEXT_PUBLIC_SOCKET_URL=http://192.168.0.105:4000
```

3. Set backend CORS (`backend/.env`):

```dotenv
FRONTEND_ORIGIN=http://192.168.0.105:3000
```

4. Recreate backend containers:

```powershell
Set-Location "d:\AI applications\web\V3-RMS"
docker compose up -d --force-recreate api worker
```

5. Run frontend on all interfaces:

```powershell
Set-Location "d:\AI applications\web\V3-RMS\frontend"
pnpm dev -- -H 0.0.0.0 -p 3000
```

6. Open on phone:

```text
http://192.168.0.105:3000
```

---

## 10. Import Production DB Snapshot to Local

High-level:
1. Dump DB on server
2. Copy dump to local machine
3. Restore dump into local Postgres container

Use the detailed, maintained steps in:
- `docs/DEPLOYMENT.md` -> section **Local Development Runbook** -> **Import Production DB Data Into Local**

---

## 11. Recommended Daily Workflow

1. Start Docker Desktop
2. `docker compose up -d postgres redis api worker`
3. Check `Invoke-RestMethod http://localhost:4000/api/v1/health`
4. Start frontend `pnpm dev`
5. Develop and test
6. `docker compose logs -f api` when debugging
7. Stop with `docker compose stop` when done

---

## 12. Safety Rules

- Do not use production server as your dev playground.
- Do not run `prisma migrate dev` on production.
- Do not store SSH private keys inside `.env` files.
- Treat production SQL snapshots as sensitive data; delete local copies when done.
