# Deployment Guide
## Wendo Coffee Bistro — Restaurant Management System (RMS)
**Version:** 2.0
**Status:** Active
**Date:** 2026-03-01
**Strategy:** DigitalOcean VPS ($6/mo) + Docker Compose + Vercel (frontend)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Cost Summary](#2-cost-summary)
3. [Services & Accounts Required](#3-services--accounts-required)
4. [Environment Variables Reference](#4-environment-variables-reference)
5. [Server Setup — Step by Step](#5-server-setup--step-by-step)
6. [Docker Files](#6-docker-files)
7. [First Deployment](#7-first-deployment)
8. [Subsequent Deployments](#8-subsequent-deployments)
9. [Database Migrations](#9-database-migrations)
10. [Backups](#10-backups)
11. [Observability Setup](#11-observability-setup)
12. [Rollback Procedure](#12-rollback-procedure)
13. [Scaling Triggers](#13-scaling-triggers)
14. [Deployment Checklist](#14-deployment-checklist)

---

## 1. Architecture Overview

```
STAFF DEVICES (browsers, phones, tablets)
        │
        ▼
┌───────────────────┐         ┌──────────────────────────┐
│      Vercel       │         │       Cloudflare          │
│  v3-rms.vercel.app│         │  ├── DDoS protection      │
│                   │         │  ├── SSL termination       │
│  Next.js Frontend │         │  └── Tunnel → Droplet     │
│  FREE             │         │  FREE                     │
└───────────────────┘         └───────────┬──────────────┘
                                          │ Cloudflare Tunnel (HTTPS)
                                          ▼
                               ┌─────────────────────────┐
                               │  DigitalOcean Droplet    │
                               │  $6/month — Frankfurt    │
                               │  Ubuntu 24.04 LTS        │
                               │                          │
                               │  ┌─────────────────────┐│
                               │  │       Nginx          ││
                               │  │  (reverse proxy,     ││
                               │  │   WebSocket support) ││
                               │  └──────────┬──────────┘│
                               │             │            │
                               │  ┌──────────▼──────────┐│
                               │  │   Docker Compose     ││
                               │  │                      ││
                               │  │  ┌────────────────┐  ││
                               │  │  │  wendo-api     │  ││
                               │  │  │  (port 4000)   │  ││
                               │  │  │  Node.js +     │  ││
                               │  │  │  Express +     │  ││
                               │  │  │  Socket.io     │  ││
                               │  │  └────────────────┘  ││
                               │  │  ┌────────────────┐  ││
                               │  │  │  wendo-worker  │  ││
                               │  │  │  BullMQ jobs   │  ││
                               │  │  └────────────────┘  ││
                               │  │  ┌────────────────┐  ││
                               │  │  │  postgres      │  ││
                               │  │  │  (port 5432)   │  ││
                               │  │  └────────────────┘  ││
                               │  │  ┌────────────────┐  ││
                               │  │  │  redis         │  ││
                               │  │  │  (port 6379)   │  ││
                               │  │  └────────────────┘  ││
                               │  └─────────────────────┘│
                               └─────────────────────────┘
                                          │
                               ┌──────────▼──────────────┐
                               │   External Services      │
                               │  Firebase FCM — FREE     │
                               │  Cloudinary — FREE       │
                               │  UptimeRobot — FREE      │
                               │  Sentry — FREE           │
                               │  Betterstack — FREE      │
                               └─────────────────────────┘
```

### How Each Piece Fits Together

| Component | Technology | Role |
|---|---|---|
| Frontend | Vercel (free) | Serves the Next.js app globally via CDN |
| Tunnel + SSL | Cloudflare (free) | Exposes the VPS backend securely over HTTPS without a custom domain |
| Reverse Proxy | Nginx (on Droplet) | Routes HTTP/WebSocket traffic to Docker containers |
| API server | Docker: `wendo-api` | Express + Socket.io on port 4000 |
| Background jobs | Docker: `wendo-worker` | BullMQ processors (shift reminders, daily reports) |
| Database | Docker: `postgres` | PostgreSQL 16, data persisted on a named volume |
| Cache / Queue | Docker: `redis` | Redis 7, data persisted on a named volume |
| Images | Cloudinary | Menu item image storage and CDN |
| Push notifications | Firebase FCM | Android push to waiters and staff |

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
| Error tracking | Sentry free tier | $0 |
| Log management | Betterstack free tier | $0 |
| Uptime monitoring | UptimeRobot free tier | $0 |
| **Total** | | **$7.20/mo** |

---

## 3. Services & Accounts Required

You already have most of these. Verify each one before starting.

### 3.1 DigitalOcean
- Account at digitalocean.com
- **Add billing** before creating a Droplet (credit card or PayPal)
- Enable **Droplet Backups** when creating — adds $1.20/mo for weekly automated snapshots

### 3.2 Cloudflare
- Account at cloudflare.com — you already have this
- No domain needed — using a Cloudflare Quick Tunnel (`*.trycloudflare.com`)
- **Current tunnel URL:** `https://restaurants-agricultural-juan-candidate.trycloudflare.com`
- Note: quick tunnel URLs change on every restart — update Vercel env vars when this happens

### 3.3 Firebase (already configured)
- Project `v3-rms` — already set up
- Keep your existing `FIREBASE_SERVICE_ACCOUNT_JSON` and `VAPID_KEY`

### 3.4 Cloudinary (already configured)
- Keep your existing `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

### 3.5 Sentry
- Account at sentry.io
- Create two projects: `wendo-rms-backend` (Node.js) and `wendo-rms-frontend` (Next.js)
- Note the DSN for each — you already have the backend DSN in your `.env`

### 3.6 Betterstack
- Account at betterstack.com
- Logs → Create new source → select Node.js
- Note the `BETTERSTACK_SOURCE_TOKEN`

### 3.7 UptimeRobot
- Account at uptimerobot.com
- Set up monitors after the server is live (Step 7.9)

### 3.8 Vercel (already configured)
- Project at v3-rms.vercel.app — already set up
- You will only need to update two environment variables (the API and WebSocket URLs)

---

## 4. Environment Variables Reference

### 4.1 Server `.env` (lives on the Droplet only — never committed to git)

Create this file at `/home/edwinfred/wendo-rms/backend/.env` on the server.

> **Security notice:** Before going live, generate new `JWT_ACCESS_SECRET` and
> `JWT_REFRESH_SECRET` values. Use: `openssl rand -hex 64`
> Your current secrets were shared in a chat and should be rotated.

```bash
# Server
NODE_ENV=production
PORT=4000
API_PREFIX=/api/v1
FRONTEND_ORIGIN=https://v3-rms.vercel.app

# Database — points to the Docker postgres container on the same network
# CHOOSE_A_STRONG_PASSWORD must match POSTGRES_PASSWORD below
DATABASE_URL=postgresql://wendo_user:CHOOSE_A_STRONG_PASSWORD@postgres:5432/wendo_rms

# Redis — points to the Docker redis container on the same network
# Remove REDIS_TOKEN and UPSTASH_* vars — those were for Upstash, not needed here
REDIS_URL=redis://redis:6379

# JWT — generate fresh values: openssl rand -hex 64
JWT_ACCESS_SECRET=REPLACE_WITH_NEW_64_CHAR_HEX
JWT_REFRESH_SECRET=REPLACE_WITH_DIFFERENT_64_CHAR_HEX
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
BCRYPT_ROUNDS=12

# Postgres password — must match DATABASE_URL above
POSTGRES_PASSWORD=CHOOSE_A_STRONG_PASSWORD

# Firebase — paste the full JSON from your local backend/.env
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"v3-rms",...}
VAPID_KEY=ZIn_fXSjVc5e9l-2qeX5ni-nzD8KG0Ufcl2OyPsNp10

# Cloudinary
CLOUDINARY_CLOUD_NAME=df402c59u
CLOUDINARY_API_KEY=594672593559237
CLOUDINARY_API_SECRET=WwGy7MOV-ZavsLaV7GRTQKTujVY
CLOUDINARY_URL=cloudinary://594672593559237:WwGy7MOV-ZavsLaV7GRTQKTujVY@df402c59u

# Rate limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=200

# BullMQ workers — true for API container, false for worker container (set in docker-compose.yml)
START_BULLMQ_WORKERS=false

# Logging
LOG_LEVEL=info
LOG_PRETTY=false

# Observability
SENTRY_DSN=https://3e29ac6824b13a736f2624000c01b9d9@o4510415737192448.ingest.de.sentry.io/4510951521976400
BETTERSTACK_SOURCE_TOKEN=REPLACE_WITH_YOUR_TOKEN

# Seeded accounts — only used during first-time setup scripts
SYSTEM_ADMIN_EMAIL=edwinfredofficial@gmail.com
SYSTEM_ADMIN_PASSWORD=REPLACE_WITH_STRONG_PASSWORD

# Feature flags
SKIP_SHIFT_VALIDATION=false
ALLOW_PRODUCTION_SEED=false
SEED_REPORTS_CONFIRM=NO
```

### 4.2 Frontend Environment Variables (set in Vercel dashboard)

After the Cloudflare Tunnel is running and you have your tunnel URL, update these
in Vercel → Project → Settings → Environment Variables:

```bash
# Replace the tunnel URL with your actual Cloudflare tunnel URL
NEXT_PUBLIC_API_URL=https://restaurants-agricultural-juan-candidate.trycloudflare.com
NEXT_PUBLIC_SOCKET_URL=https://restaurants-agricultural-juan-candidate.trycloudflare.com

# Firebase (unchanged — same values as before)
NEXT_PUBLIC_FIREBASE_API_KEY=[your-value]
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=v3-rms.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=v3-rms
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=v3-rms.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=[your-value]
NEXT_PUBLIC_FIREBASE_APP_ID=[your-value]

# Sentry
NEXT_PUBLIC_SENTRY_DSN=[your-frontend-sentry-dsn]
SENTRY_AUTH_TOKEN=[your-token]
```

---

## 5. Server Setup — Step by Step

### Step 1 — Create the DigitalOcean Droplet

1. Log in to digitalocean.com and add billing first
2. Click **Create → Droplets**
3. Configure:
   - **Region:** Frankfurt (FRA1) — closest to Kenya
   - **OS:** Ubuntu 24.04 LTS (x64)
   - **Droplet type:** Basic
   - **CPU option:** Regular — $6/mo (1 vCPU, 1 GB RAM, 25 GB SSD)
   - **Authentication:** SSH Key — add your public key (`~/.ssh/id_rsa.pub`)
   - **Backups:** Enable — $1.20/mo for weekly automated snapshots
   - **Hostname:** `wendo-rms`
4. Click **Create Droplet** and note the IP address (e.g. `164.92.100.50`)

### Step 2 — Initial Server Security

SSH into the server as root (first login only):

```bash
ssh root@YOUR_DROPLET_IP
```

Create a non-root user and give it sudo access:

```bash
adduser wendo
usermod -aG sudo wendo

# Copy your SSH key to the new user
rsync --archive --chown=wendo:wendo ~/.ssh /home/wendo

# Test the new user works before closing this session
```

Open a new terminal and verify:

```bash
ssh wendo@YOUR_DROPLET_IP
# Should log in without a password
```

Configure the firewall (all future work is as the `wendo` user):

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
# Expected: Status: active, with rules for 22, 80, 443
```

Disable root SSH login:

```bash
sudo sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sudo systemctl restart ssh
```

### Step 3 — Install Docker

```bash
# Update package index
sudo apt-get update

# Install prerequisites
sudo apt-get install -y ca-certificates curl

# Add Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# Add the Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update

# Install Docker Engine and Compose
sudo apt-get install -y docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin

# Add wendo user to docker group (no sudo needed for docker commands)
sudo usermod -aG docker edwinfred

# Log out and back in for the group change to take effect
exit
```

Log back in:

```bash
ssh wendo@YOUR_DROPLET_IP

# Verify Docker works
docker run hello-world
docker compose version
```

### Step 4 — Install Nginx

```bash
sudo apt-get install -y nginx

# Verify it's running
sudo systemctl status nginx
```

### Step 5 — Install Cloudflare Tunnel (cloudflared)

**Already completed.** Summary of what was done:

```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb \
  -o cloudflared.deb
sudo dpkg -i cloudflared.deb
```

We are using a **Quick Tunnel** (no domain required). Start it in a background terminal:

```bash
cloudflared tunnel --url http://localhost:80
```

**Current tunnel URL:** `https://restaurants-agricultural-juan-candidate.trycloudflare.com`

> **Important:** Quick tunnel URLs change every time cloudflared restarts (e.g. after a server reboot).
> When that happens:
> 1. Start the tunnel and note the new URL
> 2. Update `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SOCKET_URL` in Vercel → Project → Settings → Environment Variables
> 3. Trigger a Vercel redeploy (Deployments → Redeploy)

To start the tunnel automatically on reboot:

```bash
crontab -e
# Add this line:
@reboot cloudflared tunnel --url http://localhost:80 >> /home/edwinfred/cloudflared.log 2>&1 &
```

After a reboot, check the new URL with:

```bash
cat /home/edwinfred/cloudflared.log | grep trycloudflare.com
```

### Step 6 — Clone the Repository

Set up a deploy key so the server can pull from GitHub:

```bash
# Generate a deploy key on the server
ssh-keygen -t ed25519 -C "wendo-rms-droplet" -f ~/.ssh/deploy_key -N ""

# Print the public key — add this to GitHub
cat ~/.ssh/deploy_key.pub
```

Add the deploy key to GitHub:
- Go to your repository → Settings → Deploy keys → Add deploy key
- Paste the public key, tick "Allow read access" (read-only is sufficient)

Configure SSH to use the deploy key for GitHub:

```bash
cat >> ~/.ssh/config << 'EOF'

Host github.com
  HostName github.com
  IdentityFile ~/.ssh/deploy_key
  IdentitiesOnly yes
EOF
```

Clone the repository:

```bash
mkdir -p /home/wendo
cd /home/wendo
git clone git@github.com:YOUR_GITHUB_USERNAME/YOUR_REPO_NAME.git wendo-rms
cd wendo-rms
```

### Step 7 — Create the `.env` File

```bash
cd /home/edwinfred/wendo-rms/backend
nano .env
```

Paste the production `.env` contents from section 4.1. Fill in all `REPLACE_WITH_*` values.

> **Never commit `.env` to git.** Verify it is in `.gitignore` before continuing.

```bash
# Confirm .env is ignored
grep ".env" /home/edwinfred/wendo-rms/.gitignore
```

### Step 8 — Configure Nginx

Remove the default Nginx config and create the Wendo config:

```bash
sudo rm /etc/nginx/sites-enabled/default

sudo nano /etc/nginx/sites-available/wendo-rms
```

Paste this configuration:

```nginx
server {
    listen 80;
    server_name _;

    # Increase body size limit for image uploads (Cloudinary)
    client_max_body_size 10M;

    # WebSocket upgrade support (required for Socket.io)
    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts — important for long-lived WebSocket connections
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
```

Enable the site and test the config:

```bash
sudo ln -s /etc/nginx/sites-available/wendo-rms /etc/nginx/sites-enabled/
sudo nginx -t
# Expected: syntax is ok, test is successful
sudo systemctl reload nginx
```

---

## 6. Docker Files

These files live in the repository. Create them locally, commit, and push — they will be on the server after `git pull`.

### 6.1 `backend/Dockerfile`

```dockerfile
# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy dependency files first (better layer caching)
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# Generate Prisma client
RUN pnpm prisma:generate

# Copy source and compile TypeScript
COPY . .
RUN pnpm build

# ── Stage 2: Production image ────────────────────────────────────────────────
FROM node:22-alpine AS production

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Generate Prisma client in the production image
RUN pnpm prisma:generate

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

# Non-root user for security
RUN addgroup -S wendo && adduser -S wendo -G wendo
USER wendo

EXPOSE 4000

CMD ["node", "dist/server.js"]
```

### 6.2 `docker-compose.yml` (root of the repository)

```yaml
services:

  # ── PostgreSQL ─────────────────────────────────────────────────────────────
  postgres:
    image: postgres:16-alpine
    container_name: wendo-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: wendo_rms
      POSTGRES_USER: wendo_user
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U wendo_user -d wendo_rms"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - wendo-network

  # ── Redis ──────────────────────────────────────────────────────────────────
  redis:
    image: redis:7-alpine
    container_name: wendo-redis
    restart: unless-stopped
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - wendo-network

  # ── API Server ─────────────────────────────────────────────────────────────
  api:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: wendo-api
    restart: unless-stopped
    ports:
      - "4000:4000"
    env_file:
      - ./backend/.env
    environment:
      START_BULLMQ_WORKERS: "false"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - wendo-network

  # ── BullMQ Worker ──────────────────────────────────────────────────────────
  worker:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: wendo-worker
    restart: unless-stopped
    env_file:
      - ./backend/.env
    environment:
      START_BULLMQ_WORKERS: "true"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - wendo-network

volumes:
  postgres_data:
  redis_data:

networks:
  wendo-network:
    driver: bridge
```

> **Note on `POSTGRES_PASSWORD`:** Add `POSTGRES_PASSWORD=CHOOSE_A_STRONG_PASSWORD` to your
> `backend/.env` file. Docker Compose reads it from there via the `${POSTGRES_PASSWORD}` syntax.
> Make sure your `DATABASE_URL` uses the same password.

### 6.3 `deploy.sh` (root of the repository)

This is the script you run every time you want to deploy a new version.

```bash
#!/usr/bin/env bash
set -e  # Exit immediately on any error

echo "=== Wendo RMS Deploy ==="
echo "Started at: $(date)"

# Pull the latest code
echo "--- Pulling latest code..."
git pull origin main

# Rebuild and restart containers (zero-downtime: postgres and redis keep running)
echo "--- Building new images..."
docker compose build api worker

echo "--- Restarting API and worker..."
docker compose up -d --no-deps api worker

# Wait for the API to be healthy
echo "--- Waiting for API health check..."
sleep 5
for i in {1..12}; do
  if curl -sf http://localhost:4000/health > /dev/null; then
    echo "--- API is healthy."
    break
  fi
  echo "--- Waiting... ($i/12)"
  sleep 5
done

# Check if API came up
if ! curl -sf http://localhost:4000/health > /dev/null; then
  echo "!!! API failed to start. Rolling back..."
  docker compose logs api --tail=50
  exit 1
fi

# Clean up old images
echo "--- Cleaning up old Docker images..."
docker image prune -f

echo "=== Deploy complete at $(date) ==="
```

Make it executable after creating the file:

```bash
chmod +x deploy.sh
```

---

## 7. First Deployment

### Step 7.1 — Commit and Push the Docker Files

On your **local machine**:

```bash
# From the repository root
git add backend/Dockerfile docker-compose.yml deploy.sh
git commit -m "chore: add Docker and deploy configuration"
git push origin main
```

### Step 7.2 — Pull the Code on the Server

```bash
cd /home/edwinfred/wendo-rms
git pull origin main
```

### Step 7.3 — Start the Database and Redis First

Start only the data services first so you can run migrations before the API starts:

```bash
cd /home/edwinfred/wendo-rms
docker compose up -d postgres redis

# Wait for them to be healthy
docker compose ps
# Both should show: healthy
```

### Step 7.4 — Run Database Migrations

```bash
# Run migrations using a temporary container that has access to the network
docker compose run --rm api sh -c "node -e \"
const { execSync } = require('child_process');
execSync('npx prisma migrate deploy', { stdio: 'inherit' });
\""
```

Alternatively, run it directly from the backend directory on the server:

```bash
cd /home/edwinfred/wendo-rms/backend
# Install dependencies temporarily for the migration
docker run --rm \
  --network wendo-rms_wendo-network \
  --env-file .env \
  -v "$(pwd)":/app \
  -w /app \
  node:22-alpine sh -c "corepack enable && pnpm install --frozen-lockfile && npx prisma migrate deploy"
```

Verify migrations applied:

```bash
docker compose run --rm api node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.\$connect().then(() => { console.log('DB connected OK'); process.exit(0); });
"
```

### Step 7.5 — Start the Full Stack

```bash
docker compose up -d
docker compose ps
# All 4 services (postgres, redis, api, worker) should show: running / healthy
```

### Step 7.6 — Verify the Health Check

```bash
curl http://localhost:4000/health
# Expected: {"status":"ok","db":"connected","redis":"connected","uptime":...}
```

Also verify via the Cloudflare tunnel:

```bash
curl https://restaurants-agricultural-juan-candidate.trycloudflare.com/health
```

### Step 7.7 — Seed the System Admin Account

Run once only:

```bash
docker compose exec api node dist/scripts/seed-admin.js
# If the compiled script doesn't work, run via tsx:
docker compose run --rm api sh -c "pnpm dlx tsx src/scripts/seed-admin.ts"
```

### Step 7.8 — Import the Master Menu

Run once only:

```bash
docker compose run --rm api sh -c "pnpm dlx tsx src/scripts/import-menu.ts"
```

### Step 7.9 — Update Vercel Frontend Variables

In Vercel → Project → Settings → Environment Variables, update:

```
NEXT_PUBLIC_API_URL     = https://restaurants-agricultural-juan-candidate.trycloudflare.com
NEXT_PUBLIC_SOCKET_URL  = https://restaurants-agricultural-juan-candidate.trycloudflare.com
```

Trigger a new Vercel deployment (push a trivial commit or redeploy from the Vercel dashboard) so the new values are baked in.

### Step 7.10 — Set Up UptimeRobot

1. Log in to uptimerobot.com
2. Add monitor 1:
   - **Type:** HTTPS
   - **URL:** `https://restaurants-agricultural-juan-candidate.trycloudflare.com/health`
   - **Interval:** Every 5 minutes
3. Add monitor 2:
   - **URL:** `https://v3-rms.vercel.app`
   - **Interval:** Every 5 minutes
4. Add your phone number and email as alert contacts

### Step 7.11 — Verify Socket.io (WebSocket)

1. Log in to the app as a waiter
2. Open browser DevTools → Network → WS tab
3. You should see a WebSocket connection to `wendo-rms-api.cfargotunnel.com`
4. Submit a test order and confirm it appears on the KDS within 2 seconds

---

## 8. Subsequent Deployments

Every future deployment is one command on the server:

```bash
cd /home/edwinfred/wendo-rms
./deploy.sh
```

The script:
1. Pulls the latest code from `main`
2. Rebuilds only the `api` and `worker` images
3. Restarts them with zero downtime — `postgres` and `redis` keep running throughout
4. Waits for the health check to pass
5. Automatically rolls back (exits with error) if the API doesn't come up healthy

**If there is a database migration in the release**, run it before `./deploy.sh`:

```bash
docker compose run --rm api sh -c "npx prisma migrate deploy"
./deploy.sh
```

---

## 9. Database Migrations

### Safe Migration Workflow

```
1. Write migration locally: pnpm prisma:migrate
2. Test locally against your local Postgres
3. Commit and push to main
4. On the server, run the migration BEFORE deploying new code:
   docker compose run --rm api sh -c "npx prisma migrate deploy"
5. Run deploy.sh — the new code starts against the already-updated schema
```

### Rules

- **Never** run `prisma migrate dev` on the server — this can drop data
- **Always** use `prisma migrate deploy` on the server
- For destructive migrations (dropping columns, renaming):
  - Phase 1: deploy code that works with both old and new schema
  - Phase 2: run the migration
  - Phase 3: deploy code that uses only the new schema

### Check Migration Status

```bash
docker compose run --rm api sh -c "npx prisma migrate status"
```

### Access the Database Directly

```bash
docker compose exec postgres psql -U wendo_user -d wendo_rms
```

---

## 10. Backups

### Why Backups Are Your Responsibility Now

With Supabase, backups were automatic. With Postgres running in Docker on your Droplet, you are responsible. DigitalOcean weekly Droplet snapshots protect against server failure, but for granular database recovery you need daily database dumps.

### 10.1 Automated Daily Database Backup Script

Create the backup script on the server:

```bash
sudo mkdir -p /opt/backups/wendo
sudo chown wendo:wendo /opt/backups/wendo

nano /home/wendo/backup.sh
```

Paste this content:

```bash
#!/usr/bin/env bash
set -e

BACKUP_DIR=/opt/backups/wendo
DATE=$(date +%Y-%m-%d_%H-%M)
BACKUP_FILE="$BACKUP_DIR/wendo_rms_$DATE.sql.gz"
RETAIN_DAYS=14

echo "[$DATE] Starting backup..."

# Dump the database and compress it
docker compose -f /home/edwinfred/wendo-rms/docker-compose.yml exec -T postgres \
  pg_dump -U wendo_user wendo_rms | gzip > "$BACKUP_FILE"

echo "[$DATE] Backup written to $BACKUP_FILE ($(du -sh $BACKUP_FILE | cut -f1))"

# Delete backups older than RETAIN_DAYS
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$RETAIN_DAYS -delete
echo "[$DATE] Cleaned up backups older than $RETAIN_DAYS days"

echo "[$DATE] Done."
```

Make it executable and test it:

```bash
chmod +x /home/wendo/backup.sh
/home/wendo/backup.sh
ls -lh /opt/backups/wendo/
# Should show a .sql.gz file
```

### 10.2 Schedule with Cron

```bash
crontab -e
```

Add this line to run the backup at 2:00 AM every day:

```
0 2 * * * /home/wendo/backup.sh >> /opt/backups/wendo/backup.log 2>&1
```

### 10.3 Restore from Backup

```bash
# Pick the backup file you want to restore from
BACKUP_FILE=/opt/backups/wendo/wendo_rms_2026-03-01_02-00.sql.gz

# Restore (this REPLACES the current database)
gunzip -c "$BACKUP_FILE" | docker compose exec -T postgres \
  psql -U wendo_user -d wendo_rms
```

---

## 11. Observability Setup

### 11.1 View Live Logs

```bash
# All containers
docker compose logs -f

# API only
docker compose logs -f api

# Last 100 lines from worker
docker compose logs worker --tail=100
```

### 11.2 Sentry — Error Tracking

Sentry is already configured via `SENTRY_DSN` in your `.env`. No additional setup needed on the server side.

Verify it works after deployment:

```bash
# Temporarily hit a route that throws, then check your Sentry dashboard
# You should see the error within 30 seconds
```

**Frontend Sentry** — install in the frontend project:

```bash
cd frontend
pnpm add @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

Set `NEXT_PUBLIC_SENTRY_DSN` in Vercel environment variables.

### 11.3 Betterstack — Log Shipping

Install the Betterstack Pino transport in the backend:

```bash
cd backend
pnpm add @logtail/pino
```

Update `src/config/logger.ts`:

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

Commit and deploy. Logs will appear in your Betterstack dashboard in real time.

### 11.4 Monitor Container Resources

```bash
# Live resource usage for all containers
docker stats

# Check disk space
df -h
du -sh /opt/backups/wendo/
docker system df
```

Alert thresholds to watch:
| Metric | Check command | Alert threshold |
|---|---|---|
| Memory | `docker stats --no-stream` | Sustained >80% of 1 GB |
| Disk | `df -h /` | >80% used |
| CPU | `docker stats --no-stream` | Sustained >70% |

---

## 12. Rollback Procedure

### Application Rollback

If a deployment breaks the API:

```bash
cd /home/edwinfred/wendo-rms

# Find the last working commit
git log --oneline -10

# Roll back to that commit
git checkout COMMIT_HASH

# Rebuild and restart with the old code
docker compose build api worker
docker compose up -d --no-deps api worker

# Verify health
curl http://localhost:4000/health
```

### Database Rollback

If a migration caused data issues, restore from the most recent backup:

```bash
# Stop the API to prevent writes during restore
docker compose stop api worker

# Restore
gunzip -c /opt/backups/wendo/LATEST_BACKUP.sql.gz | \
  docker compose exec -T postgres psql -U wendo_user -d wendo_rms

# Restart
docker compose start api worker
```

### Emergency: Full Server Recovery

If the Droplet itself fails:

1. Create a new Droplet from the latest DigitalOcean weekly snapshot (Droplet → Snapshots → Restore)
2. The Cloudflare Tunnel ID is stored in `~/.cloudflared/` — this is included in the snapshot
3. Start the containers: `cd /home/edwinfred/wendo-rms && docker compose up -d`
4. The data volumes are restored from the snapshot — no backup restore needed

---

## 13. Scaling Triggers

Don't upgrade anything until these specific conditions are met:

| Condition | Action |
|---|---|
| Memory consistently above 85% (`docker stats`) | Upgrade Droplet from $6/mo to $12/mo (2 GB RAM) |
| Disk above 80% | Attach a DigitalOcean Block Storage volume, move `postgres_data` volume to it |
| Database queries slow (>500ms average) | Move PostgreSQL to DigitalOcean Managed DB ($15/mo) — eliminates backup management too |
| Multiple developers deploying simultaneously | Add a proper CI/CD pipeline (GitHub Actions → SSH deploy) |
| Expanding beyond 5 branches with 100+ concurrent users | Add Socket.io Redis Adapter, introduce a load balancer |

---

## 14. Deployment Checklist

Use this for the first deployment only.

### Infrastructure
- [x] DigitalOcean account with billing enabled
- [x] Droplet created (Ubuntu 24.04, $6/mo, Frankfurt) — IP: `104.248.29.42`
- [ ] Droplet backups enabled ($1.20/mo)
- [x] Cloudflare account ready
- [x] Firebase project `v3-rms` — service account JSON and VAPID key available
- [x] Cloudinary account — credentials available
- [ ] Sentry projects created (backend + frontend), DSNs noted
- [ ] Betterstack source created, token noted

### Server Setup
- [x] Non-root user `edwinfred` created, SSH key configured
- [x] UFW firewall enabled (ports 22, 80, 443 only)
- [x] Docker and Docker Compose installed
- [x] `edwinfred` user added to docker group
- [x] Nginx installed and configured
- [x] cloudflared installed (Quick Tunnel mode)
- [x] Tunnel URL confirmed: `https://restaurants-agricultural-juan-candidate.trycloudflare.com`
- [ ] Tunnel auto-start on reboot added to crontab (`@reboot cloudflared tunnel ...`)

### Application
- [x] GitHub deploy key added to repository
- [ ] Repository cloned to `/home/edwinfred/wendo-rms`
- [ ] `backend/.env` created with all production values
- [ ] New JWT secrets generated (`openssl rand -hex 64`) — **do not reuse development secrets**
- [ ] `POSTGRES_PASSWORD` added to `.env` — matches the password in `DATABASE_URL`
- [ ] `docker-compose.yml`, `backend/Dockerfile`, `deploy.sh` committed and pushed

### Database
- [ ] `docker compose up -d postgres redis` — both healthy
- [ ] `prisma migrate deploy` run successfully
- [ ] `pnpm seed:admin` run — system admin account created
- [ ] `pnpm menu:import` run — master menu imported

### Full Stack
- [ ] `docker compose up -d` — all 4 containers running
- [ ] Health check passing: `curl http://localhost:4000/health`
- [ ] Health check via tunnel: `curl https://restaurants-agricultural-juan-candidate.trycloudflare.com/health`
- [ ] Nginx proxying correctly (no CORS errors)

### Frontend
- [ ] Vercel environment variables updated with Cloudflare Tunnel URL
- [ ] Vercel redeployed — frontend calls new backend URL
- [ ] Login works end-to-end
- [ ] WebSocket connecting (DevTools → Network → WS tab)
- [ ] Test order submitted — appears on KDS within 2 seconds

### Backups & Monitoring
- [ ] `backup.sh` created, tested manually, and scheduled in cron (2am daily)
- [ ] UptimeRobot monitors created for health endpoint and frontend
- [ ] Sentry test error verified — appears in dashboard
- [ ] Betterstack logs appearing in real time
- [ ] `docker stats` checked — memory within safe range

### Security
- [ ] New JWT secrets used (not the development values) — run `openssl rand -hex 64`
- [ ] System admin password is strong and not the development default
- [ ] No `.env` files committed to git
- [x] Root SSH login disabled
- [x] UFW firewall active
