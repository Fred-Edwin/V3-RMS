# Milestone Four — Session A (Department Head Fill) — Final Plan

## Handoff note (read this first if you are a fresh session)

This plan was written by a prior session that spent its context budget on
research (two Explore agents + one Plan agent + live Paper MCP screen
reads) and deliberately stopped before writing any code, to hand off with a
full context budget for the actual build + verification. **You are that
fresh session.** This file is checked into the repo at
`docs/features/inventory/milestone-4-sessions/session-a-plan.md` (matching
the `milestone-2-sessions/`/`milestone-3-sessions/` convention already in
this folder) specifically so you can read it directly — no need to re-derive
anything in §"Decisions already made" or §"Resolved this session via live
Paper inspection" below; those are settled facts, not open questions. Start
at §1 (Migrations) and work top to bottom. If anything below turns out to
be wrong once you're in the code, fix it and note the correction — don't
silently work around a stale assumption.

## Context

Milestone Four ("Requisition & Branch Approval") is owner-approved at Step 5
(`docs/features/inventory/milestone-4-plan.md`, "Ready for Step 7, Session
A"). This is Session A: the Department Head side of a two-session split —
opening a requisition, filling one department's section against a par
reference, adding a note, submitting, recalling, and getting returned. No
approval, no dispatch, no ledger write — that's Session B and later
milestones. This plan turns the approved high-level spec into concrete,
orderable build steps, corrected against (a) live codebase investigation and
(b) the actual approved Paper screens (read directly via MCP this session,
not inferred), and resolved against three decisions you already confirmed.

## Decisions already made (do not re-litigate during build)

1. **Fix the dead `role === 'DEPARTMENT_HEAD'` bug as part of this session.**
   Milestone One's restock-level code (`inventory-routes.ts:70,75`,
   `inventory-service.ts:568,597`) still branches on the legacy
   `UserRole.DEPARTMENT_HEAD` enum value instead of the `isDepartmentHead`
   marker established by the 2026-09-03 refactor. Every real department head
   gets a 403 on Restock Levels today. Fix: swap the role check for the
   marker (`requireRole('STORE_MANAGER', 'DEPARTMENT_HEAD')` →
   `[requireRole('STORE_MANAGER'), requireDepartmentHead]`-style OR-gate in
   the routes file; `actor.role === 'DEPARTMENT_HEAD'` →
   `actor.isDepartmentHead` in the service). Small, isolated, unblocks real
   `RestockLevel` data for `parAtRequest`.
2. **`RequisitionLine.parAtRequest` is `Decimal?` (nullable)** — a small,
   explicit deviation from the milestone plan's literal §1.2 sketch (which
   typed it non-nullable). Null means "no restock level set for this branch
   department/item yet," which is expected to be common initially. The
   frontend renders null as a blank/dash reference, never a literal "0".
3. **Run `backend/src/scripts/provision-branch-departments.ts` locally** as
   a one-time setup step before browser verification, so branch-department
   `Location` rows exist for `RestockLevel` lookups and Milestone 5 later.

## Resolved this session via live Paper inspection (corrects the draft plan's guesses)

Read `122U-0`, `10HO-0`, and all six `10PT-0`-family fill-screen states
directly (file `01M1ZZJ6S3FZGF5C7PPBGTKY89`, page `p-E-0`) rather than
inferring. Findings that change the build:

- **Screen 0 (`122U-0`, "Requisitions" landing) is a cross-milestone hub,
  not a Session-A-only dashboard.** It has four cards: REQUISITION (this
  milestone — a single "most recent/active requisition" card with a
  Start/Continue action), INCOMING DISPATCH (Milestone 5 — "Confirm
  receipt"), THIS MORNING opening count (Milestone 6), and QUICK ACTIONS
  (Log waste / View history — other milestones). **Session A builds only
  the REQUISITION card for real; the other three render as static,
  visually-present but non-functional/disabled placeholders** (or are
  simply omitted for this session and added back by Milestones 5/6 in their
  own sessions — recommend rendering them statically-disabled rather than
  omitting, since the mock shows all four and omitting entirely would look
  broken/incomplete; they do nothing when tapped). **This answers Q6: no
  new backend endpoint needed.** The REQUISITION card's data is just "the
  caller's single most recent requisition, and my section's status within
  it," sourced from `GET /requisitions` (already role-scoped), no landing
  aggregate needed.
- **The six fill-screen states are not what was guessed.** Confirmed
  mapping:
  - `10PT-0` — base editable state (fresh, `NOT_STARTED`/`DRAFT`, no note yet)
  - `10J9-0` — editable with a manager-note already added (`DRAFT`, "Draft
    saved 14:02")
  - `10LE-0` — submitting (button shows "Submitting…", inputs disabled) —
    a transient loading state, not the generic list-loading skeleton
  - `10NJ-0` — **offline/error state** ("Couldn't reach the branch —
    you're offline. Your section is saved on this phone…") — a specific
    offline-queue message, not a generic error card
  - `10RO-0` — submitted, read-only, awaiting approval, with "Recall
    section" action
  - `10TV-0` — returned by manager (banner: "RETURNED BY PETER N. · 14:15"
    + their note), editable again, action reads "Resubmit section"
  - There is **no dedicated permission-denied state among these six** —
    that's handled by the existing generic `MobilePermissionDeniedState`,
    used only if a non-head or wrong-department actor somehow reaches the
    route (middleware should prevent this before render in practice).
- **Per-line UI is a stepper (−/qty/+), not a bare number input**, with a
  trailing trash/delete icon per row — but per the milestone plan's own
  explicit deviation note (§0), **the "on hand X ·" prefix in the par
  caption and the automatic below-par pre-fill are dropped this milestone**
  — build the stepper exactly as shown, just render the caption as "par 20
  pcs" (drop "on hand 6 ·"), and lines start at `requestedQty: null`
  (blank/zero stepper) rather than pre-filled at par-minus-on-hand. An
  edited line shows an "↗ changed from N" caption in warning tone and a
  primary-colored border on the stepper container — this is the real,
  observed edited-value treatment (border + `wds-primary`/warning caption),
  not an abstract rule to reinvent.
- **Category grouping in the mock is single-level** (CHICKEN / BEEF /
  MARKET ITEMS section headers, flat items under each) — no two-level
  nesting is visible in this Kitchen example screen. The milestone plan's
  schema/data-model still supports two-level nesting via
  `Category.parentCategoryId` for when it's configured; build the grid
  data-driven (collapses to one level automatically when no line's category
  has a parent), matching the plan's own framing, not hardcoded to what
  this one screenshot happens to show.
- **Screen 1 (`10HO-0`, "Requisitions" list)** groups by "NEEDS YOUR
  SECTION" (not-started/draft — primary CTA "Start requisition") vs.
  "EARLIER TODAY" (submitted → "View my section" + inline "Recall" button;
  approved → "See what changed"). Recall is reachable directly from the
  list row, not only from inside the fill screen.

## 1. Migrations (`backend/`)

Two Prisma migrations, both additive:

1. **`add_category_parent_category_id`** — add `parentCategoryId String?
   @map("parent_category_id")` to `model Category` (bare column, no
   self-relation block — matches the plan's literal §1.1 sketch; a relation
   isn't needed for Session A's query pattern, which reads category name +
   parent name via a straightforward second lookup in the repository).
   `npx prisma migrate dev --name add_category_parent_category_id`.
2. **`inventory_milestone_four_requisition`** — the three enums
   (`RequisitionType`, `RequisitionStatus`, `RequisitionSectionStatus`) and
   three models (`Requisition`, `RequisitionSection`, `RequisitionLine`)
   exactly per milestone-4-plan.md §1.2, **except** `RequisitionLine.parAtRequest`
   is `Decimal?` (decision #2 above, not the plan's literal non-nullable
   sketch). Add back-relations: `User.requisitionsOpened`,
   `User.requisitionsApproved`, `User.requisitionSectionsSubmitted`,
   `User.requisitionLinesEdited`; `Organization.requisitions`;
   `InventoryItem.requisitionLines`. `npx prisma migrate dev --name
   inventory_milestone_four_requisition`.

Both run locally via `npx prisma migrate dev`, generated SQL committed,
never run directly against production (per CLAUDE.md's migration workflow).

**Also this session:** the 2-line dead-role-check fix (decision #1) is a
code change, not a migration — no schema impact.

**Setup step (decision #3):** run
`backend/src/scripts/provision-branch-departments.ts` locally once, so
`BRANCH_DEPARTMENT` `Location` rows exist for every branch org × department
combination.

## 2. Backend — `backend/src/modules/requisitions/`

New directory (per plan §9), co-located shape matching `prep-*`/
`receiving-*`'s file-naming convention:

```
backend/src/modules/requisitions/
  requisitions-routes.ts
  requisitions-controller.ts
  requisitions-service.ts
  requisitions-repository.ts
  requisitions-validators.ts
  requisitions.types.ts
  requisitions-contract.test.ts
  requisitions-service.test.ts
```

### Endpoints built this session (6 of the plan's §3.2 table — DEPARTMENT_HEAD rows)

| Method | Path | Notes |
|---|---|---|
| `POST` | `/requisitions` | Opens requisition + creates all 5 `RequisitionSection` rows (one per `DepartmentTag`, `NOT_STARTED`) in one transaction |
| `GET` | `/requisitions` | Role-scoped list; for a department head, each row surfaces only `mySectionStatus` (their own section), never other departments' |
| `GET` | `/requisitions/:id/sections/:departmentTag` | Fill-screen payload: lines with item name, usage unit, category + parent-category name, `parAtRequest` (nullable), `requestedQty` |
| `PATCH` | `/requisitions/:id/sections/:departmentTag/lines` | Bulk upsert: existing line qty edits (incl. `"0"`, zero-not-delete) + new lines (add-item, snapshots `parAtRequest` from `RestockLevel` at creation time) + `managerNote` |
| `POST` | `/requisitions/:id/sections/:departmentTag/submit` | `NOT_STARTED`/`DRAFT` → `SUBMITTED`; flips parent `Requisition.status` `OPEN` → `PENDING_APPROVAL` only on the first section submitted |
| `POST` | `/requisitions/:id/sections/:departmentTag/recall` | `SUBMITTED` → `DRAFT`; rejected if `Requisition.status === 'APPROVED'` |

**Validators (`requisitions-validators.ts`):** Zod schemas per prep's
pattern — local `decimalString`/`positiveDecimalString`/`uuid`/`isoDate`
primitives (duplicated locally, no shared package, matches prep/receiving
precedent). `UpsertRequisitionLinesSchema`'s line entries use
`decimalString.nullable()` for `requestedQty` (must allow `"0"`, so
`positiveDecimalString` is wrong here), and a `.refine()` requiring either
`id` (existing line) or `inventoryItemId` (new line). Response schemas
mirror exactly what the service serializes (contract-test-verified).

**Repository (`requisitions-repository.ts`):** every method takes
`organizationId` explicitly (Non-Negotiables #2/#3); accepts optional
`Client = typeof prisma | Prisma.TransactionClient` for transaction use
(prep's pattern). State-transition methods (`setSectionStatus` for
submit/recall) use the `updateMany` + count-check pattern
(`receiving-repository.ts`'s `markSigned` precedent: `where` includes the
expected current status, zero rows affected → service throws
`ConflictError` — no silent partial-state).

**Service (`requisitions-service.ts`):** business logic, no ledger writer
(explicitly out of scope, plan §0/§8 — this is the first requisition
milestone since Prep that doesn't touch `InventoryTransaction`).
**Critical authorization guard, the single highest-priority check in this
session:** every section-scoped method (`getSection`, `upsertLines`,
`submitSection`, `recallSection`) must assert `departmentTag ===
actor.departmentTag` in the service layer — the route's
`requireDepartmentHead` middleware only confirms *a* department head, not
*which* department, so without this check a Kitchen head could read/write
another department's section by changing the URL param. `parAtRequest`
sourcing: look up `RestockLevel` for `(branch-department location for this
org+departmentTag, item)`; if none exists (expected to be common until
Milestone One's par-setting flow is actually used per-branch), snapshot
`null` — no fallback, no zero.

**Controller (`requisitions-controller.ts`):** thin, mirrors
`prep-controller.ts` — local `requireActor(req)` helper, Zod `.parse()`,
uniform `{ success: true, data, message? }` envelope, 200/201 status.

**Routes (`requisitions-routes.ts`):** `router.use(authenticate)` once,
then every route gated with `requireDepartmentHead` (the marker-check
middleware — **never** `requireRole('DEPARTMENT_HEAD')`, the dead enum
value being fixed elsewhere this session per decision #1). `POST
/requisitions` and `GET /requisitions` are department-head-only in Session
A (MANAGER access to the same paths is Session B's route-file addition,
not built here — keeps this session's surface minimal, no half-built
MANAGER logic).

**Route wiring (`backend/src/routes/index.ts`):** import
`requisitionsRoutes` from `../modules/requisitions/requisitions-routes`,
append `apiRouter.use(requisitionsRoutes)` after the existing
`prepRoutes` line.

### Tests

- **`requisitions-contract.test.ts`** — Zod schema drift guard (mocked
  repos, matches `prep-contract.test.ts` shape): each endpoint's request
  schema accepts valid / rejects invalid payloads; `"0"` accepted for
  zero-not-delete, negative decimal rejected; line refine rejects
  neither-id-nor-inventoryItemId; response envelope shape per controller
  method.
- **`requisitions-service.test.ts`** — fixed UUID fixtures, builder
  functions (matches `prep-service.test.ts` shape): `openRequisition`
  creates exactly 5 sections; **cross-department `ForbiddenError` guard on
  all 4 section-scoped methods** (highest-value test this session);
  zero-not-delete keeps the row; upsert rejected when section is
  `SUBMITTED`/`RETURNED`; submit transitions state + flips parent status
  once only; submit throws `ConflictError` on a simulated zero-count race;
  recall transitions `SUBMITTED`→`DRAFT`, rejected when requisition is
  `APPROVED`; `parAtRequest` snapshot is `null` when no `RestockLevel` row
  exists, the real value when one does.
- **Category regression test** — extend the existing category CRUD test
  file in `backend/src/modules/inventory/` (find the exact existing
  describe block first, don't assume a filename) with one case confirming
  category list/create/rename still work unaffected by the additive
  `parentCategoryId` column.

## 3. Frontend — `frontend/features/requisitions/`

New feature folder (plan §9), same co-located shape as
`features/inventory/`:

```
frontend/features/requisitions/
  index.ts                                      # barrel — screens + types only
  types/index.ts                                # hand-mirrors backend Zod contract
  services/
    requisitions-api-service.ts
    index.ts
  hooks/
    use-requisitions-list.ts                    # screen 1 + screen 0's "my requisition" card
    use-requisition-section.ts                  # screen 2a: load + local edit map + save/submit/recall
  components/
    category-grouped-line-grid.tsx              # new composite — see §4 below
    screens/
      department-landing-screen.tsx             # screen 0 — 122U-0
      requisitions-list-screen.tsx               # screen 1 — 10HO-0
      requisition-section-fill-screen.tsx        # screen 2a — 6 states, 10PT-0 family
```

**`types/index.ts`:** hand-mirror the backend contract 1:1 (no shared
package, per CLAUDE.md/prep precedent); reuse `DepartmentTag` from
`features/inventory/types` if already exported there rather than
redeclaring.

**`services/requisitions-api-service.ts`:** thin `apiClient` wrappers,
exact shape of `prep-api-service.ts` — local `token()` reading
`useAuthStore.getState().accessToken`, local `toQueryString` helper.
Functions: `openRequisition`, `listRequisitions`, `getRequisitionSection`,
`upsertRequisitionLines`, `submitRequisitionSection`,
`recallRequisitionSection`.

**Hooks** — plain `useState`/`useCallback`/`useEffect`, stale-closure-flag
pattern for refetch races (matches `use-prep-runs-list.ts`), obeying
CLAUDE.md's Frontend Hook Stability Rules (every action is a stable
`useCallback`; Zustand read via selector, never whole-store destructure;
no unstable inline function in an effect's deps):

- `use-requisitions-list.ts` — loads `listRequisitions()`; exposes the
  full list for screen 1's grouped rendering (NEEDS YOUR SECTION / EARLIER
  TODAY, derived client-side from each row's `mySectionStatus`) and the
  single most-recent entry for screen 0's REQUISITION card.
- `use-requisition-section.ts` — loads `getRequisitionSection`; holds a
  local edits map (lineId → pending `requestedQty`, matching
  `use-restock-levels.ts`'s dirty-map shape) so unedited values render
  plain and edited ones get the accent treatment; `save()` calls
  `upsertRequisitionLines` with only the changed/added lines;
  `submit()`/`recall()` call their dedicated endpoints directly.

**`components/category-grouped-line-grid.tsx`:** feature-scoped (not
`ui2/`), the genuinely-new composite. Build procedure (Playbook Step 4,
already partly done this planning session — computed styles for `10PT-0`
were read via `get_jsx` above; **re-confirm exact computed styles via
`get_computed_styles` at build time** for precise token mapping, spacing,
and the stepper/border/caption treatment before writing the final CSS).
Structural requirements, now grounded in the actual Paper node rather than
guessed:
- Category header rows: `wds-neutral-50` background, bottom hairline,
  mono uppercase label (`CHICKEN`, `BEEF`, …) — matches
  `restock-level-grid.tsx`'s general section-header idiom.
- Item row: name + `par N unit` caption (on-hand text dropped per the
  milestone's approved deviation), stepper control (−/value/+, `wds-border`
  default), trailing delete icon.
- Edited-line treatment (observed, not invented): stepper container gets a
  `wds-primary`-colored border (1.5px) and the qty text goes bold/ink-
  colored; an "↗ changed from N" caption renders under the item name in
  warning tone. Unedited lines: default border, regular-weight qty text, no
  extra caption.
- "+ Add an item" row and "Add a note for the manager" row below the last
  category card, matching the mock exactly (warning-tone plus icon for
  add-item; pencil icon + neutral text for the note row, becoming an
  editable note card with an "Edit" link once a note exists).
- Two-level grouping (parent category → category) only renders when data
  has a non-null `parentCategoryId` somewhere in the section; otherwise
  collapses to the single-level rendering shown in every screen this
  session actually saw (Kitchen's own mock included — confirms this isn't
  hypothetical, the real Kitchen example is flat here too, so this build
  must not hardcode "Kitchen = nested").
- Props: flat `lines: RequisitionLineView[]` + `edits` map + `onQtyChange`
  + `onAddItem` + `onDeleteLine`, matching the read-model framing (backend
  returns flat lines with category metadata; frontend groups).

**Screens** — all three mobile-only this session (no desktop counterpart
exists for these three nodes). Each: `hydrated` guard, `<MobileStatusBar
/>` first child, `MobileHubHeader` (screen 0) or `MobileTaskHeader`
(screens 1 and 2a — back chevron + title, matching the observed headers),
then content.

- **`department-landing-screen.tsx`** (screen 0) — renders the REQUISITION
  card for real (Start/Continue action, wired to `openRequisition`/
  navigate-to-fill); the other three cards (INCOMING DISPATCH, THIS
  MORNING, QUICK ACTIONS) render statically per the mock's visual layout
  but disabled/non-interactive, since their milestones haven't shipped —
  do not wire them to fake data or omit them outright. `PermissionDeniedState`
  guard if `!isDepartmentHead`.
- **`requisitions-list-screen.tsx`** (screen 1) — two grouped sections
  ("NEEDS YOUR SECTION" / "EARLIER TODAY") per the observed layout; each
  row's action button matches its status (`Start requisition` /
  `View my section` + inline `Recall` / `See what changed` — the last one
  is read-only in Session A since approval doesn't exist yet, so an
  `APPROVED` row this session can only occur via manual DB edit during
  verification, not real flow).
- **`requisition-section-fill-screen.tsx`** (screen 2a) — six states
  exactly as resolved above (editable/base, editable-with-note, submitting,
  offline/error, submitted-awaiting-approval, returned). Uses
  `CategoryGroupedLineGrid`, the manager-note field, and the footer bar
  ("Nothing changed yet"/"N items · M notes" + status label + primary
  action button whose label changes per state: Submit section / Submitting…
  / Resubmit section).

**Barrel (`index.ts`):** exports only the three screens + types, matching
`features/inventory/index.ts`'s header-comment convention (no internals
leak out).

## 4. Frontend routing

**Route placement:** flat `frontend/app/app/requisitions/` (not nested
under `inventory/`), mirroring the `restock-levels/` precedent for a
head-facing, no-sidebar, task-flow mobile route tree:

```
frontend/app/app/requisitions/
  page.tsx                          # DepartmentLandingScreen (screen 0)
  list/page.tsx                     # RequisitionsListScreen (screen 1)
  [id]/[departmentTag]/page.tsx     # RequisitionSectionFillScreen (screen 2a)
```

Each `page.tsx` is a 2-line thin shell (routing only, per CLAUDE.md/
Playbook convention):
```tsx
import { RequisitionsListScreen } from '@/features/requisitions';
export default function RequisitionsListPage() {
  return <RequisitionsListScreen />;
}
```

**Nav entry:** append a "Requisitions" entry to the department head's
existing base-role nav (matching the "Department Shifts" precedent — a
head keeps their base role's home and gains appended nav entries, not a
new post-login redirect target). Locate the nav-assembly logic (likely
`frontend/app/app/layout.tsx` or a sidebar/mobile-nav config file) and add
the entry there, gated on `isDepartmentHead`.

**`frontend/middleware.ts`:** add a gate block matching the existing
`isDepartmentHead`-gated pattern used for `/app/department` and
`/app/inventory/restock-levels`:
```ts
if (pathname.startsWith('/app/requisitions')) {
  return isDepartmentHead; // Session B extends this to admit MANAGER too
}
```

## 5. Browser verification (Playwright/chrome-devtools MCP, real browser — not optional)

1. Provision a department head locally if none exists (flip an existing
   user via the Manager's "assign head" flow, or direct DB edit).
2. Confirm the dead-role fix: that head can open Restock Levels without a
   403.
3. Navigate to `/app/requisitions` — confirm the REQUISITION card renders,
   the other three cards render statically/disabled, no permission-denied
   flash.
4. Open a new requisition (pick a type, optional note) — confirm it
   appears in the list with `mySectionStatus: NOT_STARTED`.
5. Enter the fill screen for the head's own department — confirm category
   header grouping renders, **no "on hand" text and no pre-filled
   quantities appear anywhere** (the approved deviation — flag again if
   this shows up, since it would mean the deviation note was missed).
6. Edit a line's quantity — confirm the edited-line border/caption
   treatment appears only on that line, not others.
7. Add a new item via "+ Add an item" — confirm `parAtRequest` shows blank/
   dash if no `RestockLevel` exists for it yet, or a real value if the
   Milestone One restock-level flow was used to set one after the dead-role
   fix.
8. Set a line's quantity to `0` — confirm the row stays (zero-not-delete),
   does not disappear.
9. Delete a line via the trash icon — confirm it actually disappears (this
   is a true client-side removal before submit, distinct from
   zero-not-delete; confirm against the service whether pre-submit
   deletion is a real deleted-row or just omitted from the upsert payload
   — recommend: simply omit from the PATCH payload, no line ever existed
   server-side if never saved).
10. Add a manager note — confirm it saves and displays with an "Edit" link
    once present.
11. Submit — confirm the submitting state renders briefly, then the
    submitted/read-only state with "Recall section" appears; confirm the
    parent `Requisition.status` flips to `PENDING_APPROVAL` (spot-check via
    Postgres MCP).
12. Recall — confirm it returns to editable/draft, values persist.
13. Simulate a return (manually flip `RequisitionSection.status` to
    `RETURNED` + set `returnedNote` via Postgres MCP, since Session B's
    return endpoint doesn't exist yet) — confirm the returned-by banner
    renders with the manager's note, section is editable again.
14. Resubmit — confirm status flips to `SUBMITTED` again and
    `returnedNote` clears (verify this is actually cleared server-side,
    not just hidden client-side).
15. Spot-check via Postgres MCP that the resulting `RequisitionSection`/
    `RequisitionLine` rows are real, queryable data — this is Session B's
    future test fixture data, not just a UI-level check.

## 6. Docs (write during this session, not deferred)

Milestone Three's `API_CONTRACT.md` §23 was written live during its build
session (marked "STATUS: BUILDING"), not deferred to Step 10 wholesale —
follow that precedent, not a stricter no-docs-this-session reading:

- **`docs/API_CONTRACT.md`** — new §24 "Inventory — Milestone Four
  (Requisition & Branch Approval)," marked "STATUS: BUILDING — Session A,"
  structured like §23 (source-of-truth table, conventions, endpoint table +
  prose), covering only the 6 endpoints built this session.
- **`docs/DATA_MODEL.md`** — add `Requisition`/`RequisitionSection`/
  `RequisitionLine` entries (next available §4.x number), formatted exactly
  like existing entries (prose intro, prisma block, **Notes:** bullets),
  including a note on the `parAtRequest` nullability deviation from the
  milestone plan's original sketch. `Category.parentCategoryId` needs no
  further doc changes — §4.48 already documents it fully.

## Critical files

- `backend/prisma/schema.prisma` — both migrations
- `backend/src/modules/inventory/inventory-routes.ts` /
  `inventory-service.ts` — the dead-role-check fix
- `backend/src/modules/requisitions/requisitions-service.ts` —
  cross-department authorization guard (highest-risk logic this session),
  zero-not-delete, submit/recall state machine, `parAtRequest` sourcing
- `backend/src/middleware/rbac.ts` — `requireDepartmentHead`, used
  correctly everywhere in the new routes file (no changes needed here)
- `frontend/features/requisitions/components/category-grouped-line-grid.tsx`
  — built from the real Paper node (`10PT-0`) read this session
- `frontend/middleware.ts`, `backend/src/routes/index.ts` — route wiring
