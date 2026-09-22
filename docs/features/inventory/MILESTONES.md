# Inventory & Procurement — Milestone Breakdown

**Feature:** Inventory & Procurement (Feature 1 of the redo)
**Purpose of this doc:** one page answering "how many milestones does this
feature have, what does each cover, and where are we." Each milestone gets its
own Step 5 plan doc (`milestone-<n>-plan.md`) once its screen group is
approved and Step 5 planning actually starts — this page is the index, not a
replacement for those.
**Status:** Milestone One shipped. Milestone Two's screen group approved
2026-09-15; Step 5 plan approved 2026-09-16 (`milestone-2-plan.md`, all six
§7 questions resolved). Step 7 build: S0–S8 complete (S8 — Suppliers screen,
Supplier detail, Record invoice/payment, desktop + mobile — landed
2026-09-18, including a same-day backend amendment closing three contract
gaps found while building: `Supplier.paymentDays` now exposed on read
models, `SupplierApDetailSchema` frozen with a contract test, and
`listSupplierAp` given real `limit`/`cursor` pagination). **S9 (integration)
ran and completed 2026-09-18** — Flows 1, 2a, 2b, 2d, 2e, 14, 15, 16 walked
end to end in a real browser; found and fixed a partial-payment
over-allocation bug, a stale Pay-now status label, and a dead "Receive"
button left disabled since before S6 shipped (see `milestone-2-plan.md` §5
S9 row for full detail). **Milestone Two is functionally complete.**

**Milestone Three (Prep) — SHIPPED 2026-09-21.** 8 screens (Prep runs list,
New prep run, Prep run detail, Prep History — desktop + mobile each), all
approved in Paper, built Step 7 (S0) and integration-tested Step 8 (S1) in
one continuous session. Backend: `PrepRun`/`PrepRunInputLine` models,
`InventoryTransaction.prepRecordId` restored as a real FK, 5 endpoints
(`API_CONTRACT.md` §23), atomic transaction writing the codebase's first
negative-signed ledger rows (`PREP_CONSUME`) alongside `PREP_PRODUCE` and
an output-item cost update, rolling-average + yield-variance threshold
logic (15% warn / 35% notify SM, last 10 runs or 30 days whichever fewer,
never excluding outliers). 28 new backend tests; full suite green
(845/845). Frontend built against the real endpoints, verified end-to-end
in a real browser (created a run, confirmed the ledger effect in Postgres,
browsed detail/History), then checked screen-by-screen against the
approved Paper artboards — found and fixed real layout deviations on all 4
desktop screens, added screen-mirroring loading skeletons, and fixed three
bugs an owner walkthrough surfaced (a mobile detail-drawer crash, cramped/
wrapping table columns, and the nav sidebar's active-item highlight not
tracking the Prep route). Full outcome log: `milestone-3-plan.md` §5.
**Date:** 2026-09-21
**Do not use "Phase 1/2/3" language for this feature** — that framing is from
a discarded prior iteration. Milestones here are workflow-based groups, not
phases.

**Milestone Five (Dispatch & Branch Receiving) — screen-set approved
2026-09-21.** See the full entry below (after Milestone Four's Deferred
note) for what changed this pass. Ready for Step 5 planning.

**Milestone Four (Requisition & Branch Approval) — screen-set review
underway (2026-09-21).** On inspection, most of the screen group marked
DESIGNED-REDO/MISSING in `02-screens-by-role.md` was stale documentation, not
a real gap — see the findings note on the Paper review page. Real scope this
pass:
- **Category-grouped line items on B2 (fill) and B4 (approval)** — the
  client's real Kitchen stock sheet groups requisition items by category, two
  levels deep in Kitchen's case ("Prep Kitchen Items" → "Chicken"/"Beef"/
  "Pork"/"Fish", plus "Market Items", "Dry Items" as their own groups); every
  other department's sheet is flat. This is **not a separate "market
  requisition"** — market-sourced items are just a category on the same
  section. Required a schema addition: `Category.parentCategoryId` (nullable,
  one level, additive migration — see `docs/DATA_MODEL.md` §4.48). Full
  reasoning and source photos: `docs/features/inventory/02-flows.md` Flow 7
  step 1 / Flow 8 step 1.
- **Screen 0, "Requisitions" (Department Head, mobile)** — a real gap, newly
  designed. Not a generic "dashboard": department heads already have a
  staff-role dashboard (chef/waiter) this must not replace or compete with.
  Scoped to requisitions only — today's summary, needs-your-section, incoming
  dispatch to confirm, this morning's opening, quick waste — with a path to
  full requisition history as its own screen, not inlined.
- **Terminology fix carried through every screen in this set:** "round" →
  "requisition" (matches `02-flows.md`'s own language, e.g. "Morning
  requisition"); count screens say "Opening count" / "Closing count".
- **Interactivity/button-affordance fixes:** primary actions get the
  already-defined `bg-wds-gradient-primary` + `shadow-wds-sheen` treatment
  (under-applied on some existing artboards, which read as cards, not
  buttons); the missing note-to-manager entry point on B2 gets a real,
  visible affordance.

**Deferred to a Milestone Four build session (not this design pass):** the
already-shipped Milestone One "Manage categories" drawer (F1b) needs a new,
optional "Parent category" picker so Kitchen can set up the nesting above.
This is an *addition* to a shipped screen, not a redesign — the drawer keeps
working exactly as today for every category that leaves the field blank.
Track alongside the Milestone Four Step 5 plan, not before.

**Milestone Five (Dispatch & Branch Receiving) — screen-set APPROVED
2026-09-21.** Same pattern as Milestone Four: most of the screen group
marked MISSING in `02-screens-by-role.md` turned out to already exist,
built in an earlier pass — this session consolidated the existing
artboards onto one Paper page (`Milestone Five · Dispatch & Branch
Receiving`, 20 artboards / 7 rows) and did a real redesign pass against the
Milestone Four master-detail pattern and `docs/DESIGN_SYSTEM.md` §13. Real
changes this pass:
- **C1/C2 merged into one master-detail screen** (Dispatch queue + Fulfil),
  matching Milestone Four's B1 pattern — branch list left, department
  sections right, replacing the old three-separate-screens flow.
- **Signature is per-department, not per-branch** — confirmed against
  `02-flows.md` Flow 9 (each department is its own signed document with its
  own delivery note); each department section gets its own "Sign & dispatch
  [department]" action and collapses to a read-only summary once signed.
- **Status progression made visible on the Dispatch screen**: a signed
  section now shows Awaiting → In Transit (amber) → Confirmed (green), so
  the Store Manager can see receipt confirmation without a separate screen.
  Dropped an earlier invented "Arrived · unconfirmed" state — the flow docs
  only define In Transit and Confirmed; no physical-arrival event exists in
  the data model.
- **Minimal C7 (discrepancy alert entry) pulled forward from its
  Milestone-Six-scoped slot** — a Discrepancies list (Store Manager: all
  branches, resolves; Branch Manager: own branch, read-only) with
  period/branch filters, linked from a KPI-adjacent banner on both the
  Dispatch and Deliveries screens. The full alert inbox (dashboard-wide
  notification center, Director scope) stays out of scope for M5.
  Discrepancy resolution itself (3 signed outcomes: found & re-delivered /
  transit loss write-off / miscount corrected) already existed on the Store
  Manager's own page and was pulled into this set, matching Flow 11 exactly.
- **Delivery Note on-screen view rebuilt** and wired to the Dispatch
  screen's "View note" link — mistakenly deleted mid-session as
  "superseded," then restored once flagged; print stylesheet is unchanged
  (already designed, out of scope for this pass).
- **Dispatch numbering switched** from an invented persistent ID
  (`DSP-####`) to a daily per-branch sequence ("Dispatch 4 · Nyeri Town ·
  17 Sep") across every screen that references it.
- **Mobile screens explicitly relabeled by ownership** — the Attendant
  mobile Dispatch/Fulfil screens are shared with the Store Manager (per
  O-SM1: SM is desktop-primary, reuses Attendant mobile on her phone, no
  separate SM mobile artboards), and every Department Head mobile screen
  says so on the artboard name.
- **Attendant mobile Fulfil screen** gained department tabs (Kitchen /
  Barista / Service / Housekeeping) so one department's lines show at a
  time, consistent with the per-department signing decision.

**Traces to:** `01-description.md` (the 10 domain Stages this breakdown
groups), `02-screens-by-role.md` (per-screen DESIGNED/MISSING status),
`docs/FEATURE_REDO_PLAYBOOK.md` (the per-feature Step 1–7 pipeline each
milestone runs through independently).

---

## How milestones relate to Stages

`01-description.md` describes the business process as 10 sequential Stages
(Buying → Receiving → Prep → Requisition → Branch approval → Fulfilment/
dispatch → Branch receiving → Consumption → Counting/closing → Supplier
payment). **Stages are the domain model; milestones are the build/ship units**
— a milestone groups the Stages (and the screens that implement them) that
share one screen set or one causal chain, so nothing ships half-wired.

---

## The six milestones

| # | Milestone | Stages covered | Design status | Build status |
|---|---|---|---|---|
| 1 | **Catalog, Suppliers & Restock Levels** | Foundational reference data (feeds Stage 1) | DESIGNED | ✅ **Shipped** 2026-09-15 |
| 2 | **Receiving & Supplier AP** | Stage 1 (Buying/estimate) + Stage 2 (Receiving) + Stage 10 (Supplier payment) | DESIGNED — all 10 screens exist in Paper, desktop **and mobile** (mobile gap closed 2026-09-15: 7 screens got new mobile artboards, 1 got its missing mobile clone; Purchasing hub also got loading/error states) | ✅ **Shipped** 2026-09-18 — Step 5 plan approved 2026-09-16, Step 7 (S0–S9) complete, integration verified in a real browser |
| 3 | **Prep** | Stage 3 | DESIGNED — all 8 screens exist in Paper, desktop and mobile (4 original + 4 added during 2026-09-19 owner review: Prep run detail, Prep History) | ✅ **Shipped** 2026-09-21 — S0+S1 as one session, verified in a real browser against approved designs |
| 4 | **Requisition & Branch Approval** | Stage 4 + Stage 5 | DESIGNED — screen-set approved 2026-09-21, `milestone-4-plan.md` Step 5 approved same day; Session B's mobile approval screens (M1–M10) designed and owner-approved 2026-09-21, see `milestone-4-sessions/HANDOFF-session-b.md` | ✅ **Shipped** 2026-09-22 — Session A (Dept Head fill) shipped, commit `f5089cd`. Session B (Branch Manager approval + History): build complete (backend `b4ce0a0`/`7ee1ab6`, frontend `d73f810`), verified end-to-end in a real browser; visual-fidelity pass against all 10 desktop + 10 mobile Paper artboards complete, real deviations found and fixed (see HANDOFF-session-b.md's visual-fidelity section for the full per-screen log), `pnpm build && pnpm test` clean both sides |
| 5 | **Dispatch & Branch Receiving** | Stage 6 + Stage 7 | DESIGNED — screen-set approved 2026-09-21, Paper page `Milestone Five · Dispatch & Branch Receiving` (20 artboards, 7 rows) | Not started — ready for Step 5 planning |
| 6 | **Counting, Closing & Discrepancies** | Stage 8 (consumption — no new build, still count/waste-driven) + Stage 9 | Mixed — Central Store blind-count mobile DESIGNED; verification, branch EOD, discrepancy resolution mostly MISSING | Not started |

**Milestone 6 still has real design gaps** (MISSING / DESIGNED-REDO screens in
`02-screens-by-role.md`) — it needs its own Paper design pass before Step 5
planning can start, the same way Milestone One needed Phase 0 (design system)
before it could build. Milestones 2–5 are the exception: fully designed
already (3–5 turned out to be mostly-already-designed once actually checked
in Paper rather than trusting `02-screens-by-role.md`'s stale MISSING labels
— see each milestone's entry above for what that review pass actually
found and changed).

---

## Why grouped this way

- **Milestone 2** bundles Buying + Receiving + Supplier AP because they share
  one screen set (the Purchasing hub) and one causal chain: a Goods Receipt's
  payment-terms toggle directly creates the AP row that invoice/payment/aging
  screens manage. Splitting mid-chain would ship a receipt with nowhere for
  its resulting invoice to go.
- **Milestone 3** (Prep) stands alone — single-station, no cross-branch
  dependency, no other milestone depends on it existing first.
- **Milestones 4 and 5** split one continuous document flow (a requisition
  travels Stage 4 → 5 → 6 → 7) into two ship units because they're different
  failure modes and different owners: 4 is "does the document reach the
  Central Store correctly" (branch-side), 5 is "does stock actually move"
  (store-side). A requisition can be correctly approved (4) independent of
  whether dispatch fulfils it well (5).
- **Milestone 6** is last because counting/closing measures what the earlier
  milestones' activity (prep, dispatch, receiving) actually produced — it
  needs real stock movement to reconcile against.

---

## Per-milestone docs (created as each milestone starts)

| Milestone | Plan doc |
|---|---|
| 1 | `milestone-1-plan.md` (shipped) |
| 2 | `milestone-2-plan.md` (shipped 2026-09-18 — Step 7: S0–S9 all done) |
| 3 | `milestone-3-plan.md` (Step 5 approved 2026-09-19, all four §6 questions resolved — ready for Step 7) |
| 4 | `milestone-4-plan.md` (Step 5 approved 2026-09-21, all three §7 questions resolved — ready for Step 7, Session A: Dept Head fill, then Session B: Branch Manager approval + History) |
| 5 | not yet created — screen-set approved 2026-09-21, ready for Step 5 planning |
| 6 | not yet created |

Session-level prompts and handoffs for a shipped milestone move to
`archive/` once the milestone closes (see Milestone One's
`archive/06-sessions/` and the two `archive/HANDOFF-*.md` files) — they're
historical record, not live guidance.
