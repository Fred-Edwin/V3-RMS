# Deployment Guide
## Wendo RMS — Restaurant Management System
**Version:** 2.1
**Status:** Live
**Date:** 2026-05-11
**Strategy:** DigitalOcean VPS ($6/mo) + Docker Compose + Vercel (frontend)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Cost Summary](#2-cost-summary)
3. [Live Server Details](#3-live-server-details)
4. [Environment Variables Reference](#4-environment-variables-reference)
5. [Server Setup — Step by Step](#5-server-setup--step-by-step)
6. [First Deployment](#6-first-deployment)
7. [Subsequent Deployments](#7-subsequent-deployments)
8. [Database Operations](#8-database-operations)
9. [Viewing Logs](#9-viewing-logs)
10. [Accessing the Database](#10-accessing-the-database)
11. [Backups](#11-backups)
12. [Seeding Demo Data](#12-seeding-demo-data)
13. [Tunnel](#13-tunnel)
14. [Rollback Procedure](#14-rollback-procedure)
15. [Scaling Triggers](#15-scaling-triggers)
16. [Local Development Runbook](#16-local-development-runbook)

---

## 1. Architecture Overview

```
STAFF DEVICES (browsers, phones, tablets)
        │
        ▼
┌───────────────────┐
│      Vercel       │   Next.js frontend — served globally via CDN
│  (free tier)      │
└────────┬──────────┘
         │ HTTPS API calls + WebSocket
         ▼
┌─────────────────────────────────────────┐
│         Cloudflare Named Tunnel         │   Permanent URL — never changes
│   https://api.wendo-rms.co.ke           │   DDoS protection + SSL
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│     DigitalOcean Droplet                │
│     $6/mo — Frankfurt (FRA1)            │
│     Ubuntu 24.04 LTS                    │
│     IP: 104.248.29.42                   │
│                                         │
│  ┌──────────────────────────────────┐   │
│  │  Nginx (reverse proxy)           │   │
│  │  port 80 → Docker port 4000      │   │
│  │  WebSocket upgrade supported     │   │
│  └──────────────┬───────────────────┘   │
│                 │                       │
│  ┌──────────────▼───────────────────┐   │
│  │  Docker Compose                  │   │
│  │                                  │   │
│  │  wendo-api      (port 4000)      │   │
│  │  wendo-worker   (BullMQ jobs)    │   │
│  │  wendo-postgres (port 5432)      │   │
│  │  wendo-redis    (port 6379)      │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  External Services (all free tiers)     │
│  Cloudinary  — menu item image storage  │
│  Firebase    — push notifications (FCM) │
│  UptimeRobot — uptime monitoring        │
└─────────────────────────────────────────┘
```

### Key Design Decisions

- **Custom domain** — `api.wendo-rms.co.ke` via Cloudflare named tunnel. URL is permanent and never changes on reboot.
- **All backend services on one machine** — PostgreSQL, Redis, API, and worker run on the same Droplet with no network hops between them. This is why the app is fast.
- **Swap file** — 2GB swap added to prevent OOM kills during Docker builds on the 1GB RAM Droplet.
- **pnpm** — package manager used throughout. Do not use npm or yarn.

---

## 2. Cost Summary

| Service | Provider | Cost |
|---|---|---|
| VPS (API + DB + Redis) | DigitalOcean $6 Droplet | $6.00/mo |
| Droplet backups | DigitalOcean (20% of Droplet) | $1.20/mo |
| Frontend | Vercel free tier | $0 |
| SSL + Tunnel | Cloudflare free tier | $0 |
| Images | Cloudinary free tier | $0 |
| Push notifications | Firebase FCM free tier | $0 |
| Uptime monitoring | UptimeRobot free tier | $0 |
| **Total** | | **$7.20/mo** |

---

## 3. Live Server Details

| Item | Value |
|---|---|
| Droplet IP | `104.248.29.42` |
| SSH user | `edwinfred` |
| App directory | `/home/edwinfred/wendo-rms` |
| Backend `.env` | `/home/edwinfred/wendo-rms/backend/.env` |
| Root `.env` | `/home/edwinfred/wendo-rms/.env` (contains `POSTGRES_PASSWORD` only) |
| Cloudflare tunnel log | `/home/edwinfred/cloudflared.log` |
| API URL | `https://api.wendo-rms.co.ke` (permanent — Cloudflare named tunnel) |
| Vercel project | `https://v3-rms.vercel.app` |
| Docker network | `wendo-rms_wendo-network` |

### SSH Access

```bash
ssh edwinfred@104.248.29.42
```

---

## 4. Environment Variables Reference

### 4.1 Backend `.env` — `/home/edwinfred/wendo-rms/backend/.env`

> **Never commit this file to git.**

```bash
# Server
NODE_ENV=production
PORT=4000
API_PREFIX=/api/v1
FRONTEND_ORIGIN=https://v3-rms.vercel.app

# Database — connects to the postgres container by service name
DATABASE_URL=postgresql://wendo_user:POSTGRES_PASSWORD@postgres:5432/wendo_rms

# Redis — connects to the redis container by service name
REDIS_URL=redis://wendo-redis:6379

# JWT — generate with: openssl rand -hex 64
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
BCRYPT_ROUNDS=12

# Postgres — must match DATABASE_URL password above
# Also required in the root .env file for docker-compose
POSTGRES_PASSWORD=

# Firebase
FIREBASE_SERVICE_ACCOUNT_JSON=
VAPID_KEY=

# Cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_URL=

# Rate limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=200

# BullMQ — overridden per container in docker-compose.yml
START_BULLMQ_WORKERS=false

# Logging
LOG_LEVEL=info
LOG_PRETTY=false

# Sentry
SENTRY_DSN=

# Seed scripts — used only during setup
SYSTEM_ADMIN_EMAIL=
SYSTEM_ADMIN_PASSWORD=

# Feature flags
SKIP_SHIFT_VALIDATION=false
ALLOW_PRODUCTION_SEED=false
SEED_REPORTS_CONFIRM=NO
```

### 4.2 Root `.env` — `/home/edwinfred/wendo-rms/.env`

Docker Compose reads this file for the `${POSTGRES_PASSWORD}` variable used by the postgres container:

```bash
POSTGRES_PASSWORD=your_strong_password_here
```

### 4.3 Frontend Environment Variables (Vercel Dashboard)

Set these in Vercel → Project → Settings → Environment Variables:

```bash
NEXT_PUBLIC_API_URL=https://YOUR_TUNNEL_URL/api/v1
NEXT_PUBLIC_SOCKET_URL=https://YOUR_TUNNEL_URL

NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

After updating these, redeploy:

```bash
vercel --prod
```

---

## 5. Server Setup — Step by Step

This section documents what was done to set up the server from scratch. Follow these steps if rebuilding from zero.

### Step 1 — Create the Droplet

1. Log in to digitalocean.com
2. Create → Droplets:
   - **Region:** Frankfurt (FRA1)
   - **OS:** Ubuntu 24.04 LTS
   - **Plan:** Basic — Regular SSD — $6/mo (1 vCPU, 1 GB RAM, 25 GB SSD)
   - **Authentication:** SSH Key
   - **Backups:** Enable ($1.20/mo)
3. Note the IP address

### Step 2 — First Login and User Setup

```bash
# SSH in as root
ssh root@YOUR_IP

# Create non-root user
adduser edwinfred
usermod -aG sudo edwinfred

# Copy SSH key to new user
rsync --archive --chown=edwinfred:edwinfred ~/.ssh /home/edwinfred

# Test new user in a new terminal before closing root session
ssh edwinfred@YOUR_IP
```

### Step 3 — Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

### Step 4 — Add Swap (critical on 1GB RAM — prevents OOM during Docker builds)

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Verify
free -h
# Should show Swap: 2.0G
```

### Step 5 — Install Docker

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin

# Add user to docker group
sudo usermod -aG docker edwinfred

# Log out and back in for group change to take effect
exit
```

### Step 6 — Install Nginx

```bash
sudo apt-get install -y nginx

# Create Wendo config
sudo rm /etc/nginx/sites-enabled/default
sudo nano /etc/nginx/sites-available/wendo-rms
```

Paste this nginx config:

```nginx
server {
    listen 80;
    server_name _;

    client_max_body_size 10M;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/wendo-rms /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Step 7 — Install Cloudflare Tunnel

```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb \
  -o cloudflared.deb
sudo dpkg -i cloudflared.deb

# Add to crontab so it starts on reboot
(crontab -l 2>/dev/null; echo "@reboot sleep 10 && cloudflared tunnel --url http://localhost:80 >> /home/edwinfred/cloudflared.log 2>&1") | crontab -
```

Start the tunnel manually (first time):

```bash
cloudflared tunnel --url http://localhost:80
```

Note the `trycloudflare.com` URL it prints — you'll need it for Vercel env vars.

### Step 8 — Clone the Repository

```bash
# Generate a deploy key
ssh-keygen -t ed25519 -C "wendo-rms-droplet" -f ~/.ssh/deploy_key -N ""

# Print the public key — add it to GitHub → repo → Settings → Deploy keys
cat ~/.ssh/deploy_key.pub

# Configure SSH to use the deploy key for GitHub
cat >> ~/.ssh/config << 'EOF'

Host github.com
  HostName github.com
  IdentityFile ~/.ssh/deploy_key
  IdentitiesOnly yes
EOF

# Clone
cd ~
git clone git@github.com:YOUR_USERNAME/YOUR_REPO.git wendo-rms
cd wendo-rms
chmod +x deploy.sh
```

### Step 9 — Create Environment Files

```bash
# Backend env
nano ~/wendo-rms/backend/.env
# Paste all values from Section 4.1

# Root env (for POSTGRES_PASSWORD used by docker-compose)
nano ~/wendo-rms/.env
# Add: POSTGRES_PASSWORD=your_password
```

---

## 6. One-Time Server Setup for Image Pulling

The server no longer builds Docker images. It pulls pre-built images from GitHub Container Registry (ghcr.io). This one-time setup is required after provisioning a new server.

### Authenticate Docker to ghcr.io

1. Create a GitHub Personal Access Token (PAT):
   - GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Scopes required: `read:packages`
   - Name: `wendo-server-ghcr-pull`

2. SSH into the server and log in:

```bash
echo "YOUR_PAT_VALUE" | docker login ghcr.io -u fred-edwin --password-stdin
# Expected: Login Succeeded
```

This writes credentials to `~/.docker/config.json` and persists until you explicitly log out. Docker will use these credentials for all subsequent `docker pull ghcr.io/fred-edwin/*` operations.

### GitHub Actions — Required Repository Setting

Go to: GitHub → Fred-Edwin/V3-RMS → Settings → Actions → General → Workflow permissions

Set to: **Read and write permissions**

This allows the `GITHUB_TOKEN` (auto-provided by GitHub Actions) to push packages to ghcr.io without a separate PAT.

---

## 6a. First Deployment

```bash
cd ~/wendo-rms

# Start postgres and redis first
docker compose up -d postgres redis

# Wait for both to be healthy
docker compose ps

# IMAGE_TAG must be set before starting api/worker.
# Get the SHA tag from the first GitHub Actions build run, then:
echo "IMAGE_TAG=sha-<first-commit-sha>" >> .env

# Pull and start api and worker (fast — no compilation on server)
IMAGE_TAG=sha-<first-commit-sha> docker compose pull api worker
IMAGE_TAG=sha-<first-commit-sha> docker compose up -d api worker

# Check all 4 containers are running
docker compose ps

# Run database migrations
docker compose exec api npx prisma migrate deploy

# Seed the system admin account
docker compose exec api node dist/scripts/seed-admin.js

# Verify the API is responding
curl http://localhost:4000/api/v1/auth/login \
  -X POST -H "Content-Type: application/json" \
  -d '{"email":"test","password":"test"}'
# Expected: validation error JSON (not a connection error)
```

### Update Vercel

```bash
# On your local machine
vercel env rm NEXT_PUBLIC_API_URL production
vercel env rm NEXT_PUBLIC_SOCKET_URL production
vercel env add NEXT_PUBLIC_API_URL production   # enter: https://YOUR_TUNNEL_URL/api/v1
vercel env add NEXT_PUBLIC_SOCKET_URL production # enter: https://YOUR_TUNNEL_URL
vercel --prod
```

---

## 7. Subsequent Deployments

### Automated (recommended)

Every push to `main` triggers a GitHub Actions workflow (`validate` → `build` → `deploy`):

1. **validate** — installs dependencies, compiles TypeScript, runs tests and frontend typecheck
2. **build** — builds the Docker image on the GitHub Actions runner (not the server), pushes to `ghcr.io/fred-edwin/v3-rms-backend:sha-<commit>` using BuildKit layer cache
3. **deploy** — SSHs into the Droplet, calls `bash deploy.sh <image-tag>`:
   - Pulls latest repo files (`git pull`)
   - Pulls the pre-built image from ghcr.io
   - Runs `prisma migrate deploy` as a one-off container from the **new** image (before swapping live containers)
   - Restarts `api` and `worker` — `postgres` and `redis` keep running, no data risk
   - Health checks `/api/v1/health` — fails the deploy if the API doesn't come up
   - Cleans up dangling image layers

Monitor runs at: GitHub → repo → **Actions** tab, or from your terminal:

```powershell
gh run watch          # live output for the current run
gh run list --branch main --limit 5   # post-merge deploy status
```

### Manual (if needed)

SSH in and run:

```bash
cd ~/wendo-rms
bash deploy.sh sha-<commit-sha>
```

Find the tag from: `docker images ghcr.io/fred-edwin/v3-rms-backend` or GitHub Actions run history.

**Important:** Never edit files in `~/wendo-rms` directly on the server. All changes go through git. The only files safe to edit on the server are `.env` files (gitignored).

---

## 8. Database Operations

### Run Migrations

```bash
docker compose exec api npx prisma migrate deploy
```

### Check Migration Status

```bash
docker compose exec api npx prisma migrate status
```

### Rules

- **Never** run `prisma migrate dev` on the server — it can drop data
- **Always** run migrations **before** deploying new code, not after
- For destructive changes (dropping columns): deploy backward-compatible code first, then migrate, then deploy the clean code

---

## 9. Viewing Logs

### From your local machine (recommended)

Use the convenience scripts in `scripts/`:

```powershell
# Stream api logs (default)
.\scripts\logs.ps1

# Stream worker logs
.\scripts\logs.ps1 worker

# Last 100 lines then stream
.\scripts\logs.ps1 api 100
```

### Directly on the server

```bash
cd ~/wendo-rms

# Live streaming logs
docker compose logs api -f
docker compose logs worker -f

# Last N lines
docker compose logs api --tail=50
docker compose logs worker --tail=50

# All containers
docker compose logs -f

# Container resource usage
docker stats
```

**When to check which:**
- API errors or unexpected responses → `api` logs
- Push notifications not arriving, background tasks failing → `worker` logs

---

## 10. Accessing the Database

### Option A — psql CLI (always available)

```bash
docker exec -it wendo-postgres psql -U wendo_user -d wendo_rms
```

Useful commands inside psql:
- `\dt` — list all tables
- `SELECT COUNT(*) FROM menu_items;` — query data
- `\q` — quit

### Option B — Prisma Studio (visual, from local machine)

Important:
- Run `.\scripts\db-studio.ps1` from your local Windows machine (PowerShell), not from the Ubuntu server shell.
- Do not SSH into the server and try to run `.ps1` scripts there; Ubuntu/bash cannot execute PowerShell `.ps1` scripts by default.

Use the convenience scripts:

```powershell
# Production DB (opens SSH tunnel first)
.\scripts\db-studio.ps1

# Local Docker DB
.\scripts\db-studio-local.ps1
```

`db-studio-local.ps1` expects local Postgres to be exposed on host port `5433` via `docker-compose.yml`.
If this is your first time after pulling compose changes, recreate postgres:

```powershell
docker compose up -d --force-recreate postgres
```

For production, `.\scripts\db-studio.ps1` opens the SSH tunnel and launches Studio in one command:

```powershell
.\scripts\db-studio.ps1
# prompts for Postgres password → opens tunnel → launches Studio
```

Opens at `http://localhost:5555`. Closing Studio automatically kills the tunnel.

If you are already on the Ubuntu server and just need to inspect production data quickly, use server-side `psql` instead:

```bash
cd ~/wendo-rms
docker compose exec postgres psql -U wendo_user -d wendo_rms
```

**Manual steps (if the script fails):**

Step 1 — Open an SSH tunnel in one terminal (keep it running):

```bash
ssh -L 5433:localhost:5433 edwinfred@104.248.29.42 -N
```

Step 2 — Run Prisma Studio in another terminal:

```powershell
cd "d:\AI applications\web\V3-RMS\backend"
$env:DATABASE_URL="postgresql://wendo_user:YOUR_PASSWORD@localhost:5433/wendo_rms"
pnpm prisma studio
```

---

## 11. Backups

### Why This Matters

PostgreSQL data lives in a Docker named volume (`postgres_data`). If the Droplet is destroyed without a snapshot, data is lost. DigitalOcean weekly snapshots protect against server failure, but you also need daily database dumps for granular recovery.

### Set Up Daily Backup

```bash
# Create backup directory
mkdir -p /home/edwinfred/backups/wendo

# Create backup script
nano ~/backup.sh
```

Paste:

```bash
#!/usr/bin/env bash
set -e

BACKUP_DIR=/home/edwinfred/backups/wendo
DATE=$(date +%Y-%m-%d_%H-%M)
BACKUP_FILE="$BACKUP_DIR/wendo_rms_$DATE.sql.gz"
RETAIN_DAYS=14

echo "[$DATE] Starting backup..."

docker compose -f /home/edwinfred/wendo-rms/docker-compose.yml exec -T postgres \
  pg_dump -U wendo_user wendo_rms | gzip > "$BACKUP_FILE"

echo "[$DATE] Backup written: $BACKUP_FILE ($(du -sh $BACKUP_FILE | cut -f1))"

find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$RETAIN_DAYS -delete
echo "[$DATE] Cleaned up backups older than $RETAIN_DAYS days. Done."
```

```bash
chmod +x ~/backup.sh

# Test it
~/backup.sh
ls -lh /home/edwinfred/backups/wendo/

# Schedule at 2am daily
(crontab -l 2>/dev/null; echo "0 2 * * * /home/edwinfred/backup.sh >> /home/edwinfred/backups/wendo/backup.log 2>&1") | crontab -
```

### Restore from Backup

```bash
# Stop API to prevent writes during restore
docker compose stop api worker

# Restore
gunzip -c /home/edwinfred/backups/wendo/BACKUP_FILE.sql.gz | \
  docker compose exec -T postgres psql -U wendo_user -d wendo_rms

# Restart
docker compose start api worker
```

---

## 12. Seeding Demo Data

The seed script generates realistic synthetic data for demos and testing. It creates fake orders, prep tickets, shift assignments, and clock-in/out records across all active branches.

**Important:** This is fake data for demos only — it never modifies real staff, menu items, or branches.

### What it creates

| Data | Description |
|---|---|
| **Orders** | Customer orders (DINE_IN, TAKE_AWAY, DELIVERY) with timestamps, payment methods, totals |
| **Order Items** | Items attached to each order, picked from the real menu |
| **Prep Tickets** | Kitchen/barista tickets for each order |
| **Shift Assignments** | Staff assigned to shifts for today |
| **Clock Records** | Clock-in/out times (~70% on-time, ~15% late, ~10% no-show, ~5% left early) |

### Seed data (run on the server)

```bash
cd ~/wendo-rms
docker compose exec api sh -c "SEED_REPORTS_CONFIRM=YES ALLOW_PRODUCTION_SEED=true node dist/scripts/seed-report-orders.js --days=7 --min-orders=12 --max-orders=30"
```

### Delete all seed data (without re-seeding)

```bash
docker compose exec api sh -c "SEED_REPORTS_CONFIRM=YES ALLOW_PRODUCTION_SEED=true node dist/scripts/seed-report-orders.js --reset-only"
```

### Delete and re-seed fresh data

```bash
docker compose exec api sh -c "SEED_REPORTS_CONFIRM=YES ALLOW_PRODUCTION_SEED=true node dist/scripts/seed-report-orders.js --days=7 --min-orders=12 --max-orders=30 --reset"
```

### Available flags

| Flag | Default | Description |
|---|---|---|
| `--days=N` | 20 | Days of order history to generate |
| `--min-orders=N` | 6 | Minimum orders per day per branch |
| `--max-orders=N` | 18 | Maximum orders per day per branch |
| `--seed=N` | 42 | Random seed — same number produces same data |
| `--reset` | off | Delete existing seed data before inserting new data |
| `--reset-only` | off | Delete existing seed data and stop — no new data created |
| `--org=<id>` | all | Limit to a specific organization ID |

### Prerequisites

- Shifts must exist for each organization — the clock seeding skips orgs with no active shifts
- Active staff must exist — the script distributes orders and clock records across real staff accounts
- Active menu items must exist — orders are built from the real menu

---

## 13. Tunnel

The API is exposed via a **Cloudflare named tunnel** at `https://api.wendo-rms.co.ke`. This URL is permanent and never changes on reboot or redeploy.

The tunnel runs as a systemd service and auto-starts on every server reboot:

```bash
# Check tunnel status
sudo systemctl status cloudflared

# Restart if needed
sudo systemctl restart cloudflared
```

Tunnel config: `/etc/cloudflared/config.yml`
Tunnel credentials: `/etc/cloudflared/<tunnel-id>.json`

### Vercel Environment Variables (already set — permanent)

```
NEXT_PUBLIC_API_URL=https://api.wendo-rms.co.ke/api/v1
NEXT_PUBLIC_SOCKET_URL=https://api.wendo-rms.co.ke
```

---

## 14. Rollback Procedure

### Application Rollback

Images for every deploy are stored in ghcr.io and tagged by git SHA. Rollback is instant — no rebuild required.

```bash
# SSH into the server
cd ~/wendo-rms

# Find the previous working SHA tag (either from GitHub Actions history
# or by listing locally cached images)
docker images ghcr.io/fred-edwin/v3-rms-backend

# Roll back to that tag
bash deploy.sh sha-<previous-sha>
```

The deploy script will pull the old image (already cached if it was recently used), run migrations (no-op if schema is unchanged), and restart containers.

### Database Rollback

```bash
docker compose stop api worker

gunzip -c /opt/backups/wendo/BACKUP_FILE.sql.gz | \
  docker compose exec -T postgres psql -U wendo_user -d wendo_rms

docker compose start api worker
```

### Full Server Recovery (Droplet destroyed)

1. Go to DigitalOcean → Backups → Restore latest snapshot to a new Droplet
2. SSH in — all data and containers are restored from the snapshot
3. Start containers: `cd ~/wendo-rms && docker compose up -d`
4. Get the new tunnel URL from `cloudflared.log` and update Vercel

---

## 15. Scaling Triggers

Do not upgrade anything until these conditions are met:

| Condition | Action |
|---|---|
| Memory consistently >85% (`docker stats`) | Upgrade Droplet to $12/mo (2 GB RAM) |
| Disk >80% (`df -h`) | Attach DigitalOcean Block Storage, move `postgres_data` volume |
| DB queries slow >500ms avg | Move to DigitalOcean Managed PostgreSQL ($15/mo) |
| Multiple devs deploying | Add branch protection + required PR reviews |
| >5 branches, >100 concurrent users | Add Socket.io Redis adapter + load balancer |

---

## 16. Local Development Runbook

Use this when running the project fully on `localhost`.

### Prerequisites

1. Docker Desktop is running.
2. `pnpm` is installed.
3. `backend/.env` exists with `localhost` URLs (see below) and is valid dotenv format.
4. Root `.env` exists with `POSTGRES_PASSWORD=...` for Docker Compose interpolation.

### backend/.env — Local Hostnames

When running the backend directly on your machine (not in Docker), these two
values must point to `localhost`, not Docker service names:

```dotenv
DATABASE_URL=postgresql://wendo_user:PASSWORD@localhost:5433/wendo_rms
REDIS_URL=redis://localhost:6379
```

The production server's `backend/.env` uses `postgres` and `wendo-redis` — correct
there, wrong here. Your local file is gitignored so changes never reach production.

### Local Startup

Docker runs only infrastructure. The API runs directly for instant hot-reload.

**Terminal 1 — infrastructure only:**

```powershell
Set-Location "d:\AI applications\web\V3-RMS"
docker compose up -d postgres redis
```

**Terminal 2 — backend (hot-reloads on every file save):**

```powershell
Set-Location "d:\AI applications\web\V3-RMS\backend"
pnpm dev
```

**Terminal 3 — frontend:**

```powershell
Set-Location "d:\AI applications\web\V3-RMS\frontend"
pnpm dev
```

Health check:

```powershell
Invoke-RestMethod http://localhost:4000/api/v1/health
```

Open:
- Frontend: `http://localhost:3000`
- API: `http://localhost:4000/api/v1`
- Socket endpoint: `http://localhost:4000`

### First-Time DB Setup (if needed)

```powershell
Set-Location "d:\AI applications\web\V3-RMS"
docker compose exec api npx prisma migrate deploy
docker compose exec api node dist/scripts/seed-admin.js
```

### Test on Phone (Same Wi-Fi, Localhost Stack)

`localhost` on your phone points to the phone itself, not your laptop. Use your laptop LAN IP.

1. Find your laptop IP:

```powershell
ipconfig
```

Use the IPv4 address on your active Wi-Fi adapter (example: `192.168.0.105`).

2. Update frontend env for LAN access (`frontend/.env`):

```dotenv
NEXT_PUBLIC_API_URL=http://192.168.0.105:4000/api/v1
NEXT_PUBLIC_SOCKET_URL=http://192.168.0.105:4000
```

3. Update backend CORS origin (`backend/.env`):

```dotenv
FRONTEND_ORIGIN=http://192.168.0.105:3000
```

4. Recreate backend containers to reload env:

```powershell
Set-Location "d:\AI applications\web\V3-RMS"
docker compose up -d --force-recreate api worker
```

5. Start frontend bound to all interfaces:

```powershell
Set-Location "d:\AI applications\web\V3-RMS\frontend"
pnpm dev -- -H 0.0.0.0 -p 3000
```

6. Open on phone browser:

```text
http://192.168.0.105:3000
```

If it does not open, allow Node/Docker through Windows Firewall for Private networks.

After phone testing, you can switch envs back to localhost values for normal desktop-only local dev.

### Import Production DB Data Into Local

Yes: after `docker compose down -v`, your local DB volume is new/empty (except whatever you seed/import after).

Use a one-off SQL snapshot from production and restore it into local Postgres.

1. Ensure local DB containers are up:

```powershell
Set-Location "d:\AI applications\web\V3-RMS"
docker compose up -d postgres redis
```

2. Export production DB to a local SQL file (run from your local machine):

```powershell
ssh edwinfred@104.248.29.42 "cd ~/wendo-rms && docker compose exec -T postgres pg_dump -U wendo_user -d wendo_rms" > .\prod_snapshot.sql
```

3. Restore into local Postgres container:

```powershell
docker cp .\prod_snapshot.sql wendo-postgres:/tmp/prod_snapshot.sql
docker compose exec postgres psql -U wendo_user -d wendo_rms -f /tmp/prod_snapshot.sql
```

4. Start app services:

```powershell
docker compose up -d api worker
Invoke-RestMethod http://localhost:4000/api/v1/health
```

Notes:
- Do not run `seed-admin` after importing production data unless you intentionally need another admin record.
- Treat production snapshots as sensitive data. Store locally only as needed and delete when done:

```powershell
Remove-Item .\prod_snapshot.sql
```

### Common Local Errors

1. `POSTGRES_PASSWORD variable is not set`
- Cause: missing root `.env`.
- Fix: create `d:\AI applications\web\V3-RMS\.env` with:
```dotenv
POSTGRES_PASSWORD=your_password
```

2. `ENOTFOUND wendo-redis` or `ECONNREFUSED 127.0.0.1:6379`
- Cause: `backend/.env` has Docker-internal hostnames (`postgres`, `wendo-redis`) but the backend is running directly on your machine.
- Fix: update `backend/.env` to use `localhost:5433` for Postgres and `localhost:6379` for Redis. Also ensure `docker-compose.override.yml` exposes Redis on port 6379.

3. `failed to read backend/.env ... unexpected character "/" in variable name`
- Cause: invalid/multiline content in `.env` (commonly pasted SSH private keys).
- Fix: keep `.env` entries as single-line `KEY=value` only. Remove SSH keys and other non-env blocks from `backend/.env`.

4. `open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified`
- Cause: Docker Desktop daemon is not running.
- Fix: start Docker Desktop, wait for it to initialize, then rerun `docker compose up -d ...`.
