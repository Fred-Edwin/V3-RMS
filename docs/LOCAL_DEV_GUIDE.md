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
