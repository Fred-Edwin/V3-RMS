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
3. **Superseded 2026-07-30 — work one screen at a time, not one flow at a
   time.** The original plan bundled every screen a flow touches into one
   session (see Flow 1+2/Flow 3 below for how that played out — Flow 3 in
   particular ballooned into a multi-session reopening of D-12 mid-flow).
   Starting with the Supplier AP session, the owner switched to auditing,
   critiquing, and fixing exactly **one screen** (desktop + mobile) per
   session, stopping and handing off cleanly even if time/context remains
   rather than pulling in the next screen on the list. The Manual Testing
   Guide's flow order is still useful for sequencing *which* screen comes
   next (don't jump around), but each session's scope is one screen, not
   one flow.
4. **Fix screen-by-screen once a screen's issues are agreed** — implement,
   verify live, before considering the session done. Don't batch fixes
   across screens or defer verification to the end.
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

Flow-level status (pre-2026-07-30 cadence, kept for history):

| Flow | Status |
|---|---|
| 1. Catalog & Suppliers | Complete 2026-07-30 (Stock on Hand + Suppliers deep-dive; see log below) |
| 2. PO raise → send → receive | Complete 2026-07-29 (see log below) |
| 3. Prep entry | In progress — see log below, handed off mid-flow to a fresh session 2026-07-30 |
| 4. Stock counting | Not started |
| 5. Waste logging | Not started |
| 6. Supplier AP | Complete 2026-07-30 (single-screen audit; see log below) |
| 7. Reports | Not started |

Screen-level status (current cadence, §8.1 = Store Manager screen list in
`INVENTORY_FEATURE_PLAN.md`):

| §8.1 row | Screen | Status |
|---|---|---|
| 1 | Stock on Hand | Complete 2026-07-30 |
| 2 | Item Catalog CRUD | Complete 2026-07-29 (see Flow 1+2 log) |
| 3 | Suppliers CRUD + price history | Complete 2026-07-30 |
| 4 | Supplier Invoices / AP | Complete 2026-07-30, layout follow-up 2026-07-30 |
| 5, 6 | Purchase Orders (list, send/cancel) | Complete 2026-07-29, layout follow-up 2026-07-30 |
| 7 | Receiving | Complete 2026-07-29 (folded into PO detail panel, Flow 1+2) |
| 8 | Prep entry | Design changes done 2026-07-30, **not yet re-verified live end-to-end** — see Flow 3 log point 6 |
| 9 | Prep Recipe editor | Done alongside row 8, same caveat |
| 10 | Stock Count — session creation | Complete 2026-07-30 — session creation/counting model redesigned, see log below |
| 11 | Stock Count — approval | Complete 2026-07-30 — got a Manager edit-before-approve capability as part of the same session, see log below |
| 12 | Waste Log — review | **Not started** |
| 13 | Reports | **Not started** |

Next screen up: **row 12, Waste Log — review.** (A Waste Log improvements
outline, based on this session's Stock Count findings, was requested but not
yet produced — pick that up at the start of the next session if still wanted.)

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

### §8.1 rows 10+11 — Stock Count session creation + approval

**Screens covered:** Stock Count list/create (desktop `StockCountsDesktop.tsx`
+ mobile `page.tsx`), Stock Count execution/approval (mobile
`[id]/page.tsx`). Both Store Manager and Store Attendant.

**Scope note:** this session started as a standard single-screen audit of
row 10 (session creation) per the audit's own process, but the owner
redirected mid-session into a genuine product/RBAC change and a from-scratch
flow redesign once the current screen was reviewed live — captured below in
the order it happened, not reorganized into a clean "plan then execute."

**Owner-directed RBAC change (not a design-fidelity finding — a product
decision):**
- §8.3's original rule ("session creation is Manager-only, Attendant only
  executes") was overturned by the owner: **either role can create a count
  session at any time now.** Only **approval** stays Manager-only. D-14
  (blind counting) is unaffected — `applyBlindCount` strips
  `expectedQty`/`gapQty` per the *caller's* role at read time, not the
  session's creator, so an Attendant who creates their own session still
  can't see expected qty when they get to counting it.
- Backend: `POST /stock-counts` route flipped from `managerOnly` to
  `bothRoles` (`stock-count-routes.ts`); `stockCountService.create`'s
  comment updated to match. One existing route test asserting the old
  403-for-Attendant behavior was rewritten to assert 201 instead
  (`tests/stock-count.test.ts`).
- A Manager who creates and personally counts their own session now gets a
  real mobile execution UI (previously `StockCountDetailPage` routed every
  STORE_MANAGER unconditionally to the read-only approval view, which had no
  counting UI at all for an `IN_PROGRESS` session — a Manager solo-counting
  on their phone had nowhere to enter numbers). Fixed by routing Manager to
  `StockCountExecution` while status is `IN_PROGRESS` (with
  `showExpectedQty` true — Manager always sees expected qty, including
  during their own entry, confirmed with the owner) and to the approval view
  once `SUBMITTED`/`APPROVED`.

**Owner-directed flow redesign ("why is there a separate creation and
counting flow — optimize for speed and simplicity, fewest possible
touches"):**
- **Collapsed create-a-session and start-counting into one continuous flow**
  on both desktop and mobile — replaces the old
  fill-a-form-then-find-it-in-the-list-then-open-it-to-count chain. New
  shape, identical on both shells: **scope → entry → mandatory review →
  submit.**
  1. **Scope**: pick "Full catalog" or a department — this *is* the item
     selection now, no separate per-item checklist step. Confirmed with the
     owner: a scope pick means every item in it is included, not a
     narrowing filter before an individual opt-in/out pass. (Considered and
     rejected: keeping an explicit checklist after the scope narrows the
     list.)
  2. **Entry**: lands directly on a quantity-per-row list, auto-labeled
     (`Count — 30 Jul, 14:32`, editable via a pencil-icon inline rename,
     never blocking start). `createStockCount` fires the moment a scope is
     picked — invisibly; there's no user-facing "session" concept to manage
     before counting starts.
  3. **Review (mandatory)**: confirmed explicitly with the owner — there is
     no "submit immediately, review optional" path. Once at least one item
     is counted, "Review & Submit" is the only way forward; it always shows
     a counted-vs-skipped breakdown with tap-to-edit before the real submit
     button appears.
  4. **Submit**: unchanged mechanism (`submitStockCount`), just reached via
     the new flow. Skipping an item is supported natively — the backend
     already only required "at least one line," not all lines, so partial
     submission needed no backend change.
- New components: `NewCountFlow` (mobile, in `page.tsx`) and
  `NewCountFlowPanel` (desktop, in `StockCountsDesktop.tsx`) — parallel
  implementations of the same three-step shape, not a shared component,
  since desktop renders entry as a stacked list matching the page's own
  idiom rather than mobile's card-per-item layout with auto-advance-on-Enter
  and a jump-to-item search.
- Old `CreateCountSessionSheet`/create-panel-with-checkbox-list code deleted
  on both shells.

**Owner's live mistakes list (screenshot-driven, collected as the new flow
was reviewed — same process as prior single-screen sessions):**
- List page "looks empty" → added a `StatCard` row (In Progress / Awaiting
  Approval / Last Approved) and a status filter + label search bar above the
  sessions table, matching Purchase Orders' post-audit pattern.
- Sessions table itself needed more detail → added a Counted (`n/total`)
  column.
- "New Count Session should use the right sidebar modal pattern" → both the
  old create-panel and the new merged flow use the same right-side
  slide-over panel convention as the existing detail/approval panel
  (`fixed inset-0 z-40 flex justify-end`), not a centered `Modal` — this was
  already the shape by the time the owner reviewed the merged-flow rebuild,
  carried over correctly.
- "Improve the Opening Physical Count [variance/approval] UI" → replaced the
  bare `ExcelTable` variance view with a card-per-line layout (desktop and
  mobile both already used cards for line-level detail elsewhere in the
  app; the table read as flat next to the new stat-row treatment and fought
  visually with inline editing, below). Added a compact `MiniStat` row
  (Counted / Net Variance / Short / Over) above the line list — the
  full-size `StatCard` (used on the page-level stat row) read as oversized
  in the narrower panel context; `MiniStat` is a new, panel-local component,
  not a `StatCard` variant, since nothing else needs this density yet.
- **Manager could not correct a miscounted line before approving** — the
  approval view was read-only; the only actions were approve-as-is or
  nothing. New Manager-only `PATCH /stock-counts/:id/lines` endpoint
  (`stockCountService.correctLines`) corrects `countedQty`/`gapQty` on a
  `SUBMITTED` session without transitioning status or touching
  `submittedById`/`submittedAt` (the record of who originally submitted is
  preserved). Reuses the existing `updateLineCount` repository primitive.
  Wired into both desktop (inline edit-in-place per card) and mobile
  (`StockCountApproval`) — tap a pencil icon next to Counted, edit, Save/
  Cancel. 4 new backend tests (2 route-level RBAC, 2 service-level:
  updates without status change, rejects when not SUBMITTED).
- **Unit mismatch, found from a live screenshot**: the variance/approval
  table displayed Expected/Counted in buy-unit (via the existing
  `formatBuyUnitQuantity` helper — e.g. "0.17 ctn (12x1L)") but every
  counting/entry field across the whole feature (mobile entry, desktop
  entry, both edit-in-place paths) took raw usage-unit input (kg/L/pc) —
  visibly colliding the moment inline editing was added to a buy-unit
  column. Root cause: two unbridged unit conventions had coexisted in the
  code the whole time; edit-in-place just made the seam visible. Owner
  decision: **buy-unit is the single convention everywhere** in this
  feature now — a person physically counts cartons/boxes on a shelf, not
  fractional grams. Added two new helpers to `lib/inventory-format.ts`:
  `buyUnitLabel` (the unit-suffix label for an entry field) and
  `toUsageUnitQuantity` (converts a typed buy-unit value back to the
  usage-unit the ledger/backend expects — `expectedQty`/`countedQty` are
  compared with zero conversion server-side, so this conversion has to
  happen client-side at the point of building any API payload). Applied
  everywhere a quantity is entered or displayed: mobile `NewCountFlow`
  entry/review, desktop `NewCountFlowPanel` entry/review, both
  edit-in-place paths (desktop card, mobile `StockCountApproval`), and the
  session-resume pre-fill in `StockCountExecution` (a paused/resumed
  session's already-typed values now redisplay in buy-unit too, not raw
  usage-unit). Backend response/storage shape is unchanged — this was a
  frontend-only convention fix, same pattern as `buyUnitCostValue` already
  documented in the same file ("never use these to derive a value sent back
  to the API — always send the raw usage-unit value").
- **Mobile FAB hidden behind the bottom nav** — Stock Count's new "+"
  button used `bottom-6 z-30`, but the app-wide FAB convention (confirmed
  against Waste Log/Item Catalog/Purchase Orders/Suppliers, all already
  correct) is `bottom-24 z-40` — `bottom-6` sits directly behind the fixed
  `BottomNav` overlay. Fixed to match convention. **Same bug found
  independently in Inbox** (`InboxShell.tsx`'s mobile FAB, `absolute
  bottom-6 z-30` inside its own `h-[100dvh]` container) while investigating
  a separate "Attendant page missing a back button" report — fixed with an
  explicit `calc(64px + env(safe-area-inset-bottom) + 16px)` offset instead
  of the `bottom-24` constant, since that FAB is `absolute` inside a
  same-height-as-viewport container rather than `fixed` against the real
  viewport. Desktop's separate Inbox FAB (different code path, own
  non-overlapping pane) was confirmed correct as-is and left untouched.

**Investigated, not a bug — worth recording so it isn't re-litigated:**
- A session literally labeled "30" in a screenshot turned out to be
  pre-existing scratch data created by hand during this session's own
  testing (confirmed via direct DB query — its `scheduled_date` is a plain
  midnight date matching the *old* create-form's date input, not the new
  flow's auto-label timestamp format), not a defect in the new flow.

**Deferred, not fixed — real gaps surfaced but out of this session's
scope:**
- **Shelf-location ordering** (part of §8.1 row 10's original spec text) —
  `InventoryItem` has no shelf/location field in the schema at all; there is
  nothing to order by today. Adding one means a new column + migration +
  an Item Catalog input to set it per item — a real schema change, not a
  screen-level fix, and out of scope for a design-audit session. Owner
  confirmed: defer and log as a known gap rather than adding the field or
  faking a department-tag-based stand-in.
- **Store Attendant has no Dashboard/Home nav tab at all** — confirmed via
  `layout.tsx`'s `mobileNavConfig`: Attendant's primary tabs are Stock /
  Purchases / Receiving / Prep (all task screens), with Stock Count / Waste
  Log / Inbox / Leave / Payslips under "More" — there is no landing/home
  destination anywhere in the role's nav. This was the real answer behind
  an owner report of "Prep Record [the Prep tab's screen title] has no way
  back" — it's not a missing back-arrow on a drill-in, it's the structural
  absence of a home base for this role. Owner agreed a fix (add a
  Dashboard tab, mirroring Store Manager's mobile Dashboard pattern) but
  explicitly deferred building it to its own session — it needs real
  content design (what stats/shortcuts matter to an Attendant's day), not a
  copy-paste of Manager's dashboard bolted on at the end of an
  already-long session. **Next session should pick this up** — see
  handoff prompt below.
- **Waste Log improvements outline** — the owner asked for one, based on
  this session's findings (unit consistency, FAB position, table-vs-card,
  edit-before-finalize), but it was not produced before the session closed.
  Revisit at the start of the Waste Log session (§8.1 row 12) if still
  wanted, rather than guessing at it secondhand here.

**New backend surface added this session:**
- `POST /stock-counts` RBAC: `managerOnly` → `bothRoles`.
- `PATCH /stock-counts/:id/lines` (new) — `stockCountController.correctLines`
  → `stockCountService.correctLines`, Manager-only, reuses
  `stockCountRepository.updateLineCount`.
- `stockCountRepository`'s `detailInclude` widened to select `buyUnit` and
  `conversionFactor` on `inventoryItem` (previously only `id`/`name`/
  `usageUnit`) — needed for buy-unit formatting on every line everywhere
  `StockCountWithLines` is returned; no other callers broke since it's an
  additive select.

**Verification:** `pnpm build` + `pnpm test` clean in `backend` (685/685,
4 new tests), `npx tsc --noEmit` + `pnpm build` clean in `frontend`, across
every round of changes in this session. No Playwright/browser verification
was run per owner instruction; live visual verification remains pending
owner review — the owner did review several rounds live via their own
screenshots during this session (that's how the FAB, unit-mismatch, and
edit-before-approve findings were caught), but the *final* state after the
last round of fixes has not yet been re-confirmed visually. 2026-07-30.

*(Template for future flows:)*

```
### Flow N — <name>

**Screens covered:** <list, with role/shell>

**Findings:**
- <screen> — <issue> → <agreed fix, or "not fixing: <reason>">

**Verification:** tsc / build / Playwright result, date
```

---

## Next session prompt (draft — two candidates, pick one)

Two follow-ups came out of the §8.1 rows 10+11 session and neither was
built: a Store Attendant Dashboard/Home tab (structural gap, not a design
polish item) and the next screen in the audit's own sequence (row 12, Waste
Log). Either is a reasonable next session; the Attendant Dashboard is more
urgent (a real usability hole for a live role) but is a scope-expanding
build, not a screen audit — the owner should pick which one to run next
rather than defaulting to sequence order.

**Option A — Store Attendant Dashboard/Home tab (structural gap, new build):**

> Store Attendant's mobile nav has no Dashboard/Home tab — confirmed
> 2026-07-30 while investigating a "no way back" report on the Prep Record
> screen (`layout.tsx`'s `mobileNavConfig.STORE_ATTENDANT`: primary tabs are
> Stock/Purchases/Receiving/Prep, all task screens; Stock Count/Waste
> Log/Inbox/Leave/Payslips are under "More"). There is no landing/home
> destination anywhere in this role's nav. Design and build a Dashboard tab
> for Store Attendant, mirroring Store Manager's existing mobile Dashboard
> pattern (stat-card grid + tap-through panels) but with Attendant-relevant
> content — think through what actually matters to an Attendant's day
> (today's receiving status? open stock counts assigned or in progress?
> prep still needed?) rather than copying Manager's dashboard content
> wholesale. Read `docs/context/INVENTORY-FEATURE/INVENTORY_FEATURE_PLAN.md`
> §8.2 (Attendant screens) first. This is a new-build session, not a design
> audit of an existing screen — treat it accordingly (design the content,
> not just the visual polish).

**Option B — §8.1 row 12, Waste Log — review (next in the audit's own
sequence):**

> Audit the Waste Log — review screen (§8.1 row 12), Store Manager-facing,
> desktop + mobile, following this file's usual one-screen-at-a-time
> process (Ground truth to read first section, Process section). The owner
> asked mid-session on 2026-07-30 for a Waste Log improvements outline based
> on the Stock Count session's findings (unit consistency — buy-unit is now
> the single convention for quantity entry/display everywhere in this
> feature per that session's log; FAB position — confirm Waste Log's own
> FAB, if any, isn't hidden behind the bottom nav the same way Stock
> Count's and Inbox's were; card-vs-table for any review/summary view;
> whether Waste Log has an equivalent "can't fix a mistake after logging"
> gap the way Stock Count's approval view did before this session added
> Manager edit-before-approve) — that outline was requested but not
> produced before the session closed. Start by producing it live against
> the actual current Waste Log screens, then proceed with the normal
> audit/fix process rather than treating the outline as a pre-built plan.

---

*Created 2026-07-29, handed off from the session that completed Phase 1
Session 9 (integration pass) and the Store Roles staff-integration pass.
Companion to `INVENTORY_FEATURE_PLAN.md` (the feature spec) and
`INVENTORY_PHASE1_SESSION_PLAN.md` (the build session log) — this file is
the design-review pass only, scoped after both of those were already
functionally complete.*
