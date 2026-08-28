# UI/UX Design Audit — Handover Prompt

> **⚠️ CORRECTION (2026-08-20): the "uncommitted changes" warning below is stale.**
> Flow 3's work — `PrepRecipesTab.tsx`, `PrepTabs.tsx`, `ItemCombobox.tsx`, the
> `/prep-recipes` backend routes, and the app-wide icon sweep — is **all committed**
> (in `5c04c4e` and `fb8d135`) and the working tree is clean. Do not go looking for
> a pending diff; there isn't one. Everything below still stands as the record of
> *what Flow 3 did and decided* (including the D-12 reopening) — read it for that,
> not as a description of current disk state.

Paste this into a fresh session to continue the Inventory Phase 1 UI/UX design
audit. Flow 1 (Catalog & Suppliers) and Flow 2 (PO raise/send/receive) are
fully complete and committed. Flow 3 (Prep entry) was handed off mid-flow at the
time this note was written — see the correction above; it has since been
completed and committed. Flows 4-7 have not started.

---

## Prompt to paste

> You are acting as an expert UI/UX designer specializing in premium,
> top-tier product design, continuing the Inventory Phase 1 UI/UX design
> audit — specifically resuming Flow 3 (Prep entry), which was handed off
> **mid-flow, mid-session, with uncommitted changes on disk**. Read
> `docs/context/INVENTORY-FEATURE/UI_UX_DESIGN_AUDIT.md` in full first — it's
> the brief, and its Findings & decisions log's "Flow 3" entry has the
> complete record of what's already built, what's superseded, and exactly
> what's left (a numbered "Left open" list — start there, don't re-derive
> it). Then read this handover note in full before writing any code — it has
> environment state, exact file paths, and things you must NOT re-ask the
> owner. Run `git status` and `git diff` first thing to see the actual
> uncommitted state before assuming anything about what exists.

---

## Critical: this is not a fresh flow start

Unlike the Flow 1→2 and Flow 2→3 handoffs, this one is **mid-implementation**.
A large amount of real, working, verified code already exists — a whole new
Prep Recipes authoring feature, reopening a previously-closed architecture
decision (D-12). Do not re-plan this from scratch, do not re-ask the owner
the design questions already answered below, and do not revert anything
without understanding why it's there first (check the audit doc's Flow 3
entry and the code comments — several reference `D-12 reopened` or
`UI_UX_DESIGN_AUDIT.md Flow 3` directly).

## What's already built and working (verified, just not yet committed)

1. **Backend**: `PrepRecipe`/`PrepRecipeLine` (already existed in schema,
   unused) now has real read/write wiring:
   - `POST /prep-recipes` — Manager-only, atomically creates the output
     `InventoryItem` (type `PREPPED`) + `PrepRecipe` + lines in one
     transaction (`prep-record-repository.ts` → `createRecipeDirect`).
   - `PATCH /prep-recipes/:id` — Manager-only, edits a recipe's fields/lines
     (replaces lines wholesale). Never touches past `PrepRecord`s.
   - `GET /prep-recipes/by-output` — both roles, Log Prep's pre-fill lookup.
   - `inventoryItemRepository.create` gained an optional `tx` param for the
     atomic transaction above.
   - `recipeInclude` (shared Prisma include) now selects `usageUnit` on
     `outputItem` and each line's `inputItem` (needed for batch-framing UI
     copy) — re-verify this didn't drift if you touch this file.
2. **Item Catalog**: `PREPPED` removed from `CREATABLE_TYPE_OPTIONS` (both
   desktop/mobile create forms) — can no longer create a bare PREPPED item
   there. Editing an *existing* legacy PREPPED item still works via the full
   `TYPE_OPTIONS`, and the type selector is disabled once set to PREPPED (to
   avoid orphaning a recipe by changing type away from it).
3. **New Prep Recipes tab** (`frontend/app/app/inventory/prep/PrepRecipesTab.tsx`,
   new file) — Manager-only. Lists existing recipes as cards, "New Recipe"
   opens a slide-over form: item name, ingredients (searchable picker +
   quantity), and a "This batch yields" box (Expected Yield + Yield Unit).
4. **Tabs on the Prep Entry page** (`PrepTabs.tsx`, new file) — "Log Prep" /
   "Prep Recipes", Manager-only visibility (Attendants never see a tab bar
   at all, on either shell — confirmed owner decision). Wired into both
   `PrepEntryDesktop.tsx` (Manager desktop) and `page.tsx`'s
   `PrepEntryAttendant` (mobile, both roles — Manager gets tabs, Attendant
   doesn't, same component).
5. **Log Prep pre-fills from the recipe** on output-item selection (both
   desktop and mobile) — ingredient lines + expected yield auto-populate,
   still fully editable. Falls back to blank-slate + rolling-average hint if
   no recipe exists yet for that output item.
6. **New shared component**: `frontend/components/inventory/ItemCombobox.tsx`
   — searchable desktop item picker (type-to-filter dropdown), replacing the
   bare native `<select>` for Output Item and every Ingredient line on
   desktop. Used in `PrepEntryDesktop.tsx` and `PrepRecipesTab.tsx`.
7. **Global fix**: `Input.tsx` and `Select.tsx` both changed from
   `bg-parchment` to `bg-white` at rest — an empty-but-interactive field was
   visually identical to a disabled one everywhere in the product, not just
   Prep Entry. Disabled styling (`bg-stone-100` + `opacity-50`) untouched.
8. **App-wide icon sweep**: every per-item icon tile in every *list* context
   replaced with a plain numbered chip (`index + 1`), per explicit owner
   instruction to do this everywhere, not just Prep Entry. Touched: Prep
   Entry/Recipes pickers, `ItemCombobox`'s dropdown, Item Catalog's PO
   add-item picker, Waste Log, New PO's browse-catalog, PO edit's add-item
   picker, Suppliers' mobile roster. **Deliberately left alone** (non-list,
   single-item contexts): Stock On Hand's movement-history detail panel
   (desktop + mobile), Log Prep's own "what you're preparing"/"what you
   produced" single-selection summary cards.
9. **Quantity input width fix**: `w-32`/`w-36` → `w-40` (desktop) / `w-36`
   (mobile, up from `w-32`) across the recipe form and both Log Prep
   variants — narrow boxes were visually clipping 3-digit quantities with a
   unit suffix (e.g. "623 ml" looked like "3"). Confirmed via a one-off
   owner-directed Playwright check that the underlying input logic was never
   broken, purely a CSS width issue.

**Verification state**: `tsc --noEmit` and `next build` clean (frontend +
backend) as of the last change (icon sweep). Backend test suite green
681/681 (re-run after the `recipeInclude` change specifically). **No fresh
live/visual check has been done since the icon sweep + width fix landed
together** — the owner's last screenshot predates the icon-sweep fix. Do
this first before building anything new.

## What's explicitly left — work through these in order, don't re-ask

1. **`ItemCombobox`'s trigger button still shows an icon.** The *dropdown
   list* inside `ItemCombobox.tsx` already got the icon→number fix, but the
   closed/selected-state trigger button (the always-visible button showing
   the currently chosen item) was missed — still renders an item icon there.
   Quick, well-understood fix: same treatment, just not yet applied. Find it
   in `ItemCombobox.tsx`'s main return, the `<button>` that shows `selected`.

2. **Batch scaling — a real design decision reopened mid-session, resolved,
   just not yet implemented.** This session originally decided recipes are
   "one fixed batch, no scaling" — **that's now superseded**, don't defend
   or re-litigate it. What happened: owner tested a recipe (100ml Chain Kwo
   Soy Sauce + 100L Salit Cooking Oil + 1kg Chicken Breast → expects 10 pcs),
   then in Log Prep entered 5× every ingredient (500ml/500L/5kg) — the yield
   field still showed the flat "Recipe expects 10 pcs," not scaled to the
   obvious 5× batch. **Agreed fix**: expected yield should scale with actual
   ingredient quantities entered, using the **average ratio across all
   ingredient lines** — compute each line's (actual ÷ recipe) ratio, average
   them, scale the recipe's expected yield by that average. This was chosen
   over a "primary ingredient" reference (which would need a new
   recipe-authoring field to mark which ingredient is primary) specifically
   because it needs no new setup and degrades gracefully when lines don't
   scale in perfect lockstep (real prep varies run to run). Implement this
   in the Log Prep pre-fill/live-recalculation logic — likely in both
   `PrepEntryDesktop.tsx` and `page.tsx`'s `LogPrepMobile`, wherever the
   pre-filled expected yield is currently just `recipe.expectedYield`
   verbatim.

3. **Persist scaled-expected-yield alongside `actualYield` on `PrepRecord`.**
   New field needed — likely a Prisma migration (`backend/prisma/schema.prisma`
   → `PrepRecord` model) plus wiring through
   `inventoryTransactionService.recordPrep` (or wherever `PrepRecord` rows
   are actually written — check `prep-record-service.ts`'s `create`, which
   currently delegates entirely to `inventoryTransactionService.recordPrep`).
   Owner explicitly chose storing this over recomputing it live in reports
   at read-time, specifically so a later recipe edit doesn't retroactively
   change historical variance numbers. Follow the project's migration
   workflow in `CLAUDE.md` (`prisma migrate dev` locally, commit the
   generated migration file — never `migrate dev` against anything but a
   local dev DB).

4. **New "Prep History" tab** — a third Manager-only tab alongside Log Prep
   / Prep Recipes (top tabs on the Prep Entry page, per the owner's original
   instruction to keep this out of the sidebar — extend `PrepTabs.tsx`'s
   `PrepTab` union and tab list). Full record of past prep runs: date/time,
   which ingredients + quantities were actually used, actual yield,
   scaled-expected yield (from point 3), and the variance between them. This
   is explicitly the Manager's own detailed per-run log — distinct in
   purpose from the aggregate Reports section (point 5). The existing
   `listPrepRecords`/`GET /prep-records` endpoint already returns full
   `PrepRecordWithLines` data (ingredients, quantities, output, yield,
   `recordedAt`) — check whether it needs anything beyond the new
   scaled-yield field before building new backend surface; it may already
   have everything else needed.

5. **Update the existing Prep Yield report** (Reports section — check
   `docs/context/INVENTORY-FEATURE/INVENTORY_FEATURE_PLAN.md` and
   `inventoryReportRepository`/`getPrepYieldReport` in
   `frontend/services/inventoryService.ts` for what exists today) to
   incorporate the new scaled-expected-yield/variance data. Owner explicitly
   confirmed this should happen in the same follow-on push, not deferred to
   a later Flow 7 (Reports) pass — this is a Flow 3 change to a Flow 7
   screen, not scope creep to avoid.

6. **Do a full live/visual re-verification pass** before or alongside all of
   the above — screenshot Manager desktop (Log Prep + Prep Recipes tabs),
   Manager mobile (same, tabs visible), Attendant mobile (no tabs). Confirm:
   icons are gone from every list, numbers show correctly and sequentially,
   quantity fields no longer clip 3-digit values, the recipe pre-fill banner
   reads correctly. The owner drives this manually via their own browser —
   see the next section.

## Environment / workflow notes

- **Do not use Playwright by default.** The owner has twice rejected Claude
  launching browser automation on its own initiative (see memory
  `feedback_no_playwright_verification` — read it, it supersedes the older
  `feedback_playwright_verification` entry). They drive the browser
  themselves against the running dev servers and share screenshots/feedback
  directly in conversation. The one exception this session: the owner
  explicitly said "use playwright to verify" for one specific, narrow
  question (whether a quantity input was dropping keystrokes vs. just
  visually clipping) — that was a one-off directive, not a standing reversal.
  Default back to manual owner-driven verification unless told otherwise
  again, explicitly, in the moment.
- **Seeded dev accounts actually are** `store.manager@wendo.test` /
  `store.attendant@wendo.test`, password `password123` (from
  `backend/src/scripts/seed-dev.ts`) — the `run-frontend-browser` skill's
  example credentials (`manager1.centralstore@dev.test` etc.) are wrong/stale
  for this repo; don't trust them if you ever do need to script a check.
- **Restart both dev servers after verification passes** — backend
  (`tsx watch src/server.ts` from `backend/`) and frontend (`pnpm dev` from
  `frontend/`), on ports 4000 and 3000. Known gotcha: a stale `next-server`
  process can silently hold port 3000, causing a fresh `next dev` to fall
  back to 3001 while the browser is still pointed at 3000 (looks like a
  "missing required error components" page). Check `ps aux | grep -E "tsx
  watch|server.ts|next dev|next-server"` and kill *all* matching PIDs before
  restarting, not just the most recent one.
- **Nothing from this session is committed.** Check `git status` /
  `git diff` on `feature/inventory-phase1` first — there's a real, working,
  substantial diff sitting uncommitted (backend routes/services/repository,
  new frontend components, edits across ~8 files). Don't assume a clean
  tree; don't blow away uncommitted work.

---

*Handed off 2026-07-30, mid-Flow-3, mid-session — this is not a normal
between-flows handoff. Companion to `UI_UX_DESIGN_AUDIT.md` (the audit brief
— read its Flow 3 findings entry first) and `INVENTORY_FEATURE_PLAN.md` /
`central_kitchen_inventory_model.md` (D-12's original context, now
partially superseded by this flow's work — the "no recipe required" spirit
is kept, but "no path to author one directly" is not).*
