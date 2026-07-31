# Phase 1 — Pre-Deploy Local Test Guide

Written 2026-07-31. The local DB is a restored production backup with the
Central Store hub org set up through the Admin UI and the synthetic pilot-demo
dataset seeded (`backend/src/scripts/seed-pilot-demo-local.ts`, data from
`PILOT_DEMO_VIDEO_PLAN.md` §1/§3). This guide walks every Phase 1 screen in
the same order as the demo video's locked walkthrough, so passing it also
rehearses the video.

**Servers:** backend `pnpm dev` in `backend/` (port 4000), frontend `pnpm dev`
in `frontend/` (port 3000). **Accounts:** your real admin +
`store.manager@wendo.co.ke` / `store.attendant@wendo.co.ke`.
**Mobile screens:** use browser device emulation (F12 → device toolbar) or a
phone on the LAN for the Attendant steps — Attendant is mobile-only by design.

## What's already seeded (don't re-create these)

- 3 suppliers, 23-item catalog with department tags, supplier links, prices
- Opening stock (weighted-average costs set): e.g. sugar 45kg, milk 27L,
  brown sugar 22kg, syrup 10.2L
- Prep Recipe "Simple Syrup — Standard Batch" (10L from 5kg sugar) + one
  prior Prep Record (10.2L) so the rolling-average hint has history
- `PO-DEMO-001` DRAFT (Attendant-created) · `PO-DEMO-002` SENT (ready to
  receive) · 3 CLOSED POs backing the AP invoices
- Supplier AP: NHW-INV-101 (partially paid, 10 days old) · AFF-INV-207
  (unpaid, 35 days — overdue bucket) · MKB-INV-330 (fully paid)
- Waste: 3L milk SPOILED (yesterday's fridge check)
- Stock Count "Weekly Spot Count — Pantry" IN_PROGRESS — 5 items, left for
  you to execute live

Re-running the seed is safe (idempotent — everything skips).

## The walkthrough (mirrors the demo video sequence)

| # | Role · Device | Screen | Do / verify |
|---|---|---|---|
| 1 | Admin · desktop | Admin | ✔ Already done locally: Central Store org (Hub badge), store accounts. Verify "Active Branches: 3" and Store Manager listed under Leadership Accounts. |
| 2 | Manager · desktop | Item Catalog + Suppliers | 23 items with sane per-usage-unit costs (no absurd prices); Mt. Kenya Bulk Traders shows 10 linked items. Edit an item, confirm it saves. |
| 3 | Manager · desktop | Prep Recipes | Open "Simple Syrup — Standard Batch" — 10L expected yield, 5kg Golden Crown Sugar input. |
| 4 | Attendant · mobile | Purchase Orders | Open `PO-DEMO-001` (DRAFT) — confirm there is **no Send button** (permission boundary). Optionally create a fresh draft PO via the item picker. |
| 5 | Manager · desktop | Purchase Orders | Open `PO-DEMO-001` → **Send**. Status DRAFT → SENT. |
| 6 | Attendant · mobile | Receiving | Receive `PO-DEMO-002` (40L milk, 15kg chicken). Change one line's qty (e.g. milk 38) to see the discrepancy highlight; enter invoice prices; confirm. PO closes. |
| 7 | Either | Stock on Hand | Milk jumped by the received qty (27 → ~65L), chicken up 15kg. Tap/click a row → movement history shows the `receive` entries. |
| 8 | Attendant · mobile | Prep Entry | Log a Simple Syrup batch: input 5kg sugar, actual yield **9.7L**. Verify the soft-reference hint shows (~10.2L rolling average from the prior run). Confirm — stock: sugar down 5, syrup up 9.7. |
| 9 | Attendant · mobile | Stock Count | Open "Weekly Spot Count — Pantry" (IN_PROGRESS). Verify counts are **blind** (no expected qty shown). Enter counts matching stock except **Nyeri Brown Sugar: enter 18** (real ≈22 — the deliberate miscount). Submit. |
| 10 | Manager · desktop | Stock Count approval | Open the submitted session — variance view flags Brown Sugar ≈ −4kg. Correct the line in place to **21.5**, then Approve. Adjustments post to the ledger. |
| 11 | Either | Waste Log | See the seeded 3L SPOILED milk entry. Log a fresh entry (3-tap flow). Manager sees the full log; Attendant sees own entries. |
| 12 | Manager · desktop | Supplier Invoices / AP | Aging buckets populated: AFF-INV-207 sits in 31+ days overdue. Record a 5,000 MPESA top-up on NHW-INV-101 → status stays PARTIALLY_PAID, outstanding drops to 3,400. |
| 13 | Manager · desktop | Reports | Stock valuation, low-stock, price history, prep yield (two syrup runs), count discrepancy (after step 10), AP aging — all populated. |
| 14 | Attendant · mobile | Dashboard tab | The Attendant landing tab reflects the day's activity — the video's closing shot. |
| — | Attendant · mobile | **RBAC spot-checks** | Attendant nav must NOT show: Catalog/Supplier editing, Supplier AP (zero access), PO Send, Recipe editing, Count approval, Reports, Store Staff. |

## Resetting for a clean re-run

To wipe just the inventory data and re-seed (keeps orgs/users):
ask Claude to truncate the inventory tables for the hub org and re-run
`seed-pilot-demo-local.ts` — or simply keep going; the seed is idempotent
and the walkthrough is repeatable on top of its own results.

## After the test passes → deploy sequence (production)

1. Merge `feature/inventory-phase1` → `main` (PR + squash per project
   convention). CI/CD auto-runs `prisma migrate deploy` on the server —
   already dress-rehearsed against the prod backup; the legacy V2.1 cleanup
   migration deletes the orphaned March tables (accepted, in nightly dumps).
2. In production Admin: create org **"Central Store"** → **Set Hub** →
   **Set up Central Store** (the Location button) → create the real Store
   Manager account → Store Manager logs in → creates Store Attendant(s).
3. Demo-video seeding on production uses the separate isolated-demo-org
   script (`seed-pilot-demo.ts` — not built yet, see PILOT_DEMO_VIDEO_PLAN.md
   §2); it reuses `pilot-demo-data.ts` for content. Do **not** run the local
   seed script on production — it targets the hub org directly.
