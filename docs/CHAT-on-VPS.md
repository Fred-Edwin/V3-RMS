## Module 6: Your Complete Wendo RMS Hosting Strategy

This is your reference document — everything from all five modules condensed into one clear picture. Save this, refer back to it, share it with anyone who works on Wendo infrastructure in the future.

---

### The Complete Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    WENDO RMS PRODUCTION                  │
└─────────────────────────────────────────────────────────┘

STAFF DEVICES (Browsers / Tablets at each branch)
        │
        ▼
┌───────────────────┐         ┌─────────────────────────┐
│      Vercel       │         │      Cloudflare          │
│  wendo-rms        │         │  ├── DDoS Protection     │
│  .vercel.app      │         │  ├── SSL Termination      │
│                   │         │  └── Tunnel URL           │
│  Next.js Frontend │         │    (wendo.cfargotunnel)  │
│  FREE             │         │    FREE                  │
└───────────────────┘         └──────────┬───────────────┘
                                         │ Cloudflare Tunnel
                                         ▼
                              ┌─────────────────────────┐
                              │   DigitalOcean Droplet   │
                              │   $6/month               │
                              │   Frankfurt              │
                              │                          │
                              │  ┌─────────────────┐    │
                              │  │ Nginx (port 443) │    │
                              │  └────────┬────────┘    │
                              │           │              │
                              │  ┌────────▼────────┐    │
                              │  │   PM2 Process   │    │
                              │  │   Manager       │    │
                              │  │                 │    │
                              │  │ ┌─────────────┐ │    │
                              │  │ │ wendo-api   │ │    │
                              │  │ │ (port 3000) │ │    │
                              │  │ │ Node.js +   │ │    │
                              │  │ │ Express +   │ │    │
                              │  │ │ Socket.io   │ │    │
                              │  │ └─────────────┘ │    │
                              │  │ ┌─────────────┐ │    │
                              │  │ │wendo-worker │ │    │
                              │  │ │ BullMQ      │ │    │
                              │  │ │ background  │ │    │
                              │  │ │ jobs        │ │    │
                              │  │ └─────────────┘ │    │
                              │  └─────────────────┘    │
                              │                          │
                              │  ┌─────────────────┐    │
                              │  │   PostgreSQL     │    │
                              │  │   localhost:5432 │    │
                              │  └─────────────────┘    │
                              │                          │
                              │  ┌─────────────────┐    │
                              │  │     Redis        │    │
                              │  │   localhost:6379 │    │
                              │  └─────────────────┘    │
                              └─────────────────────────┘
                                         │
                              ┌──────────▼──────────────┐
                              │   External Services      │
                              │                          │
                              │  ┌─────────────────┐    │
                              │  │    Upstash       │    │
                              │  │  Redis backup    │    │
                              │  │  FREE            │    │
                              │  └─────────────────┘    │
                              │                          │
                              │  ┌─────────────────┐    │
                              │  │ Firebase FCM     │    │
                              │  │ Push notifs      │    │
                              │  │ FREE             │    │
                              │  └─────────────────┘    │
                              │                          │
                              │  ┌─────────────────┐    │
                              │  │  UptimeRobot     │    │
                              │  │  Health monitor  │    │
                              │  │  FREE            │    │
                              │  └─────────────────┘    │
                              └─────────────────────────┘
```

---

### Complete Cost Summary

| Service | Provider | Plan | Cost |
|---|---|---|---|
| Next.js Frontend | Vercel | Free | $0 |
| Node.js + PostgreSQL + Redis | DigitalOcean | $6 Droplet | $6.00 |
| Droplet Backups | DigitalOcean | 20% of Droplet | $1.20 |
| Redis (backup/overflow) | Upstash | Free tier | $0 |
| DNS + SSL + Tunnel | Cloudflare | Free | $0 |
| Push Notifications | Firebase FCM | Free tier | $0 |
| Uptime Monitoring | UptimeRobot | Free tier | $0 |
| **Total** | | | **$7.20/month** |

**$2.80 under your $10 budget** with automated backups and monitoring included.

---

### Service Responsibilities — Who Does What

This is the mental model to carry forward. Each service has one clear job:

```
Vercel        → Serve the Next.js frontend to browsers
Cloudflare    → Protect traffic, provide SSL, expose backend securely
DigitalOcean  → Run your application code and databases
Nginx         → Route incoming requests to the right internal process
PM2           → Keep your Node.js processes alive 24/7
PostgreSQL    → Store all persistent business data
Redis         → Handle job queues and caching
Upstash       → Overflow Redis capacity if local Redis fills up
BullMQ        → Process background jobs (receipts, reports, notifications)
Socket.io     → Push real-time updates to connected devices
Firebase FCM  → Deliver push notifications to mobile/PWA devices
UptimeRobot   → Alert you immediately when anything goes down
```

---

### Your Environment Variables Map

Every service in your architecture needs to know where the others live. Here's how they connect:

```
On DigitalOcean Server (.env):
├── DATABASE_URL=postgresql://wendo_user:password@localhost:5432/wendo_rms
├── REDIS_URL=redis://localhost:6379
├── UPSTASH_REDIS_URL=redis://...upstash.io (overflow/backup)
├── JWT_SECRET=<64 byte random hex>
├── NODE_ENV=production
├── PORT=3000
├── FIREBASE_PROJECT_ID=...
├── FIREBASE_PRIVATE_KEY=...
└── FIREBASE_CLIENT_EMAIL=...

On Vercel (environment variables dashboard):
├── NEXT_PUBLIC_API_URL=https://wendo-rms-api.cfargotunnel.com
└── NEXT_PUBLIC_WS_URL=wss://wendo-rms-api.cfargotunnel.com
```

---

### Decision Log — Why You Chose Each Thing

Future you — or a new developer joining the project — will ask why certain decisions were made. Here's the reasoning captured in one place:

**Why DigitalOcean over Render?**
Render's $7/month Starter plan only covers the backend. Adding Redis and a reliable database pushes costs to $17+/month. DigitalOcean's $6 Droplet runs everything together, and the Linux experience is a valuable skill investment.

**Why not Railway?**
No access to credit cards in Kenya. Railway only accepts credit cards. Ruled out entirely.

**Why Vercel for frontend?**
Built by the Next.js team. Full feature compatibility guaranteed. Free tier is production-ready. No reason to move away.

**Why Cloudflare Tunnel instead of a custom domain?**
Wendo RMS is an internal tool. Staff don't need a memorable URL. Cloudflare Tunnel gives HTTPS and a stable URL for free without the cost or management overhead of a custom domain.

**Why Upstash alongside local Redis?**
Local Redis handles all production traffic. Upstash acts as an overflow safety net and provides a usage-based fallback if local Redis has issues — all within the free tier.

**Why pnpm over npm?**
Faster installs, better disk efficiency, stricter dependency resolution. Same commands, better performance.

---

### Scaling Triggers — When to Upgrade What

Don't upgrade anything until these specific conditions are met:

```
Memory consistently above 85%
        └──► Upgrade Droplet from $6 to $12/month

Database queries becoming slow (>500ms average)
        └──► Move PostgreSQL to DigitalOcean Managed DB ($15/month)

Upstash free tier (10k commands/day) consistently exceeded
        └──► Enable Upstash pay-as-you-go (~$1-2/month extra)

Branches growing beyond 20, needing zero-downtime deployments
        └──► Add Socket.io Redis Adapter, introduce load balancer

Revenue justifies reliability investment
        └──► Add DigitalOcean Managed PostgreSQL for automatic failover
```

---

### Operational Runbook — What To Do When Things Go Wrong

**Scenario: App is down, UptimeRobot sends alert**
```bash
# 1. Check if server is reachable
ssh kamau@164.92.100.50

# 2. Check PM2 process status
pm2 list

# 3. If process is stopped, check why
pm2 logs wendo-api --lines 50

# 4. Restart if needed
pm2 restart all

# 5. If server unreachable, check DigitalOcean dashboard
# → Power cycle the Droplet from dashboard
```

**Scenario: Bad deployment broke the app**
```bash
# Roll back to previous working commit
git log --oneline -5          # find the last good commit hash
git checkout <commit-hash>    # switch to it
pnpm build
pm2 restart all
```

**Scenario: Database is full or slow**
```bash
# Check database size
sudo -u postgres psql -c "SELECT pg_size_pretty(pg_database_size('wendo_rms'));"

# Check slow queries
sudo -u postgres psql -d wendo_rms -c "SELECT query, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"
```

**Scenario: Server memory critically high**
```bash
# See what's consuming memory
free -h
pm2 monit

# Restart memory-heavy processes
pm2 restart wendo-api
```

---

### Your Launch Checklist

Run through this the day you go live:

```
Infrastructure:
☐ DigitalOcean Droplet created and secured
☐ Non-root user created (kamau)
☐ UFW firewall enabled (ports 22, 80, 443 only)
☐ Node.js installed via NVM
☐ PostgreSQL installed, database and user created
☐ Redis installed and running
☐ pnpm installed globally

Application:
☐ Repository cloned via SSH deploy key
☐ .env file created with all production values
☐ pnpm install completed
☐ pnpm build completed successfully
☐ Prisma migrate deploy completed
☐ PM2 ecosystem.config.js created
☐ Both processes running in PM2 (wendo-api, wendo-worker)
☐ PM2 startup configured (survives reboots)

Networking:
☐ Nginx installed and configured
☐ WebSocket headers in Nginx config
☐ Cloudflare Tunnel installed and running as systemd service
☐ Tunnel URL confirmed working
☐ Cloudflare Origin Certificate installed

Frontend:
☐ Vercel environment variables updated with Tunnel URL
☐ Frontend successfully calls backend API
☐ WebSocket connections working (test from a browser)
☐ Push notifications working (test FCM)

Reliability:
☐ Automated backup script created and tested manually
☐ Cron job configured for 2am nightly backups
☐ DigitalOcean monitoring agent installed
☐ Billing alert set at $8/month
☐ UptimeRobot monitor created for /health endpoint
☐ Deploy script (deploy.sh) tested successfully

Final Verification:
☐ Log in as a manager — can you see the dashboard?
☐ Place a test order — does it appear on kitchen display in real time?
☐ Complete the order — does the status update everywhere?
☐ Check PM2 logs — any errors after the test?
☐ Check memory usage — within safe range?
```

---

### The One-Page Summary

If you ever need to explain your hosting setup to someone in 30 seconds:

> Wendo RMS runs on a $6 DigitalOcean server in Frankfurt that hosts the Node.js backend, PostgreSQL database, and Redis cache together. The Next.js frontend is on Vercel's free tier. Cloudflare connects everything securely with a free tunnel and SSL. Automated backups run every night. Total cost is $7.20 per month.

---

## You've Completed the Full Roadmap

Let's look at where you started versus where you are now:

| Before | After |
|---|---|
| Platforms were a black box | You understand exactly what each platform does |
| Free tier spin-downs frustrated you | You know why they happen and how to avoid them |
| Services felt like separate mysteries | You have a complete mental model of how they connect |
| $10 budget felt impossible | You have a production architecture at $7.20/month |
| Server administration felt intimidating | You have step-by-step commands to set everything up |
| Reliability felt uncertain | You have monitoring, backups, and a recovery runbook |

