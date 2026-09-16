# Inventory & Procurement — Milestone Breakdown

**Feature:** Inventory & Procurement (Feature 1 of the redo)
**Purpose of this doc:** one page answering "how many milestones does this
feature have, what does each cover, and where are we." Each milestone gets its
own Step 5 plan doc (`milestone-<n>-plan.md`) once its screen group is
approved and Step 5 planning actually starts — this page is the index, not a
replacement for those.
**Status:** Milestone One shipped. Milestone Two's screen group approved
2026-09-15; Step 5 plan approved 2026-09-16 (`milestone-2-plan.md`, all six
§7 questions resolved). Step 7 build underway — S0 (component inventory) in
progress, S1 (schema/migration) and S2 (contract freeze) complete.
**Date:** 2026-09-15
**Do not use "Phase 1/2/3" language for this feature** — that framing is from
a discarded prior iteration. Milestones here are workflow-based groups, not
phases.

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
| 2 | **Receiving & Supplier AP** | Stage 1 (Buying/estimate) + Stage 2 (Receiving) + Stage 10 (Supplier payment) | DESIGNED — all 10 screens exist in Paper, desktop **and mobile** (mobile gap closed 2026-09-15: 7 screens got new mobile artboards, 1 got its missing mobile clone; Purchasing hub also got loading/error states) | Screen group approved 2026-09-15; **Step 5 plan approved 2026-09-16** — Step 7 underway (S0 in progress, S1+S2 done) |
| 3 | **Prep** | Stage 3 | Mobile DESIGNED; desktop New-prep-run **MISSING** | Not started |
| 4 | **Requisition & Branch Approval** | Stage 4 + Stage 5 | Mixed — list/approval views DESIGNED-REDO (rebuild, not fresh design); signed-doc view MISSING | Not started |
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
| 2 | `milestone-2-plan.md` (approved 2026-09-16 — Step 7 build underway) |
| 3–6 | not yet created |

Session-level prompts and handoffs for a shipped milestone move to
`archive/` once the milestone closes (see Milestone One's
`archive/06-sessions/` and the two `archive/HANDOFF-*.md` files) — they're
historical record, not live guidance.
