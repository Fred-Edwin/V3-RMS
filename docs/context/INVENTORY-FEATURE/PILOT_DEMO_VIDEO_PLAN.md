# Phase 1 Pilot Demo Video — Plan

Agreed with the project owner 2026-07-31. Phase 1 (Central Store — Store
Manager, Store Attendant) is functionally complete and about to be piloted
by the client for the first time. Before the pilot starts, the owner wants
to (1) deploy Phase 1 to production (merge to `main`), (2) record a demo
video walking the client through the full system so they can see progress
and understand the pilot before it begins, and (3) do this without ever
touching the client's real production data.

This file is the settled plan. Pick up here in a fresh session rather than
re-deriving it — the sequence and data-isolation approach are already
agreed, not open questions.

## Why a video, and why now

The owner is piloting Phase 1 with the client in the coming week and wants
to update them on progress. A demo video was chosen over a written update
because the client needs to *see* the multi-role workflow (Manager vs.
Attendant, desktop vs. mobile) to evaluate it — a changelog doesn't convey
that. Recording tools already available: OBS Studio (screen capture) and
DaVinci Resolve (edit) — CapCut is also installed but Resolve is the better
fit for a voiceover + screen-recording edit.

## Critical constraint: demo data must never touch real client data

The client's production database will hold real pilot data once the pilot
starts. The demo must not create, corrupt, or risk that data in any way,
and must be cleanly retractable after recording.

**Resolved approach:** seed the demo data into a **separate `Organization`
row** on the production database, not the client's real one.

- In this schema, `Organization` is the actual top-level tenant/account
  record (id 10 in `schema.prisma`) — it is *also* reused elsewhere in the
  app to represent a restaurant branch (has `address`/`city`/coordinates/
  `isHub`), which is why "org" initially read as ambiguous with "branch."
  Central Store itself is a `Location` row (type `CENTRAL_STORE`) that
  hangs *under* an Organization — it is not an Organization itself, and
  this plan does not make it one.
- Creating one new `Organization` row (its own id, own users, own
  inventory data — everything in this schema is scoped by
  `organizationId`) is a real, clean tenant boundary, not a hack. It does
  not touch, alias, or share any row with the client's real Organization.
- Teardown after recording is simple and safe: delete every row where
  `organizationId` = the demo org's id. Because the whole schema is scoped
  this way, this cannot leak into or affect the real org's data.
- The existing `seed-inventory-demo.ts` script **hard-exits if
  `NODE_ENV === 'production'`** — deliberately, so nobody accidentally
  seeds test data into a live client database by mistake. **Do not modify
  or bypass this guard** (no override flag, no `--force`). Instead: seed
  only ever runs against the new, isolated demo Organization — there is no
  reason to relax the safety check itself. (Exact mechanics of *how* the
  seed script targets a specific new org on the production DB — e.g.
  whether it takes an org-id argument, or is invoked via a one-off script —
  still need to be worked out in the follow-up session; not decided yet.)

## Data content: old seed data is discarded, not fixed

The existing `backend/src/scripts/seed-inventory-demo.ts` data (transcribed
from real client supplier-invoice photos, `docs/context/INVENTORY-FEATURE/inventory-real-data/`)
has corrupted/unrealistic prices — e.g. "210 Home Baking Flour 2kg" priced
near Ksh 1,449/kg, implausibly high, likely from a buyUnit/conversionFactor
mismatch against how the item is actually packaged and priced on the real
invoice. **Decision: do not debug/fix the old dataset — write a fresh one.**

- **Keep it grounded**: same real supplier names (Samrat Supermarket,
  Summer Limited) and real item names/packaging descriptions the client
  will recognize from their own invoices — just with corrected, realistic
  per-unit prices and sane buyUnit/conversionFactor pairings. Not a fully
  invented, generic dataset.
- **Seed everything, not just the setup layer** — explicit owner decision.
  The video is a "guided tour" through already-complete, realistic records,
  not a live data-entry demo. Every screen in the walkthrough below needs
  at least one populated, convincing example already sitting there before
  recording starts — including states mid-lifecycle (e.g. a DRAFT PO next
  to a fully RECEIVED one) so the video can show progression without
  performing every action live on camera.
- Realistic KES pricing per item still needs to be drafted — not done yet,
  first task of the follow-up session (see below).

## Locked walkthrough sequence

Agreed screen-by-screen with the owner, cross-checked against
`INVENTORY_FEATURE_PLAN.md` §8.1/§8.2 (the authoritative screen list) and
corrected twice against what was **actually built** (not the original spec
text, which drifted for two screens — see notes):

1. **Account creation** — Admin creates the Manager + Attendant accounts.
   (There is no self-serve org signup in this app — accounts are
   provisioned via the SYSTEM_ADMIN screen, `frontend/app/app/admin/page.tsx`.
   Showing this briefly answers the client's "how do we add staff" question
   up front rather than skipping straight to a pre-existing login.)
2. **Item Catalog + Suppliers** — Manager sets up items and suppliers.
3. **Prep Recipe** — Manager authors a recipe *first*. **Correction from
   the original spec**: §8.1 row 9 describes recipes as an optional
   "promote a completed Prep Record into a recipe" action; that flow was
   superseded during build (Session 7 was redirected to design freely
   against the design system — see `INVENTORY_PHASE1_SESSION_PLAN.md`
   Sessions 6-8 "As Built" notes) — the live code path is
   `createPrepRecipe` (Manager authors directly) +
   `getPrepRecipeByOutputItem` (Prep entry looks it up as a reference/
   pre-fill). Recipe must exist *before* step 8, not after.
4. **Draft PO** — Attendant creates a draft purchase order (mobile). Shows
   the Attendant-can-draft-but-not-send permission boundary.
5. **Send PO** — Manager sends it to the supplier (desktop). Manager-only
   action, shown right after the draft to make the permission split clear.
6. **Receive PO** — Attendant receives the delivery (mobile) — Attendant's
   core daily task.
7. **Stock on Hand** — shows the newly received stock reflected.
8. **Prep entry** — Attendant logs prep, referencing the recipe from step 3
   (rolling-average soft-reference hint shown, per D-12).
9. **Stock Count** — either role picks a scope and counts. **Correction
   from the original spec**: §8.1 rows 10/11 describe session creation as a
   separate Manager-only desktop planning step before execution; that was
   redesigned 2026-07-30 (`UI_UX_DESIGN_AUDIT.md`, §8.1 row 10 log) into one
   merged flow — pick scope → auto-labeled entry → mandatory review — that
   either role can start (`POST /stock-counts` RBAC widened to
   `bothRoles`). Attendant's count is blind (D-14, expected qty never
   shown) regardless of who started the session.
10. **Stock Count approval** — Manager reviews the variance (card-per-line,
    not the old bare table), corrects a miscounted line in place if needed
    (new Manager-only edit-before-approve capability, also from the
    2026-07-30 session), then approves.
11. **Waste Log** — an entry logged (either role can log; Manager-only can
    review the full log).
12. **Supplier AP** — Manager records an invoice and a payment, shows aging.
13. **Reports** — Manager's dashboard/reports view.
14. **Closing shot** — Attendant's Dashboard tab (new landing tab, built
    2026-07-30 — a natural "and here's where your floor staff start their
    day" closer).

## Follow-up session — resolved 2026-07-31

**Course correction on data grounding**: the original plan text above
("keep real supplier/item names the client will recognize") was
superseded during the follow-up session, per explicit owner instruction —
*"just use realistic items... don't replicate the real client data...
create synthetic data."* Suppliers and item names below are **fully
invented**, not derived from or resembling the client's real invoice
photos in `inventory-real-data/`. This intentionally narrows the original
"keep it grounded" data-content section above; treat this note as the
authoritative correction.

### 1. Item list — fully synthetic, realistic KES pricing

**Suppliers (invented):**

| Name | Contact | Phone | Email |
|---|---|---|---|
| Nyeri Highlands Wholesalers | Peter Kamau | 0711223344 | orders@nyerihighlands.example |
| Mt. Kenya Bulk Traders | Grace Wanjiru | 0722334455 | sales@mtkenyabulk.example |
| Aberdare Fresh Farm Supplies | Samuel Mwangi | 0733445566 | info@aberdarefresh.example |

**RAW — Nyeri Highlands Wholesalers (pantry/dry goods):**

| Item | buyUnit | usageUnit | conversionFactor | buyUnit price (KES) | per-usage-unit cost |
|---|---|---|---|---|---|
| Sunrise Cooking Oil | 20L jerrican | L | 20 | 5,200 | 260.00/L |
| Golden Crown Sugar | kg | kg | 1 | 160 | 160.00/kg |
| Highland Margarine | 10kg carton | kg | 10 | 3,100 | 310.00/kg |
| Savanna Soy Sauce 620ml | bottle | ml | 620 | 360 | 0.58/ml |
| Millers Choice Baking Flour | 50kg bag | kg | 50 | 4,000 | 80.00/kg |
| Nyeri Brown Sugar | kg pkt | kg | 1 | 240 | 240.00/kg |
| Bakers Best Dry Yeast 500g | pouch | g | 500 | 420 | 0.84/g |
| Highland Tea Leaves 500g | pkt | g | 500 | 280 | 0.56/g |

**RAW — Mt. Kenya Bulk Traders (condiments/packaging supplies):**

| Item | buyUnit | usageUnit | conversionFactor | buyUnit price (KES) | per-usage-unit cost |
|---|---|---|---|---|---|
| Zenith Yellow Mustard 240g | bottle | g | 240 | 190 | 0.79/g |
| Zenith Mayonnaise 340g | bottle | g | 340 | 260 | 0.76/g |
| Garden Fresh Mushroom 400g | pkt | g | 400 | 260 | 0.65/g |
| ClearWrap Cling Film 30x300m | roll | roll | 1 | 700 | 700.00/roll |
| Breeze Air Freshener 100ml | can | can | 1 | 140 | 140.00/can |
| PureSip Bottled Water 1L | ctn (12x1L) | bottle | 12 | 390 | 32.50/bottle |
| SoftTouch Tissue Wrapped | ctn (10pack) | pack | 10 | 1,200 | 120.00/pack |
| Sparkle Multipurpose Soap | ctn (10x1kg) | kg | 10 | 1,550 | 155.00/kg |
| Golden Pastry Flour 2kg | bale (12x2kg) | kg | 24 | 1,900 | 79.17/kg |
| Teatime Mandazi Bites 100g | box (72x100g) | pc | 72 | 2,000 | 27.78/pc |

**RAW — Aberdare Fresh Farm Supplies (fresh/perishables):**

| Item | buyUnit | usageUnit | conversionFactor | buyUnit price (KES) | per-usage-unit cost |
|---|---|---|---|---|---|
| Aberdare Fresh Milk | L | L | 1 | 78 | 78.00/L |
| Highland Chicken Breast | kg | kg | 1 | 490 | 490.00/kg |
| Aberdare Fresh Eggs (Tray of 30) | tray | pc | 30 | 460 | 15.33/pc |
| Aberdare Natural Yoghurt Cup 450ml | cup | ml | 450 | 175 | 0.39/ml |

**PREPPED (Central Store output):** Prepped Simple Syrup — buyUnit/usageUnit
L, conversionFactor 1, reorderLevel 3.

**Department tags:**
- KITCHEN: Sunrise Cooking Oil, Golden Crown Sugar, Highland Margarine, Savanna Soy Sauce, Millers Choice Baking Flour, Nyeri Brown Sugar, Zenith Yellow Mustard, Zenith Mayonnaise, Garden Fresh Mushroom, Golden Pastry Flour 2kg, Aberdare Fresh Milk, Highland Chicken Breast, Aberdare Fresh Eggs, Aberdare Natural Yoghurt
- PASTRY: Highland Margarine, Bakers Best Dry Yeast, Golden Pastry Flour 2kg, Aberdare Fresh Eggs, Aberdare Natural Yoghurt
- BARISTA: Golden Crown Sugar, Nyeri Brown Sugar, Highland Tea Leaves, Aberdare Fresh Milk, Prepped Simple Syrup
- SERVICE: ClearWrap Cling Film, PureSip Bottled Water, Teatime Mandazi Bites
- HOUSEKEEPING: Breeze Air Freshener, SoftTouch Tissue, Sparkle Multipurpose Soap

Every implied per-unit cost is sanity-checked (price ÷ conversionFactor)
against plausible Nyeri-market ranges — no item implies an absurd
per-unit cost the way the old flour/soap bug did. This fully replaces
(does not patch) the old `seed-inventory-demo.ts` `SAMRAT_ITEMS` /
`SUMMER_ITEMS` / `PLACEHOLDER_RAW_ITEMS` — new script entirely (see §2).

### 2. Production seeding mechanics

**Constraint:** `seed-dev.ts` and `seed-inventory-demo.ts` both hard-exit
when `NODE_ENV === 'production'`, per the locked guard — untouched.

**Decision: one new script, `seed-pilot-demo.ts`** — allowed to run in
production, self-contained (doesn't depend on `seed-dev.ts` or
`seed-inventory-demo.ts`). Creates the isolated demo Organization +
CENTRAL_STORE Location + STORE_MANAGER/STORE_ATTENDANT users, then seeds
the full synthetic catalog + transaction history from §1/§3 in the same
run. Reusing the two existing scripts was rejected: `seed-dev.ts` acts on
*every* active org (wrong — we want exactly one new org), and
`seed-inventory-demo.ts` finds "first `STORE_MANAGER` org-wide" (unsafe in
production once the client's real org also has one).

**Identification:** `Organization.name = "Wendo Coffee Bistro — PILOT
DEMO"`. Seed script prints the created org's `id` to stdout at the end —
required as an explicit `--org-id=<id>` arg to teardown (name-match alone
is too easy to fat-finger against the wrong row). `kraPIN`/`phone`/etc.
left blank/placeholder.

**Guards:**
- Requires `NODE_ENV === 'production'` explicitly (inverted from the
  other two — this script *only* runs in production; local dev already
  has `seed-inventory-demo.ts`).
- Idempotent: re-running finds the existing org by name, skips
  org/location/user creation, only upserts catalog (safe re-run/top-up).
- Requires `SEED_PILOT_DEMO_CONFIRM=YES` env var to run at all, same
  pattern as `seed-report-orders.ts`'s `SEED_REPORTS_CONFIRM=YES`.

**Invocation (production server, after CI/CD deploy):**
```bash
cd ~/wendo-rms
docker compose exec api sh -c "SEED_PILOT_DEMO_CONFIRM=YES node dist/scripts/seed-pilot-demo.js"
```
Prints the org id and both login credentials at the end.

**Teardown:** a second script, `teardown-pilot-demo.ts`, production-only,
same `SEED_PILOT_DEMO_CONFIRM=YES` gate, plus a required `--org-id=<id>`
arg:
```bash
docker compose exec api sh -c "SEED_PILOT_DEMO_CONFIRM=YES node dist/scripts/teardown-pilot-demo.js --org-id=<the-id-printed-above>"
```
Looks up the org by id, **asserts `name` equals exactly `"Wendo Coffee
Bistro — PILOT DEMO"`** before deleting anything, then deletes every row
scoped by that `organizationId` in FK-safe order inside one
`prisma.$transaction`, printing per-table row counts.

**Confirmation checkpoints (per ground rules, not yet executed):**
running `seed-pilot-demo.ts` on the server, and running
`teardown-pilot-demo.ts` after recording — both need explicit go-ahead
each time, even though it's the isolated demo org.

### 3. Walkthrough data — concrete records per step

Demo accounts: `manager.demo@wendo-pilot.test` / `attendant.demo@wendo-pilot.test`,
password `PilotDemo2026!` (SYSTEM_ADMIN uses the existing real prod admin
account for step 1, no separate demo admin).

1. **Account creation** — live action: real SYSTEM_ADMIN creates the two
   demo accounts above on camera.
2. **Catalog + Suppliers** — pre-seeded: all 3 suppliers + full 23-item
   catalog, linked via `SupplierItem`. Show Mt. Kenya Bulk Traders detail
   (10 linked items, the most of the three).
3. **Prep Recipe** — pre-seeded `PrepRecipe` "Simple Syrup — Standard
   Batch", output Prepped Simple Syrup, expected yield 10L, input Golden
   Crown Sugar 5kg.
4. **Draft PO** (Attendant, mobile) — pre-seeded PO `PO-DEMO-001`, status
   DRAFT, supplier Nyeri Highlands Wholesalers: Highland Margarine ×3 @
   3,100, Bakers Best Dry Yeast ×5 @ 420.
5. **Send PO** (Manager, desktop) — same PO, live action: DRAFT → SENT.
6. **Receive PO** (Attendant, mobile) — a **second** pre-seeded PO
   `PO-DEMO-002`, status SENT, supplier Aberdare Fresh Farm Supplies:
   Aberdare Fresh Milk ×40 @ 78, Highland Chicken Breast ×15 @ 490. Live
   action: SENT → CLOSED.
7. **Stock on Hand** — natural continuation of step 6, no separate seed.
8. **Prep entry** (Attendant) — live action: log Simple Syrup batch,
   actualYield 9.7L, input Golden Crown Sugar 5kg (pre-seed an opening
   receive of 50kg Golden Crown Sugar so stock is sufficient). Pre-seeded
   **prior** PrepRecord (actualYield 10.2L, same inputs, a few days
   earlier) so the rolling-average hint has real history to show.
9. **Stock Count** — pre-seeded `StockCount`, IN_PROGRESS, label "Weekly
   Spot Count — Pantry", scope: Golden Crown Sugar, Highland Margarine,
   Millers Choice Baking Flour, Nyeri Brown Sugar, Highland Tea Leaves.
   Live action: Attendant submits blind counts with one deliberate
   miscount — Nyeri Brown Sugar counted 18kg vs. expected ~22kg.
10. **Stock Count approval** — continuation of step 9: Manager corrects
    the Nyeri Brown Sugar line to ~21.5kg in place, then approves.
11. **Waste Log** — pre-seeded: Aberdare Fresh Milk, 3L, SPOILED, "Discovered
    during morning fridge check, past use-by date," dated the day before
    recording (distinct from step 6's freshly-received milk).
12. **Supplier AP** — pre-seeded 3-invoice portfolio spanning aging
    buckets: Nyeri Highlands Wholesalers (18,400, 10 days old, partial
    payment 10,000 MPESA), Aberdare Fresh Farm Supplies (12,150, 35 days
    old, unpaid/overdue), Mt. Kenya Bulk Traders (6,300, 14 days old,
    fully paid CARD). Live action: Manager adds a 5,000 top-up payment to
    the Nyeri Highlands invoice.
13. **Reports** — read-only over everything above; confirm before
    recording that seed dates fall inside the report's default date-range
    filter (recommend clustering seed dates within ~2 weeks of recording
    day, computed relative to `new Date()` at seed time rather than
    hardcoded calendar dates, so the data doesn't go stale if recording
    slips).
14. **Closing shot** — Attendant Dashboard tab, populated for free from
    steps 4/6/8/9's activity, no separate seed.

### 4. Shot list / video script outline

Full-walkthrough cut (not highlights-only) — client needs to see the
whole system to evaluate the pilot. Est. runtime ~9–13 min. OBS Studio
1080p capture, DaVinci Resolve edit, narration dubbed after capture
(recommended over live narration, so it doesn't fight UI timing). Both
roles' mobile/desktop views shown — that permission/device split is the
actual product, not padding: Attendant mobile for steps 4, 6, 8, 9, 14;
Manager desktop for steps 1, 2, 3, 5, 10, 12, 13.

| # | Step | Device | Action |
|---|---|---|---|
| 1 | Account creation | Desktop | Live: create Manager + Attendant accounts |
| 2 | Catalog + Suppliers | Desktop | Static: catalog list → Mt. Kenya Bulk Traders detail |
| 3 | Prep Recipe | Desktop | Static: open Simple Syrup recipe |
| 4 | Draft PO | Mobile | Static: show draft, no Send button visible |
| 5 | Send PO | Desktop | Live: Send |
| 6 | Receive PO | Mobile | Live: Receive |
| 7 | Stock on Hand | Mobile/Desktop | Static: updated milk/chicken qty |
| 8 | Prep entry | Mobile | Live: log Simple Syrup batch |
| 9 | Stock Count | Either | Live: pick scope, submit blind count incl. miscount |
| 10 | Stock Count approval | Desktop | Live: correct flagged line, approve |
| 11 | Waste Log | Desktop | Static: spoiled milk entry |
| 12 | Supplier AP | Desktop | Live: record a payment |
| 13 | Reports | Desktop | Static: scroll dashboard |
| 14 | Closing | Mobile | Static, hold 2–3s: Attendant Dashboard tab |

Live-action shots (1, 5, 6, 8, 9, 10, 12) recorded at natural speed — the
point is showing the system actually works. Static shots get a slow
scroll/pan, 3–5s each. Transition each desktop↔mobile switch with a beat
of blank/logo card in Resolve.

**Still open:** narration is currently a beat list (tone/topic per shot),
not verbatim script — owner to decide whether to script it word-for-word
or narrate off-the-cuff on recording day using the beats as a cue sheet.

### Not yet built

None of `seed-pilot-demo.ts` / `teardown-pilot-demo.ts` exist yet — this
section is the plan for them, not an implementation status. Next step is
writing the actual scripts, once the owner confirms proceeding.

## Deployment note

Owner's plan: push Phase 1 to `main` (triggers the existing GitHub
Actions → DigitalOcean CI/CD pipeline per `CLAUDE.md`'s deployment model)
*before* seeding demo data or recording — the video should show the real
deployed pilot environment, not a local dev instance, for credibility with
the client ("this is what you're piloting").
