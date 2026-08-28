# Inventory Phase 2 — Session Plan (Living File)

This file is the session-by-session implementation plan for **Phase 2 (Central Store →
Branch Departments)** of the Inventory feature. Phase 2 is too large for one session and
is built across multiple, **strictly sequential** sessions — no parallel sessions. This
file is how each session hands off to the next.

The feature spec (the "what" and "why") lives in `INVENTORY_FEATURE_PLAN.md` — read it
before touching any session below; it is not duplicated here. This file is only the
"who does what, in what order, and what's already done."

---

## Read This First (every session, in this order)

1. `CLAUDE.md` — non-negotiables, project structure.
2. `INVENTORY_FEATURE_PLAN.md` — full read, this is the spec. **Pay particular attention
   to D-16, D-17, D-18, D-19** (resolved 2026-08-20) — they postdate §5's Phase 2 spec
   and override it where they conflict. See "§5 is stale" below.
3. **This file's Status table below** — find the first session that is not `Complete`.
   That is your session.
4. That session's own **Scope** section only, plus the **As Built** section of every
   prior `Complete` session.
5. The **Deviations from Plan** log at the bottom, if any entry references your session.
6. `INVENTORY_PHASE1_SESSION_PLAN.md` — only the As Built sections for the Phase 1
   components you are extending (counts, waste, stock-on-hand, ledger).

Do not start a session whose Status is not `Not Started`. Do not start a session if an
earlier session is not `Complete`. If you finish only partially, mark it `Blocked` (not
`Complete`) and write exactly what's left in that session's As Built section.

---

## ⚠️ §5 of the feature plan is stale — read this

`INVENTORY_FEATURE_PLAN.md` §5 describes Phase 2 as it was scoped **before** D-18. It is
still correct on dispatch, market purchase, par levels and the ledger, but it is **wrong
or incomplete** on the following, which D-18 changed:

| §5 says | Actually (D-18) |
|---|---|
| Department requisition → Central Store dispatch queue | Department requisition → **Branch Manager approval** → Central Store |
| No Branch Manager role in the cast | Branch Manager approves, edits quantities, rejects, sees all five departments, assigns department heads |
| 9 screens | **16 screens** — adds Manager approval queue, cross-department overview, department detail, department-head assignment, plus screens §5 assumed rather than listed. Full catalogue in "Stage A — The 16 Screens" below |
| Requisition slots (morning/afternoon/evening) | **On-demand, no slots** (D-19) |

Where this file and §5 disagree, **this file wins.** §5 should be revised to match once
Phase 2 is complete (tracked in Deviations).

---

## Phase 2 in one page

**End state:** every branch department has live, priced inventory; loss in transit is
visible; the Branch Manager controls what their branch orders; the Director sees all
locations.

```
Department Head          Branch Manager            Store Manager
─────────────────        ──────────────            ─────────────
  raises requisition ──►  approves / edits    ──►   accepts
  (on demand, from        quantities / rejects      fulfils (partial OK)
   own scoped catalog)          │                   dispatches
                                ▼                        │
                          back to head            delivery note PDF issued
                          if rejected             → status In Transit
                                                         │
                                                         ▼
                                              Department Head receives
                                              (confirm/correct qty)
                                                         │
                                                         ▼
                                              transfer variance flagged

  Market Purchase: Department Head ──► logs produce bought at market
                                       (no PO, no store leg, straight to dept stock)
```

**Locations:** Central Store (1, on hub org) + **5 departments per branch**
(Kitchen, Pastry, Barista, Service, Housekeeping — always all five, D-1a).

**Two inbound paths per department, and only two** (D-1c): Central Store dispatch, and
direct market purchase. No sideways transfers between departments or branches.

---

## What Phase 1 already gives us (do not rebuild)

Verified present in schema and confirmed working by the owner's hands-on verification
pass (2026-08-20, `PHASE1_VERIFICATION_GUIDE.md`):

| Asset | State |
|---|---|
| `LocationType.BRANCH_DEPARTMENT` | ✅ enum value already exists |
| `DepartmentTag` (5 values) | ✅ exists, and `InventoryItem.departmentTags` is **already populated on real client data** |
| `DISPATCH_OUT`, `DISPATCH_IN`, `MARKET_RECEIVE` | ✅ already in `InventoryTransactionType` — **ledger gains usage, never a restructure** |
| Weighted-average costing (D-8) | ✅ verified working — dispatch costing builds directly on it |
| Stock-on-hand / count / waste components | ✅ exist, need department scoping only |
| PDF toolkit (`pdfkit` + `utils/report-formatters.ts`) | ✅ exists (statements/reports) — **the delivery note PDF reuses this**. Thermal printing is NOT used in Phase 2 (D-20) |
| FCM push (`fcm-service.ts`) | ✅ exists — approval notifications reuse it |
| Approval-flow pattern | ✅ `OrderCancellationRequest` etc. — `PENDING → APPROVED/REJECTED` + `resolvedById`/`resolvedAt`/`resolutionNote` |
| Two-org bridge pattern | ✅ `StaffTransfer` — `fromOrganizationId`/`toOrganizationId` |

---

## Delivery sequence — design first, then build

**Agreed with the owner 2026-08-20.** Phase 2 is delivered in two stages:

```
STAGE A — DESIGN (Paper.design)          STAGE B — BUILD (this session plan)
─────────────────────────────────        ──────────────────────────────────
Design all 16 screens                    Sessions 1-3   backend
Iterate until the owner signs off        Sessions 4-6   frontend, built to
Export/reference the approved designs                   the approved designs
                                         Session 7     integration + gate
```

**Design is in progress as of 2026-08-21** and runs in parallel with the backend
sessions. Backend sessions 1-3 are already unblocked; frontend sessions 4-6 wait on
their screen group's approval.

**Why this order:** five of the 16 screens decide whether staff actually use the
system or fall back to paper (see "The five screens that decide Phase 2" below).
Those are worth iterating on in a design tool, where a change costs minutes, rather
than in React, where it costs a session.

**What this means for the build sessions:**
- Sessions 1-3 (backend) are **not blocked by design** and can start any time. The API
  shape is driven by the data model and D-16/D-17/D-18, not by layout.
- Sessions 4-6 (frontend) **must not start until the designs for their screens are
  approved.** Each references the approved Paper design as its source of truth for
  layout, and this plan for behaviour, permissions and data.
- If a design decision changes data requirements (a screen needs a field the API
  doesn't return), record it in **Deviations from Plan** and fix it in the relevant
  backend session — do not quietly widen an endpoint during a frontend session.

**Design tool:** Paper.design. Designs are iterated with the owner until approved;
this file is the functional spec that the designs must satisfy.

---

## Status

### Stage A — Design

| # | Screen group | Screens | Status |
|---|---|---|---|
| D1 | Department Head mobile | 7 | In Progress (started 2026-08-21) |
| D2 | Branch Manager (desktop + mobile) | 4 &rarr; see note below | In Progress (started 2026-08-21) |
| D3 | Central Store dispatch (desktop/tablet) | 3 | In Progress (started 2026-08-21) |
| D4 | Director (desktop) | 2 | In Progress (started 2026-08-21) |

**D2 deviation (2026-08-21):** the four planned Branch Manager desktop screens
(D2.1 Requisition Approvals, D2.2 All Five Departments Overview, D2.3 Single
Department Detail) were merged into one screen, **Branch Stock** (formerly
called "Branch Command Center" mid-design, renamed for consistency with the
sidebar nav label), after the original D2.1 desktop draft was flagged as too
sparse for a 1440px canvas. D2.4 Assign Department Heads is dropped as a
bespoke screen — folded into the existing Staff/HR screen instead (not yet
scoped in detail; open item for backend/frontend session planning). A new
screen was added, **Branch Stock History** (date-picker-driven historical
ledger + a combined Requisitions/Dispatches document list), not in the
original 16-screen catalogue. Net effect: **4 planned screens &rarr; 2 built**
(Branch Stock, Branch Stock History), mobile D2.1 (Approvals Queue +
Requisition Detail) unchanged and still separate per the owner's explicit
call. See "Deviations from Plan" for full detail. Design group D2 covers:
Branch Stock (desktop), Branch Stock History (desktop), Approvals Queue
(mobile), Requisition Detail (mobile).

Design work is under way in Paper.design, owner-led, running in parallel with backend
sessions 1-3. Mark a group `Approved` only when the owner signs it off — frontend
sessions 4-6 gate on that.

### Stage B — Build

**Session sizing is calibrated against Phase 1's actual throughput**, not against
architectural layers. Phase 1's Session 3 delivered three complete backend domains
(~1,150 lines of service + repository, plus controllers, routes, validators and tests)
in one session; Session 4 delivered four more; Session 6 delivered six mobile screens
including nav wiring and mid-session backend fixes. Phase 2 is sized to match that,
which is why related domains are bundled rather than given a session each.

| # | Session | Depends On | Status |
|---|---|---|---|
| 1 | Schema + migration + provisioning + `DEPARTMENT_HEAD` role & assignment | — | Complete (2026-08-21) |
| 2 | Requisition + Dispatch backend (the approval → fulfil → receive spine) | 1 | Complete (2026-08-21) |
| 3 | Market purchase + par levels + department-scoped stock/counts/waste + RBAC audit + reports | 2 | Not Started |
| 4 | Frontend: Department Head mobile (7 screens) | 3, **D1 approved** | Not Started |
| 5 | Frontend: Branch Manager (4 screens, desktop + mobile) | 3, **D2 approved** | Not Started |
| 6 | Frontend: Central Store dispatch (3) + Director (2) | 3, **D3/D4 approved** | Not Started |
| 7 | Integration pass + gate prep | all | Not Started |

Update the Status column the moment a session starts (`In Progress`) and the moment it
ends (`Complete` or `Blocked`). This table is the first thing every agent reads.

**If a session runs long:** stop, mark it `Blocked`, and write exactly what remains in
its As Built section. Do not carry unfinished work silently into the next session. Two
sessions have a natural split point if needed — Session 2 (requisition, then dispatch)
and Session 3 (backend domains, then reports) — take it rather than rushing.

---

## Stage A — The 16 Screens (design spec)

This section is the **functional brief for the design stage**. Every screen below must
exist and must support the behaviour described. Layout, spacing and visual treatment are
decided in Paper.design; **what the screen must let the user do is decided here.**

**Four user types, sixteen screens:**

| Who | Where they work | Screens | Design group |
|---|---|---|---|
| Department Head | Phone only | 7 | D1 |
| Branch Manager | Desktop + phone | 4 | D2 |
| Store Manager / Attendant | Desktop / tablet | 3 | D3 |
| Director | Desktop | 2 | D4 |

Two standing principles, from the Phase 1 design decisions (feature plan §3, §8.0):

1. **Phones are for standing up; desktops are for sitting down.** Department heads and
   store attendants are on their feet — big touch targets, numeric steppers instead of
   keyboards, one clear action per screen. Manager screens get **two purpose-built
   layouts** (dense desktop, distinct mobile), never one responsive layout stretched
   across breakpoints.
2. **A department only ever sees its own slice** (D-1b). Barista never sees chicken;
   Kitchen never sees coffee beans. This is enforced server-side as a permission
   boundary — the UI reflects it, it does not implement it.

---

### D1 · Department Head — Phone (7 screens)

One head per department (D-17). Kitchen's and Pastry's heads are different people. Each
sees only their own department's stock and their own department's slice of the catalog.

#### D1.1 — Department Dashboard
Their home screen: *"what do I need to deal with today?"*

- Requisitions currently waiting on the Branch Manager's approval
- Deliveries on the way from the Central Store
- Items below par level
- Primary actions: **New Requisition**, **Log Market Purchase**

#### D1.2 — New Requisition ⭐ *(critical)*
The screen used every morning. The single most-used new screen in Phase 2.

- Shows **only this department's items** (D-1b)
- Quantities **pre-filled** as `par − on-hand` where a `ParLevel` exists
- Adjust via **+/− steppers**, not the keyboard
- Single **Submit** action
- On-demand — no fixed morning/afternoon slots (D-19)

> **Target: under 5 minutes.** This is a gate criterion, not an aspiration. If it takes
> longer than the paper sheet it replaces, staff will go back to paper.

#### D1.3 — My Requisitions
Tracking what they have asked for.

`Waiting for Manager` → `Approved` → `On the way` → `Received`

Plus **Rejected**, showing the Manager's reason. A rejected requisition can be edited and
resubmitted from here (Q6 default — keeps the audit trail).

#### D1.4 — Receive Delivery ⭐ *(critical)*
When goods arrive from the Central Store.

- Dispatched quantities **pre-filled**
- Confirm, or correct if the delivery was short
- Any difference **highlighted immediately** and recorded as transfer variance
- One confirm action

#### D1.5 — Log Market Purchase
Fresh produce bought directly from the local market — bypasses the Central Store entirely
(D-11). No purchase order, no supplier, no dispatch.

**Item · quantity · what they paid** → confirm.

#### D1.6 — My Department's Stock
Card list of current stock. Tap any item for its full movement history.

#### D1.7 — Count & Waste
Phase 1 mobile components, department-scoped.

- **Stock count** — roughly daily, morning and/or evening (D-19)
- **Waste log** — item, quantity, reason, in ~3 taps

> Design note: confirm whether the department head sees expected quantities during a
> count (open question Q1; suggested default **yes**, as the department's
> manager-equivalent). This changes the count screen.

---

### D2 · Branch Manager — Desktop + Phone (4 screens)

Oversees all five departments at their branch. **The owner explicitly asked for strong
UI/UX in this group** — treat it as a design problem, not a CRUD form.

#### D2.1 — Requisition Approvals ⭐⭐ *(most critical screen in Phase 2)*
Every requisition from all five departments, awaiting this manager.

Actions per requisition:
- ✅ **Approve** as requested
- ✏️ **Edit quantities** — trim an over-order without a reject/re-raise round trip
- ❌ **Reject** with a reason

**Why this screen carries the most design risk:**

Nothing reaches the Central Store without passing through here — approval is **mandatory
with no bypass** (D-18). If the manager is slow or the screen is buried, **the whole
branch's stock ordering stops.** It must be fast, obvious, and reachable in one tap from
the manager's landing screen.

It must work properly **on the phone**, not just desktop — a manager approving from the
restaurant floor is the normal case, not the exception.

When a quantity is edited, the screen must show **both** the original request and the
approved figure. Never silently overwrite what the department asked for (`requestedQty`
is preserved in the data for exactly this reason).

> This is also where D-18's friction will first be felt. If the client pushes back on
> mandatory approval during the pilot, expect it to surface as a complaint about this
> screen.

#### D2.2 — All Five Departments Overview
*"How is my whole branch doing?"* One view across Kitchen, Pastry, Barista, Service,
Housekeeping:

- Stock value per department
- Low-stock warnings
- Pending requisitions
- Recent activity

#### D2.3 — Single Department Detail
Drill into one department: its stock, its staff, its head, its recent requisitions.

#### D2.4 — Assign Department Heads ⭐
Per department:
- Who is currently the head
- All staff at this branch eligible to take the role
- **Assign** or **reassign** in a couple of clicks

A department may legitimately have **no head** — the design must handle that state, not
treat it as an error.

---

### D3 · Central Store — Desktop / Tablet (3 screens)

Store Manager and Store Attendant. They serve **every** branch and **every** department.

#### D3.1 — Dispatch Queue
*"What do we need to send out?"* All approved requisitions awaiting fulfilment.

- Clearly labelled by **branch + department**
- Oldest first
- Grouped by stage: New → Picking → Dispatched

> With 10 branches × 5 departments this is up to 50 distinct sources. **Labelling and
> sort order are the difference between usable and useless.**

#### D3.2 — Fill an Order ⭐ *(critical)*
Picking and sending the goods.

- Per line: **requested** vs. **available**
- Enter the quantity actually being sent
- **Sending less is normal** — the shortfall is recorded, never treated as an error (D-6)
- Confirm → **delivery note PDF generated** (soft copy, no printing — D-20)
- Status becomes **In Transit** (D-5)

The Store Manager may also **reject** a requisition outright — for a genuine mistake
(duplicate, wrong department). Expected to be rare (D-18).

#### D3.3 — Dispatches List
Everything sent — currently in transit, plus history. Flags any delivery where what
arrived did not match what was sent.

---

### D4 · Director — Desktop (2 screens)

#### D4.1 — All Locations Overview
Every branch, every department, in one place. Roll up by branch, drill down to a single
department, then down to individual ledger movements.

#### D4.2 — Reports
Four new reports:

| Report | Answers |
|---|---|
| **Transfer variance** | Where are we losing stock between store and branch? |
| **Fulfilment** | Which departments keep getting short-supplied? |
| **Weekly usage** | How much does each department actually get through? |
| **Market spend** | How much are branches spending at the market? *(a number they have never had)* |

> ⚠️ **Required on-screen caveat:** until Phase 3, sales do not deduct stock, so "usage"
> is **consumption and loss blended**. It cannot separate theft from sales yet. This
> warning must appear **in the report output itself**, not only in documentation —
> otherwise the numbers will be trusted for decisions they cannot yet support.

---

### The five screens that decide Phase 2

If these are good, the system gets used. If they are clumsy, staff go back to paper.

| Screen | Who | Why it decides the phase |
|---|---|---|
| **D1.2 New Requisition** | Dept Head | Used every morning; must beat the paper sheet on speed |
| **D2.1 Requisition Approvals** | Branch Manager | Blocks every downstream step if slow |
| **D1.4 Receive Delivery** | Dept Head | Where transit loss is actually caught |
| **D3.2 Fill an Order** | Store Manager | Serves up to 50 branch/department combinations |
| **D2.4 Assign Department Heads** | Branch Manager | Owner's explicit request |

Design these first, iterate hardest on them, and treat the remaining eleven as
supporting cast.

---

### Screen count changed from the original spec

Feature plan §5 lists **9** screens for Phase 2. The real number is **16**. The
difference comes from D-18 (the approvals queue, cross-department overview, department
detail, and head assignment — four screens that did not exist before mandatory Manager
approval) plus screens §5 assumed rather than enumerated (department dashboard, my
requisitions, count/waste). This is a genuine scope increase and is reflected in the
12-session build plan.

---

## Session 1 — Schema, Provisioning & the `DEPARTMENT_HEAD` Role

**Depends on:** nothing. **Blocks:** everything.
**Sized like:** Phase 1 Session 1 (schema) plus a small service — comfortably one session.

### Scope

**A. Schema** (`backend/prisma/schema.prisma`)

Enums:
- `RequisitionStatus` — `DRAFT`, `PENDING_MANAGER_APPROVAL`, `APPROVED`, `REJECTED`,
  `PENDING_FULFILMENT`, `PARTIALLY_FULFILLED`, `FULFILLED`, `CANCELLED`
- `DispatchStatus` — `PICKING`, `IN_TRANSIT`, `RECEIVED`, `CANCELLED`
- Extend `UserRole` with `DEPARTMENT_HEAD` (D-17)

`Location` changes:
- Add nullable `departmentTag DepartmentTag?`
  - ⚠️ **Do not add a `branchOrganizationId` field.** An earlier revision of this plan
    called for one; it was an error, caught during Session 1 (2026-08-21). Per D-15,
    `organizationId` on inventory data means "owning operating unit" — so for a
    `BRANCH_DEPARTMENT` row it **already is** the branch org, and a second column would
    just duplicate it and risk drift. The dual-org bridge is handled by
    `Requisition`/`Dispatch` carrying their own `fromOrganizationId`/`toOrganizationId`
    (D-16); `Location` plays no part in it.
- **Replace `@@unique([organizationId, type])`** with
  `@@unique([organizationId, type, departmentTag])` — the current constraint allows only
  one location per (org, type) and **blocks five departments per branch**
- ⚠️ **The partial unique index from migration `20260731090000` (one `CENTRAL_STORE`
  system-wide) must survive.** Verify explicitly after the change.

New models:
- `Requisition` — `organizationId` (branch org, owning), `locationId`, `requestedById`,
  `status`, `approvedById?`, `approvedAt?`, `rejectionReason?`, `notes?`, timestamps
- `RequisitionLine` — `inventoryItemId`, `requestedQty`, `approvedQty?`, `notes?`
- `Dispatch` (**dual-org, D-16**) — `fromOrganizationId` (hub), `toOrganizationId`
  (branch), `requisitionId?`, `fromLocationId`, `toLocationId`, `status`,
  `dispatchedById`, `dispatchedAt`, `receivedById?`, `receivedAt?`, `deliveryNoteNumber`
- `DispatchLine` — the **three quantities** (D-6): `requestedQty`, `dispatchedQty`,
  `receivedQty?`, plus `unitCost`
- `MarketPurchase` / `MarketPurchaseLine` (D-11)
- `ParLevel` — `@@unique([locationId, inventoryItemId])`
- `User` — nullable `departmentTag DepartmentTag?` (D-17: **one** department, scalar)
  and nullable `previousRole` (Q3 — needed to restore a role on unassignment)

**B. Migration + provisioning**
- Generate locally per CLAUDE.md (`npx prisma migrate dev`), commit the file
- Idempotent script provisioning **5 `BRANCH_DEPARTMENT` locations per non-hub org** —
  must be safe to re-run when a new branch is added later

**C. Department-head assignment** (service + repository + controller + routes + Zod)
- `GET /branches/:orgId/departments` — five departments, current head, staff count
- `GET /branches/:orgId/departments/:tag/eligible-staff`
- `PATCH /branches/:orgId/departments/:tag/head` — assign/reassign (**MANAGER only**)
- Assigning sets `role = DEPARTMENT_HEAD` + `departmentTag`; **unassigning restores
  `previousRole`** — store it, never guess
- RBAC: MANAGER within own branch; DIRECTOR any; SYSTEM_ADMIN any
- Tests: assignment, reassignment, cross-branch rejected, role restoration

### Watch out for
- The `Location` constraint swap is the riskiest edit in Phase 2 — Phase 1 data exists
- A department may legitimately have **no head** (nullable everywhere)
- Never two heads for the same (branch, department) simultaneously
- The hub org has no departments — guard provisioning and assignment against it
- Resolve **Q3** and **Q4** here and record them in As Built

### As Built (2026-08-21)

**Schema** — landed as specced. `RequisitionStatus`, `DispatchStatus` enums;
`UserRole.DEPARTMENT_HEAD`; `Location.departmentTag` (nullable) +
`@@unique([organizationId, type, departmentTag])` replacing the old 2-column
constraint; `Requisition`/`RequisitionLine`, `Dispatch`/`DispatchLine`
(dual-org, `fromOrganizationId`/`toOrganizationId`), `MarketPurchase`/
`MarketPurchaseLine`, `ParLevel`; `User.departmentTag` + `User.previousRole`
(both nullable). No `branchOrganizationId` field was added to `Location` — it
was redundant with the existing `organizationId` (a `BRANCH_DEPARTMENT`
location's `organizationId` already **is** its branch), so it was dropped
from the plan during schema design; nothing downstream depends on it.

Migration: `20260821080505_phase2_schema_requisition_dispatch_department_head`.
Verified against the real restored-production local DB: the
`locations_single_central_store` partial unique index survived untouched and
still rejects a second `CENTRAL_STORE` row (tested with a direct INSERT that
correctly failed); zero duplicate `(organizationId, type)` rows existed
pre-migration so the new 3-column constraint applied with no conflict.

**Pre-existing infra fix (unrelated to Phase 2, blocking regardless):**
`npx prisma migrate dev` had been broken since migration
`20260728101630_drop_legacy_inventory_v2` was committed — that migration's
raw `DELETE FROM "_prisma_migrations" ...` line breaks Prisma's shadow-
database replay (P1014) on *any* fresh database, which blocks `migrate dev`
for every future schema change, not just this one. Reproduced on unmodified
`main` before touching anything. Fixed by removing that line from the
migration file (owner-approved) — it was cosmetic (the enum label it
referenced can't be un-added anyway; `20260728101631` already uses
`ADD VALUE IF NOT EXISTS` and never depended on the row being gone). Since
the file was already applied to the real DB, its stored checksum was synced
via a direct `UPDATE _prisma_migrations SET checksum = ...` (owner-approved,
bookkeeping table only, no application data touched). Two other pre-existing
checksum mismatches were hit and fixed the same way while getting `migrate
dev` usable again: `20260311120000_add_print_job_claiming_fields` (file
edited in an unrelated commit, `1bde6ee`, months ago) and stale
zero-step rows left behind by earlier failed-then-retried applies of
`20260510025111_redesign_payslip_fields` and `20260728101631_inventory_
phase1_schema` (each had a real successful row already matching its file;
only the dead failed-attempt row's checksum was stale and was what
`migrate dev` was comparing against). None of this touched real data;
`migrate dev` now runs cleanly going forward.

**Fallout from the constraint swap:** `seed-dev.ts`'s Central Store upsert
used the old `organizationId_type` compound key, which no longer exists.
Fixed — but not with the new 3-column key directly: Prisma's compound-unique
`where` shorthand requires a *non-null* value for `departmentTag` even though
the column is nullable (Postgres treats each `NULL` as distinct, so "find the
row where departmentTag is null" isn't a valid unique lookup), so the fix is
`findFirst` + `create` instead of `upsert`. The partial unique index still
guards against duplicates at the DB level regardless. A full-codebase
`tsc --noEmit` after the constraint swap found this as the only break — worth
re-running after any future constraint change.

**Provisioning script:** `src/scripts/provision-branch-departments.ts`. Not a
dev-only seed (unlike `seed-inventory-demo.ts`) — follows `seed-admin.ts`'s
pattern instead (safe in any environment, idempotent, run via
`npx tsx .../script.ts` or `node dist/scripts/...js`). Run against the local
restored-production DB: created exactly 15 locations (3 branch orgs × 5
departments), re-run confirmed idempotent (0 created, 15 skipped on the
second pass). Final location count verified: 1 `CENTRAL_STORE` (hub) + 15
`BRANCH_DEPARTMENT` = 16 rows total, matching the model exactly.

**Department-head assignment:** `department-repository.ts` /
`department-service.ts` / `department-controller.ts` / `department-routes.ts`
/ `department-schemas.ts`, registered in `routes/index.ts`. Endpoints match
the plan's `GET .../departments`, `GET .../eligible-staff`, plus
`PATCH .../head` for assign/reassign — a `DELETE .../head` was added for the
"no head assigned" state D2.4 must support, since the plan's single `PATCH`
endpoint doesn't cleanly express "remove the head without assigning a
replacement." RBAC matches spec exactly: MANAGER within own branch, DIRECTOR
any branch, SYSTEM_ADMIN any branch; hub org rejected with a `ValidationError`
("The Central Store has no departments"). Reassigning a department mid-flight
(assigning someone new while a head already holds it) atomically vacates the
old head first, restoring their `previousRole` — never two heads for the same
(branch, department) simultaneously, enforced in `department-repository.
assignHead`'s transaction.

**Q3 — where does previousRole live?** Nullable `previousRole` scalar field on
`User`, as the plan's default specified. No changes.

**Q4 — DEPARTMENT_HEAD transferred between branches?** Plan's default (clear
department, restore previous role) — but this required a fix beyond the new
department-assignment code: `staffTransferRepository.create` (the existing
Phase 0-era cross-branch staff move, unrelated to Phase 2 until now) updated
only `organizationId` and had no awareness of `DEPARTMENT_HEAD`/
`departmentTag`/`previousRole` at all. Left as-is, a transferred department
head would keep `role: DEPARTMENT_HEAD` and their old department tag,
orphaned in the new org — a phantom head at the branch they left, and D-17's
"never two heads" invariant silently unenforced for the branch they land in.
Fixed in the same transaction: if the transferred user is a
`DEPARTMENT_HEAD`, their role is restored from `previousRole` (falling back
to `WAITER` if somehow unset) and `departmentTag`/`previousRole` are cleared,
identical to an explicit unassign. Covered by
`staff-transfer-repository.test.ts` (new file — this repository had no test
coverage before).

**Tests:** `department-service.test.ts` (11 tests: assignment, cross-branch
rejection, Director-any-branch, hub rejection, inactive-staff rejection,
not-found handling, reassignment, unassign role restoration, unassign
not-found, listDepartments cross-branch rejection and shape) +
`staff-transfer-repository.test.ts` (3 tests, the Q4 fix above). Baseline was
710 tests / 72 files; now **724 tests / 74 files**, zero regressions.
`pnpm build` and `pnpm test` both clean.

**Not built in this session (deferred to Session 2/3 as planned):**
Requisition/Dispatch backend, market purchase, par levels, RBAC audit,
reports. No frontend, per scope boundaries.

---

## Session 2 — Requisition + Dispatch Backend

**Depends on:** 1. **The spine of Phase 2 and its highest-risk session.**
**Sized like:** Phase 1 Session 3 (three domains, ~1,150 lines) — this is two domains
but they are more intricate. **Natural split point if it runs long: finish requisition,
mark `Blocked`, hand dispatch to the next session.**

### Scope

**A. Requisition** — repository, service, controller, routes, Zod
- **Raise** (DEPARTMENT_HEAD): only items tagged for their department (D-1b);
  par-based suggested quantities (`par − on-hand`) where a `ParLevel` exists
- **Submit** → `PENDING_MANAGER_APPROVAL`
- **Approve** (MANAGER, own branch): may **edit line quantities** → sets `approvedQty`
  → `APPROVED`. `requestedQty` is **never overwritten** (audit trail)
- **Reject** (MANAGER): requires reason → `REJECTED`, returns to head
- **Cancel** (raiser, before approval)
- **No bypass** — nothing reaches the Central Store unapproved (D-18)

**B. Dispatch** — repository, service, controller, routes, Zod
- Repository implements D-16: **`findVisibleTo(orgId)`** matching `fromOrganizationId`
  **OR** `toOrganizationId`. This either-side read is confined to the requisition and
  dispatch repositories. **Services must never build ad-hoc queries against these tables.**
- **Queue** (store roles): approved requisitions awaiting fulfilment, labelled by
  branch + department, oldest first
- **Fulfil**: per line requested vs. available; enter `dispatchedQty` (partial normal);
  Store Manager may **reject** an invalid requisition (rare — D-18)
- **Confirm dispatch** → `DISPATCH_OUT` at Central Store location, `IN_TRANSIT`,
  cost per line, delivery note number generated
- **Receive** (DEPARTMENT_HEAD): dispatched qtys prefilled → confirm/correct →
  `DISPATCH_IN` at department location → `RECEIVED`
- **Variance**: `dispatchedQty − receivedQty` flagged and valued in KES

**C. Notifications + delivery note**
- FCM: Branch Manager on submit; Department Head on approve/reject and on dispatch;
  store on receipt-with-variance
- Delivery note as a **PDF** (D-20) — no printing anywhere in Phase 2. Deferred from Session 2; see Session 3 scope.

### Critical — D-16 correctness
**The ledger stays single-org.** A dispatch writes two `InventoryTransaction` rows:
`DISPATCH_OUT` at the Central Store location (hub org) and `DISPATCH_IN` at the
department location (branch org). **Each is single-org and follows the normal D-10 rule.**
Both writes are atomic (Prisma `$transaction`). The dual-org exception applies to the
shipping *document only* — never to stock or cost data.

**Required test:** a third, uninvolved branch must see nothing.

### Watch out for
- Department scoping is a **security boundary**, not a UI convenience — enforce server-side
- `approvedQty` null = not yet approved; `approvedQty = 0` is a valid Manager decision
  (deliberately zeroing a line). Do not conflate them.
- A Manager may only approve requisitions from **their own** branch
- Stock in transit belongs to **neither** location's on-hand (D-5)
- Cost travels per line — the department's weighted average uses the **dispatched** cost
- Resolve **Q2**, **Q5**, **Q6** here and record them in As Built

### As Built (2026-08-21)

**Requisition** — `requisition-repository.ts` / `requisition-service.ts` /
`requisition-controller.ts` / `requisition-routes.ts` /
`requisition-schemas.ts`. Raise (DEPARTMENT_HEAD, D-1b item scoping against
the hub-owned catalog via `InventoryItem.departmentTags`), submit-on-raise
(no separate DRAFT step — D-19 is on-demand, so raise goes straight to
`PENDING_MANAGER_APPROVAL`), approve (MANAGER own branch only, may edit any
subset of lines; unedited lines are approved as requested —
`requestedQty` is never overwritten, verified live against a real Manager
approval that trimmed 10 → 7), reject (reason required), cancel
(raiser, pre-approval only). `listOrderableItems` computes suggested qty
(`par − onHand`, floored at 0 via `Prisma.Decimal.max`) using the new
read-only `par-level-repository.ts` (full CRUD is Session 3 scope) and
`locationRepository.findByOrganizationTypeDepartment` (new method, since
Session 1 correctly predicted "this repository will grow filters then").

**Dispatch** — `dispatch-repository.ts` (with `findVisibleTo`/`listVisibleTo`,
the D-16 either-side read, confined to this repository only) /
`dispatch-service.ts` / `dispatch-controller.ts` / `dispatch-routes.ts` /
`dispatch-schemas.ts`. Queue (store roles, approved requisitions oldest
first — a direct cross-branch `Requisition` query by status, since a
not-yet-dispatched requisition has no `Dispatch` row for `findVisibleTo` to
match; documented in the queue method as the same kind of confined
exception `findVisibleTo` is). Fulfil (partial normal, D-6), confirm dispatch
(atomic `DISPATCH_OUT` write + `IN_TRANSIT` transition + delivery note
number), receive (atomic `DISPATCH_IN` write + `RECEIVED` transition +
variance flagging), store-side reject. Unsolicited dispatch (Q5).

**D-16 ledger correctness — verified two ways.** Unit tests assert exactly
one `DISPATCH_OUT` row (hub org, Central Store location, negative quantity)
and exactly one `DISPATCH_IN` row (branch org, department location, positive
quantity) per confirm/receive call, plus the required third-branch-sees-
nothing test via `findVisibleTo`. Then re-verified live end-to-end against
the real restored-production DB: raised a requisition for Wendo Nyahururu's
Kitchen (temporarily assigned a department head for the test, unassigned
afterward via the Session 1 API — role correctly restored to CHEF), approved
with an edited quantity (10 → 7, confirmed `requestedQty` stayed "10" in the
response), fulfilled partially (7 → 5, D-6), confirmed dispatch, received
with a shortfall (5 → 4, transit loss = 1). Queried `inventory_transactions`
directly: exactly two rows, `DISPATCH_OUT` at `-5.0000` under the hub org's
Central Store, `DISPATCH_IN` at `4.0000` under the branch org's Kitchen
location — matches the model exactly. A third branch's Manager token got
`404 Dispatch not found` on the same dispatch ID, confirming D-16 live. All
test data (requisition, dispatch, ledger rows, the temporary department-head
assignment) was cleaned up afterward; `locations` count returned to exactly
16, matching Session 1's baseline.

**Real gap found and resolved (owner decision, 2026-08-21): per-location
costing (D-8).** `InventoryItem.currentCost` is a single scalar owned by the
hub-org catalog row — it worked in Phase 1 only because Central Store was
the sole location. Session 1's schema has no field for a branch department
to hold its own weighted-average cost, so `receive()` cannot write one back
without either silently no-op'ing (`updateMany` matching zero rows, since no
`InventoryItem` row has `organizationId` = a branch org) or writing to the
wrong row. Raised to the owner rather than guessing or forcing it through.
**Decision: compute per-location weighted-average on demand from the
`InventoryTransaction` ledger when needed (a future report or department-side
consumption), rather than storing a cached value.** No schema change. The
ledger transaction itself (this session's actual job) already carries the
correct dispatched `unitCost` per line, so nothing is lost — only a *cached*
average is deferred. Documented in `receive()`'s docstring for whoever reads
a department's average cost next (flagged below for Session 3/reports).

**FCM** — four new `fcm-service.ts` methods following the existing
one-method-per-event convention (never a generic "send push"):
`sendRequisitionSubmittedPush` (branch Managers, on raise),
`sendRequisitionDecisionPush` (Department Head, on approve/reject),
`sendDispatchInTransitPush` (Department Head, on confirm dispatch),
`sendReceiptVariancePush` (Central Store roles, on receive-with-variance).
Uses the existing `authRepository.findFcmTokensByRole` /
`findFcmToken` — no new repository methods needed.

**Delivery note printing — deferred, logged here rather than forced.** The
plan called for reusing "the existing thermal printing infra." On inspection,
the existing `PrintJob` model is order-shaped (`orderId` required FK,
`ReceiptType` enum of `BILL`/`RECEIPT`/`SETTLEMENT`) with no path for a
document not tied to an `Order` — wiring a delivery note through it is a
real, separate piece of scope (a new `ReceiptType` value or a parallel
document model, plus a new creation path decoupled from orders), not a
reuse. `deliveryNoteNumber` is generated (`DN-<yymmdd>-<4 chars>`, mirrors
`generatePoNumber`) and stored on `Dispatch` as the plan requires, so nothing
downstream (D3.2's UI, the delivery note number shown to the department head)
is blocked — only the physical print job itself is not wired up. Flagged for
whichever session first needs the actual print (likely Session 6, D3.2 "Fill
an Order").

**JWT/`departmentTag` plumbing (small, additive, not scope creep):**
`req.user`/`AccessTokenPayload` had no `departmentTag` field — needed to
resolve `requireDepartmentHead()` in both new services without an extra DB
round-trip on every request. Added `departmentTag?: DepartmentTag | null` to
`AccessTokenPayload` (jwt.ts), `Express.UserContext` (express.d.ts), the
`authenticate` middleware, both `signAccessToken` call sites in
`auth-service.ts`, and `userAuthSelect`/`userPublicSelect` in
`auth-repository.ts` — mirrors exactly how `role`/`organizationId` already
flow through the same path. One existing test
(`auth-service.test.ts`) needed its mock object updated for the new field;
no other Phase 1 code was touched.

**`InventoryTransaction` create/createMany extended** with
`dispatchLineId`/`marketPurchaseLineId` optional fields
(`inventory-transaction-repository.ts`) — the schema columns already existed
from Session 1's design; only the repository's input type was missing them.

**Q2 — can a department receive more than dispatched?** Plan's default:
allow, flag as variance. Implemented exactly as specced —
`receive()` does not cap `receivedQty` at `dispatchedQty`; any mismatch
(over or under) sets `hasVariance` and triggers `sendReceiptVariancePush`.

**Q5 — can the Store Manager dispatch without a requisition?** Plan's
default: yes. `dispatchService.createUnsolicited` takes a `toLocationId` +
lines directly, `requisitionId: null` (already nullable in Session 1's
schema). Covered by a unit test.

**Q6 — rejected requisition: edit-and-resubmit or raise fresh?** Plan's
default: edit + resubmit. `requisitionService.editAndResubmit` requires
`status === 'REJECTED'` and the actor to be the original raiser, replaces
lines wholesale via `requisitionRepository.replaceLines`, and transitions
back to `PENDING_MANAGER_APPROVAL` (clearing `approvedById`/`approvedAt`/
`rejectionReason`). Covered by a unit test.

**Tests:** `requisition-service.test.ts` (15 tests) +
`dispatch-service.test.ts` (14 tests) — 29 new tests, all passing on first
full run. Baseline was 724 tests / 74 files; now **753 tests / 76 files**,
zero regressions. `pnpm build` and `pnpm test` both clean.

**Not built in this session (deferred to Session 3 as planned):** market
purchase, par levels CRUD (only the read lookup needed for suggested
quantities was built), department-scoped stock/counts/waste, RBAC audit,
reports. No frontend, per scope boundaries.

---

## Session 3 — Remaining Backend + RBAC Audit + Reports

**Depends on:** 2. **Sized like:** Phase 1 Session 4 (four domains) plus Session 5
(RBAC + reports). Each piece here is small; the volume is in the reports.
**Natural split point if it runs long: finish the domains, hand reports to the next session.**

### Scope

**A. Market purchase** (D-11) — log purchase (DEPARTMENT_HEAD, own department):
item, qty, cost paid → writes `MARKET_RECEIVE` straight to the department location.
No PO, no supplier, no Central Store leg.

**B. Par levels** — set/update per (department, item); MANAGER or DEPARTMENT_HEAD.
Feeds Session 2's suggested quantities.

**C. Department-scoped stock, counts, waste** — extend the Phase 1 components:
- Stock-on-hand accepts any `locationId`, not just Central Store
- Counts and waste become department-scoped
- ⚠️ **Audit Phase 1 services for hardcoded single-location assumptions before
  extending.** This is where a Phase 1 defect would multiply across ~50 locations.

**D. RBAC audit** — every Phase 2 endpoint against a written matrix (mirror feature plan
§8.3 style; add a §8.4 for Phase 2 roles). One RBAC test per endpoint.

**E. Delivery note PDF** (D-20, deferred from Session 2)
- Generate a **PDF** delivery note for a dispatch — soft copy only, **no printing**
- Build on the existing `pdfkit` toolkit in `backend/src/utils/report-formatters.ts`
  (page borders, section labels, tables, footers already exist and are used for
  corporate statements) — **not** via the `PrintJob` model, which is order-shaped and
  cannot represent a document without an `orderId`
- Contents: delivery note number (already generated and stored on `Dispatch`), from/to
  location, date, per-line item + dispatched qty + unit cost, total value
- Endpoint returning the PDF for a given dispatch, so the UI can download or share it
- RBAC: visible to either side of the dispatch (D-16) — store roles and the receiving
  department head, plus MANAGER/DIRECTOR

**F. Reports**
- Stock on hand per department (Director, rolled up by branch)
- In-transit view
- Transfer variance (per dispatch / department / item)
- Fulfilment (requested vs. dispatched — chronically short departments)
- Weekly usage per item per department (count-down method)
- Market spend by department

### Watch out for
- Director sees all; Branch Manager own branch; Department Head own department; store
  roles see the store plus dispatch documents they are party to
- The usage number is **consumption + loss blended** until Phase 3 — label it as such
  **in the report output**, not only in documentation
- Resolve **Q1** here (does a DEPARTMENT_HEAD see expected qty during a count?) and
  record it in As Built

---

## Session 4 — Frontend: Department Head Mobile (7 screens)

**Depends on:** 3, **design group D1 approved**.
**Sized like:** Phase 1 Session 6 — which delivered six mobile screens plus nav wiring,
Zustand slices and mid-session backend fixes. Seven screens is the same shape.

### Scope
Build D1.1–D1.7 to the approved designs: Department Dashboard · New Requisition ·
My Requisitions · Receive Delivery · Log Market Purchase · My Department's Stock ·
Count & Waste.

Plus the wiring Phase 1's Session 6 As Built shows is always needed:
- `DEPARTMENT_HEAD` added to frontend `types/auth.ts`
- A `DEPARTMENT_HEAD` entry in `app/app/layout.tsx`'s `mobileRoleTabs`
- `roleLabels` map entry
- New Zustand slices per CLAUDE.md Frontend Hook Stability Rules

### Watch out for
- **FAB must not sit behind the bottom nav** — a real, previously-fixed bug in this product
- Reuse Phase 1 mobile components (count, waste, stock card list) rather than rebuilding
- Bottom-tab shell matching the existing Waiter/Chef pattern
- **D1.2 New Requisition has a < 5 minute target** — a gate criterion, not an aspiration
- `pnpm build` clean before marking Complete; exercise each screen at mobile viewport

---

## Session 5 — Frontend: Branch Manager (4 screens, desktop + mobile)

**Depends on:** 3, **design group D2 approved**.
**Sized like:** Phase 1 Sessions 7+8 (Manager desktop, then Manager mobile) — but four
screens rather than thirteen, so both shells fit in one session.

### Scope
Build D2.1–D2.4 to the approved designs, **desktop and mobile shells** per the
dual-layout decision: Requisition Approvals · All Five Departments Overview ·
Single Department Detail · Assign Department Heads.

### Watch out for
- **D2.1 is the most critical screen in Phase 2.** Approval is mandatory with no bypass
  (D-18), so a slow or buried screen stops the whole branch's ordering. It must be
  reachable in one tap from the manager's landing screen.
- **Approvals must work properly on mobile** — a manager approving from the floor is the
  normal case, not the exception
- Editing a quantity must show **original and approved** — never silently overwrite
- D2.4 must handle the **no head assigned** state as a normal state, not an error
- If the client later pushes back on mandatory approval, this screen is where the
  friction surfaces first

---

## Session 6 — Frontend: Central Store Dispatch (3) + Director (2)

**Depends on:** 3, **design groups D3 and D4 approved**.
**Sized like:** Phase 1 Session 7 (Manager desktop screens) — five screens, all desktop,
sharing the existing `ExcelTable`/reports patterns.

### Scope
- **D3.1–D3.3** (desktop/tablet): Dispatch Queue · Fill an Order · Dispatches List
- **D4.1–D4.2** (desktop): All Locations Overview · Reports

### Watch out for
- The store fulfils for **up to 50 branch/department combinations** — labelling and sort
  order are the difference between usable and useless
- Delivery note is a **PDF only** (D-20) — never a print job. Reuse `utils/report-formatters.ts`.
- Rolled-up Director numbers must drill to the department, then to the ledger
- The blended consumption/loss caveat must render **on screen**, not just in docs
- Slots into the existing reports nav; `ExcelTable`-driven; CSV export per convention

---

## Session 7 — Integration Pass + Gate Prep

**Depends on:** all. **Sized like:** Phase 1 Session 9.

### Scope
- End-to-end: raise → approve → fulfil → dispatch → receive → variance, across at least
  two branches and three departments
- Market purchase end-to-end
- Full RBAC re-verification against the §8.4 matrix
- Ledger reconciliation: department on-hand = sum of its ledger movements
- `pnpm build` + `pnpm test` (backend), `pnpm build` (frontend) — all green
- Write `PHASE2_VERIFICATION_GUIDE.md` in the shape of Phase 1's, for the owner's
  hands-on pass
- Update feature plan §5 to match what was actually built (see "§5 is stale")

### Gate (from feature plan §5)
One branch (the busier one), all five departments, **two weeks parallel with paper
delivery notes**. Pass: dispatches reconcile against paper notes, variance numbers are
explainable, requisition genuinely takes < 5 minutes per department.

**Expectation to set with the client before the gate:** until Phase 3, sales don't deduct
stock, so a department count gap is **consumption + loss blended**. It cannot separate
theft from sales yet. Say this up front — it protects trust in the numbers.

---

## Open questions to resolve during the build

Not blockers — each has a sensible default, but record the decision in As Built.

| # | Question | Suggested default | Resolve in |
|---|---|---|---|
| Q1 | ~~Does a DEPARTMENT_HEAD see expected qty during a count?~~ | **RESOLVED 2026-08-21 (owner): YES.** A Department Head sees expected quantities during a count — they are the department's manager-equivalent, same visibility a Store Manager has. The D-14 blind rule continues to apply to STORE_ATTENDANT only. | Session 3 — implement as decided |
| Q2 | Can a department receive **more** than dispatched? | Allow, flag as variance | Session 2 |
| Q3 | Where does a user's previous role live for unassignment? | Nullable `previousRole` on `User` | Session 1 |
| Q4 | What happens to a DEPARTMENT_HEAD transferred between branches? | Clear department, restore previous role | Session 1 |
| Q5 | Can the Store Manager dispatch **without** a requisition (unsolicited)? | Yes — `requisitionId` nullable | Session 2 |
| Q6 | Does a rejected requisition get edited-and-resubmitted, or raised fresh? | Edit + resubmit (keeps the audit trail) | Session 2 |

---

## Deviations from Plan

**Session 1 (2026-08-21) — `branchOrganizationId` dropped from `Location`.**
The plan as originally written called for a nullable `branchOrganizationId` on
`Location`. The implementing agent flagged it as redundant and was correct: per D-15,
`organizationId` on inventory data means "owning operating unit," so on a
`BRANCH_DEPARTMENT` row it already holds the branch org. The extra column would have
duplicated it on every branch-department row with no reader, and could drift from the
column that actually governs queries. Nothing in D-15, D-16 or the feature plan
required it — it appeared only in the session plan's own scope line. The dual-org
bridge is unaffected: it lives on `Requisition`/`Dispatch` via
`fromOrganizationId`/`toOrganizationId` (D-16), not on `Location`.
**Resolution: field not added.** Session 1 scope corrected above.

**Session 2 (2026-08-21) — D-8 per-location costing has no schema field; resolved
by computing on demand rather than storing.** D-8 specifies "weighted average
per item per location," but `InventoryItem.currentCost` is a single scalar
owned by the hub-org catalog row — this worked in Phase 1 only because
Central Store was the only location. The first time a branch department
needs its own average (receiving a dispatch), there is nowhere to write it:
no `InventoryItem` row has `organizationId` = a branch org, so writing there
would silently no-op. Raised to the owner rather than guessing or adding a
schema change mid-session. **Decision: no new model.** A location's
weighted-average cost is computed on demand from its own
`InventoryTransaction` history (same formula as `weightedAverageCost()`,
applied as a query) whenever something needs it next — flagged for whichever
Session 3+ piece is first to need a department's average cost (most likely a
report). The dispatch ledger transaction itself already carries the correct
per-line `unitCost`, so no data is lost, only a cached value is deferred.

**Session 2 (2026-08-21) — delivery note printing not wired to the existing
thermal print infra.** The plan asked for reuse of "the existing thermal
printing infra," but the existing `PrintJob` model is order-shaped (required
`orderId` FK, `ReceiptType` enum with no non-order value) — there is no path
for a document not tied to an `Order`. Wiring this up is real, separate
scope (a new receipt type or a parallel print-job path), not a reuse.
`deliveryNoteNumber` is generated and stored on `Dispatch` as specced, so
nothing depending on the number itself is blocked — only the physical print
job. Flagged for whichever session first builds D3.2 ("Fill an Order"),
likely Session 6.

**Design (2026-08-21) — D2.1/D2.2/D2.3 merged into one screen, "Branch
Stock"; D2.4 dropped as a bespoke screen; new "Branch Stock History" screen
added.** During Stage A design, the initial D2.1 Requisition Approvals
(Desktop) draft (sidebar + two-column master-detail) was flagged by the owner
as too sparse for a 1440px canvas — mobile density stretched onto a bigger
screen, violating the plan's own standing rule that Manager desktop screens
must be genuinely dense, purpose-built layouts. Rather than redesign D2.1 in
isolation, the owner proposed collapsing D2.1 (Requisition Approvals), D2.2
(All Five Departments Overview), and D2.3 (Single Department Detail) into one
screen, **Branch Stock**: a hairline-divided stats strip (Pending Approvals
hero, Low Stock Items, Total Branch Stock Value), department tabs with
glanceable low-stock counts driving a single dense ledger table (Item ·
Opening · Received · Market Purchase · Waste · Closing (live) · Value (KES)
· Par · Status — modeled directly on the real client stock-sheet photos),
and two list sections (Requisition Approvals, Dispatch Receipts) sharing one
row shell, each row opening a right-side drawer instead of navigating to a
separate screen. D2.3 (single department detail) is fully subsumed by the
department tabs; D2.2 (cross-department overview) is subsumed by the stats
strip plus the ability to switch tabs.

**D2.4 (Assign Department Heads) is dropped as a bespoke screen** — the
owner directed reuse of the existing Staff/HR screen instead, adding
department-head role assignment there rather than building a new screen.
Not yet scoped in detail (open item for backend/frontend session planning);
the Session 1 backend endpoints (`GET .../departments`,
`GET .../eligible-staff`, `PATCH/DELETE .../head`) are unaffected and still
correct — only the frontend surface changes.

**A new screen, "Branch Stock History," was added** (not in the original
16-screen catalogue), after the owner clarified via a Paper comment that
historical access needed to be one page, not a "Requisition History" list
alone: a date-picker-driven **Daily Ledger** section (the same ledger table
shape as the live Branch Stock screen, scoped to a selected past date, with
prev/next-day navigation) followed by a **Documents** section listing every
requisition and dispatch note together (typed, filterable by
type/department/status/date range, searchable), each row opening the
relevant document. This directly answers the "how do we store/access
historical requisitions" question raised mid-session: no new persistence
work is required (`requestedQty`/`approvedQty` are already both preserved
permanently per Session 2's design specifically for this purpose), only a
browsing surface, which this screen provides.

**A branded, printable "document view" pattern was designed for resolved
requisitions and dispatches** — not in the original screen catalogue, added
in response to the owner relaying a client request for a document-style
approval record ("their name and signature are appended to the document").
Two document artboards were built: a Requisition document (letterhead,
line-item table with requested-vs-approved and struck-through edits, a
diagonal translucent stamp — APPROVED in accent-brown or REJECTED in danger
red with a reason block and no signature, since nothing was authorized — a
totals band, and a script-signature parties block) and a Dispatch document
(same system, "Dispatched by / Received by" instead of "Submitted by /
Approved by," with **two independent stamps** — DISPATCHED appears once the
Store Manager confirms dispatch, RECEIVED appears once the Department Head
confirms receipt and renders in success-green with "IN FULL" if quantities
matched exactly, or danger-red with "VARIANCE" and an inline shortfall note
if they didn't). Both documents are pure CSS/SVG (condensed Oswald type,
double-ring borders, no raster assets) and sized to true A4 print
proportions (794&times;1123px) after an early full-bleed-dark-header version
was reworked for print-ink economy. This document view is explicitly the
**resolved-state / after-action / export view only** — the interactive
approval itself stays a fast drawer with steppers and Approve/Reject
buttons (see next entry), so the 5-minute/one-tap approval target set for
D2.1 is unaffected.

**The Requisition Approvals drawer interaction was designed**: clicking a
row in Branch Stock's Requisition Approvals or Dispatch Receipts list opens
a 520px right-side panel over a dimmed scrim (sidebar stays undimmed), with
the same fast stepper-per-line review UI already validated on mobile D2.1's
Requisition Detail screen, plus Approve with Changes / Reject actions in a
fixed footer. This is the actual interaction Session 5 (frontend, Branch
Manager) should build; the branded document view above is what the drawer
(or a print/export action) shows after the requisition is resolved, not the
review UI itself.

**Net scope effect on Session 5** (Frontend: Branch Manager, desktop +
mobile — currently Not Started): originally scoped as 4 screens
(D2.1-D2.4); as designed, it is now 3 desktop surfaces (Branch Stock, Branch
Stock History, the resolved-document view reused across both) plus a right-
drawer interaction, mobile D2.1 (2 screens, unchanged, still separate per
the owner's explicit decision during this same design pass), and the
Staff/HR extension for department-head assignment (cross-references
whatever session ends up touching Staff/HR — not yet assigned). Session 5's
scope line and "Watch out for" section should be revisited before that
session starts to reflect this.

Design artboards (Paper file "Wendo RMS," pending final owner approval
before Session 5 frontend build):
- `D2.1+2.2+2.3 — Branch Command Center (Desktop)` (in-progress working name;
  screen is referred to as "Branch Stock" in nav/title text — artboard
  should be renamed to match before Session 5 to avoid confusion)
- `D2.5 — Branch Stock History (Desktop)`
- `D2.1 — Requisition Document (Approved)`
- `D2.1 — Requisition Document (Rejected)`
- `D3.2 — Dispatch Note (Dispatched + Received)` (variance example)
- `D3.2 — Dispatch Note (Clean, No Variance)`
- `D2.1 — Branch Stock with Drawer Open (Desktop)`

The old sparse `D2.1 — Requisition Approvals (Desktop)` artboard was deleted
2026-08-21 after the owner confirmed the above fully supersedes it.

---

*Created 2026-08-20, after Phase 1 was verified hands-on by the owner and blocking
decisions D-16 through D-19 were resolved. Companion to `INVENTORY_FEATURE_PLAN.md`
(the spec), `INVENTORY_PHASE1_SESSION_PLAN.md` (Phase 1 build log), and
`PHASE1_VERIFICATION_GUIDE.md` (the Phase 1 verification pass).*
