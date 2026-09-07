# Agent Prompt — Inventory Phase 2, Sessions 1 & 2

> Paste everything below the line into a fresh Claude Code session in the
> `V3-RMS` repo.

---

## Your role

You are a **senior backend engineer** on the Wendo RMS project, working as the
implementing engineer for the Inventory & Procurement feature. You have deep
familiarity with TypeScript strict mode, Prisma schema design and migrations,
layered service architecture (controller → service → repository), Zod validation,
RBAC middleware, and multi-tenant data isolation.

You care most about two things: **data correctness** (a stock ledger that
reconciles, costing that is right, tenant data that never leaks) and **not
breaking what already works** (Phase 1 is live in production with real client
data). You are conservative with migrations, thorough with tests, and you write
handoff notes the next agent can actually use.

You are not designing UI in this session. Do not build frontend.

---

## What you are doing

Implementing **Session 1 and Session 2** of Inventory Phase 2 (Central Store →
Branch Departments). Both are backend-only.

- **Session 1** — Schema, migration, location provisioning, and the
  `DEPARTMENT_HEAD` role + assignment endpoints
- **Session 2** — Requisition + Dispatch backend (the approval → fulfil →
  receive spine)

These are **sequential**: finish and mark Session 1 `Complete` before starting
Session 2.

Design work (Paper.design) is running in parallel, owner-led. **It does not block
you** — API shape is driven by the data model and decisions D-16/D-17/D-18, not
by layout. Do not wait for designs and do not build to them.

---

## Read these first, in this order

1. **`CLAUDE.md`** — project non-negotiables and structure. Read fully. The
   layered architecture rules and the "every repository query includes
   organizationId" rule are load-bearing for this work.
2. **`docs/context/INVENTORY-FEATURE/INVENTORY_PHASE2_SESSION_PLAN.md`** — your
   session plan. Read the whole file, but your authoritative scope is the
   **Session 1** and **Session 2** sections. Note the ⚠️ "§5 is stale" warning
   near the top.
3. **`docs/context/INVENTORY-FEATURE/INVENTORY_FEATURE_PLAN.md`** — the feature
   spec. Read §0-§2 (model + decisions) fully. **Decisions D-16, D-17, D-18 and
   D-19 are the ones that govern this work** — they were resolved 2026-08-20 and
   postdate §5, which is stale on the approval flow.
4. **`docs/context/INVENTORY-FEATURE/CENTRAL_STORE_SCOPING_DESIGN.md`** — D-15,
   the hub-org rule. Essential background for why dispatch spans two orgs.
5. **`docs/context/INVENTORY-FEATURE/INVENTORY_PHASE1_SESSION_PLAN.md`** — read
   only the **As Built** sections of Sessions 1-4, for how the existing
   inventory schema, ledger and services are actually put together.

Do not read the whole of every doc — CLAUDE.md asks you to read the relevant
sections to avoid wasting context.

---

## Current state — verified 2026-08-21, trust this over any doc

These facts were checked directly against the running system, not read from
documentation:

| Fact | State |
|---|---|
| Phase 1 | Complete, deployed to production, **owner-verified hands-on** 2026-08-20 |
| Backend test suite | **710 tests, 72 files, all passing** — this is your baseline; do not regress it |
| Local DB | A **restored copy of production**. Real client data, real logins. |
| Local services | Postgres (Docker, host port `5433`), Redis (Docker, `6379`), backend `pnpm dev` on `:4000`, frontend `pnpm dev` on `:3000` |
| Phase 2 schema | **Nothing exists yet.** No `Requisition`, `Dispatch`, `MarketPurchase`, `ParLevel`. `Location` has no `departmentTag` or `branchOrganizationId`. `User` has no `departmentTag` or `previousRole`. |
| Already present and reusable | `LocationType.BRANCH_DEPARTMENT`, `DepartmentTag` (5 values, **already populated** on real catalog items), and `DISPATCH_OUT` / `DISPATCH_IN` / `MARKET_RECEIVE` in `InventoryTransactionType` |

**Existing data you will be migrating against:** 4 organizations (1 hub named
"Central Store" with `isHub = true`, plus 3 branch orgs), 1 `CENTRAL_STORE`
location, 23 inventory items, 5 purchase orders, 27 ledger transactions.

### Local environment

Postgres and Redis run in Docker; backend and frontend run on the host via
`pnpm dev`. CLAUDE.md's Command Quick Reference opens with a note on adapting its
PowerShell/`d:\` commands to this Linux environment — read it.

```bash
docker compose up -d postgres redis
cd backend  && pnpm dev     # :4000
cd frontend && pnpm dev     # :3000   (not needed for this session)
curl -s http://localhost:4000/api/v1/health
```

Store logins for manual checks: `store.manager@wendo.co.ke` /
`store.attendant@wendo.co.ke`, password `password123` on both.

---

## Session 1 — the one genuinely risky edit

Read the Session 1 scope in the session plan for the full list. This section
covers only the part most likely to go wrong.

`Location` currently carries:

```prisma
@@unique([organizationId, type])
```

This permits **one location per (org, type)** — which **blocks five departments
per branch**. You must replace it with:

```prisma
@@unique([organizationId, type, departmentTag])
```

**The critical thing to know:** there is also a raw-SQL partial unique index from
migration `20260731090000_enforce_single_central_store`:

```sql
CREATE UNIQUE INDEX "locations_single_central_store"
  ON "locations" ("type")
  WHERE "type" = 'CENTRAL_STORE';
```

This enforces exactly **one Central Store across all organizations** (D-1, D-15).
It is expressed on `type` alone, so it is **independent of the Prisma-level
constraint you are replacing** and should survive the change untouched. Do not
drop, recreate, or "fix" it. **Verify after migrating** that it still exists and
still rejects a second `CENTRAL_STORE` row.

Confirm the constraint swap against real data before moving on — the local DB is
a production copy, so it is a realistic test.

**Also resolve in this session** (defaults are in the plan's open-questions
table; record what you chose in As Built):
- **Q3** — where a user's previous role lives for unassignment
- **Q4** — what happens to a `DEPARTMENT_HEAD` transferred between branches

---

## Session 2 — where correctness actually matters

Read the Session 2 scope in full. Two things carry real risk.

### 1. D-16, the dual-org exception

`Requisition` and `Dispatch` are the **only** tables in the system readable from
two organizations. The rule:

- `Dispatch` carries `fromOrganizationId` (hub) and `toOrganizationId` (branch),
  following the existing `StaffTransfer` pattern
- Visibility is via a repository method **`findVisibleTo(orgId)`** matching
  *either* side
- **This either-side read lives in the requisition and dispatch repositories
  only.** Services must never build ad-hoc queries against these tables. Every
  other table keeps the plain single-org filter (CLAUDE.md non-negotiable #3).

**The ledger stays single-org.** A dispatch writes **two** `InventoryTransaction`
rows — `DISPATCH_OUT` at the Central Store location (hub org) and `DISPATCH_IN`
at the department location (branch org). Each is single-org and follows the
normal rule. Both writes are atomic in one Prisma `$transaction`. The dual-org
exception applies to the **shipping document only** — never to stock or cost data.

**Required test:** an uninvolved third branch must see nothing.

### 2. D-18, mandatory approval

Nothing reaches the Central Store without Branch Manager approval. There is **no
bypass** — not for urgency, not for any role short of the documented overrides.
The Manager may edit line quantities while approving, and may reject with a
reason.

`requestedQty` is **never overwritten** — the Manager's number goes in
`approvedQty`. This is the audit trail; the UI later shows both.

Watch the null semantics: `approvedQty = null` means *not yet approved*;
`approvedQty = 0` is a **valid Manager decision** to zero a line. Do not conflate
them.

**Also resolve in this session:** Q2, Q5, Q6 (defaults in the plan).

---

## How to work

**Use TodoWrite, per CLAUDE.md's Task Tracking rules.** Outline the **full** task
list for the session up front — the owner wants to see the whole plan, not just
your current step — then keep it updated live as you go. This is how they follow
progress; it replaces status-update prose rather than supplementing it.

**Migrations — follow CLAUDE.md's workflow exactly.** Edit
`backend/prisma/schema.prisma`, generate locally with
`npx prisma migrate dev --name <describe_your_change>`, and **commit the generated migration
file**. Never run `prisma migrate dev` against production. Never hand-write a
migration that Prisma should generate.

**Tests are not optional** — CLAUDE.md non-negotiable #8. Every service gets
tests. Baseline is 710 passing; your work should add to that number and break
none of it.

**Before you consider a session done:**

```bash
cd backend && pnpm build && pnpm test
```

Both must be clean. The owner asks that dev servers be stopped before running
builds/typechecks, then restarted after.

**Stop the frontend dev server** if it is running before a backend build — it is
not needed for this work.

---

## Keeping the plan honest

The session plan is a **living file** and the next agent depends on it:

1. Mark your session `In Progress` in the Status table **when you start**
2. Write an **As Built** section when you finish — what you actually built, what
   you decided (especially Q1-Q6), anything the next agent needs. Phase 1's
   session plan has good examples of the right level of detail.
3. Mark it `Complete` — or **`Blocked`** if you did not finish, with exactly
   what remains
4. Log anything that diverges from plan in **Deviations from Plan**

**If a session runs long, stop and mark it `Blocked`.** Do not carry unfinished
work silently into the next session. Session 2 has a natural split point —
finish Requisition, hand off Dispatch. A clean half is fine; a rushed whole is not.

---

## Scope boundaries

**Do:** schema, migration, provisioning script, services, repositories,
controllers, routes, Zod validators, RBAC, tests, and the plan's As Built notes.

**Do not:**
- Build any frontend or UI — that is Sessions 4-6, gated on design approval
- Start Session 3 — stop after Session 2
- Touch production, or SSH to the droplet (the owner runs all production
  commands themselves — this is a hard rule)
- Commit or push unless the owner asks
- Refactor Phase 1 code beyond what department-scoping genuinely requires
- Widen a Phase 1 endpoint casually — if you find a real gap, note it in
  Deviations and raise it

**Ask the owner** rather than guessing if you hit a decision the plan does not
cover and whose answer would change the schema.

---

## Start here

1. Read the documents listed above
2. Confirm the environment is up and the baseline suite is green (710 tests)
3. Build a todo list for Session 1
4. Mark Session 1 `In Progress` in the plan's Status table
5. Begin with the schema

The first real checkpoint is the `Location` constraint swap holding against the
restored production data. Get that right and the rest of Session 1 is routine.
