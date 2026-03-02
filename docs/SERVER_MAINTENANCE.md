# Server Maintenance Guide
## Wendo RMS — DigitalOcean Droplet ($6/mo)

---

## Monthly Checklist

Run these checks once a month:

```bash
ssh edwinfred@104.248.29.42

df -h                                      # disk under 70%?
free -h                                    # swap under 50%?
docker compose -f ~/wendo-rms/docker-compose.yml ps   # all 4 containers running?
ls -lh ~/backups/wendo/                    # recent backups present?
sudo apt update && sudo apt upgrade -y     # system patched?
```

---

## 1. Disk Space

The biggest silent killer on a 1GB RAM / 25GB SSD Droplet. Docker accumulates old images over time.

```bash
df -h              # overall disk usage — alert if >70%
docker system df   # how much Docker is consuming
```

### Cleanup commands

```bash
# Safe — removes dangling images and stopped containers (runs automatically on every deploy)
docker system prune -f

# Stronger — removes ALL unused images (use during off-hours only)
docker system prune -af
```

### Scaling trigger
If disk consistently exceeds 80%, attach DigitalOcean Block Storage and move the `postgres_data` volume.

---

## 2. Memory

```bash
free -h        # shows RAM + swap usage
docker stats   # live per-container memory usage (Ctrl+C to exit)
```

### What the numbers mean

| Swap usage | Action |
|---|---|
| Under 50% | Normal — swap is doing its job |
| 50–80% | Monitor closely |
| Over 85% consistently | Upgrade Droplet to $12/mo (2 GB RAM) |

Swap is a 2GB file on disk that acts as overflow RAM. It prevents crashes but is slow — sustained swap usage means you've outgrown the $6 Droplet.

---

## 3. Container Health

All 4 containers should always be running:

```bash
cd ~/wendo-rms
docker compose ps
```

Expected output:
```
NAME               STATUS
wendo-api          Up
wendo-worker       Up
wendo-postgres     Up
wendo-redis        Up
```

If a container shows `Restarting` or `Exited`, check its logs immediately:

```bash
docker compose logs api --tail=50
docker compose logs worker --tail=50
docker compose logs postgres --tail=50
```

Common causes:
- Missing or wrong env var in `backend/.env`
- Database unreachable (postgres container not yet healthy on startup)
- Out of memory (check `free -h`)

---

## 4. Viewing Logs

### From your local machine (recommended)

```powershell
.\scripts\logs.ps1              # stream api logs
.\scripts\logs.ps1 worker       # stream worker logs
.\scripts\logs.ps1 api 100      # last 100 lines then stream
```

### Directly on the server

```bash
cd ~/wendo-rms
docker compose logs api -f
docker compose logs worker -f
docker compose logs api --tail=50
docker stats
```

**When to check which:**
- API errors or unexpected HTTP responses → `api` logs
- Push notifications not arriving, background tasks failing → `worker` logs

---

## 5. Backups

PostgreSQL data lives in a Docker named volume (`postgres_data`). The daily backup cron runs at 2am and keeps 14 days of dumps.

### Verify backups are running

```bash
ls -lh ~/backups/wendo/          # should see .sql.gz files dated within 24 hours
cat ~/backups/wendo/backup.log   # check for errors
```

### If no recent files — test manually

```bash
~/backup.sh
```

### Restore from backup

```bash
cd ~/wendo-rms
docker compose stop api worker

gunzip -c ~/backups/wendo/BACKUP_FILE.sql.gz | \
  docker compose exec -T postgres psql -U wendo_user -d wendo_rms

docker compose start api worker
```

---

## 6. System Updates

Run monthly. Keeps the OS patched against security vulnerabilities.

```bash
sudo apt update && sudo apt upgrade -y
```

If the upgrade includes a kernel update, reboot:

```bash
sudo reboot
```

**After every reboot** (until named Cloudflare tunnel is set up): get the new tunnel URL and update Vercel — see [DEPLOYMENT.md Section 12](./DEPLOYMENT.md#12-tunnel-url-changes).

Once the named tunnel is active at `api.wendo-rms.co.ke`, reboots require no manual action — the tunnel service restarts automatically.

---

## 7. Things to Never Do on the Server

| Action | Why |
|---|---|
| `git pull` manually in `~/wendo-rms` | CI/CD does this — manual pulls cause merge conflicts that break auto-deploy |
| Edit any git-tracked file directly on the server | Same reason — all changes go through git on your local machine |
| `docker compose down` | Stops postgres — app goes offline. Use `docker compose stop api worker` instead |
| `docker system prune -af` during business hours | Removes cached layers needed for fast redeploys |
| `prisma migrate dev` on the server | Can drop data — only ever use `prisma migrate deploy` |
| Edit `.github/`, `deploy.sh`, or any source file on the server | These are managed by git — direct edits will conflict with the next deploy |

---

## 8. Scaling Triggers

Do not upgrade anything until these thresholds are consistently hit:

| Condition | Check with | Action |
|---|---|---|
| Memory >85% | `free -h` + `docker stats` | Upgrade Droplet to $12/mo (2 GB RAM) |
| Disk >80% | `df -h` | Attach DigitalOcean Block Storage |
| DB queries slow >500ms avg | API logs response times | Move to DigitalOcean Managed PostgreSQL ($15/mo) |
| >100 concurrent users | `docker stats` CPU spikes | Add Socket.io Redis adapter + load balancer |

---

## 9. Emergency: App is Down

Quick triage checklist:

```bash
ssh edwinfred@104.248.29.42

# 1. Are containers running?
cd ~/wendo-rms && docker compose ps

# 2. Is the API responding?
curl http://localhost:4000/api/v1/health

# 3. Check recent logs
docker compose logs api --tail=50

# 4. Check disk — full disk = silent failures
df -h

# 5. Check memory
free -h

# 6. Restart API and worker (safe — does not touch data)
docker compose restart api worker
```

If none of the above resolves it, roll back to the last working commit — see [DEPLOYMENT.md Section 13](./DEPLOYMENT.md#13-rollback-procedure).
