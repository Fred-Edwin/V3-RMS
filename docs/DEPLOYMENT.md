# Deployment Guide
## Wendo Coffee Bistro — Restaurant Management System (RMS)
**Version:** 1.0
**Status:** Draft
**Date:** 2026-02-26

---

## Table of Contents

1. [Infrastructure Overview](#1-infrastructure-overview)
2. [Services & Accounts to Create](#2-services--accounts-to-create)
3. [Environment Variables Reference](#3-environment-variables-reference)
4. [First Deployment — Step by Step](#4-first-deployment--step-by-step)
5. [Subsequent Deployments](#5-subsequent-deployments)
6. [Database Migrations](#6-database-migrations)
7. [Observability Setup](#7-observability-setup)
8. [Health Checks & Uptime Monitoring](#8-health-checks--uptime-monitoring)
9. [Rollback Procedure](#9-rollback-procedure)
10. [Environments](#10-environments)
11. [Deployment Checklist](#11-deployment-checklist)

---

## 1. Infrastructure Overview

```
┌─────────────────────────────────────────────────────┐
│              Vercel (Frontend)                       │
│  Next.js — global CDN, auto-deploy from main        │
│  URL: app.wendorms.co.ke                            │
└────────────────────┬────────────────────────────────┘
                     │ HTTPS
┌────────────────────▼────────────────────────────────┐
│              Railway (Backend)                       │
│  Node.js + Express — always-on, Pro plan            │
│  URL: api.wendorms.co.ke                            │
└──────────┬──────────────────────────┬───────────────┘
           │                          │
┌──────────▼──────────┐  ┌────────────▼──────────────┐
│  Supabase           │  │  Upstash Redis             │
│  (PostgreSQL)       │  │  Cache + BullMQ queues     │
│  Free tier          │  │  Free tier                 │
└─────────────────────┘  └────────────────────────────┘
                                      │
                             ┌────────▼────────┐
                             │  Firebase (FCM) │
                             │  Push notifs    │
                             └────────┬────────┘
                                      │
                             ┌────────▼────────┐
                             │   Cloudinary    │
                             │  Image storage  │
                             └─────────────────┘

Observability:
  Errors  → Sentry (free tier)
  Logs    → Betterstack (free tier)
  Uptime  → UptimeRobot (free)
  Metrics → Railway built-in dashboard
  Audit   → PostgreSQL (already in DB)
```

### Why This Stack

| Service | Choice | Reason |
|---|---|---|
| Frontend hosting | Vercel | Zero-config Next.js, global CDN, free |
| Backend hosting | Railway Pro | Always-on (no cold starts), WebSocket support, built-in metrics |
| Database | Supabase | Managed PostgreSQL, automatic backups, free tier sufficient for V1 |
| Redis | Upstash | Serverless Redis, free tier covers V1 load, no idle cost |
| Images | Cloudinary | Managed image storage and CDN, free tier generous |
| Push notifications | Firebase FCM | Industry standard, free, Android web push |
| Error tracking | Sentry | Best-in-class, free 5k errors/mo |
| Log management | Betterstack | Structured log ingestion, Pino-native, free 1 GB/mo |
| Uptime monitoring | UptimeRobot | Free, polls every 5 min, SMS/email alerts |

---

## 2. Services & Accounts to Create

Create these accounts before beginning deployment. Free tiers are sufficient for V1.

### 2.1 Supabase (PostgreSQL)
1. Create account at supabase.com
2. Create a new project — name it `wendo-rms-production`
3. Choose a region close to Kenya (Europe West is currently closest)
4. Note down two connection strings from **Project Settings → Database**:
   - **Connection string (pooler)** — use this as `DATABASE_URL` in the app
   - **Direct connection string** — use this for running Prisma migrations only

### 2.2 Upstash (Redis)
1. Create account at upstash.com
2. Create a new Redis database — name it `wendo-rms-production`
3. Select the same region as Supabase
4. Enable **TLS** (always on by default)
5. Note down from the database details page:
   - `REDIS_URL` — the `rediss://` connection string
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

### 2.3 Firebase (FCM Push Notifications)
1. Go to console.firebase.google.com
2. Create a new project — name it `wendo-rms`
3. Enable **Cloud Messaging** in Project Settings
4. Generate a **Service Account** key:
   - Project Settings → Service Accounts → Generate new private key
   - Download the JSON file — this becomes `FIREBASE_SERVICE_ACCOUNT_JSON`
5. Get the **VAPID key**:
   - Project Settings → Cloud Messaging → Web Push certificates → Generate key pair
   - This becomes `VAPID_KEY`
6. Get the web app config values:
   - Project Settings → General → Your apps → Add app (Web)
   - Note down all `NEXT_PUBLIC_FIREBASE_*` values

### 2.4 Cloudinary (Image Storage)
1. Create account at cloudinary.com
2. From the Dashboard, note down:
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`

### 2.5 Railway (Backend Hosting)
1. Create account at railway.app
2. Upgrade to **Pro plan** ($20/mo minimum) — required for always-on production hosting
3. Create a new project — name it `wendo-rms`
4. Connect your GitHub repository

### 2.6 Vercel (Frontend Hosting)
1. Create account at vercel.com
2. Import your GitHub repository
3. Set the **root directory** to `frontend`
4. Framework preset: Next.js (auto-detected)

### 2.7 Sentry (Error Tracking)
1. Create account at sentry.io
2. Create two new projects:
   - `wendo-rms-backend` (Node.js platform)
   - `wendo-rms-frontend` (Next.js platform)
3. Note down each project's `SENTRY_DSN`

### 2.8 Betterstack (Log Management)
1. Create account at betterstack.com
2. Go to **Logs** → Create a new source
3. Select **Node.js** as the platform
4. Note down the `BETTERSTACK_SOURCE_TOKEN`

### 2.9 UptimeRobot (Uptime Monitoring)
1. Create account at uptimerobot.com
2. Add a new monitor after the backend is deployed (step 4.10 below)

---

## 3. Environment Variables Reference

### 3.1 Backend (Railway)

Set all of these in Railway → Project → Service → Variables.

```bash
# Server
NODE_ENV=production
PORT=4000
API_PREFIX=/api/v1
FRONTEND_ORIGIN=https://app.wendorms.co.ke

# Database
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-eu-west-1.pooler.supabase.com:6543/postgres

# Redis
REDIS_URL=rediss://default:[token]@[host].upstash.io:6379
REDIS_TOKEN=[token]
UPSTASH_REDIS_REST_URL=https://[host].upstash.io
UPSTASH_REDIS_REST_TOKEN=[token]

# JWT — generate two separate long random strings (min 32 chars each)
JWT_ACCESS_SECRET=[random-string-min-32-chars]
JWT_REFRESH_SECRET=[different-random-string-min-32-chars]
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
BCRYPT_ROUNDS=12

# Firebase — paste the entire downloaded JSON as a single line
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"...","private_key":"..."}
VAPID_KEY=[web-push-vapid-key]

# Cloudinary
CLOUDINARY_CLOUD_NAME=[cloud-name]
CLOUDINARY_API_KEY=[api-key]
CLOUDINARY_API_SECRET=[api-secret]

# Rate limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=200

# BullMQ workers — must be true in production
START_BULLMQ_WORKERS=true

# Logging
LOG_LEVEL=info
LOG_PRETTY=false

# Observability
SENTRY_DSN=https://[key]@[org].ingest.sentry.io/[project-id]
BETTERSTACK_SOURCE_TOKEN=[token]

# Seeded system admin (used only during first-time seed)
SYSTEM_ADMIN_EMAIL=admin@wendo.co.ke
SYSTEM_ADMIN_PASSWORD=[strong-password]

# Branch coordinates for geofencing
BRANCH_1_NAME=Nyeri Town
BRANCH_1_LAT=-0.421034
BRANCH_1_LNG=36.948930
BRANCH_2_NAME=Kingz
BRANCH_2_LAT=-0.412756
BRANCH_2_LNG=36.952128
```

### 3.2 Frontend (Vercel)

Set all of these in Vercel → Project → Settings → Environment Variables.
Apply to **Production** environment (and **Preview** with staging values).

```bash
NEXT_PUBLIC_API_URL=https://api.wendorms.co.ke
NEXT_PUBLIC_SOCKET_URL=https://api.wendorms.co.ke

# Firebase web config (from Firebase Console → Project Settings → Your apps)
NEXT_PUBLIC_FIREBASE_API_KEY=[api-key]
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=[project-id].firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=[project-id]
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=[project-id].appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=[sender-id]
NEXT_PUBLIC_FIREBASE_APP_ID=[app-id]

# Sentry
NEXT_PUBLIC_SENTRY_DSN=https://[key]@[org].ingest.sentry.io/[project-id]
SENTRY_AUTH_TOKEN=[token]   # for source map upload during build
```

> **Critical:** All `NEXT_PUBLIC_FIREBASE_*` variables must be set **before the first build runs**. The `next.config.mjs` build step bakes these values into the FCM service worker at build time. Missing values will silently break push notifications.

---

## 4. First Deployment — Step by Step

### Step 1 — Prepare the Database

Using the **direct connection string** (not the pooler):

```bash
# From the backend directory
cd backend

# Apply all migrations to production
DATABASE_URL="postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres" \
  npx prisma migrate deploy

# Verify migration succeeded
DATABASE_URL="..." npx prisma migrate status
```

### Step 2 — Seed the System Admin Account

```bash
cd backend
DATABASE_URL="[direct-connection-string]" pnpm seed:admin
```

This creates the initial `SYSTEM_ADMIN` account using `SYSTEM_ADMIN_EMAIL` and `SYSTEM_ADMIN_PASSWORD`. Run once only.

### Step 3 — Import the Master Menu

```bash
cd backend
DATABASE_URL="[direct-connection-string]" pnpm menu:import
```

### Step 4 — Install Sentry on the Backend

```bash
cd backend
pnpm add @sentry/node
```

Initialize Sentry at the top of `src/server.ts`, before any other imports:

```typescript
import * as Sentry from '@sentry/node'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.2,  // capture 20% of transactions for performance
})
```

Add the Sentry error handler in `src/middleware/errorHandler.ts` before the existing global handler:

```typescript
import * as Sentry from '@sentry/node'

// Must be registered before the global error handler
app.use(Sentry.Handlers.errorHandler())
```

### Step 5 — Install Sentry on the Frontend

```bash
cd frontend
pnpm add @sentry/nextjs
```

Run the Sentry wizard (it auto-configures Next.js):

```bash
npx @sentry/wizard@latest -i nextjs
```

### Step 6 — Install Betterstack Log Transport

```bash
cd backend
pnpm add @logtail/pino
```

Update `src/config/logger.ts` to ship logs to Betterstack in production:

```typescript
import { Logtail } from '@logtail/node'
import { LogtailTransport } from '@logtail/pino'
import pino from 'pino'

const isProduction = process.env.NODE_ENV === 'production'

const logger = isProduction && process.env.BETTERSTACK_SOURCE_TOKEN
  ? pino({ level: process.env.LOG_LEVEL ?? 'info' }, pino.multistream([
      { stream: process.stdout },
      { stream: new LogtailTransport(new Logtail(process.env.BETTERSTACK_SOURCE_TOKEN)) },
    ]))
  : pino({
      level: process.env.LOG_LEVEL ?? 'info',
      transport: process.env.LOG_PRETTY === 'true'
        ? { target: 'pino-pretty' }
        : undefined,
    })

export default logger
```

### Step 7 — Deploy the Backend to Railway

1. In Railway, create a new service → **Deploy from GitHub repo**
2. Set the **root directory** to `backend`
3. Set the **build command**: `pnpm install && pnpm build`
4. Set the **start command**: `pnpm start`
5. Add all environment variables from section 3.1
6. Deploy and wait for the first build to complete
7. Assign a custom domain: `api.wendorms.co.ke`
8. Verify the health check: `GET https://api.wendorms.co.ke/health`
   - Expected: `{ "status": "ok", "db": "connected", "redis": "connected" }`

### Step 8 — Deploy the Frontend to Vercel

1. In Vercel, import the GitHub repository
2. Set the **root directory** to `frontend`
3. Add all environment variables from section 3.2
4. Deploy — Vercel will auto-detect Next.js
5. Assign a custom domain: `app.wendorms.co.ke`
6. Verify the login page loads and can authenticate against the backend

### Step 9 — Verify Socket.io

1. Log in as a waiter on a phone
2. Open browser DevTools → Network → WS tab
3. Confirm a WebSocket connection is established to `api.wendorms.co.ke`
4. Submit a test order and confirm it appears on the KDS in real time

### Step 10 — Set Up UptimeRobot

1. Log in to uptimerobot.com
2. Add a new monitor:
   - **Type:** HTTPS
   - **URL:** `https://api.wendorms.co.ke/health`
   - **Interval:** Every 5 minutes
   - **Alert contacts:** Your phone number and email
3. Add a second monitor for the frontend:
   - **URL:** `https://app.wendorms.co.ke`
   - **Interval:** Every 5 minutes

---

## 5. Subsequent Deployments

Both services auto-deploy on merge to `main`. No manual steps required.

```
Developer merges PR to main
        ↓
Railway detects push → builds backend → deploys (zero-downtime rolling deploy)
Vercel detects push  → builds frontend → deploys (atomic, instant swap)
```

If a migration is included in the PR, it must be deployed to the database **before** the new backend version starts — see section 6.

---

## 6. Database Migrations

### Safe Migration Workflow

Never run migrations directly against production without testing on staging first.

```
1. Write migration locally with: pnpm prisma:migrate
2. Test on staging database
3. Merge to main
4. Run migration on production BEFORE Railway deploys the new code:
   DATABASE_URL="[direct-url]" npx prisma migrate deploy
5. Railway deploys the new backend (now safe — schema is already updated)
```

### Rules

- **Never** run `prisma migrate dev` against production — this can drop data
- **Always** use `prisma migrate deploy` on production
- **Always** use the direct connection string (not pooler) for migrations
- Destructive migrations (dropping columns, renaming) require a two-phase deploy:
  - Phase 1: deploy code that works with both old and new schema
  - Phase 2: run the migration
  - Phase 3: deploy code that uses only the new schema

---

## 7. Observability Setup

### 7.1 Sentry — Error Tracking

**What it captures:**
- All unhandled exceptions on the backend (5xx errors)
- Frontend JavaScript errors and crashes
- Full stack traces with request context (userId, organizationId, path)

**Verify it works after deployment:**
```bash
# Temporarily add this to a test route and hit it once, then remove
throw new Error('Sentry test — delete me')
```
Check that the error appears in your Sentry dashboard within 30 seconds.

**Alerting:** Configure Sentry to send an email/Slack notification on first occurrence of a new error type.

---

### 7.2 Betterstack — Log Management

**What it captures:**
- All structured Pino logs shipped from the backend in real time
- Searchable by userId, organizationId, requestId, path, level

**Useful queries in Betterstack:**
```
# All errors in the last hour
level:error

# All requests from a specific branch
organizationId:"[branch-id]"

# Slow queries
message:"Slow query" AND duration:>200

# Failed geofence attempts
message:"geofence" AND level:warn

# Order lifecycle for a specific order
orderId:"[order-id]"
```

**Retention:** Free tier gives 3-day retention. Upgrade to paid ($25/mo) for 30-day retention if post-incident investigation is important.

---

### 7.3 UptimeRobot — Uptime Monitoring

**What it monitors:**
- `GET https://api.wendorms.co.ke/health` — backend health (db + redis connectivity)
- `GET https://app.wendorms.co.ke` — frontend availability

**Alerting:** Sends SMS + email if either monitor goes down. Response time graphs are available on the dashboard.

**The `/health` endpoint checks:**
```json
{
  "status": "ok",
  "db": "connected",
  "redis": "connected",
  "uptime": 86400
}
```
If `db` or `redis` reports disconnected, the health check returns a non-200 status and UptimeRobot triggers an alert.

---

### 7.4 Railway Metrics — Built-in Dashboard

Available automatically on Railway Pro with no setup required.

**What to watch:**
| Metric | What it tells you | Alert threshold |
|---|---|---|
| CPU usage | Backend load | Sustained >70% |
| Memory usage | Memory leaks or spikes | Sustained >80% of limit |
| Network in/out | Traffic volume | Sudden spikes = investigate |
| Deploy history | Which commit is running | — |

**Where to find it:** Railway dashboard → your service → Metrics tab.

---

### 7.5 Audit Trail — Database

Sensitive operations are persisted to the database by the application and are always queryable:

| Operation | Where stored |
|---|---|
| Staff account created/deactivated | `AuditLog` table |
| Manager clock-in overrides | `ClockEvent` table (method: OVERRIDE, reason field) |
| Menu availability changes | `AuditLog` table |
| Payment recorded | `Order` table (paymentMethod, paidAt, paidBy) |

Query audit logs directly via Supabase's SQL editor or Prisma Studio for incident investigation.

---

### 7.6 Observability Summary

| Layer | Tool | Cost | What it answers |
|---|---|---|---|
| Errors | Sentry | Free | What broke and why |
| Logs | Betterstack | Free | What happened and when |
| Uptime | UptimeRobot | Free | Is it up right now |
| Metrics | Railway dashboard | Included in Pro | Is it healthy |
| Audit | PostgreSQL | Included | Who did what |

---

## 8. Health Checks & Uptime Monitoring

### Backend Health Check

```
GET /health
```

Returns `200 OK` when the service is healthy:
```json
{
  "status": "ok",
  "db": "connected",
  "redis": "connected",
  "uptime": 3600
}
```

Returns `503 Service Unavailable` if database or Redis is unreachable. UptimeRobot treats any non-200 as a failure and triggers an alert.

### Railway Health Check Configuration

In Railway → Service → Settings → Health Check:
- **Path:** `/health`
- **Interval:** 30 seconds
- Railway will restart the service automatically if health checks fail 3 times consecutively.

---

## 9. Rollback Procedure

### Backend (Railway)
1. Go to Railway → Project → Service → Deployments
2. Find the last known good deployment
3. Click **Redeploy** on that deployment
4. Railway performs a zero-downtime rollback within ~2 minutes

If the rollback also requires a database migration rollback, that must be done manually via Supabase SQL editor before the old code is redeployed.

### Frontend (Vercel)
1. Go to Vercel → Project → Deployments
2. Find the last known good deployment
3. Click the three-dot menu → **Promote to Production**
4. Vercel swaps the deployment instantly (atomic, zero downtime)

---

## 10. Environments

| Environment | Frontend URL | Backend URL | Database | Trigger |
|---|---|---|---|---|
| Development | localhost:3000 | localhost:4000 | Local PostgreSQL | Manual (`pnpm dev`) |
| Staging | staging.wendorms.co.ke | staging-api.wendorms.co.ke | Supabase staging project | Push to `staging` branch |
| Production | app.wendorms.co.ke | api.wendorms.co.ke | Supabase production project | Merge to `main` |

### Staging Environment

Staging mirrors production exactly. All PRs should be tested on staging before merging to main. Staging uses:
- Its own Supabase project (separate database — never shared with production)
- Its own Upstash Redis database
- Same Firebase project is acceptable for staging (use a separate app registration)
- `NODE_ENV=staging` or `NODE_ENV=development` on the staging backend

---

## 11. Deployment Checklist

Use this checklist for every first deployment to a new environment.

### Infrastructure
- [ ] Supabase project created, connection strings noted
- [ ] Upstash Redis database created, credentials noted
- [ ] Firebase project created, service account JSON downloaded, VAPID key generated
- [ ] Cloudinary account created, credentials noted
- [ ] Railway project created, GitHub repo connected
- [ ] Vercel project created, GitHub repo connected, root directory set to `frontend`
- [ ] Sentry projects created (backend + frontend), DSNs noted
- [ ] Betterstack source created, token noted

### Database
- [ ] `prisma migrate deploy` run against production database (direct connection string)
- [ ] Migration status verified: `npx prisma migrate status`
- [ ] `pnpm seed:admin` run — system admin account created
- [ ] `pnpm menu:import` run — master menu imported

### Backend
- [ ] All environment variables set on Railway (section 3.1)
- [ ] `START_BULLMQ_WORKERS=true` set
- [ ] `FRONTEND_ORIGIN` set to the Vercel production URL
- [ ] Service deployed and build succeeded
- [ ] Custom domain `api.wendorms.co.ke` assigned
- [ ] Health check passing: `GET https://api.wendorms.co.ke/health` returns `200 ok`
- [ ] Railway health check path configured: `/health`
- [ ] Sentry error handler installed and verified
- [ ] Betterstack log transport installed and logs appearing in dashboard

### Frontend
- [ ] All environment variables set on Vercel (section 3.2)
- [ ] All `NEXT_PUBLIC_FIREBASE_*` vars set **before first build**
- [ ] Service deployed and build succeeded
- [ ] Custom domain `app.wendorms.co.ke` assigned
- [ ] Login page loads and authentication works end-to-end
- [ ] Sentry installed and verified on frontend

### Integration
- [ ] CORS working — frontend can call backend (no CORS errors in browser console)
- [ ] WebSocket connecting — confirm in browser DevTools → Network → WS tab
- [ ] Real-time order flow tested: submit order → appears on KDS within 2 seconds
- [ ] Push notification permission prompt appears on login
- [ ] FCM test notification delivered to a device

### Observability
- [ ] UptimeRobot monitor created for `https://api.wendorms.co.ke/health`
- [ ] UptimeRobot monitor created for `https://app.wendorms.co.ke`
- [ ] UptimeRobot alert contacts (email + phone) configured
- [ ] Sentry test error verified — appears in dashboard
- [ ] Betterstack logs appearing in real time
- [ ] Railway metrics dashboard visible

### Security
- [ ] JWT secrets are long random strings (not default placeholder values)
- [ ] System admin password changed from default
- [ ] No `.env` files committed to the repository
- [ ] HTTPS enforced on both domains
- [ ] Refresh token cookie is HTTP-only and Secure in production
