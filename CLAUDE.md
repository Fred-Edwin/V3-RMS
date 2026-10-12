# Wendo RMS — Agent Briefing

## What This Project Is

A multi-tenant restaurant management system for Wendo Coffee Bistro,
a premium coffee bistro in Nyeri, Kenya, expanding from 2 to 10 branches.
Stack: Next.js + TypeScript (frontend), Node.js + Express + TypeScript
(backend), PostgreSQL + Prisma, Redis, Socket.io.

## We Are In A Feature-By-Feature Redo

The project is being rebuilt one feature at a time into a premium enterprise
product with a new design system (shadcn/ui + new tokens) and a modular backend
(`backend/src/modules/<feature>/`). **The process is defined in
`docs/FEATURE_REDO_PLAYBOOK.md` — read it before starting any feature work or
writing any agent-session prompt.** Working code keeps running; each feature is
replaced in place, per build session, behind a migration plan.

Current stage: see "Current Work" below.

## Project Documents — Read THE SPECIFIED SECTION of the document Before Acting - Do not read the whole document to avoid wasting tokens.

Before implementing anything, read the document(s) specific sections/lines relevant to your task:

| Document                        | Read When                                      |
| ------------------------------- | ---------------------------------------------- |
| `docs/PROJECT_STATUS.md`        | The owner's one-page state of the refactor — update its row when you finish a session |
| `docs/FEATURE_REDO_PLAYBOOK.md` | Any feature work — the governing process       |
| `docs/ROADMAP.md`               | Deciding what to build next — the 10 modules, cross-module rules, order, Company/Branch plan, Assistant (AI) layers |
| `docs/PRD.md`                   | Understanding what a feature is supposed to do |
| `docs/DATA_MODEL.md`            | Writing any Prisma schema or database query    |
| `docs/TDD.md`                   | Making any architectural decision              |
| `docs/API_CONTRACT.md`          | Implementing any API endpoint                  |
| `docs/DESIGN_SYSTEM.md`         | Building any UI component or page              |
| `docs/CODING_STANDARDS.md`      | Writing any code — always                      |
| `docs/UI_BUILD_RULES.md`        | Building any screen (states, shells, tables, Paper fidelity checks). §4a is the one table convention: search and filters first, type-ahead, numbered pager with rows per page, no infinite scroll |
| `docs/features/<feature>/README.md` + the sub-module `README.md` | Working on a redone feature — the living spec and status |
| `docs/archive/INDEX.md`         | Historical phase context — NOT current guidance |

## Critical Domain Knowledge (Read Before Touching These Areas)

### Prep Ticket Model — One Ticket Per Order-Item Line
`PrepTicket` records are created **one per order-item line per station**, not one per station.
An order with `Latte x2 + Cappuccino + Fries` produces **3 tickets** (2 BARISTA + 1 KITCHEN).

- `Latte x2` → 1 ticket with `items: [{ name: "Latte", quantity: 2 }]`
- `Cappuccino` → 1 ticket with `items: [{ name: "Cappuccino", quantity: 1 }]`
- `Fries` → 1 ticket with `items: [{ name: "Fries", quantity: 1 }]`

**Do not** revert to grouping all station items into one ticket. This was an intentional workload-fairness design. See `docs/archive/phases/PHASE_3_ENHANCEMENT_TICKET_SPLITTING.md` for full rationale.

The `@@unique([orderId, station, sequence])` constraint on `PrepTicket` supports multiple tickets per station via the `sequence` field. When bulk-creating tickets with `createMany`, you **must** assign per-station sequence numbers explicitly — the default `sequence: 1` will cause a unique constraint violation for the second ticket of the same station.

**Duplicate item lines are distinct tickets, not quantity increments.** If a waiter taps `Cappuccino` twice, the result is **two separate cart lines → two separate tickets** on the BDS — not one ticket with `quantity: 2`. Each tap via `addToCart` always appends a new line (keyed by `lineId`). The backend reconciliation in `orderService.updateItems` uses occurrence-indexed keys `(menuItemId, notes, N)` to distinguish them.

- To get **one ticket with quantity 2**: tap once, then use the **+** stepper in the cart review sheet.
- To get **two separate tickets of quantity 1**: tap the item twice.

Do not revert `addToCart` to merge by `menuItemId` — this was the root cause of the BDS missing-ticket bug (fixed 2026-04-08, commits `7ef34bf` + `df226e1`).

---

## Non-Negotiables (Read These Now)

1. TypeScript strict mode is always on. No `any` types.
2. Every API route has `authenticate` and `requireRole` middleware.
3. Every repository query includes `siteId` in the where clause. (A Site is a
   branch or the Central Store; it was called Organization/`organizationId`. The
   database columns and the API, socket and token names still say `organization`
   on purpose, see `backend/src/shared/utils/wire-names.ts`.)
4. Business logic lives in services only — never controllers or repositories.
5. Database queries live in repositories only — never services or controllers.
   A `prisma.$transaction` in a service is allowed; plain reads/writes are not.
6. Every endpoint has a Zod schema for input validation.
7. Passwords are never logged, returned in responses, or stored plain text.
8. A feature without tests is not complete.
9. New feature code goes in `backend/src/modules/<feature>/` and the new
   `components/ui/` (shadcn + design tokens) — not the old flat `controllers/`,
   `services/` layout. See `docs/FEATURE_REDO_PLAYBOOK.md` §9.
10. Always use pnpm — install, run scripts, build, run.
11. The owner runs Omarchy Linux; agents here also run Linux. Give the owner
    and run your own tooling with the same POSIX shell commands — no
    PowerShell, no WSL distinction needed anymore.
12. Edit files with the Edit and Write tools only — never with Python, sed,
    awk, or heredoc scripts in Bash. Edit fails loudly when the target text
    is missing; a script's `replace` fails silently, and Bash edits bypass
    `/rewind` and the owner's review view.
13. Before each Edit or Write, put one line in your message that starts with
    `Why:` — what this change does and how it serves the current task, in plain
    English (e.g. `Why: the sidebar needs the new Restock link before the tests can pass`).
    The owner's dashboard shows that line next to the file name. For multi-step
    work, also keep a task list (see "Task Tracking" below).
14. End every task with a short plain-English recap (about 5 lines): what
    changed, which files, and how the owner can verify it. The owner does not
    read full diffs.

## Task Tracking

For any multi-step task, keep a task list and update it as you go — mark items
complete as soon as they're done, don't batch updates to the end. This is for the
owner's visual feedback while work is in progress, not just your own bookkeeping, so
update it live rather than only at the start/end of a task.

Which tool: use whichever task-list tool your session has. The names vary by Claude
Code version: `TaskCreate` / `TaskUpdate` / `TaskList`, or `TodoWrite`. If you cannot
call one, it may be a deferred tool: run ToolSearch with the query `select:TaskCreate,TaskUpdate`
(or `select:TodoWrite`) to load it, then use it. If neither loads, do not stop and do
not mention it as a problem: keep a short numbered list in your messages instead, post
it at the start of the task, and re-post the list with each item's status (done,
doing, to do) every time one changes.

## MCP Tools — Prefer These Over Manual Equivalents

These are configured locally (`claude mcp list`). Reach for them by default; don't fall
back to the slower manual path unless the MCP is unavailable.

- **Postgres MCP** — run read-only SQL directly against the local `wendo_rms` DB
  (localhost:5433) instead of `docker compose exec postgres psql`. Use it to inspect
  data, verify a migration actually changed what you expect, or double-check
  `siteId` scoping (Non-Negotiable #3; the column is `organization_id`) while debugging.
- **Playwright MCP / chrome-devtools MCP** — drive a real browser to verify frontend
  changes: navigate, click through the flow, read console errors, inspect network
  requests. This is how to satisfy the "use the feature in a browser before reporting
  complete" rule for UI work — not optional, use it before marking frontend tasks done.
  chrome-devtools MCP also covers performance traces if a real-time screen (BDS/KDS)
  feels laggy.
- **GitHub MCP** — PRs, issues, CI run status, code/commit search. Prefer it over the
  `gh` CLI for multi-step PR/issue workflows (e.g. reading review comments, checking
  CI failures) since it returns structured data instead of text to parse.
- **Paper MCP** (`paper-desktop` plugin) — read the live, owner-approved design file
  directly (e.g. the Phase 0 token approval, feature mockups) instead of working from
  a description or stale screenshot when implementing anything against
  `docs/DESIGN_SYSTEM.md`.

## Frontend Hook Stability Rules (Read Before Editing Pages/Hooks)

1. Hooks that return action functions used in `useEffect`/`useCallback` dependencies must return stable references (use selectors + `useCallback` when needed).
2. Do not silence dependency warnings by default. Prefer making dependencies stable instead of removing them.
3. Data-loading effects must not depend on unstable inline functions, or they can trigger repeated refetch loops and UI flicker.
4. For Zustand, prefer selecting specific actions (`useStore((s) => s.action)`) instead of destructuring the whole store object.
5. If you intentionally omit a dependency, add an inline comment explaining why it is safe.

## Project Structure

**Both sides are mid-migration from group-by-layer to group-by-feature.** A
redone feature is **one folder on each side of the wire**, split into
sub-modules named for what the user does:
`backend/src/modules/<feature>/<sub>/` and `frontend/features/<feature>/<sub>/`.
Migrate a feature's files as part of its own redo, never as a separate
refactor. Full target layout and rules: `docs/FEATURE_REDO_PLAYBOOK.md` §9 and
`docs/CODING_STANDARDS.md` §4 (backend) / §9 (frontend).

```
backend/src/
  modules/<feature>/<sub>/  NEW — README + routes/controller/service/repository/validators/types/tests
  modules/<feature>/_shared/  helpers used by several sub-modules
  shared/              middleware, config (prisma/redis/queues), sockets, jobs, utils, types
  routes/index.ts      wires all module routes
  controllers/ services/ repositories/ validators/   LEGACY — not-yet-redone features

frontend/
  app/                 Next.js App Router — ROUTING ONLY. Thin page shells that
                       render feature components; no data fetching or logic.
  features/<feature>/<sub>/  NEW — components/ hooks/ lib/ services/ store/ types/
  features/<feature>/_shared/  + index.ts (the feature's public API)
  components/ui2/      NEW design-system primitives on the wds- tokens
  components/ui/       LEGACY design system — frozen, retired feature by feature
  components/app/shell/  cross-feature shell (sidebar, topbar, mobile headers)
  hooks/ services/ store/ types/   LEGACY + genuinely cross-feature only
  lib/                 apiClient, socket, cn, tokens
```

**Frontend feature-module rules:** pages in `app/` hold routing concerns only —
Next.js derives URLs from that tree. No cross-feature deep imports: `features/a/`
imports `features/b`'s `index.ts`, never its internals. Every sub-module has a
`README.md` (spec, status, endpoints, coupling); update it in the same commit as
any behaviour change.

## Current Work

The feature-by-feature redo is defined in `docs/FEATURE_REDO_PLAYBOOK.md`.

**Design System Foundation — COMPLETE (2026-09-09)** — coffee-inspired tokens
(espresso `#693C1B`, caramel, Geist / Geist Mono, 2px radii) in
`frontend/app/tokens.wds.css` + `frontend/tailwind.wds.preset.ts`; `wds-` prefix
drops when the legacy `components/ui/` is retired (`DESIGN_SYSTEM.md` §2).

**Feature 1 — Inventory & Procurement.** Built through the old "Milestone Six"
flows and now being **redone workflow by workflow** from owner-approved Paper
designs (file "Wendo RMS · Approved designs", `01M3TP8J54R83RHC9FJ7RAHGKG`).
Restructured 2026-10-03 into 11 sub-modules under `backend/src/modules/inventory/`
and `frontend/features/inventory/` (pure moves; no behaviour change).

- **Rebuilt to approved design and live:** catalog, restock, suppliers, purchasing
  and receiving, prep (PRs #87, #89, #90).
- **Rebuilt on branch `feat/stock-count-waste` (8 Oct 2026, awaiting merge):**
  stock, counting, waste (39 endpoints; API in `docs/API_CONTRACT.md` §34; data in
  `docs/DATA_MODEL.md` §4.85). Daily count and Spot count are gone; the old count
  tables are dropped by a guarded migration. Branch day still imports a few old
  counting files, kept on purpose and marked for its own refactor.
- **Design approved by the owner (8 Oct 2026), code still on the old flow (the
  final build):** requisitions, dispatch and discrepancies, branch-day, branch waste,
  and the role-coverage gap fixes. Plan, blocks and status table:
  `docs/features/inventory/final-pass-build-plan.md`. Paper wins wherever a document
  disagrees with it. The two old open decisions are closed (the Attendant sees
  quantities including on-hand while packing; the miscount-correction outcome is gone
  with the new discrepancy findings).

Start at `docs/features/inventory/README.md` (map, roles, standing rules, status
table), then the README of the sub-module you are touching. Do not use
"Phase 1/2/3" language for Inventory.

Key rule — **Central Store hub-org scoping (D-15):** all Central Store data and
`STORE_MANAGER` / `STORE_ATTENDANT` users live on the hub Site (the site
flagged `isHub`, type `CENTRAL_STORE` — a company-level unit, never a branch/point
of sale; every Site belongs to a `Company`). Enforced by
service guards + a one-Central-Store partial unique index. The hub appears in people
contexts, never sales contexts. Full rule: `docs/inventory/CENTRAL_STORE_SCOPING_DESIGN.md`.

Key rule — **Central Store access (3 Oct 2026):** who may do what is ONE table, role by
capability, in `backend/src/modules/inventory/_shared/central-store-access.ts`. Every
desktop role (Store Manager, Accountant, Director, Branch Manager, System Admin) reads every
Central Store screen; write belongs to whoever does the job; the Branch Manager does not see
supplier payment details. Use `requireCapability(...)` on routes and `requireHubReader` /
`requireHubActor` in services; the front end reads the table from `GET /inventory/permissions/me`
(`usePermissions()`). Never add a new `requireRole(...)` list to a rebuilt Central Store route.
Details: `docs/features/inventory/decisions.md` ("Access").

Key rule — **Stock ledger door (4 Oct 2026):** post every stock movement through
`postStockMovement` (`backend/src/modules/inventory/stock/ledger/`), never with
`inventoryTransaction.create`. The door applies the sign by type, derives `siteId` from the
location, and numbers adjustments. `ledger-guard.test.ts` fails on direct writes; its allow-list
shrinks as sub-modules are rebuilt. The database also refuses `UPDATE`/`DELETE` on
`inventory_transactions` (trigger, 4 Oct 2026): fix a wrong entry with a linked correction, never
SQL. Dev seed scripts that must delete ledger rows call `allowLedgerEditsInThisTransaction(tx)`
(`src/scripts/ledger-dev-bypass.ts`). See `backend/src/modules/inventory/stock/README.md`.

Key rule — **One screen set, mock first (4 Oct 2026):** every Central Store screen is built
once and shown to every desktop role (read for all, write buttons only for the role whose job it
is, hidden otherwise); access lives in the one table; a flow the client has not approved is
built as a mock-data front-end first, back-end after approval. Full rule:
`docs/features/inventory/decisions.md` ("One screen set, mock first").

Key rule — **One shell, one navigation table (5 Oct 2026):** every sidebar link for every role is
a row in `frontend/components/app/shell/nav-table.ts`. Rebuilding a feature means moving its rows
from `oldHref` to `newHref`, nothing else; `app/app/layout.tsx` and the shell hold no role logic and
the shell never imports `components/ui/`. `middleware.ts` (via `lib/route-access.ts`) stays the
access authority and `nav-table.test.ts` fails if a row shows a link that gate would block.
Phones (owner decision, 5 Oct 2026): the desktop roles and the Store Attendant use the same shell at
every width (a top bar and menu drawer, no bottom tabs); the floor staff (waiter, chef, barista,
steward, housekeeping) stay on the legacy bottom tabs in `app/app/_legacy-phone/` until their
screens are rebuilt, then move into the table and that folder is deleted. See
`docs/sessions/one-shell-navigation.md`.

Inventory reference material: `docs/inventory/central_kitchen_inventory_model.md`
(domain research), `docs/inventory/reference-photos/` and `docs/Item Catalog/`
(the client's paper records), `docs/inventory/STORE_ROLES_STAFF_INTEGRATION.md`
(older, uses "Phase 1" wording).

### Historical context

All prior phase context (Phase 0–12, HR/comms/accountant/discount/payslip
modules, the old "warm" UI roadmap) is in `docs/archive/` — see
`docs/archive/INDEX.md`. It is history, not current guidance.

## Current Deployment Model (Authoritative)

- Production is **DigitalOcean + Docker Compose** (not Render/Supabase/Upstash).
- Frontend: Vercel (`v3-rms.vercel.app`).
- API: Cloudflare tunnel (`https://api.wendo-rms.co.ke`) -> DigitalOcean droplet.
- Backend services on server: `api`, `worker`, `postgres`, `redis`.
- No dedicated staging environment is currently provisioned.
- **Deployments are fully automated via GitHub Actions CI/CD.** Every push to `main` triggers: validate → build Docker image → push to ghcr.io → SSH into server → `git pull` + migrate + restart containers. No manual server commands needed after pushing. Monitor at: GitHub → repo → Actions tab. See `docs/DEPLOYMENT.md` §7 for full pipeline details.

## Command Quick Reference (for Coding Agents)

### Local Dev - Core

```bash
cd ~/Projects/V3-RMS
docker compose up -d postgres redis api worker
docker compose ps
curl http://localhost:4000/api/v1/health
```

Frontend:

```bash
cd ~/Projects/V3-RMS/frontend
pnpm install
pnpm dev
```

Build checks (run BOTH before every push — `typecheck` alone is not sufficient):

```bash
cd ~/Projects/V3-RMS/backend
pnpm build
pnpm test

cd ~/Projects/V3-RMS/frontend
pnpm build
```

### Local DB - Migrations and Seed

**MIGRATION WORKFLOW — ALWAYS follow this order:**

1. Edit the matching file in `backend/prisma/schema/` locally (one file per module; Inventory is `schema/inventory/*.prisma`)
2. Generate the migration SQL file locally:
   ```bash
   cd ~/Projects/V3-RMS/backend
   npx prisma migrate dev --name describe_your_change
   ```
3. Commit the generated migration file in `backend/prisma/schema/migrations/`
   (it must sit beside the schema folder, or `migrate deploy` finds nothing)
4. Push to GitHub
5. On production server, apply with:
   ```bash
   docker compose exec api npx prisma migrate deploy
   ```

**Never run `prisma migrate dev` on production — it will prompt to reset (wipe) the database.**
**Never run `prisma migrate deploy` without a committed migration file — it will report "No pending migrations" and the schema change won't apply.**

```bash
cd ~/Projects/V3-RMS
docker compose exec api npx prisma migrate deploy
docker compose exec api npx prisma migrate status
docker compose exec api node dist/scripts/seed-admin.js
```

Reset local DB/data volumes:

```bash
docker compose down -v
docker compose up -d postgres redis api worker
```

### Prisma Studio (Important Distinction)

- **Local DB Studio** (run on local machine):

```bash
cd ~/Projects/V3-RMS
./scripts/db-studio-local.sh
```

- **Production DB Studio** (run on local machine; opens SSH tunnel):

```bash
cd ~/Projects/V3-RMS
./scripts/db-studio.sh
```

Do **not** run these scripts inside the production server's own shell — they
open an SSH tunnel *to* it and are meant to run from your local machine.
Production Prisma Studio tunnels to server host port `5433`.

### Logs

Local Docker logs:

```bash
cd ~/Projects/V3-RMS
docker compose logs -f api
docker compose logs -f worker
docker compose logs --tail=100 postgres
```

Production logs from local machine:

```bash
cd ~/Projects/V3-RMS
./scripts/logs.sh
./scripts/logs.sh worker
```

### Production Server - Safe DB Commands

```bash
cd ~/wendo-rms
docker compose exec api npx prisma migrate deploy
docker compose exec api npx prisma migrate status
docker compose exec postgres psql -U wendo_user -d wendo_rms
```

Never run `prisma migrate dev` on production.

### Demo Seed Data (Production/Server)

```bash
cd ~/wendo-rms
docker compose exec api sh -c "SEED_REPORTS_CONFIRM=YES ALLOW_PRODUCTION_SEED=true node dist/scripts/seed-report-orders.js --days=7 --min-orders=12 --max-orders=30"
docker compose exec api sh -c "SEED_REPORTS_CONFIRM=YES ALLOW_PRODUCTION_SEED=true node dist/scripts/seed-report-orders.js --reset-only"
```

### Local Network (Phone Testing)

Set phone-facing envs:
- `frontend/.env`:
  - `NEXT_PUBLIC_API_URL=http://<LAN_IP>:4000/api/v1`
  - `NEXT_PUBLIC_SOCKET_URL=http://<LAN_IP>:4000`
- `backend/.env`:
  - `FRONTEND_ORIGIN=http://<LAN_IP>:3000`

Then:

```bash
cd ~/Projects/V3-RMS
docker compose up -d --force-recreate api worker
cd ~/Projects/V3-RMS/frontend
pnpm dev -- -H 0.0.0.0 -p 3000
```

### Push Notifications (FCM) — Ops Reference

**VAPID key:** The `NEXT_PUBLIC_FIREBASE_VAPID_KEY` must be the **public key** (88 chars)
from Firebase Console → Project Settings → Cloud Messaging → Web Push certificates.
The private key (44 chars) shown below it must never be used here.

**Staff onboarding:** Each staff member must visit Profile → Push Notifications and tap
**Enable Notifications** once on their device. Tokens are stored per-device in `users.fcm_token`.

**Check who has registered:**
```bash
docker compose exec postgres psql -U wendo_user -d wendo_rms -c \
  "SELECT name, role, CASE WHEN fcm_token IS NOT NULL THEN 'YES' ELSE 'NO' END as notifications_enabled FROM users WHERE is_active = true AND role IN ('WAITER','CHEF','BARISTA','KITCHEN_DISPLAY','BARISTA_DISPLAY') ORDER BY notifications_enabled, role, name;"
```

**Service worker:** `frontend/public/firebase-messaging-sw.js` is the committed fallback with
real config baked in. `next.config.mjs` regenerates it from `firebase-messaging-sw.template.js`
at build time when env vars are present. The `no-cache` header prevents CDN/browser caching.

**If a device stops receiving pushes:** Token may be stale. Staff should re-visit Profile →
Push Notifications — if it shows Enabled, they can log out and back in to re-register.

### GitHub CLI (gh) — PR & Deploy Workflow

```bash
# After pushing a branch — monitor CI live (no browser needed)
gh run watch

# Create a draft PR from current branch
gh pr create --draft

# Convert draft to ready when CI passes
gh pr ready

# List your open PRs (works from anywhere)
gh pr list --author '@me' --repo Fred-Edwin/V3-RMS

# Merge PR: squash commit + delete branch
gh pr merge 45 --squash --delete-branch

# Check deploy status after merging to main
gh run list --branch main --limit 5 --repo Fred-Edwin/V3-RMS

# View CI logs for a failed run
gh run view <run-id> --log
```

Shell shortcuts (define these as functions/aliases in your shell rc file,
e.g. `~/.bashrc` or `~/.zshrc`, if you want them):

| Shortcut | What it does |
|---|---|
| `watch-run` | Watch latest CI run live |
| `prm 45` | Merge PR #45 (squash + delete branch) |
| `pr-draft` | Create draft PR interactively |
| `my-work` | List your open PRs + issues |
| `pr-open` | Open current branch's PR in browser |
| `deploy-status` | Last 5 CI runs on main |

### Known Gotchas

- Root `.env` must include `POSTGRES_PASSWORD=...` for Docker Compose.
- `backend/.env` must be valid dotenv (`KEY=value` only; no multiline SSH keys).
- Local Postgres is exposed on host `5433` for Prisma Studio local script.
- FCM VAPID key: use the **public** key (88 chars), not the private key (44 chars).
