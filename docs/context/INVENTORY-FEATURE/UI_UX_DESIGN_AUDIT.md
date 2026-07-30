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
| 3. Prep entry | In progress — see log below, handed off mid-flow to a fresh session 2026-07-30 |
| 4. Stock counting | Not started |
| 5. Waste logging | Not started |
| 6. Supplier AP | Complete 2026-07-30 (single-screen audit; see log below) |
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

### Flow 3 — Prep entry (in progress, handed off mid-flow)

**Screens covered:** Prep Entry (Manager desktop `PrepEntryDesktop.tsx` +
Attendant/Manager mobile `page.tsx`), new Prep Recipes authoring tab
(`PrepRecipesTab.tsx`), new shared `ItemCombobox.tsx` component.

**Owner's mistakes list (collected live, not pre-gathered):** unclear where
prepped items are created; dropdown pickers don't scale past a handful of
items; general visual/usability polish wanted; input-line quantity units
should be usage units not buy units (turned out to already be correct in
code — not a real bug); fewest possible touches per prep run.

**Findings — and a major scope reopening:**
- **D-12 ("no predefined recipe requirement") reopened at the owner's
  request.** Investigated first: `PrepRecipe`/`PrepRecipeLine` already
  existed in schema as a Manager-only "promote a past PrepRecord into a
  template" feature, but had zero read-side wiring into the entry form and
  no direct-authoring path — a prepped item could only ever be created via
  Item Catalog's flat type dropdown, with no recipe attached. Owner decided
  this was backwards: a prepped item only exists *because* a recipe produces
  it, so recipe authoring should be how a prepped item is created, not a
  same-flat-form dropdown option in Item Catalog.
- **Item Catalog**: removed `PREPPED` from the creatable type options at
  creation time (`CREATABLE_TYPE_OPTIONS`, both desktop/mobile forms) —
  editing an *existing* legacy PREPPED item still works and still shows
  `PREPPED` via the full `TYPE_OPTIONS`, just can't be selected fresh anymore
  or changed away from PREPPED once set (would orphan its recipe).
- **New Prep Recipes tab** (Manager-only, top tabs alongside "Log Prep" —
  explicitly *not* added to the sidebar, per owner instruction, to avoid
  clutter): Manager authors a recipe directly — item name, ingredients
  (item + quantity, reusing the new searchable `ItemCombobox`), and one
  batch's expected yield. Creating a recipe atomically creates the
  `InventoryItem` (type PREPPED) + `PrepRecipe` + lines in one backend
  transaction (`prepRecordRepository.createRecipeDirect`). New endpoints:
  `POST /prep-recipes` (create), `PATCH /prep-recipes/:id` (edit — replaces
  all lines wholesale, past `PrepRecord`s untouched), `GET
  /prep-recipes/by-output` (Log Prep's pre-fill lookup) — all Manager-only
  except the by-output read, which both roles can call.
- **Log Prep now pre-fills from the recipe** (both desktop and mobile): on
  output-item selection, ingredient lines + expected yield auto-populate
  from the saved recipe (still fully editable/removable — never blocking).
  Falls back to today's exact blank-slate + rolling-average hint if no
  recipe exists for that item yet.
- **Terminology fixed after live owner confusion**: "Input Lines" renamed to
  "Ingredients" everywhere (recipe form + both Log Prep variants). "Usage
  Unit" was ambiguous/unexplained on the recipe form — clarified as "Yield
  Unit," moved next to Expected Yield inside a "This batch yields" box, with
  helper text making the relationship explicit ("How much one full batch of
  the ingredients above produces").
- **Batch model decision**: one recipe = one fixed batch (no separate
  multiplier/scaling concept at authoring time) — the ingredient quantities
  *are* one batch's definition, matching the domain model doc's own example
  (`central_kitchen_inventory_model.md` §4 Step 2: "Chicken Breast 1.1kg +
  Marinade 50ml + Salt 5g → yields 1kg"). **Superseded before this session
  closed** — see "Left open" below.
- **Desktop dropdown → searchable combobox**: built `ItemCombobox.tsx`
  (type-to-filter, keyboard-friendly, matches mobile's existing searchable
  bottom-sheet pattern) to replace the bare native `<select>` for Output
  Item and every Input/Ingredient line on desktop. Mobile already had this
  pattern (`ItemPickerSheet`) — untouched, still correct.
- **Disabled-vs-empty field ambiguity — fixed globally, not just in Prep
  Entry** (owner explicitly chose the wider fix over a screen-local one):
  `Input.tsx` and `Select.tsx` both used `bg-parchment` at rest, identical in
  weight/tone to the `bg-stone-100 + opacity-50` disabled state — every empty
  field in the entire product looked disabled. Changed both to `bg-white` at
  rest; disabled styling untouched. Affects every form field app-wide, not
  just this flow.
- **Icon-tiles-in-lists → row numbers, applied app-wide** (owner's
  instruction, explicitly "everywhere," not scoped to Prep Entry): removed
  every per-item icon tile in every *list* context and replaced with a plain
  sequential row number (`index + 1` in a small numbered chip), matching
  Stock On Hand's existing row-number convention. Touched: Prep Entry/Prep
  Recipes pickers, `ItemCombobox`'s dropdown rows, Item Catalog's PO
  add-item picker, Waste Log's search/recent-items, New PO's browse-catalog
  list, PO edit's add-item picker, Suppliers' mobile roster list. Explicitly
  **kept** icons only in single-item (non-list) detail contexts: Stock On
  Hand's movement-history drill-in panel (desktop + mobile), and Log Prep's
  own "what you're preparing"/"what you produced" single-selection summary
  cards — these show one already-chosen item, not a list of choices.
  **Left incomplete**: `ItemCombobox`'s own *trigger button* (the closed,
  selected-state display) still shows an icon instead of following the same
  number treatment as its dropdown list — owner flagged this from a
  screenshot taken after the dropdown-list fix but before this trigger-button
  spot was caught. Fix identified but not yet applied — see "Left open."
- **Quantity input width bug**: quantity fields (`w-32`/`w-36`, i.e.
  128–144px) were too narrow for a real 3-digit quantity plus a unit suffix
  (e.g. "623 ml") in the bold/large input font — value looked truncated
  (owner saw "3" where "300"-range values had been entered). Root-caused via
  a one-off owner-directed Playwright check (typing "1.5" into a fresh field
  proved the underlying state/keystroke handling was never broken — purely a
  CSS width/clipping issue). Fixed: desktop widened to `w-40`, mobile to
  `w-36` (up from `w-32`), consistently across the recipe form and both Log
  Prep variants.

**Left open (original handoff list, #1-5 now closed — see "Follow-on session" below):**
1. ~~`ItemCombobox`'s trigger-button icon~~ — closed. On inspection the
   trigger button never actually rendered an icon (text-only), so this was
   already correct in the working tree; no code change needed.
2. ~~Batch scaling~~ — closed. Implemented in both `PrepEntryDesktop.tsx`
   and `page.tsx`'s `LogPrepMobile`: average of each ingredient line's
   actual÷recipe ratio, scaling the recipe's expected yield live as
   quantities are entered. Recipe pre-fill banner and the Actual Yield
   field's helper text both show the scaled figure once ingredients diverge
   from the recipe's own batch size.
3. ~~Persist scaled-expected-yield~~ — closed. `PrepRecord.scaledExpectedYield`
   (nullable Decimal(12,4)) added via migration
   `20260730120000_add_prep_record_scaled_expected_yield`, wired through
   `CreatePrepRecordSchema` → `prepRecordService.create` →
   `inventoryTransactionService.recordPrep` → `tx.prepRecord.create`. Null
   when no recipe existed for that run (unscaled logging still works
   exactly as before, D-12).
4. ~~New "Prep History" tab~~ — closed. `PrepHistoryTab.tsx` (new file),
   third Manager-only tab in `PrepTabs.tsx` alongside Log Prep / Prep
   Recipes. Uses `ExcelTable` (row-numbered, matching the rest of the
   product) over the existing `GET /prep-records` endpoint — no new backend
   surface needed beyond the `scaledExpectedYield` field itself, confirming
   the handover's guess that the endpoint already had everything else.
5. ~~Update the Prep Yield report~~ — closed. `inventoryReportService.getPrepYield`
   now returns `scaledExpectedYield`/`variance` per run
   (`actualYield - scaledExpectedYield`, null when no recipe); reports page
   table + CSV export both show the new columns.
6. Flow 3 is **not yet verified end-to-end** for this session's later
   changes (icon sweep, quantity-width fix, and now batch scaling + Prep
   History + Prep Yield report) — `tsc`/`next build`/backend test suite
   (681/681) all clean, but no fresh full-flow live browser check has
   happened since. Re-verify visually before trusting it's fully done.
7. Playwright was used once this session, at the owner's **explicit,
   one-off direction** ("use playwright to verify") to settle the
   quantity-width question — this is *not* a standing reversal of the
   project's normal no-Playwright preference (see memory:
   `feedback_no_playwright_verification`). Default back to owner-driven
   manual screenshot verification unless told otherwise again.

**Follow-on session (2026-07-30) — implemented items 1-5 above:**
- Owner gave a further standing instruction mid-session: "Remove all icons if
  you come across them" — applied immediately to the two remaining
  single-item summary icons in mobile `page.tsx` (`LogPrepMobile`'s output-item
  card and actual-yield card), which the original icon sweep had deliberately
  *kept* as single-item (non-list) contexts. That carve-out is now superseded
  by the broader instruction — both icons removed, `IconTile`/`itemTypeIcon`
  imports dropped from `page.tsx` as a result (no longer used anywhere in this
  file). If icons turn up elsewhere in a future Flow, remove those too rather
  than re-applying the old single-item-context exception.
- Migration applied directly to the local dev DB via a hand-written
  `migration.sql` + `prisma migrate deploy` (not `migrate dev`) — the local DB
  had pre-existing, unrelated drift on the `payslips` table (stale
  `gen_random_uuid()`/decimal-default introspection diff, not caused by this
  session) that made `migrate dev` want to reset the database. `migrate
  status` confirmed the schema was otherwise up to date, so a hand-authored
  additive-only migration file was the safe path — didn't touch payslips,
  didn't reset anything. Still needs the normal commit + `migrate deploy` on
  the production server per `CLAUDE.md`'s migration workflow.

**New backend surface added this session:**
- `POST /prep-recipes`, `PATCH /prep-recipes/:id`, `GET
  /prep-recipes/by-output` (`prep-record-routes.ts`,
  `prep-record-controller.ts`, `prep-record-service.ts`,
  `prep-record-repository.ts` — `createRecipeDirect`, `updateRecipe`,
  `findRecipeByOutputItem`). `inventoryItemRepository.create` gained an
  optional `tx` param so recipe + item creation is atomic.
- `recipeInclude` (repository-level Prisma include) widened to select
  `usageUnit` on both `outputItem` and each line's `inputItem` — needed for
  the batch-framing UI copy; backend suite re-verified green after this
  (681/681).

**Verification:** `tsc --noEmit` and `next build` clean (frontend +
backend) after every change through the icon sweep; backend suite green
681/681 (re-run after the `recipeInclude` change). No fresh Playwright/live
pass covers the *final* state (icon sweep + width fix together) — do that
first in the next session, per point 6 above. 2026-07-30.

### Flow 6 — Supplier AP / Supplier Invoices

**Screens covered:** Store Manager Purchases → Supplier Invoices / AP
(desktop + mobile). Store Attendant AP access remains zero-access by route
RBAC and by not rendering the tab.

**Findings:**
- Navigation model — AP existed only inside each supplier's detail panel,
  which matched the earlier Session 7 decision but made the real AP question
  awkward: "who do we owe, how much, and how old is it?" → owner confirmed
  not to add another sidebar link; renamed the existing Purchase Orders nav
  destination to **Purchases** and added tabs for **Purchase Orders** and
  **Supplier Invoices / AP**.
- Desktop AP — supplier-detail AP could show one supplier's invoices, but
  lacked the required cross-supplier invoice table, PO reference column,
  totals-by-supplier panel, and 0-7/8-30/31+ aging view → added a dedicated
  Manager-only AP workbench under Purchases using the existing
  `SupplierInvoice` APIs, with an `ExcelTable`, supplier totals, aging
  buckets, record-invoice modal, record-payment modal, and an invoice detail
  side panel.
- Mobile AP — the existing mobile AP was also supplier-detail scoped and did
  not provide the spec's tap-through invoice detail workflow → added an
  Invoices / AP tab under Purchases with invoice cards, prominent status
  badges, compact aging chips per invoice, tap-through detail, and a primary
  **Record Payment** action.
- Mistake-proofing — invoice entry made the PO reference optional but useful:
  selecting a PO pre-fills supplier and amount from that PO; payment entry
  pre-fills the outstanding amount and blocks overpayment before calling the
  API.
- List convention — no decorative icon tiles were added to invoice/payment
  lists; repeated list summaries use numbered chips where an anchor is
  needed, matching the owner-wide instruction from Flow 3.

**Verification:** `pnpm --dir frontend exec tsc --noEmit` clean; `pnpm
build` clean in `backend`; `pnpm test` green in `backend` (681/681); `pnpm
build` clean in `frontend`. No Playwright/browser verification was run per
owner instruction; live visual verification remains pending owner review.
2026-07-30.

**Follow-up design pass (2026-07-30) — Purchase Orders + Supplier Invoices
layout refinement.** After the AP workbench above shipped, the owner asked
for a second look specifically at layout quality on both Purchases tabs,
prompted by live screenshots. Findings and fixes, agreed before
implementation:

- Purchase Orders tab read as an earlier, un-audited design generation next
  to its own Supplier Invoices sibling tab — plain table, no summary
  signal, no aging/urgency cue, and a bare bulleted line list in the detail
  panel where Supplier Invoices already had a metric-grid treatment →
  added a `StatCard` row (Open Orders / Awaiting Receipt / Total
  Committed), a **Days Open** column for non-terminal POs (Draft/Sent/
  Partially Received) with `text-danger` styling past 7 days open, and a
  Total/Lines/Days-Open metric grid at the top of the Draft/Cancelled/
  Closed detail panel — mirrors the Stock on Hand / Item Catalog / Supplier
  Invoices stat-row convention and the existing `daysOutstanding`-style age
  calc already used in AP.
- Supplier Invoices' "Payment Age" panel restated the table's own "Days
  Unpaid" column as three flat stacked boxes with no comparative context →
  owner considered merging it into a single segmented bar under the
  Outstanding stat card (tested, then reverted), and decided the aging
  signal was better as its **own dedicated panel** in the right rail — kept
  the panel, but redesigned each bucket as a horizontal bar (Badge label +
  amount/count, proportional bar beneath) instead of a card each, so
  relative weight between buckets reads at a glance. Totals by Supplier was
  promoted above Payment Age in the right rail per the original critique
  (more actionable — "who do I owe" vs. an aggregate already visible in the
  table).

**Verification:** `pnpm exec tsc --noEmit` clean; `pnpm build` clean in
`frontend`. No backend changes. No Playwright/browser verification was run
per owner instruction; live visual verification remains pending owner
review.

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
