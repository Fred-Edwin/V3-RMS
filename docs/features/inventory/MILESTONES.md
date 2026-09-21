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
| 4 | **Requisition & Branch Approval** | Stage 4 + Stage 5 | Screen-set review underway (2026-09-21) — see below | Not started |
| 5 | **Dispatch & Branch Receiving** | Stage 6 + Stage 7 | Mostly MISSING (dispatch queue, fulfil & dispatch, delivery note, branch incoming/confirm); mobile dispatch/fulfil DESIGNED | Not started |
| 6 | **Counting, Closing & Discrepancies** | Stage 8 (consumption — no new build, still count/waste-driven) + Stage 9 | Mixed — Central Store blind-count mobile DESIGNED; verification, branch EOD, discrepancy resolution mostly MISSING | Not started |

**Milestones 3–6 have real design gaps** (MISSING / DESIGNED-REDO screens in
`02-screens-by-role.md`) — each needs its own Paper design pass before Step 5
planning can start, the same way Milestone One needed Phase 0 (design system)
before it could build. Milestone Two is the exception: fully designed already.

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
| 4–6 | not yet created |

Session-level prompts and handoffs for a shipped milestone move to
`archive/` once the milestone closes (see Milestone One's
`archive/06-sessions/` and the two `archive/HANDOFF-*.md` files) — they're
historical record, not live guidance.
