# S0 — Component inventory session, Inventory Milestone Two (Receiving & Supplier AP)

Paste everything below the line to the agent running this session. This is a
**Step 4 component-extraction session** (`FEATURE_REDO_PLAYBOOK.md` §5, Step
4) — not Step 5 planning (already done, see `milestone-2-plan.md`) and not a
Step 7 build session. Stop when `04-components.md`'s Milestone Two section
exists, every item below is built and pixel-diff-verified, and its Status
table is updated. Do not start writing endpoints, schema, or screen-assembly
code — that's S1 onward, and depends on this session's output.

---

You are running **S0** of Inventory Milestone Two's Step 7 session breakdown
(`docs/features/inventory/milestone-2-plan.md` §5). Milestone Two's Step 5
plan is owner-approved. Your job is the component audit and build that every
later session (S1–S9) depends on — the same discipline Milestone One ran
before its own build sessions, recorded in `docs/features/inventory/
04-components.md`.

**Read first, in this order:**
1. `docs/features/inventory/milestone-2-plan.md` §6 (the full component
   audit already done this session — do not redo it from scratch, build from
   it) and §3a (the states table, which feeds into this session's scope too).
2. `docs/features/inventory/04-components.md` — read the whole doc, not just
   the Milestone One section: §"Placement rules" (loading/error/empty state
   rules, persistent-shell rules, nav-link rules — non-negotiable, not
   per-feature judgment calls), §"Pixel-diff verification" (the objective
   check every new composite must pass before being marked done), and the
   Milestone One section itself (the precedent — what "done" looks like in
   this doc).
3. `docs/FEATURE_REDO_PLAYBOOK.md` §4 (Step 4's own description) and §9
   (folder structure — where new code lands).
4. `docs/DESIGN_SYSTEM.md` for token conventions.

## What's already decided — don't re-derive it

The plan's §6 audit already read the actual codebase (not assumed from
Paper alone) and sorted every component Milestone Two's ten screens need into
three tiers. Start from this, don't repeat the audit:

**Reuse as-is, zero new build** (plan §6.1): KPI Strip, Drawer Shell,
Inventory Shell, Skeletons (as a primitive to compose from, not a
per-screen skeleton itself), Supplier Form, Table primitive, Status Dot,
Toggle Group, Search Input/Combobox/Select, Mobile Hub Header/Task
Header/Status Bar. Confirm each still fits as you build around it; flag to
the owner if one doesn't, rather than silently reshaping it.

**Related but not reusable as-is** (plan §6.2):
- The existing `restock-level-grid.tsx` is a useful **pattern reference**
  for row layout and platform-specific tone conventions, but the Goods
  Receipt line grid needs a different shape (qty + unit chip + price +
  computed subtotal + inline price-alert badge per row) — build fresh,
  informed by the pattern, not by extending the existing component's props.
- The existing `shell-states.tsx` desktop Empty/Loading/Error/
  PermissionDenied cards are a fixed 320×220 card — reuse verbatim for
  desktop. **They do not resize for mobile.**

**Genuinely new — build this session** (plan §6.3, the core of this
session's scope):

| # | Composite | Screens it serves | Where to find its Paper reference | Notes |
|---|---|---|---|---|
| 1 | **Signature font token** | Sign sheet, signed Goods Receipt detail | `--font-signature: 'Alex Brush', cursive` — already in Paper's token list (confirmed via `get_basic_info`), **not yet in `frontend/app/tokens.wds.css`** (confirmed by grep) | Build this **first** — everything else that renders a signature depends on the font actually loading. Add the font load + the token to `tokens.wds.css` and the Tailwind preset before anything else in this table. |
| 2 | **Sign sheet** (PIN entry + locked post-sign state + signature render) | New Goods Receipt (sign & save action), Goods Receipt detail (signed) | **Not cloned onto page `C-0`.** Open Paper page `4-0` ("F1 Inventory · Store Manager") and find the mid-signature / signed-state artboards for the equivalent Goods Receipt flow there (the milestone doc references a `3YT-0`-style mid-signature state and an `8CJ-0`-style signed detail on that page — confirm the exact node IDs by browsing the page, they may differ slightly). This is the single largest net-new build in the milestone — nothing resembling it exists anywhere in `frontend/`, confirmed by grep. | Needs a new PIN-entry primitive (check shadcn's options before hand-building) plus the signature-font render. |
| 3 | **Receipt Line Grid** | New Goods Receipt (`UQE-0`) | `UQE-0`, page `C-0` | Build fresh per §6.2 above — use `restock-level-grid.tsx` as the row-layout pattern reference only. |
| 4 | **Bundling checkbox list** (receipts-to-bundle / invoices-to-allocate) | Record supplier invoice (`UZJ-0`), Record supplier payment (`V7Z-0`) | `UZJ-0`, `V7Z-0`, page `C-0` | Both screens use the identical pattern (checkbox rows + a running total that recomputes live) — build once, use in both places. |
| 5 | **Mismatch/dispute callout** | Record supplier invoice | `UZJ-0` | Warning-toned callout, two action buttons (Hold / Record at billed — open dispute). |
| 6 | **"How overdue" bucket table** (five columns: current / 1-30 / 31-60 / 61-90 / 90+) | Suppliers screen (what we owe) | `VGE-0`, page `C-0` | Five-bucket set is settled (plan §7 Q4) — build one bucket-cell component the Suppliers screen and Supplier detail both use (item 7), not two separate layouts. |
| 7 | **"What we owe" bucket panel** | Supplier detail | `VND-0`, page `C-0` | Four visible columns (merges the last two buckets for display) — same underlying bucket data as item 6, never a separate four-bucket calculation. |
| 8 | **Mixed-type Inbound/History row** | Purchasing hub | `U7V-0`, page `C-0` | Renders an `ExpectedDelivery` row and a `GoodsReceipt` row in the same table with different fields per type (estimate rows show `~KES`, receipt rows show exact amounts and are hidden entirely from `STORE_ATTENDANT` — see plan §3.1) — a discriminated-union row renderer, not two separate tables glued together. |
| 9 | **Mobile universal states** (`mobile-states.tsx`) | Every Milestone Two mobile screen | `X7O-0`, page `3-0` (the existing cross-feature reference — not new to Milestone Two, but never built) | Lands in `frontend/components/app/shell/`, **not** under `features/inventory/` — this is cross-feature shell, same category as `mobile-headers.tsx`/`mobile-status-bar.tsx` already there. |

## What's changed since the plan was written — apply these, don't re-derive

Three owner decisions landed after the plan's first draft and change what you
build:

- **`IN TRANSIT` is dropped from the Purchasing hub, not deferred.** If the
  `U7V-0`/`WK4-0`/`WPL-0`/`WUL-0` artboards you're reading still show a
  fourth KPI tile for it, build against **three tiles** (Expected, Awaiting
  invoice, Owed) and flag to the owner that those artboards need a redraw —
  don't build the fourth tile "to match Paper" here.
- **Terminology: build with "What we owe" / "How overdue" in every
  user-facing label**, not "Supplier AP" / "Aging" — even where an artboard's
  own text still says the old wording (Paper hasn't been relabeled yet; code
  should be ahead of it here, not behind).
- **No bespoke loading/error artboards exist for the Suppliers screen or
  Supplier detail** (screens 8 and 9) — confirmed by reading the full `C-0`
  artboard list; only the Purchasing hub got a drawn loading/error pair.
  Build the generic screen-mirroring skeleton default for both (per
  `04-components.md`'s placement rules) rather than waiting on artboards that
  aren't planned.

## Process — the same one `04-components.md` already specifies, applied here

For every item in the "genuinely new" table:
1. **Add the base shadcn/ui primitive via its own CLI** where one applies
   (`npx shadcn@latest add <component>`, into `components/ui2/`) — never
   hand-write a primitive shadcn ships. Most of these items are composites
   built *from* existing `ui2/` primitives; item 2's PIN entry is the one
   likely candidate for a genuinely new primitive — check shadcn's set first.
2. **Read the exact Paper node's computed styles** — `get_computed_styles`,
   `get_node_info`, `get_jsx` on the real artboard node. Never source a value
   from a screenshot; a screenshot verifies the result afterward, it doesn't
   supply the numbers.
3. **Map every value to an existing design token.** Never a bare magic number
   when a token already covers it (`docs/DESIGN_SYSTEM.md`).
4. **Build the composite** in `frontend/features/inventory/components/`
   (or `frontend/components/app/shell/` for item 9, and the font-load part of
   item 1).
5. **Pixel-diff it** — `get_screenshot` of the Paper node vs. a screenshot of
   the running component — before marking it done. Follow
   `04-components.md`'s existing verification process exactly; don't invent a
   new bar.
6. **Log it in `04-components.md`'s Status table**, under a new "Milestone
   Two" heading matching the doc's existing per-milestone structure — Paper
   reference, diff result, date. This is a live build log, not a one-time
   note; update it as each item completes, not all at the end.

## Order of operations

Build item 1 (font token) before item 2 (Sign sheet) — everything that
renders a signature depends on it. Item 6 before item 7 (build the shared
bucket-cell component once, then the two panels that consume it). Otherwise
the order among items is your judgment; there's no other hard dependency.

## Non-negotiables (restating, don't violate these)

- `components/ui2/` is design-system only — no feature logic. Composites
  that are Inventory-specific go in `features/inventory/components/`, not
  `ui2/`. Cross-feature shell (item 9, and the font/token part of item 1)
  goes in `components/app/shell/` or `frontend/app/tokens.wds.css`
  respectively — never under a feature folder.
- Never touch `components/ui/` (the legacy, frozen set).
- TypeScript strict, no `any`.
- A group of screens sharing one sidebar needs a route-group `layout.tsx`,
  not each screen mounting its own shell (`04-components.md`'s persistent-
  shell rule) — relevant once S5/S6/S8 assemble full screens from what you
  build here, but keep it in mind if this session's work implies a shell
  boundary.

## Stop condition

Every item in the "genuinely new" table exists in code, pixel-diff-verified
against its Paper reference, and logged in `04-components.md`'s Status table
under a new Milestone Two heading. Do not start S1 (schema/migration) or any
other Step 7 build session — that's separate work this session unblocks, not
extends.
