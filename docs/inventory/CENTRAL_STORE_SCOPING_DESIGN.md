# Central Store Organization-Scoping — Design Proposal (for owner review)

**Status: IMPLEMENTED & DEPLOYED 2026-07-31.** Owner approved same day; the full
package (migrations, guards, UI fixes, Store Staff screen) shipped in commits
`ed54bf4` + `924726b`, was owner-verified end-to-end on a restored production backup
(see `PHASE1_LOCAL_TEST_GUIDE.md`), and reached production via PR #34. Logged in the
feature plan as **D-15**. §5's item numbering below reflects the original proposal;
everything listed was built except where noted.
Prepared 2026-07-31 on `feature/inventory-phase1`, in response to the scoping gap found
while building the (now-reverted) "create Central Store Location" admin feature.

---

## 1. The Problem, Restated Precisely

- The system has no `Branch` table. Each physical branch **is** an `Organization` row —
  `organizationId` is simultaneously the tenancy boundary and the branch identity.
- Every Phase 1 inventory table (`Location`, `InventoryItem`, `Supplier`, `SupplierItem`,
  `PurchaseOrder`(+lines), `SupplierInvoice`, `SupplierPayment`, `PrepRecipe`(+lines),
  `PrepRecord`(+lines), `StockCount`(+lines), `WasteLog`, `InventoryTransaction`) carries a
  required `organizationId` (verified complete against `schema.prisma` — 18 inventory
  models, all org-scoped, all with an `@@index([organizationId])`).
- All 8 inventory services (`inventory-item`, `supplier`, `supplier-invoice`,
  `purchase-order`, `prep-record`, `stock-count`, `waste-log`, `inventory-report`, plus
  `location` and `inventory-transaction`) derive scope exclusively from
  `actor.organizationId` via a `requireOrganization(actor)` helper (~55 call sites).
  Every inventory repository query filters by that single value.
- Per the feature plan (D-1, §1), the Central Store is **one facility serving every
  branch** — it cannot belong to one branch's `Organization` without becoming invisible
  to the other nine.

D-10 ("every new table carries `organizationId`") was applied mechanically without
resolving *which* organization the Central Store's rows belong to. That is the gap.

## 2. Key Finding: The "Parent Tenant" Already Exists

The investigation changed the shape of this problem. The codebase **already contains a
company-level organization**, and Phase 1 dev tooling already uses it:

1. **`Organization.isHub`** (`schema.prisma:22`) — exactly one org can be flagged as hub;
   `branchRepository.setHub` (`backend/src/repositories/branch-repository.ts:70`)
   enforces single-hub atomically, and the Admin screen exposes it.
2. **Every frontend branch picker already excludes the hub org** — 15+ pages filter
   `data.filter((b) => b.isActive && !b.isHub)` (director, accountant, HR payroll,
   customer credit, other-income, history, sidebar nav…). The hub org is *already*
   treated as "the company, not a branch" across the product.
3. **`seed-dev.ts` already anchors Phase 1 to the hub org**: the Central Store
   `Location` row and both `STORE_MANAGER` / `STORE_ATTENDANT` dev users are created
   under `hubOrg.id`, with the comment "assigned to the hub org for tenancy scoping
   only." `seed-inventory-demo.ts` (the Session 9 real-catalog seed) follows the store
   manager's org, so all seeded Phase 1 data already lives on the hub org.
4. **Cross-org access patterns already exist**: Director/Accountant read any branch via
   `resolveBranchScopedOrganizationId` (`report-service.ts:71` — role-gated
   `organizationId` query param), and `StaffTransfer` is a committed precedent for a
   **two-org document** (`fromOrganizationId` / `toOrganizationId`,
   `schema.prisma:171-189`).

So the honest answer to "how big was the mistake?": **small, and mostly already
mitigated by convention.** `Organization` never really meant "tenant company" here — it
means "operating unit," and the system already runs N branch units + 1 company unit
(the hub). What was missing is *codifying* that the Central Store belongs to the
company unit, and enforcing it so the pilot can't accidentally tie store data to a
branch. No `Branch` table retrofit is needed, and none is recommended.

## 3. Options Considered

### Option A — Central Store data lives on the hub (company) Organization ✅ RECOMMENDED
All Central Store rows (`Location` of type `CENTRAL_STORE`, catalog, suppliers, POs,
AP, prep, counts, waste, ledger) carry `organizationId = <hub org>`. Store Manager /
Store Attendant users are hub-org users. Phase 2 cross-branch documents
(Requisition/Dispatch) bridge orgs explicitly, like `StaffTransfer` does.

- **Pros:** zero schema change to any existing inventory table; zero middleware change;
  all 55 `requireOrganization` call sites keep working unmodified; non-negotiable #3
  ("every repository query includes organizationId") stays mechanically true; matches
  what seed-dev/demo data already do; hub org is already invisible to every branch
  picker so no UI leakage.
- **Cons:** `organizationId` becomes semantically overloaded ("branch" for POS data,
  "company" for Central Store data) — mitigated by documentation (D-15 below) and
  validation guards; relies on exactly one hub org existing (guarded, see §5).

### Option B — Join table (`Location` ⇄ served `Organization`s)
Models *which branches a store serves*. Rejected for v1: D-1a fixes the answer at "the
one Central Store serves every branch, always" — a join table adds a query hop and
admin surface to represent a constant. It is purely **additive** if multi-store ever
happens, so deferring it costs nothing and forecloses nothing.

### Option C — Nullable / sentinel `organizationId` for shared rows
Rejected outright: breaks non-negotiable #3, makes Prisma types nullable everywhere,
breaks `@@unique([organizationId, type])` under Postgres NULL semantics, and forces a
parallel access-control layer that Option A gets for free from existing RBAC.

### Option D — Proper `Company` → `Branch` two-level tenancy refactor
The "correct greenfield" answer, but the blast radius is the entire codebase (every
table, every JWT, every query, every report) for zero functional gain in Phases 1–3.
Wendo is one company; a second-level tenant only matters if this becomes a multi-company
platform, at which point a bigger migration happens regardless. Rejected per
minimum-correct-change.

## 4. The Design (Option A, concretely)

### New decision for the feature plan (proposed **D-15**)
> **The Central Store is scoped to the hub Organization.** The org flagged `isHub` is
> the company-level operating unit (never a point of sale, already excluded from all
> branch UI). All Central Store inventory data and all `STORE_MANAGER` /
> `STORE_ATTENDANT` accounts carry the hub org's `organizationId`. For inventory data,
> `organizationId` means "owning operating unit," not "branch." D-10 unchanged
> mechanically; this refines its meaning for the inventory domain.

Note this does **not** reopen D-1: the store is still its own `Location` entity, never
a branch, never `Branch.isHub`-as-store. The hub org is the *owner tenant* of that
Location, nothing more.

### Refinement to the CLAUDE.md non-negotiable #3 (explicit, as required)
The rule "every repository query includes `organizationId`" **stands unmodified for
Phase 1**. For Phase 2, it needs one documented refinement: *cross-boundary inventory
documents (Requisition, Dispatch) are scoped by exactly one side's organizationId per
query — the branch org for department-side queries, the hub org for store-side queries
— never unscoped.* This sentence should be added to CLAUDE.md when Phase 2 design
closes, alongside D-15 in the plan doc now.

### Phase 2 sketch (to prove Option A doesn't dead-end)
- `Requisition`: `organizationId` = branch org (creator: department head),
  `locationId` = branch-department location. Store-side dispatch queue = role-gated
  query for open requisitions across orgs (the documented exception above), mirroring
  how Director reads cross-branch today.
- `Dispatch`: `organizationId` = hub org, plus `toOrganizationId` + `toLocationId`
  (branch department) — the `StaffTransfer` two-org pattern, verbatim.
- `authenticate` / `branchScope` / JWT payload: **no changes in any phase.** A store
  user's single hub-org session is sufficient; they never need to "act as" a branch.
  Cost travels on dispatch lines; `dispatch_in` ledger rows are written under the
  receiving branch's org by the receiving department head.
- Known Phase 2 schema item (out of scope now, flagged): `Location`'s
  `@@unique([organizationId, type])` cannot hold once five `BRANCH_DEPARTMENT` rows
  exist per branch org — Phase 2 must widen it (e.g. add a `department` column to the
  key). The existing schema comment (`schema.prisma:1424-1428`) already anticipates this.

## 5. Changes Required Now (Phase 1 hardening — small, all additive)

> **Rehearsal note (2026-07-31):** restoring the production backup locally surfaced a
> merge-day blocker — orphaned schema from the reverted March "V2.1 inventory" build
> (11 legacy tables incl. an old `suppliers`, plus a `STORE_MANAGER` enum label) that
> made the Phase 1 migration fail. Already fixed on this branch:
> `20260728101630_drop_legacy_inventory_v2` (drops the legacy objects; **deletes the
> stale March data on prod at merge time** — preserved in nightly dumps) and
> `ADD VALUE IF NOT EXISTS` in the Phase 1 migration. Verified: all 53 migrations
> apply cleanly on the prod copy.

1. **One new migration** (on top; do **not** amend the four committed Phase 1
   migrations — they are applied to local DBs and Phase 1 is unmerged, so a new file is
   both safer and cheaper). Content: a partial unique index enforcing the global
   single-store invariant, which `@@unique([organizationId, type])` does *not* (it
   currently allows one CENTRAL_STORE **per org**, i.e. ten stores):
   ```sql
   CREATE UNIQUE INDEX "locations_single_central_store"
     ON "locations" ("type") WHERE "type" = 'CENTRAL_STORE';
   ```
   Prisma's DSL can't express partial indexes — create via
   `npx prisma migrate dev --create-only`, hand-edit, and note it in a schema comment.
   No data backfill: production has no inventory tables until this branch merges, and
   local dev data is already hub-org-scoped (reseed locally if any stray branch-org
   test rows exist).
2. **Unblock the reverted POST /locations feature** with one guard: creating a
   `CENTRAL_STORE` location requires the target org to be the hub org
   (service-level check on `organization.isHub`, 422 otherwise). This removes the
   "whichever org got picked" failure mode that triggered this whole investigation.
3. **Store-user assignment guard**: staff-service create/update validates that
   `STORE_MANAGER` / `STORE_ATTENDANT` users are assigned to the hub org (and the
   Admin staff UI preselects/locks it).
4. **`setHub` guard**: `branchRepository.setHub` currently allows moving the hub flag
   freely; once Central Store rows exist under the hub org, re-flagging a different org
   would strand all inventory data. Add a service check: refuse hub reassignment while
   a `CENTRAL_STORE` location exists on the current hub.
5. **HR payroll dropdown fix**: [hr/payroll/page.tsx:173](frontend/app/app/hr/payroll/page.tsx#L173)
   is the only HR screen that filters the hub org out of its branch list
   (`!b.isHub`) — store staff (and the Director, already hub-assigned in dev seed)
   would be invisible on the payroll sheet. Include the hub org in that dropdown
   (label it "HQ / Central Store"). HR staff list, attendance, and shifts have no
   such filter and need no change.
6. **Docs**: add D-15 to the feature plan §2 + a line in the Open Decisions Log; add
   the §4 refinement note to CLAUDE.md's non-negotiables when Phase 2 lands.
7. **Visibility rule + fixes from the 2026-07-31 prod-copy rehearsal.** The rule:
   **the Central Store org appears in people contexts, never in sales contexts.**
   People contexts (staff, shifts, attendance, payroll, comms, admin management)
   include it; sales/revenue contexts (collections, revenue reports, branch sales
   pickers) exclude it. Fixes found by walking the UI on a restored prod copy:
   - Admin "Active Branches" stat ([admin/page.tsx:561](frontend/app/app/admin/page.tsx#L561))
     counts hub orgs — show `!isHub` count (3, not 4). The Branches *table* keeps
     showing it with its Hub badge (management surface — intentional).
   - Accountant dashboard "Collections by Branch" shows Central Store — the backend
     `reportRepository.getBranchOverview` (and sibling org enumerations in
     report-repository.ts) enumerate all orgs. Fix server-side with `isHub: false`
     on sales-report org queries so every consumer (accountant + director) is fixed
     at once.
   - Admin "Leadership Accounts" never lists store roles — the page only fetches
     MANAGER/DIRECTOR/ACCOUNTANT/HR_MANAGER ([admin/page.tsx:148](frontend/app/app/admin/page.tsx#L148)),
     though its create-form already supports STORE_MANAGER. Fetch and list
     STORE_MANAGER there.
   - Shifts already includes Central Store (no filter) — correct, no change.
8. **Store Manager creates Store Attendant accounts** (owner decision 2026-07-31,
   mirrors branch-Manager staff creation): add `STORE_MANAGER` to the staff-create
   endpoint's roles with a service-level guard restricting them to creating
   `STORE_ATTENDANT` users in their own (hub) org only, plus a minimal staff screen
   in the Store Manager nav. Admin/HR retain the ability to manage both store roles.
9. **Ops step (pre-pilot, production)**: confirm a hub org exists and is flagged via
   the Admin screen (create "Wendo HQ" if the two production orgs are both branches),
   *before* creating the Central Store location or store-user accounts.

Explicitly **not** changing: any non-inventory table or flow, `authenticate`,
`branchScope`, `rbac`, the JWT payload, the four committed migrations, and the five
branch departments' branch-scoping (D-1a stands).

## 6. Sequencing

1. Owner approves this doc (and D-15 wording).
2. Docs updates (plan §2/§7; CLAUDE.md note can wait for Phase 2).
3. Migration (item 5.1) → `pnpm build` + `pnpm test` (backend), `pnpm build` (frontend).
4. Guards (items 5.2–5.4) with tests, then rebuild the POST /locations feature on top.
5. Ops hub-org check on production at merge/pilot time (item 5.6).

Estimated size: one migration file + three service-level guards + tests. No frontend
changes beyond the admin location/staff forms already planned.
