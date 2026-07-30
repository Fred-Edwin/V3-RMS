# UI/UX Design Audit — Handover Prompt

Paste this into a fresh session to continue the Inventory Phase 1 UI/UX design
audit. It was interrupted mid-Flow after Flow 1 (Catalog & Suppliers) and
Flow 2 (PO raise/send/receive) were audited and fixed, but before the audit
log was written up and before Suppliers/Stock on Hand's remaining items were
finished.

---

## Prompt to paste

> Continue the Inventory Phase 1 UI/UX design audit. Read
> `docs/context/INVENTORY-FEATURE/UI_UX_DESIGN_AUDIT.md` in full first — it's
> the brief. Then read this handover note
> (`docs/context/INVENTORY-FEATURE/UI_UX_AUDIT_HANDOVER.md`) for exactly
> where the previous session left off. Do not re-run the owner's original
> mistakes list collection or Flow 1/2's live audit — both are done; see
> below for what's built, what's verified, and what's still open. Pick up
> from the "What's left" section.

---

## What's done (Flow 1 + Flow 2, combined)

The owner brought an initial mistakes list covering both Catalog/Suppliers
(Flow 1) and the PO raise/send/receive loop (Flow 2) together, so both flows
were audited and fixed as one combined pass rather than strictly
sequentially. Findings were confirmed live (Playwright, both roles/shells)
against the actual running app, with root causes traced in code before
fixing — several of the owner's reported symptoms turned out to share one
root cause (see below).

### Confirmed findings → fixes shipped

1. **Icons instead of row numbers** in every table (Dashboard, Item Catalog,
   Stock on Hand) — replaced with numbered columns. Fixed on Dashboard and
   Item Catalog. **Not yet done on Stock on Hand** (desktop `ExcelTable` +
   mobile card list) — see "What's left."
2. **No per-page help affordance** — built `HelpTip`
   (`frontend/components/ui/HelpTip.tsx`), a small `?` icon that opens a
   concise static popover (title + 2-4 sentences), distinct from the
   existing `usePageTour`/`TourButton` guided-tour system (that's a
   different, heavier pattern — click-through spotlight tour — not what was
   asked for here). Wired into Dashboard and Item Catalog headers. **Not yet
   wired into Stock on Hand or Suppliers.**
3. **Dry Yeast (and every fractional-unit item) showing cost as
   "Ksh 0.66/g"** instead of a sensible buy-unit price — root cause: DB
   stores `currentCost` per **usage unit** (correct, required for prep/waste
   costing math), but several screens displayed that raw value to users who
   think in buy-unit terms (a pouch, a jerrican). Built
   `frontend/lib/inventory-format.ts` (`formatBuyUnitCost`,
   `buyUnitCostValue`, `formatBuyUnitQuantity`) as the shared conversion
   layer. Wired into Dashboard, Item Catalog, and the PO item-picker/cart.
   **Not yet wired into Stock on Hand's on-hand-quantity column** (the
   `formatBuyUnitQuantity` helper exists and is ready to use — just needs
   wiring).
4. **Real costing bug in the New PO flow**: draft PO lines were seeding
   `unitPrice` from the raw per-usage-unit `currentCost` while the paired
   `qty` field was labeled/collected in buy units — silently understating
   every draft PO total by the conversion factor (a 500g pouch of yeast
   priced as if it were 1 gram). Confirmed against the backend's own
   `receivePurchaseOrderLine` contract (`unitPrice.div(conversionFactor)` —
   only correct if `unitPrice` starts as a buy-unit price). Fixed in
   `frontend/app/app/inventory/purchase-orders/new/page.tsx`
   (`addLine`/cart display now use `buyUnitCostValue`). Verified end-to-end:
   drafted, saved, reopened — total came out correct (Ksh 1,781.40 for
   1kg flour + 1 pouch yeast, was Ksh 1,449.91 before the fix).
5. **`QuantityInput` unit-suffix visually overlapping the numeric value**
   (this is what read as "the stepper disables after one tap" — there never
   was a stepper, it's a free-text decimal field by design, but a long unit
   label like "pouch (500g)" rendered on top of the value). Root-caused to
   `Input.tsx`'s `rightIcon` reserving a fixed 40px regardless of label
   length. Fixed generically in `frontend/components/ui/Input.tsx` (measures
   the rendered `rightIcon` width via a ref + `useLayoutEffect`, reserves
   exactly that much padding) — benefits every `QuantityInput` usage
   app-wide, not just PO screens. Also widened the fixed-width Qty column in
   the Manager PO edit-lines UI (`w-28` → `w-40`) since that container was
   independently too narrow even after the Input fix.
6. **Cart invisible / "can only add one item"** on the Attendant New PO
   screen — the cart worked functionally (multi-item, editable, removable)
   but was rendered below a long unfiltered 24-item catalog list with zero
   feedback on add. Fixed: added a success toast on add, a highlighted cart
   section with a ref, and a floating "N items" pill (bottom-right, above
   the save bar) that scrolls to the cart on tap.
7. **Supplier `<select>` rendering "weird" on mobile** — it was a bare
   unstyled native `<select>`. Replaced with the design system's `Select`
   component in the New PO screen.
8. **Manager PO panel — no edit, no unsend, no undo on receiving.** This was
   the largest chunk of work; the owner explicitly asked for full backend
   support (not a stub) after two `AskUserQuestion` decisions:
   - **Undo receiving**: reverses via an offsetting `ADJUSTMENT` ledger
     transaction (negative qty at the original receipt's own recorded
     price), not a weighted-average rollback — the weighted average isn't
     cleanly invertible once later receipts may have landed, same accepted
     trade-off as the existing Stock Count adjustment path. New endpoint:
     `POST /purchase-orders/:id/lines/:lineId/reverse-receipt`
     (Manager-only). UI: "Correct this line" button on an already-received
     line.
   - **Edit DRAFT lines**: `PATCH /purchase-orders/:id/lines`
     (Manager-only, DRAFT-only, replaces lines wholesale). UI: "Edit Lines"
     button opens an inline editor (existing lines editable, item picker to
     add more).
   - **Unsend**: `POST /purchase-orders/:id/unsend` (SENT → DRAFT,
     Manager-only, blocked once any line has received — the 409 message
     tells the Manager to reverse receipts first).
   - **Stale-price flag**: DRAFT lines compare their frozen `unitPrice`
     against the item's current buy-unit cost; shows a warning line if they
     differ by more than 1 cent.
   - All four verified live end-to-end, including the ledger effect: Stock
     on Hand's on-hand qty was confirmed to go 2500g → 3000g on receive,
     then back to exactly 2500g / Ksh 1,660.75 on reverse (bit-for-bit match
     with the pre-receive baseline).
9. **Manager should be able to correct a wrong Current Cost** (owner's
   original ask) — decided via `AskUserQuestion` **not** to make the field
   directly editable (would silently break the weighted-average audit
   trail). Built a separate "Adjust Cost" action instead: Manager-only,
   requires a reason, posts a zero-quantity `ADJUSTMENT` transaction (same
   audit-trail pattern as #8's reversal and the existing Stock Count
   adjustments) rather than overwriting silently. New endpoint:
   `POST /inventory-items/:id/adjust-cost`. UI: banknote icon per row in
   Item Catalog, opens a modal (new buy-unit cost + reason). Verified live:
   adjusted Chicken Breast 480→500/kg, catalog total value recalculated
   correctly (+Ksh 670 = 33.5kg × Ksh 20).

### Independent findings (not on the owner's list) — decided, not yet all fixed

- **Suppliers detail panel has no default-supplier assignment UI** despite
  the feature plan calling for one (§8.1 row 3). Not yet fixed — see "What's
  left."
- **Price History interaction is undiscoverable** (click an item name in the
  list — no visual affordance beyond a subtle bold/color change). Owner
  chose "keep, but redesign the interaction" over cutting it. Not yet fixed.
- **Suppliers' empty right-panel is dead space** until a supplier is
  clicked. Not yet fixed.
- AP tab was reviewed and found good — no change needed, explicitly called
  out as something to keep as-is.
- Typography/color/spacing checked against `DESIGN_SYSTEM.md` on every
  screen opened — no violations found anywhere in Flow 1/2.

## Owner decisions on record (don't re-ask these)

1. Current Cost: **not directly editable** — separate audited "Adjust Cost"
   action instead. (Built, shipped.)
2. Price History on Suppliers: **keep, redesign the interaction** — not cut.
   (Decided, not yet built — part of "What's left.")
3. Undo receiving: **reversing ledger entry** (ADJUSTMENT transaction), not
   a blocked/deferred stub. (Built, shipped.)
4. PO edit/unsend scope: **build all three now** (edit, unsend, undo), not
   split across sessions. (Built, shipped.)

## What's left

In rough priority order — the first three are the tail end of Flow 1/2 that
got interrupted before completion:

1. **Stock on Hand (desktop `StockOnHandDesktop.tsx` + mobile)** — row
   numbers, `formatBuyUnitQuantity` for the on-hand column (currently shows
   raw usage-unit qty like "12459.5 ml"), help icon. This was on the
   original todo list and never started.
2. **Suppliers screen** (`frontend/app/app/inventory/suppliers/page.tsx`,
   both desktop `SuppliersPageInner` and mobile `SuppliersMobile`) — still
   needs: default-supplier assignment action (star icon currently only
   displays, never sets), a more discoverable Price History interaction,
   fixing the empty-panel dead space (e.g. pre-select first supplier on
   load), and a help icon. The owner also flagged wanting richer seed data
   to properly judge the "many items per supplier" layout — check whether
   that's still needed before finalizing this screen, or whether Samrat
   Supermarket's 14 items were enough to judge by.
3. **Close-out verification for Flow 1+2 as a whole**: a full
   `npx tsc --noEmit` + `npx next build` pass on the frontend (both were run
   clean individually per-screen during the session, but not as one final
   pass after all screens landed), the backend test suite
   (`npx vitest run` — was at 677/677 passing as of the last backend
   change), and a final Playwright sweep touching every screen in both
   flows, both roles/shells, checking for zero console errors. This is the
   project's own stated convention (CLAUDE.md, and the audit brief's step
   7) — don't skip it even though individual pieces were already verified
   as they were built.
4. **Write the Flow 1+2 entry in the Findings & decisions log** in
   `docs/context/INVENTORY-FEATURE/UI_UX_DESIGN_AUDIT.md` itself (currently
   still says "Not started" for both flows in the Status table) — use the
   template already in that file. This is the actual persistent record;
   this handover doc is scaffolding to get a fresh session oriented, not a
   replacement for it.
5. **Flows 3-7** (Prep entry, Stock counting, Waste logging, Supplier AP,
   Reports) — genuinely not started. No owner mistakes list has been
   collected for these yet; per the audit's own process (§ in the brief),
   collect that first for the next flow before auditing independently.

## Known environment gotcha hit this session

The backend dev server (`tsx watch src/server.ts`) can end up with **two
process lineages running simultaneously** if a previous restart attempt
didn't fully kill the old one — `ss -tlnp | grep :4000` shows only the
process currently bound to the port, but a stale sibling can still exist and
confusingly serve requests if the bound one dies later, or vice versa. If a
newly-added route 404s right after adding it despite the code being
correct, check `ps aux | grep -E "tsx watch|server.ts"` for multiple
lineages (not just multiple PIDs — `tsx watch` spawns a `sh -c` → `node`
chain, so 3-4 PIDs is normal *for one* lineage) and kill everything, then
start fresh with a single `nohup npx tsx watch src/server.ts &`. This is
what happened when the Adjust Cost endpoint first 404'd — killing all
lineages and restarting once resolved it immediately, with zero code
changes.

## Files touched this session (all uncommitted — working tree only)

Backend: `purchase-order-{service,controller,routes,repository}.ts` +
`.test.ts`, `inventory-item-{service,controller,routes}.ts` + `.test.ts`,
`inventory-transaction-repository.ts`, `purchase-order-schemas.ts`,
`inventory-item-schemas.ts`.

Frontend: `components/ui/Input.tsx`, `components/ui/HelpTip.tsx` (new),
`components/ui/index.ts`, `lib/inventory-format.ts` (new),
`services/inventoryService.ts`, `types/inventory.ts`,
`app/app/inventory/dashboard/page.tsx`,
`app/app/inventory/catalog/page.tsx`,
`app/app/inventory/purchase-orders/new/page.tsx`,
`app/app/inventory/purchase-orders/PurchaseOrdersDesktop.tsx`.

Nothing has been committed yet — the fresh session should decide with the
owner whether to commit Flow 1+2 as its own commit before continuing to
Suppliers/Stock on Hand, or bundle everything into one commit once the flow
is fully closed out.
