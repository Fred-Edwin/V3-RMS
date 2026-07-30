# Inventory Phase 1 — UI/UX Design Audit (Not Started)

Agreed with the project owner 2026-07-29, after Phase 1 (Sessions 1-9) and
the Store Roles staff-integration pass both shipped. Everything built so far
was verified for **function** — does the ledger reconcile, does RBAC block
the right roles, does the screen render without errors. Nobody has yet
reviewed it for **look and feel and usability** as a deliberate design pass.
This file is that pass's brief, to be picked up in a fresh session (design
review needs a different mode than "implement and verify," and a fresh
session starts unbiased instead of anchored on implementation-session
decisions).

## What this session is

Claude Code acting as an expert UI/UX designer specializing in premium,
top-tier product design, auditing every Phase 1 screen and flow, then
implementing the fixes. Not a bug hunt (that's what Session 9 already did)
— this is judging whether each screen actually lives up to the product's
own stated design intent, and fixing it where it doesn't.

## Ground truth to read first

1. `CLAUDE.md` — non-negotiables, project structure.
2. `docs/DESIGN_SYSTEM.md` — the actual design system to audit *against*.
   Key principles already stated there, don't relitigate: warmth over
   sterility (cream-undertone white, amber-not-blue greys), the primary
   espresso brown used only where action is required (not decoration),
   Cormorant serif reserved for titles/brand moments, Inter for daily work,
   the "office idiom" (ExcelTable/Sheet, gridlines, tabular numerals) for
   data-dense screens, warm crema (`#F5F0E8`) as the page canvas everywhere
   including back-office screens.
3. `docs/context/INVENTORY-FEATURE/INVENTORY_FEATURE_PLAN.md` §8 (Roles &
   Screens) — the authoritative screen list and desktop/mobile layout intent
   per screen, to check fidelity against.
4. `docs/context/INVENTORY-FEATURE/MANUAL_TESTING_GUIDE.md` — **use this as
   the audit's own walking order.** It's organized by user flow, not by
   screen in isolation, and that's deliberate: judge each screen in the
   context of the journey a real user is actually on, not cold. The flows,
   in order:
   1. The catalog & suppliers (setup)
   2. Raise, send & receive a PO
   3. Prep entry & the rolling average
   4. Stock counting
   5. Waste logging
   6. Supplier AP
   7. Reports
5. `docs/context/INVENTORY-FEATURE/INVENTORY_PHASE1_SESSION_PLAN.md` — read
   Sessions 6-8's "As Built" sections for context on screens that were
   explicitly **not** mockup-driven (Session 7 was redirected mid-session to
   "design freely against the design system" rather than follow generated
   mockups) — these are more likely to have drift worth auditing than the
   mockup-driven Session 6 Attendant screens. Also note known, deliberate
   v1 cuts that are NOT audit findings: CSV-only export (no PDF), 4 of 7
   mobile reports deferred to desktop-only, no Prep Recipe editor.

## Process (agreed with the project owner — follow this shape)

1. **Owner brings their mistakes list first**, before the audit starts. Not
   after — if the designer's own findings come first, the owner's list ends
   up anchored on what was already found instead of surfacing independently.
   Fold the owner's items in as confirmed findings per screen, then keep
   auditing everything else independently.
2. **Live, interactive walkthrough — not a written report reviewed cold.**
   Pull up each screen live (both shells/roles where applicable), talk
   through it as an expert critique (hierarchy, spacing, color use,
   consistency with `DESIGN_SYSTEM.md`, interaction quality), the owner
   reacts in real time, agree on a fix list together.
3. **Work one flow at a time, per the Manual Testing Guide's order.** Within
   a flow, audit every screen the flow touches (both roles/shells) before
   fixing anything — judge the whole flow's coherence, not just one screen.
4. **Fix screen-by-screen once a flow's issues are agreed** — implement,
   verify live (both shells/roles for that screen), before moving to the
   next screen in the flow. Don't batch fixes across screens or defer
   verification to the end of the flow.
5. **Log decisions in this file as you go** — not a report to read cold
   after the fact, but a running record so nothing gets lost and a future
   session can see what was decided and why. Use the template below, one
   section per flow.
6. **Include UX/flow issues, not just visual ones** — explicitly agreed
   scope. A cluttered layout IS a usability problem; an interaction that
   takes 3 taps when it could take 1 is in scope even if every color and
   spacing choice is already correct. Don't artificially split "looks" from
   "works" — judge both together per screen.
7. **At the end of each flow**, verify per this project's standard
   convention: `npx tsc --noEmit` + `npx next build` clean (frontend only —
   this pass shouldn't need backend changes), live Playwright pass both
   shells/roles for every screen touched in that flow.

## Status

| Flow | Status |
|---|---|
| 1. Catalog & Suppliers | Complete 2026-07-30 (Stock on Hand + Suppliers deep-dive; see log below) |
| 2. PO raise → send → receive | Complete 2026-07-29 (see log below) |
| 3. Prep entry | Not started |
| 4. Stock counting | Not started |
| 5. Waste logging | Not started |
| 6. Supplier AP | Not started |
| 7. Reports | Not started |

## Owner's mistakes list

*(Not yet collected — ask for this first, before starting Flow 1. Was
intentionally deferred to the fresh session rather than captured in the
handoff, so it comes through directly rather than summarized secondhand.)*

## Findings & decisions log

### Flow 1+2 — Catalog & Suppliers / PO raise → send → receive

**Screens covered:** Dashboard, Item Catalog (desktop + mobile), Stock on
Hand (desktop + mobile), Suppliers (desktop + mobile), New PO (Attendant +
Manager), PO detail/receiving, `Input`/`HelpTip`/`Popover` shared components.

Session 1 of this pass covered Dashboard/Catalog/New-PO/PO-detail (handed
off mid-flow, see the now-superseded `UI_UX_AUDIT_HANDOVER.md` for that
session's blow-by-blow). Session 2 (this entry) finished Stock on Hand and
did a full redesign pass on Suppliers, prompted by live owner feedback
against the running app rather than a pre-collected list — each item below
was raised, discussed, and fixed in the same sitting per the audit's own
process.

**Findings — Stock on Hand:**
- No row numbers, raw usage-unit quantities (e.g. "12459.5 ml" instead of a
  buy-unit quantity) → added row numbers; wired the already-built
  `formatBuyUnitQuantity` helper into both the On Hand column and the
  mobile card list.
- No help affordance → added `HelpTip`.
- "Unit Cost" was the only price shown, and it's a weighted average, not
  what was actually paid → owner: keep the weighted average (it's what
  Value is computed from — removing it makes Value unauditable) but stop
  mislabeling it. Added a real **Last Received** column (last actual paid
  price, distinct data) alongside a relabeled **Avg. Unit Cost**. Last
  Received required a new backend query
  (`inventoryTransactionRepository.findLatestReceiveUnitCostByItemGrouped`)
  — no such field existed before.
- Item-row icons next to every name were pure decoration once a Type badge
  already exists → removed (kept in the single-item movement-history detail
  panel, a different context).
- No department filter, no stat-card row → added both (mirrors Item
  Catalog's existing pattern: `StatCard` row + a `Select` filter alongside
  the type-filter pills).
- `HelpTip`'s popover overflowed off the right edge of the screen — a real
  bug in the shared `Popover` component (any right-aligned trigger hits
  this, not just this screen: `Popover` always opened `left-0` regardless
  of where the trigger sat). Fixed generically: added a `bottom-end`
  placement, `HelpTip` now defaults to it. Also widened/loosened the popover
  panel (280px → 320px, tighter line-height → `leading-relaxed`) for
  readability.

**Findings — Suppliers (major redesign, several rounds of live feedback):**
- **Default-supplier assignment was structurally missing on two fronts**:
  (1) Suppliers' own item list showed a static star with no way to change
  it — fixed: star is now a real toggle (hollow = click to set default,
  filled+disabled = current), wired to the existing `assignSupplierItem`
  endpoint (backend already supported this end-to-end; only the UI never
  called it). (2) Item Catalog's "Default Supplier" field only appeared
  when *creating* a new item (`panelItem === 'new'` gate) — for the 24+
  items already in the catalog there was **no** UI path to set/change a
  default supplier at all. This required a genuinely new backend endpoint
  (`GET /inventory-items/:id/suppliers`, using the previously-defined-but-
  never-wired `supplierRepository.findSuppliersForItem`) so the edit panel
  can look up an item's current default and pre-fill it. Now editable on
  both desktop and mobile, for both new and existing items.
- **Empty right panel was dead space** until a supplier was clicked → first
  supplier now auto-selects on load; a real `EmptyState` (icon + heading +
  body) only shows when there are zero suppliers.
- **Roster rows lost their visual hierarchy** after adding an
  outstanding-owed badge and a low-stock badge to the same row (two
  competing pills, no clear "the one thing to look at") → owner: redesign
  to a strict primary/secondary/tertiary read — name (primary), item count
  (secondary, quiet gray) — and **at most one** badge (owed beats low-stock
  if both are true, since financial exposure is the more urgent signal).
  A roster-level "latest price" fragment (e.g. "Samrat Supermarket · latest
  Ksh 100") was also removed once flagged as ambiguous — a supplier-level
  rollup of one item's price doesn't mean anything at that level; price
  belongs next to the specific item, not the supplier.
- **Items & Pricing list redesigned twice** based on live feedback: first
  pass added a click-to-select-then-view-chart-below interaction (still
  using the old full-size `PriceTrendChart`) — owner found that heavy and
  spatially wasteful for what should be a quiet secondary cue. Rebuilt with
  a new `Sparkline` component (`frontend/components/inventory/Sparkline.tsx`)
  — no axes, gridlines, or tooltip, just a small inline trend line — with
  the row itself redesigned to item name + sparkline + latest price as the
  primary read, star/remove demoted to a small trailing icon cluster.
- **Sparklines were flat/empty for most items** — root-caused to two
  separate real bugs, not a display issue:
  1. Price History (`inventoryReportRepository.findReceivedLinesForItem`)
     only read `PurchaseOrderLine.receivedAt` rows. But
     `inventoryTransactionService.recordReceive` — the actual shared
     receiving path, used by both real PO receiving *and* ad-hoc/seeded
     ledger entries with no PO line — only guarantees an
     `InventoryTransaction` row. Ad-hoc receives (including the seed
     script's real dated Samrat/Summer Limited price history) were
     therefore invisible to Price History entirely, in production, not
     just in dev. Fixed by sourcing from `InventoryTransaction` (type
     RECEIVE) instead, joined to its optional PO line for supplier
     attribution, with a unit conversion fix (ledger `unitCost` is
     per-usage-unit; PO-line prices are buy-unit — now normalized to buy-
     unit consistently so a mixed-source series doesn't jump
     discontinuously).
  2. Once (1) was fixed, supplier-filtered queries *still* returned nothing
     for ad-hoc receives, because they have no PO to trace a supplier
     through. Fixed by falling back to the item's `SupplierItem` assignment
     when there is exactly one (Phase 1's typical shape) — deliberately not
     for items with zero or multiple supplier assignments, so an ad-hoc
     receipt is never misattributed to the wrong supplier.
  3. Separately, `SupplierItem.lastPrice` (the field the Items & Pricing
     list displays as "latest price") was **never auto-updated by the real
     receiving flow** — it only changed when a Manager explicitly picked a
     default supplier from the UI, so it silently went stale system-wide
     the moment a new PO landed at a different price. Fixed at the source:
     `recordReceive` now upserts the matching `SupplierItem.lastPrice` on
     every receipt (PO-linked, or ad-hoc with exactly one supplier
     assignment) — correct going forward for every item, not a one-off
     patch. Backfilled the 19 existing null rows in dev.
  4. A 2-point sparkline is just one straight diagonal — not real "shape,"
     and was called out as such. Raised the render threshold to 3+ points;
     below that, a quiet neutral dot renders instead of a misleading line.
  5. Because the fixes above surfaced how sparse *real* seeded price data
     is (only 5 items had any receive history at all; none reached 3
     points), added a separate, explicitly-labeled synthetic seed
     (`backend/src/scripts/seed-price-history-demo.ts`) — never merged into
     `seed-inventory-demo.ts`'s real, client-transcribed data — purely so a
     few items have enough points to show real trend shape in dev/demos.
  6. Added a subtle filled-gradient area under the sparkline's line (fading
     to transparent, colored to match the trend line) per a later visual
     ask, matching `PriceTrendChart`'s existing gradient-area convention.
- **Item-picker price pre-fill**: the redesigned Add/Edit Supplier sheet's
  item picker (see decision #4 below) originally left the price field blank
  when checking a new item — owner: it should default from the item's own
  last-purchase price, editable from there. Fixed: pre-fills from
  `buyUnitCostValue(item)` (the weighted-average current cost) when
  checking an item for the first time, blank only for a genuinely new item
  with zero cost history (so it never shows a misleading "0.00").
- Roster-row icons (generic person silhouette on every row, adding no
  information) removed on desktop; kept on mobile's card list (a card
  layout benefits from an icon as a visual anchor in a way a dense table
  row doesn't — not flagged as an issue there).
- AP tab: still confirmed good, no change — same call as the earlier
  session's Flow 1+2 review.

**Owner decisions on record from this session (don't re-ask):**
1. Avg. Unit Cost and Last Received are **both kept as separate columns** on
   Stock on Hand — not merged, not one replaced by the other. Confirmed
   after presenting three options (keep both / merge into one / replace
   Avg. with something else).
2. Sparklines render **no expand-to-full-chart** interaction — genuinely
   just the inline trend line, nothing else. (Considered and rejected a
   "sparkline + click for full chart" option.)
3. Seed data: **build a separate synthetic dataset**, do not fabricate
   extra price points into the real client-transcribed Samrat/Summer
   Limited data, even for demo purposes.
4. `SupplierItem.lastPrice` **auto-updates on every receive** going forward
   (not left as a manual-only field, and not just a one-off backfill of the
   two rows the owner happened to spot).

**New backend surface added this session** (all covered by tests, full
suite green at time of writing):
- `GET /inventory-items/:id/suppliers` (Manager-only) — `inventoryItemService.getSuppliers`,
  reuses `supplierRepository.findSuppliersForItem`.
- `inventoryTransactionRepository.findLatestReceiveUnitCostByItemGrouped` —
  powers Stock on Hand's Last Received column.
- `inventoryReportRepository.findReceivedLinesForItem` rewritten to source
  from `InventoryTransaction` instead of `PurchaseOrderLine` (see sparkline
  finding above) — same public shape, callers unchanged.
- `inventoryTransactionService.recordReceive` now also upserts
  `SupplierItem.lastPrice` (see finding above).
- `backend/src/scripts/seed-price-history-demo.ts` (new, dev-only,
  idempotent, refuses to run in production).

**Verification:** `npx tsc --noEmit` clean (frontend + backend), `npx next
build` clean, backend suite green (681/681 at last run — 3 new tests added
for the `lastPrice` auto-update paths, 1 for the null-supplier price-history
mapping), manual verification against the running app + direct repository
queries for the sparkline/price data fixes (Chicken Breast confirmed
returning all 5 real price points post-fix). Live-checked in-browser by the
owner throughout, not just post-hoc — this flow was driven by iterative
live feedback rather than a single audit-then-fix pass. 2026-07-30.

*(Template for future flows:)*

```
### Flow N — <name>

**Screens covered:** <list, with role/shell>

**Findings:**
- <screen> — <issue> → <agreed fix, or "not fixing: <reason>">

**Verification:** tsc / build / Playwright result, date
```

---

*Created 2026-07-29, handed off from the session that completed Phase 1
Session 9 (integration pass) and the Store Roles staff-integration pass.
Companion to `INVENTORY_FEATURE_PLAN.md` (the feature spec) and
`INVENTORY_PHASE1_SESSION_PLAN.md` (the build session log) — this file is
the design-review pass only, scoped after both of those were already
functionally complete.*
