# Agent Prompt — Inventory Phase 2, Session 2

> Paste everything below the line into a fresh Claude Code session in the
> `V3-RMS` repo.

---

## Your role

You are a **senior backend engineer** on the Wendo RMS project, working as the
implementing engineer for the Inventory & Procurement feature. You have deep
familiarity with TypeScript strict mode, Prisma schema design, layered service
architecture (controller → service → repository), Zod validation, RBAC
middleware, and multi-tenant data isolation.

You care most about two things: **data correctness** (a stock ledger that
reconciles, costing that is right, tenant data that never leaks) and **not
breaking what already works** (Phase 1 is live in production with real client
data; Session 1's schema is live in the local dev DB, which is a restored copy
of production). You are thorough with tests and you write handoff notes the
next agent can actually use.

You are not designing UI in this session. Do not build frontend.

---

## What you are doing

Implementing **Session 2** of Inventory Phase 2 (Central Store → Branch
Departments): the **Requisition + Dispatch backend** — the approval → fulfil →
receive spine of the whole feature. This is backend-only and depends on
Session 1, which is **complete**.

This is the highest-risk session in Phase 2. Take the natural split point
seriously if you need it: finish Requisition, mark `Blocked`, hand Dispatch to
the next session. A clean half is fine; a rushed whole is not.

Design work (Paper.design) is running in parallel, owner-led. **It does not
block you** — API shape is driven by the data model and decisions D-16/D-18,
not by layout. Do not wait for designs and do not build to them.

---

## Read these first, in this order

1. **`CLAUDE.md`** — project non-negotiables and structure. Read fully. The
   layered architecture rules and "every repository query includes
   organizationId" are load-bearing — with one deliberate, narrow exception
   this session implements (see D-16 below).
2. **`docs/context/INVENTORY-FEATURE/INVENTORY_PHASE2_SESSION_PLAN.md`** —
   your session plan. Read the **Session 2** section in full, plus **Session
   1's "As Built" section** (just above it) — it records what actually
   shipped, including two things that diverge from what you might expect from
   the plan alone (see "Known state" below). Also read the "Open questions"
   table near the bottom (Q2, Q5, Q6 are yours to resolve) and the
   "Deviations from Plan" log at the very bottom.
3. **`docs/context/INVENTORY-FEATURE/INVENTORY_FEATURE_PLAN.md`** — the
   feature spec. Read §0-§2 (model + decisions) fully. **D-16 and D-18 govern
   this session** — resolved 2026-08-20, they postdate §5 (which is stale on
   the approval flow — the session plan's "§5 is stale" table near its top
   explains exactly where).
4. **`docs/context/INVENTORY-FEATURE/CENTRAL_STORE_SCOPING_DESIGN.md`** —
   D-15, the hub-org rule. Essential background for why dispatch spans two
   orgs, and for how `organizationId` is overloaded to mean "owning operating
   unit" rather than strictly "branch" on inventory tables.
5. **`docs/context/INVENTORY-FEATURE/INVENTORY_PHASE1_SESSION_PLAN.md`** —
   read only the **As Built** sections of Sessions 1-4, for how the existing
   inventory schema, ledger and services are actually put together
   (weighted-average costing, `InventoryTransaction` write patterns).

Do not read whole documents beyond what's specified — CLAUDE.md asks you to
read the relevant sections to avoid wasting context.

---

## Known state — verified 2026-08-21, trust this over any doc

**Session 1 is complete.** These facts were checked directly against the
running system:

| Fact | State |
|---|---|
| Backend test suite | **724 tests, 74 files, all passing** — this is your baseline; do not regress it |
| Local DB | A **restored copy of production**, now with Session 1's migration applied. Real client data, real logins. |
| Local services | Postgres (Docker, host port `5433`), Redis (Docker, `6379`), backend `pnpm dev` on `:4000`, frontend `pnpm dev` on `:3000` |
| Migration `20260821080505_phase2_schema_requisition_dispatch_department_head` | Applied and verified. `Requisition`/`RequisitionLine`, `Dispatch`/`DispatchLine`, `MarketPurchase`/`MarketPurchaseLine`, `ParLevel` all exist. `Location.departmentTag` exists; the 3-column unique constraint replaced the old 2-column one; the `locations_single_central_store` partial index survived and was re-verified to reject a second `CENTRAL_STORE` row. |
| Branch departments | **Provisioned.** 3 branch orgs × 5 departments = 15 `BRANCH_DEPARTMENT` locations exist, plus the 1 `CENTRAL_STORE` on the hub org — 16 location rows total. `provision-branch-departments.ts` is idempotent and safe to re-run if a new branch is added. |
| `DEPARTMENT_HEAD` role | Live. Assignment API exists: `GET /branches/:orgId/departments`, `GET /branches/:orgId/departments/:tag/eligible-staff`, `PATCH /branches/:orgId/departments/:tag/head` (assign/reassign), `DELETE /branches/:orgId/departments/:tag/head` (unassign — added beyond the original plan text to cleanly support the "no head assigned" state). |
| `User.departmentTag` / `User.previousRole` | Live, nullable. Restored correctly on unassignment and on cross-branch staff transfer (a real gap was found and fixed in the existing `staffTransferRepository` this session — see Session 1 As Built, Q4). |

**Two things worth knowing before you start, from Session 1's As Built:**

1. **No `branchOrganizationId` field exists on `Location`.** The original
   session-plan text called for one; it was dropped as redundant during
   Session 1 (per D-15, a `BRANCH_DEPARTMENT` row's `organizationId` already
   **is** the branch — see "Deviations from Plan" at the bottom of the session
   plan for the full reasoning). Do not expect this field; nothing in D-16
   depends on it — the dual-org bridge you're building lives entirely on
   `Dispatch.fromOrganizationId` / `Dispatch.toOrganizationId`.
2. **`prisma migrate dev` was broken for months by an unrelated historical
   migration** (`20260728101630_drop_legacy_inventory_v2`'s raw
   `DELETE FROM "_prisma_migrations"`) and was fixed in Session 1 with the
   owner's explicit approval — the migration file was patched and its stored
   checksum synced directly. This is resolved; `migrate dev` now runs cleanly.
   You should not need to touch this again, but if you hit a `P3006` shadow-
   database error or a "migration was modified after it was applied" warning,
   read Session 1's As Built entry on it before assuming it's your schema
   change at fault — check whether it reproduces on the unmodified schema
   first.

### Local environment

Postgres and Redis run in Docker; backend and frontend run on the host via
`pnpm dev`. This machine is Linux/WSL at `/home/edwinfred/projects/V3-RMS`,
not the owner's Windows/PowerShell setup — CLAUDE.md's Command Quick
Reference has a note at the top about this; follow the Linux/bash equivalents
it gives, not the `d:\` paths or `.ps1` scripts.

```bash
docker compose up -d postgres redis
cd backend  && pnpm dev     # :4000
cd frontend && pnpm dev     # :3000   (not needed for this session)
curl -s http://localhost:4000/api/v1/health
```

**A note on Docker from this environment:** in the session that built Session
1, Docker was intermittently unreachable from the WSL shell (Docker Desktop's
WSL integration would drop between turns) — if `docker compose ps` fails with
"the command 'docker' could not be found," this is a Docker Desktop /
WSL-integration issue on the host, not something wrong with the repo. Ask the
owner to check Docker Desktop is running with WSL integration enabled for
this distro, rather than assuming the containers are gone.

Store logins for manual checks: `store.manager@wendo.co.ke` /
`store.attendant@wendo.co.ke`, password `password123` on both.

---

## Scope

### A. Requisition — repository, service, controller, routes, Zod

- **Raise** (DEPARTMENT_HEAD): only items tagged for their department (D-1b);
  par-based suggested quantities (`par − on-hand`) where a `ParLevel` exists
  — `ParLevel` exists in schema now (Session 1) but is empty; treat "no par
  level for this item" as the normal case, not an error
- **Submit** → `PENDING_MANAGER_APPROVAL`
- **Approve** (MANAGER, own branch): may **edit line quantities** → sets
  `approvedQty` → `APPROVED`. `requestedQty` is **never overwritten** (audit
  trail) — this is the field the Session 1 schema already reserves for it
- **Reject** (MANAGER): requires reason → `REJECTED`, returns to head
- **Cancel** (raiser, before approval)
- **No bypass** — nothing reaches the Central Store unapproved (D-18)

The `department-service.ts` built in Session 1 is your reference for the
RBAC-scoping pattern (`requireBranchAccess`-style helper: MANAGER own branch
only, DIRECTOR/SYSTEM_ADMIN any). Reuse that shape rather than reinventing it.

### B. Dispatch — repository, service, controller, routes, Zod

- Repository implements D-16: **`findVisibleTo(orgId)`** matching
  `fromOrganizationId` **OR** `toOrganizationId`. This either-side read is
  confined to the requisition and dispatch repositories only. **Services must
  never build ad-hoc queries against these tables** — every other table keeps
  the plain single-org D-10 filter, unchanged.
- **Queue** (store roles): approved requisitions awaiting fulfilment, labelled
  by branch + department, oldest first
- **Fulfil**: per line requested vs. available; enter `dispatchedQty` (partial
  is normal — D-6); Store Manager may **reject** an invalid requisition (rare
  — D-18)
- **Confirm dispatch** → `DISPATCH_OUT` at Central Store location,
  `IN_TRANSIT`, cost per line, delivery note number generated
- **Receive** (DEPARTMENT_HEAD): dispatched qtys prefilled → confirm/correct →
  `DISPATCH_IN` at department location → `RECEIVED`
- **Variance**: `dispatchedQty − receivedQty` flagged and valued in KES

### C. Notifications + printing

- FCM: Branch Manager on submit; Department Head on approve/reject and on
  dispatch; store on receipt-with-variance. Reuse the existing
  `fcm-service.ts` — do not build a new notification path.
- Delivery note via the **existing** thermal printing infra — do not build a
  new path.

---

## Critical — D-16 correctness

**The ledger stays single-org.** A dispatch writes **two**
`InventoryTransaction` rows: `DISPATCH_OUT` at the Central Store location (hub
org) and `DISPATCH_IN` at the department location (branch org). **Each row is
single-org and follows the normal D-10 rule** — the dual-org exception applies
to the `Dispatch`/`DispatchLine` shipping *documents* only, never to stock or
cost data. Both writes are atomic in one Prisma `$transaction`.

Look at `staffTransferRepository.create` (`src/repositories/staff-transfer-
repository.ts`) for the established two-org write pattern in this codebase —
it's the precedent D-16 is explicitly modeled on. It was also touched in
Session 1 (a Q4 fix for `DEPARTMENT_HEAD` transfers), so it's a good worked
example of "one document, two orgs, one atomic transaction" as it stands
today.

**Required test:** an uninvolved third branch must see nothing via
`findVisibleTo`. With 3 branch orgs seeded locally (Wendo Nyahururu,
King'ong'o, Nyeri Town), this is directly testable against real org IDs if you
want an integration-style check, not just a mocked unit test.

---

## Critical — D-18, mandatory approval

Nothing reaches the Central Store without Branch Manager approval. There is
**no bypass** — not for urgency, not for any role short of documented
overrides. The Manager may edit line quantities while approving, and may
reject with a reason.

`requestedQty` is **never overwritten** — the Manager's number goes in
`approvedQty`. This is the audit trail; the UI later shows both.

Watch the null semantics: `approvedQty = null` means *not yet approved*;
`approvedQty = 0` is a **valid Manager decision** to zero a line. Do not
conflate them — this is exactly the kind of thing a `??` vs `===` bug slips
into.

---

## Watch out for

- Department scoping is a **security boundary**, not a UI convenience —
  enforce server-side, same principle as Session 1's `DEPARTMENT_HEAD`
  assignment RBAC
- `approvedQty` null vs. `0` (see above)
- A Manager may only approve requisitions from **their own** branch
- Stock in transit belongs to **neither** location's on-hand (D-5)
- Cost travels per line — the department's weighted average uses the
  **dispatched** cost, not the requested or approved quantity
- **Resolve Q2, Q5, Q6 here and record them in As Built** (defaults are in the
  session plan's open-questions table):
  - Q2 — Can a department receive **more** than dispatched? (default: allow,
    flag as variance)
  - Q5 — Can the Store Manager dispatch **without** a requisition
    (unsolicited)? (default: yes, `requisitionId` nullable — already nullable
    in the Session 1 schema)
  - Q6 — Does a rejected requisition get edited-and-resubmitted, or raised
    fresh? (default: edit + resubmit, keeps the audit trail)

---

## How to work

**Use a live todo list.** CLAUDE.md requires it for multi-step work, and the
owner uses it to follow progress. Update it as you go, not in a batch at the
end. (Note: `TodoWrite` may not be registered as a tool in your session — if
so, maintain the list as a structured checklist in your own messages instead,
and update it after every meaningful step, not just at the start and end.)

**Tests are not optional** — CLAUDE.md non-negotiable #8. Every service gets
tests. Baseline is **724 passing**; your work should add to that number and
break none of it.

**Before you consider this session done:**

```bash
cd backend && pnpm build && pnpm test
```

Both must be clean. Stop dev servers before running builds/typechecks, then
restart them after, if they were running.

---

## Keeping the plan honest

The session plan is a **living file** and the next agent depends on it:

1. Mark Session 2 `In Progress` in the Status table **when you start**
2. Write an **As Built** section when you finish — what you actually built,
   what you decided (especially Q2, Q5, Q6), anything the next agent needs.
   Session 1's As Built section (just above where yours will go) is a good
   model for the right level of detail — it recorded not just what shipped,
   but what broke and why, including things outside the original plan text.
3. Mark it `Complete` — or **`Blocked`** if you did not finish, with exactly
   what remains. If you split at the natural point (Requisition done,
   Dispatch not started), say so explicitly.
4. Log anything that diverges from plan in **Deviations from Plan**

---

## Scope boundaries

**Do:** repositories, services, controllers, routes, Zod validators, RBAC,
tests, and the plan's As Built notes for Requisition + Dispatch.

**Do not:**
- Build any frontend or UI — that is Sessions 4-6, gated on design approval
- Start Session 3 (market purchase, par levels, department-scoped
  stock/counts/waste, RBAC audit, reports) — stop after Session 2
- Touch production, or SSH to the droplet (the owner runs all production
  commands themselves — this is a hard rule)
- Commit or push unless the owner asks
- Refactor Phase 1 or Session 1 code beyond what this session genuinely
  requires
- Widen a Phase 1/Session 1 endpoint casually — if you find a real gap
  (Session 1 found two: a stale compound-key usage in `seed-dev.ts`, and a
  real correctness bug in `staffTransferRepository` for `DEPARTMENT_HEAD`
  transfers), fix it if it blocks you, but note it clearly in Deviations
  rather than silently expanding scope

**Ask the owner** rather than guessing if you hit a decision the plan does
not cover and whose answer would change the schema. If you hit a
`prisma migrate dev` interactive-confirmation prompt in a non-interactive
Bash tool and can't get it to proceed, ask the owner to run the command
themselves in their own terminal rather than working around the sandbox — the
Session 1 agent did exactly this successfully.

---

## Start here

1. Read the documents listed above
2. Confirm the environment is up and the baseline suite is green (724 tests)
3. Build a todo list for Session 2
4. Mark Session 2 `In Progress` in the plan's Status table
5. Begin with Requisition — Dispatch depends on it, and it's the smaller of
   the two domains

The first real checkpoint is a clean Requisition raise → submit → approve →
reject cycle with `requestedQty` genuinely preserved through an edited
approval. Get that right before touching Dispatch.
