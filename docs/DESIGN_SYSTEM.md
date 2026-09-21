# Wendo RMS — Design System

**Status:** Active (Phase 0 foundation)
**Owner:** Edwinfred Kamau
**Established:** 2026-09-09
**Design source of truth:** Paper file `01M1ZZJ6S3FZGF5C7PPBGTKY89`
**Code:** `frontend/app/tokens.wds.css` + `frontend/tailwind.wds.preset.ts` + `frontend/components/ui2/`

This document is the reference for every UI decision in the feature-by-feature
redo (see `docs/FEATURE_REDO_PLAYBOOK.md`). It is living: extended as the
component set grows, never re-litigated for taste once a token is approved.

The pre-redo "warm" design system is archived at `docs/archive/phases/` — do not
resurrect it.

---

## 1. Direction

Premium enterprise product. The bar is Linear, Stripe, Apple, Google. Dense but
legible; every element deliberate. Crisp, not round — sharp or minimal radii,
clean lines, ledger-like. Restrained: a few considered details that signal a
designer sat and thought about this, never decoration for its own sake.

**Mood:** the palette is coffee-inspired, but only where colour carries meaning —
the accent, the sidebar, semantic warnings. **Surfaces stay clean.** The canvas
is a true near-white; there is no warm tint on any working surface.

---

## 2. The `wds-` prefix (transitional)

Every token, Tailwind key, and utility in this system is namespaced `wds-`
(`--wds-espresso-700`, `bg-wds-canvas`, `text-wds-body`, `rounded-wds-sm`). This
is **temporary**. It exists so the new system runs alongside the legacy warm
theme (`tailwind.config.ts` colours, `components/ui/`) without name collisions
during the migration.

When the last feature migrates off `components/ui/`, one cleanup pass:
- deletes the legacy colour keys from `tailwind.config.ts`,
- folds `tailwind.wds.preset.ts` into the main config,
- folds `app/tokens.wds.css` into `globals.css`,
- find-and-replaces `wds-` → clean names everywhere,
- renames `components/ui2/` → `components/ui/`.

Until then: prefix everything. Consume the Tailwind `wds-*` utilities in feature
code, not the raw CSS variables (raw `var()` is only for gradient composition).

---

## 3. Colour

Authored in **OKLCH** (`frontend/app/tokens.wds.css` is the source of truth;
each line carries a reference hex). OKLCH keeps the ramps perceptually even and
lets gradients interpolate cleanly between two browns. Shipped as `oklch()`
directly — the app targets evergreen browsers only.

### 3.1 Neutrals — warm-cast near-neutral

The hue is held constant with a ~2° lean toward brown so the greys never fight
the espresso accent. **No warmth is visible on any surface** — the cast only
reads when two greys sit side by side.

| Token | Hex | Role |
|---|---|---|
| `wds-neutral-0` | `#FCFCFC` | canvas / page background |
| `wds-neutral-50` | `#F6F5F3` | subtle fill (sunken surface, striped rows) |
| `wds-neutral-100` | `#EEEDEA` | hover fill |
| `wds-neutral-200` | `#E4E2DE` | **border** (default hairline) |
| `wds-neutral-300` | `#D2CFC9` | strong border (inputs, dividers under emphasis) |
| `wds-neutral-400` | `#A8A39B` | placeholder text, disabled glyphs |
| `wds-neutral-500` | `#847E76` | muted text |
| `wds-neutral-600` | `#635E57` | secondary text |
| `wds-neutral-700` | `#47433D` | heading (when not full ink) |
| `wds-neutral-800` | `#2E2B27` | **body text** |
| `wds-neutral-950` | `#171512` | ink — titles, table header rules |

### 3.2 Espresso — primary accent

Anchored on **`#693C1B`** (700 / DEFAULT) — a rich, roasted-bean brown.
Structural: primary buttons, active nav, focus rings, links, checked controls.

| Token | Hex | Role |
|---|---|---|
| `wds-espresso-50` | `#F8F2EC` | tint — active-row background, hover on ghost |
| `wds-espresso-100` | `#EEDDCC` | hover tint, count-badge foreground |
| `wds-espresso-200` | `#DDBE9E` | tint border |
| `wds-espresso-400` | `#B98A5E` | disabled primary |
| `wds-espresso-600` | `#8B5A32` | primary hover, **gradient top** |
| `wds-espresso-700` | `#693C1B` | **primary** (DEFAULT) |
| `wds-espresso-800` | `#4E2C14` | pressed |
| `wds-espresso-900` | `#33200F` | deepest step |

### 3.3 Caramel / crema — secondary accent

Same hue family, higher lightness and chroma. **Grace notes only — never a
fill.** Nav group underlines, KPI trend indicators, "new" markers, chart series.
It stays meaningful by staying rare.

| Token | Hex | Role |
|---|---|---|
| `wds-caramel-100` | `#FCF2E4` | faint wash (rare) |
| `wds-caramel-300` | `#EFCF9E` | — |
| `wds-caramel-500` | `#D9A65E` | **DEFAULT** — nav divider, active-item marker |
| `wds-caramel-600` | `#B5823E` | caramel as text on white (AA) |
| `wds-caramel-700` | `#8C6230` | — |

### 3.4 Semantic

Conventional hues; the warm two (warning, error) lean a few degrees toward the
coffee family so the whole palette reads as one. Each has **fg** (text/icon),
**bg** (subtle fill), **border**.

| Semantic | fg | bg | border |
|---|---|---|---|
| success | `#2F6438` | `#EEF4EC` | `#CADFC6` |
| warning | `#8A5A16` | `#FBF2E4` | `#E7D3AC` |
| error | `#97281D` | `#FBEDEB` | `#E6BEB7` |
| info | `#2C5670` | `#ECF2F5` | `#C1D4DF` |

Tokens: `wds-success-fg` / `-bg` / `-border`, and likewise `wds-warning-*`,
`wds-error-*`, `wds-info-*`.

### 3.5 Role aliases

Semantic aliases used across components, so component code never hardcodes a
scale step:

`wds-canvas`, `wds-surface` (`#FFFFFF`), `wds-surface-sunken`, `wds-border`,
`wds-border-strong`, `wds-text` / `-secondary` / `-muted` / `-ink`,
`wds-primary` / `-hover` / `-pressed` / `-fg`, `wds-ring` (espresso-700 @ 40%).

### 3.6 Sidebar tokens

The nav rail has its own tokens — **not** aliased to espresso-900, so it can be
tuned independently.

| Token | Value | Role |
|---|---|---|
| `wds-sidebar-top` | `#4A290E` | gradient top (warm-dark coffee) — **revised 2026-09-21** (Milestone Four owner pass), was `#2E1806`; richer/more saturated |
| `wds-sidebar-upper-mid` | `#381E09` | gradient upper-mid — **new 2026-09-21**, transition stop between top and mid |
| `wds-sidebar-mid` | `#2C1707` | gradient mid — unchanged |
| `wds-sidebar-bottom` | `#0F0601` | gradient bottom (near-black) — unchanged |
| `wds-sidebar-fg` | `#B5AEA5` | nav item text (inactive) |
| `wds-sidebar-fg-active` | `#F5F3EF` | active item text (brighter) |
| `wds-sidebar-fg-muted` | `#8A7F76` | group label · inactive icon stroke |
| `wds-sidebar-underline` | caramel-500 | **active item underline (1.5px, under the label only)** |
| `wds-sidebar-icon-active` | caramel-500 | active item icon stroke |
| `wds-sidebar-badge-bg` / `-fg` | espresso-700 / espresso-100 | count badge |

> **Revised 2026-09-09.** The active item is now **brighter text + a 1.5px
> caramel underline under the label**, and the active icon takes the caramel
> stroke. There is **no fill and no left marker**. Group labels **no longer have
> a caramel hairline** — they are just quiet caps overlines. Nav items carry a
> 15px line icon (1.75 stroke, `wds-sidebar-fg-muted` when inactive). The
> `-divider`, `-marker`, and `-active-bg` tokens are retired.

### 3.7 Chart palette — validated, not eyeballed

**Added 2026-09-14**, authorized during the Inventory reports pass. The
brand accents (espresso, caramel) **fail as chart marks** — confirmed with
`scripts/validate_palette.js` (bundled with the `dataviz` skill): both are
too low-chroma at the values needed for data marks and read as gray rather
than as color. Charts use a **separate, validated blue ramp** instead, kept
deliberately apart from the UI's espresso/caramel identity.

| Token | Value | Role |
|---|---|---|
| `wds-chart-1` | `#0D366B` | darkest — the largest value / primary series |
| `wds-chart-2` | `#1C5CAB` | second step |
| `wds-chart-3` | `#5598E7` | third step |
| `wds-chart-4` | `#9EC5F4` | lightest — the smallest value / quietest series |
| `wds-chart-problem` | `#E34948` (fg) / `#97281D` (text) | reserved strictly for a genuine problem number — never a neutral or informational one |

**Rules:**
- **One hue family per chart.** Rank or weight within the chart by shade
  (darkest = largest/primary, lightest = smallest), not by switching hues.
  A chart with 4+ flat, competing hues was tried and explicitly rejected —
  "ugly, absolutely not." If a second series is genuinely needed (e.g. a
  real current-vs-compare-period pair), use a lighter/ghosted step of the
  same ramp for the comparison series, never a second hue.
- **The problem-red pair is exclusive** — apply it only to a cell, KPI, or
  chart mark that represents an actual problem (a threshold breach, a
  genuine loss, a below-norm result). Never decorate a merely-present
  number with it.
- **Prefer a ranked horizontal bar** for "which items/things are the
  problem" questions (thin bars, generous row rhythm, mono value labels at
  bar end, quiet neutral track `wds-surface-sunken` behind each bar) over a
  waterfall or a decorative flow chart — validated during this pass: a
  waterfall was built, reviewed, and rejected as less useful and less
  premium-reading than the ranked-bar alternative for the same data.
- Before introducing any new hue combination beyond this ramp, validate it
  with `node scripts/validate_palette.js "<hex,hex,...>" --mode light` — do
  not eyeball a chart color choice.
- Load the `dataviz` skill before designing any new chart.

---

## 4. Typography

**Geist** for all UI text — humanist, warm, quietly distinctive.
**Geist Mono** for every number, ID, currency, code, and micro-label (the ledger
voice). Loaded via the `geist` npm package (self-hosted, no network fetch);
families are `font-wds-sans` / `font-wds-mono`.

Weights: **400** regular, **500** medium, **600** semibold. Nothing heavier —
density comes from scale and spacing, not weight.

| Token | Size / line-height | Weight | Tracking | Use |
|---|---|---|---|---|
| `text-wds-display` | 34 / 40 | 600 | −0.02em | page title |
| `text-wds-h1` | 26 / 32 | 600 | −0.02em | section title |
| `text-wds-h2` | 20 / 26 | 600 | −0.015em | subsection |
| `text-wds-h3` | 16 / 22 | 600 | — | card / group heading |
| `text-wds-body` | 14 / 20 | 400 | — | body copy |
| `text-wds-body-sm` | 13 / 19 | 400 | — | **table cell default** |
| `text-wds-label` | 13 / 16 | 500 | — | form label |
| `text-wds-caption` | 12 / 16 | 400 | — | metadata, timestamps |
| `text-wds-overline` | 11 / 14 | 600 | +0.06em | ALL-CAPS section labels |
| `text-wds-mono` | 13 / 18 | 400 | — | numerics, IDs, currency |
| `text-wds-mono-sm` | 11 / 14 | 400 | — | dense mono (badges, SKU) |

---

## 5. Spacing

4px base. Only the steps the system uses:

`wds-0.5` 2 · `wds-1` 4 · `wds-2` 8 · `wds-3` 12 · `wds-4` 16 · `wds-5` 20 ·
`wds-6` 24 · `wds-8` 32 · `wds-10` 40 · `wds-12` 48 · `wds-16` 64

**Defaults:** table row padding 8/16 · card padding 16–20 · page gutter 24 ·
section gap 24–32 · control height **32** (sm 28, lg 36).

---

## 6. Radii — crisp. Ceiling is 6px.

| Token | Value | Use |
|---|---|---|
| `rounded-wds-none` | 0 | table cells, table rows |
| `rounded-wds-sm` | 2px | buttons, inputs, chips, count badges |
| `rounded-wds-md` | 4px | cards, panels, popovers |
| `rounded-wds-lg` | 6px | modals, sheets |
| `rounded-wds-full` | 9999px | avatars, status dots |

---

## 7. Elevation — border first

Depth is a **1px border** by default. A shadow appears only when something
genuinely floats above the page.

| Token | Value | Use |
|---|---|---|
| flat | `border border-wds-border` | cards, table, panels |
| `shadow-wds-sm` | `0 1px 2px rgb(23 21 18 / 0.05)` | dropdown, tooltip, toast |
| `shadow-wds-md` | `0 4px 12px -2px rgb(23 21 18 / 0.10)` | popover |
| `shadow-wds-lg` | `0 8px 24px -6px rgb(23 21 18 / 0.14)` | modal, command palette |
| `shadow-wds-sheen` | `inset 0 1px 0 rgb(255 255 255 / 0.08)` | pairs with the primary gradient |
| `shadow-wds-ring` | `0 0 0 3px var(--wds-ring)` | focus ring |

---

## 8. Gradients

Nine named gradient tokens. **Every stop references a colour-scale token** —
never a raw hex — so a ramp retune flows through, with two documented bespoke
stops (`primary-btn-start`, `primary-btn-end`) that sit off the espresso scale
on purpose (see §2). Interpolated `in oklab` for clean brown-to-brown
transitions. Used **only** on the surfaces below; everything else is flat.
Table rows, inputs, badges, dropdowns, modals, status dots stay flat.

| Token | Where | Direction | Stops |
|---|---|---|---|
| `bg-wds-gradient-sidebar` | nav rail | 169° | sidebar-top @0.2% → upper-mid @35.68% → mid @50.1% → sidebar-bottom @100% — **revised 2026-09-21** (Milestone Four owner pass): added the upper-mid stop and richened the top stop (see §3.6); mid and bottom unchanged. Applies to every sidebar app-wide, not just new screens. |
| `bg-wds-gradient-primary` | primary button, active nav marker | 180° | `primary-btn-start` (`#B0610F`, bespoke) → `primary-btn-end` (`#4A1D00`, bespoke) (+ `shadow-wds-sheen`) — **revised 2026-09-21** (Milestone Four owner pass): was espresso-700 → primary-btn-end; the richer, more saturated top stop gives more contrast against light surfaces. Applies to every primary button app-wide, not just new screens. |
| `bg-wds-gradient-primary-hover` | primary button hover | 180° | one step lighter each stop |
| `bg-wds-gradient-secondary-btn` | secondary (white/outline) button | 180° | neutral-0 → neutral-200 — **new 2026-09-21.** Pair with a `border-strong` outline. More pronounced than `surface-raise` (below) since an interactive button needs to visibly read as raised/pressable; `surface-raise` is for static cards. |
| `bg-wds-gradient-secondary-btn-hover` | secondary button hover | 180° | neutral-50 → neutral-300 |
| `bg-wds-gradient-secondary-btn-pressed` | secondary button active/pressed | 180° | neutral-100 → neutral-400 |
| `bg-wds-gradient-surface-raise` | KPI / stat cards | 180° | `#FFFFFF` → espresso-50 (~2%) |
| `bg-wds-gradient-topbar` | top bar | 180° | `#FFFFFF` → espresso-50 |
| `bg-wds-gradient-scroll-scrim` | under top bar on scroll | 180° | `rgb(ink / 0.05)` → transparent, 8px tall |
| `bg-wds-gradient-brand` | logo tile only | 135° | espresso-600 → espresso-800 |
| `bg-wds-gradient-skeleton` | loading placeholders | 90° animated | neutral-100 → 50 → 100 (**not** espresso) |

The skeleton gradient falls back to a flat `neutral-100` under
`prefers-reduced-motion` (handled in `tokens.wds.css`).

**Secondary button states are gradients, not flat fills** (revised
2026-09-21) — a disabled secondary button stays flat (`neutral-100`, no
gradient, `text-faint`, plain `border` not `border-strong`) since disabled
elements should read as inert, not raised.

---

## 9. Status — dot + label, no fill

The row/entity status indicator is **a 6px dot + a label, both in the same
semantic colour**. No background, no border, no pill. The dot carries the
colour; the label carries the meaning.

Component: `<StatusDot tone="success|warning|error|info|neutral">In stock</StatusDot>`
(`frontend/components/ui2/status-dot.tsx`).

Filled/bordered badges are reserved for **counts** (`<Badge>` — nav, tabs) and
the semantic-tag variants of `<Badge>` where a block of colour is genuinely
wanted. Default to `StatusDot` for anything that reads down a table column.

---

## 10. Component set (`components/ui2/`)

Built on shadcn/ui primitives (added via its CLI, then restyled onto these
tokens). Never add to the legacy `components/ui/`.

**Built in Phase 0:** button, input, badge, card, separator, skeleton, label,
status-dot.

**Built since, as features needed them:** table (real `<table>` markup, not
div/flex — column alignment is the browser's table-layout algorithm, not
manual `min-width:0`/fixed-width bookkeeping), select, combobox, checkbox,
sheet, dropdown-menu, avatar, toggle, toggle-group, input-otp, search-input,
confirm-dialog. **Always check `frontend/components/ui2/` before assuming a
primitive doesn't exist or building a one-off** — this list is a record of
what shipped, not a queue.

**Still genuinely missing** (per feature, as screens need them — restyle each
to the Paper design at that point): tabs, toast, tooltip, form, radio, popover,
command, scroll-area, a general (non-confirm) dialog.

**App composites** (in `components/<feature>/`, built on `ui2/`): sidebar nav,
KPI strip, ledger table, KDS/BDS card — designed per feature in Paper.

### Button variants
`primary` (espresso gradient + sheen) · `secondary` (white + strong border) ·
`ghost` (text + neutral-100 hover) · `destructive` (error-fg fill) · `link`.
Sizes: `default` h-32, `sm` h-28, `lg` h-36, `icon` 32×32.

### Card
`<Card raised>` swaps the flat white surface for `bg-wds-gradient-surface-raise`
— use for KPI / stat cards.

---

## 11. Navigation pattern

A proper **sidebar**, not a bottom nav. On mobile it collapses to an icon rail
(never a "More" menu with a pile of links). The rail:

- background: `bg-wds-gradient-sidebar` — four warm-brown oklab stops, revised
  2026-09-21 (`oklab(31.9% 0.034 0.053)` @0.2% → `oklab(26.7% 0.028 0.043)`
  @35.68% → `oklab(22.9% 0.024 0.036)` @50.1% → `oklab(13.6% 0.011 0.022)`
  @100%). **No bare-percentage colour hints** in the gradient string — every
  percentage here is attached directly to a stop's `var(...)`, never left bare;
  Paper (and some engines) turn a bare hint into an implicit grey/black stop.
- nav items grouped; each group has a quiet **ALL-CAPS label**
  (`text-wds-overline`, `wds-sidebar-fg-muted`). **No hairline** (removed
  2026-09-09).
- each nav item carries a **15px line icon** (1.75 stroke), `wds-sidebar-fg-muted`
  when inactive.
- **active item: brighter text (`wds-sidebar-fg-active`) + a 1.5px caramel
  underline under the label only** (`wds-sidebar-underline`); the icon takes the
  caramel stroke. **No fill, no left marker.** Espresso count badge if it has a
  count.
- the brand tile uses `bg-wds-gradient-brand`

---

## 12. Density

Information-dense by default. 32px controls, 13px table text, 14px body, tight
section rhythm. This is a tool people use all day — favour more data on screen
over generous whitespace, but never at the cost of legibility (all fg colours
clear WCAG AA on `wds-neutral-0`; espresso-700 on white is 8.9:1).

---

## 13. Color as an exception signal, not decoration

Codified from the Milestone Four screen-review pass (2026-09-21) — a data-dense
review/approval screen (Branch Manager approval view) went through several
rounds of "too many colours, too cluttered" before converging on the rules
below. Apply these to any screen with a list of records the user is scanning
for what needs their attention (approval queues, review tables, reconciliation
views) — not to marketing surfaces or hero moments.

**Rule: spend colour on the exception, not on the row.** A screen where every
row carries a tint, a border, and a status dot teaches the eye that nothing is
more important than anything else. Default state is quiet plain text; colour
(the primary accent, a border, a bold label) is reserved for the one thing
that actually changed or needs a decision. If more than ~20% of visible rows
are coloured, the colour has stopped meaning anything — fix the data shown,
not the palette.

- **Editable table values:** unedited/default values render as plain text, no
  border, same weight as their neighbouring read-only columns — still fully
  interactive (click to edit), the box just doesn't announce itself until the
  value actually differs from its source. Only a genuinely edited value gets a
  visible bordered field + `wds-primary` accent.
- **Grouping/hierarchy (e.g. category → subcategory → item):** convey with
  **indent + type size/weight only**, never colour. Each level down steps one
  notch quieter (smaller, lighter, or more muted) and one step further
  indented. Reserve accent colour for the thing that needs action, not for
  structural nesting.
- **Section/record separation** (e.g. department blocks in a list): a
  **hairline + whitespace**, not a bordered card with a tinted header fill.
  Cards-with-fills read as "5 equally important boxes"; a hairline + heading
  weight reads as "5 sections of one document," which is usually the correct
  hierarchy when one status (Kitchen: 1 line changed) matters more than the
  other four (as requested).

### Three-tier hairline system

When a screen has structural dividers at more than one level (e.g. between
sections vs. between rows within a section), give each tier a distinct,
deliberately-ordered weight — don't reuse one hairline colour everywhere:

1. **Strongest** — the primary structural divider (e.g. the column split in a
   master–detail layout). `wds-neutral-800`.
2. **Medium** — between top-level records/sections (e.g. between department
   blocks). `wds-neutral-800` (same tier as #1 is acceptable when there's no
   third level to distinguish it from).
3. **Faintest** — between individual rows inside one section/table.
   `wds-neutral-200`. Barely-there; its job is rhythm, not separation.

### No stacking inside a dense table row

A row in a dense table is **one horizontal line** — every value that belongs
to that row (category label, item name, a short annotation like "added from
note") lives in the row, aligned to its column. Never stack a second line
under a row (e.g. an edit-reason on its own line below the item) — it breaks
vertical rhythm and makes row height inconsistent down the table. If content
doesn't fit inline, **truncate with ellipsis and reveal the rest on
hover/click** — don't wrap it into a second line.

### Column alignment is a flex-basis discipline, not a visual check

Numeric/fixed-width columns in a row-based table must share an identical
`width` + `flexShrink: 0` across the header and every row — but that alone
isn't sufficient. **Every variable-width cell before them (the Item cell, an
inline category-prefix label) must also carry `min-width: 0` and
`overflow: hidden`.** Without `min-width: 0`, a flex child's intrinsic content
width can silently overflow its flex-basis and push every column after it out
of alignment — the box model looks correct in isolation but rows visibly drift
against each other and against the header. When a category/subcategory label
prefixes an item name inline (e.g. `CHICKEN · Grilled Chicken Portion`), give
the prefix itself a shared fixed width too, or rows with longer category names
will start their item text at a different x-position than rows with shorter
ones.

### Expand/collapse affordance: prefer reusing existing text over a new icon

Before adding a chevron/caret to signal "this expands," check whether an
element already on the row (a line count, a submitter name, any metadata
already rendered) can double as the click target — underline it on hover
instead of introducing new icon vocabulary. Reserve a dedicated
expand/collapse glyph for cases where no existing text can plausibly serve as
the trigger.

### Table header contrast

Column header labels (`ITEM`, `ON HAND`, …) must read clearly against the
page background at a glance — `wds-neutral-600` (muted) + semibold, not
`wds-neutral-400` (faint). Faint is for de-emphasised body content, not for
labels the user relies on to parse a table.

---

## Change log

- **2026-09-09** — Phase 0. Foundation established: neutrals, espresso + caramel
  accents, semantic set, Geist/Geist Mono type scale, spacing, radii, elevation,
  six gradients, dot+label status. `components/ui2/` seeded with 8 primitives.
- **2026-09-09** — Inventory Slice A design (Step 3). Sidebar active-item
  treatment changed to **brighter text + caramel underline** (no fill, no
  marker); group hairlines removed; line icons added. `-sidebar-divider`,
  `-marker`, `-active-bg` retired. New shared primitives for the redo: the
  **right-side drawer** (`sheet`) and the **hub-landing shell** — see
  `docs/features/inventory/02-screens.md` § Consolidation.
- **2026-09-14** — Chart palette added (§3.7). Espresso/caramel validated as
  unsuitable for chart marks (too low-chroma); a separate blue ramp
  (`wds-chart-1..4`) plus the existing error tones for problem-marking is now
  the standing chart palette, authorized during the Inventory reports pass
  (O-REPORTS). Ranked-horizontal-bar established as the default pattern for
  "which items are the problem" questions, in place of a waterfall.
- **2026-09-21** — §13 added: colour-as-exception-signal rules, codified from
  the Milestone Four (Requisition & Branch Approval) Branch Manager desktop
  screen review. Covers dense-table row/column discipline (no vertical
  stacking, `min-width: 0` + shared fixed-width prefixes for true column
  alignment), the three-tier hairline system, reusing existing row text as an
  expand/collapse trigger instead of a chevron, and table-header contrast.
- **2026-09-21** — Sidebar gradient (§3.6, §11) revised during the same
  Milestone Four pass: richer top stop (`#2E1806` → `#4A290E`) and a new
  `wds-sidebar-upper-mid` (`#381E09`) transition stop; mid/bottom unchanged.
  Applied app-wide in `frontend/app/tokens.wds.css` and
  `tailwind.wds.preset.ts`, not scoped to new screens only. Also corrected
  stale hex values in §3.6's token table that predated this change (they'd
  drifted from the live CSS file). §10's "still to add" component list was
  also corrected — `table`, `select`, `combobox`, `checkbox`, `sheet`,
  `dropdown-menu`, `avatar` etc. already exist in `components/ui2/` and had
  been listed as not-yet-built; see `frontend/components/ui2/table.tsx` for
  the real (and already-correct) table primitive — semantic `<table>` markup,
  so the column-alignment issues found in this session's Paper mockups
  (`min-width:0`/fixed-width bookkeeping) don't apply to the real component.
