# Inventory & Procurement — Milestone Four High-Level Plan (Step 5)

**Feature:** Inventory & Procurement (Feature 1 of the redo)
**Milestone:** **Four — Requisition & Branch Approval** — Stage 4 (department
fill) + Stage 5 (branch manager approval, hard gate). See `MILESTONES.md` for
why 4 and 5 split one continuous document flow into two ship units: 4 is
"does the document reach the Central Store correctly" (branch-side), 5 is
"does stock actually move" (store-side, dispatch).
**Step:** 5 of the per-feature pipeline — high-level plan
**Status:** Step 5 approved 2026-09-21 — all three §7 questions resolved
(on-hand deferred to Milestone 5/6, `MANAGER` role confirmed, requisition
type is a fixed enum). Ready for Step 7, Session A.
**Date:** 2026-09-21

**Traces to:**
`01-description.md` (§3 Stage 4, Stage 5) ·
`02-flows.md` Flow 7, 7a, 8, 8a, 8b ·
`02-screens-by-role.md` screens: Branch Manager #3–5, Department Head #1–3
(status there is stale — see §0) ·
Paper page `Milestone Four · Requisition & Branch Approval` (`p-E-0`) in
`01M1ZZJ6S3FZGF5C7PPBGTKY89` — Page guide artboard `10H9-0` carries the two
authoritative session notes (2026-09-19 findings, 2026-09-21 desktop rebuild) ·
`docs/DATA_MODEL.md` §4.48 (`Category.parentCategoryId`, approved not yet
migrated) · `docs/DESIGN_SYSTEM.md` §13 (color-as-exception, codified from
this milestone's screen-review pass) and §3.6 (sidebar gradient revision) ·
`milestone-2-plan.md` / `milestone-3-plan.md` (the precedent this plan
follows) · `docs/FEATURE_REDO_PLAYBOOK.md` §5, §7, §8, §9 ·
`docs/CODING_STANDARDS.md`, `docs/API_CONTRACT.md` §24 (new — this milestone's
contract section).

---

## 0. Scope

21 artboards on Paper page `p-E-0` (16 distinct screens + page-guide/label
artboards), reviewed 2026-09-19 and rebuilt 2026-09-21, all owner-approved:

| # | Screen | Node(s) | Device | Surface |
|---|---|---|---|---|
| 0 | Department landing / dashboard (**new**) | `122U-0` | mobile | route (Dept Head home) |
| 1 | Branch requisitions list (their requisitions) | `10HO-0` | mobile | route |
| 2a | Department requisition section (fill) — 6 states | `10PT-0`,`10J9-0`,`10LE-0`,`10NJ-0`,`10RO-0`,`10TV-0` | mobile | full-screen |
| 3–4 | Requisitions (today) — Branch Manager master-detail — 8 states | `12HK-0` (needs-approval), `12UW-0` (empty), `131F-0` (mid-signature/PIN), `138B-0` (approved/signed+print), `13F1-0` (already-approved read-only), `13LQ-0` (permission-denied), `13PB-0` (loading), `13TI-0` (error), `1415-0` (return-section) | desktop | route (list + live detail pane) |
| 5 | Requisition History | `13X2-0` | desktop | route |

**On the stale-docs finding (2026-09-19, recorded on the Page guide
artboard):** `02-screens-by-role.md` marks Branch Manager screens #3–5 as
DESIGNED-REDO ("layout weak, rebuild") and the signed-requisition document as
MISSING. On inspection both were already current-design-system quality; no
rebuild was needed for the *content*. What **did** change 2026-09-21 is
*structural*: desktop screens #3 (list) and #4 (approval) were merged from a
separate list-then-navigate pair into one master-detail screen, "Requisitions
(today)," because the two were always meant to be read together (approving is
the reason to open the list). `02-screens-by-role.md` still describes the old
two-screen shape and should be corrected at Step 10, not before.

**Deviation from the approved Paper mock (owner-agreed 2026-09-21, resolving
§7 Q1 below):** the fill screen (`10PT-0` and siblings) shows an "on hand"
column and a pre-filled suggested quantity (par − on-hand) on every line.
Verified this session: **no branch-department stock/ledger exists anywhere in
the schema yet** — not even in the pre-redo system. Milestone 5 (Dispatch) is
the first time stock actually lands at a branch department, and Milestone 6
(Counting/Closing) is where branch counts get built; Milestone 4 itself never
writes to the ledger (§0 below). There is no real number for "on hand" to
show yet. **Decision: Session A drops the on-hand column and the
par-minus-on-hand pre-fill for this milestone** — the head sees `par` (a real
figure, already exists) and enters their requisition quantity manually,
matching how the paper-sheet process works today. The auto-suggestion
becomes a small, cheap follow-up once Milestone 5/6 land the real ledger —
not a re-design, just wiring a real number into a field that already exists
in the schema (`requestedQty`). This is a genuine, scoped deviation from the
approved screens, not a build-session judgment call — flag it to the owner
again if a later session's screenshot still shows the on-hand/pre-fill UI,
since that would mean this note was missed.

**In scope:**
- A department head filling their department's section of an open
  requisition: category-grouped rendering (two levels deep for Kitchen only,
  flat elsewhere), manual quantity entry against a visible par reference (see
  deviation note above — no on-hand column or auto pre-fill this milestone),
  add-item, zero-not-delete removal, a free-text note-to-manager line, submit,
  and recall-before-approval (Flow 7, 7a).
- A branch manager reviewing all five departments' sections in one
  master-detail view, editing/adding/deleting any line with a required
  reason, bouncing a section back to its head with a note (return-section),
  and a single PIN signature that approves the whole requisition at once
  (Flow 8, 8a, 8b).
- The resulting edit-trail notification to affected department heads.
- The read-only signed document + print artefact, and a filterable
  Requisition History screen.
- The schema addition `Category.parentCategoryId` (one level, nullable,
  additive) that the category-grouped rendering depends on.

**Explicitly out of scope** — named so build sessions don't drift:
dispatch/fulfilment (Milestone Five — a requisition's end state here is
`Approved`, visible in the Central Store's dispatch queue, but building that
queue or the fulfilment flow is not this milestone), branch receiving,
branch/central stock counts, the Milestone One "Manage categories" drawer's
new parent-category picker (needed to *set up* the nesting — tracked
alongside this plan per `MILESTONES.md` but is its own small session, not
folded into Session A or B below), and **no new `InventoryTransaction`
writer** — Flow 8's own end state is explicit: "No stock movement yet
(dispatch is Flow 9)." This is the first milestone since Prep that does not
touch the stock ledger.

**On the mobile status bar:** every mobile artboard in Paper includes a
rendered status bar (9:41, signal/wifi/battery glyphs) because that's Paper's
realistic phone-frame convention for mockups, not because the app is expected
to draw a native OS status bar. The codebase already has this solved —
`components/app/shell/mobile-status-bar.tsx` — a shared, cross-feature shell
component every mobile route mounts once, sourced pixel-for-pixel from
Paper's own status-bar export (`get_guide("mobile-status-bar")`). Session A
reuses it as-is; it is **not** a new component and does not get rebuilt or
questioned mid-session.

---

## 1. Data model

### 1.1 `Category.parentCategoryId` — additive, already specified

Already written up in `docs/DATA_MODEL.md` §4.48 during the design pass; this
plan just confirms it's this milestone's migration to write, not a separate
one:

```prisma
model Category {
  id               String    @id @default(uuid())
  organizationId   String    @map("organization_id")
  name             String
  parentCategoryId String?   @map("parent_category_id")   -- NEW
  deletedAt        DateTime? @map("deleted_at")
  createdAt        DateTime  @default(now()) @map("created_at")
  updatedAt        DateTime  @updatedAt @map("updated_at")

  @@index([organizationId])
  @@map("categories")
}
```

One level only (service-layer enforced, not DB — a category with a parent
must not itself be a parent). Every existing row gets `parentCategoryId:
null`. No behavior change to any shipped screen (Milestone One catalog,
Milestone Two receiving, Milestone Three prep) — none of them read or filter
by parent.

### 1.2 `Requisition` / `RequisitionSection` / `RequisitionLine` — net new

**Verified during this planning session, not assumed:** the pre-redo Phase 2
`requisitions` / `requisition_lines` / `dispatches` tables (created by
migration `20260821080505_phase2_schema_requisition_dispatch_department_head`)
were already dropped by the Milestone One catalog migration
(`20260915065051_inventory_milestone_one_catalog`, lines 102–108 of its SQL)
as part of that milestone's broader legacy-scaffolding cleanup. Confirmed
against both `schema.prisma` (no reference) and the local Postgres instance
(`relation "requisitions" does not exist`). **This milestone has zero legacy
rows to migrate — a clean-slate schema build**, same pattern as Milestones
Two and Three. `docs/DATA_MODEL.md`'s current staleness note (line 28,
"these still exist in the schema") is itself stale and should be corrected at
Step 10.

A requisition is one document per branch-day-slot with exactly five
sections, one per `DepartmentTag`. `DepartmentTag`, `DEPARTMENT_HEAD` role,
`InventoryItem.departmentTags[]`, and `Location.departmentTag` all already
exist and are live (from the earlier Phase 2 / department-head-marker work)
— this milestone builds on top of that scoping, it does not need to invent
it.

**Resolved 2026-09-21 (§7 Q3):** `label` is a **fixed enum**
(`RequisitionType`: `MORNING` / `AFTERNOON` / `EVENING` / `AD_HOC`), not free
text — chosen over free text for reporting consistency. Whoever opens a
requisition picks one of the four; `AD_HOC` covers the "count is not fixed"
case Flow 7 describes (e.g. a genuine top-up outside the normal three) while
still keeping the field structured. A short optional free-text `note` can
still be added at open time if the UI needs to distinguish two same-day
`AD_HOC` requisitions (e.g. Paper's "Weekend stock-up requisition") — display
label composes as `{Type} requisition` or `{Type} — {note}` when a note is
present, so "Afternoon top-up" becomes `AFTERNOON` + note `"top-up"`.

```prisma
enum RequisitionType {
  MORNING
  AFTERNOON
  EVENING
  AD_HOC
}

enum RequisitionStatus {
  OPEN               // sections still being filled; nothing submitted yet is fine
  PENDING_APPROVAL    // at least one section submitted, not yet signed
  APPROVED             // signed; visible in Central Store dispatch queue
}

enum RequisitionSectionStatus {
  NOT_STARTED
  DRAFT               // head has unsaved/in-progress edits
  SUBMITTED
  RETURNED            // bounced back by branch manager with a note
}

model Requisition {
  id             String            @id @default(uuid())
  organizationId String            @map("organization_id")  // branch org
  type           RequisitionType
  note           String?           // optional free text, e.g. distinguishing two same-day AD_HOC requisitions
  status         RequisitionStatus @default(OPEN)
  openedById     String            @map("opened_by_id")
  openedAt       DateTime          @default(now()) @map("opened_at")
  approvedById   String?           @map("approved_by_id")
  approvedAt     DateTime?         @map("approved_at")

  organization Organization           @relation(fields: [organizationId], references: [id])
  openedBy     User                   @relation("RequisitionOpenedBy", fields: [openedById], references: [id])
  approvedBy   User?                  @relation("RequisitionApprovedBy", fields: [approvedById], references: [id])
  sections     RequisitionSection[]

  @@index([organizationId, status])
  @@map("requisitions")
}

model RequisitionSection {
  id             String                    @id @default(uuid())
  requisitionId  String                    @map("requisition_id")
  departmentTag  DepartmentTag             @map("department_tag")
  status         RequisitionSectionStatus  @default(NOT_STARTED)
  submittedById  String?                   @map("submitted_by_id")
  submittedAt    DateTime?                 @map("submitted_at")
  returnedNote   String?                   @map("returned_note")   // branch manager's reason, cleared on resubmit
  managerNote    String?                   @map("manager_note")    // dept head's free-text "note for the manager"

  requisition  Requisition        @relation(fields: [requisitionId], references: [id])
  submittedBy  User?              @relation("RequisitionSectionSubmittedBy", fields: [submittedById], references: [id])
  lines        RequisitionLine[]

  @@unique([requisitionId, departmentTag])
  @@map("requisition_sections")
}

model RequisitionLine {
  id                    String    @id @default(uuid())
  requisitionSectionId  String    @map("requisition_section_id")
  inventoryItemId       String    @map("inventory_item_id")
  parAtRequest          Decimal   @map("par_at_request") @db.Decimal(12, 4)  // reference only — no on-hand this milestone, see §0 deviation note
  requestedQty          Decimal?  @map("requested_qty") @db.Decimal(12, 4)  // null = manager-added, head never asked
  approvedQty           Decimal?  @map("approved_qty") @db.Decimal(12, 4)   // null until manager reviews
  addedFromNote         Boolean   @default(false) @map("added_from_note")   // manager converted a note line to a real line
  editedById            String?   @map("edited_by_id")   // who last changed approvedQty, if different from requestedQty
  editReason             String?   @map("edit_reason")    // required by Flow 8 whenever approvedQty != requestedQty
  deletedAt             DateTime? @map("deleted_at")       // manager delete — soft, keeps the audit trail

  section  RequisitionSection @relation(fields: [requisitionSectionId], references: [id])
  item     InventoryItem      @relation(fields: [inventoryItemId], references: [id])
  editedBy User?              @relation("RequisitionLineEditedBy", fields: [editedById], references: [id])

  @@index([requisitionSectionId])
  @@map("requisition_lines")
}
```

**Notes:**
- **No `onHandAtRequest` field** (resolved 2026-09-21, §7 Q1) — dropped from
  the original draft of this plan. No branch-department stock/ledger exists
  anywhere in the schema yet (verified this session — not even in the
  pre-redo system); Milestone 5 (Dispatch) is the first time stock lands at
  a branch department, Milestone 6 (Counting/Closing) is where branch counts
  get built. There is no real number to snapshot. See the §0 deviation note
  — the fill screen drops its on-hand column and auto pre-fill for this
  milestone; the head enters `requestedQty` manually against the visible
  `parAtRequest` reference. Adding a real on-hand figure later is a small
  follow-up once Milestone 5/6 land the ledger, not a schema change (the
  field already exists to hold it: `requestedQty`).
- "Zero-not-delete" (Flow 7 step 3) is a dept-head-side UI/service rule, not
  a schema state — the head setting a line's qty to 0 is just
  `requestedQty: 0`, the row stays. A branch-manager **delete** (Flow 8 step
  2) is the only true removal, and it's soft (`deletedAt`) so the edit-trail
  diff on the signed document can still show what was deleted.
- `parAtRequest` is snapshotted at line-creation time (not read live from
  `RestockLevel` at display time) so a signed requisition's numbers never
  silently drift if par changes later — matches the "signed document is
  immutable" pattern already established by Milestone Two's `GoodsReceipt`
  and Milestone Three's `PrepRun`.
- One signature on `Requisition` covers every section — matches Flow 8 step
  3 exactly ("their name renders... One signature covers the whole
  requisition"). No per-section signature field.
- `Requisition` has no `locationId` — it's branch-scoped via
  `organizationId` directly (the branch org), the same pattern Milestone
  One/Two/Three use for branch-vs-hub org scoping. Sections are
  department-scoped via `departmentTag`, not `Location` — moot for this
  milestone now that on-hand tracking is deferred (previous draft flagged a
  build-time check here; no longer needed since no ledger read happens in
  Milestone Four).

---

## 2. Migration plan

Two migrations, both purely additive, no data to move (verified §1.2):

1. `add_category_parent_category_id` — `Category.parentCategoryId`, nullable
   column + index, no default-value backfill needed beyond Prisma's implicit
   `null`.
2. `inventory_milestone_four_requisition` — the three new tables/enums in
   §1.2, plus their FKs and the one partial unique index
   (`requisition_sections` on `(requisitionId, departmentTag)`).

Both are safe to run together or separately; no ordering dependency between
them. Follow the standing workflow (`migrate dev` locally, commit the
generated SQL, `migrate deploy` in CI/CD) — no manual production step beyond
the normal pipeline.

---

## 3. API contract

New section: `docs/API_CONTRACT.md` §24 — "Inventory — Milestone Four
(Requisition & Branch Approval)."

### 3.1 Roles

- `DEPARTMENT_HEAD` — own department's section only (fill, submit, recall,
  note). Cannot see other departments' sections, cannot approve.
- `MANAGER` — **confirmed 2026-09-21 (§7 Q2): `UserRole.MANAGER` is the
  Branch Manager**, no additional org-type scoping needed. Full requisition
  read, line edit/add/delete, return-section, approve & sign.
- `STORE_MANAGER` / `DIRECTOR` — read access to any branch's requisitions
  (Director all-branch, per `02-screens-by-role.md` role 6) — **out of scope
  for the endpoints this milestone builds**; the Director/Accountant
  read-surfaces for requisitions are a Reports-pass concern, not built here.

### 3.2 Endpoints (sketch — full Zod schemas at contract freeze, S2)

| Method | Path | Role | Purpose |
|---|---|---|---|
| `POST` | `/requisitions` | DEPARTMENT_HEAD, MANAGER | Open a new requisition (creates 5 empty sections) |
| `GET` | `/requisitions` | DEPARTMENT_HEAD, MANAGER | List today's + recent requisitions, role-scoped (head sees theirs; manager sees all) |
| `GET` | `/requisitions/:id` | DEPARTMENT_HEAD, MANAGER | Full detail — role-scoped section visibility |
| `GET` | `/requisitions/:id/sections/:departmentTag` | DEPARTMENT_HEAD | The head's own section — items grouped by category, `par` shown for reference; no on-hand/pre-fill this milestone (§0, §7 Q1) |
| `PATCH` | `/requisitions/:id/sections/:departmentTag/lines` | DEPARTMENT_HEAD | Bulk upsert lines (qty edits, add-item, zero-not-delete) while section is DRAFT |
| `POST` | `/requisitions/:id/sections/:departmentTag/submit` | DEPARTMENT_HEAD | DRAFT/NOT_STARTED → SUBMITTED |
| `POST` | `/requisitions/:id/sections/:departmentTag/recall` | DEPARTMENT_HEAD | SUBMITTED → DRAFT (only before requisition-level approval) |
| `PATCH` | `/requisitions/:id/lines/:lineId` | MANAGER | Edit qty / add / soft-delete a line; `editReason` required when `approvedQty != requestedQty` |
| `POST` | `/requisitions/:id/sections/:departmentTag/return` | MANAGER | SUBMITTED → RETURNED with a required note |
| `POST` | `/requisitions/:id/approve` | MANAGER | PIN-verified; signs, sets `APPROVED`, notifies affected heads with diffs |
| `GET` | `/requisitions/history` | MANAGER | Filterable (date range, status) — History screen |

### 3.3 Cross-cutting

- Every endpoint: `authenticate` + `requireRole`, `organizationId` in every
  repository where-clause (Non-Negotiables #2/#3).
- The approve endpoint follows the same PIN-verification pattern as
  Milestone Two's supplier-payment signing (`sign-sheet.tsx` /
  `SupplierPaymentSchema`'s PIN field) — reuse that verification service
  function, do not re-derive it.
- Notification on approve (Flow 8a): for every line where
  `approvedQty != requestedQty` or `addedFromNote`/newly-added, notify that
  line's department head — push + in-app, matching the existing notification
  delivery mechanism Milestones 2/3 already use (fire-and-log; no new
  delivery channel needed).

---

## 3a. Loading, empty, error, and permission-denied states

All four states are already designed on the desktop master-detail screen
(`13PB-0` loading, `13TI-0` error, `12UW-0` empty, `13LQ-0`
permission-denied) and follow the same generic patterns Milestones 2/3
established — screen-mirroring skeleton for loading, the shared
Empty/Error/Permission-denied cards from `components/app/shell/shell-states.tsx`
(or equivalent) for the rest. No new state-pattern work; this is confirmation,
not a gap.

---

## 4. Production data check

No production rows exist for any of the three new models (§1.2 — this is a
net-new build). The only production data this milestone reads, not writes,
is `Category` (adding a nullable column, zero risk) and `InventoryItem` /
`RestockLevel` (read-only, for the `parAtRequest` reference value shown on
each line — no on-hand read, per §7 Q1) — both already live and populated
from Milestone One.

---

## 5. Session breakdown (Step 7)

**Two vertical sessions — not one, and not split backend/frontend.** Each
covers its own schema, endpoints, and screens end-to-end, tested and
browser-verified under the actual role it belongs to before moving on.
Rationale (discussed and agreed with the owner): Milestone Four is
structurally heavier than Milestone Three's single-session S0+S1 in the
parts that cost context and review cycles — two actors with a handoff
contract instead of one, and a brand-new master-detail composite pattern
with no existing precedent to reuse, on top of 16 screens across two device
classes (vs. Prep's 8 on one).

### Session A — Department Head fill (Flows 7, 7a)

**Builds:** `Category.parentCategoryId` migration, `Requisition` /
`RequisitionSection` / `RequisitionLine` schema + migration, the
DEPARTMENT_HEAD-facing endpoints (open, list, get-section, upsert-lines,
submit, recall), and mobile screens 0–2a (Department landing, Requisitions
list, Section fill — 6 states).

**Also builds:** the category-grouped line-item rendering (parent → category
→ item, two levels for Kitchen only) as the read-model shape, since the fill
screen is where it's first exercised.

**Verification:** browser-tested logged in as a Department Head — open a
requisition, confirm `par` reference displays correctly (no on-hand/pre-fill
this milestone — §0, §7 Q1), enter/add/zero
lines, add a note, submit, recall, get returned (manually flip a section to
RETURNED via direct DB write or a manager-side stub endpoint if Session B
hasn't landed yet — see dependency note below), resubmit.

**Produces for Session B:** real submitted `RequisitionSection` rows in the
local DB — Session B's approval-view testing uses this real data, not mocks.

### Session B — Branch Manager approval (Flows 8, 8a, 8b) + History

**Builds:** the MANAGER-facing endpoints (get full detail, edit/add/delete
line, return-section, approve, history), the master-detail desktop screen in
all 8 states, the PIN-sign flow (reusing the existing sign-sheet pattern),
edit-tracking with required reasons, the affected-head notification on
approve, the signed/print read view, and the standalone History screen.

**Verification:** browser-tested logged in as a Branch Manager, against
Session A's real data — review a real submitted section, edit a line with a
reason, return another section, approve & sign, confirm the notification
fires, confirm the signed document renders correctly, confirm History lists
it. Then a second pass logged back in as the Department Head from Session A
to confirm the return-section and post-approval-diff notification actually
reach that head's screens (screen 0's "1 section returned" / "2 lines
changed" surfaces) — this is the one true end-to-end integration check and
belongs in Session B since it's the consumer of Session A's output, not the
reverse.

**Dependency:** Session B depends on Session A's schema and DEPARTMENT_HEAD
endpoints existing (same DB, same contract) — run A before B. If a true
parallel start is wanted, Session B's schema-touching parts wait for the
contract freeze (Step 6) after Session A's S2, while its pure-frontend
master-detail scaffolding (against a mock, per Step 7's standard pattern)
could start early — but given both are meant to run as one person's
sequential sessions per the owner's stated plan, this parallel option is
noted, not recommended.

---

## 6. Component inventory (detail for Session A / Session B)

### 6.1 Reusable as-is — no new build, no re-diff

- `MobileStatusBar`, mobile headers, sidebar nav, topbar (`components/app/shell/`)
- `kpi-strip.tsx` — the 4-tile stat strip (Open Requisitions / Awaiting Your
  Approval / Depts Not Yet Submitted / Today's Volume) on the desktop screen
  matches this exactly
- `sign-sheet.tsx` — the PIN-sign pattern (Milestone Two's supplier-payment
  signing) — Session B's "Sign to approve" modal is this same composite
- `desktop-only-notice.tsx`, `drawer-shell.tsx`, `skeletons.tsx`, generic
  Empty/Error/Permission-denied cards
- `ui2/` primitives — button, badge, status-dot, table, card, input, all
  present and sufficient

### 6.2 Related, but not reusable as-is — build fresh, informed by the pattern

- `restock-level-grid.tsx` / `receipt-line-grid.tsx` — closest existing
  line-item grid composites, but both render a flat list. Neither groups by
  category or implements the §13 color-as-exception editable-cell rule
  (unedited value = plain text, no border; edited value = bordered +
  `wds-primary` accent). The new category-grouped grid (§6.3 below) is
  informed by these but not a subclass of them.

### 6.3 Genuinely new — not found anywhere in the codebase

1. **Master-detail split-pane layout** — list rail (left) + live detail/
   action pane (right) that swaps content in place without a route change.
   First time this codebase builds this shape. Build against Paper node
   `12HK-0` (needs-approval state) for the base layout; verify the pane-swap
   interaction (not just static layout) against `12UW-0` (empty →
   selected transition).
2. **Category-grouped requisition line table** — two-level indent (parent
   category → category → item), `wds-neutral-800`/`wds-neutral-200`
   three-tier hairlines per §13, editable-cell accent only on genuinely
   changed values, flex-basis column discipline (min-width: 0 on the Item
   cell — §13's explicit warning about silent column drift). Build against
   `12HK-0`'s Kitchen section (the only section with real two-level grouping
   in the mock data) and cross-check the flat-list departments (Barista,
   Pastry, Service) render correctly with zero grouping overhead.
3. **Return-to-sender inline panel** — the section-level callout
   (`RETURN TO GRACE W. — NOTE REQUIRED`, textarea, Cancel/Return section
   buttons) that replaces a section's line list in place when a manager
   initiates a return. Build against `1415-0`.

### 6.4 How each §6.3 item gets built — procedure, not just the list

Per Playbook Step 4: for each, (1) check whether a shadcn/ui primitive covers
part of it (add via CLI, never hand-write), (2) read the Paper node's exact
computed styles via `get_computed_styles`/`get_jsx` — never source a value
from a screenshot, (3) map every raw value to an existing design token, (4)
visual-diff the built result against a `get_screenshot` of the same node
before marking it done in this doc.

---

## 7. Questions for the owner — RESOLVED 2026-09-21

1. **Branch-department on-hand source.** Flow 7 says on-hand is "derived
   from that department's ledger." **Checked, not assumed:** no
   branch-department stock/ledger model exists anywhere in the schema —
   not even in the pre-redo system. `LocationType.BRANCH_DEPARTMENT` exists
   as an enum value but the schema comment says Phase 2 was meant to create
   those rows, and the local DB confirms none exist (only the single
   `CENTRAL_STORE` row). Milestone 5 (Dispatch) is the first time stock
   lands at a branch department; Milestone 6 (Counting/Closing) is where
   branch counts get built. **Decision: this milestone drops the on-hand
   column and the par-minus-on-hand auto pre-fill.** The head enters
   `requestedQty` manually against a visible `parAtRequest` reference,
   matching today's paper-sheet process. This is a real, scoped deviation
   from the approved Paper mock (`10PT-0` and siblings show an on-hand
   column and pre-fill) — see the §0 deviation note. The auto-suggestion
   becomes a small follow-up once Milestone 5/6 land the real ledger, not a
   redesign — `requestedQty` already exists to receive it.
2. **`MANAGER` role scoping.** Confirmed: `UserRole.MANAGER` **is** the
   Branch Manager role referred to throughout the flows/screens. No
   additional org-type (branch vs. hub) scoping needed — unlike Central
   Store's hub-scoping (D-15), there's no shared-context ambiguity to guard
   against here.
3. **Requisition "label" values.** Resolved as a **fixed enum**
   (`RequisitionType`: `MORNING` / `AFTERNOON` / `EVENING` / `AD_HOC`), not
   free text — chosen for reporting consistency. See §1.2 for the field
   shape and how an optional `note` still covers same-day
   disambiguation (e.g. "Weekend stock-up requisition").

---

## 8. Test classification

- **New tests required:** contract tests for all 10 §3.2 endpoints (pattern:
  `*-contract.test.ts`, matching Prep/Receiving modules), service tests for
  zero-not-delete semantics, edit-reason enforcement (`approvedQty !=
  requestedQty` requires `editReason`), one-signature-covers-all, and the
  affected-head notification diff generation.
- **Existing tests to keep:** all current inventory module tests — this
  milestone touches no shipped model except the additive `Category` column,
  which needs one new test confirming existing catalog/category behavior is
  unchanged (Milestone One's category screens, Milestone Two receiving,
  Milestone Three prep — none read or filter by parent, per §4.48's note).
- **Nothing to delete or rewrite** — net-new module, no legacy code being
  replaced (the old Phase 2 requisition scaffolding was already fully
  removed by Milestone One, §1.2).

---

## 9. Structure

New code in `backend/src/modules/requisitions/` (routes, controller,
service, repository, validators, types, tests — same co-located shape as
`modules/inventory/prep-*`) and `frontend/features/requisitions/`
(components, hooks, services, store, types + `index.ts`). Both sides are new
folders — this milestone doesn't touch or retire any existing legacy
`controllers/`/`services/` files, since no pre-redo requisition code exists
to retire (confirmed §1.2).

The new master-detail layout and category-grouped table (§6.3) are
feature-scoped composites under `frontend/features/requisitions/components/`,
not `components/ui2/` — they're specific to this screen's arrangement, not
generic primitives, per the Playbook's placement rule.
