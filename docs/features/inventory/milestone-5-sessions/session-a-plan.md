# Milestone Five — Session A (Dispatch) — Build Plan

## Handoff note (read this first if you are a fresh session)

This plan was written by a prior session that spent its context budget on
Step 5 research (`milestone-5-plan.md`) plus follow-up live Paper/codebase
checks, and deliberately stopped before writing any code, so you start with
a full context budget for the actual build + verification. **You are that
fresh session.** This file is checked into the repo at
`docs/features/inventory/milestone-5-sessions/session-a-plan.md`, matching
the `milestone-4-sessions/session-a-plan.md` convention already used in
this folder — read it directly, no need to re-derive the decisions in
§"Decisions already made" below; those are settled, not open questions.
Read `milestone-5-plan.md` first (the Step 5 high-level plan — data model,
full endpoint list, session split rationale), then this file for the
concrete build order. If anything below turns out wrong once you're in the
code or in Paper, fix it and note the correction — don't silently work
around a stale assumption.

## Context

Milestone Five ("Dispatch & Branch Receiving") is owner-approved at Step 5
(`docs/features/inventory/milestone-5-plan.md`, "Ready for Step 7, Session
A"). This is Session A: the Central Store side of a two-session split —
the dispatch queue, fulfilling a branch's requisition per department,
signing + PIN, the delivery note (on-screen and print), and the
`DISPATCH_OUT` ledger write. No branch-side confirmation, no discrepancy
logic — that's Session B, and depends on this session's data existing.
Implements Flow 9, 9a (short dispatch), 9b (substitution) from
`docs/features/inventory/02-flows.md`.

**Binding process rule for this build (new as of Milestone Five, see
`milestone-5-plan.md` §4):** every artboard state gets its own
screenshot-Paper → screenshot-live → eyeball-compare → fix → re-confirm
cycle **before moving to the next artboard state**. Do not batch all
screens and run one visual pass at the end — that was Milestone Four's
approach and it let one deviation get copied across every screen reusing
that component before anyone caught it. A screen/state is not "done" until
its own gate has passed.

## Decisions already made (do not re-litigate during build)

1. **Discrepancy/document numbering is not a new mechanism.** The codebase
   already has `ReferenceCounter` (`organizationId` + `prefix`, atomic
   `lastNumber` increment) and a working call pattern:
   `referenceCounterRepository.nextReference(tx, organizationId, 'GRN')` —
   see `backend/src/modules/inventory/receiving-repository.ts:25` and its
   call sites in `receiving-service.ts` (`'EXP'`, `'GRN'` prefixes). This
   session's dispatch numbering does **not** use this counter — per
   `MILESTONES.md`'s explicit decision, dispatches use a **daily
   per-branch sequence label** ("Dispatch 4 · Nyeri Town · 17 Sep"), not a
   persistent counter-based ID. Compute that label at write time (count of
   dispatches already created for that branch org today, +1) rather than
   adding a new `ReferenceCounter` prefix for it. Session B's `Discrepancy`
   model, by contrast, likely *should* use `nextReference(tx, hubOrgId,
   'DSC')` — same mechanism as `GRN`/`ADJ` — flag this explicitly to
   Session B's plan so it doesn't invent a different scheme.
2. **`Dispatch.organizationId` = hub org, `toOrganizationId` = branch org**
   — mirrors `StaffTransfer`'s two-org pattern exactly (see
   `backend/prisma/schema.prisma` `model StaffTransfer`). Do not add a
   `locationId`-only scoping scheme; both org IDs are required columns.
3. **The dispatch queue's cross-org read is expected and pre-approved** —
   `docs/inventory/CENTRAL_STORE_SCOPING_DESIGN.md` §4 names this
   explicitly ("Store-side dispatch queue = role-gated query for open
   requisitions across orgs — the documented exception"). Do not add a
   guard that blocks a hub-org actor from reading branch-org
   `Requisition` rows for this one query; do scope it explicitly per
   branch (enumerate `toOrganizationId` values, never an unscoped
   cross-tenant query) per the refined Non-Negotiable #3 language in that
   same doc.
4. **PIN-signing follows the exact `requisitions-service.ts` pattern**:
   `authRepository.findUserByIdWithPassword` → `comparePin(input.pin,
   actorWithPin.pinHash)` → `UnauthorizedError` on failure/no PIN set. Copy
   this, don't reinvent.
5. **The driver's copy and the on-screen delivery note are one `Dispatch`
   record, two renderers** (print stylesheet vs. app screen) — confirmed
   directly from the Paper artboard's own on-screen note. Do not create a
   separate model or duplicate the data for the printable version; build
   one `GET /dispatch/:id/delivery-note` endpoint, two frontend render
   paths (`@media print` stylesheet + normal screen).
6. **C4's delivery-note tap target is the row itself**, not a separate
   link (confirmed live in Paper on the mobile "Branch incoming
   dispatches" screen, `15L1-0`) — this affects Session B's build, noted
   here so Session A's `GET /dispatch/:id/delivery-note` response shape
   supports being opened from a row tap, not assumed to need a distinct
   nav affordance.
7. **Run any one-time local setup Session A actually needs** (check
   whether branch-department `Location` rows already exist from Milestone
   Four's `provision-branch-departments.ts` script before assuming a
   fresh run is required — Milestone Four already ran this).

## Screens this session builds (see `milestone-5-plan.md` §0 for full table)

Paper file `01M1ZZJ6S3FZGF5C7PPBGTKY89`, page `p-F-0`
("Milestone Five · Dispatch & Branch Receiving").

| Order | Screen | Node(s) | Device | State |
|---|---|---|---|---|
| 1 | C1/C2 Dispatch queue + Fulfil (master-detail) | `15V5-0` | desktop | populated |
| 2 | — same — | `15V5-0` | desktop | loading/error/empty — **verify exact state set exists in Paper before building; not fully enumerated during Step 5 planning** |
| 3 | C1 Dispatch queue | `1500-0` | mobile | populated |
| 4 | C2 Fulfil & dispatch | `1523-0` | mobile | populated |
| 5 | C2 Fulfil & dispatch | `154G-0` | mobile | mid-signature (PIN) |
| 6 | C3 Delivery note | `1707-0` | desktop | signed, per department |
| 7 | C3 Delivery note view | `15JU-0` | mobile | driver's-copy label |
| 8 | C3 Delivery note view | `15PX-0` | mobile | read (Dept Head) |
| 9 | Delivery Note print | `15QW-0` | print (A4) | clean |
| 10 | Delivery Note print | `15SU-0` | print (A4) | discrepancy variant |

Build strictly in this order; gate each row per the binding process rule
above before starting the next.

## Backend build order

1. Migration: `Dispatch`, `DispatchLine` models (§1.1/§1.2 of
   `milestone-5-plan.md`), `DispatchStatus` enum, restore
   `InventoryTransaction.dispatchLineId` as a real FK.
2. `dispatch-repository.ts`: queue query (cross-org, role-gated, explicit
   branch enumeration), fulfil-detail query, `DISPATCH_OUT` transaction
   writer, delivery-note read.
3. `dispatch-service.ts`: business logic — dispatched-qty pre-fill
   (`min(requested, available)`), short-dispatch (no validation error,
   just records shortfall), substitution (add line, zero original,
   `isSubstitute: true`), sign+PIN gate, department-level confirm writing
   per-department (not per-branch) status transitions.
4. `dispatch-controller.ts` + `dispatch-routes.ts`: wire
   `GET /dispatch/queue`, `GET /dispatch/:requisitionId/fulfil`,
   `POST /dispatch/:requisitionId/fulfil/:departmentTag`,
   `GET /dispatch/:id/delivery-note`. `authenticate` + `requireRole` on
   every route per Non-Negotiable #2.
5. Zod schemas in `dispatch-validators.ts`, following
   `requisitions-validators.ts`'s shape (fixed enums, explicit
   param/query/body schemas).
6. `fcm-service.ts`: add `sendDispatchInTransitPush`.
7. `RequisitionHistoryRow` dispatch-summary field (`milestone-5-plan.md`
   §1.4) — additive, this session or Session B, whichever actually needs
   it first; check before duplicating the work.
8. Tests: unit tests for short-dispatch/substitution/sign-gate logic
   (mirror `requisitions-service.test.ts`'s structure), a contract test
   for the new endpoints (mirror `requisitions-contract.test.ts`).

## Frontend build order

`frontend/features/dispatch/` (new folder, per
`docs/CODING_STANDARDS.md` §9 / `FEATURE_REDO_PLAYBOOK.md` §9 shape:
`components/ hooks/ services/ store/ types/ + index.ts`).

Build components/screens in the artboard order in the table above, gating
each per the binding process rule. Reuse `components/app/shell/
mobile-status-bar.tsx` as-is on mobile artboards (already solved,
Milestone Four precedent — do not rebuild).

## Definition of done for this session

- All 10 rows in the screen table above individually visually gated and
  passing.
- Backend: `cd backend && pnpm build && pnpm test` clean.
- Frontend: `cd frontend && pnpm build` clean.
- Verified in a real browser (`run-frontend-browser` skill or
  chrome-devtools MCP): create a requisition, approve it (Milestone
  Four's flow), dispatch it fully and partially (Flow 9a), dispatch with
  a substitution (Flow 9b), confirm the `DISPATCH_OUT` ledger rows exist
  in Postgres via the Postgres MCP with correct `organizationId` /
  `toOrganizationId` scoping.
- A dispatch left `IN_TRANSIT` with no Session B built yet is an expected,
  correct end state — not a bug to work around.
