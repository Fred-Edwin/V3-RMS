# Inventory Phase 2 — Design-First Plan (Living File)

This file **supersedes** `INVENTORY_PHASE2_SESSION_PLAN.md` as the plan to follow
going forward. That file is not deleted — it stays as the historical record of
Sessions 1-2 (schema, requisition/dispatch backend), which are already built
and merged, and its "As Built" sections remain the authoritative record of what
those two sessions actually did. This file exists because Phase 2 is now being
finished under `docs/DESIGN_FIRST_WORKFLOW.md`, agreed 2026-08-21, and the old
plan's session shape (backend-first, screens listed but not yet grouped by
flow) predates that workflow.

**Read `docs/DESIGN_FIRST_WORKFLOW.md` in full before touching this file.**
This file is that workflow applied to Phase 2, specifically.

**Before opening Paper to design Flow D, E, or any later flow, also read
`docs/context/INVENTORY-FEATURE/PAPER_DESIGN_PATTERNS.md`.** That file
captures the canvas conventions, drawer/document patterns, and Paper-tool
gotchas discovered while building Flows A-C, so they don't have to be
rediscovered (or re-explained by the owner) per flow.

---

## Where Phase 2 actually stands, honestly, as of 2026-08-24

**Backend already built** (Sessions 1-2 of the old plan, both `Complete`):
- Schema: `Requisition`/`RequisitionLine`, `Dispatch`/`DispatchLine`,
  `MarketPurchase`/`MarketPurchaseLine`, `ParLevel`, `DEPARTMENT_HEAD` role,
  5 branch-department locations per branch
- Requisition raise/approve/reject/cancel/edit-resubmit, dual-org dispatch
  queue/fulfil/confirm/receive with variance flagging, FCM notifications
- **Not yet audited against the finished designs** — see Stage 3 below.
  This backend was built to the *original* 16-screen spec's assumptions,
  before the Branch Stock / document / two-stamp redesign happened, and
  before Flow B's consolidation and Flow C's D-11/D-22 rework (both below).
  Stage 3 is now a bigger job than originally scoped — not assumed here.
  Flow C's build made the gap concrete: **Market Purchase Order needs new
  schema** beyond `MarketPurchase`/`MarketPurchaseLine` — see the D-22
  section below for the shape the finished design actually requires.

**Flow A — fully designed and approved** (Paper file "Wendo RMS"):
D1.1 Department Dashboard, D1.2 New Requisition, D1.2 Review Requisition
sheet, D1.3 My Requisitions (+ Empty state, + read-only Requisition Detail
Sheet for historical rows), D2.1 Approvals Queue, D2.1 Requisition Detail,
Branch Stock (desktop, merges old D2.1/D2.2/D2.3), Branch Stock + Drawer,
Requisition Document (Approved/Rejected, desktop viewer + mobile-native
viewer for both). Every mobile root screen carries the hamburger/sidebar-
drawer trigger per the system's navigation rule; every generate-a-document
action has a defined loading state and opens a Document Viewer (modal on
desktop, full-screen takeover natively laid out on mobile — not a scaled
clone). Flow A is **closed** — no known gaps.

**Flow B — fully designed and approved, materially restructured from the
original 16-screen spec.** The old plan's D3.1/D3.2/D3.3 (three separate
Store Manager screens) were consolidated, on the owner's direction, into
**one screen — "Requisitions" (Store Manager)** — a single table tracking
every requisition through real stages **New → Dispatched → Received**
(the originally-planned "Picking" stage was dropped as fabricated; nothing
in the backend or plan tracks a mid-fulfilment state). Selecting a row opens
a right-side drawer with two modes driven by the row's stage: **New** shows
the fill-order interaction (requested vs. available, qty-to-send, partial
fulfilment is normal not an error); **Dispatched/Received** shows a
read-only dispatched→received summary with variance flagged inline and a
"View Dispatch Note" action. Desktop and mobile both built (mobile pushes
full screens instead of opening the drawer). Also designed: Dispatch Note
Viewer (desktop modal + native mobile layout, with compact non-diagonal
stamp badges standing in for the desktop's diagonal ink stamps), and the
Generate Document loading-state spec (idle → generating → auto-opens
viewer), which also governs Flow A's document-generating actions. Flow B is
**closed** — no known gaps. Sidebar identity: Store Manager's nav now
reads "Central Store" with Dashboard / Requisitions / Dispatches items (no
separate "Dispatch Queue" nav item — folded into Requisitions).

**Flow C — Market Purchase — ✅ CLOSED 2026-08-23.** Both sub-flows fully
designed and approved. See the dedicated section below for the complete
screen list, the final D-22 decisions (materially reshaped twice during
design — department heads do **not** go to the market themselves, and the
flow consolidates into **one Market Purchase Order document**, not a
per-department approval object), and what changed from the original brief.

**Flow D — Stock Visibility & History — partially designed.** Branch Stock
and Branch Stock History are approved (built as part of Flow A/B's screens).
The remaining four screens (D1.6, D1.7, D4.1, D4.2) are not yet designed —
see the dedicated section below.

**Flow E — Staff & Department Head Assignment — ✅ CLOSED 2026-08-24.**
Scoped beyond the original "small addition" framing into a full redesign of
the Branch Manager's Staff page — see the dedicated section below for what
changed and why.

**Not yet designed (everything from here down is untouched):**
- D1.6 My Department's Stock (mobile)
- D1.7 Count & Waste (mobile)
- D4.1 All Locations Overview (Director desktop)
- D4.2 Reports (Director desktop)

---

## The flows

Phase 2's screens are grouped by flow, not by role, per the workflow. Each
flow lists its screens with role and current design status, then a short
design brief for whichever screens remain.

### Flow A — Requisition & Approval — ✅ CLOSED
*Department Head raises a requisition → Branch Manager approves, edits, or rejects it.*

| Screen | Role | Status |
|---|---|---|
| D1.1 Department Dashboard | Dept Head, mobile | **Approved** |
| D1.2 New Requisition | Dept Head, mobile | **Approved** |
| D1.2 Review Requisition (bottom sheet) | Dept Head, mobile | **Approved** |
| D1.3 My Requisitions (+ Empty state) | Dept Head, mobile | **Approved** |
| D1.3 Requisition Detail Sheet (read-only, historical) | Dept Head, mobile | **Approved** |
| D2.1 Approvals Queue | Branch Manager, mobile | **Approved** |
| D2.1 Requisition Detail | Branch Manager, mobile | **Approved** |
| Branch Stock (Requisition Approvals section + drawer) | Branch Manager, desktop | **Approved** |
| Requisition Document — Approved/Rejected (desktop viewer) | shared | **Approved** |
| Requisition Document — Approved/Rejected (mobile-native viewer) | shared | **Approved** |

No known gaps. All mobile root screens carry the hamburger/sidebar-drawer
trigger; every approve/reject action that generates a document opens the
Document Viewer per the shared loading-state spec (see Flow B).

### Flow B — Dispatch & Receipt — ✅ CLOSED
*Store Manager fulfils an approved requisition → Department Head receives it, variance flagged if it doesn't match.*

**Restructured from the original 16-screen spec.** D3.1/D3.2/D3.3 (three
separate screens) were consolidated into one screen, **"Requisitions"
(Store Manager)**, on the owner's direction — see rationale in the status
section above.

| Screen | Role | Status |
|---|---|---|
| D1.4 Receive Delivery | Dept Head, mobile | **Approved** |
| D1.4 Checkmark Interaction Spec | Dept Head, mobile | **Approved** |
| Requisitions, closed table (New/Dispatched/Received stages) | Store Manager, desktop | **Approved** |
| Requisitions, New-stage drawer (fill order) | Store Manager, desktop | **Approved** |
| Requisitions, Received-stage drawer (read-only + variance) | Store Manager, desktop | **Approved** |
| Requisitions (consolidated list) | Store Manager, mobile | **Approved** |
| Fill Order | Store Manager, mobile | **Approved** |
| Received Summary | Store Manager, mobile | **Approved** |
| Dispatch Note (variance/clean, source documents) | shared, print | **Approved** |
| Dispatch Note Viewer (desktop modal + native mobile) | shared | **Approved** |
| Generate Document — Loading Spec | shared | **Approved** |

No known gaps. D3.1 "Dispatch Queue" and D3.3 "Dispatches List" as
separate screens **do not exist** — do not resurrect them; the single
Requisitions table with stage tabs (All/New/Dispatched/Received) replaced
both. The Store Manager sidebar identity is "Central Store" with nav items
Dashboard / Requisitions / Dispatches.

### Flow C — Market Purchase — ✅ CLOSED
*Two sub-flows: the original same-day log, plus a planned/consolidated Market Purchase Order flow.*

Full screen list, decisions, and rationale in its own section below — the
scope changed materially twice during design (2026-08-22 and 2026-08-23),
so it needs the complete context, not a table row.

---

## Flow C, in full — Market Purchase (both sub-flows) — ✅ CLOSED

### C1 — D1.5 Log Market Purchase — ✅ Approved
*Department Head logs produce bought directly at the market — no PO, no approval, no store leg.*

D-11 (client-confirmed, do not relitigate): **"Direct market purchases are
ledger-tracked (`market_receive`), not treated as an untracked expense.
Logged by the branch department at time of purchase — no supplier PO, no
Central Store leg, cost is whatever was paid that day."** This is for
same-day, spontaneous buys — a Dept Head is at the market right now with
cash, buying whatever the day's produce/price is. An approval round-trip
doesn't fit that reality, which is why D-11 deliberately has none.

Screen: **D1.5 Log Market Purchase** — Dept Head, mobile. Item picker →
selected-item card with quantity stepper + amount-paid input → running list
of items logged this trip → total + Confirm Purchase. Backend
(`MarketPurchase`/`MarketPurchaseLine`, schema only, not yet built) has no
status/approval fields — matches this screen's needs. Confirm this is still
true during the Stage 3 audit, since Value(KES) treatment and
department-scoping conventions were both refined during the Branch Stock
work after this schema was written.

### C2 — Market Purchase Order — ✅ Approved (D-22, reshaped twice during design)
*Department Heads request market items ahead of time → items flow directly into one shared draft order per department, grouped inside it → Branch Manager reviews/edits/approves the whole draft → sends it to market → an unnamed delivery function buys it → Branch Manager reconciles actual qty/price per line and signs off → each Department Head receives their own portion and sees variance if it doesn't match.*

**Naming: "Market Purchase Order" (MPO), not "Market Order."** Renamed
during design to match the existing `MarketPurchase` schema naming and to
read unambiguously as a purchasing document, not a generic "order."

**Why this exists alongside D-11, not instead of it:** D-11 covers
spontaneous same-day buying. This covers *planned* buying — a Dept Head
knows in advance they'll need market produce, wants to request it formally,
and have it consolidated with other departments' requests into one trip
rather than everyone going separately. That's a fundamentally different
situation (advance planning vs. spot buying) and needs an approval step
D-11 correctly has none of.

**D-22, final decisions (corrected twice from the original working brief
during this design session — the two corrections below supersede the
original D-22 draft; do not build to the superseded version):**

- **Department Heads do not go to the market.** The original brief's
  Branch-Manager-fulfils framing was still built on an assumption that a
  Dept Head or the Branch Manager physically shops. In fact: a Dept Head
  requests → the Branch Manager reviews/approves the *consolidated* order →
  an unnamed delivery function (no role confirmed yet, kept generic/free-text
  on the document per interim decision) does the actual shopping → the
  Branch Manager reconciles what came back (actual qty + price per line)
  and signs off → the requesting Dept Head receives. The Branch Manager is
  the approver and reconciler, never the shopper.
- **One consolidated Market Purchase Order, not one document per
  department.** Corrected from the original per-department "Market Orders"
  framing: department requests do not each become their own approvable
  object. Instead, **there is exactly one active draft order at a time**;
  every department's request lands directly inside whichever draft is
  currently open, already grouped into that draft by department. The
  Branch Manager opens the one draft, sees it broken into department
  sections, edits any line, and one **Approve** action locks the whole
  draft (not "approve" = "send" in one step — approving and sending are two
  separate actions, see stages below). Once sent, a fresh empty draft
  starts collecting the next round of requests.
- **Who receives:** the Department Head who requested it — not the Branch
  Manager. This mirrors Flow B (Dept Head receives Central Store dispatches,
  not the Branch Manager): the person who knows what they actually needed is
  the right person to judge whether a shortfall is acceptable and flag
  variance. Each Dept Head only sees and confirms *their own department's
  portion* of the consolidated order, not the whole thing.
- **Stages (order-level, not per-department):** **Draft → Approved → Sent
  to Market → Reconciling → Completed → Received** (+ Rejected). "Approved"
  (pre-send lock) and "Completed" (post-reconciliation signoff) are
  deliberately different words for two different checkpoints — don't
  collapse them back into one "Approved" to match Flow B's vocabulary, the
  two-checkpoint shape here is intentional per the two-action decision above.

**Screens built (all approved, in Paper file "Wendo RMS"):**

| Screen | Role/Device | Notes |
|---|---|---|
| Request Market Items | Dept Head, mobile | Item + quantity, submit — no price yet, no stock-availability context (open market, nothing to check against). Shell reused from D1.2 New Requisition minus the availability chips/badges. |
| Branch Stock — "Market Purchase Orders" tab | Branch Manager, desktop | A section-level tab pair — **Requisitions \| Market Purchase Orders** — added to the existing Branch Stock screen (not a separate page, not a preview card; both options were prototyped and this one was chosen). Sidebar gets a new indented sub-item "Market Purchase Orders" nested under "Branch Stock," matching the existing collapsible "Inventory" group convention. Stat strip: Items in Draft Order, Orders In Progress, Spent This Month. Table: **one row per consolidated order** (not per department request) — columns Order · Departments · Prepared By · Items · Spent · Duration · Order Doc · Stage. |
| Branch Stock — Draft Drawer | Branch Manager, desktop | Opens on the Draft-stage row. Shows every department's submitted items grouped into sections (department name + requester + item count as a header, gap between groups), each line editable via a stepper. Footer: "Discard draft" / "Approve Order." |
| Branch Stock — Reconciling Drawer | Branch Manager, desktop | Opens on a Sent-to-Market-stage row. Same department-grouped layout, but each line now shows Requested (reference) + an **Actual qty stepper** + a **Paid (KES) field**. Footer: "Flag an issue" / "Confirm & Complete Order." |
| Branch Stock — Completed Drawer | Branch Manager, desktop | Read-only reconciled summary for a Completed/Received-stage row: Item · Requested · Actual · Paid columns, variance-highlighted row + banner when actual ≠ requested, footer with total spent + "View Market Purchase Order" link. |
| Receive Market Purchase Order | Dept Head, mobile | Reuses the Received Summary / D1.4 pattern, scoped to **only this department's line items** out of the full order — read-only Requested → Actual, variance banner + per-row highlight when it doesn't match, footer links to the full document. |
| Market Purchase Order document + viewer | shared, desktop + mobile | Reuses the Dispatch Note document + Document Viewer chrome. Letterhead (Prepared By / Departments / Reconciled date instead of Dispatch Note's From/To/Requisition Ref) → line items **grouped by department with dividers**, built and verified at realistic scale (22 items across 3 departments, not the original 5-6 item mock) → totals band → **one "Reconciled & approved by" signature block** (the Branch Manager's only — the redundant "Dispatched by" party row was removed since the letterhead's Prepared By already covers who prepared it) → footer. Desktop modal's document pane scrolls (`overflow: auto`) rather than clipping, since a real MPO is materially longer than a single requisition. One "RECONCILED" stamp, not Dispatch Note's two-stamp DISPATCHED/RECEIVED pattern — this document has one finalization event (reconciliation + signoff), not two independent stamps from two different actors. |

**What NOT to do:** don't resurrect a per-department "Market Order" as its
own approvable row — that model was built, then explicitly corrected away
from once the single-consolidated-draft model was confirmed; the table's
row unit is the whole order, department breakdown lives inside the drawer/
document. Don't invent a named delivery/runner role — keep it generic on
the document until the owner confirms one. Don't route any of this through
Store Manager or Central Store nav/sidebar — Market Purchase Orders live
under Branch Stock in the Branch Manager's own sidebar. Don't rename or
touch D1.5 — it's a separate, still-correct screen for a separate situation.

**Backend implication (flag for Stage 3, don't build yet):** Market
Purchase Order needs schema beyond the existing `MarketPurchase`/
`MarketPurchaseLine` (which fits D1.5's simple same-day log only) — at
minimum: one order-level model with a status/stage field, department-scoped
line groupings preserving both requested and actual quantities (per-line,
not just per-order, the same way Requisition/Dispatch preserve both), a
price-paid field per line, an approver reference, a reconciler reference
(may be the same actor, at two different times), and a per-department
received/variance flag so each Dept Head's receive-confirmation is scoped
correctly. Whether this extends `MarketPurchase`/`MarketPurchaseLine` or is
a wholly new model (e.g. `MarketPurchaseOrder`/`MarketPurchaseOrderLine`) is
a backend design call for whoever picks up Stage 3/4 — flag it, don't
presume the shape here.

---

### Flow D — Stock Visibility & History
*Everyone's view into what's on hand, what's low, what happened over time.*

| Screen | Role | Status |
|---|---|---|
| Branch Stock (ledger + stats) | Branch Manager, desktop | **Approved** |
| Branch Stock History | Branch Manager, desktop | **Approved** |
| D1.6 My Department's Stock | Dept Head, mobile | Not designed |
| D1.7 Count & Waste | Dept Head, mobile | Not designed |
| D4.1 All Locations Overview | Director, desktop | Not designed |
| D4.2 Reports | Director, desktop | Not designed |

**Remaining design work:**
- **D1.6 My Department's Stock** — card list of current stock, tap for
  movement history. Note: Branch Stock History's Daily Ledger section is
  effectively this screen's desktop-manager equivalent already designed —
  reuse its ledger-table shape and column set (Item · Opening · Received ·
  Market Buy · Waste · Closing · Value · Par · Status) rather than
  inventing new columns for the mobile card view.
- **D1.7 Count & Waste** — Phase 1 mobile components, department-scoped.
  Open question Q1 (does a Dept Head see expected quantities during a
  count?) still needs resolving here — plan's suggested default is yes.
- **D4.1 All Locations Overview** — every branch, every department, rolling
  up to individual ledger movements. This is Branch Stock's data model
  scaled up one level (branch → all branches) — the department-tab pattern
  from Branch Stock likely generalizes to a branch-tab or branch-drilldown
  pattern here.
- **D4.2 Reports** — transfer variance, fulfilment, weekly usage, market
  spend. **The consumption/loss-blended caveat must render on screen**, not
  just in docs (this was flagged as a hard requirement in the original
  feature plan and still applies).

### Flow E — Staff & Department Head Assignment — ✅ CLOSED 2026-08-24
*Branch Manager manages branch staff and assigns/reassigns who leads each department.*

| Screen | Role | Status |
|---|---|---|
| Staff (redesigned) | Branch Manager, desktop | **Approved** |
| Staff Detail Panel (right-side drawer) | Branch Manager, desktop | **Approved** |
| Add Staff (right-side drawer) | Branch Manager, desktop | **Approved** |

**What this actually became, vs. the original brief.** The old plan (D2.4's
replacement) framed this as a small addition — a head-assignment control
bolted onto the existing Staff/HR screen. In design review the owner
rejected that: the existing coded Manager Staff page
(`frontend/app/app/manage/staff/page.tsx`) was a flat list with 5 unlabeled
icon buttons per row and no department column at all — `StaffDto` doesn't
carry `departmentTag` today — so head assignment had nowhere clean to live
without restructuring the page first. This flow ended up a full redesign of
that page, done in three iterations before landing on the final shape:

1. **First pass** — department-grouped card sections with a colored
   head-assignment button per group. Rejected: too many colors, too much
   chrome, didn't match the file's existing minimal system.
2. **Second pass** — an `ExcelTable`-style grid with colored department
   header bands. Rejected: "I don't want the Excel table component design
   ... not this many colors."
3. **Final shape** — a plain ledger-style table matching the file's existing
   premium ledger pattern (see `9WE-0`, the Ledger Table inside D4.1 All
   Locations Overview): no card wrapper, no header fill, no zebra striping,
   no avatars, hairline row dividers, generous vertical rhythm, color used
   only for the status dot. On the owner's final direction, department
   group headers and per-group staff counts were removed entirely — the
   table is now **one continuous list**, sorted by department block
   (Service → Barista → Kitchen → Pastry → Housekeeping → Unassigned) with
   names alphabetical within each block, and **Department is its own
   column** rather than a section label. This is the shape now built in
   Paper.

**Key decisions:**
- **Department head assignment lives in the row drawer, not the table.**
  The table carries zero interactive controls (pure typography, ledger
  register). Opening any staff member's row shows a compact
  "[Department] Head: [name] · Change" section scoped to *their*
  department — so assignment is always one click away without the table
  needing any per-row or per-group UI.
  Icon-button
  actions collapse into a drawer: editable fields at the top (name, email,
  phone, role, department), then a divided **Actions** list (Reset
  Password, Transfer Branch, Deactivate, then Delete separated below a
  divider and styled danger) — replacing the old page's 5 same-weight
  icons.
- **Add Staff moved from a centered modal to the same right-side drawer**
  as the detail panel, for consistency — clicking into a person and
  creating one now use the same interaction.
- **Department head status reads as a single status line, not two.** A
  department head's Status cell shows only "DEPT. HEAD" (no separate
  "ACTIVE" line above it) — a head is implicitly active, so showing both
  was redundant.
- **Owner-confirmed role→department mapping** (not 1:1 by role — informs
  both the Department column and the Add Staff drawer's Department field):
  Waiter → Service, Barista → Barista, Chef → Kitchen *or* Pastry (a
  manager choice, not inferred), Housekeeping + Steward → Housekeeping.
  Manager and kiosk/display-screen accounts (Kitchen Display, Barista
  Display, System Admin) have no department and sit in a real
  **Unassigned** block — shown, never hidden — with `—` in the Department
  column.
- **Add Staff gets a new Department field**, picked explicitly at creation
  (not inferred from role), since new operational staff should be placed
  into a department immediately rather than left unassigned.

**Backend endpoints for department head assignment already exist and are
unaffected** (`GET .../departments`, `GET .../eligible-staff`,
`PATCH/DELETE .../head`, built in Session 1). **Gaps this design surfaces
for the Stage 3 backend audit:** `StaffDto` / the staff list endpoint has
no `departmentTag` field today — the redesigned table and both drawers
depend on it being present per staff member; department *membership*
(not just headship) needs to become editable via the staff update
endpoint, since the grouped/sorted table has no way to populate itself for
existing staff otherwise.

---

## Stage 3 — Backend audit (do this once every flow above is designed)

Once every screen in every flow is designed and approved, audit the already-
built backend (Sessions 1-2 of the old plan) against what the finished
designs actually require, field by field, the way `DESIGN_FIRST_WORKFLOW.md`
Stage 2 describes. Concretely, check:

- Does `Requisition`/`RequisitionLine` give the Requisition document and the
  Branch Stock drawer everything they render? (Likely yes — `requestedQty`/
  `approvedQty` preservation was already built for exactly this reason.)
- Does `Dispatch`/`DispatchLine` give the Dispatch document (both stamps,
  variance detection) and D3.2 Fill an Order everything they need?
  (Likely yes — three-quantity tracking per D-6 was already built.)
- Does the ledger give Branch Stock's Value(KES) column what it needs?
  **Likely a gap** — Session 2's As Built explicitly flagged that
  per-location weighted-average cost has no cached field and is computed
  on demand; confirm this is still the right call now that Value(KES) is a
  first-class, always-visible ledger column rather than an occasional
  report figure.
- Does anything the *new* screens introduced — Branch Stock History's
  Documents section, the two-stamp dispatch pattern, the drawer's item-level
  edit tracking — need a field or endpoint that doesn't exist yet?
- Does `MarketPurchase`/`MarketPurchaseLine` (schema only, not yet built)
  match what D1.5's finished design actually needs?
- Does the Market Purchase Order sub-flow (D-22) need its own model(s), or
  can it extend `MarketPurchase`/`MarketPurchaseLine`? Not decided — see the
  Flow C section above for the field-level list the finished design needs
  (order-level status, department-grouped lines with both requested and
  actual qty, price-paid per line, approver + reconciler references,
  per-department received/variance flags). This is new scope Sessions 1-2
  never anticipated.

Record findings here, in a new section, before Stage 4 backend work starts.
Where a gap is found, it becomes explicit scope for the backend session that
picks it up — not silently absorbed into a "while I'm in there" change.

---

## Stage 4 — Backend, then frontend (per the workflow)

Not sequenced into sessions yet — do this after the Stage 3 audit is
complete, since the audit findings determine whether remaining backend work
is "finish what Session 3 of the old plan already scoped" or something
larger. Session sizing should follow the same calibration principle the old
plan used (sized against actual Phase 1 throughput, not architectural
layers) once the real scope is known.

---

*Created 2026-08-21, updated 2026-08-22 (Flow A/B closed, Flow C rescoped),
updated again 2026-08-23 (Flow C closed — D-22 finalized after two in-session
corrections: Dept Heads don't shop the market themselves, and the flow
consolidates into one Market Purchase Order document rather than
per-department approval objects; renamed "Market Order" → "Market Purchase
Order" to match existing schema naming). Supersedes
`INVENTORY_PHASE2_SESSION_PLAN.md` for all work from this point forward;
that file remains the historical record of Sessions 1-2. Companion to
`docs/DESIGN_FIRST_WORKFLOW.md` (the general procedure this file applies)
and `INVENTORY_FEATURE_PLAN.md` (the original spec, decisions D-1..D-19 —
D-22 not yet folded into that file, lives here until it is).*
