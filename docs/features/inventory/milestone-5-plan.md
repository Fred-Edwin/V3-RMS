# Milestone Five (Dispatch & Branch Receiving) — Step 5 High-Level Plan

**Feature:** Inventory & Procurement (Feature 1 of the redo)
**Milestone:** **Five — Dispatch & Branch Receiving** — Stage 6 (Fulfilment
& dispatch, Central Store) + Stage 7 (Branch receiving). See `MILESTONES.md`
for why 4 and 5 split one continuous document flow into two ship units: 4 is
"does the document reach the Central Store correctly" (branch-side), 5 is
"does stock actually move" (store-side, dispatch).
**Step:** 5 of the per-feature pipeline — high-level plan
**Status:** Step 5 approved 2026-09-22. Ready for Step 7, Session A.
**Date:** 2026-09-22

**Traces to:**
`01-description.md` §3 Stage 6, Stage 7 ·
`02-flows.md` Flows 9, 9a, 9b, 10, 10a, 10b, 11 ·
Paper page `Milestone Five · Dispatch & Branch Receiving` (`p-F-0`) in file
`01M1ZZJ6S3FZGF5C7PPBGTKY89` (20 artboards) ·
`docs/inventory/CENTRAL_STORE_SCOPING_DESIGN.md` §4 (the hub-reads-branch
cross-org read this milestone implements) ·
`milestone-4-plan.md` (the precedent this plan follows) ·
`docs/FEATURE_REDO_PLAYBOOK.md` §5, §7, §8, §9 ·
`docs/CODING_STANDARDS.md`, `docs/API_CONTRACT.md` §25 (new — this
milestone's contract section, to be frozen at Step 6).

---

## Context

Milestone Four (Requisition & Branch Approval) shipped 2026-09-22. Milestone
Five is next in the Inventory & Procurement redo sequence — its screen set
(20 artboards) was owner-approved 2026-09-21 but Step 5 had not been written
yet. This document is that plan: it produces the data model, API contract,
session breakdown, and build discipline needed before Step 7 (build) can
start, per `docs/FEATURE_REDO_PLAYBOOK.md` §5 Step 5.

Milestone Five is the first milestone to build the `Dispatch` model from
scratch (only reserved enum values and an unlinked FK column exist today)
and the first to implement a hub-org-reads-branch-org query direction,
which is a real new pattern — though not an undesigned one: it is already
sketched in `docs/inventory/CENTRAL_STORE_SCOPING_DESIGN.md` §4 ("the
documented exception," modeled on the existing `StaffTransfer` two-org
pattern).

**Process change from Milestone Four, effective this milestone:** visual
fidelity to Paper is no longer a single end-of-session pass. Milestone
Four's own log shows deviations found only after all screens were built,
which let a single wrong decision (e.g. spacing, a shared component's
padding) get copied across every screen that reused it before anyone
caught it. This plan requires a **per-artboard visual gate inside the
build loop** — see §4.

---

## §0. Scope — all 20 artboards

Screen inventory, Paper node IDs, and which session builds each:

| Screen | Node(s) | Device | State(s) | Session |
|---|---|---|---|---|
| C1/C2 · Dispatch queue + Fulfil (master-detail) | `15V5-0` | desktop | populated (+ loading/error/empty states TBD verified in Paper before build) | A |
| C1 · Dispatch queue | `1500-0` | mobile | populated (Attendant + SM shared) | A |
| C2 · Fulfil & dispatch | `1523-0`, `154G-0` | mobile | populated, mid-signature (PIN) | A |
| C3 · Delivery note (on-screen) | `1707-0` | desktop | signed, per department | A |
| C3 · Delivery note view | `15JU-0`, `15PX-0` | mobile | driver's-copy label, read (Dept Head) | A |
| Delivery Note · print | `15QW-0`, `15SU-0` | print (A4) | clean, discrepancy variant | A |
| C4/C5 · Branch incoming & confirm (master-detail) | `168U-0` | desktop | populated (incl. manager-confirms-on-behalf) | B |
| C4 · Branch incoming dispatches | `15L1-0` | mobile | populated (Dept Head, own department only) | B |
| C5 · Confirm branch receipt | `15I4-0`, `15MG-0`, `15OP-0` | mobile | populated, mid-signature, signed | B |
| C6 · Discrepancy resolution | `16GW-0`, `16LI-0` | desktop | populated, resolved (signed) | B |
| C6 · Discrepancy detail (read-only) | `16DM-0` | desktop | Branch Manager view | B |
| C7 · Discrepancies list | `16Q7-0` | desktop | Store Manager (all branches) | B |
| C7 · Discrepancies list | `16UG-0` | desktop | Branch Manager (own branch) | B |

Confirmed by direct Paper inspection during Step 5 planning (not inferred
from stale `02-screens-by-role.md`):
- Substitution (Flow 9b) is designed: C2's mobile Fulfil screen has an
  explicit **"+ Add substitute line"** affordance.
- Manager-confirms-on-behalf (Flow 10b) is designed on C4/C5 desktop
  master-detail, not left as an undesigned edge case.
- The three signed outcomes of Flow 11 (found & re-delivered / transit
  loss write-off / miscount corrected) are all present as radio choices on
  C6, matching the flow doc exactly.
- **C4's tap target is the row itself**, not a separate "view note" link —
  tapping an unconfirmed dispatch row opens its detail (delivery-note view
  + confirm inputs); "Confirm receipt" is the terminal signed action from
  within that detail. The build session must not invent a separate nav
  path to the delivery-note view.
- The **driver's copy and the on-screen department view are the same
  `Dispatch` record, rendered twice** (print stylesheet vs. app screen) —
  confirmed by the artboard's own on-screen note ("This dispatch's
  original record lives on the Store Manager's Dispatch queue... the same
  Dispatch 2 id links both views"). No separate storage/model for the
  driver's copy.
- Central Store on-hand stock is real data already (unlike Milestone
  Four's branch-department on-hand, correctly deferred there) — C1/C2's
  "ON HAND" column is not a placeholder.

**Named deviation to resolve in this plan, not defer:** `RequisitionHistoryRow`
(`backend/src/modules/requisitions/requisitions.types.ts`) has no field
pointing to the dispatches a requisition produced. Add one
(`dispatchSummary` — id/status per department, or similar) so Requisition
History and the new Deliveries/Dispatch screens cross-link, per §1.4.

**Out of scope for Milestone Five** (named so build sessions don't drift):
branch/central stock counts and day-close (Milestone Six), the full
dashboard-wide alert inbox (Director scope, Milestone Six per
`MILESTONES.md`), automatic per-sale deduction (explicitly deferred
system-wide per `01-description.md` §3 Stage 8).

---

## §1. Data model

### 1.1 `Dispatch` — new model

Mirrors `StaffTransfer`'s two-org pattern per
`CENTRAL_STORE_SCOPING_DESIGN.md` §4 Phase 2 sketch:

```prisma
model Dispatch {
  id                String         @id @default(uuid())
  organizationId    String         @map("organization_id")      // hub org — Central Store owns this document
  toOrganizationId  String         @map("to_organization_id")   // branch org
  requisitionId     String         @map("requisition_id")
  departmentTag     DepartmentTag  @map("department_tag")       // one Dispatch per department, per Flow 9 step 4
  sequenceLabel     String         @map("sequence_label")       // "Dispatch 4 · Nyeri Town · 17 Sep" — daily per-branch sequence, not a persistent ID (MILESTONES.md decision)
  status            DispatchStatus @default(AWAITING)
  dispatchedById    String?        @map("dispatched_by_id")
  dispatchedAt      DateTime?      @map("dispatched_at")
  confirmedById     String?        @map("confirmed_by_id")      // may differ from the department head if confirmed-on-behalf (Flow 10b)
  confirmedAt       DateTime?      @map("confirmed_at")
  confirmedOnBehalf Boolean        @default(false) @map("confirmed_on_behalf")

  organization   Organization   @relation("DispatchFrom", fields: [organizationId], references: [id])
  toOrganization Organization   @relation("DispatchTo", fields: [toOrganizationId], references: [id])
  requisition    Requisition    @relation(fields: [requisitionId], references: [id])
  lines          DispatchLine[]

  @@index([organizationId, status])
  @@index([toOrganizationId, departmentTag, status])
  @@map("dispatches")
}

enum DispatchStatus {
  AWAITING          // not yet signed by the store
  IN_TRANSIT        // signed, dispatch_out written, not yet confirmed
  CONFIRMED         // dispatch_in written, no discrepancy
  DISCREPANCY_OPEN  // dispatch_in written but a line mismatched — stays open per Flow 10a
}
```

### 1.2 `DispatchLine` — new model

```prisma
model DispatchLine {
  id                String   @id @default(uuid())
  dispatchId        String   @map("dispatch_id")
  requisitionLineId String?  @map("requisition_line_id")  // null for a substitute line (Flow 9b)
  inventoryItemId   String   @map("inventory_item_id")
  requestedQty      Decimal? @db.Decimal(12, 4) @map("requested_qty")
  dispatchedQty     Decimal  @db.Decimal(12, 4) @map("dispatched_qty")
  confirmedQty      Decimal? @db.Decimal(12, 4) @map("confirmed_qty")
  costAtDispatch    Decimal  @db.Decimal(12, 4) @map("cost_at_dispatch")  // frozen per line, per Flow 9 step 6
  isSubstitute      Boolean  @default(false) @map("is_substitute")
  substituteNote    String?  @map("substitute_note")

  dispatch Dispatch      @relation(fields: [dispatchId], references: [id])
  item     InventoryItem @relation(fields: [inventoryItemId], references: [id])

  @@index([dispatchId])
  @@map("dispatch_lines")
}
```

Restore `InventoryTransaction.dispatchLineId` as a real FK to
`DispatchLine.id` (it exists today as an unlinked nullable column per
`DATA_MODEL.md` — this is the milestone that closes it, same pattern
Milestone Three closed `prepRecordId`).

### 1.3 `Discrepancy` — new model

```prisma
model Discrepancy {
  id                 String              @id @default(uuid())
  dispatchLineId     String              @map("dispatch_line_id")
  gapQty             Decimal             @db.Decimal(12, 4) @map("gap_qty")  // confirmed - dispatched, signed
  status             DiscrepancyStatus   @default(OPEN)
  outcome            DiscrepancyOutcome?
  resolutionNote     String?             @map("resolution_note")
  resolvedById       String?             @map("resolved_by_id")
  resolvedAt         DateTime?           @map("resolved_at")
  followUpDispatchId String?             @map("follow_up_dispatch_id")  // set when outcome = FOUND_REDELIVERED

  dispatchLine DispatchLine @relation(fields: [dispatchLineId], references: [id])

  @@index([status])
  @@map("discrepancies")
}

enum DiscrepancyStatus { OPEN RESOLVED }
enum DiscrepancyOutcome { FOUND_REDELIVERED TRANSIT_LOSS_WRITEOFF MISCOUNT_CORRECTED }
```

Display ID (`DSC-####`) is a formatted presentation of a sequence, not a
stored column — same pattern as other document numbers in the codebase;
confirm exact precedent during build (check how `GRN-####`/`ADJ-####` are
generated) rather than inventing a new numbering scheme. See §6 Q2.

### 1.4 `RequisitionHistoryRow` — additive field

Add a small dispatch-summary field (department/status list) to
`RequisitionHistoryRowSchema` in `requisitions-validators.ts` so
Requisition History cross-links to its dispatches. Additive only — no
change to `Requisition`/`RequisitionSection`/`RequisitionLine` themselves.

### 1.5 Migration plan

All additive: three new tables, one enum on each, one FK restoration
(`dispatchLineId`), one new nullable/derived field on an existing read
schema (not a DB column — computed in the repository). No existing data
moves. Follow the standard `npx prisma migrate dev --name` flow per
CLAUDE.md.

---

## §2. API contract — new `API_CONTRACT.md` §25

New section, following the shape of §21–24. Endpoints, grouped by session:

**Session A (hub org, Store Manager / Store Attendant):**
- `GET /dispatch/queue` — approved requisitions across branch orgs, the
  cross-org read named in `CENTRAL_STORE_SCOPING_DESIGN.md` §4; role-gated
  to `STORE_MANAGER`/`STORE_ATTENDANT` on the hub org, scoped by
  `toOrganizationId` = each branch explicitly enumerated, never unscoped
  (the refined Non-Negotiable #3 language from that design doc).
- `GET /dispatch/:requisitionId/fulfil` — per-department line detail
  (requested/on-hand/dispatch-qty inputs) for one branch's requisition.
- `POST /dispatch/:requisitionId/fulfil/:departmentTag` — sign + PIN,
  writes `DISPATCH_OUT` transactions, creates `Dispatch` + `DispatchLine`
  rows, status → `IN_TRANSIT`.
- `GET /dispatch/:id/delivery-note` — shared by print and on-screen
  renderers (§0 finding: one record, two views).

**Session B (branch org, Department Head / Branch Manager; hub org, Store
Manager for discrepancy resolution):**
- `GET /deliveries` — branch's dispatches, all departments (Branch
  Manager) or own department only (Department Head), per C4's scoping.
- `POST /deliveries/:dispatchId/confirm` — sign + PIN, writes
  `DISPATCH_IN` transactions at the confirmed qty; if confirmed ≠
  dispatched, creates an open `Discrepancy` (Flow 10a) instead of
  blocking the confirm.
- `POST /deliveries/:dispatchId/confirm-on-behalf` — Branch Manager path
  (Flow 10b); same write, `confirmedOnBehalf: true`, records real signer.
- `GET /discrepancies` — filtered list; Store Manager sees all branches,
  Branch Manager sees own branch read-only (role-gated response shape, not
  two endpoints).
- `GET /discrepancies/:id` — detail.
- `POST /discrepancies/:id/resolve` — Store Manager only, sign + PIN, one
  of the three outcomes, writes the corresponding ledger entry (adjustment
  at store, adjustment at department, or spawns a follow-up `Dispatch`).

Each endpoint: Zod schema, `authenticate` + `requireRole`, every repository
query scoped per §1's refined cross-org rule. Full request/response shapes
and error cases to be written directly into `API_CONTRACT.md` §25 during
Step 6 (freeze), using `requisitions-validators.ts` as the shape template
(fixed enums, explicit param/query/body schemas per endpoint).

---

## §3. Notifications

Extend `backend/src/services/fcm-service.ts` with the same fire-and-forget
pattern Milestone Four established (`sendRequisitionSubmittedPush`, etc. —
errors swallowed, never block the write):

- `sendDispatchInTransitPush` — to the receiving department head(s), on
  sign (Flow 9 end state: "department heads notified").
- `sendTransitDiscrepancyPush` — to Store Manager, Branch Manager,
  Directors, on discrepancy creation (Flow 10a/20).
- `sendDiscrepancyResolvedPush` — to Branch Manager, Directors, on
  resolution (Flow 11 step 5).

No new notification infrastructure — this is additive to the existing
service, matching the precedent exactly.

---

## §4. Build discipline — per-artboard visual + behavioral gate (binding for both sessions)

This supersedes Milestone Four's end-of-session-only visual pass, and
extends Session A's visual-only gate with a behavioral/accessibility check
— Session A's own screens shipped with real gaps here (missing focus
states, unlabeled inputs, no `aria-live` on async errors — see the
Session A audit) that a pure visual diff cannot catch, because Paper's
artboards are static and can't represent focus, keyboard nav, or a11y
semantics at all. For **every artboard state** in §0's table (not just
each screen's primary state — every populated/empty/loading/error/
mid-signature/signed variant), the build loop is:

1. Implement the screen/state — while writing it, consult the
   `building-components` skill (accessibility/ARIA, composition, state,
   design-token references) and the `vercel-composition-patterns` skill
   (avoid boolean-prop sprawl, compound components, lift state) so the
   component is built right the first time rather than patched after a
   review flags it.
2. Screenshot the Paper artboard (`get_screenshot` on its node ID from §0).
3. Screenshot the live rendered page at the matching viewport — use the
   `run-frontend-browser` skill (dev-server setup + project gotchas) with
   the chrome-devtools MCP to drive the browser — in the same state.
4. Eyeball side-by-side — spacing, type scale, color tokens, gradient/sheen
   treatment on primary actions, alignment — no automated pixel-diff (per
   standing project rule).
5. Run the `web-design-guidelines` skill against the file(s) just written
   for this artboard state (accessibility, focus states, forms, animation,
   content handling, hover/interactive states — the categories Paper's
   static artboards can't show).
6. Fix any visual deviation (step 4) and any guideline finding (step 5)
   together.
7. Re-screenshot and re-run the guidelines check to confirm both fixes,
   then mark that artboard state done.

No artboard state counts as built until both its visual gate and its
`web-design-guidelines` gate have passed. The end-of-session integration
pass (browser click-through with real data, checking the full flow
end-to-end, cross-screen consistency — e.g. a dispatch created in Session
A's queue must show up correctly in Session B's branch-incoming list)
still happens after the build, but its job is now functional verification
only, not visual or behavioral fidelity — that risk is retired per-screen
during the build itself.

---

## §5. Session breakdown

### Session A — Dispatch (C1/C2/C3), 9 artboard-states

**Depends on:** nothing beyond current `main` (Milestone Four's
requisitions module, hub-org catalog/inventory already shipped).
**Ships independently:** yes — a dispatch can sit `IN_TRANSIT` with no
receiver yet; this is a valid, real state per Flow 9's own end state, not
a half-built feature.

Backend: `Dispatch`, `DispatchLine` models + migration; `dispatch/queue`,
`dispatch/:id/fulfil` (GET+POST), `dispatch/:id/delivery-note` endpoints;
`DISPATCH_OUT` transaction writer (first writer for this transaction type);
`dispatchLineId` FK restoration; `sendDispatchInTransitPush`.

Frontend: `frontend/features/dispatch/` — desktop master-detail (`15V5-0`),
mobile queue (`1500-0`) + fulfil (`1523-0`/`154G-0`), delivery note
on-screen (`1707-0`) + mobile view (`15JU-0`/`15PX-0`) + print
(`15QW-0`/`15SU-0`).

Build order (per §4, each state individually gated): desktop master-detail
populated → its loading/error/empty states (confirm exact set from Paper
before starting — §0's desktop row wasn't fully enumerated during Step 5
planning, verify against Paper directly at session start) → mobile queue →
mobile fulfil populated → mobile fulfil mid-signature (PIN) → delivery
note on-screen → delivery note mobile view → print artifacts.

### Session B — Branch Receiving & Discrepancy (C4/C5/C6/C7), 11 artboard-states

**Depends on:** Session A shipped (needs real `Dispatch`/`DispatchLine`
rows to receive against).

Backend: `Discrepancy` model + migration; `deliveries`,
`deliveries/:id/confirm`, `deliveries/:id/confirm-on-behalf`,
`discrepancies` (list+detail), `discrepancies/:id/resolve` endpoints;
`DISPATCH_IN` + `ADJUSTMENT` transaction writers; the three-outcome
resolution logic (Flow 11); `RequisitionHistoryRow` dispatch-summary field
(§1.4); `sendTransitDiscrepancyPush`, `sendDiscrepancyResolvedPush`.

Frontend: `frontend/features/deliveries/` (or fold into `dispatch/` per
folder-structure discussion at session start — matches how closely C4-C7
share components with C1-C3) — desktop master-detail (`168U-0`), mobile
incoming list (`15L1-0`) + confirm receipt (`15I4-0`/`15MG-0`/`15OP-0`),
discrepancy resolution (`16GW-0`/`16LI-0`) + read-only detail (`16DM-0`),
discrepancies list ×2 role views (`16Q7-0`/`16UG-0`).

Build order: desktop master-detail populated (incl. confirm-on-behalf
state) → mobile incoming list → mobile confirm populated → mid-signature →
signed → discrepancy resolution populated → resolved → read-only detail →
discrepancies list (Store Manager) → discrepancies list (Branch Manager).

### Both sessions

- Full visual-fidelity gate per §4.
- `pnpm build && pnpm test` (backend) and `pnpm build` (frontend) before
  either session is considered done, per CLAUDE.md.
- Verify in a real browser per CLAUDE.md's UI rule — not optional.

---

## §6. Open questions for owner approval (mirrors M4's §7 pattern)

1. **Desktop C1/C2's loading/error/empty states** — confirmed populated +
   mid-signature exist; the full state set (loading/error/empty, matching
   M4's B1 pattern of 8 states) needs a direct Paper check at Session A's
   start, not assumed from this planning pass alone.
2. **Discrepancy display-ID generation** — confirm the exact
   sequence-numbering mechanism already used for `GRN-####`/`ADJ-####` so
   `DSC-####` follows the same pattern, rather than inventing a new one.
3. **Folder structure for C4–C7** — one `frontend/features/dispatch/`
   folder for the whole milestone, or split `dispatch/` (Session A) and
   `deliveries/` (Session B)? Decide at Session B's start once Session A's
   actual component boundaries are visible.

---

## Verification

- Backend: `cd backend && pnpm build && pnpm test` — both green, per
  CLAUDE.md's mandatory pre-push checks.
- Frontend: `cd frontend && pnpm build` — clean.
- Real browser verification via the `run-frontend-browser` skill or
  chrome-devtools MCP for every screen, per CLAUDE.md's UI rule.
- Per-artboard visual gate (§4) run continuously during build, not as a
  final step.
- End-of-session integration pass: click through Flow 9/9a/9b (Session A)
  and Flow 10/10a/10b/11 (Session B) end-to-end against real data, confirm
  ledger entries in Postgres via the Postgres MCP (spot-check
  `organizationId` scoping on both sides of the cross-org boundary per
  Non-Negotiable #3's refined rule).
- Owner review of both sessions' screens against Paper before calling
  Milestone Five shipped, same bar as Milestones Three/Four.
