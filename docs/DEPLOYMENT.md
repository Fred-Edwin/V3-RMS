# Deployment Guide
## Wendo RMS — Restaurant Management System
**Version:** 2.0
**Status:** Live
**Date:** 2026-03-02
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
12. [Tunnel URL Changes](#12-tunnel-url-changes)
13. [Rollback Procedure](#13-rollback-procedure)
14. [Scaling Triggers](#14-scaling-triggers)

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

## 6. First Deployment

```bash
cd ~/wendo-rms

# Start postgres and redis first
docker compose up -d postgres redis

# Wait for both to be healthy
docker compose ps

# Start api and worker (this builds the Docker images — takes ~4 minutes on first run)
docker compose up -d api worker

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

Every push to `main` triggers a GitHub Actions workflow that automatically:
1. Runs `prisma migrate deploy` (no-op if no new migrations)
2. Pulls latest code on the server
3. Rebuilds `api` and `worker` images
4. Restarts containers — `postgres` and `redis` keep running, no data risk
5. Health checks `/api/v1/health` — fails the deploy if the API doesn't come up
6. Cleans up old Docker images

Monitor runs at: GitHub → repo → **Actions** tab.

### Manual (if needed)

SSH in and run:

```bash
cd ~/wendo-rms
bash deploy.sh
```

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

Use the convenience script — it opens the SSH tunnel and launches Studio in one command:

```powershell
.\scripts\db-studio.ps1
# prompts for Postgres password → opens tunnel → launches Studio
```

Opens at `http://localhost:5555`. Closing Studio automatically kills the tunnel.

**Manual steps (if the script fails):**

Step 1 — Open an SSH tunnel in one terminal (keep it running):

```bash
ssh -L 5433:localhost:5432 edwinfred@104.248.29.42 -N
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

## 12. Tunnel

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

## 13. Rollback Procedure

### Application Rollback

```bash
cd ~/wendo-rms

# Find the last working commit
git log --oneline -10

# Check out that commit
git checkout COMMIT_HASH

# Rebuild and restart
docker compose build api worker
docker compose up -d --no-deps api worker

# Verify
curl http://localhost:4000/api/v1/auth/login \
  -X POST -H "Content-Type: application/json" \
  -d '{"email":"test","password":"test"}'
```

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

## 14. Scaling Triggers

Do not upgrade anything until these conditions are met:

| Condition | Action |
|---|---|
| Memory consistently >85% (`docker stats`) | Upgrade Droplet to $12/mo (2 GB RAM) |
| Disk >80% (`df -h`) | Attach DigitalOcean Block Storage, move `postgres_data` volume |
| DB queries slow >500ms avg | Move to DigitalOcean Managed PostgreSQL ($15/mo) |
| Multiple devs deploying | Add branch protection + required PR reviews |
| >5 branches, >100 concurrent users | Add Socket.io Redis adapter + load balancer |