# Enterprise UI Visual Design Principles

**A working reference for dense, premium, light-mode enterprise interfaces.**

Grounded in established practice: Tufte and Few on data, Gestalt on grouping, WCAG on contrast, and the conventions codified in Carbon, Polaris, Atlassian, Material and Base Web — as expressed in Linear, Airtable, Stripe, Notion and Superhuman.

---

## House Position

Decisions already made. Everything in this document assumes them.

| Decision | Value |
|---|---|
| Density | Dense. Compact by default, with a user-facing density toggle. |
| Separation | **1px hairline dividers and space.** No card borders. No drop shadows on content containers. |
| Icons | **Thin stroke (1.5px), single family, semantic only.** |
| Theme | **Light mode only.** |
| Base font size | 14px |
| Spacing base | 4px |
| Corner radius | 6px default, 4px on dense controls, 8px maximum |

> **The meta-rule.** Enterprise users don't enjoy software the way they enjoy games. They enjoy *competence* — the feeling of being fast, in control, and not fighting the tool. Every rule below serves that one feeling.

> **The second meta-rule — earned distinctiveness.** Discipline is the floor, not the ceiling. Every rule in this document exists to stop a component from looking assembled-from-a-kit. It does not exist to make every screen interchangeable with a competitor's. See §0 before designing anything non-trivial.

---

## Table of Contents

0. [Earned Distinctiveness](#0-earned-distinctiveness)
1. [Layout](#1-layout)
2. [Spacing](#2-spacing)
3. [Typography](#3-typography)
4. [Information Density & Visual Hierarchy](#4-information-density--visual-hierarchy)
5. [Tables](#5-tables)
6. [Filters](#6-filters)
7. [Color](#7-color)
8. [Charts](#8-charts)
9. [FORBIDDEN — Anti-Slop Block](#9-forbidden--anti-slop-block)
10. [Pre-Ship Checklist](#10-pre-ship-checklist)
11. [Appendix: Token Reference](#appendix-token-reference)

---

## 0. Earned Distinctiveness

The rules in §1–§8 are how you avoid looking cheap. They are not how you get to look *considered*. A screen can pass every rule in this document and still be forgettable — correct spacing, correct type scale, correct hairlines, and zero point of view. That is a real failure mode, distinct from slop, and the pre-ship checklist already names it: **"could this be anyone's product? If yes, nothing was decided."**

### 0.1 Where discipline ends and authorship begins

Most of an enterprise UI is legitimately commodity. A text input, a checkbox, a settings row, a breadcrumb — these should be as plain and correct as possible. Nobody remembers a well-behaved text input, and trying to make one memorable is how you get novelty chrome that fights the density rules. **Do not spend a signature move here.**

A minority of surfaces are where the product actually lives — the screens a user spends hours in, the moments that carry the brand, the states that show up hundreds of times a day. These earn deliberate craft:

- The primary work surface of each role (the KDS/BDS ticket board, the order composer, the settlement/reconciliation view) — this is what "using the product" *is*, for that person.
- Hero numbers and their immediate context (a dashboard's top KPI, a running order total) — the one thing in the room that should not look like every other stat tile.
- Status and state transitions the user watches happen — a ticket moving from pending to ready, a payment clearing, a shift starting.
- Empty states, especially on high-frequency screens — a blank gray box read as unfinished; a considered empty state reads as designed.
- The one or two brand-shell surfaces (§ per the House Position on branded shell / neutral interior) — login, the sidebar identity zone.

Everything else in that screen — the surrounding table, the filter bar, the settings drawer it opens into — stays disciplined and quiet, precisely so the deliberate moment has room to read as deliberate. A screen where every element is trying to be the signature move has no signature move; it has noise. Restraint everywhere is what makes the one earned flourish visible.

### 0.2 What "earning it" looks like in practice

Distinctiveness here is never decoration layered on top — it is a smarter *mechanism*, chosen because it's genuinely better for how this specific user works, not because it looks different. In order of how often each is the right tool:

1. **A sharper interaction than the default.** Inline edit instead of a modal round-trip. A stepper that commits on blur instead of requiring a save button. Optimistic UI on an action that's 99% going to succeed. This is almost always available and almost always the first thing to reach for.
2. **A layout move justified by the data**, not by variety-seeking. One dominant region instead of equal tiles (already required by §1.3) taken one step further: the dominant region gets a genuinely custom treatment — a different grid, a direct-labelled chart, a number rendered at a scale nothing else on the page uses — because this number is why the screen exists.
3. **A considered state**, not a generic one. The empty state that names what's missing and offers the one action that fixes it. The loading state shaped like the content it's about to become, not a spinner. The zero-orders-today state for a waiter that feels calm, not broken.
4. **A restrained motion or accent moment**, last and rarest. A single 200–300ms transition on a state that matters (ticket claimed, payment settled) — never decorative, never repeated on every hover. If in doubt, this is the one to cut.

A useful test before calling a surface "done": would a designer familiar with Linear, Stripe, or Notion glance at it and see a decision, or see defaults? If it's defaults, it either belongs in the commodity category (fine — leave it alone) or it's a primary surface that hasn't had its one move applied yet (go back and find it).

### 0.3 Guardrails

None of this reopens §9's FORBIDDEN block. A signature moment is still light-mode, still hairline-separated, still within the type and spacing scale, still built from tokens. "Distinctive" is never an excuse for a gradient, a shadow, a second accent hue, or a spring easing that crept back in under a different name. The craft budget is spent on *mechanism and judgment*, not on the visual vocabulary the rest of this document exists to constrain.

---

## 1. Layout

Application layout is a different tradition from marketing layout. The most common failure — especially with AI tools — is applying document layout (centered, max-width, generously padded, stacked) to an application context.

### 1.1 The canonical shell

```
┌────────────────────────────────────────────────────┐
│  Top bar — 48px — context · search · account       │
├────────┬─────────────────────────────┬─────────────┤
│        │  Toolbar / filter bar 44px  │             │
│  Nav   ├─────────────────────────────┤  Inspector  │
│  240px │                             │  360px      │
│  fixed │  Main content — fluid       │  fixed      │
│        │  (the only scroll region)   │             │
└────────┴─────────────────────────────┴─────────────┘
```

### 1.2 Structural rules

- **Full-bleed, not centered.** Application content fills the viewport. Never cap a data view at 1200px and center it. *Exception:* reading and form content caps at 640–720px for line-length reasons.
- **Fixed rails, fluid center.** Nav and inspector are fixed pixel widths; the middle absorbs all resizing. This is what makes an interface feel stable rather than elastic.
- **One primary scroll region.** The page does not scroll — the content pane does. Headers, toolbars and nav stay pinned. Two competing scrollbars is the most common "this feels cheap" tell.
- **Three-pane list → detail is the premium pattern.** It removes navigation round-trips, which reads as speed.
- **Rails, not columns.** A 12-column grid is a marketing-page tool. Application layout uses a flex/rail system on a 4px base unit.

### 1.3 What makes layout feel *intentional* rather than generic

1. **Deliberate dominance.** One region carries 60–70% of the visual weight. If every region is the same size, nothing is important and the eye reads a template.
2. **Alignment is the whole game.** Choose 3–5 vertical alignment lines per screen and put *everything* on them — nav labels, section headers, table first columns, form labels. Generic layouts fail here: elements are individually padded, so nothing lines up across regions.
3. **Optical alignment over mathematical.** Icons, avatars and text baselines need 1–2px manual correction. Text aligns by cap-height, not bounding box.
4. **Content-driven proportions.** Column and panel widths derive from content needs — a status chip needs ~100px, a timestamp ~90px, a title needs room to breathe. Equal division is the signature of a generic layout.
5. **Density zones.** Alternate tight zones (toolbar, filter bar, table) with breathing gaps (16–24px). Uniform spacing reads as cramped; varied rhythm reads as designed.

### 1.4 Standard dimensions

| Element | Value |
|---|---|
| Top bar height | 48px |
| Sidebar width | 240px (collapsed: 56px) |
| Inspector panel | 360px |
| Toolbar / filter bar | 44px |
| Content padding | 16px horizontal / 12px vertical |
| Table row height | 32 / 36 / 44px (compact · default · comfortable) |
| Modal width | 480px confirm · 640px form · 880px complex |
| Minimum click target | 32 × 32px |

### 1.5 Layout archetypes

| Archetype | Structure | Used for |
|---|---|---|
| **List–detail** | Nav + list pane + inspector | Issues, records, inbox |
| **Full table** | Nav + toolbar + full-width table | Data grids, transactions |
| **Dashboard** | Nav + KPI strip + varied-size chart regions | Analytics overview |
| **Record page** | Nav + header block + tabbed body + right meta rail | Customer, invoice, project |
| **Settings** | Nav + secondary nav rail + 640px form column | Configuration |

> **Dashboard note:** vary the region sizes. One large primary chart plus smaller supporting panels. A grid of four equal tiles is the dashboard version of the generic layout.

### 1.6 Prompt fragment for AI tools

```
Application UI, not a landing page. Full-width, no centered
max-width container. Fixed 240px left nav, 48px top bar,
fluid content pane, 360px right inspector. 4px spacing grid.
32px table rows. 14px base type. Dense. Light mode.
Hairline dividers only — no card borders, no shadows.
One dominant content region, not equal-weight tiles.
```

---

## 2. Spacing

The 4px base unit is the industry standard (Material, Carbon, Polaris, Atlassian, Apple all use 4 or 8). Dense UI needs 4px granularity — 8px is too coarse at small scale.

### 2.1 The scale

```
2 · 4 · 6 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64
```

Nothing else. Never 15px, never 18px, never 25px. This consistency is a large part of what the eye reads as "expensive."

### 2.2 The load-bearing principle: proximity encodes relationship

Space, not lines, does the grouping work (Gestalt law of proximity).

| Relationship | Gap |
|---|---|
| Items within a group | 4–8px |
| Between groups | 16–24px |
| Between major sections | 32–48px |

**Maintain a ratio of at least 1 : 3 between inner and outer spacing.** If your inner gap is 8px, your group gap must be 24px or more.

> **Diagnostic:** when a dense screen feels cramped, it is almost never because there is too little space. It is because the inner and outer gaps have collapsed toward each other and the *relationships* became ambiguous. Fix the ratio before adding space.

### 2.3 Rules

- **Space first, tint second, hairline third.** Every line is visual noise. Reach for spacing, then a subtle background tint, and only then a 1px divider.
- **Asymmetric container padding.** Horizontal padding runs ~1.5× vertical in dense UI (a button at 12px horizontal / 8px vertical), because text has natural side-bearing but no vertical breathing room.
- **Vertical rhythm on multiples of 4.** 32px rows, 28px inputs, 24px chips — so components stack into predictable alignment.
- **Nested containers reduce padding, they don't repeat it.** Panel 16px → section 12px → row 8px. Repeating 16px at every level leaves no room for content.
- **Whitespace is a signal, not filler.** Reserve larger gaps for genuine hierarchy breaks. Spend space uniformly and you can no longer use it to communicate.

---

## 3. Typography

### 3.1 Font selection

Use a neutral humanist or geometric grotesque. The goal is invisibility.

| Option | Notes |
|---|---|
| **Inter** | The de facto enterprise UI face. Tall x-height, true tabular figures, wide language coverage, designed for small screen sizes. |
| **System stack** | `-apple-system, BlinkMacSystemFont, "Segoe UI", …` — free, fast, native. |
| **Söhne / Suisse Int'l** | Licensed, premium, more distinctive. |
| **IBM Plex Sans, Geist, SF Pro** | Same family of intent. |
| **Mono (data only)** | JetBrains Mono, SF Mono, IBM Plex Mono — IDs, hashes, codes. |

**Rules**

- One typeface for the entire UI. A second only if it is a mono for data.
- No display faces, slabs, or rounded sans. Personality in a workhorse UI reads as amateur within a week of daily use.
- **Do not pick a font merely because it is not Inter.** See §9.2 — the anti-slop over-correction (cream + serif display + sage) is now a more recognisable tell than the thing it replaced. The defensible move is choosing a workhorse face for functional reasons and then *styling it deliberately*. A specified Inter is a decision; an unspecified anything is a default.

### 3.2 Two features that matter disproportionately

1. **Tabular figures — `font-variant-numeric: tabular-nums`.** Mandatory on any column of numbers, currency, dates or IDs. Proportional digits make numeric columns visibly ragged. This single setting accounts for much of whether financial software looks professional.
2. **Optical tracking.** Headings above 20px need −0.01 to −0.02em. Text at 11–12px needs +0.01em to stay legible. Micro-labels in caps need +0.04em.

### 3.3 The scale

Modest ratio (1.125–1.2). Dense UI lives in a narrow band.

| Token | Size | Weight | Line height | Use |
|---|---|---|---|---|
| Display | 24px | 600 | 32px | Page title (rare) |
| H1 | 20px | 600 | 28px | View / section title |
| H2 | 16px | 600 | 24px | Panel header |
| H3 | 14px | 600 | 20px | Sub-section, group header |
| **Body** | **14px** | **400** | **20px** | **The workhorse — ~90% of the UI** |
| Small | 13px | 400 | 18px | Table cells, secondary rows |
| Caption | 12px | 400/500 | 16px | Labels, metadata, helper text |
| Micro | 11px | 500 | 16px | Chips, badges, column headers (caps +0.04em) |

### 3.4 Hierarchy rules

- **14px is the base, not 16px.** 16px is the web-reading standard; enterprise applications run 13–14px.
- **Hierarchy by weight and color before size.** In dense UI the available size range is tiny. Three sizes × three text colors × three weights (400 / 500 / 600) yields ample legible levels within a 12–20px band.
- **Never exceed weight 600.** Bold-black at 14px reads as shouting.
- **Line length 45–75 characters** for prose. This is why forms and reading views get a max-width even when the application does not.
- **Line height inverse to size:** ~1.4–1.5 body, ~1.2–1.3 headings.
- **Sentence case everywhere.** Title Case is dated. ALL CAPS only at 11px with added tracking.

---

## 4. Information Density & Visual Hierarchy

Tufte's principle applies directly: **maximise the data-ink ratio.** Density done well means more signal, not more stuff.

### 4.1 Mechanisms, in order of preference

1. **Text color hierarchy — the primary tool.**
   - Primary: `gray-900` (near-black, never `#000`)
   - Secondary: `gray-600`
   - Tertiary / metadata: `gray-500`

   A row with a weight-500 gray-900 title, a gray-600 subtitle and a gray-500 timestamp is instantly scannable with zero layout effort.
2. **Weight before size.**
3. **Space before lines.**
4. **Background tint before dividers.** A `gray-50` fill separates a region more quietly than a line.
5. **Hairline dividers last** — always 1px at `gray-200`. Never 2px, never dark, never a full box.

### 4.2 Scannability rules

- **Establish one strong left alignment edge.** The eye scans down a vertical line; anything that breaks it (indented rows, varying icon sizes) measurably slows scanning.
- **Progressive disclosure by default.** Show the 4–6 fields that answer *"which row do I want?"* Everything else lives in the detail pane. Dense means all *decision-relevant* fields, not all fields.
- **Exactly one primary action per screen.** One filled button; everything else ghost or tertiary. Multiple filled buttons is the fastest route to looking generic.
- **Icons: 16px in content, 20px in nav.** One family, 1.5px stroke, semantic only — never decorative. Lucide, Phosphor Light, or Radix.
- **Cap accent color at ~5% of pixels** in dense views.

### 4.3 The squint test

Blur the screen. You should see **3–4 distinct zones of weight**.

- Uniform gray mush → no hierarchy.
- Competing dark blobs → too many focal points.

---

## 5. Tables

Tables are the heart of enterprise UI and have a well-established rulebook.

### 5.1 Structure

- **Row heights:** 32px compact · 36px default · 44px comfortable. Ship the toggle — users have strong preferences.
- **No zebra striping.** Modern practice is a plain background with a 1px `gray-200` bottom hairline (or nothing) plus a row hover state. Striping adds ~50% more visual noise to solve a problem hover solves better. *Exception:* very wide read-across tables and print/export views.
- **Sticky header row, always.** Sticky first column on wide tables.
- **Cell padding:** 12px horizontal; vertical derives from row height. First column gets 16px to align with the page gutter.
- **Row hover:** subtle `gray-50` shift plus row actions revealed at the right. Never shift layout on hover.
- **Selection:** 40px checkbox column. Selected rows tint at accent 6–8% opacity. A bulk-action bar appears anchored to the table, not floating arbitrarily.

### 5.2 Data formatting — the professional-looking part

| Data type | Treatment |
|---|---|
| Numbers, currency | Right-aligned, tabular figures, consistent decimals |
| Text | Left-aligned — never centered |
| Column headers | Match their column's alignment |
| Dates | Consistent and unambiguous (`12 Mar 2026` or ISO). Relative time only where recency matters, with absolute on hover |
| Empty cells | Muted em-dash `—`, never blank (blank looks broken) |
| Status | Dot + label, or a low-saturation chip. Never color alone |
| Long strings | Truncate with ellipsis + tooltip. Never wrap in compact mode |

One line per row is what makes a table scannable.

### 5.3 Behaviour

- Sortable headers with a persistent, visible sort indicator.
- Column resize, reorder, show/hide — user control over their own view.
- **Virtualised rendering.** Choose pagination vs. infinite scroll deliberately: pagination where position matters (accounting, audit), virtual scroll for exploration.
- **Inline editing** where the data model allows — click a cell, edit in place, save optimistically. A major premium differentiator.
- **Keyboard navigation:** arrows to move, `Enter` to open, `Space` to select, `Cmd+A` to select all.

---

## 6. Filters

### 6.1 Patterns by complexity

| Pattern | When |
|---|---|
| **Segmented tabs** | 2–5 mutually exclusive states (All / Active / Archived) |
| **Chip-based filter bar** | The modern standard. `+ Filter` opens a picker; each filter becomes a removable chip reading `Field · Operator · Value` |
| **Faceted left rail** | Search and catalogue contexts with many independent dimensions, with counts |
| **Query builder** | Nested AND/OR, power users only, behind a disclosure |

### 6.2 Rules

- **Applied filters must be visible without opening anything.** The number one filter failure is hidden state — a user sees an empty table and doesn't know why. Chips solve this.
- **Always show a result count** (`142 of 3,204`) and **Clear all** once two or more filters are active.
- **Apply instantly,** debounced ~300ms. Apply buttons are legacy; keep them only where the query is genuinely expensive.
- **Saved views are the real feature.** Filters are ephemeral; a named, shareable, persistent view is what people actually want, and it is a core driver of product stickiness.
- **Filters live in the URL** — shareable and back-button-safe.
- **Show counts; disable or hide empty options** so users can't filter into a dead end.
- **Search is separate from filters.** A distinct global search field.
- **Position the filter bar directly above the data,** not in a distant header. Bar 44px, chips 24–28px.

---

## 7. Color

**The interface is neutral. Color is information.**

### 7.1 Palette structure

- **Neutrals do 90%+ of the work.** A 10-step gray ramp (50 → 900), *slightly tinted* — cool blue-leaning or subtly warm. Never pure neutral `#808080`, which looks dead.
- **One primary accent.** Primary buttons, selected states, focus rings, active nav, links. Nothing else.
- **Semantic set with fixed meanings:** success (green), warning (amber), danger (red), info (blue). Never used decoratively.
- **A categorical palette** (6–10 hues) for charts, labels and avatars only — desaturated relative to the semantics so it doesn't compete.

### 7.2 Rules that separate premium from generic

- **Semantic tokens, never literal ones.** `--surface-raised`, `--text-secondary`, `--border-subtle` — never `--blue-500` inside a component. This is the only way a system stays coherent as it grows.
- **Never pure black or pure white text.** Text around `#0F1115`; page `#FFFFFF` with surfaces at `#FAFAFA` / `#F7F8F9`. Pure black on pure white is harsh and reads as unrefined.
- **Desaturate; use tints.** Premium enterprise color is muted. Status backgrounds are the semantic hue at 8–12% opacity with text at full strength. Fully saturated fills are a consumer/amateur signature.
- **Color is never the only carrier of meaning** (WCAG 1.4.1). Always pair with icon, label or shape — roughly 8% of men have a color vision deficiency, a large share of an enterprise audience.
- **Contrast minimums:** 4.5:1 body text, 3:1 large text and UI boundaries (WCAG AA). Tertiary gray *will* fail this if unchecked.
- **Focus states are a design element,** not a browser default: 2px accent ring at 2px offset, on every interactive element.

---

## 8. Charts

The canon is Tufte, Few and Cleveland. Every good enterprise dashboard follows it.

### 8.1 Core principles

- **Maximise data-ink.** Delete chart borders, background fills, 3D, gradients, shadows, heavy gridlines, redundant legends.
- **Gridlines:** horizontal only, 1px `gray-200`, behind the data. Never vertical gridlines on a time series. Often none at all when direct labelling is used.
- **Axes:** drop axis lines where possible, keep tick labels. **Bar charts must start at zero** — bar length encodes magnitude. Line charts may use a non-zero baseline if clearly labelled.
- **Direct labelling beats legends.** Put the series name at the end of its line; a legend forces a lookup round-trip on every glance.
- **Choose encoding by accuracy** (Cleveland's ranking): position on a common scale > length > angle > area > color. This is why pie charts fail above 2–3 slices, and why treemaps and bubble charts are for texture, not precision.

### 8.2 Chart–question mapping

| Question | Chart |
|---|---|
| Trend over time | Line / area |
| Comparison across categories | **Horizontal** bar (handles long labels and many categories) |
| Part-to-whole | Stacked bar — not pie |
| Correlation | Scatter |
| Distribution | Histogram / box plot |
| Single metric | Big number + delta + sparkline |

### 8.3 Enterprise specifics

- **Color:** single-hue sequential for magnitude; diverging around a midpoint; categorical only for genuinely unordered categories. Maximum ~7 series — beyond that, group into "Other."
- **Consistent mapping product-wide.** If *Enterprise tier* is teal in one chart, it is teal everywhere.
- **Chart typography:** 11–12px labels in tertiary gray, tabular figures, abbreviated magnitudes (`1.2M`, `$4.5K`), units stated in the axis title rather than on every tick.
- **Tooltips carry precision;** the chart carries shape. Include a crosshair.
- **Design the sparse and empty states** — "No data for this period" is a real state, as is a two-point chart.
- **Sort bars by value,** unless category order is inherently meaningful (months, ratings).
- **Sparklines in table cells** — dense, high-value, a strong premium signal.
- **Animate once, briefly.** A single 200–300ms entrance. Never re-animate on filter change.

---

## 9. FORBIDDEN — Anti-Slop Block

### 9.1 Why this exists

Generative tools return the statistical average of their training data. Absent direction, the most probable output *is* the generic one — so the fix is not a better adjective but an explicit set of blocked paths. Negation works at inference time: naming a pattern reduces its probability weight. Keep this list short enough to actually be enforced.

### 9.2 The current trap

The obvious tells (purple gradients, glassmorphism) are widely known. The *newer* tell is the anti-slop over-correction: **warm cream background + serif display face (Instrument Serif, Fraunces, Playfair) + sage or forest green accent.** It reads as machine-made for exactly the same reason the purple gradient did — nobody chose it, the model did. It is banned below.

### 9.3 The block

```
FORBIDDEN — regenerate if any of these appear:

COLOR
- Purple, violet, or indigo as accent or primary
- Any gradient on backgrounds, buttons, or surfaces
- Gradient text; glow effects; colored box-shadows
- Cream/beige background + serif display + sage accent
- Gray text on colored fills
- Dark mode (light mode only)

SURFACES
- Card borders or drop shadows on content containers
  -> separate with 1px hairline dividers and space
- Nested cards; cards inside cards
- Corner radius > 8px (6px default, 4px on dense controls)
- Glassmorphism, backdrop blur, translucent panels
- Accent-colored strip on one edge of a container

LAYOUT
- Centered max-width container on any data view (full-bleed)
- Rows of identical equal-weight cards or KPI tiles
- Hero / feature-grid / CTA marketing macrostructure
- Grids where no region is visibly dominant

MOTION
- Bounce or spring easing; hover scale or lift
- Animation over 200ms; re-animating charts on filter change

COPY
- "seamless", "transform your workflow", "powerful yet simple",
  "effortless", unearned superlatives
```

### 9.4 Deliberately *not* banned — specified instead

Banning these produces worse output, because the model over-corrects into something stranger. Each needs a specification, not a prohibition.

| Tell | Why not banned | The rule instead |
|---|---|---|
| **Inter / system fonts** | Inter exists because it excels at 13px with tabular figures. The tell is a font left at *default* — no tracking, no figure setting, no defined weight set. | Specify the stack, scale, `tabular-nums`, tracking, and weight set (§3). |
| **Thin-line icons** | Thin strokes are correct for dense UI. The tell is genericness: mixed sets, inconsistent stroke weight, decorative use. | One family, 1.5px stroke, 16/20px, semantic only. |
| **Weak hierarchy** | Not a bannable artifact. | Three text colors × three weights, 14px base, weight-and-color before size (§4). |
| **Decorative charts** | Charts are not the problem; unjustified ones are. | Every chart states the question it answers. No chart type chosen for visual variety. |
| **Uniform treatment of non-uniform content** | Too abstract to detect as a ban. | The squint test (§4.3) and the checklist below. |

### 9.5 One deliberate over-correction

The blanket ban on gradients is stricter than strictly necessary — a very subtle single-hue gradient can be legitimate. It stays banned because the failure mode is far more expensive than the loss, and dense enterprise UI genuinely never needs one. Relax later if a real case appears.

---

## 10. Pre-Ship Checklist

Quality defects, not style choices — you cannot forbid a bug, only test for it. These are the tells that surface only against real data, which is what makes them the most damaging in enterprise. Answer each yes or no; any "no" blocks ship.

### Spacing & alignment
- [ ] Every spacing value is on the scale (`2/4/6/8/12/16/20/24/32/40/48/64`). No arbitrary values.
- [ ] Inner-to-outer spacing ratio is at least 1 : 3 in every group.
- [ ] Elements share 3–5 vertical alignment lines across the screen. Nothing is off by a few pixels.
- [ ] Icons and text are optically aligned, not just mathematically.

### Layout
- [ ] Content is full-bleed; no centered max-width container on a data view.
- [ ] One region is visibly dominant (~60–70% of visual weight).
- [ ] Exactly one scroll region. Nav and toolbars stay pinned.
- [ ] Exactly one filled primary button per screen.

### Typography
- [ ] Base is 14px; nothing readable falls below 12px.
- [ ] No weight above 600.
- [ ] `tabular-nums` on every numeric column.
- [ ] Prose stays within 45–75 characters per line.

### Color & contrast
- [ ] Body text ≥ 4.5:1; large text and UI boundaries ≥ 3:1.
- [ ] Tertiary gray specifically checked against its background.
- [ ] No status conveyed by color alone.
- [ ] Accent occupies ≲5% of pixels.

### Real data
- [ ] Tested with a 60-character name and a 10,000-row set.
- [ ] Tested with null, zero, negative and empty values.
- [ ] No text clips, overflows, or escapes its container at any width.
- [ ] Placeholder data is realistic — not round numbers, tidy three-item lists, or "Acme Inc."

### States
- [ ] Empty, loading, partial, error, permission-denied and too-much-data states all designed.
- [ ] Every chart has a defined empty and sparse state.
- [ ] Destructive actions are visually distinct and reversible (undo over confirm).

### Slop gate
- [ ] Nothing in §9.3 appears.
- [ ] Squint test shows 3–4 distinct zones of weight.
- [ ] **The opinion test:** could this be anyone's product? If yes, nothing was decided.

---

## Appendix: Token Reference

```css
:root {
  /* Spacing — 4px base */
  --sp-1: 2px;   --sp-2: 4px;   --sp-3: 6px;   --sp-4: 8px;
  --sp-5: 12px;  --sp-6: 16px;  --sp-7: 20px;  --sp-8: 24px;
  --sp-9: 32px;  --sp-10: 40px; --sp-11: 48px; --sp-12: 64px;

  /* Radius */
  --radius-sm: 4px;   /* dense controls */
  --radius-md: 6px;   /* default */
  --radius-lg: 8px;   /* maximum */

  /* Type */
  --font-ui: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-mono: "JetBrains Mono", "SF Mono", monospace;

  --text-display: 24px/32px;  --text-h1: 20px/28px;
  --text-h2:      16px/24px;  --text-h3: 14px/20px;
  --text-body:    14px/20px;  --text-sm: 13px/18px;
  --text-caption: 12px/16px;  --text-micro: 11px/16px;

  --weight-regular: 400; --weight-medium: 500; --weight-semibold: 600;

  /* Semantic surfaces */
  --surface-page:     #FFFFFF;
  --surface-subtle:   #FAFAFA;
  --surface-hover:    #F4F5F6;
  --surface-selected: color-mix(in srgb, var(--accent) 7%, transparent);

  /* Semantic text */
  --text-primary:   #0F1115;
  --text-secondary: #5A6270;
  --text-tertiary:  #8A919E;
  --text-disabled:  #B4B9C2;

  /* Borders — hairlines only */
  --border-subtle: #E8EAED;
  --border-strong: #D5D8DE;

  /* Accent + semantics (set to brand) */
  --accent:  /* single primary hue — not purple/indigo/violet */;
  --success: /* green */;  --warning: /* amber */;
  --danger:  /* red */;    --info:    /* blue */;

  /* Status fills = semantic hue at 8–12%, text at full strength */

  /* Layout */
  --nav-width: 240px;      --nav-collapsed: 56px;
  --topbar-height: 48px;   --toolbar-height: 44px;
  --inspector-width: 360px;
  --row-compact: 32px; --row-default: 36px; --row-comfortable: 44px;

  /* Motion — functional only */
  --duration-fast: 100ms;  --duration-base: 150ms;  --duration-slow: 200ms;
  --easing: cubic-bezier(0.2, 0, 0.2, 1); /* ease-out; never spring */
}
```

### Numeric defaults

```css
.numeric {
  font-variant-numeric: tabular-nums lining-nums;
  text-align: right;
}
```

---

*Living document. Amend the FORBIDDEN block as new defaults calcify — today's anti-slop correction becomes tomorrow's tell.*