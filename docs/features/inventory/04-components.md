# Inventory & Procurement — Component Inventory (Step 4)

**Feature:** Inventory & Procurement (Feature 1 of the redo)
**Step:** 4 of the per-feature pipeline — extract components into the codebase
**Status:** Milestone One complete; remaining milestones added as their screens are
finalized on the Milestone pages.
**Traces to:** `docs/features/inventory/03-design.md` (Paper source of truth),
`docs/FEATURE_REDO_PLAYBOOK.md` §5 Step 4, §9 (folder structure)

---

## Purpose

Step 3 (Paper design) produces approved screens. Step 5 (the high-level plan) needs
a concrete, buildable component set to reference. This doc is the bridge: for each
build milestone, it lists every **primitive** (add via shadcn CLI, restyle onto
tokens, lives in `components/ui2/`) and **composite** (assembled from primitives,
lives in `components/<feature>/` or a shared cross-feature location) that milestone's
screens need, with a pointer to the exact Paper node to build it against.

**Do not build a composite by eyeballing a screenshot.** Read exact values via
`get_jsx` / `get_computed_styles` / `get_fill_image` on the referenced node — Paper's
own guidance is explicit that screenshots are for verifying the result, not sourcing
it. See "Visual fidelity process" below.

---

## Terminology

- **Primitive** — atomic, context-free (Button, Input, Select, Table, Sheet). Doesn't
  know which feature it's used in. `components/ui2/`.
- **Composite** — a specific, repeating arrangement of primitives (KPI Strip, Item
  Form, Drawer Shell, Mobile Task Header). `components/<feature>/`, except shell
  pieces used by every feature (sidebar, topbar, mobile status bar), which go
  somewhere shared, not under `components/inventory/`.

---

## Milestone One — Catalog, Suppliers & Restock Levels

Paper reference: page `Milestone One · Catalog, Suppliers & Restock Levels` (`B-0`),
file `01M1ZZJ6S3FZGF5C7PPBGTKY89`. Screens: Item Catalog, Item Create/Edit, Manage
Categories, New/Edit Supplier, Restock Levels (Central Store + department), each with
a mobile counterpart except the department one (mobile-only).

**Sourcing note:** shared shell composites (sidebar, topbar, drawer shell, mobile
headers, status bar) should be built against the **Session-0 shell** (`15W-0` on page
`3-0`) or the original Store Manager / Department Head pages — not the Milestone One
clones. Milestone One is a curated review copy; the canonical source for anything
shared across roles is Session-0 or the owning role's page.

**⚠ Common first-restyle mistake — read before touching Button:** the Phase 0
`button` primitive was seeded before the gradient existed and is very likely still a
flat `--color-primary` fill. When restyling it, the **primary variant must use the
gradient**, not a flat color:
`background-image: linear-gradient(180deg, var(--color-espresso-700) 0%, var(--color-primary-btn-end) 100%)`,
`border-radius: 2px` (confirmed against Paper node `TD3-0`, and matches every
existing primary CTA on the Store Manager page, e.g. `T55-0`). Verify this against
Paper on every button-restyle session, not just once — it's an easy detail to lose
when a primitive gets touched again later for an unrelated reason (e.g. adding a
loading state).

### Primitives needed (beyond Phase 0's seeded set)

Phase 0 already seeded: button, input, badge, card, separator, skeleton, label,
status-dot.

| Primitive | Needed for | Paper reference |
|---|---|---|
| Select / Combobox | Category picker, Preferred supplier picker | `SLU-0` (Category field, Item drawer) |
| Dropdown Menu | Catalog toolbar filters (Type / Department / Category) | Catalog toolbar row on `SFQ-0` |
| Segmented Toggle Group | Type (Raw/Prepped/Stocked), Payment terms (Invoice to follow/Pay now) | `SM0-0` (Type), Supplier form payment-terms row |
| Sheet / Drawer | Slide-over shell for all 4 desktop drawers | `SKV-0` / `SRB-0` / `SX5-0` / `T52-0` (`Drawer` child frame in each) |
| Table / Data Table | Item catalog, restock-level grid, category list | `SFT-0` (catalog table) |
| Search Input | Search boxes with `⌘K` hint | Topbar search frame, e.g. `SIH-0` |
| Avatar | User-initials circle | Sidebar footer avatar frame |
| Primary Gradient Button (Button variant) | Every primary CTA | `TD3-0` — `linear-gradient(180deg, var(--color-espresso-700) 0%, var(--color-primary-btn-end) 100%)`, `border-radius: 2px` |

### Composites needed

| Composite | Screens | Paper reference | Notes |
|---|---|---|---|
| Hub Sidebar Nav | every desktop screen | `SIL-0` (or Session-0) | Cross-feature — extract once, reuse everywhere. Not Inventory-specific. |
| Desktop Topbar | every desktop screen | `SI9-0` | breadcrumb + search + page actions |
| Mobile Hub Header | mobile Item Catalog | `TM8-0` | hamburger + org label + avatar + title/subtitle, dark gradient |
| Mobile Task Header | 4 mobile full-screen tasks | `TUY-0` (New item) | back chevron + Cancel/Done + title/subtitle |
| Mobile Status Bar | every mobile screen | Paper's official status-bar markup (`get_guide("mobile-status-bar")`) | Static — no per-screen variation |
| KPI Strip + KPI Stat Cell | Item Catalog, desktop + mobile | `TLB-0` (desktop), `TMQ-0` (mobile) | Repeating cell, divider border on all but last. Only the genuinely actionable number gets an accent color — everything else stays ink. |
| Drawer Shell | all 4 desktop drawers | `SMI-0`/`SKW-0` (scrim + drawer, Item edit) | Scrim must be `height: 100%` of the artboard, not a fixed px value — this is the bug we just fixed; codify it as `height: 100%` / `inset: 0` in the primitive, not a magic number. |
| Item Catalog Table | desktop + mobile catalog | `SFT-0` / `TN1-0` | Table primitive + status-dot + toolbar filters |
| Item Form | New/edit item, desktop drawer + mobile full-screen | `SL2-0` (desktop body) / `TV7-0` (mobile) | Identical field set both places: Name, Type toggle, Category, Preferred supplier, Buy/Usage unit, Conversion/Pack size, Where it may exist, Restock level. Only the surrounding shell (Sheet vs. full-screen route) differs — build the field set as one composite, slot it into either shell. |
| Category Manager List | Manage categories, desktop + mobile | `H3D-0` / `TLV-0` | Rows with rename/restore links, add-category input |
| Supplier Form | New/edit supplier, desktop + mobile | `6TF-0` / `TLW-0` | Name, Contact, Category, Phone, Email, Payment terms toggle |
| Restock Level Grid | Restock Levels, desktop + mobile | `T52-0` / `TLX-0` / `TD1-0` | Item rows: name/unit, on-hand (red if below level), editable restock input. Includes the helper-note callout band (dot + muted caption). |

---

## Sourcing: shadcn for primitives, hand-built for composites

- **Primitives** come from the shadcn CLI (`npx shadcn@latest add <component>`),
  never hand-written. Radix underneath gives keyboard navigation, ARIA, and focus
  management for free — we only override the visual layer (restyle onto WDS
  tokens). This is *why* shadcn was chosen: accessibility and interactivity are
  solved problems, not something to reinvent per primitive.
- **Composites do not come from shadcn** — there is no shadcn "KPI Strip" or
  "Restock Level Grid". They're hand-assembled from primitives, matching Paper's
  exact structure via `get_jsx`. shadcn's published "blocks" (e.g. a sidebar
  layout, a data-table-with-sorting example) can be used as an *implementation
  scaffold* for structurally similar composites (Sidebar Nav, Item Catalog Table)
  — but the actual visual spec always comes from Paper, never from copying a block
  as-is.

## Component states

Paper is a static tool — it draws **default/populated** and specific *meaningful*
states the design process deliberately captured (empty, loading, error,
mid-signature, signed/read-only, disabled-looking rows like retired items,
price-alert warnings, selected toggle segments, active nav items). It does **not**
draw micro-interaction states like hover or focus-visible per control — there's
nothing to source those from.

So states split into two tracks:

**Paper-verified states** — anywhere Paper explicitly draws a state (an active nav
item, a disabled/greyed field, a selected segmented-toggle option, a retired row in
muted text), that state is sourced and pixel-diff-verified exactly like the default
state — it is not exempt from the fidelity process just because it's conditional.

**Convention-derived states** — hover, focus-visible, active/pressed, and disabled
for ordinary interactive controls aren't individually drawn in Paper, so they're
derived consistently from the existing tokens rather than invented per component:
- **Hover** — `--wds-gradient-primary-hover` already exists for the primary button;
  the same darken-by-convention approach applies to any other interactive fill.
- **Focus-visible** — `shadow-wds-ring` (already used in `button.tsx`) is the
  standard focus treatment for every focusable primitive, not just buttons.
- **Active/pressed** — a further darken step from hover, consistent across
  primitives.
- **Disabled** — reduced opacity (the button primitive already uses
  `disabled:opacity-60`) plus `pointer-events-none`.

Every new primitive gets a documented state matrix (Default / Hover / Focus-visible
/ Active / Disabled, plus anything component-specific like Selected or Invalid) as
part of its entry being marked done below — "built" means all applicable states are
styled, not just the default one rendering correctly.

---

## Visual fidelity process

Applies to every composite above, and every future milestone's composites.

1. **Never source a value from a screenshot.** Screenshots verify the result after
   building; `get_jsx` / `get_computed_styles` / `get_fill_image` supply the actual
   numbers (spacing, radius, font-size, color) while building.
2. **Every raw value maps to a design token.** If Paper returns `border-radius: 2px`,
   the code uses whatever token in `tailwind.wds.preset.ts` already equals 2px —
   never a bare magic number when a token exists. A mismatch between Paper and the
   token file is a signal to fix one of them, not to hardcode around it. (Example
   caught this session: `--wds-gradient-primary` was `espresso-600 → espresso-700`
   in code but Paper's actual button is `espresso-700 → #4A1D00`, a bespoke color
   with no scale step — added as `--wds-primary-btn-end` and fixed at the token.)
3. **Build primitives first, verified in isolation**, before assembling composites —
   catches a mismatch at the smallest unit instead of inside a full screen.
4. **Assemble composites matching Paper's exact tree** — same flex direction, gap,
   and nesting as `get_jsx` returns, not a visually-approximate re-derivation.

### Pixel-diff verification (objective, not eyeballed)

An agent visually comparing two screenshots by eye is not reliable at the pixel
level — "looks about right" is not the bar. Every composite gets an actual,
automated pixel diff before it's marked done:

1. Capture the **Paper reference** at the artboard's exact width: `get_screenshot`
   on the composite's node, saved as a PNG.
2. Capture the **built version** at the identical viewport width (1440 for desktop
   composites, 390 for mobile) — Playwright/chrome-devtools MCP navigates to the
   page rendering the component and screenshots it.
3. Run `pnpm visual-diff <paper.png> <built.png> <outDiff.png>` — this project's
   `scripts/visual-diff.ts`, using `pixelmatch`. It errors immediately if the two
   images aren't the same dimensions (a mismatch there usually means the wrong
   viewport width was used, not a real design difference), otherwise it prints a
   mismatch percentage and writes a red-highlighted diff image showing exactly
   which pixels differ.
4. **Threshold: ≤2% mismatch to pass** (default in the script, override with
   `--threshold=`). Zero is not the realistic target — Paper's renderer and a real
   browser will never rasterize text/anti-aliasing bit-identically — but 2% catches
   any real layout, spacing, or color defect while tolerating font-rendering noise.
   A failing diff image makes it obvious whether the mismatch is "noise" (scattered
   single pixels along text edges) or "real" (a solid red block = wrong
   spacing/color/missing element) — don't raise the threshold to make a real defect
   disappear.
5. Iterate: any real mismatch → re-check `get_computed_styles` on the specific
   Paper node in question, fix the code value/token mapping, rebuild, re-diff.

### Responsiveness — the part Paper can't verify for us

Paper only designed **two fixed points**: 1440px desktop and 390px mobile. Nothing
in between, nothing beyond. The pixel-diff above only proves those two exact widths
are correct — it says nothing about whether the component holds up at every width
a real user's window/device actually is. Per `FEATURE_REDO_PLAYBOOK.md` §5 Step 3:
"Paper artboards are fixed-width; anything not drawn is left to the frontend agent's
responsive judgement" — that judgement has to be exercised deliberately, not skipped.

For every composite:
1. Build with Tailwind's responsive utilities and the spacing/type tokens (not fixed
   pixel widths) so it flexes rather than breaks between the two anchors.
2. Pixel-diff-verify the two exact Paper anchors (above) — this is the strict,
   automated check.
3. **Additionally spot-check at intermediate widths** the design never drew:
   ~768px (tablet) and ~1024px (small laptop) at minimum, since these are real
   device classes staff will actually use. This is judgment-based, not diffed
   against Paper (there's nothing to diff against) — check for: no horizontal
   scroll on the page body, no overlapping/clipped content, tables/wide content
   scroll in their own container rather than breaking layout, the sidebar
   collapses or the drawer goes full-screen at a sensible point rather than
   sitting half-broken between the two designed states.
4. Note the chosen breakpoint behavior (e.g. "sidebar collapses below 1024px") in
   the composite's code comment and in this doc's status line for it, so the next
   composite that needs the same shell behavior doesn't have to re-derive it.

---

## Status

- [x] Pixel-diff tooling in place — `pixelmatch`/`pngjs` installed,
      `frontend/scripts/visual-diff.ts` (`pnpm visual-diff`), 2% default threshold
- [x] `button.tsx` primary gradient corrected to match Paper exactly
      (`--wds-primary-btn-end` token added, `--wds-gradient-primary` fixed)
- [ ] Remaining primitives added to `components/ui2/` (select, dropdown-menu,
      toggle-group, sheet, table, search-input, avatar)
- [ ] Sidebar Nav + Topbar extracted (shared, not Inventory-scoped)
- [ ] Mobile Hub Header + Task Header + Status Bar extracted (shared)
- [ ] KPI Strip + KPI Stat Cell built
- [ ] Drawer Shell built (scrim height fixed at the primitive level)
- [ ] Item Catalog Table built
- [ ] Item Form built (shared between desktop drawer + mobile route)
- [ ] Category Manager List built
- [ ] Supplier Form built
- [ ] Restock Level Grid built
- [ ] Pixel-diff passed (≤2%) at both Paper anchors, for every composite above
- [ ] Responsive spot-check passed (~768px, ~1024px) for every composite above,
      behavior noted in-code and here

Update the checkboxes as Step 4 build work completes each item — this is a live
build log now, not just a plan.
