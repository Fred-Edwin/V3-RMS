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
