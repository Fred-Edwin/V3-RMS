# Milestone Five — Session B (Branch Receiving & Discrepancy) — Build Plan

## Handoff note (read this first if you are a fresh session)

This plan was written by the session that just finished Session A, while
that context — the exact contract shapes Session A shipped, the Paper node
IDs, the decisions actually made vs. deferred — was still fresh. You are a
fresh session starting Session B. This file is checked into the repo at
`docs/features/inventory/milestone-5-sessions/session-b-plan.md`, matching
the `session-a-plan.md` convention in this same folder — read it directly,
no need to re-derive the decisions below; they are settled, not open
questions. Read `milestone-5-plan.md` first (the Step 5 high-level plan —
full data model, endpoint list, session split rationale), then
`session-a-plan.md` to see exactly what Session A shipped and how, then
this file for Session B's concrete build order. If anything below turns out
wrong once you're in the code or in Paper, fix it and note the correction —
don't silently work around a stale assumption.

## Context

Milestone Five ("Dispatch & Branch Receiving") Session A is **shipped and
committed** (commit `2106bc0` on `main`, 2026-09-22): the Central Store
side — dispatch queue, per-department fulfil with sign+PIN, delivery note
(on-screen + print). Verified end-to-end in a real browser with a real
Postgres write. This is Session B: the branch side — a department head (or
branch manager, confirming on behalf) receives a dispatch, confirms what
actually arrived, and any mismatch opens a `Discrepancy` that the Store
Manager resolves. Implements Flow 10, 10a, 10b, 11 from
`docs/features/inventory/02-flows.md`.

**Binding process rule for this build (unchanged from Session A, see
`milestone-5-plan.md` §4):** every artboard state gets its own
screenshot-Paper → screenshot-live → eyeball-compare → fix → re-confirm
cycle **before moving to the next artboard state**. Do not batch all
screens and run one visual pass at the end.

## Skill usage for this session

`.agents/skills/` has five installed skills. Not all of them fit this
build — use them as follows, don't run them all reflexively.

- **`run-frontend-browser`** — use for every live verification. This is
  the project's standing convention for satisfying CLAUDE.md's "verify in
  a real browser before calling it done" rule, and is what Session A used
  throughout.
- **`web-design-guidelines`** — run it against each screen's files right
  after that screen is built and gated against Paper, before moving to
  the next artboard state. It fetches Vercel's Web Interface Guidelines
  fresh from GitHub and checks accessibility/interaction concerns a
  visual-only Paper comparison won't catch on its own — focus states,
  keyboard navigation (especially the confirm-quantity steppers and the
  PIN sign sheet), semantic markup. Requires network access to
  `raw.githubusercontent.com`; if that's unavailable in the sandbox, note
  it and continue without this pass rather than blocking the build on it.
- **`vercel-composition-patterns`** — skim
  `rules/architecture-avoid-boolean-props.md` and
  `rules/patterns-explicit-variants.md` specifically before building
  `discrepancy-resolution-screen.tsx`. That screen branches on role +
  status + resolution outcome all at once — exactly the shape that
  tempts a wall of boolean props instead of composing explicit variants,
  the way Session A's own `SectionBlock` (in the desktop fulfil screen)
  already branches per-department status inline rather than via flags.
  Follow that existing precedent over inventing a new pattern. **Skip
  this skill's `rules/react19-no-forwardref.md`** — this repo is on
  React 18 (`frontend/package.json`), that rule does not apply here.
- **`building-components`** — only reach for this if a screen genuinely
  needs a new `components/ui2/` primitive that doesn't exist yet (e.g.
  the confirm-quantity stepper or the three-outcome resolution radio).
  Check the existing primitives first — Session A didn't need to add any
  for its stepper/tab-bar/sign-sheet UI, reusing what was already there.
  If one really is missing, pull `references/accessibility.mdx` and
  `references/state.mdx` specifically rather than the whole reference
  set.
- **`agent-browser`** — do not use. It's a general-purpose browser
  automation CLI that overlaps with `run-frontend-browser` but requires
  a separate global install not present in this environment. Redundant
  here; skip it.

## What Session A actually shipped (read before touching code)

Don't re-derive these — they're the foundation Session B builds directly on top of.

1. **`Dispatch` / `DispatchLine` already have every column Session B
   needs.** `confirmedById`, `confirmedAt`, `confirmedOnBehalf` on
   `Dispatch`, and `confirmedQty` on `DispatchLine`, were added in Session
   A's migration in anticipation of Session B — **do not add a new
   migration for these**, they already exist
   (`backend/prisma/schema.prisma`, `model Dispatch` / `model
   DispatchLine`). Session B's migration only needs to add the new
   `Discrepancy` model (§1 below).
2. **`DispatchStatus` enum is `AWAITING | IN_TRANSIT | CONFIRMED |
   DISCREPANCY_OPEN`** — already defined. A dispatch Session A creates
   lands at `IN_TRANSIT`; Session B's confirm endpoint transitions it to
   `CONFIRMED` or `DISCREPANCY_OPEN` depending on whether every line's
   `confirmedQty` matches `dispatchedQty`.
3. **`dispatch-repository.ts` / `dispatch-service.ts` /
   `dispatch-validators.ts` / `dispatch.types.ts` already exist** in
   `backend/src/modules/dispatch/` — Session B adds sibling files
   (`deliveries-repository.ts`, `discrepancy-service.ts`, etc.) in the
   same module folder, or extends the existing ones where a method
   genuinely belongs there (e.g. a `findByIdWithLines` read the confirm
   flow can reuse as-is). Don't create a separate `deliveries` or
   `discrepancy` top-level module — this is still one feature module,
   Session A's own file split was by concern (queue/fulfil vs. note), not
   by session.
4. **`GET /dispatch/:id/delivery-note` is already built and already
   supports the confirmed/discrepancy render** — `DeliveryNoteScreen`
   (`frontend/features/dispatch/components/screens/delivery-note-screen.tsx`)
   and `PrintableDeliveryNote` both branch on `note.status` /
   `note.confirmedByName` / `note.confirmedAt` already; the discrepancy
   print variant (`15SU-0`) was verified against these components
   structurally but never exercised live (nothing to confirm against
   yet). Don't rebuild the delivery note screens — Session B's confirm
   write is what makes their already-built confirmed/discrepancy branches
   actually reachable. Do re-verify `15SU-0` specifically once a real
   discrepancy exists (§ screen table, row 6).
5. **The frontend dev server correctness gotcha from Session A**:
   `tsx watch` in this sandbox does **not** reliably pick up backend file
   changes — after every backend edit, kill the `node .../tsx/dist/cli.mjs
   watch src/server.ts` process on port 4000 and restart it manually
   (`cd backend && npx tsx watch src/server.ts`), then re-verify via curl
   before trusting a live browser check. Session A lost time to this
   once; don't repeat it.
6. **Central Store dev credentials** (from the Session A verification
   walkthrough): `store.manager@wendo.test` / `password123`, PIN `1234`.
   Session B needs branch-side dev accounts too — check
   `backend/src/scripts/seed-dev.ts` for the department-head and
   branch-manager email pattern (`<role><n>.<branch-slug>@dev.test`) and
   confirm a PIN is set for at least one department head before the sign
   flow needs testing (Session A had to set one manually via a one-off
   script — see if seed-dev already covers this for branch roles; if not,
   same approach works).

## Decisions already made (do not re-litigate during build)

1. **`Discrepancy` uses the `ReferenceCounter` mechanism, hub-scoped** —
   `referenceCounterRepository.nextReference(tx, hubOrgId, 'DSC')`, same
   pattern as `GRN`/`ADJ` (see `backend/src/modules/inventory/
   receiving-repository.ts:25` and its call sites in
   `receiving-service.ts`). This is explicitly **not** the same mechanism
   as `Dispatch.sequenceLabel` (a computed daily label, not a persistent
   counter) — the two document types intentionally use different
   numbering schemes; don't unify them.
2. **Discrepancy detection is automatic, not a separate user action.**
   `POST /deliveries/:dispatchId/confirm` always writes `DISPATCH_IN`
   transactions at the *confirmed* quantity; if any line's
   `confirmedQty != dispatchedQty`, the same request also creates an
   `OPEN` `Discrepancy` row per mismatched line (or one `Discrepancy`
   covering all mismatched lines on that dispatch — pick whichever the
   Paper `16GW-0` resolution screen's own shape implies; check via
   `get_jsx` before deciding, don't guess). This never blocks the
   confirm — a discrepancy is a fact to resolve later, not a validation
   error (same "short dispatch is not an error" philosophy Session A
   applied to `DISPATCH_OUT`).
3. **`DISPATCH_IN` is negative-signed like `DISPATCH_OUT`? No —
   positive.** `DISPATCH_OUT` (Session A) is negative because stock is
   *leaving* the Central Store. `DISPATCH_IN` (Session B) is *arriving*
   at the branch-department location, so it's a positive quantity at that
   location. Confirm this against `01-description.md`/`DATA_MODEL.md`'s
   ledger-sign convention before writing the first line — don't assume
   the sign from Session A's writer without checking, the physical
   direction is different.
4. **Confirm writes to the branch-department `Location`, not the branch
   org's `CENTRAL_STORE` row (there isn't one) or a generic
   organization-level bucket.** Resolve the target location the same way
   `requisitions-service.ts`'s `resolveParAtRequest` does:
   `locationRepository.findByOrganizationTypeDepartment(branchOrgId,
   'BRANCH_DEPARTMENT', departmentTag)`. If that location doesn't exist
   yet for a branch/department combination, that's the same
   Milestone-Four-era gap noted in `CENTRAL_STORE_SCOPING_DESIGN.md` §4 —
   check whether `provision-branch-departments.ts` (Milestone Four's
   script, referenced in `session-a-plan.md` decision #7) already ran for
   every branch before assuming a fresh run is needed.
5. **Confirm-on-behalf (Flow 10b) is a separate endpoint
   (`/confirm-on-behalf`), not a flag on `/confirm`** — per
   `milestone-5-plan.md` §2, so the branch manager's PIN-gate and the
   `confirmedOnBehalf: true` write path stay in one place, mirroring how
   Session A kept dispatch's PIN gate isolated to
   `fulfilDepartment`. Real signer is recorded in `confirmedById`
   regardless of which endpoint was used — `confirmedOnBehalf` is purely
   a display/audit flag, not a different actor-resolution path.
6. **The three discrepancy resolution outcomes (Flow 11) write three
   different things** — confirmed directly from Paper `16GW-0`'s radio
   choices (`session-a-plan.md`'s prior-session research already verified
   these are designed, not undesigned edge cases):
   - `FOUND_REDELIVERED` — spawns a **follow-up `Dispatch`** (new
     sequence label, same department/branch), sets
     `Discrepancy.followUpDispatchId`. Reuses Session A's
     `dispatchService`/`dispatchRepository` creation path — don't
     duplicate that logic; check whether it needs a small parameter
     (skip the requisition-approved-status check, since this dispatch
     isn't tied to a fresh approval) rather than writing a second
     creation function.
   - `TRANSIT_LOSS_WRITEOFF` — writes an `ADJUSTMENT` transaction at the
     **Central Store** (the loss happened in transit, cost absorbed by
     the store, not the branch) for the gap quantity, negative-signed
     (stock reduction). **`ADJUSTMENT` has no writer anywhere in the
     codebase yet** — confirmed by grep during Session B planning; the
     enum value exists (`InventoryTransactionType.ADJUSTMENT`) but no
     stock-count/waste-log service has been built against it. This is
     the first `ADJUSTMENT` writer — follow the `RECEIVE`/`DISPATCH_OUT`
     writer shape (`tx.inventoryTransaction.create` inside the same
     transaction as the status/model write, `unitCost` from
     `InventoryItem.currentCost` or the line's frozen cost) rather than
     hunting for a precedent that isn't there.
   - `MISCOUNT_CORRECTED` — writes a second `ADJUSTMENT` transaction at
     the **branch department** location instead (the branch's own
     confirmed count was wrong, not the shipment), correcting
     `confirmedQty` up or down to match reality. Sign follows the
     correction direction. Same "first writer, no precedent to copy"
     situation as above.
   All three require the Store Manager's sign+PIN (per `milestone-5-plan.md`
   §2's `POST /discrepancies/:id/resolve`), same PIN-gate pattern as
   Session A's `fulfilDepartment`.
7. **`GET /discrepancies` is one endpoint, two response shapes by
   role** — Store Manager sees all branches, Branch Manager sees only
   their own branch, read-only. Role-gated response shape, not two
   endpoints (explicit in `milestone-5-plan.md` §2 — don't split it).
8. **Folder structure: one `frontend/features/dispatch/` folder for the
   whole milestone** — Session A's own file split (queue/fulfil screens
   vs. delivery-note screens, separate hooks per concern) is the
   precedent; Session B adds `components/screens/branch-incoming-screen.tsx`,
   `discrepancy-resolution-screen.tsx`, etc. as siblings, and
   `hooks/use-deliveries.ts`, `hooks/use-discrepancies.ts` alongside
   Session A's hooks. This resolves `milestone-5-plan.md` §6 Q3 — no
   split into a separate `deliveries/` folder.

## Screens this session builds (see `milestone-5-plan.md` §0 for full table)

Paper file `01M1ZZJ6S3FZGF5C7PPBGTKY89`, page `p-F-0`
("Milestone Five · Dispatch & Branch Receiving").

| Order | Screen | Node(s) | Device | State |
|---|---|---|---|---|
| 1 | C4/C5 Branch incoming & confirm (master-detail) | `168U-0` | desktop | populated (incl. manager-confirms-on-behalf) |
| 2 | C4 Branch incoming dispatches | `15L1-0` | mobile | populated (Dept Head, own department only) |
| 3 | C5 Confirm branch receipt | `15I4-0` | mobile | populated |
| 4 | C5 Confirm branch receipt | `15MG-0` | mobile | mid-signature (PIN) |
| 5 | C5 Confirm branch receipt | `15OP-0` | mobile | signed |
| 6 | Delivery Note print (discrepancy variant — Session A built the component, this is its first real exercise) | `15SU-0` | print (A4) | discrepancy, real data |
| 7 | C6 Discrepancy resolution | `16GW-0` | desktop | populated |
| 8 | C6 Discrepancy resolution | `16LI-0` | desktop | resolved (signed) |
| 9 | C6 Discrepancy detail (read-only) | `16DM-0` | desktop | Branch Manager view |
| 10 | C7 Discrepancies list | `16Q7-0` | desktop | Store Manager (all branches) |
| 11 | C7 Discrepancies list | `16UG-0` | desktop | Branch Manager (own branch) |

Build strictly in this order; gate each row per the binding process rule
above before starting the next. Row 6 depends on rows 1–5 having produced
a real discrepancy first (confirm a dispatch with a mismatched quantity)
— don't try to fabricate the print state without a real backend row behind
it.

## Backend build order

1. Migration: `Discrepancy` model, `DiscrepancyStatus` +
   `DiscrepancyOutcome` enums (§1.3 of `milestone-5-plan.md` — schema
   given there verbatim, reuse it). This is the **only** new migration —
   `Dispatch`/`DispatchLine`'s confirm-related columns already exist
   (see "What Session A shipped" #1 above). Do not touch
   `InventoryTransaction` — `DISPATCH_IN` already exists as a reserved
   enum value from Session A's migration.
2. `dispatch-repository.ts` (extend, don't fork): add
   `findDispatchesForBranch` (role-gated: all departments for Branch
   Manager, own department only for Department Head — mirrors
   `requisitions-service.ts`'s `assertOwnDepartment` pattern),
   `markConfirmed` (guarded `updateMany` on status, same "no
   partial-signed state" pattern as `goodsReceiptRepository.markSigned`
   and Session A's own dispatch creation — a `count === 0` means someone
   else confirmed it first, roll back, no partial ledger writes).
3. New `discrepancy-repository.ts`: CRUD + the two list-scope queries
   (Store Manager all-branches vs. Branch Manager own-branch), resolve
   writer.
4. `dispatch-service.ts` (extend): `listDeliveries`, `confirmDelivery`,
   `confirmDeliveryOnBehalf` — sign+PIN gate copied from
   `fulfilDepartment`'s exact shape
   (`authRepository.findUserByIdWithPassword` →
   `comparePin(input.pin, actorWithPin.pinHash)` →
   `UnauthorizedError`), `DISPATCH_IN` transaction writer (positive-signed
   — see decision #3), automatic `Discrepancy` creation on mismatch
   (decision #2).
5. New `discrepancy-service.ts`: `listDiscrepancies` (role-gated shape),
   `getDiscrepancy`, `resolveDiscrepancy` (three-outcome branch, decision
   #6) with its own sign+PIN gate.
6. `dispatch-controller.ts` + `dispatch-routes.ts` (extend): wire
   `GET /deliveries`, `POST /deliveries/:dispatchId/confirm`,
   `POST /deliveries/:dispatchId/confirm-on-behalf`,
   `GET /discrepancies`, `GET /discrepancies/:id`,
   `POST /discrepancies/:id/resolve`. `authenticate` + `requireRole` on
   every route per Non-Negotiable #2 — Department Head gate uses
   `requireDepartmentHead` (not a role check) same as Session A's
   requisitions precedent, Branch Manager uses `requireRole('MANAGER')`,
   discrepancy resolution uses `requireRole('STORE_MANAGER')`.
7. Zod schemas in `dispatch-validators.ts` (extend): follow the existing
   file's shape (fixed enums, explicit param/query/body schemas per
   endpoint) — `ConfirmDeliverySchema` (per-line `confirmedQty` array +
   PIN), `ResolveDiscrepancySchema` (outcome enum + note + PIN).
8. `fcm-service.ts`: `sendTransitDiscrepancyPush`,
   `sendDiscrepancyResolvedPush` — **neither exists yet** (confirmed by
   grep during Session B planning; only `sendDispatchInTransitPush` and
   `sendReceiptVariancePush` were pre-scaffolded, and Session A already
   consumed the first one). Write both fresh, same fire-and-forget
   pattern (`try/catch`, swallow errors, never block the write that
   triggered it) as the two existing ones.
9. Tests: unit tests for confirm/discrepancy-creation/resolve-outcome
   logic (mirror `dispatch-service.test.ts`'s structure — it already has
   the mocking scaffolding for `prisma.$transaction` with a `txStub`,
   extend it rather than writing a new mock setup), a contract test
   extending `dispatch-contract.test.ts`.

## Frontend build order

`frontend/features/dispatch/` (existing folder — extend, per decision #8
above). Build components/screens in the artboard order in the table
above, gating each per the binding process rule. Reuse
`components/app/shell/mobile-status-bar.tsx`,
`components/app/shell/sign-sheet.tsx` (`SignSheetDialog`,
`SignedBySignature`), and `components/app/shell/shell-states.tsx` /
`mobile-states.tsx` as-is — all already solved, Session A precedent, do
not rebuild.

New hooks: `use-deliveries.ts` (list, mirrors `use-dispatch-queue.ts`),
`use-delivery-confirm.ts` (detail + confirm action, mirrors
`use-dispatch-fulfil.ts`'s load/edit/sign shape closely — the "local
edits with a server pre-fill, then one sign action" pattern is identical,
just confirmedQty instead of dispatchQty), `use-discrepancies.ts` (list),
`use-discrepancy-resolve.ts` (detail + resolve action).

New screens: `branch-incoming-confirm-screen.tsx` (desktop master-detail,
`168U-0`), `branch-incoming-screen-mobile.tsx` (`15L1-0`),
`confirm-receipt-screen-mobile.tsx` (`15I4-0`/`15MG-0`/`15OP-0`, same
single-component-three-states pattern as Session A's
`dispatch-fulfil-screen-mobile.tsx`), `discrepancy-resolution-screen.tsx`
(desktop, `16GW-0`/`16LI-0`/`16DM-0` — populated/resolved/read-only as
one component branching on role + status, mirroring how Session A's
`SectionBlock` in the desktop fulfil screen branches per-department
status inline rather than as separate components), `discrepancies-list-
screen.tsx` (`16Q7-0`/`16UG-0`, one component branching on role for the
two scopes, per decision #7).

Routes: `/app/inventory/(shell)/deliveries` (or under branch's existing
route tree — check where Milestone Four's `requisitions` approval screens
live, `/app/branch/(shell)/requisitions`, and place branch-side dispatch
screens as siblings there, e.g. `/app/branch/(shell)/deliveries`, not
under `/app/inventory/` which is Central-Store-only per Session A's own
sidebar). `/app/inventory/(shell)/discrepancies` for the Store Manager
side. **No `Discrepancies` nav entry exists yet** (confirmed by grep
during Session B planning — `inventory-shell.tsx`'s `NAV_GROUPS` has
`stock-counts`/`supplier-ap`/`reports` as placeholder `href: '#'`
entries, nothing for discrepancies); add a new item to the
`central-store` group, pointed at the real route (matching how Session A
wired `dispatch`'s placeholder to a real href rather than leaving it
`#`).

## Definition of done for this session

- All 11 rows in the screen table above individually visually gated and
  passing.
- Backend: `cd backend && pnpm build && pnpm test` clean.
- Frontend: `cd frontend && pnpm build` clean.
- Verified in a real browser (`run-frontend-browser` skill or
  chrome-devtools MCP): confirm a dispatch exactly as sent (clean
  receipt, `CONFIRMED`), confirm one with a shortfall (opens a
  `DISCREPANCY_OPEN`), confirm-on-behalf as a Branch Manager, resolve a
  discrepancy through each of the three outcomes, confirm the
  `DISPATCH_IN` and `ADJUSTMENT` ledger rows exist in Postgres via the
  Postgres MCP with correct location/organizationId scoping (branch
  department for `DISPATCH_IN` and `MISCOUNT_CORRECTED`, Central Store
  for `TRANSIT_LOSS_WRITEOFF`).
- The full Flow 9→10→11 loop closed end-to-end at least once: a
  requisition opened, approved, dispatched (Session A), received with a
  deliberate discrepancy, and that discrepancy resolved — the complete
  document lifecycle this milestone exists to build.
- Owner review of both sessions' screens against Paper — this closes out
  Milestone Five (`docs/features/inventory/MILESTONES.md` update to
  follow, per that doc's existing convention for a shipped milestone).
