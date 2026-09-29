# Milestone Six — Session 1 (Stock position & waste) — Build Plan

## Paste this into a fresh Claude Code session

> You are the build agent for Wendo RMS, Milestone Six, **Session 1 — Stock
> position & waste**. Your brief is
> `docs/features/inventory/milestone-6-sessions/session-1-plan.md`. Read it
> top to bottom before touching code, then follow it in order. The
> decisions in it are settled — don't re-open them. If something in it turns
> out wrong once you're in the code or in Paper, fix it and write the
> correction into the outcome log; never silently work around it.

---

## Handoff note (read first)

This plan was written after the Milestone Six design pass (2026-09-24/25),
which fixed the Paper gaps, added the new states, drew the Thresholds screens
and replaced per-screen loading/empty/error artboards with a **States kit**.
Every node ID you need is in this file and in `milestone-6-plan.md` §0.

**Read, in this order (only the sections named):**
1. `CLAUDE.md` — whole file (non-negotiables, pnpm, Linux shell).
2. `docs/features/inventory/milestone-6-plan.md` — Context, §0 (Session 1
   table), **§0.1 (states table)**, §1.3 `WasteLog`, §1.7 ledger additions,
   §1.10 migration plan, **§2.1 (your endpoints)**, **§4 (build gate —
   binding)**, §5 module placement, §7 decisions + Q-A.
3. `docs/FEATURE_REDO_PLAYBOOK.md` §9 (module layout) and
   `docs/CODING_STANDARDS.md` §4 / §9 when you start backend / frontend.
4. `docs/DESIGN_SYSTEM.md` — token + component sections you touch.

**Paper:** file `01M1ZZJ6S3FZGF5C7PPBGTKY89`, page `p-G-0`. Load the Paper
guide once (`get_guide({ topic: "paper-mcp-instructions" })`). Take values
from `get_jsx` / `get_computed_styles`, never from screenshots. Layers named
`REMOVED (A#) …` are intentionally hidden — don't build them (one exception
below: the SM mobile hub).

---

## Context

Session 1 of 4. It ships the **stock position** (hub, All items, ledger), the
**waste** flow, and makes the existing **restock levels** reachable from the
new Stock & counts area. No counting yet — that's Session 2.

**Demo at the end:** the Store Manager opens Stock & counts, browses live
stock (All items, filters, a ledger), logs waste from the drawer, and sees the
entry land in the ledger and on the hub's Waste card and KPIs. The attendant
logs waste on mobile and sees no quantities anywhere. A Department Head logs
waste from their landing page.

---

## Decisions already made (do not re-litigate)

**From the plan (§7, owner-confirmed):**
- **Blind count starts here:** the Store Attendant sees **no on-hand
  quantity anywhere** — not on the hub, not in the waste item picker hint
  (cost only), no ledger access (403). Enforced **server-side**: the
  attendant's responses are separate Zod schemas without those fields, not a
  filtered UI.
- Waste location is resolved **server-side from the actor** (SM/Attendant →
  Central Store; DH → their department location). Never trust a client
  location. Negative stock is allowed and flagged (Flow 21).
- Ledger running balance is a SQL window function, not JS. The ledger's
  "counterparty" text is **derived from whichever FK is set** — no new
  free-text column.
- `InventoryTransaction.reference` (`ADJ-####`) and `reversesTransactionId`
  are added in this session's migration but first **used** in Session 2/3.
- Loading / empty / error are built from the **States kit** (`1I6L-0`) +
  `milestone-6-plan.md` §0.1 copy, reusing `components/app/shell/shell-states.tsx`
  (`EmptyState` / `ErrorState`) and ui2 `Skeleton`. There are no per-screen
  state artboards; the three worked examples are `1FG7-0`, `1G39-0`, `1I1M-0`.
- No offline queue anywhere in this milestone.

**Owner decisions for this session (2026-09-25):**
1. **Session-2 features render disabled.** The Thresholds top-bar button,
   the **Daily count** and **Spot count** sidebar sub-links, and the hub's
   Counts card are drawn exactly as in Paper but disabled, with a tooltip
   "Coming with counting". The Counts card and "Today's count" KPI show their
   *no count yet* state. (Same pattern as the disabled placeholders already on
   the DH landing.) Session 2 switches them on.
2. **SM on mobile has its own hub artboard: `1J43-0`** ("1 · Stock & counts
   hub · Store Manager mobile"). Same screen as the Attendant's `188X-0`,
   role-aware in code:
   - **Attendant (`188X-0`):** Daily count · Log waste · Restock levels,
     Today's count card, Waste list. No quantities anywhere.
   - **Store Manager (`1J43-0`):** 2×2 actions Spot count (primary) · Log
     waste · Restock levels · Thresholds; subtitle carries on-hand value +
     item count; Today's count card ("waiting for your verification");
     Low stock + Negative KPI cards; On hand list (rows → ledger, "View all
     N items →"); Waste list. Spot count and Thresholds are disabled in S1
     (decision 1). Build one component with a role switch, not two screens.
3. **One session with a hard checkpoint** after the backend (see "Checkpoint"
   below).

---

## Screens this session builds

| # | Screen / state | Paper node(s) | Device | Route (thin shell in `app/`) |
|---|---|---|---|---|
| 1 | Stock & counts hub · SM | `1AYW-0` (loading example `1FG7-0`) | desktop | `/app/inventory/stock` |
| 2 | Stock & counts hub · mobile — Attendant / SM (decision 2) | `188X-0` / `1J43-0` (empty example `1G39-0`) | mobile | `/app/inventory/stock` |
| 3 | All items | `1B5U-0` / `1BRS-0` | desktop / mobile | `/app/inventory/stock/items` |
| 4 | Stock ledger · item selected | `197U-0` (SM, hub scope) / `1BPY-0` (DH, own dept) | desktop / mobile | `/app/inventory/stock/ledger/[itemId]`, `/app/branch/ledger/[itemId]` |
| 5 | Stock ledger · no item selected | `1F7B-0` / `1FDY-0` | desktop / mobile | `/app/inventory/stock/ledger`, `/app/branch/ledger` |
| 6 | Restock levels · Central Store | `18ZV-0` (drawer) / `1BV6-0` (mobile) | drawer / mobile | drawer over the hub; mobile route alongside |
| 7 | Restock levels · Department | `1AEE-0` | mobile | **already built (M1)** — parity check only |
| 8 | Log waste · Central Store (SM + Attendant) | `18VZ-0` (drawer) / `1BX0-0` (mobile; attendant hint = cost only) | drawer / mobile | drawer over the hub; mobile full-screen |
| 9 | Log waste · Department | `1ACM-0` | mobile | `/app/branch/waste/new` — wire the DH landing "Log waste" placeholder (`features/requisitions/components/screens/department-landing-screen.tsx` ~L176–207) |
| 10 | Sidebar sub-links under Stock & counts | ref `1BI5-0` inside `1AYX-0` | desktop | every Stock & counts page: `1AYW-0`, `1B5U-0`, `197U-0`, `18VZ-0`, `18ZV-0` now; `181V-0`, `18GE-0`, `1BC1-0` in S2 |
| 11 | Top-bar action set | `1B18-0` (inside `1AYW-0`) | desktop | Thresholds (disabled, decision 1) · Restock levels · Log waste · Spot count (links to S2 page — disabled until then) |
| — | Loading / empty / error for 1–9 | States kit `1I6L-0` + plan §0.1 rows | both | — |

The existing `restock-levels-screen.tsx` and `restock-level-grid.tsx` (M1)
are reused for #6 — wrap them in the drawer shell and the mobile layout; don't
rewrite the grid. The inventory shell nav item "Stock & counts" currently has
`href: '#'` (`features/inventory/components/inventory-shell.tsx`) — this
session makes it live and adds the sub-link rail (spec:
memory/`project_sidebar_sublink_pattern` if available, otherwise `get_jsx` on
`1BI5-0`).

---

## Backend build order

Work in `backend/src/modules/inventory/` as `stock-*` and `waste-*` siblings
(plan §5). Every route: `authenticate` + `requireRole`, Zod input, every
repository query org-scoped. Business logic in services only.

1. **Housekeeping backfill (first, before any new docs):**
   `docs/API_CONTRACT.md` has no §25 (Milestone Five) and `DATA_MODEL.md` has
   no `Dispatch` / `DispatchLine` / `Discrepancy` entries. Write both from
   the shipped Milestone Five code (`modules/dispatch*` + its migrations) so
   numbering stays honest. Then add this session's §26.1 and the §4.66+
   `WasteLog` entry.
2. **Migration (S1, additive only):** `WasteLog` table (plan §1.3: reason
   enum `SPOILAGE | EXPIRY | DAMAGE_IN_STORE | PREP_ERROR`, `unitCost` rule,
   `loggedById`); turn `InventoryTransaction.wasteLogId` into a real FK (it is
   an unlinked nullable column today — see the comment above it in
   `schema.prisma`); add `reference String?` and `reversesTransactionId
   String?` (self-relation). Follow the CLAUDE.md migration workflow
   (`prisma migrate dev` locally, commit the SQL).
3. **Endpoints (plan §2.1):**
   - `GET /inventory/stock` (STORE_MANAGER) — page-based list + `attention=true`.
   - `GET /inventory/stock/summary` — STORE_MANAGER gets the full summary;
     **STORE_ATTENDANT gets `{todaysCount}` only**, from a separate response
     schema. `todaysCount` returns its *no count yet* shape until S2.
   - `GET /inventory/stock/items/:itemId/ledger` — STORE_MANAGER (hub),
     MANAGER (own branch departments), DEPARTMENT_HEAD (own department);
     **STORE_ATTENDANT → 403**. Window-function running balance.
   - `POST /inventory/waste` — STORE_MANAGER, STORE_ATTENDANT (hub),
     DEPARTMENT_HEAD (own department). `WasteLog` + negative `WASTE` ledger
     row in one `prisma.$transaction`.
   - `GET /inventory/waste?days=7` — entries + total value.
   - `GET/PUT /inventory/restock-levels` — existing; confirm Central Store
     scope works for the SM drawer, no contract change expected.
   - **Verify the waste item picker's data source for the attendant.** If the
     combobox reads an existing catalog/stock endpoint that returns on-hand
     to STORE_ATTENDANT, give the attendant a projection without it (cost
     only). Add this to the blindness contract test below.
4. **Tests (plan §4.5):**
   - Service unit tests: waste writes one negative row per entry, negative
     stock allowed and flagged, department `unitCost` falls back correctly,
     location never taken from the client.
   - Contract tests freezing every response schema (`stock-contract.test.ts`,
     `waste-contract.test.ts`).
   - **Blindness test:** serialize every STORE_ATTENDANT-facing response in
     this session (summary, waste list, waste item picker) and assert no
     `onHand` / `expectedQty` / variance key exists — on the JSON, not the TS
     type.
   - Org-scoping: DH can't read or write another department; MANAGER can't
     reach another branch; attendant ledger → 403.
5. `pnpm build && pnpm test` green → **commit (backend)**.

### Checkpoint (hard stop before frontend)

After the backend commit, append a short handoff to this file under
"Outcome log": what shipped, endpoint list with example responses, anything
that deviated from §2.1 and why, and the seed state. If your context is below
about 40%, stop here and tell the owner — a fresh session picks up the
frontend from that handoff.

---

## Frontend build order

Hub screens, ledger, waste and restock in `frontend/features/inventory/`;
the DH waste screen is imported by the requisitions landing through
`features/inventory/index.ts` only. Pages in `app/` are thin shells.

**At the start:** load `emil-design-eng` (motion/interaction bar). While
writing components: `building-components`, `vercel-composition-patterns`.
Audit step of each gate: `web-design-guidelines`. Browser: `run-frontend-browser`
(chrome-devtools MCP).

1. **Shared pieces first**
   - Sidebar sub-link rail (curved connector, active state = white 500,
     inactive = caramel-300 at 85%); "Daily count" / "Spot count" disabled
     per decision 1.
   - Top-bar action set component (Thresholds disabled · Restock levels ·
     Log waste · Spot count disabled until S2).
   - State pieces from the States kit on top of `shell-states.tsx` +
     `Skeleton`: desktop table row, list row, short row, KPI "—" + sub-line
     bar, mobile list row, mobile movement row, status card, page error card,
     empty card (±action), in-drawer error banner. Build once, reuse
     everywhere.
2. **Screens, in demo order:** hub SM desktop → hub mobile (Attendant + SM
   variant) → All items (desktop, mobile) → ledger item-selected (SM desktop,
   DH mobile) → ledger no-item (desktop, mobile) → restock (drawer, mobile) +
   DH parity check → log waste (drawer, CS mobile incl. attendant cost-only
   hint, DH mobile).
3. **Wiring:** nav "Stock & counts" live; DH landing "Log waste" live; after a
   waste submit the hub Waste card + KPIs refresh (`HighlightOnChange` on
   changed numbers); toasts.
4. `pnpm build` (incl. `check-wds-tokens`) green → **commit (frontend)**.

### The per-screen gate — plan §4.4, every state, before the next

Implement from `get_jsx`/`get_computed_styles` → screenshot Paper → screenshot
live (same viewport, same state, real seeded data) → **eyeball** side by
side (no automated pixel-diff — standing rule) → interaction audit → run
`web-design-guidelines` → fix → re-check → record in the outcome log. A state
isn't done until the eyeball, interaction and guidelines steps all pass.
Loading / empty / error for each screen go through the same gate against the
States kit pieces and the §0.1 copy.

**Interaction checklist — §4.2 baseline applies to every screen, plus:**

| Screen | Screen-specific interactions (tick each in the browser) |
|---|---|
| Hub (SM) | KPI cards clickable → pre-filtered All items; attention-table filter chips; top-bar Restock / Log waste open drawers; disabled items show the "Coming with counting" tooltip and are not focus traps |
| Hub (mobile) | action buttons with press state (Attendant 3, SM 2×2 with Spot count + Thresholds disabled in S1); SM: On hand rows → ledger, "View all N items →"; Attendant: no row is a link |
| All items | debounced search (250ms) with clear; filters combine; pagination keeps filters; URL reflects filters; row → ledger; empty = "No items match these filters" + Clear filters |
| Stock ledger | date-range toggle group; type select; `highlight` row one-time caramel fade + scroll into view; pagination; empty range = "Show 30 days" |
| Ledger (no item) | search focused on load; recently-viewed rows → ledger |
| Restock levels | inline numeric edit; changed rows marked; live "flags it low right away" note; Save disabled until dirty; dirty-guard on close; save error = in-drawer banner, edits kept |
| Log waste | item combobox with hint (SM: on-hand + cost; Attendant: cost only); stepper; reason chips single-select, required; waste value recalculates live with number transition; submit → toast + drawer closes + hub refresh; submit error = banner at top (example `1I1M-0`), entry kept |
| Sidebar / top bar | active sub-link matches the route; drawer triggers return focus on close |

---

## Seed data for the gate

Live screens must be compared in the same state as Paper. Seed (extend
`backend/src/scripts/seed-inventory-catalog.ts` or add a dev fixture script
like `seed-dispatch-dev-fixtures.ts`, never against production):
- Central Store items and values matching `1AYW-0` / `1B5U-0`: Milk 128 L
  (restock 80, cost 65), Cooking oil 46 L (40, 320), Coffee beans 12 kg (25,
  1,180), Chicken stock 18 L (15, 240), Rice 210 kg (120, 145), Tomatoes
  −4 kg (30, 90), Flour 64 kg (50, 78); 142 items total so pagination shows
  "Page 1 of 18".
- Waste over the last 7 days totalling KES 2,140 (Milk 6 L spoilage KES 390,
  Tomatoes 3 kg spoilage KES 270, Croissants 4 pcs expiry KES 360, Cream 1 L
  damage KES 180, Bread 12 pcs prep error KES 940).
- Coffee beans ledger rows matching `197U-0` (receive +25, dispatch −6, waste
  −2, adjustment −17 → 12 kg); Kitchen (Nyeri Town) Grilled chicken portion
  rows matching `1BPY-0`.
- Users: a STORE_MANAGER (Joseph Mwangi), a STORE_ATTENDANT (Sarah Achieng),
  a DEPARTMENT_HEAD for Kitchen, Nyeri Town.

---

## Definition of done

- The demo in "Context" works end to end in a real browser for SM, Attendant
  and DH.
- Every screen/state in the table passed its gate and is recorded in the
  outcome log.
- Postgres checks (Postgres MCP): Σ ledger per (location, item) equals what
  All items and the ledger show; every `WASTE` row created this session has a
  `waste_log_id` pointing at a `WasteLog`; no attendant-facing response
  contains on-hand (the contract test passes).
- `backend: pnpm build && pnpm test` and `frontend: pnpm build` green.
- Two commits minimum (backend, frontend), each ending with the attribution
  line from the session's system reminder. Don't push unless the owner asks.
- `milestone-6-plan.md` §8 outcome log appended; `MILESTONES.md` updated
  (Session 1 status); this file's "Outcome log" filled in.

---

## Outcome log

_(filled in by the build session — checkpoint handoff first, then one line
per screen/state gate, then the end-of-session summary)_

### Checkpoint handoff — backend (2026-09-25, commit `ea82101`, branch `feat/m6-s1-stock-waste`)

**Shipped.** Migration `20260925090000_milestone6_session1_waste_log`
(additive: `WasteLog` + `WasteReason`, `InventoryTransaction.wasteLogId` →
real FK, `reference`, `reversesTransactionId` `@unique` self-FK, index
`(location_id, inventory_item_id, created_at)`). Module files in
`backend/src/modules/inventory/`: `stock-{validators,types,repository,scope,service,controller,routes}`,
`waste-{validators,types,repository,service,controller,routes}`. Docs:
`API_CONTRACT.md` §25 (M5 backfill) + §26.1, `DATA_MODEL.md` §4.66–4.68
(M5 backfill) + §4.69 `WasteLog` + §4.52 ledger update. `pnpm build` +
`pnpm test` green (82 files, 1,031 tests; 35 new).

**Endpoints (example responses from the seeded local DB):**
- `GET /inventory/stock?attention=true` (SM) → `{rows:[{itemId, name:"Tomatoes", type:"RAW_INGREDIENT", category:{…"Produce"}, onHand:"-4", usageUnit:"kg", restockLevel:"30", currentCost:"90", value:"-360", isLow:true, isNegative:true}, …7 rows], total:7, page:1, pageSize:8, pageCount:1}`; without `attention` → `total:142, pageCount:18`.
- `GET /inventory/stock/summary` SM → `{onHandValue:"1676832", itemCount:142, lowCount:1, negativeCount:1, todaysCount:{status:"NOT_STARTED", countId:null, submittedAt:null, submittedByName:null}}`; Attendant → `{todaysCount:{…}}` only.
- `GET /inventory/stock/items/:itemId/ledger` → `{summary:{itemName, usageUnit, categoryName, onHand, currentCost, currentCostSince, value, restockLevel, isLow, location:{id,name,departmentTag,branchName}, lastMovementAt}, rows:[{id, at, type:"RECEIVE", counterparty:"Samrat Suppliers Ltd", qty:"25", runningOnHand:"37", reference:"GRN-00xx"}, …], total, page, pageSize, pageCount}`. Attendant → 403; DH other dept → 403; MANAGER other branch → 403.
- `POST /inventory/waste` `{inventoryItemId, quantity:"3", reason:"SPOILAGE", note?}` → SM/DH `{entry:{…value:"270"}, onHandAfter:"-4", wentNegative:true}`; Attendant `{entry}`. A `locationId` in the body → 400 (strict schema).
- `GET /inventory/waste?days=7` → `{days:7, entries:[…5], totalValue:"2140"}`.
- `GET /inventory/waste/items?search=` → SM/DH `{items:[{itemId,name,usageUnit,unitCost,onHand}]}`; Attendant the same without `onHand`.

**Deviations from plan §2.1 (and why):**
1. **New `GET /inventory/waste/items`** (the picker). The plan said to
   verify the picker's source: `/inventory/items` has no on-hand, but also
   no department carried-in cost and no role-split projection — the DH hint
   needs the dept cost, the SM hint needs on-hand, the attendant must get
   neither on-hand nor a shared schema. Added to the blindness test.
2. **Ledger additions:** `currentCostSince` ("latest-price, set 8 Sep" on
   `197U-0`), `lastMovementAt` (the empty-range copy's "since {date}"),
   paging fields; rows oldest-first as drawn. Range is `from`/`to`; the
   frontend maps the 7/30/90/All toggle onto it.
3. **`WasteLog.organizationId`** added (not in §1.3's sketch) so every query
   is org-scoped (Non-Negotiable #3).
4. **`reversesTransactionId` is `@unique`** — a row is reversed at most once
   (1:1 self-relation).
5. **Attention subset defined:** negative or has a restock level; negative
   first, then on-hand ÷ restock ascending. `lowCount` excludes negatives
   (they're the Negative KPI). The Paper table order is not an ordering
   rule, so live order differs (Tomatoes, Coffee beans, Cooking oil, …).
6. **DATA_MODEL numbering:** the M5 backfill took §4.66–4.68, so `WasteLog`
   is §4.69 (plan said "§4.66+"). `PrepRun(+InputLine)` (M3) is still
   undocumented there — not in this session's brief; flagged for the owner.
7. `prisma migrate dev` refuses non-interactive shells, so the SQL was
   generated with `prisma migrate diff --from-schema-datasource
   --to-schema-datamodel --script` into a timestamped folder and applied
   with `migrate deploy` — same committed artifact, same prod path.

**Seed state** (`npx tsx src/scripts/seed-stock-waste-dev-fixtures.ts`,
dev-only, idempotent; run after `seed-dev`, `seed-inventory-catalog`,
`seed-dispatch-dev-fixtures`): SM renamed Joseph Mwangi, attendant Sarah
Achieng, DH = `chef1.nyeritown@dev.test` (Kitchen, Nyeri Town); all
`password123`, PIN 1234. The seven Paper items at the Paper figures; 142
live hub items; waste 7d = KES 2,140 (five entries); Coffee beans ledger
(real GRN from Samrat Suppliers Ltd, real Dispatch to Nyeri Town · Barista,
waste, adjustment → 12 kg) dated 8–12 days ago so the 7-day waste total
stays 2,140 — compare `197U-0` with the **30 days** toggle; Nyeri Town
Kitchen Grilled chicken portion in +14 / adjustment −5 → 9 pcs. To match
the Paper attention table the script clears Central Store restock levels
outside the Paper set and tops negative non-Paper items back to zero. The
on-hand KPI reads ~KES 1.68M (earlier dev receipts of Zesta sauces at
KES 100), not Paper's 486K — real derived data, left as is. The adjustment
counterparty "Daily count · verified by J. Mwangi" comes from the row's
`reason` text in the fixture until S2 derives it from `stockCountLineId`.

**Postgres checks so far:** 6 `WASTE` rows, 0 without a `WasteLog`, 0
`WasteLog`s without exactly one equal-and-opposite ledger row.

**Context at checkpoint:** plenty remaining — continuing to the frontend in
this session.

### Session paused mid-frontend (2026-09-25) — continue from `session-1-frontend-handoff.md`

Frontend partly built and uncommitted on `feat/m6-s1-stock-waste`. Gates
passed so far: sidebar sub-links, top bar, hub SM desktop (+ loading /
error), Log waste CS drawer (+ submit error, in-flight). Built but not yet
fully gated: hub SM mobile (`1J43-0`), hub Attendant mobile, Log waste CS
mobile. Not started: All items, ledger (both), restock upgrade, DH waste
page. Status table, next step, lessons and pending deviations are in the
handoff file.

### Frontend gates — continued session (2026-09-29)

_One line per screen/state gate (eyeball vs Paper → interaction audit → `web-design-guidelines` → fix → re-check)._

- **Seed drift (dev DB only):** the fixture's waste history is written once with fixed dates, so by 2026-09-29 three of the five Paper waste entries had aged out of the 7-day window (hub read KES 1,075). Re-dated those five `WasteLog`s + their `WASTE` ledger rows +4 days on the local DB so the gate compares against the intended state. No code change; a future session running the gate days later will hit the same drift.
- **Hub · Attendant mobile (`188X-0`) — passed.** Fixed: actions were a wrapping 2+1 grid → one row of three equal columns (Paper `basis 0 / grow 1 / p 12px`); rows/buttons had 20px leading → 16px (waste rows now 41/39/38px, buttons 58px, exactly Paper). Fixed in `HintTooltip`: on touch a tap never focused the `aria-disabled` trigger so the hint never showed (tap now focuses it → `focus-within` opens the hint); a centred hint on the right-edge button overflowed the viewport by 8px and created a horizontal scroll strip in `main` (new `align` prop, `end` on right-column buttons, origin follows the anchor); `side="top"` hints were clipped under the header by `main`'s scroll box → mobile action hints open below. Verified on the wire: attendant `/stock/summary` = `{todaysCount}` only, `/waste/items` rows = `{itemId,name,usageUnit,unitCost}`, no `onHand` anywhere on screen. Deviations: Today's-count copy (Daily count disabled in S1), header is the shared `MobileHubHeader`, attendant **Restock levels disabled "Set by the Store Manager"** — a correction to `188X-0` (the restock endpoint is SM/DH-only and returns on-hand); waste error copy says "You can still log waste." instead of §0.1's "…start the daily count" (Daily count is disabled in S1).
- **Log waste · CS mobile (`1BX0-0`), attendant — passed.** Hint = "Current cost KES 90 / kg" (cost only). Fixed: stepper dropped increments on rapid taps (next value read from render-time state → moved into the updater); mobile note label now "NOTE — optional" as drawn. Submit: "Logging…" in flight, sheet closes, toast without on-hand, hub waste list + total refresh, focus returns to the trigger. Mobile sheet focuses Back (not the item field) on open — deliberate, no keyboard pop on a phone.
- **All items (`1B5U-0` desktop / `1BRS-0` mobile) + loading / empty / error — passed.** New `StockItemsScreen` at `/app/inventory/stock/items`; every filter in the URL (`search/type/categoryId/belowRestock/negative/page`), search debounced 250ms (one request per settled query, verified in Network) with clear + Escape, a top-bar search landing on the same page replaces the typed text, filter changes reset to page 1, paging keeps filters, a page past the end snaps back. Shared table pieces moved from the hub into `components/stock/stock-table.tsx` (`StockTableRow/Header`, `FilterChip` + `DropdownFilter` with `sm/md/mobile` sizes, `MobileStockRow`). Geometry checked against Paper (page head 84/72, toolbar 176/34, mobile rows 69px). Deviations: row order is by name (Paper's seven-item order is illustrative, not a sort rule); mobile type dots follow one rule (raw neutral-400, stocked/prepped caramel-500, negative error) because Paper's are inconsistent row to row; on-hand/meta stay Geist Mono — Paper can't resolve `var(--font-mono)` so its render falls back to sans (its own token note); empty copy without a search term reads "Nothing in the Central Store catalog matches these filters…"; top-bar Restock/Log waste open the same drawers as on the hub. Found for the restock step: the closed `RestockLevelsDrawer` fetches `/restock-levels` with no `locationId` on mount (two 400s).
- **Stock ledger · item selected — SM desktop (`197U-0`) + DH mobile (`1BPY-0`) + loading / empty / error — passed.** `StockLedgerScreen` at `/app/inventory/stock/ledger/[itemId]` and `/app/branch/ledger/[itemId]`. Range (7/30/90/All/Custom), type, page and `?highlight=` in the URL; Radix toggle group (arrow keys); running on-hand is the API column — verified it stays the full-history window value under a type/range filter (13 Sep receive reads 37 kg); `?highlight=<txId>` row scrolls into view and plays a one-time caramel→espresso-50 fade (`ledger-highlight` keyframes in `globals.css`), badge "Opened from {reference ?? the {type} on {date}}"; empty range → "No movements in the last 7 days" + **Show 30 days** (→ "Show all time" when already on 30). Fixed during the gate: en-GB Intl printed "Sept" (formatters now assemble en-US parts day-first → "08 Sep"); page counter to Geist Mono; the title/item-name skeleton no longer shimmers under a page error. Deviations: KPI dividers neutral-800 as drawn; the Coffee beans ledger shows one extra row (the 05 Sep opening receipt — real data, running total reconciles to 12 kg); "Dispatch in" uses the shared info-blue tone (Paper's mobile draws it espresso — one tone map for both); DH screen keeps the dark status bar like the existing Milestone Four light-header DH screens; the DH ledger renders the mobile layout on every width (no desktop artboard).
- **Stock ledger · no item — SM desktop (`1F7B-0`) + DH mobile (`1FDY-0`) — passed.** `StockLedgerPickerScreen` at `/app/inventory/stock/ledger` and `/app/branch/ledger`: search focused on load, debounced; SM results from `listStock({search})`, DH from `listItems({departmentTag})` ("Search 8 Kitchen items…" — real count); Enter opens the first result; recently viewed per viewer + scope in `localStorage` (try/catch), written when a ledger opens; empty → "No items viewed yet". The DH never calls the SM-only summary (`useStockSummary(enabled)`).
- **Correction to the handoff:** the DH ledger (`1BPY-0`/`1FDY-0`) uses Paper's light "Branch mobile header", not the dark `StockMobileHeader` — built as `LedgerMobileHeader`. **Correction:** `/app/branch/*` is MANAGER-only in `middleware.ts`, so the DH routes would have bounced; `/app/branch/ledger` and `/app/branch/waste` now admit `isDepartmentHead` (same pattern as deliveries). `Topbar` gained an optional `root` crumb for the three-level trail.
- **Log waste · Department (`1ACM-0`) + DH landing wiring — passed.** `DepartmentLogWasteScreen` at `/app/branch/waste/new` (exported from `features/inventory/index.ts`), label "Kitchen, Nyeri Town"; the landing's Quick-actions "Log waste" is now a live link (no cross-feature import needed — plain navigation), "View history" stays a placeholder. Hint = department on-hand + carried-in cost ("On hand 9 pcs · current cost KES 145 / pcs"). Real submit verified in Postgres: `WasteLog` on the Nyeri Town org / "Nyeri Town — Kitchen" location, unit cost KES 240 carried in, one linked −1 `WASTE` row. Open question for the owner: the DH has no entry point to their stock ledger yet (the plan lists the route, not a landing link).
- **Restock levels · Department (`1AEE-0`) parity — found and fixed a Milestone One backend bug.** `resolveRestockScope` looked items up on the DH's branch org, which has no catalog rows (D-15: items live on the hub), so the DH restock screen was **always empty and every DH save 404'd — in production too**. Now returns a `catalogOrganizationId` (hub) for item lookups while levels + on-hand stay on the branch department location; 2 regression tests in `inventory-service.test.ts`. Visual parity differences left as is (parity check only, M1 screen): stacked `MobileTaskHeader` vs Paper's one-row header, grid inset in a card, "0" shown for unset levels.
- **Restock levels · CS drawer (`18ZV-0`) + mobile (`1BV6-0`) + loading / empty / error / save error — passed.** Wrapper rewritten around the unchanged grid (grid only gained optional `changedIds` → 1.5px primary border, plus `inputMode="decimal"` + per-row `aria-label`). Lists items that have a level + "+ Add an item" (inline keyboard combobox over the already-loaded rows; picking adds the row and focuses its input) — matching Paper and §0.1's empty copy; live note names the last raised level that flags low (word-for-word Paper); Save disabled until dirty, "Saving…" in flight; failed save = kit banner, edits kept (verified with a failing PUT); dirty-guard on Escape/×/Cancel/Back ("Discard your restock level changes?"); success toast, focus back to the trigger; 250ms drawer motion. Also fixed: the drawer fetched `/restock-levels` on every page mount while closed and before the Central Store id resolved (two 400s) — `useRestockLevels(…, enabled)`, loads on open. Deviations: desktop back to Paper's 440px with no search box (the M1 560px + search deviation existed because it listed all 142 items); mobile search kept, category chips omitted (the restock rows carry no category); mobile below-level on-hand stays the grid's red (Paper `1BV6-0` caramel; grid not to be rewritten). Real save verified (Coffee beans 25→30→25; DB back at the seeded levels).
- **Hub · SM mobile (`1J43-0`) — passed** (finished from last session): restock opens full-screen, On-hand rows → ledger, "View all N items →".

### End-of-session summary (2026-09-29)

**Built:** backend `ea82101`, DH restock fix `14fea4e`, frontend `0472690` on `feat/m6-s1-stock-waste` (not pushed). Every screen in the table (1–11) and its loading / empty / error states passed the per-screen gate above.

**Functional pass:** SM — hub → KPI / "View all" → All items (filters, search, paging) → row → ledger (range, type, highlight) → Log waste (drawer, previous session) and Restock levels (edit, add, failed save, real save) from the top bar; SM mobile hub → row → ledger. Attendant — mobile hub with no quantities, Log waste with a cost-only hint, real submit refreshes the waste card. DH — landing Quick actions → Log waste (real submit on the Kitchen, Nyeri Town location), own-department ledger + picker, restock levels (after the backend fix).

**Definition-of-done checks:** Postgres Σ ledger per (location, item) matches the screens (Central Store Coffee beans 12, Milk 128, Rice 209, Tomatoes −9; Nyeri Town Kitchen Grilled chicken portion 9, Chicken stock −1); 0 `WASTE` rows without a `waste_log_id`; 0 `WasteLog`s without exactly one equal-and-opposite ledger row; attendant-blindness contract test green. `backend pnpm build && pnpm test` (82 files, 1,033 tests, +2) and `frontend pnpm build` (+ `check-wds-tokens`, 403 files) green.

**For the owner:** (1) the DH restock bug is live in production today — this branch fixes it; (2) no DH entry point to their stock ledger yet — add a landing link, or leave for Session 3; (3) dev data: five fixture waste entries were re-dated +4 days on the local DB, and gate testing left real entries (Tomatoes 3 kg + 2 kg, Rice 1 kg at the Central Store; Chicken stock 1 L in Nyeri Town Kitchen).

**Next:** Session 2 — Central Store counting (switches on Daily count, Spot count, Thresholds and the Counts card).
