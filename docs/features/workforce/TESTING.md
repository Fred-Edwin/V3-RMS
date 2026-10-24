# Workforce: running the database tests (clean lane database)

The `*-db.test.ts` files run only on a `_lane` database and look people up by `@wendo.test` logins, so a lane seeded with the demo company fails them on data, not on code. Use a clean one (lane 3: `wendo_rms_lane3`, Redis 6403). Never the owner's main database.

```sh
docker exec wendo-postgres psql -U wendo_user -d postgres -c 'DROP DATABASE IF EXISTS wendo_rms_lane3' -c 'CREATE DATABASE wendo_rms_lane3 TEMPLATE wendo_rms_template'
docker start wendo-lane-3-redis        # the name may differ: docker ps -a | grep redis
cd backend
export DATABASE_URL=<the lane 3 URL from lane-3/backend/.env> REDIS_URL=redis://127.0.0.1:6403
pnpm exec prisma migrate deploy        # backfills departments, positions and employees
pnpm exec tsx src/scripts/test-lane-setup.ts   # PIN 1234 on the test logins, hr@wendo.test, one staffed department with no head, lane Redis cleared
pnpm exec vitest run src/modules/workforce --no-file-parallelism > /tmp/wf-suite.log 2>&1 &
```

- **One file at a time** (`--no-file-parallelism`): the flows share logins, PINs and branch switches.
- **Rebuild the database before every full run.** The flows leave audit entries (append-only) and other rows that change what the next run counts.
- The template copy holds no demo people. Never run the workforce, payroll or timesheet demo seeds here. The helper ends by itself, writes no PIN backup and only touches a lane database or a Redis on ports 6401 to 6409.
- Leave every branch's attendance switch off. Running time: about 3 minutes.
- Result on 24 Oct 2026: 157 of 162 files pass; the 9 failing tests assert rules the owner changed later (see `final-pass/1-people-closed.md`, "Database tests").
