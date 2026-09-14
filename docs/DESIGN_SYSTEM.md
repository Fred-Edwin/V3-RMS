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
| `wds-sidebar-top` | `#211A15` | gradient top (warm-dark coffee) |
| `wds-sidebar-mid` | `#201A14` | gradient mid |
| `wds-sidebar-bottom` | `#17110C` | gradient bottom (near-black) |
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

Six named gradient tokens. **Every stop references a colour-scale token** — never
a raw hex — so a ramp retune flows through. Interpolated `in oklab` for clean
brown-to-brown transitions. Used **only** on the surfaces below; everything else
is flat. Table rows, inputs, badges, dropdowns, modals, status dots stay flat.

| Token | Where | Direction | Stops |
|---|---|---|---|
| `bg-wds-gradient-sidebar` | nav rail | 165° | sidebar-top → mid @30% → sidebar-bottom |
| `bg-wds-gradient-primary` | primary button, active nav marker | 180° | espresso-600 → espresso-700 (+ `shadow-wds-sheen`) |
| `bg-wds-gradient-primary-hover` | primary button hover | 180° | one step lighter each stop |
| `bg-wds-gradient-surface-raise` | KPI / stat cards | 180° | `#FFFFFF` → espresso-50 (~2%) |
| `bg-wds-gradient-topbar` | top bar | 180° | `#FFFFFF` → espresso-50 |
| `bg-wds-gradient-scroll-scrim` | under top bar on scroll | 180° | `rgb(ink / 0.05)` → transparent, 8px tall |
| `bg-wds-gradient-brand` | logo tile only | 135° | espresso-600 → espresso-800 |
| `bg-wds-gradient-skeleton` | loading placeholders | 90° animated | neutral-100 → 50 → 100 (**not** espresso) |

The skeleton gradient falls back to a flat `neutral-100` under
`prefers-reduced-motion` (handled in `tokens.wds.css`).

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

**Core set still to add** (per feature, as screens need them — restyle each to
the Paper design at that point): select, combobox, dialog, sheet, drawer, table,
data-table, tabs, toast, dropdown-menu, tooltip, form, checkbox, radio, switch,
popover, command, avatar, scroll-area.

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

- background: `bg-wds-gradient-sidebar` — three warm-brown oklab stops
  (`oklab(23.4% 0.025 0.039)` → `oklab(22.9% 0.024 0.036)` at ~40% →
  `oklab(13.6% 0.011 0.022)`). **No bare-percentage colour hints** in the
  gradient string — Paper (and some engines) turn them into grey/black stops.
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
