# Parallel workflow: lanes

How up to three agent sessions work on Wendo RMS at the same time without disturbing each other. The decision and the lane plan are in [ROADMAP.md](ROADMAP.md) ("How the work runs: parallel lanes"). This file is the how-to.

## The idea

A **lane** is one agent session with its own:

- **git worktree and branch** (so two agents never edit the same working copy),
- **database** (cloned from a seeded template),
- **Redis**,
- **ports**, and
- **browser profile and login cookies**.

Nothing is shared between lanes except the Postgres server (one database per lane inside it), the code on `main`, and the files listed under "Shared files" below.

## Ports and names

| Lane | Frontend | API | Worker (optional) | Redis | Database | Address to open |
|---|---|---|---|---|---|---|
| main stack | 3000 | 4000 | (container) | 6379 | `wendo_rms` on 5433 | `localhost:3000` |
| 1 | 3101 | 4101 | 4151 | 6401 | `wendo_rms_lane1` | `http://lane1.localhost:3101` |
| 2 | 3102 | 4102 | 4152 | 6402 | `wendo_rms_lane2` | `http://lane2.localhost:3102` |
| 3 | 3103 | 4103 | 4153 | 6403 | `wendo_rms_lane3` | `http://lane3.localhost:3103` |

Worktrees live outside the repo in `~/Projects/V3-RMS-lanes/lane-N`. Open a lane at its `laneN.localhost` address, not `localhost`: browsers keep login cookies per host name (not per port), so two lanes on plain `localhost` would log each other out.

The light setup: the API, worker and frontend run directly with `pnpm` (no Docker image per lane). Each lane only adds one 64 MB Redis container. The worker is optional; skip it unless the lane needs background jobs.

## Start a lane

One-time (and whenever you want fresh seed data), build the template database from your local `wendo_rms`:

```bash
scripts/lane.sh template build      # first time
scripts/lane.sh template refresh    # rebuild it later (lanes already created keep their own copy)
scripts/lane.sh template status
```

Refresh it from a local database that is at `main`'s migration level, so new lanes start with no pending migrations.

Then, per lane:

```bash
scripts/lane.sh up 1 feat/purchasing-lpo     # lane number, branch name
```

This creates the worktree (new branches start from `origin/main`), clones the database, starts the lane's Redis, writes the lane's `backend/.env` and `frontend/.env` (secrets are copied from your main `backend/.env`; only ports, database, Redis and origins change), writes the lane's `.mcp.json`, runs `pnpm install`, `prisma generate` and `prisma migrate deploy` on the lane database, and prints the three start commands. It does **not** start the servers. Running it again is safe. It refuses to start if a lane port is already busy, or if the lane already holds a different branch.

Other commands:

```bash
scripts/lane.sh list           # one line per lane: branch, servers, Redis, database, clean or DIRTY
scripts/lane.sh status 1       # detail for one lane, plus shared services and free memory
```

Start the agent session **from the lane's worktree folder**, so it picks up that lane's `.mcp.json`.

## Stop a lane

Stop the lane's servers yourself first (`Ctrl+C`). The script never kills a process. Then:

```bash
scripts/lane.sh down 1
```

It refuses if the worktree has uncommitted or untracked files, or if a lane port is still listening. Otherwise it removes only that lane's Redis container, database and worktree. The branch is kept: delete it after it is merged.

## Browser isolation

Each lane's `.mcp.json` (gitignored; written by `lane.sh up`) overrides three servers by name for sessions started in that worktree:

- `chrome-devtools`: `--userDataDir ~/.cache/wendo-lanes/lane-N/chrome`, so it uses its own Chrome profile instead of the shared default.
- `playwright`: `--user-data-dir ~/.cache/wendo-lanes/lane-N/playwright` and its own output folder.
- `postgres`: points at the **lane's** database. Without this, a lane's SQL tool would read your main database.

The first time a session starts in a lane, Claude Code asks you to approve these project servers. Approve them. Your user-level config in `~/.claude.json` does not need to change; the lane file takes precedence. `lane.sh down` deletes the lane's profile folders.

## Lane brief template

Every lane agent session starts from a brief with these headings:

```
Lane:            <N> (design | code A | code B)
Branch:          <branch name>
Start with:      scripts/lane.sh up <N> <branch>
Module:          <the one module or sub-module this lane owns>
Files it owns:   <folders, e.g. backend/src/modules/inventory/purchasing/, frontend/features/inventory/purchasing/>
Must not touch:  <other lanes' folders, plus the shared files below, except as the brief allows>
Docs to read:    <only the sections it needs>
Gates:           backend pnpm build + pnpm test; frontend pnpm build; prisma validate;
                 pnpm check:imports (backend and frontend)
Merge rule:      wait for the owner's word "merge" (default), or "docs-only: merge when green"
Finish:          the "Finish: merge and clean up" checklist below, then a ~5-line plain-English recap
```

## Shared files

These are the places two lanes can collide. Keep edits small, and expect to rebase.

| File | Why it collides | Rule |
|---|---|---|
| `backend/prisma/schema/*.prisma` | Every module's models | Edit only your module's file. A model that must point at another module's model needs the owner's OK. Migrations are named by timestamp: rebase before generating yours. |
| `backend/src/routes/index.ts` | Every new route is wired here | One added line per route file. |
| `backend/src/modules/inventory/_shared/central-store-access.ts` (the permissions table) | One table for all roles | Add rows only. |
| The sidebar (`frontend/components/app/shell/`) | One nav for all modules | Add your link only. |
| README status tables (`docs/features/*/README.md`, `CLAUDE.md` "Current Work") | Status lines | Update only your own row. |
| `backend/pnpm-lock.yaml`, `frontend/pnpm-lock.yaml` | Any dependency change | On conflict, take `main`'s file and run `pnpm install` again; never hand-merge. |

## Import boundaries (checked in CI)

Code outside a module may import only that module's `index.ts`: `backend/src/modules/<x>/index.ts` and `frontend/features/<x>/index.ts`. `pnpm check:imports` (in `backend/` and `frontend/`) enforces it:

- **Error** (fails the build) when the importer is itself inside `modules/` or `features/`.
- **Warning** (never fails) when the importer is legacy code (routes, scripts, old controllers, `app/` pages, tests). The warnings are the backlog of doors still to build. Today: 17 backend warnings (Inventory has no backend `index.ts` yet) and 34 frontend warnings (all in `app/`).

It runs on every pull request (`.github/workflows/pr-checks.yml`) and before every deploy.

## Merge queue

One lane merges at a time:

1. Rebase your branch on the latest `main`.
2. Re-run all gates (backend `pnpm build` + `pnpm test`, frontend `pnpm build`, `prisma validate`, `pnpm check:imports`).
3. The owner reviews and approves.
4. Merge (squash). The next lane rebases and repeats.

If a rebase changes a migration order, regenerate that lane's migration on top of the newer one before re-running the gates.

## Finish: merge and clean up

Every push to `main` deploys to production, so **a merge is a deploy**. The agent runs this checklist itself, but only merges when it has permission: the owner's word "merge" in the session (the default), or a brief that says "docs-only: merge when green" and a PR that really changes only docs. When unsure, ask. Never merge with a red or pending required check.

1. **Ready:** branch rebased on the latest `origin/main`; all gates green; the PR checks green (`gh pr checks <PR>`).
2. **Merge, from your worktree, without `--delete-branch`** (that flag tries to switch your worktree to `main`, which is already checked out in the owner's folder and fails): `gh pr merge <PR> --squash`.
3. **Stop your own servers** (only ones you started), then for a code lane run `scripts/lane.sh down <N>`. It removes the lane's worktree, database and Redis, and refuses if anything is uncommitted or still listening; fix that, do not force it. A design or docs session removes its worktree with `git worktree remove <path>`.
4. **Delete the branch** from the owner's main folder: `git -C ~/Projects/V3-RMS branch -D <branch>` (a squash merge looks "unmerged" to git, so `-d` refuses) and `git push origin --delete <branch>`.
5. **Update the owner's `main`:** only if `git -C ~/Projects/V3-RMS branch --show-current` is `main` and `git -C ~/Projects/V3-RMS status --porcelain --untracked-files=no` is empty, run `git -C ~/Projects/V3-RMS pull --ff-only`. Otherwise do not touch it: tell the owner what to run. Never stash, reset or force anything in the owner's folder. Leave the owner's untracked files alone.
6. **Follow-ups from the merge:** if you merged a migration, run `scripts/lane.sh template refresh` (from a database at `main`'s migration level) and tell the other lanes to rebase. If `pnpm-lock.yaml` or the Prisma schema changed, tell the owner to run `pnpm install` / `pnpm exec prisma generate` in `backend/` and `frontend/`.
7. **Check the deploy:** `gh run list --branch main --limit 1`, and wait for it. If it fails, report the failure and the log link and stop; do not push a fix without the owner.
8. **Recap** (about 5 lines): what merged (PR number), what was cleaned up, whether `main` was updated, the deploy result, and anything the owner must do.
