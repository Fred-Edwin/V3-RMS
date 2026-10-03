# Pilot session: lane tooling (parallel agent sessions)

Paste this whole file as the first message of a new agent session. It runs **alongside** the Paper catch-up session ([pilot-paper-catchup.md](pilot-paper-catchup.md)). This session touches **no app features**: only scripts, docs, CI config, `.gitignore` and the Prisma schema layout.

## Step 0: isolate yourself (do this before anything else)
Work in your own git worktree, never in the owner's main checkout (`~/Projects/V3-RMS`), which holds the owner's uncommitted files and other sessions. Use the EnterWorktree tool, or: `git fetch && git worktree add ~/Projects/V3-RMS-lanes/tooling -b chore/lane-tooling origin/main`, then do every read, edit and command from that folder. If `docs/ROADMAP.md` or this brief's other files are missing there, stop and tell the owner (the docs PR has not been merged yet). Do not touch the owner's untracked files or any process you did not start. Leave the worktree in place until the owner has merged your PR.

## Read first
- `CLAUDE.md` (all of it, especially rules 12–14), `docs/ROADMAP.md` ("How the work runs: parallel lanes", "Rules every module follows").
- `docs/CODING_STANDARDS.md` §4 (backend module layout).

## Why this exists
The owner tried parallel agents before and it failed because agents (1) edited the same files in one working copy, and (2) shared backend and frontend ports, the frontend API URL, one Postgres, one Redis and the same browser tools. The fix is isolation: one git worktree per lane, and one set of ports, one database, one Redis and one browser profile per lane.

## Constraints
- Machine: Linux (Omarchy), about 15 GB RAM, about 6 GB already used. Up to **3 lanes** at once. Use the **light setup**: do not run a Docker image per lane.
- Postgres: reuse the existing `postgres` container (host port 5433) as the one shared server. One database **per lane**, cloned from a seeded template database (`CREATE DATABASE … TEMPLATE …`).
- Redis: one small Redis container per lane (the repo's `docker-compose.override.yml` publishes 6379 for the main stack; lanes must not touch it).
- API, worker and frontend run directly on the host with `pnpm` (`pnpm dev`), each on lane-specific ports.
- Port scheme (lane N = 1, 2, 3): frontend `3100+N`, API `4100+N`, Redis `6400+N`. The main stack keeps 3000, 4000, 5433, 6379 untouched.
- Never kill or restart a process this session did not start. Never touch production. Never edit Paper.
- Edit files with Edit/Write only. Put a `Why:` line before each Edit/Write. End with the ~5 line recap.

## Deliver
1. **`scripts/lane.sh`** with `up <N> <branch>`, `down <N>`, `list`, `status`:
   - creates a git worktree for the branch **outside** the repo (for example `~/Projects/V3-RMS-lanes/lane-N`);
   - creates `wendo_rms_lane<N>` from the template database (build the template: migrated and seeded with the local test logins; document how to refresh it);
   - starts the lane's Redis container (`wendo-lane-N-redis`);
   - writes gitignored `backend/.env` and `frontend/.env` for the lane (its DATABASE_URL, REDIS_URL, PORT, FRONTEND_ORIGIN, NEXT_PUBLIC_API_URL, NEXT_PUBLIC_SOCKET_URL) and runs `pnpm install`;
   - prints the exact commands to start the API, worker and frontend for that lane;
   - `down` removes only that lane's own container, database and worktree, after checking nothing is uncommitted.
   Idempotent, and refuses to reuse a port that is already listening.
2. **Browser isolation:** work out and document how each lane's browser tools (chrome-devtools MCP, Playwright MCP) use their own profile and debug port. Test it with two lanes at once. If the MCP configuration cannot be set per lane from inside the repo, say exactly what the owner must change.
3. **`docs/PARALLEL_WORKFLOW.md`** (short, plain English): the lane model, the port table, how to start and stop a lane, the lane brief template (branch, lane number, module and files it owns, files it must not touch, gates), the shared-file list (`prisma/schema`, `routes/index.ts`, the permissions table, the sidebar, README tables, `pnpm-lock.yaml`) and the one-at-a-time merge queue (rebase on `main`, re-run gates, owner approves, merge).
4. **Prisma per-module schema files:** the repo uses Prisma 6.16, which supports a schema folder. Split `backend/prisma/schema.prisma` into per-module files under `backend/prisma/schema/` (a `base` file for the generator and datasource, then one file per module/area; Inventory models together). Prove it is a pure move: `prisma validate` passes and `prisma migrate diff` between the migrations and the new schema shows **no changes**. Migrations stay in `backend/prisma/migrations/`. Update the migration notes in `CLAUDE.md` only if the commands change.
5. **Module-import CI check:** add `dependency-cruiser` (or an ESLint restricted-imports rule) so that code outside `backend/src/modules/<x>/` may import only `modules/<x>/index.ts`, and the same on the frontend (`features/<x>` via its `index.ts`). Check what Inventory exposes today. Run it in **warn mode** for legacy code and **error mode** for `modules/` and `features/`. Add it to `.github/workflows/` validation and to the local gates.
6. **Pilot proof:** bring up **two lanes at once**, run a migration in lane 1's database, confirm lane 2's database is unchanged, log in on both frontends, and show the browser tools do not collide. Then tear both down.

## Out of scope
Any change to application behaviour; the Company/Branch rename (a later, separate session); changing the production deploy.

## Gates
`pnpm build` and `pnpm test` in backend, `pnpm build` in frontend, `prisma validate`, the new import check. Commit only your own files with explicit paths. Open a PR; do not merge it.

## Recap
End with the ~5 line plain-English recap: what changed, which files, how the owner verifies (the two-lane proof).
