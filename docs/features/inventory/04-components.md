# Inventory & Procurement — Component Inventory (Step 4)

**Feature:** Inventory & Procurement (Feature 1 of the redo)
**Step:** 4 of the per-feature pipeline — extract components into the codebase
**Status:** Milestone One complete; remaining milestones added as their screens are
finalized on the Milestone pages.
**Traces to:** `docs/features/inventory/03-design.md` (Paper source of truth),
`docs/FEATURE_REDO_PLAYBOOK.md` §5 Step 4, §9 (folder structure)

> **⚠ Path note (2026-09-15).** The frontend was modularized by feature after
> this doc's composites were built — see `FEATURE_REDO_PLAYBOOK.md` §9. Every
> `frontend/components/inventory/…` path below was correct when written and is
> kept as the build record, but the live location for this milestone's 8
> kebab-case composites is **`frontend/features/inventory/components/`**. The
> Milestone One build session moves them. `components/ui2/` and
> `components/app/shell/` are unaffected — they are shared, not feature code.

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

## Placement rules — read before building a new milestone's screens

Established during Milestone One's UI-refinement pass (2026-09-15). These are
governing rules for every future milestone/feature, not just Milestone One —
apply them by default, don't re-derive them per feature.

### Loading, error, and empty states

Two distinct tiers, not one generic "loading state" concept:

1. **Screen-mirroring skeletons — the default choice, feature-scoped.**
   A loading skeleton should mirror the real screen it's loading: same shell
   (breadcrumb, title, toolbar, KPI strip if the screen has one) rendered
   normally, with only the data region (table rows, KPI values, form fields)
   swapped for skeleton blocks in the real layout's shapes and widths. This
   is the pattern Paper itself draws per-screen (e.g. `5R3-0` "Suppliers
   list · desktop · loading", `71E-0` "Supplier detail · desktop ·
   loading") — a real column header row with skeleton cells beneath it, not
   a generic centered card. **Use this by default for any screen that has a
   loading state**, matching Milestone One's `features/inventory/components/
   skeletons.tsx`.
   - Lives in `features/<feature>/components/skeletons.tsx` (or similar),
     **not** shared — it hardcodes that screen's real column widths/layout,
     which is feature- and screen-specific by definition. A future
     feature's skeleton is a new file, not a reuse of Inventory's.
   - Build it from the shared `Skeleton` primitive (`components/ui2/
     skeleton.tsx` — animated sweep, already respects
     `prefers-reduced-motion`), composed into the target screen's actual
     shape. Don't invent a new skeleton primitive per feature.
   - If Paper hasn't drawn a bespoke loading state for a screen (check
     first — not every screen has one), design a new one that follows the
     same shell-preserving pattern rather than falling back to the generic
     card by default.
2. **Generic Empty / Error / Permission-denied cards — shared, cross-feature.**
   Content-agnostic states that take `title`/`description` props and don't
   need to mirror a specific layout. Live in `components/app/shell/
   shell-states.tsx` (`EmptyState`, `ErrorState`, `PermissionDeniedState`,
   plus a generic `LoadingState` fallback for screens with no bespoke
   skeleton yet). These were originally built inside `features/inventory/`
   and moved out mid-Milestone-One once it was clear they were sourced from
   the cross-role Session-0 shell, not the Inventory milestone page — don't
   repeat that placement mistake: if a state component takes no
   feature-specific props and isn't tied to one screen's layout, it
   belongs in `components/app/shell/`, not under a feature folder.

The dividing line: **does this component need to know the exact shape of
one screen (column widths, field layout)?** If yes, it's a
screen-mirroring skeleton and it's feature-scoped. If no — it's a generic
message-plus-icon card — it's shared.

### Persistent shells — route groups, not per-screen shell mounts

A group of screens that share one sidebar/topbar (e.g. Milestone One's
Catalog + Suppliers) must sit under a Next.js **route group** with its own
`layout.tsx` that mounts the shell once — e.g.
`app/app/<feature>/(shell)/layout.tsx`. Do **not** have each screen render
its own copy of the sidebar/topbar/mobile-nav-drawer; that causes a full
remount (and a visible blank-page flash) on every navigation between those
screens, since each screen mounting its own shell instance forces React to
tear down and rebuild the whole tree on route change. Add a
`(shell)/loading.tsx` alongside it using the screen-mirroring skeleton
convention above, so Next's route-level Suspense fallback is the real
skeleton, not a generic spinner.

**Not every screen in a feature belongs in the same shell group.** A
screen that's an intentional standalone task view (e.g. Milestone One's
mobile-only Restock Levels, entered via a back-chevron header, not sidebar
nav) should stay outside the route group — check the screen's own design
intent before assuming every route in a feature shares one shell.

### Navigation links — always `next/link`, never a plain `<a href>`

Any nav item in a shared shell composite (`SidebarNav`, `SidebarRail`, a
mobile nav drawer) must use `next/link`'s `<Link>`, not a plain `<a
href>`. A plain anchor forces a full browser page reload on click, which
defeats the persistent-shell pattern above even if the layout itself is
structured correctly — the reload tears down everything, shell included.
This was a real bug found and fixed in Milestone One's own sidebar.

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
5. **New `fontSize` token → register it in `lib/cn.ts`'s `customTextScale`, in the
   same edit.** `cn()` uses `tailwind-merge` with a hardcoded allowlist of which
   `text-wds-*` classes it recognizes as font-size (vs. color) utilities. A new
   token missing from that list gets silently treated as conflicting with a
   `text-wds-*-ink`/`-secondary`/etc. color class on the same element — one wins,
   the other is dropped, with no build error or console warning. Caught this
   session: `wds-drawer-title` was defined correctly in `tailwind.wds.preset.ts`
   and generated a correct CSS rule, but never appeared in the rendered
   `className` at all — cost real pixel-diff debugging time before the actual
   cause (the allowlist, not the token) was found.

### Pixel-diff verification (objective, not eyeballed)

**Applies to composites, not bare primitives.** A primitive built in isolation
(no real Paper content, minimal demo markup) often can't be pixel-exact against
Paper on its own — e.g. an HTML `<table>`'s column-width math is genuinely
different from Paper's flex-row layout even with identical numbers typed in,
so a bare `Table` primitive chasing ≤2% against Paper's export just measures
that architectural gap, not a real defect. For a primitive: source every value
from Paper (`get_jsx`/`get_computed_styles`, never a screenshot), restyle onto
tokens, and confirm with one real-browser screenshot compared **by eye**
against Paper's — colors, spacing, type, borders all present and correct. Save
the automated diff for the **composite** that actually consumes the primitive
with Paper's real content — that's the version that ships and where pixel
fidelity is the correct thing to enforce.

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

## Known issues

- **"Show archived" toggle — owner-reported as broken, did not reproduce,
  status still open pending owner's exact repro steps.** Owner reported
  clicking "Show archived" (then "Show retired") does nothing, on two
  separate occasions (once before the 2026-09-15 `includeRetired` backend
  bug was fixed, once after). Re-tested live both times post-fix: toggling
  it correctly flips the toolbar to its active state and the Items badge/
  pagination footer count changes (33 → 36 in the most recent check,
  matching the real archived-row count in Postgres at the time). Leading
  theory, not yet confirmed: a stale browser tab that predates a dev-server
  restart, or a stale `.next`/`tsx watch` cache — both failure modes were
  independently reproduced and fixed elsewhere in this same day's sessions
  (see the Status log's "Housekeeping note" and the restock-level join
  entry's "Caught and fixed during verification" note), so it is plausible
  but not proven that this is the same class of issue rather than a real
  remaining bug. **Do not close this without the owner's exact reproduction
  steps** — ask for the precise click sequence and whether it was in a
  freshly loaded tab before investigating further.
- **Item Catalog column resize — real, scoped feature request, explicitly
  deferred by the owner (2026-09-15), not started.** Table columns
  (`item-catalog-table.tsx`) use fixed Tailwind widths with no resize
  handles; the Units column in particular was already flagged as hard to
  read with real (long) seed data. Owner was asked to choose between a full
  resizable-columns implementation and a narrower Units-column-only
  legibility fix, and chose neither for now ("not now") — this is a
  deliberate hold, not an oversight. Pick this up as its own scoped session
  when the owner revisits it; don't build either option unprompted.
- **No persistent shell across `/app/inventory/*` routes — full remount +
  generic spinner on every navigation, no sidebar collapse. Owner-flagged
  2026-09-15, deliberately deferred to a dedicated session, not fixed yet.**
  Root cause confirmed: `app/app/layout.tsx`'s `AppLayout` explicitly bails
  out for inventory routes (`isNewInventoryRoute` → `return <>{children}</>`)
  so there is no shared layout at all — each screen
  (`item-catalog-screen.tsx`, `suppliers-screen.tsx`,
  `restock-levels-screen.tsx`) independently renders its own
  `InventoryDesktopShell` (sidebar + topbar) from scratch. Clicking a
  sidebar link therefore unmounts the entire tree, sidebar included, and
  remounts everything from zero while data re-fetches — the "spinner takes
  over the whole page and the sidebar disappears" symptom the owner
  reported is Next.js's own generic route-transition fallback, not custom
  app code (there is no literal "Loading…" string anywhere in this
  codebase). Separately, the new inventory sidebar has no collapse
  mechanism at all (the legacy `components/ui` shell has one via
  `sidebarCollapsed`, but inventory routes bypass that shell entirely).
  **Planned fix, not yet started:** extract the sidebar/topbar out of each
  screen into a real `app/app/inventory/layout.tsx` shared layout so it
  mounts once and persists across catalog/suppliers/restock-levels
  navigation; add per-route `loading.tsx` skeletons (a `LoadingState`-style
  skeleton already exists at `shell-states.tsx` for content-region loading,
  just needs to be reused as an immediate route-level fallback instead of
  Next's generic spinner); add sidebar collapse in the same pass since it
  touches the same component. Scoped as one contained refactor (extract +
  wire), not a rewrite — owner chose to hold it for a dedicated session
  rather than do it inline with the archive-terminology/bug-fix session
  this was found during.
- **Restock Levels drawer looked short vs. the Item Catalog table — checked,
  not a bug.** Owner raised this the same session as the shell issue above,
  worried the restock grid was silently dropping items. Verified directly:
  `restockLevelRepository.findLiveItemsForRestock` has no `type` filter and
  no pagination — it returns every live (non-`deletedAt`) item for the org,
  full stop. Confirmed against Postgres directly (33 live items) and against
  the drawer's own rendered row count in the same live session (33 rows,
  matching exactly). `useRestockLevels` also does no client-side
  filtering/truncation — `rows` is the full response, `displayRows` only
  overlays unsaved edits on top of it, nothing drops rows. If a future
  report says the counts genuinely mismatch, get the exact numbers on both
  screens before assuming this is the same non-issue — this verification
  was against a specific 33-item snapshot, not a standing guarantee.
- **`tokens.wds.css` OKLCH-vs-comment drift (Phase 0 origin) — RESOLVED,
  dedicated sweep done in the 2026-09-15 Verification Pass, item 3** (see
  Status log's "Verification pass (2026-09-15) — item 3" entry for full
  detail). All 46 color tokens in the file were regenerated from their own
  hex comment and round-trip-verified via canvas `fillStyle`; 31 had real
  drift (not "some" — most of the file), now corrected. This section is
  kept as history of how the problem was originally found; it is no
  longer an open issue.
- ~~Nearly every color token is written as `oklch(L C H); /* #HEX */`,
  and for most of them the OKLCH triplet doesn't actually convert to the hex in
  its own comment — some by an imperceptible 1-2 RGB units, several by 15-30+
  (`--color-info-fg` off by 31; several neutrals off by 20+).~~ `--wds-espresso-700`
  was found and corrected during the Toggle Group build (see Status below,
  owner-confirmed `#693C1B` is correct) since it's the primary brand color and
  directly affected that primitive's pixel-diff. **This session found and fixed three more
  instances of the same drift class**, touched because the Sidebar/Topbar
  composites actually consume them (see Status below): `--wds-sidebar-top/mid/
  bottom` (comment hex didn't match the OKLCH value's actual render, *and* the
  comment hex itself was wrong vs. Paper's real `--color-sidebar-top/mid/
  bottom` — a double error), `--wds-gradient-sidebar`'s angle/stop-position
  (165deg/30% vs. Paper's actual 164.69deg/40%), and `--wds-gradient-topbar`'s
  end-stop (pointed at `--wds-espresso-50`, a real, differently-tinted color,
  instead of Paper's actual bespoke `--color-topbar-end` — added as
  `--wds-topbar-end`). **`--wds-gradient-surface-raise` fixed during the KPI
  Strip build** (it had the same `#FFFFFF → espresso-50` pattern as the
  topbar gradient, flagged here but left untouched until a composite
  actually consumed it) — corrected to `var(--wds-surface) →
  var(--wds-surface-raise-end)`, the new `--wds-surface-raise-end` token
  round-trip-verified via canvas `fillStyle` to actually resolve to
  `#F7F5F2`. See KPI Strip's Status entry for the fix and for
  `--wds-accent-strong`, a second new token caught by the same round-trip
  check before it could ship with a wrong OKLCH triplet.
- **Tailwind `spacing` scale gaps silently drop utilities — the same failure
  mode as the `fontSize`/`customTextScale` bug already documented below in
  "Visual fidelity process" step 5, but for spacing, not color.** Tailwind v3
  (this project's version) does **not** generate arbitrary spacing steps on
  demand — only the fixed default scale plus whatever `tailwind.wds.preset.ts`
  explicitly adds. A class like `py-wds-3.5` for a token that doesn't exist in
  the preset's `spacing` object doesn't error or warn — Tailwind just never
  generates the utility, so the element silently gets zero padding instead of
  14px. Caught this session building the Sidebar Nav composite: `wds-3.5`
  (14px) and `wds-4.5` (18px) were used before being added to the preset,
  which cost real pixel-diff debugging time (6.34% → 2.93% once both were
  added) before the actual cause was found. **Any new spacing value pulled
  from Paper must be added to `tailwind.wds.preset.ts`'s `spacing` object in
  the same edit it's first used in a component** — check the class actually
  renders (computed styles in devtools, or just eyeball the built screenshot
  against Paper) before trusting a `py-wds-*`/`px-wds-*`/`gap-wds-*` class
  compiled without error.

## Status

- [x] Pixel-diff tooling in place — `pixelmatch`/`pngjs` installed,
      `frontend/scripts/visual-diff.ts` (`pnpm visual-diff`), 2% default threshold
- [x] `button.tsx` primary gradient corrected to match Paper exactly
      (`--wds-primary-btn-end` token added, `--wds-gradient-primary` fixed)
- [x] Sheet / Drawer primitive built (`components/ui2/sheet.tsx`) — right-anchored,
      500px, scrim `height:100%`/full-viewport (bug from prior manual fix now
      codified at the primitive), shadow/scrim/title tokens added
      (`--wds-shadow-drawer`, `--wds-scrim`, `--wds-text-faint`,
      `wds-drawer-title` fontSize). Close control is a plain "×" glyph, matching
      Paper exactly (not an icon-in-box). Responsive: holds its 500px width down
      to the `sm` breakpoint (640px), then goes full-bleed — checked clean at
      768px/1024px, no horizontal overflow.
- [x] Select primitive built (`components/ui2/select.tsx`) — trigger matches
      `Input` exactly (h-8, radius 2, `border-strong`, focus ring). Chevron is a
      plain "▾" glyph (not an icon), matching Paper's convention from Sheet's "×".
      New tokens: `--wds-text-faint` (reused), `wds-field-label` fontSize (11px
      mono-caps field label, e.g. "CATEGORY") and `wds-helper` fontSize (11px
      sans helper text) — genuinely distinct Paper text roles, not force-fit onto
      the existing `wds-overline`/`wds-caption`. `wds-1.5` (6px) spacing step
      added for the Paper-drawn label→control→helper gap. Popover surface
      (`SelectContent`/`Item`/`Label`/`Separator`) is convention-derived — Paper
      never draws an open Select/Dropdown state anywhere in the file (checked via
      `find_nodes` for any popover shadow — none exist) — used the standard
      elevated-surface convention (`wds-surface`/`wds-border`/`wds-radius-md`/
      `wds-shadow-md`) consistently with Card. Pixel-diff: trigger+label region
      2.14% (label+trigger crop), full field 2.73% — both marginally over the 2%
      guideline but the diff image is purely text-glyph outlines (AA noise, not a
      solid-block defect) with the border/spacing/chevron pixel-clean; treated as
      a pass per the documented "0% isn't realistic for text" caveat. No page
      overflow at 768px. Real responsive behavior (does the field shrink inside
      a narrower form column) is deferred to the Item Form composite that
      actually consumes this — the pixel-diff anchor here is a fixed 452px block
      matching Paper's isolated node export, not a real layout context.
- [x] Toggle Group primitive built (`components/ui2/toggle.tsx` +
      `toggle-group.tsx`) — restructured from shadcn's default gapped/individually-
      rounded segments into Paper's joined segmented-control look: one shared
      container border + radius, segments flush with a left-border divider
      between them, `rounded-none` per segment. Selected state is
      **Paper-verified** (not derived) — sourced directly off `SM6-0`:
      `espresso-700` fill, `--wds-primary-fg` text. Pixel-diff: 2.32% against
      Paper's `SM0-0` export, box-region-only crop confirms pixel-exact
      top/left/height alignment and segment widths (106/71/70px built vs.
      107/72/71px Paper) — the remaining mismatch is font AA on "Raw
      ingredient" / "Prepped" / "Stocked", same category as Select's.
      **Found and fixed, owner-confirmed:** `--wds-espresso-700` in
      `tokens.wds.css` was defined as `oklch(0.420 0.075 52)` with a comment
      claiming it equals `#693C1B`, but that OKLCH triplet actually rendered as
      `#6D4024` (browser-confirmed, off by roughly +4/+4/+9 per RGB channel) —
      a pre-existing Phase 0 drift between the comment and the real value, not
      introduced this session. Owner confirmed `#693C1B` (Paper's value) is
      correct; corrected the OKLCH triplet to `oklch(0.404 0.078 54)`, which
      converts to `#693C1C` (1-unit rounding, imperceptible) — verified via
      canvas `fillStyle` resolution in a real browser, not just the CSS source.
      Kept the token in OKLCH (not switched to hex) — this fixes the number,
      not the format. This is `--wds-primary`, used by Button/Sidebar/Toggle
      Group, so `pnpm build` was re-run clean after the change to catch any
      other regression. **A broader scan found the same claimed-vs-actual
      OKLCH drift on most other color tokens in the file** (some far larger —
      `--color-info-fg` off by 31 RGB units, several neutrals off by 20+) —
      this is a systemic Phase 0 authoring issue, not isolated to espresso-700.
      Only the one token this build actually touched was corrected here; the
      rest is flagged for a deliberate, dedicated pass (not a drive-by fix
      buried inside an unrelated primitive build) — see "Known issues" below.
- [x] Table primitive built (`components/ui2/table.tsx`) — semantic
      `<table>`/`<thead>`/`<tr>`/`<th>`/`<td>` markup (Paper's own artboard is
      flex-row divs; real tabular data gets real table semantics for
      screen-reader support instead of copying Paper's DOM shape 1:1). Header
      30px, `wds-table-header-bg` (new bespoke token, not on any existing
      scale), `border-b-ink`. Rows 46px, `border-b-neutral-100`. New
      `wds-table-label` fontSize token (11px mono/600/tracking, for header
      cells — distinct weight from the similar `wds-field-label`). Verified
      with a visual check against Paper's `SFT-0` export (header + first 2
      rows) — colors, spacing, and row/header heights match. **Not run through
      the automated pixel-diff at the bare-primitive stage** — flex-vs-table
      column-width math genuinely differs between Paper's layout and real
      `<table>` layout, so an empty/minimal-content primitive instance chases
      pixel-exactness against a layout system it doesn't use internally. The
      automated ≤2% pixel-diff check is deferred to the Item Catalog Table
      composite (real Paper toolbar + status dots + retired-row state), which
      is what actually ships and is the correct point to verify pixel fidelity.
- [x] Dropdown Menu primitive built (`components/ui2/dropdown-menu.tsx`) —
      filter-chip trigger matches Paper's toolbar chips exactly
      (`py-0.5 px-2`, `border-strong`, radius 2, `text-caption`). Popover
      surface reuses the same convention-derived tokens as Select's
      `SelectContent` (Paper doesn't draw an open dropdown/select state
      anywhere in the file, confirmed earlier). Visual-checked only (per
      updated process — see note below), not run through the automated
      pixel-diff.
      **Process change this session:** the automated ≤2% pixel-diff was
      taking disproportionate time on bare, minimal-content primitives
      (Table in particular — see its entry above) chasing precision a
      standalone primitive instance doesn't need yet. From here, primitives
      get sourced-from-Paper values + a real-browser visual check; the
      automated pixel-diff is reserved for composites (the actual shipped
      screens), where Paper's real content and layout make the comparison
      meaningful. Sheet, Select, and Toggle Group above were already fully
      pixel-diffed before this change — not redone under the new standard.
- [x] Avatar primitive built (`components/ui2/avatar.tsx`) — squared (radius 2,
      not round), bespoke `--wds-avatar-bg`/`--wds-avatar-fg` tokens (not
      derived from sidebar or general surface tokens — confirmed distinct via
      `get_computed_styles` on `SP6-0`/`SP7-0`). Visual-checked in the sidebar-
      dark demo context it's actually used in.
- [x] Search Input built (`components/ui2/search-input.tsx`) — an `Input`
      composition (icon + input + ⌘K hint), not a separate base primitive, per
      the handoff's own note to verify rather than assume. Matches Paper's
      topbar search box exactly (h-8, radius 2, `border` not `border-strong`).
      One deliberate deviation from Paper: the leading icon uses lucide's real
      `Search` glyph instead of Paper's bare-circle placeholder (a zoom-level
      simplification in the design tool, not an intentional icon choice — a
      handle-less circle wouldn't read as "search" to a user). New `wds-2.5`
      (10px) spacing token added for Paper's exact `px-2.5`.

All 7 Milestone One primitives (Sheet, Select, Toggle Group, Table, Dropdown
Menu, Avatar, Search Input) are now built in `components/ui2/`. Composites in progress.

- [x] Sidebar Nav + Topbar extracted (shared, not Inventory-scoped) —
      `frontend/components/app/shell/{sidebar-nav,topbar,nav-icons}.tsx`.
      `components/app/` already existed as a cross-feature location
      (`SessionBootstrap.tsx`); added a `shell/` subfolder rather than
      inventing a new top-level shared path. Reference: Session-0 shell,
      Paper page `3-0`, node `15W-0` → `18O-0` (sidebar) / `1GO-0` (topbar),
      per the handoff's own pointer — not the Milestone One clone page.

      **`SidebarNav`** (desktop) — data-driven: `groups` (label + items),
      `activeKey`, `user`, optional `orgLabel`/`logoSrc`. 236px wide (Paper's
      exact specimen width), header 56px, footer 52px, both `px-wds-4.5`
      (18px — a spacing token this build added, see Known issues). Nav list
      wrapper `py-wds-3.5`(14px)/`px-wds-2.5`(10px), group label
      `pt-2/pt-4`+`pb-1.5`, items `h-8`/`gap-wds-2.5`/`px-wds-2.5`, badge
      `h-[18px] min-w-[18px] px-[5px]` — all confirmed against
      `get_computed_styles` on `18U-0`/`25H-0`/`25I-0`/`25K-0`/`1AE-0`, not
      eyeballed.

      **Active-state correction to the doc's own suggested source:** Paper's
      sidebar-notes text (`1AK-0`) says "Active item: ... No fill, no left
      marker" and separately "Mobile: ... Same active treatment" — but the
      two actually-drawn specimens contradict that second claim. Verified
      against the real nodes, not the summary copy:
      - **Desktop** (`18T-0`): no fill, no left marker — brighter label
        (`--wds-sidebar-fg-active`) + 1.5px caramel underline, icon also
        caramel. Implemented as `DesktopNavItem`'s `active` branch.
      - **Mobile rail** (`1A5-0`): left-border marker (2px caramel) *and* a
        white-wash active background (`bg-[#FFFFFF0F]` → existing
        `--wds-sidebar-active-bg` token, previously unused by anything).
        Implemented in `SidebarRail`.

      Three new bespoke sidebar text tokens added (values genuinely off the
      existing neutral/espresso scale, confirmed via oklab→srgb conversion,
      not force-fit onto a nearby step): `--wds-sidebar-fg-item` (`#B5AEA5`,
      default/inactive nav item label — a third sidebar text role distinct
      from `fg`/`fg-active`/`fg-muted`), `--wds-sidebar-fg-name` (`#F0EEE9`,
      footer user name — distinct from `fg-active`), and
      `--wds-sidebar-badge-fg` corrected from `var(--wds-espresso-100)`
      (`#F1DECE`, a real but wrong value) to the bespoke `#EBDFD6` Paper
      actually draws (`35M-0`).

      **`SidebarRail`** (mobile) — same `groups`/`activeKey` shape, flattened
      to one icon-only list, never a "More" menu (per the doc's own rule).
      Paper's `1A5-0` specimen itself only draws 4 generic placeholder
      squares (not real per-item icons) — an abstract state demo, not a
      literal content match to the desktop's 10-item list — so the
      composite's real icons + full item set were verified against Paper's
      *box model* (`get_computed_styles` on `1A8-0`/`1AC-0`/`1AE-0`: `size-10`
      items, `h-3.5 w-3.5` badge at `right-1.5 top-1.5`, all confirmed
      pixel-exact) rather than forcing an artificial 4-item content match
      just to make the pixel-diff comparable.

      **`Topbar`** — `breadcrumb` ({section, screen}), optional
      `searchProps` (passed through to `SearchInput`), `actions` slot
      (right-aligned, consumer-supplied buttons — the composite itself
      doesn't hardcode button styling/gradient choices). 56px,
      `wds-gradient-topbar`, `gap-wds-2` breadcrumb, search `ml-wds-4 w-[300px]`
      — confirmed against `1GT-0`/`1GX-0`. Same deliberate Search-icon
      deviation as the `SearchInput` primitive (lucide glyph, not Paper's
      placeholder circle) — not a new decision, just inherited.

      **Pixel-diff (composite standard, not the relaxed primitive one):**
      captured Paper's `18T-0`/`1A5-0`/`1GS-0` via `export` at their native
      pixel dims (236×760 / 60×520 / 1400×56 respectively — no viewport
      scaling needed since Paper's own specimens are already the reference
      size), built an isolated `/dev/wds-diff?target=` route rendering one
      composite with zero chrome at that exact size, screenshotted with
      Playwright at matching dims, ran `pnpm visual-diff`.
      - **Sidebar: 2.93%** (down from 6.34% before the `wds-3.5`/`wds-4.5`
        spacing-token fix — see Known issues). Diff image inspected: no
        solid-block regions: the two remaining contributors are (a) the demo
        logo — a flat placeholder circle vs. Paper's actual photo asset,
        confirmed ~0.2% of the total by masking the logo region and
        re-diffing (2.93% → 2.73%), not a code defect since `logoSrc` is an
        optional prop with no real org asset to pass in a dev demo; (b) text
        AA at 236px width, confirmed by a 4× zoom crop of "Dashboard"
        showing pixel-identical weight/position between Paper and built —
        same "0% isn't realistic for text" category as Select/Toggle Group,
        just a larger % here because the component itself is narrow.
        **Treated as a pass** per that established precedent.
      - **Topbar: ~4.3%** (after flattening Paper's alpha-channel PNG export
        onto white first — Paper's export has transparent rounded corners
        from `border-radius`, a real browser screenshot doesn't, so an
        unflattened diff inflates on all four corners; this is a capture
        artifact, not a design defect, same category as Table's flex-vs-table
        primitive-stage gap). Zoomed breadcrumb-text comparison confirmed
        pixel-identical font rendering; box-model values
        (`1GT-0`/`1GX-0` gap/width/margin) all matched exactly via
        `get_computed_styles`. Remaining delta is AA noise plus the demo's
        two known/expected deviations (search icon glyph; the demo's
        primary-button gradient, which is a property of the *consuming demo's*
        button choice, not the Topbar composite itself). **Treated as a
        pass** on the same basis as Sidebar.
      - Both composites' box-model values were cross-checked directly against
        `get_computed_styles` on the source nodes (not just the diff image)
        before accepting the AA-noise verdict — this is the standard the
        owner asked to confirm holds: keep the 2% bar, but let "confirmed AA
        noise vs. a real solid-block defect" be a documented judgment call
        (diff-image inspection + independent box-model check), not a lower
        threshold.
      - No `outDiff.png`/captured Paper/built PNGs are committed — they were
        throwaway verification artifacts in `frontend/.scratch/` (gitignored)
        and the isolated `/dev/wds-diff` route was deleted after use. Re-run
        the same capture process (Paper `export` at native dims → isolated
        render route → Playwright screenshot → `pnpm visual-diff`) if this
        needs re-verifying later.

      Responsive spot-check (768px/1024px): **Sidebar/Rail** hold their fixed
      236px/60px widths as designed (they're nav rails, not fluid content) —
      confirmed they don't force page-level horizontal scroll on their own at
      either width. **Topbar** has no hardcoded width in the component itself
      (`flex`, no `w-*` on the root) — confirmed it shrinks cleanly in a fluid
      container at 768px: search box + action buttons stay fixed-size and fit,
      breadcrumb text wraps to two lines rather than overflowing. No dedicated
      "collapse the sidebar below N px" behavior built yet — out of scope for
      this component-extraction step; that's a page-layout decision for
      whichever screen composite (Step 4, later item, or Step 5) actually
      assembles Sidebar + Topbar + content into a real screen.
- [x] Mobile Hub Header + Task Header + Status Bar extracted (shared) —
      `frontend/components/app/shell/{mobile-headers,mobile-status-bar}.tsx`.
      Reference: Milestone One mobile artboards, Paper page `B-0`: `TM8-0`
      (Hub Header, "1m · Item catalog · mobile"), `TUY-0` (Task Header /
      Cancel, "2m · New item · mobile"), `TZO-0` (Task Header / Done, "5m ·
      Par levels · mobile"), `TLY-0` (Status Bar).

      **`MobileStatusBar`** — pasted from `get_guide("mobile-status-bar")`
      verbatim (spacing/padding/font-size/SVG paths untouched, per the
      guide's own instruction), with one addition the guide doesn't cover:
      `get_jsx` on `TLY-0` showed Wendo's own usage bakes `bg-sidebar-mid`
      directly onto the status bar frame in every instance in the file (not
      left transparent to inherit a dark screen background) — codified as
      the component's default background rather than left for each consumer
      to add.

      **`MobileHubHeader`** — hamburger + "WENDO RMS · {org}" (caramel,
      `wds-field-label` mono uppercase) + avatar circle (28px, `espresso-600`
      fill, matches the sidebar-footer avatar's circular treatment — not the
      squared `Avatar` ui2 primitive, confirmed distinct via `get_jsx` on
      `TME-0`: `border-radius: 50%`), then title/subtitle. `gap-wds-4`
      (16px)/`pb-wds-5`(20px)/`pt-wds-4`(16px) container,
      `gap-wds-2.5`(10px) icon-to-label — all confirmed via
      `get_computed_styles` on `TM8-0`/`TM9-0`/`TMA-0`/`TME-0`.

      **`MobileTaskHeader`** — back chevron + trailing action, then
      title/subtitle. `trailingAction: 'Cancel' | 'Done'` prop — **not** a
      fixed "Cancel", since Paper draws both: create/edit forms use Cancel
      (`TUY-0`), the Restock Levels save-as-you-go screen uses Done
      (`TZO-0`, confirmed by re-reading that screen's actual task header
      rather than assuming every task header is identical).
      `gap-wds-1.5`(6px)/`px-wds-4`(16px)/`pb-wds-4.5`(18px)/`pt-wds-3`(12px)
      — confirmed via `get_computed_styles` on `TUY-0`/`TUZ-0`.

      **New tokens added:** two `fontSize` tokens genuinely distinct from
      the desktop `wds-h1`/`wds-h2` scale (Paper's own `--text-title`/
      `--leading-title` = 24/30 token pair, not reachable from any existing
      wds-* step) — `wds-mobile-title` (24px/30px/600, Hub Header title) and
      `wds-mobile-task-title` (20px/24px/600, Task Header title), both
      registered in `lib/cn.ts`'s `customTextScale` in the same edit per the
      documented `tailwind-merge` allowlist gotcha.

      **Bug found and fixed (same failure class as the `wds-3.5`/`wds-4.5`
      spacing gap from the Sidebar Nav build, but for colors this time):**
      `tailwind.wds.preset.ts`'s `wds-sidebar` color group only registered
      `fg`/`fg-item`/`fg-active`/`fg-muted`/`fg-name`/`divider`/`marker`/
      `active-bg`/`badge-bg`/`badge-fg` — **`top`/`mid`/`bottom` (the actual
      background fills) were never added**, even though `bg-wds-sidebar-top`
      was already being used (silently dropped, zero visual effect) by the
      pre-existing Avatar demo section in `/dev/wds`. Caught by a first
      real-browser render of `MobileHubHeader` showing white text on a
      cream background — the dark fill simply never generated. Fixed by
      adding all three to the preset's color group; re-verified in-browser
      afterward that the fix actually rendered (not just that the build
      compiled), and the previously-silently-broken Avatar demo section is
      now also correctly dark, a pre-existing bug this fix incidentally
      resolved.

      **Visual verification:** real-browser screenshots (isolated
      `/dev/wds-diff?target=` route, deleted after use per the established
      pattern) compared side-by-side against `get_screenshot` captures of
      `TLT-0` (status bar + hub header together) and `TLU-0`/`TLX-0`
      (status bar + task header, both Cancel and Done variants) — colors,
      spacing, type, icon glyphs all match. Not run through the automated
      `pnpm visual-diff` pixel-diff script: the `export` MCP tool's current
      schema rejects a single `nodeId` call in this session (schema
      mismatch, not a usage error — same tool worked for prior composites'
      `export` calls per the handoff, so this may be a transient MCP
      version skew) and `get_screenshot` doesn't save to disk, so there was
      no way to produce the two on-disk PNGs the script requires. Fell back
      to `get_computed_styles` cross-checks (exact match on every padding/
      gap/color/size value read) plus the by-eye screenshot comparison —
      the same standard already established as sufficient for
      bare-primitive verification, applied here because the automated path
      was unavailable, not skipped by choice. Re-attempt the automated
      diff on a future composite once the `export` tool issue is confirmed
      resolved.
      Responsive: confirmed via `getBoundingClientRect` at 768px that the
      fixed-390px header sections stay fully inside the viewport (right
      edge 422px of 753px available) — no overflow contribution from these
      composites specifically (the page's overall horizontal scroll at
      768px is pre-existing, from the 1440px-wide Sidebar/Topbar sections
      documented as out-of-scope in their own Status entries).
- [x] KPI Strip + KPI Stat Cell built — `frontend/components/inventory/kpi-strip.tsx`
      (`KpiStrip` desktop, `KpiRow` mobile). Reference: `1QN-0` (Shells &
      Primitives page, desktop specimen) / `TMQ-0` (Milestone One page,
      mobile "1m · Item catalog" specimen).

      **Tone system, not per-cell hardcoding:** confirmed via
      `get_computed_styles` on all 4 desktop cells that only genuinely
      actionable numbers get an accent color — "SKUs tracked" (248, first
      cell) stays plain ink, "Below reorder" (12) is `--color-accent-strong`,
      "Expiring ≤7d" (3) is `--color-warning-fg`. Mobile's "Needs scope" (3)
      is `--color-error-fg` — a third tone not present on desktop, confirmed
      by actually reading the mobile specimen rather than assuming the two
      share a palette. Built as a `tone?: 'ink' | 'accent' | 'warning' |
      'error'` prop rather than 4 hardcoded cell components.

      **Desktop (`KpiStrip`):** joined cells, `flex-grow:1 flex-basis:0%`
      (equal-width, not fixed 275px — confirmed via `get_computed_styles`,
      so it re-flows with however many cells a screen passes), one shared
      border/radius, `border-r` divider between cells (last cell has none),
      `wds-gradient-surface-raise` fill per cell, `gap-wds-1.5`(6px)
      label→value→detail, `p-wds-4`(16px). Trend cells (stock value) get a
      dot + colored caption instead of the plain muted detail caption —
      modeled as a `trend` vs `detail` union on `KpiCellData` since Paper
      draws both and they're mutually exclusive per cell.

      **Mobile (`KpiRow`):** discrete bordered cells, not joined — each its
      own `rounded-wds-md border` card, `gap-wds-2.5`(10px) between cards,
      `p-wds-3`(12px) per cell — confirmed distinct from the desktop
      structure via `get_computed_styles` on `TMR-0` (mobile) vs `1QO-0`
      (desktop), not assumed to be the same component at a smaller size.

      **Bug found and fixed (same OKLCH-comment-drift class already
      documented in Known issues, now hit twice more):**
      `--wds-gradient-surface-raise` was still on the placeholder
      `#FFFFFF → espresso-50` pair flagged (but not yet fixed) in Known
      issues — corrected to `var(--wds-surface) → var(--wds-surface-raise-end)`
      matching Paper's actual `1QO-0` gradient. `--wds-surface-raise-end`
      and `--wds-accent-strong` didn't exist as tokens yet (needed for this
      composite specifically) — both added, and **both round-trip-verified
      via canvas `fillStyle` → `getImageData` before being committed to the
      token file**, not just hand-converted: an initial hand-estimated
      OKLCH triplet for each was off by several RGB units on the first try
      (`#F4F3F1` vs target `#F7F5F2`; `#423127` vs target `#4A3527`) — caught
      immediately by the round-trip check rather than shipping another
      silent-drift token, then corrected by solving the sRGB→OKLCH
      conversion directly instead of guessing again.

      **New fontSize tokens** (registered in `lib/cn.ts` in the same edit):
      `wds-kpi` (28px/34px/500/-0.01em, desktop value — Paper's own
      `--text-kpi`/`--leading-kpi` token pair, not reachable from any
      existing wds-h* step), `wds-kpi-sm` (22px/28px/500, mobile value),
      `wds-kpi-label-sm` (10px/12px/label-tracking, mobile label — smaller
      than desktop's 11px `wds-field-label`, confirmed via
      `get_computed_styles` on `TMS-0`, not assumed equal to the desktop
      label size).

      **Visual verification:** by-eye screenshot comparison (Playwright,
      full 1100px-anchor width) against `get_screenshot` captures of
      `1QN-0`/`TMQ-0` — colors, gradient wash, accent tones, dot+trend
      styling, and cell proportions all match. Not run through the
      automated `pnpm visual-diff` script, same `export`-tool schema
      blocker noted on the Mobile Header entry above. Initial screenshot at
      the dev page's default (narrower, `max-w-5xl`-constrained) viewport
      showed "KES 1.84M" wrapping to two lines — investigated via
      `getBoundingClientRect` before assuming a component defect, traced to
      the demo viewport being narrower than the 1100px anchor width, not a
      real bug; re-verified clean at the actual 1440px reference width.
      Responsive: `KpiStrip`/`KpiRow` both use `max-w-full` and contribute
      no horizontal overflow at 768px (verified via `scrollWidth`); the
      page's pre-existing 768px overflow from the 1440px Sidebar/Topbar
      sections is unchanged and already documented as out-of-scope there.
- [x] Drawer Shell built (composite on top of the Sheet primitive above) —
      `frontend/components/inventory/drawer-shell.tsx`. Reference: `SMI-0`/
      `SKW-0` (Milestone One, Item create/edit drawer — the real 500px
      drawer this milestone's screens use, not the Shells & Primitives
      page's illustrative 460px generic specimen `4CK-0`, which was checked
      first and ruled out as the wrong reference for this milestone).

      **Thin composite, not a new visual primitive:** `get_computed_styles`
      on `SMD-0`/`SL2-0`/`SKX-0` (header/body/footer) showed every value —
      `pt-20/pb-16/px-24` header, `py-20/px-24 gap-16` body, `py-16/px-24
      gap-8` footer — already matches what `ui2/sheet.tsx`'s
      `SheetHeader`/`SheetFooter` codify from the earlier Sheet primitive
      build, so `DrawerShell` is a thin prop-driven wrapper (`title`,
      `description`, `primaryLabel`, `children`) over
      `Sheet`/`SheetContent`/`SheetHeader`/`SheetFooter`/`SheetTitle`/
      `SheetDescription` — not a rebuild. Standardizes the pattern every
      one of the 4 Milestone One drawers repeats (header always carries
      the record's context line per the Shells & Primitives page's own
      note; footer is always secondary Cancel + primary action) so each
      drawer screen doesn't hand-assemble the Sheet primitives itself.

      **Visual verification:** real-browser screenshot of the interactive
      demo (button → opens the drawer) in `/dev/wds` — 500px right-anchored
      panel, scrim, header/body/footer spacing all match Paper's reference
      screenshot of `SKW-0`. 0 console errors. Not run through the
      automated `pnpm visual-diff` script (same `export`-tool schema
      blocker as the Mobile Header / KPI Strip entries above) — relied on
      the fact that every value here is inherited unchanged from the
      already pixel-diff-verified Sheet primitive, plus a by-eye check of
      the new header/footer content this composite adds on top.
- [x] Item Catalog Table built —
      `frontend/components/inventory/item-catalog-table.tsx`
      (`ItemCatalogToolbar` + `ItemCatalogTable` desktop,
      `ItemCatalogList` mobile). Reference: `SFT-0` (desktop toolbar +
      header + rows) / `TN1-0`/`TN2-0` (mobile card list). This is the
      composite the `Table` primitive's own Status entry deferred pixel
      fidelity to — the toolbar, per-type status dot, and retired-row
      opacity were deliberately excluded from the bare primitive build.

      **Toolbar** (`SHQ-0`): "Items" label + count badge, then
      Type/Department/Category filter chips (each reusing the
      `DropdownMenu` primitive's filter-chip trigger convention already
      established) + a "Show retired" toggle chip + a vertical divider +
      "Manage categories" link in `--color-primary`. `h-10`(40px)/
      `gap-wds-2`(8px)/`px-wds-4`(16px) — confirmed via
      `get_computed_styles` on `SHQ-0`/`SHR-0`.

      **Type → color mapping, read per-row not assumed uniform:**
      `get_computed_styles` on all 3 distinct type dots showed 3 different
      colors — Raw ingredient = `--color-neutral-400` (gray), Stocked item
      = `--color-info-fg` (blue), Prepped item = `--color-success-fg`
      (green) — confirmed by reading `SHG-0`/`SG2-0`/`SGW-0` individually
      rather than assuming one dot color for all types. Modeled as a
      `Record<ItemType, string>` lookup, not per-row conditional styling.

      **Retired-row state (Paper-verified, not derived):** the *entire row*
      at `opacity: 0.55` (`SFU-0`), not just the name text — confirmed via
      `get_computed_styles`, since the row's other cells (type dot,
      category, units) needed to be checked too rather than assuming only
      the strikethrough-style name treatment applies.

      **Column widths** match `SFT-0` exactly: Name (flex, `min-w-[180px]`)
      · Type (120px) · Category (140px) · Units (160px) · Pack (110px,
      right-aligned) · Department scope (250px, `pl-wds-6`/24px indent —
      confirmed via `get_computed_styles` on `SH9-0` that this is a real
      `padding-left`, not a stray margin someone could drop by accident).

      **Mobile (`ItemCatalogList`):** not a table at all — a card list,
      confirmed via `get_jsx` on `TN2-0`: name + units on one row, dot +
      "Type · Category · Scope" caption below, `p-wds-3`(12px)/`gap-1`(4px)
      per card, cards separated by `border-b` (last card has none).

      **Fixed during build:** the dev-preview demo initially double-bordered
      the toolbar and table (each had its own full border, producing a
      visible seam at their shared edge) — caught in the first real-browser
      screenshot, not assumed fine. Fixed by having the toolbar's `border`
      + `border-b-0` sit flush above the `Table` primitive's own border,
      giving one continuous box matching Paper's single unified container.

      **Visual verification:** real-browser screenshot compared against
      `get_screenshot` captures of `SFT-0` (desktop) and `TN1-0` (mobile) —
      toolbar layout, header indent, dot colors, retired-row opacity, and
      mobile card structure all match. Not run through the automated
      `pnpm visual-diff` script (same `export`-tool schema blocker as the
      other composites in this session) — relied on per-node
      `get_computed_styles` cross-checks (exact match on every width/
      padding/color read) plus the by-eye screenshot comparison.
      Responsive: composite itself uses `max-w-full` and contributes no
      768px overflow (confirmed via `getBoundingClientRect` — shrinks to
      689px/358px at 768px viewport); the page's pre-existing overflow at
      that width comes from the older bare-primitive Table demo section
      higher up the page (`table-pixel-diff-anchor`, fixed 1140px, no
      `max-w-full` — a leftover from the primitive-stage build, out of
      scope for this composite to fix).
- [x] Item Form built (shared between desktop drawer + mobile route) —
      `frontend/components/inventory/item-form.tsx` (`ItemFormFields`, one
      component, `variant: 'desktop' | 'mobile'` prop). Reference: `SL2-0`
      (desktop body, slots into `DrawerShell`'s children) / `TV7-0` (mobile
      full-screen route).

      **Field set, identical both places, sourced from `get_computed_styles`
      field-by-field, not assumed from the screenshot alone:** Name, Type
      (toggle group), Category (Select + helper), Preferred supplier —
      optional (Select + helper), Buy unit / Usage unit (2-col row),
      Conversion / Pack size (2-col row), Where it may exist (conditional —
      see below), Central Store restock level — optional (120px input).

      **`variant` genuinely changes control sizing, confirmed via
      `get_computed_styles` rather than assumed identical-at-different-
      zoom:** desktop inputs/selects are `h-8`(32px)/`radius-sm`(2px)
      (`SMA-0`/`SLW-0`), mobile are `h-[44px]`/`radius-md`(4px)
      (`TVA-0`/`TVN-0`) — a real control-size difference, not a scaled
      screenshot. Desktop Type toggle segments are plain-height (`SM1-0`
      fit-content); mobile's are `h-10`(40px) and stretch full-width
      (`TVE-0`/`TVF-0` `flex-grow:1`) — also confirmed distinct, not
      assumed.

      **"Where it may exist" is a Paper-verified conditional state, not
      always an editable field:** for `type: 'raw'`, `get_computed_styles`
      on `SL9-0` showed a readonly-looking display (neutral-50 bg, muted
      text, no focus ring) with the accompanying helper text explaining
      raw ingredients can't be scoped to a department — for `prepped`/
      `stocked`, it's a normal editable field. Modeled as a conditional
      render keyed off `values.type`, verified interactively in-browser
      (toggling Raw → Stocked actually swaps the field from readonly
      display to editable `Input` and updates the helper text, not just
      correct in the default screenshot).

      **Visual verification:** real-browser screenshots of both variants
      side-by-side (desktop 500px / mobile 390px, matching each shell's
      real width) compared against `get_screenshot` captures of `SL2-0`/
      `TV7-0` — field order, labels, helper text, and control sizing all
      match; interactively toggled Type to confirm the conditional
      "Where it may exist" state actually re-renders, not just the static
      default. Not run through the automated `pnpm visual-diff` script
      (same `export`-tool schema blocker as the other composites this
      session). Responsive: both variants use `max-w-full` and the demo
      row switches `lg:flex-row` → stacked below `lg`; confirmed via
      `getBoundingClientRect` at 768px that both shrink cleanly
      (336.5px each) with no overflow contribution.
- [x] Category Manager List built —
      `frontend/components/inventory/category-manager-list.tsx`
      (`CategoryManagerList`, `variant: 'desktop' | 'mobile'`). Reference:
      `SRG-0` (desktop, inside the "Manage categories" drawer) / `TX2-0`
      (mobile, "3m · Manage categories").

      **Drawer width is 420px, not 500px — checked, not assumed:**
      `get_computed_styles` on `SRC-0` showed this drawer is 420px, unlike
      the Item Form's 500px drawer (`SKW-0`) — Milestone One doesn't use one
      fixed drawer width for everything. This composite doesn't own drawer
      chrome itself (same "slot into DrawerShell" pattern as Item Form), so
      it's documented here for whoever wires the real "Manage categories"
      drawer screen later, rather than silently assuming 500px.

      **Rename link color is a genuine Paper-drawn platform difference, not
      an inconsistency to normalize away:** desktop's "Rename" link
      (`SS2-0`) is plain `--color-text-muted`; mobile's (`get_jsx` on
      `TX3-0`) is `--color-primary` (an actual colored link). Verified both
      independently rather than assuming the same link styling applies at
      both sizes — built as a `variant`-conditional tone, not one shared
      class.

      **Retired-row state (Paper-verified):** `get_computed_styles` on
      `SRH-0` confirmed the *entire row* — not just the name — sits at
      `opacity: 0.55` (same convention already established on the Item
      Catalog Table's retired rows), and its trailing link swaps to
      "Restore".

      **"+ Add a category" input:** dashed border (`border-style: dashed`),
      not the ordinary solid `Input` primitive border — confirmed via
      `get_computed_styles` on `SS5-0`/`TX0-0`, a deliberately different
      affordance for "type here to create something new" vs. an ordinary
      field. Built as its own styled `<input>` rather than the `Input`
      primitive plus an override, since the dashed border is the field's
      entire visual identity, not an edge-case variant of the solid one.

      **Visual verification:** real-browser screenshot of both variants
      compared against `get_screenshot` captures of `SRG-0`/`TX2-0` — the
      Rename/Restore link color difference, dashed add-input, row spacing,
      and retired-row opacity all match. Not run through the automated
      `pnpm visual-diff` script (same `export`-tool schema blocker as the
      other composites this session). Responsive: `max-w-full` on both
      variants, confirmed via `getBoundingClientRect` at 768px — no
      overflow contribution.
- [x] Supplier Form built —
      `frontend/components/inventory/supplier-form.tsx`
      (`SupplierFormFields`, `variant: 'desktop' | 'mobile'`). Reference:
      `6TF-0`/`SX5-0` (desktop drawer) / `TLW-0` (mobile, "4m · New/edit
      supplier"). Fields: Name, Contact person + Category (2-col), Phone +
      Email (2-col), Default payment terms toggle.

      **Drawer width is 460px — a third distinct width found this session**
      (Item Form 500px, Category Manager 420px, Supplier Form 460px):
      confirmed via `get_computed_styles` on `SX6-0`, not assumed to match
      either prior composite.

      **Desktop payment-terms toggle is a real, deliberate exception to the
      established `ToggleGroup` selected-state convention — found by
      checking, not assumed uniform:** every other selected-toggle segment
      in this build (Item Form's Type toggle, mobile's own payment-terms
      toggle) uses the `espresso-700` gradient fill + white text Paper
      established as the segmented-control convention. This one doesn't —
      `get_computed_styles` on `SXI-0`/`SXJ-0` shows desktop's selected
      "Invoice to follow" as an `espresso-50` tint fill with
      `--color-primary`-colored text instead, while `get_computed_styles`
      on mobile's equivalent (`TZ6-0`/`TZ7-0`) confirms mobile uses the
      *standard* gradient-fill treatment. Read independently before
      concluding they differ — it would have been easy to assume one
      component covers both. Built as two different renderers
      (`DesktopPaymentTermsToggle`, a local one-off matching this field's
      specific drawn state, vs. the standard `ToggleGroup` primitive for
      mobile) rather than forcing one shared component to carry a
      variant-specific selected-color override.

      **Visual verification:** real-browser screenshot of both variants
      compared against `get_screenshot` captures of `SX5-0`/`TLW-0` — field
      layout, the desktop tint-toggle vs. mobile gradient-toggle
      distinction, and helper text all match. Not run through the
      automated `pnpm visual-diff` script (same `export`-tool schema
      blocker as the other composites this session). Responsive:
      `max-w-full` on both variants, confirmed via `getBoundingClientRect`
      at 768px — no overflow contribution.
- [x] Restock Level Grid built —
      `frontend/components/inventory/restock-level-grid.tsx`
      (`RestockLevelGrid` + `RestockLevelHelperNote`,
      `variant: 'desktop' | 'mobile'`). Reference: `T52-0`/`T5F-0`
      (desktop, Central Store drawer) / `TLX-0`/`U03-0` (mobile,
      "5m · Par levels"). Row content: item name/unit, on-hand (colored if
      below restock level), editable restock-level input, plus the
      helper-note callout band (dot + muted caption) below the grid.

      **Drawer width is 440px — a 4th distinct width found this
      milestone** (Item Form 500px, Category Manager 420px, Supplier Form
      460px, this one 440px): confirmed via `get_computed_styles` on
      `T53-0`, each drawer checked independently rather than assumed to
      share a width with any prior composite.

      **Below-restock-level tone is a genuine, Paper-drawn platform
      difference — the second one found in this session (after Supplier
      Form's payment-terms toggle):** `get_computed_styles` on desktop's
      "Coffee beans" on-hand cell (`T5S-0`) showed `--color-warning-fg`
      (amber); the equivalent mobile cell (`U0E-0`) showed
      `--color-error-fg` (red). Read both independently — the desktop
      screenshot alone looks reddish/amber-ambiguous at a glance, so this
      was confirmed with computed styles rather than eyeballed. Modeled as
      a `belowLevelToneClass` lookup keyed by `variant`, not a single
      shared color.

      **Header column spacing has zero gap between "On hand" and "Restock
      level" on desktop — matches Paper exactly, not a layout bug:**
      noticed the two header labels sit flush together in the built
      screenshot and verified via `getBoundingClientRect` before assuming
      a mistake; Paper's own `T5Y-0`/`T5X-0` computed styles show the same
      adjacent-with-no-gap arrangement (each column's width carries its
      own alignment, no gap token between them) — confirmed intentional,
      not "fixed" by adding a gap that would deviate from the reference.

      **Visual verification:** real-browser screenshot of both variants
      compared against `get_screenshot` captures of `T52-0`/`TLX-0` — the
      amber-vs-red tone distinction, dashed "+ Add an item" (desktop only,
      matching Paper — mobile's reference doesn't draw an equivalent add
      row within this composite's scope), and helper-note band all match.
      Not run through the automated `pnpm visual-diff` script (same
      `export`-tool schema blocker noted on every composite this session).
      Responsive: `max-w-full` on both variants, confirmed via
      `getBoundingClientRect` at 768px — no overflow contribution.

This was the last composite in the Milestone One list — **all primitives
and composites in this doc's build order are now built.** See the top of
this Status section and the HANDOFF doc for the full session-by-session
history; the `export`-tool schema issue affecting the automated pixel-diff
from the Mobile Header composite onward (Sidebar Nav/Mobile Icon Rail/
Topbar were diffed before it appeared) is flagged consistently across every
affected entry above and should be revisited before the next milestone's
build, not worked around silently again.

- **Verification pass (2026-09-14) — item 1, the automated pixel-diff gap.**
  Independent session, not the one that built the composites above.
  `export` on a single node works fine now — the schema issue is resolved,
  confirmed by exporting `SFT-0` cleanly on the first call. Ran the real
  `pnpm visual-diff` (not the manual `get_computed_styles` substitution) on
  all 7 composites the prior session couldn't diff: Mobile Hub Header, Mobile
  Task Header (Cancel + Done), Mobile Status Bar, KPI Strip (desktop +
  mobile), Drawer Shell, Item Catalog Table (desktop + mobile), Item Form
  (desktop + mobile), Category Manager List (desktop + mobile), Supplier
  Form (desktop + mobile), Restock Level Grid (desktop + mobile) — 17
  captures total.

  **Two real capture-process bugs found and fixed before results were
  trustworthy, both worth carrying forward to the next diff run:**
  1. **Paper's PNG export is not flattened** — fully transparent
     (`rgba(0,0,0,0)`) wherever the artboard has no explicit fill, while a
     real browser screenshot is opaque. Undiffed, this produces 90%+
     mismatches that look nothing like the actual visual gap (confirmed by
     eye: the two images looked near-identical despite a reported 93%
     mismatch). Same root cause the prior session already found for Topbar's
     corner-radius transparency, just not generalized — every Paper
     reference PNG needs alpha-composited onto white before diffing, not
     just ones with visible rounded corners. Fixed by flattening all
     references once (`.scratch/diff/paper-flat/`, gitignored, not
     committed) before running `pnpm visual-diff`.
  2. **Browser scrollbars inflated small mobile captures by 20%+** — the
     isolated `/dev/wds-diff` harness didn't set `overflow: hidden`, so a
     content height 1-2px over the viewport triggered a visible scrollbar
     that pixelmatch counted as solid-block mismatch (Mobile Status Bar
     alone went from 26.76% to 1.48% once fixed). Fixed at the harness root
     (`html,body{overflow:hidden}` injected in `/dev/wds-diff/page.tsx`)
     rather than per-capture.

  **Results after both fixes, ≤2% threshold:**
  - **Pass:** Mobile Status Bar (1.48%), Category Manager Desktop (1.39%),
    Supplier Form Desktop (1.33%), Restock Level Grid Desktop (1.53%).
  - **Marginal (2-4%, same AA-noise category already established for
    Select/Toggle Group/Sidebar/Topbar — not re-litigated here, but not
    independently re-confirmed as AA-noise vs. defect either; flagged for a
    quick by-eye check before fully trusting):** Mobile Hub Header (2.23%),
    Item Catalog Table Desktop (2.14%), Item Form Desktop (2.79%), KPI Strip
    desktop (3.30%) and mobile (3.46%), Drawer Shell (3.51%), Mobile Task
    Header Cancel (3.57%).
  - **Real, above-noise fail, root-caused:** Mobile Task Header Done
    (5.14%), Category Manager Mobile (6.54%), Restock Level Grid Mobile
    (7.76%), Item Catalog Table Mobile (8.65%), Item Form Mobile (11.22%),
    Supplier Form Mobile (11.67%) — **not fully root-caused for all six**,
    see below.
  - **One real component bug found and fixed:**
    `components/inventory/supplier-form.tsx`'s Contact person/Category and
    Phone/Email rows were hardcoded to a 2-column `flex gap-wds-3` layout
    for **both** variants — but Paper's mobile reference (`TLW-0`) draws
    every field as a full-width single-column row on mobile, only pairing
    columns on desktop. This was never caught by the original build because
    its own verification checked colors/spacing/tokens per field but not
    the mobile stacking structure. Fixed: `isMobile ? 'flex flex-col
    gap-wds-4' : 'flex gap-wds-3'` on both row wrappers. Confirmed via
    screenshot the fields now stack correctly. The diff is still 11.67%
    post-fix, not because the fix is wrong (visually confirmed matching
    single-column layout) but because the built composite legitimately
    doesn't render a trailing "Save changes" button — that's owned by
    whatever screen assembles this composite into the real mobile route
    (same "doesn't own drawer chrome" pattern already established for this
    composite's desktop side), so a like-for-like diff against Paper's
    full-screen mock (which does draw Save changes) can't reach 2% until
    Step 5 wires the real screen. Not a defect in this composite.
  - **Not root-caused, flagged for follow-up rather than guessed at:** Item
    Form Mobile, Item Catalog Table Mobile, Restock Level Grid Mobile,
    Category Manager Mobile, Mobile Task Header Done. Time-boxed this pass
    to the Supplier Form bug (clearly reproducible, clearly fixable) rather
    than root-causing all six — they may share the same "composite excludes
    trailing shell content Paper's full-screen mock includes" explanation
    as Supplier Form Mobile, or may hide their own real defects. **Do not
    assume they're all the same known-scope difference — check each
    individually before the next milestone ships.**
  - Capture artifacts: `.scratch/diff/{paper,paper-flat,built}/` (gitignored
    dev-only PNGs, not committed), isolated route at
    `frontend/app/dev/wds-diff/page.tsx` — **left in place this time**
    (not deleted after use, unlike prior sessions) since the harness itself
    needed real fixes (scrollbar, alpha) worth keeping for the next
    diff run rather than re-discovering. Delete once Step 5 no longer
    needs it, or once the six unresolved mobile mismatches above are
    closed out.
  - Items 2 (structural/accessibility audit) and 3 (OKLCH token-drift sweep)
    from the Verification Pass checklist were **not run this session** —
    scoped out deliberately to fit a time budget, not skipped by oversight.
    Do them as their own pass.

- **Verification pass (2026-09-15) — item 1, root-causing the 6 unresolved
  mobile failures + confirming the 6 "marginal" composites.** Independent
  session continuing directly from the 2026-09-14 pass above. Reused the
  existing `/dev/wds-diff` harness and `.scratch/diff/` captures rather than
  rebuilding — both were left in place for exactly this.

  **The 6 "marginal (2-4%)" composites (Mobile Hub Header, Item Catalog
  Table Desktop, Item Form Desktop, KPI Strip desktop + mobile, Drawer
  Shell, Mobile Task Header Cancel) are now independently confirmed as
  AA-noise, not defects** — inspected every diff image directly: all show
  only text-glyph outline highlighting on matching content, no solid-block
  regions, no structural shift. This was flagged as "not independently
  re-confirmed" in the prior entry; now it is.

  **The 6 root-cause-pending mobile failures are resolved — one by one,
  not assumed to share a single explanation. Two were real component bugs,
  fixed; two were harness bugs, fixed; two are the same accepted
  "composite doesn't own trailing shell content" scope difference as
  Supplier Form Mobile, confirmed independently rather than assumed:**

  1. **Item Catalog Table Mobile (was 8.65%, now 8.32%, AA-noise) — two
     real bugs found and fixed in
     `components/inventory/item-catalog-table.tsx`'s `ItemCatalogList`:**
     - Retired rows were rendering the full `"{type} · {category} ·
       {scope}"` caption like every other row, but Paper's own mobile card
       (`TN1-0`, last/retired item) draws a different, shorter caption for
       retired rows: just the retirement note (`departmentScope` alone,
       e.g. "Retired 04 Aug · history kept"), no type/category prefix.
       Fixed: `row.retired ? row.departmentScope : `${typeLabel}...``.
     - The units column was rendering the full desktop-style string
       (`"bag → kg · ÷25"`, `"kg · no conversion"`) but Paper's mobile card
       draws bare units only (`"bag → kg"`, `"kg"`) — confirmed by reading
       `TN1-0`'s `get_jsx` directly: mobile is a deliberate space-saving
       simplification of desktop's fuller `UNITS` column (`SFT-0`), not a
       shared value. Fixed: mobile now splits on `" · "` and keeps only
       the first segment. Documented inline in the component (see the
       function's own doc comment) so this isn't re-derived per composite.
     - The harness's own demo data was also wrong independent of the
       component: it has 6 rows including "Cooking oil", but Paper's
       `TN1-0` reference only draws 5 (no Cooking oil) — the extra row
       pushed the last real row out of the mobile crop, swapping in a row
       Paper never drew. Fixed in `/dev/wds-diff/page.tsx`: mobile capture
       now filters out the `oil` demo row.
     - Residual 8.32% is pure text-AA noise (verified: every highlighted
       pixel is a glyph outline on now-matching content, no solid blocks) —
       larger than smaller composites' AA-noise because this crop is
       unusually text-dense (5 full rows of name/units/type/category/scope
       in a small viewport). Treated as a pass per the established
       "0% isn't realistic for text" standard, at the higher end of the
       observed range.

  2. **Category Manager Mobile (was 6.54%, now 3.02%, AA-noise) — one
     harness bug, not a component bug: the Paper reference was captured
     from the wrong node.** The prior session's capture used `TX2-0`
     ("Category list" — list rows only), but Paper's real mobile screen
     (`TWZ-0`, the actual artboard content) stacks the "+ Add a category"
     input **above** the list, both inside one `p-4 gap-4` container —
     confirmed via `get_children`/`get_jsx` on `TWZ-0`. The built
     component was already correct (renders both, matching `TWZ-0`); the
     captured Paper reference just omitted the add-input, so everything
     below it compared one row-height off. Re-exported `TWZ-0` via
     `export`, re-flattened, re-diffed: 6.54% → 3.02%, and the diff image
     is now pure text-AA noise across all 6 rows, no structural offset.
     **Desktop's equivalent capture (`SRG-0`) was already the correct full
     screen** (it includes the add-input), which is why desktop passed
     clean at 1.39% last session and only mobile needed re-capturing.

  3. **Mobile Task Header Done (was 5.14%, now 5.38%, AA-noise) — one
     harness bug: demo copy didn't match Paper's exact text.** Paper's
     `TZO-0` subtitle reads "...drives the **store low-stock signal**."; the
     `/dev/wds-diff/page.tsx` demo had "...drives the **stock alerts**." —
     a copy-editing slip, not a component defect (the component renders
     whatever subtitle prop it's given). Fixed the demo string to match
     Paper exactly. Residual 5.38% (barely changed from 5.14%, despite the
     content now matching) is confirmed line-wrap AA noise: the subtitle
     wraps to 2 lines in both, breaking 1 word earlier in Paper's version —
     a sub-pixel width/kerning difference, not a text mismatch. High
     percentage is a function of the crop being tiny (390×112px), not a
     large absolute defect (2349 mismatched px total).

  4. **Item Form Mobile (was 11.22%, now 9.88%) and Supplier Form Mobile
     (was 11.67%, now 9.37%) — three real component bugs found and fixed
     across both, all in the shared `FieldLabel` pattern + a spacing
     token, plus one content-only fix in Item Form:**
     - **Both composites' mobile `FieldLabel` rendered the wrong style
       entirely.** `item-form.tsx` and `supplier-form.tsx` both had a
       `variant`-conditional `FieldLabel`: mono-uppercase on desktop,
       plain sentence-case sans-serif on mobile. Checked against Paper's
       actual mobile nodes (`TV7-0`, `TLW-0`) rather than assumed correct
       from the original build — both draw labels in the **same
       mono-uppercase style as desktop** ("NAME", "TYPE", "SUPPLIER NAME",
       "CONTACT PERSON", etc.), not sentence-case. This is a real,
       previously-undetected defect in both composites' mobile variant —
       it went unnoticed originally because the trailing-button scope gap
       already dominated both diffs, masking a same-magnitude label bug
       underneath. Fixed both `FieldLabel`s to always render mono-uppercase
       regardless of variant (the mobile branch was simply wrong, not a
       legitimate platform difference like the payment-terms-toggle or
       below-restock-level-tone cases found earlier this milestone).
     - **Both composites' mobile root field-group gap was 16px
       (`gap-wds-4`), but Paper's mobile nodes use 18px
       (`gap-4.5`/`wds-4.5`)** — confirmed via each platform's own `get_jsx`
       (`TV7-0`/`TLW-0` mobile `p-4 gap-4.5` vs. `SL2-0`/`SX5-0` desktop
       `py-5 px-6 gap-4`): this is a genuine desktop/mobile spacing
       difference, not a shared value, same pattern as the field control
       heights (44px mobile vs 32px desktop) already documented for Item
       Form. The 2px-per-gap error compounded across 5-6 field groups into
       a visible cumulative vertical drift by the bottom of each form —
       this is what was actually causing much of the "vertical shift"
       visual pattern in both diff images, not (only) the accepted missing
       trailing button. Fixed: mobile now uses `gap-wds-4.5`, desktop keeps
       `gap-wds-4`.
     - **Item Form's mobile Type-toggle "Raw" segment used desktop's fuller
       label.** Both variants hardcoded "Raw ingredient"; Paper's mobile
       node (`TV7-0`) draws the shorter "Raw" for the same segment, desktop
       (`SL2-0`) draws "Raw ingredient" — read independently rather than
       assumed identical, per this milestone's established practice for
       genuine per-platform label differences. Fixed: `{isMobile ? 'Raw' :
       'Raw ingredient'}`.
     - After all three fixes, residual 9.88%/9.37% is the same accepted
       "composite doesn't own trailing shell content" gap already
       documented for Supplier Form Mobile — re-confirmed, not assumed,
       by inspecting the post-fix diff images: content and spacing now
       align cleanly through the entire field list in both, and the only
       remaining highlighted region in each is the trailing button area
       (Item Form: also the "Central Store restock level" field, which
       Paper's mobile mock (`TV7-0`) genuinely never draws at all — see
       below — desktop's `SL2-0` does draw it, so the field is real and
       stays; Supplier Form: just "Save changes"). Neither is a defect to
       fix in these composites; both belong to whichever screen assembles
       them in Step 5.
     - **New, Paper-confirmed scope note for Item Form specifically:**
       `TV7-0` (mobile) has no "Central Store restock level" field at all —
       it jumps from "Where it may exist" straight to "Create item".
       Desktop's `SL2-0` does draw it (last field before Save). The
       component currently renders it on both variants, matching the
       04-components.md composite table's own "Identical field set both
       places" statement and desktop's stated behavior — **not removed**,
       since removing a real, useful field to chase a lower diff % would
       be the wrong call; Paper's mobile mock most likely just abbreviates
       the full field list the way it does for other screens, not a
       deliberate field cut. Flagged here for whoever wires the real
       mobile route in Step 5, in case product intends this field to be
       desktop (Central-Store-drawer) only.

  5. **Restock Level Grid Mobile (was 7.76%, unchanged, no code fix) —
     confirmed as the accepted scope difference, not root-caused
     further.** Paper's full mobile mock (`TLX-0`/`U03-0`) includes a
     leading "Search an item" search box (screen/shell-level, not owned by
     `RestockLevelGrid`) and a trailing "Save restock levels" button
     (same), both outside what this composite ever claimed to render — the
     composite's own grid rows + helper note match Paper pixel-for-pixel
     within the AA-noise band once the leading/trailing regions are
     visually excluded from consideration. No code change; same category
     as Supplier Form Mobile's original finding, now applied here too
     after checking rather than assuming.

  **Net result — final numbers, all re-verified this session (not carried
  forward from memory):**
  | Composite | Prior | Now | Status |
  |---|---|---|---|
  | Mobile Task Header Done | 5.14% (content mismatch) | 5.38% | AA-noise, pass |
  | Category Manager Mobile | 6.54% | 3.02% | AA-noise, pass |
  | Item Catalog Table Mobile | 8.65% | 8.32% | AA-noise, pass |
  | Restock Level Grid Mobile | 7.76% | 7.76% | Accepted scope gap, pass |
  | Supplier Form Mobile | 11.67% | 9.37% | Accepted scope gap, pass |
  | Item Form Mobile | 11.22% | 9.88% | Accepted scope gap, pass |

  None of these hit the literal ≤2% bar, but none are being waved through
  on assumption either — every one was inspected as a diff image, cross-
  checked against the specific Paper node it's supposed to match, and its
  remaining gap traced to a specific, named cause (AA noise on matching
  content, or a documented scope boundary). That is the same judgment-call
  standard already established for Select/Toggle Group/Sidebar/Topbar,
  applied with the same rigor to composites with larger absolute
  percentages, not a relaxed bar for this batch.

  **Decision on `/dev/wds-diff`: left in place, not deleted.** Still
  useful for Step 5 (re-verifying once real screens replace these isolated
  demo renders) and for the two items (2, 3) still open in this
  Verification Pass. Delete once Step 5's real screens make the isolated
  harness redundant, per the prior session's own note.

  Capture artifacts updated in `.scratch/diff/{paper,paper-flat,built}/`
  (gitignored, not committed) — `category-manager-mobile.png` in
  `paper`/`paper-flat` now holds the corrected `TWZ-0` export (previously
  `TX2-0`); all six affected composites' `built/*.png` and `*.diff.png`
  are current as of this session, not the 2026-09-14 ones.
- [x] Pixel-diff passed (≤2%, or confirmed-AA-noise per the documented
      judgment call) at both Paper anchors — for Sidebar Nav / Mobile Icon
      Rail / Topbar. **Every composite after Topbar (Mobile Header/Task
      Header/Status Bar, KPI Strip, Drawer Shell, Item Catalog Table, Item
      Form, Category Manager List, Supplier Form, Restock Level Grid)
      substituted rigorous `get_computed_styles` cross-checks + real-browser
      by-eye screenshot comparison, because the `export` MCP tool's schema
      rejected single-node calls all session** (see each entry's own Status
      note) — not a lowered bar by choice, a tool availability gap. Re-run
      the actual automated diff on all of them once `export` is confirmed
      working again.
- [x] Responsive spot-check passed (~768px, ~1024px) — every composite in
      this milestone was checked at 768px via `getBoundingClientRect`/
      `scrollWidth` for its own overflow contribution (see each entry's own
      Status note for specifics); the page's overall 768px horizontal
      overflow traces to two pre-existing, out-of-scope sources already
      documented at their own entries (the 1440px Sidebar/Topbar sections,
      and the bare-primitive Table demo). ~1024px was not separately
      re-checked per composite after Topbar — every composite here uses
      `max-w-full`/relative sizing rather than fixed viewport-relative
      widths, so 1024px sits between the already-checked 768px and native
      1440px anchor without introducing new behavior, but this is an
      inference, not a re-verified data point — spot-check 1024px directly
      before shipping if that becomes load-bearing.

- **Verification pass (2026-09-15) — item 2, structural/best-practice
  audit.** Same session as item 1's continuation above. Covers sizing
  consistency, keyboard/focus, interactive states, color contrast, and the
  token-regression check across all 7 primitives and 9 composites.

  **Sizing consistency — checked every primitive instance and every
  composite's control heights against its own Paper node, not against each
  other by assumption:**
  - Base primitives (`Input`, `Select`, `Button`) all default to `h-8`
    (32px, desktop) — consistent across every use.
  - Mobile form-field height (44px) is applied consistently everywhere a
    full-width mobile text field appears: Item Form, Supplier Form,
    Category Manager's add-category input.
  - `Table` primitive (30px header / 46px rows) and Restock Level Grid's
    hand-built desktop table (also 30px/46px, confirmed via source read)
    match exactly, even though Restock Level Grid doesn't reuse the
    `Table` component — intentional and correct, not drift.
  - **Two apparent inconsistencies checked against Paper and confirmed as
    real, intentional, Paper-drawn differences — not bugs:**
    - Item Form's mobile Type-toggle segments are `h-10` (40px,
      `TV7-0`); Supplier Form's mobile payment-terms-toggle segments are
      `h-11` (44px, `TLW-0`). Two different Paper nodes, two different
      genuine heights — each matches its own reference exactly.
    - Restock Level Grid's mobile restock-level input is `h-8` (32px),
      not the 44px mobile-field convention used elsewhere — confirmed
      against Paper's own `TLX-0` (`w-14 h-8`): a deliberately smaller
      control for a small numeric stepper inside a compact table row, not
      a full-width form field. Documented here so this isn't "fixed" to
      44px in a future pass without checking first.

  **Keyboard & focus — tested interactively in-browser (Playwright),
  not inferred from markup:**
  - **Select:** click opens the popover; `ArrowDown` moves the
    highlighted option (visible `bg-wds-neutral-100`); `Escape` closes
    without changing the selection and returns focus to the trigger with
    a visible ring. Correct.
  - **Toggle Group:** click-then-`ArrowRight` moves *focus* to the next
    segment without changing the selected value (standard Radix
    roving-tabindex behavor for a single-select toggle group); `Enter`
    then activates the focused segment. Correct, not a bug — activation
    requires an explicit key, matching how the primitive already behaves
    for mouse clicks.
  - **Sheet/Drawer:** opens with scrim + focus moved into the panel;
    `Escape` closes and returns focus to the opening trigger with a
    visible ring. Correct.
  - Radix gives all of the above for free; the check here was whether any
    composite's custom styling suppressed it. It doesn't, anywhere.
  - **`outline-none` audit** (grep across every primitive/composite):
    listbox/menu items (`Select`'s `SelectItem`, `DropdownMenu`'s
    `DropdownMenuItem`/`CheckboxItem`/`RadioItem`) use `outline-none` +
    `focus:bg-wds-neutral-100` — correct, standard pattern for
    arrow-key-navigated listbox items (a background highlight, not an
    outline ring, is the expected treatment). `SearchInput`'s inner
    `<input>` has bare `outline-none` with no per-element replacement,
    but the **wrapper div** carries `focus-within:border-wds-primary
    focus-within:shadow-wds-ring` — correctly gives the visible ring when
    the inner input is focused. No suppressed-focus bugs found in any
    Milestone One primitive or composite.
  - **Out of scope, flagged not fixed:** `ItemCombobox.tsx` and
    `QuantityStepper.tsx` (used by the pre-existing Prep/Purchase-Orders
    pages, not Milestone One) also have bare `outline-none` with no
    visible replacement on their inner inputs — a real gap, but these are
    legacy, not-yet-redone components per `FEATURE_REDO_PLAYBOOK.md`'s
    "migrate as part of the redo, not a separate refactor" rule. Not
    touched here; flag for whichever future redo covers Prep/Purchasing.

  **Interactive states rendering, not just present as classes** — spot-
  checked in the browser per the state-matrix rule, given this build hit
  the "class present but resolves invisible" failure mode twice already
  (sidebar colors, gradient tokens): Select's hover/open state, Toggle
  Group's hover/selected/focus states, and Button's gradient hover all
  render visibly distinct in a real browser, confirmed via the keyboard
  testing above (which exercises focus-visible directly) plus the visual
  verification already logged per-composite above. No further "class
  present, renders invisible" instances found beyond the two already
  fixed earlier this milestone (`wds-sidebar-top/mid/bottom`,
  `wds-gradient-surface-raise`).

  **Color contrast (WCAG AA) — computed against real background hex
  values at each token's actual usage context, not visually guessed.**
  Two real findings, both **token-level, not component-level** — flagging
  for the owner rather than silently repainting a shared neutral scale
  token that has wide blast radius beyond this milestone:

  1. **`--wds-text-faint` (`--wds-neutral-400`, `#A8A39B`) fails WCAG AA
     at every real usage in this milestone.** 2.51:1 on `--wds-surface`
     (`#FFFFFF`), 2.30:1 on `--wds-surface-sunken` (`#F6F5F3`) — both far
     under the 4.5:1 normal-text minimum, and also under the 3:1
     large-text minimum, so there's no font-size that rescues it. It's
     used as real, load-bearing body/helper copy at 11-12px throughout
     this milestone, not decoration: Item Form's and Supplier Form's
     `FieldHelper`/helper-text spans (`wds-helper`, 11px), Restock Level
     Grid's unit captions (`wds-caption`/`wds-field-label`, 11-12px),
     Item Catalog Table's Department Scope column (`wds-caption`, 12px),
     Select's placeholder text, and the Topbar breadcrumb separator.
     Placeholder text and decorative icon fills are legitimately AA-exempt
     (confirmed: `input.tsx`'s `placeholder:text-wds-text-muted` and
     `search-input.tsx`'s search-icon fill are the only genuinely
     decorative uses) — the problem is specifically the non-exempt
     helper/caption-copy uses layered on the same token.
  2. **`--wds-text-muted` (`--wds-neutral-500`, `#847E76`) also fails the
     4.5:1 normal-text minimum** (4.02:1 on white, 3.69:1 on sunken),
     though it clears the 3:1 large-text minimum. It's used at
     `wds-caption` (12px, 14 instances) and `wds-field-label`/`wds-mono-sm`
     (11px, several more) throughout — none of which qualify as
     large text, so this also fails AA in its real usage contexts, just
     by a smaller margin than `wds-text-faint`.
  3. **Sidebar text tokens, checked for contrast against their own dark
     backgrounds, are fine:** `--wds-sidebar-fg-item` (`#B5AEA5`) is
     7.76:1 on `--wds-sidebar-mid` and 9.13:1 on `--wds-sidebar-bottom` —
     comfortably AA. `--wds-sidebar-fg-muted` (`#8A7F76`) is 4.36:1 on
     `--wds-sidebar-mid` (fails 4.5:1 by a hair, but this token is only
     used at `pt-2 pb-1.5`/`pt-4 pb-1.5` **section-label** positions in
     the Sidebar Nav — arguably non-critical wayfinding text, not primary
     content) and 5.14:1 on `--wds-sidebar-bottom` (passes). Flagged for
     completeness, not urgent — smaller gap, and on a less code-central
     token than 1-2 above.

  > **RESOLVED 2026-09-15 — owner chose option (b).** Two new AA-passing
  > copy tokens were added and every non-decorative usage swapped to them:
  > `--wds-text-copy-faint` `#756E66` (5.03:1 on `--wds-surface`, 4.61:1 on
  > `--wds-surface-sunken`) and `--wds-text-copy-muted` `#5E5852` (7.01:1 /
  > 6.44:1). Both OKLCH triplets round-trip to their comment hex exactly.
  > `--wds-text-faint`/`-muted` keep their values and are now documented as
  > **decorative-only** — the 9 remaining uses are input/select placeholders,
  > the search icon, the Select `▾`, the Sheet `×`, the Select scroll arrows,
  > and the topbar `/` separator, all legitimately AA-exempt.
  > Verified in a real browser, not inferred from the CSS: all **129** copy
  > elements across every Milestone One composite measure **4.91–9.06:1**
  > against their actual rendered backgrounds (canvas-resolved sRGB, since
  > `getComputedStyle` returns `oklch()` which a naive rgb parse misreads).
  > 0 failures, 0 console errors. The faint/muted hierarchy Paper draws is
  > preserved — `-copy-faint` stays lighter than `-copy-muted`, same
  > direction as the decorative pair, so the swap never inverted a
  > deliberate visual relationship.
  > **Paper's own tokens still carry the old values** — the design file
  > should be updated to match before the next milestone's design pass, so
  > Paper and code don't drift.

  **Original finding (kept as the record of the decision):**
  **This is a design-token decision, not a code fix applied here:**
  darkening `--wds-neutral-400`/`-500` enough to pass AA (roughly
  `#767676` or darker for `-400`, based on a quick contrast sweep) would
  change the entire neutral scale's decorative/placeholder appearance
  site-wide, which is exactly the kind of change `FEATURE_REDO_PLAYBOOK.md`
  routes through Paper/owner approval (see Phase 0's own token-approval
  precedent), not something to slip in as a drive-by fix during a
  verification pass. Recommendation for the owner: either (a) darken
  `--wds-neutral-400` specifically (it's the one that actually fails
  large-text too, so it's the more urgent of the two), or (b) introduce a
  distinct, AA-compliant token for non-decorative faint/muted *copy* uses
  and reserve the current `--wds-neutral-400`/`-500` values for
  placeholder/decorative uses only, which is what they were probably
  intended for in the first place given how close `-500` already is to
  passing.

  **Regression check — nothing built before the mid-build token fixes
  still relies on the old broken values.** Confirmed by reading source,
  not just running `pnpm build` (a runtime-color regression wouldn't
  produce a compile error): every consumer of `wds-sidebar-top/mid/
  bottom`, `wds-gradient-sidebar`, `wds-gradient-topbar`, and
  `wds-gradient-surface-raise` resolves through the single current token
  definition via a Tailwind utility class (`bg-wds-sidebar-mid`,
  `bg-wds-gradient-topbar`, etc.) — no component hardcodes a duplicated
  color value that could drift independently of the token file. Since
  the fix lives in exactly one place (`tokens.wds.css`) and every
  consumer reads from it, there is no per-component regression surface
  to check beyond confirming the class-based wiring, which is intact
  everywhere it's used (`sidebar-nav.tsx`, `topbar.tsx`,
  `mobile-headers.tsx`, `mobile-status-bar.tsx`, `kpi-strip.tsx`,
  `card.tsx`).

  Item 2 is complete. Item 3 (OKLCH-vs-comment token drift, the dedicated
  sweep) is next.

- **Verification pass (2026-09-15) — item 3, the dedicated OKLCH-vs-comment
  token drift sweep. Every color token in `tokens.wds.css` regenerated
  from its own hex comment and round-trip-verified, not just the ones a
  composite happened to touch.** Same technique already used for
  `wds-surface-raise-end`/`wds-accent-strong`: a canvas `fillStyle` →
  `getImageData` round-trip in a real browser (not a hand calculation),
  run via a temporary `/dev/wds-diff/oklch-check` route (deleted after
  use, per the established pattern for throwaway verification tools —
  distinct from `/dev/wds-diff` itself, which stays).

  **Every one of the 46 color tokens in the file was checked** (all
  neutrals, espresso, caramel, semantic fg/bg/border triplets, sidebar
  text tokens, plus the already-fixed bespoke tokens re-confirmed as
  still correct). **31 tokens had real drift (>2 RGB units in at least
  one channel) between their OKLCH value and their own hex comment** —
  far more than the "some tokens" the Known Issues section flagged;
  effectively every token nobody had individually touched yet. Two
  concrete examples of how large the drift was before this pass:
  `--wds-neutral-800` (`#2E2B27` claimed, actually rendered `#27221F`, off
  by 7/9/8) and `--wds-caramel-700` (`#8C6230` claimed, actually rendered
  `#7E572D`, off by 14/11/3) — both silently wrong for the entire time
  this milestone was built, just never on a token any composite's
  pixel-diff happened to isolate closely enough to catch.

  **Fix method:** for every drifting token, solved for the OKLCH(L C H)
  triplet (3-decimal L/C, integer H, matching the file's own precision
  convention) that actually round-trips to the comment's hex, via a
  local numeric search around the direct sRGB→OKLab→OKLCH conversion
  (not a guess-and-check by hand) — then re-verified every corrected
  value resolves exactly via the same canvas round-trip before writing it
  to the file. **29 of 31 drifting tokens now round-trip to an exact
  match** (0,0,0 delta). The remaining 2 (`--wds-success-fg`,
  `--wds-error-fg`) land 1 RGB unit off in a single channel even after a
  widened search — the same "1-unit rounding, imperceptible" category
  already accepted for `--wds-espresso-700` in the original Toggle Group
  build; documented inline in the token file's comment rather than
  presented as a clean exact match.

  **Corrected tokens (grouped by scale):**
  - Neutrals: `-200` through `-950` (8 tokens; `-0`/`-50`/`-100` were
    already within the ≤2-unit tolerance, left unchanged)
  - Espresso: `-100`, `-200`, `-400`, `-600`, `-900` (5 tokens; `-50`,
    `-700`, `-800` already within tolerance from prior sessions' fixes)
  - Caramel: `-100`, `-300`, `-500`, `-600`, `-700` (all 5 non-DEFAULT
    steps had drift)
  - Semantic: `--wds-success-fg/-bg/-border`, `--wds-warning-fg/-bg`,
    `--wds-error-fg/-bg/-border`, `--wds-info-fg/-bg/-border` (10 of 12
    semantic tokens; `--wds-warning-border` was already within tolerance)
  - Sidebar: `--wds-sidebar-fg`, `--wds-sidebar-fg-muted` (2 tokens;
    `-top/-mid/-bottom/-fg-item/-fg-name/-badge-fg` were already exact
    from the prior session's fix, `-fg-active` within tolerance)
  - **Not touched, confirmed still correct:** `--wds-espresso-50/-700/-800`,
    `--wds-topbar-end`, `--wds-surface-raise-end`, `--wds-accent-strong`,
    `--wds-sidebar-top/-mid/-bottom/-fg-item/-fg-name/-badge-fg`,
    `--wds-warning-border` — all already exact or within the 1-2 unit
    imperceptible-rounding tolerance, left as-is rather than re-touched
    for the sake of it.

  **Verification:** re-ran the same round-trip check against the updated
  file — every previously-drifting token now resolves exactly (or within
  the same 1-unit rounding tolerance already accepted elsewhere), zero
  tokens remain outside that band. `pnpm build` clean afterward. Visually
  re-checked `/dev/wds` (the swatch/primitive demo page) in a real
  browser — the palette still reads as the same coherent warm-coffee
  system, just numerically precise now; no visual regression, since every
  correction moves the *rendered* color to match its own already-approved
  hex, not to a new color.

  This closes out the "dedicated pass" the Known Issues section has
  called for since Phase 0 — the drift was real and systemic (31 of 46
  tokens), not the few isolated cases prior sessions individually caught
  and fixed. Known Issues section below updated to reflect this is done.

- **UI refinement session (2026-09-15) — owner-reported issues, verified
  against Paper before fixing, not assumed.** Owner browsed the Item Catalog
  screen on localhost against Paper's `SFQ-0`/`18O-0` and flagged several
  things that looked wrong. Each was checked against the real Paper nodes
  before touching code — two of the owner's suspicions turned out to be
  already-correct-per-Paper, not bugs (see below).

  1. **Topbar was built against the wrong reference node — real bug, fixed.**
     `components/app/shell/topbar.tsx` used `rounded-wds-md border` (full
     border + radius), sourced from specimen node `1GS-0` on the isolated
     Shells & Primitives page. But no real assembled screen uses that
     treatment — `get_computed_styles` on `SFQ-0`'s topbar and Supplier
     form's `T2E-0` both show **border-bottom only, no radius, full-bleed**
     flush against the sidebar/content. This is exactly why the owner saw it
     as "looks like the KPI strip" — it was floating as a card when it should
     sit flush. Fixed: `border-b border-wds-border`, radius removed.
  2. **Sidebar nav items had zero interactive states — real gap, fixed.**
     `DesktopNavItem`/`SidebarRail` items were bare links with no hover/
     focus-visible/active classes. Per this doc's own "Convention-derived
     states" rule (Paper never draws micro-interactions, so they're derived,
     not skipped), added a shared `navItemInteractiveClass`: hover/
     focus-visible background tint using the existing
     `--wds-sidebar-active-bg` token (already used for the mobile rail's
     active state, so no new token needed), `shadow-wds-ring` on
     focus-visible per the established focus convention.
  3. **Sidebar logo fell back to a flat circle — real wiring gap, fixed.** A
     real asset (`public/images/wendo-logo.jpg`, already used on the login
     page) existed but `logoSrc` was never passed at any call site. Wired
     into `InventoryDesktopShell`/`InventoryMobileRail`/the new mobile nav
     drawer via a shared `WENDO_LOGO_SRC` constant in `inventory-shell.tsx`.
  4. **Mobile hamburger was inert — real bug, fixed.** `MobileHubHeader`
     already supported `onMenuClick`, but `item-catalog-screen.tsx` and
     `suppliers-screen.tsx` never passed a handler, and no mobile drawer nav
     existed to open. Added `InventoryMobileNavDrawer` (new, in
     `inventory-shell.tsx`) — reuses `SidebarNav`'s existing groups/props as
     a full-width slide-in overlay with a scrim (`bg-wds-scrim`, the same
     token the Sheet primitive uses). No Paper node for this exact pattern
     (Paper's mobile artboards only ever draw the persistent icon rail, not
     an overlay drawer) — it's assembled from already-approved pieces, not a
     new visual design. Verified interactively: opens on tap, shows real nav
     + logo + avatar + sign-out, closes on scrim tap or navigation.
  5. **"Restock levels" button in the catalog topbar — checked against
     Paper, not removed.** `SFQ-0`'s real topbar only draws "New item"; the
     built screen also has a secondary "Restock levels" button. Kept as an
     intentional deviation — Restock Levels (Milestone One screen 5) has no
     other nav entry point from the sidebar, so removing it would strand the
     screen. Documenting here per this doc's own discipline rather than
     leaving it silently undiverged from Paper.
  6. **Avatar shape and squared vs. Paper — checked, was already correct;
     then changed anyway per an explicit owner design decision.** Paper's
     own sidebar-footer node (`SP6-0`) is genuinely `border-radius: 2px`
     (squared), confirmed via `get_computed_styles` — the built avatar
     already matched Paper exactly. The owner asked for a circular
     treatment regardless, as a deliberate deviation from the approved
     file (scoped to the sidebar footer avatar, desktop + mobile rail, and
     reserved as the pattern for any future Topbar avatar). Changed
     `components/ui2/avatar.tsx`'s `rounded-wds-sm` → `rounded-full` on both
     `Avatar` and `AvatarFallback`. **Paper's file still shows the squared
     version — flag for the owner to update the design file, or this will
     read as drift on the next Paper-comparison pass.**
  7. **Sign-out control — new UI, Paper never designed one.** Confirmed via
     `get_screenshot` on `18S-0` that Paper's footer specimen has no sign-out
     affordance at all (just name + role). A working logout path already
     existed in code (`lib/logout.ts` → `authStore.logout()` +
     `disconnectSocket()`, backed by a real backend route) but was never
     wired to any control. Per owner's pattern choice, added a small icon
     button (new `SignOutIcon` in `nav-icons.tsx`, lucide `log-out` glyph —
     same "real glyph, no Paper source" deviation category as
     `SearchInput`'s Search icon) to the right of the name/role text in the
     existing 52px footer row (desktop) and below the icon list (mobile
     rail). Verified end-to-end in-browser: click → redirects to
     `/login?next=<original path>` → logging back in returns correctly.

  **Flagged, not changed this session (design questions for owner/Paper,
  not implementation bugs):**
  - **Mobile fake status bar** (9:41 clock + fake signal/wifi/battery,
    `mobile-status-bar.tsx`) — owner correctly noted this duplicates a real
    phone's own OS status bar. This is Paper's own deliberate, documented
    convention (a dedicated `get_guide("mobile-status-bar")` MCP guide
    exists specifically for it), not an implementation slip — left as-is
    pending an owner/Paper decision, not silently removed.
  - **Units column density** (`item-catalog-table.tsx`) — owner found real
    seed data (`ctn (12x2kg) → kg · ÷24`) harder to parse than the shorter
    demo strings used while building. Column widths match Paper's `SFT-0`
    exactly (verified via `get_computed_styles` on `SH9-0`, Name column
    renders 341px built vs. Paper's ~342px) — not a build defect, but a
    content-format/legibility question for a future design pass, since the
    string format itself is backend-shaped, not purely visual.

  All 6 fixes verified: `npx tsc --noEmit` clean, `pnpm build` clean
  (including the project's `check-wds-tokens.ts` guard — no unregistered
  token classes introduced), interactive verification in a real browser at
  both 1440px and 390px (hover state, sign-out round-trip, mobile drawer
  open/close/navigate all exercised, not just visually inspected).

- **Functional bug-fix session (2026-09-15, continuation of the same day's UI
  refinement session) — owner used the app with real seeded data (31+ items,
  2 retired) and found a batch of functional/data-flow bugs a pixel-diff
  pass can't surface. Each verified against actual code/API behavior before
  fixing, not assumed from the symptom alone.**

  1. **Root cause of "Show retired" doing nothing — a real backend bug, not
     frontend.** `inventory-validators.ts`'s `includeRetired: z.coerce.boolean()`
     coerced via JS truthiness: the query string `includeRetired=false` (a
     non-empty string) coerced to `true`. This silently broke every
     "Show retired" toggle — items, categories, **and suppliers** — across
     the whole milestone; retired records were always included regardless
     of the flag. Fixed with a proper string-to-boolean transform
     (`booleanQueryParamSchema`) at all three call sites. Documented inline
     as a bug fix, not a contract-shape change, since `inventory-validators.ts`
     is the frozen contract file — the wire shape and documented behavior
     (API_CONTRACT.md §21) didn't change, only a parsing defect. Verified
     directly against the backend via curl before and after (31 vs 33 items
     for `includeRetired=false`/`true`), plus the existing 28-test inventory
     suite (697 tests project-wide) still green.
  2. **Toolbar disappeared on empty/error results — real bug, fixed.**
     `item-catalog-screen.tsx`'s toolbar (with all filter chips) lived only
     inside the "has rows" branch of the `body` render function, so a
     filter producing zero rows (or a fetch error) replaced the whole
     toolbar along with the table — no way to clear the filter that caused
     it. Restructured: toolbar renders unconditionally, `tableBody` (a new,
     separate computed value) handles loading/error/empty/populated inside
     the same bordered card.
  3. **No pagination — table silently capped at 20 rows.** Backend's
     `/inventory/items` defaults `perPage: 20`; the frontend never passed
     `page`/`perPage` and had no page controls, so 11+ of 31 items were
     simply never fetched — this, not a CSS scroll bug, was the "can't
     scroll past the first page" symptom. Added `page` state to
     `useItemCatalog` (resets to 1 on any other filter change) and a new
     `ItemCatalogPaginationBar` component (Previous/Next + "Page X of Y ·
     N items") — new, not sourced from Paper, since Paper's mock data never
     exceeded one page.
  4. **Toolbar "Items {count}" badge used the wrong count.** Was
     `meta.itemsTracked`, which the backend's `getCatalogMeta` deliberately
     always computes live-only (by design, for the KPI strip) — so the
     toolbar badge never reflected an active filter or the retired toggle.
     Changed to `pagination.total`, which does reflect the current query's
     actual filtered count.
  5. **Topbar/sidebar hairline misaligned — 28px offset, root-caused.**
     `InventoryDesktopShell`'s content column wrapped **both** the Topbar
     and the page content in one `px-8 py-7` div, pushing the Topbar down
     28px instead of sitting flush against the sidebar's own header
     boundary. Paper's real structure (`SYE-0`/`SYF-0`) keeps the Topbar at
     zero padding and applies `28px/32px` padding only to the content area
     below it — restructured to match. (This was actually already fixed as
     part of item 1 in the same day's earlier UI-refinement entry above,
     which corrected the Topbar's own border styling; this entry fixes the
     *parent* padding that was still causing the vertical misalignment.)
  6. **Category added via "Manage categories" never appeared in the Item
     Form until a manual page refresh.** `CategoryManagerDrawer` managed its
     own category state via `useCategoryManager()`, entirely disconnected
     from `ItemCatalogScreen`'s own category list (the one the Item Form's
     dropdown actually reads). Added an optional `onChange` callback to
     `useCategoryManager`, threaded through `CategoryManagerDrawer` as
     `onCategoriesChanged`, wired to the screen's own `reload` at both call
     sites (desktop + mobile).
  7. **Save errors showed only "Validation failed" — the useful part was
     already in the response, just discarded.** The backend's 400 responses
     already carry field-specific messages in `error.details[]` (e.g.
     `"Buy unit is required"`), but every hook's catch block only used
     `err.message` (the generic top-level string). Added
     `formatApiErrorMessage()` to `types/api.ts` — pulls the field messages
     out of `details[]` when present, falls back to `err.message`
     otherwise — and applied it across all 7 inventory hooks (16 call
     sites) that previously used the bare `err instanceof ApiError ?
     err.message : ...` pattern, not just the one the owner hit.
  8. **Restock Levels drawer had no search and was too narrow for real
     data.** Widened from Paper's own confirmed 440px spec to 560px
     (owner-requested, documented as a deliberate deviation — Paper's short
     demo names never exercised this at scale) and added a client-side
     search filter (all restock-eligible rows are already loaded at once,
     no server pagination on this endpoint, so filtering client-side avoids
     a wasted per-keystroke fetch). Search box sits outside the
     loading/error/empty conditional, same "toolbar must survive an empty
     result" fix as item 2.
  9. **"Where it may exist" was mislabeled and was actually free text, not
     a picker.** Renamed to "Department scope." Was a plain `<Input>` bound
     to a display string, regex-parsed back into `DepartmentTag[]` on save
     (`parseDepartmentTags`) — fragile, and let a user type anything.
     Replaced with a real multi-select: toggle-able chips for each
     `DepartmentTag`, built inline in `item-form.tsx` (not the existing
     `ToggleGroup`, which is single-select-only). `ItemFormValues.
     whereItMayExist: string` → `departmentTags: string[]`, propagated
     through `item-form-screen.tsx`'s load/save logic.
  10. **No inline "add category"/"add supplier" from within the Item
      Form — had to fully exit and use "Manage categories" separately.**
      Built a new `Combobox` primitive (`components/ui2/combobox.tsx`) —
      type-to-filter, with a "+ Create '{query}'" row when the typed text
      matches nothing. Not built on Radix Select (its trigger isn't a text
      input, so typing-to-create isn't expressible on top of it) — a plain
      controlled `<input>` + floating listbox instead, matching Select's
      visual language (h-8, radius-sm, border-strong, focus ring) and the
      same `Escape`/arrow-key/`Enter` conventions already established.
      Category field wired to create-on-save (`categoryIsNew` flag →
      `categoryName` on the mutation); Supplier field is picker-only (no
      creation — a supplier needs more required fields than a bare name,
      so its own drawer stays the creation path, per the owner's approved
      pattern).
  11. **No delete/retire UI anywhere — for items, categories, or
      suppliers.** The backend already fully implemented this (soft-delete
      via `retiredAt`, plus the supplier-specific 409-with-blocking-items
      orphan protection already documented in `05-plan.md`), but no screen
      called any of it. Built a new `ConfirmDialog` primitive
      (`components/ui2/confirm-dialog.tsx`, centered modal on
      `@radix-ui/react-dialog`, same primitive Sheet already uses) per the
      owner-approved pattern: a plain confirm for the normal case,
      escalating to a typed-name confirmation only when blocked. Wired
      three places:
      - **Item** (`item-form-screen.tsx`) — "Retire this item" link, plain
        confirm (items are never blocked this milestone — nothing else
        references them by FK).
      - **Category** (`category-manager-list.tsx` + `category-manager-
        screen.tsx`) — new "Retire" action next to Rename (Paper's own row
        only draws Rename/Restore — this is a genuine addition, not a
        restyle). Plain confirm — category retire never blocks per
        `05-plan.md`'s own line ("Items keep the reference; the label just
        stops being offered").
      - **Supplier** (`supplier-form-screen.tsx`) — "Retire this supplier"
        link. New `useRetireSupplier` hook catches the specific 409/
        `CONFLICT` shape and extracts `details.items` (the blocking item
        names the backend already returns). When blocked, the dialog
        **does not offer a way to force it through** — there is no backend
        override for this block, so a "confirm anyway" button would just
        409 again; instead it clearly lists every blocking item by name
        and tells the user to reassign or retire those items first,
        with a non-destructive "Got it" acknowledgment. Verified live
        against real seed data: retiring "Samrat Supermarket Ltd" (17 live
        items still naming it as preferred supplier) surfaced the full,
        correct blocked-dialog copy naming all 17 items by name.
      All three retire actions call the parent screen's existing `reload`
      after a successful retire — verified in-browser that KPI counts
      (Items tracked, Categories, Departments) all live-recompute correctly
      immediately after a retire, no manual refresh needed.

  **Suppliers screen (item 13 in the owner's list) — checked, not a bug.**
  The list already uses `perPage: 100` against only 2 suppliers on file, so
  pagination isn't a real gap at this milestone's actual data volume; the
  mobile hamburger was already wired in the same day's earlier UI-
  refinement entry. Confirmed in scope per `05-plan.md`'s own milestone
  name ("Catalog, Suppliers & Restock Levels").

  **Flagged, not changed — content/design questions, not defects:**
  - **Units column notation** (e.g. `ctn (12x2kg) → kg · ÷24`) — confirmed
    the owner's "hard to parse" read is accurate for real (longer) data,
    but the format itself is backend-shaped (`formatUnits()` composing
    real field values), not a rendering bug — column widths still match
    Paper's `SFT-0` exactly. Left for a future content-design pass.
  - **Department admin** (adding to the fixed Kitchen/Pastry/Barista/
    Service/Housekeeping list) — explicitly out of scope this session per
    owner decision; `DepartmentTag` stays a fixed backend enum. Flagged as
    a future-milestone product question (who can add departments, does it
    need approval) rather than a same-session fix.

  All fixes verified: `npx tsc --noEmit` clean on both `frontend/` and
  `backend/`, `pnpm build` clean on `frontend/` (including
  `check-wds-tokens.ts`), full backend suite green (66 files / 697 tests,
  including the pre-existing 28-test inventory suite), and every fix
  exercised live in a real browser against real seeded data — not just
  visually inspected: pagination Previous/Next, filter-then-clear from an
  empty result, "Show retired" toggling the count correctly, a full
  create-with-new-category-and-multi-department-scope round trip with no
  manual refresh, and all three retire flows (plain, category, and the
  supplier blocked-with-real-blocking-items case) end to end.

- **Archive-terminology sweep + sidebar nav fix (2026-09-15, following the
  handover in `06-sessions/handover-2026-09-15-archive-terminology-and-
  remaining-bugs.md`) — two of the handover's items fully executed, others
  flagged back to the owner per the handover's own instructions.**

  1. **"Retire" → "Archive" / "Unarchive", full sweep — done, decided
     terminology executed exactly as specified.** Owner had already decided
     "Archive"/"Unarchive" over "Retire"/"Restore" (nothing in this feature
     hard-deletes; Archive is the correct verb for a soft-delete users can
     reverse). Swept every user-visible string across the whole feature, not
     just the confirm dialogs built in the prior session: button labels
     ("Archive"/"Unarchive" in `category-manager-list.tsx`, "Archive this
     item"/"Archive this supplier" links), dialog titles/descriptions
     ("Archive this item?", "Archive this category?", "Can't archive this
     supplier yet", all "restore"/"retire" wording in the body copy),
     toolbar toggle ("Show archived" in `item-catalog-table.tsx`), the item
     catalog screen description ("Archiving keeps history…"), the KPI strip
     detail ("N archived"), the retired-row caption ("Archived {date} ·
     history kept"), and every hook's user-facing error toast ("Could not
     archive this item/supplier/that category", "Could not unarchive that
     category"). Left every internal/contract-level name untouched per the
     handover's explicit scope: `deletedAt`, `retiredAt`, `includeRetired`,
     `retireCategory`/`retireItem`/`retireSupplier`,
     `useRetireItem`/`useRetireSupplier`, `RestockLevelsActor`, the
     `/restore` API paths, and internal prop names like `showRetired`/
     `onShowRetiredChange` (kept, per the handover's own suggestion, to
     avoid unnecessary churn — only their rendered label changed). Verified
     clean via `grep -ri "retire" frontend/features/inventory/` with every
     remaining hit being an internal identifier or comment, none
     user-facing. Not yet raised with the owner: whether Paper's own
     artboards (`03-design.md`) should be updated to match, or logged as a
     deliberate code-side deviation like others in this file — flagging
     back per the handover's own instruction rather than deciding
     unilaterally.

  2. **Desktop sidebar navigation — fixed, root cause was exactly as the
     handover described.** `DesktopNavItem`/`SidebarRail` in
     `components/app/shell/sidebar-nav.tsx` always called
     `e.preventDefault()` whenever `onNavigate` was non-null, but
     `InventoryDesktopShell`/`InventoryMobileRail` in
     `features/inventory/components/inventory-shell.tsx` always passed a
     non-null `onNavigate` regardless of whether the consuming screen gave
     them a real one — and neither `item-catalog-screen.tsx` nor
     `suppliers-screen.tsx` ever did. Net effect: every click prevented
     native navigation and then called a no-op. Fixed per the handover's
     preferred option: `SidebarNav`/`SidebarRail` no longer call
     `preventDefault()` themselves (the callback now receives the raw click
     event and decides for itself), and `InventoryDesktopShell`/
     `InventoryMobileRail` only pass a wrapped `onNavigate` down when they
     were actually given one — letting the plain `<a href>` navigate
     natively otherwise, since these are real routes, not client-side-only
     state. `InventoryMobileNavDrawer` was checked too, per the handover's
     instruction to verify the drawer wasn't hit by the same bug — it
     wasn't, because its own `onNavigate` handler never called
     `preventDefault` in the first place (it only needed to close the
     drawer before falling through to native navigation). Verified live in
     a real browser at 1440px: clicked "Suppliers" from the Catalog screen
     and "Catalog" from the Suppliers screen, confirmed the URL actually
     changed and the correct page rendered both directions, not just a
     console log.

  **Verified but not re-fixed — the prior session's fix holds; likely a
  stale-tab report.** Re-tested "Show archived" from a clean page load
  (fresh `next dev` process, not the one still holding the stale chunks
  from an accidental `pnpm build` mid-session — see note below): toggling
  it correctly moved the Items badge 33 → 36 and the pagination footer to
  "Page 1 of 2 · 36 items", matching the real archived-row count in
  Postgres. Did not get the owner's exact repro steps this session, so
  left as unresolved-pending-repro per the handover's own instruction
  rather than closing it outright — but nothing reproduced, consistent
  with the handover's stale-tab theory.

  **Flagged back to the owner, not implemented this session (per the
  handover's explicit "stop and ask" instructions):**
  - **Restock Levels drawer's "+ Add an item" button** — still wired to
    nothing. Per the handover, this needs an owner design decision first
    (remove it vs. repurpose it as a shortcut to "New item"), since every
    non-retired Central Store item is already listed with an editable
    restock level — there's nothing left to "add" in the literal sense.
  - **Restock level blank on item re-open + no Restock Level column in the
    catalog** (handover items 5/6) — confirmed still present (re-opened
    "210 Home Baking Flour 12x2kg" live; its restock-level field, `12 kg`
    in Postgres, showed blank in the form). Both share one root cause — no
    restock-level data on `GET /inventory/items` or `/inventory/items/:id`
    — and one fix, but per `inventory-validators.ts`'s own amendment-process
    header this is a contract-shape change and needs owner sign-off on
    which approach (join into the existing endpoints vs. a second
    client-side request) before touching the schema.
  - **Item Catalog column resize** — real scoped feature work, not a bug;
    needs an owner decision on full resizable columns vs. a narrower
    Units-column legibility fix before starting either.
  - **Conversion field** — no code change; relayed the existing
    buy-unit/usage-unit/conversion-factor explanation back as documentation,
    not a defect.
  - **Delete vs. Archive** — not re-litigated; already decided (no separate
    hard-delete) per the handover.

  **Housekeeping note:** an in-session `pnpm build` briefly clobbered the
  running `next dev` process's `.next` output, reproducing the exact
  stale-chunk 404 symptom the handover warned about (login silently failed
  to progress past the form). Fixed by killing the dev server, `rm -rf
  .next`, and restarting — consistent with the handover's own troubleshooting
  note, now reconfirmed as a real, repeatable failure mode when a build and
  a dev server touch the same `.next` directory concurrently.

  Both fixes verified: `npx tsc --noEmit` clean on `frontend/` and
  `backend/` (no backend code touched this session), `pnpm build` clean on
  `frontend/` (including `check-wds-tokens.ts`), and every fix exercised
  live in a real browser against real seeded data (33 live items, 2
  suppliers, 5 categories) — sidebar navigation both directions, the full
  terminology sweep across item/category/supplier archive dialogs
  (including the supplier blocked-with-18-real-items case), and category
  archive/unarchive round-tripping the KPI count correctly with no manual
  refresh.

- **Owner-approved follow-up (2026-09-15, same day, after owner sign-off on
  the three items flagged above) — contract amendment for restock-level
  read data, catalog column, and "+ Add an item" removed.**

  1. **"+ Add an item" removed — owner chose "remove it entirely."**
     `RestockLevelGrid`'s `onAddItem` prop and its dashed button (never wired
     to anything, per the handover) deleted from
     `restock-level-grid.tsx`. No screen was passing the prop, so this is a
     clean removal with no dangling wiring.

  2. **Contract amendment approved — join Central Store restock level into
     both item read endpoints, owner chose option (1) over the second-request
     alternative.** `InventoryItemSchema` gained
     `centralStoreRestockLevel: nonNegativeDecimalSchema.nullable()`
     (`inventory-validators.ts`, documented inline as a post-freeze
     amendment per `API_CONTRACT.md` §21's process). Backend:
     `restockLevelRepository.findByItemIdsForLocation` (new) batches a
     lookup by item id for one location; `inventory-service.ts`'s
     `serializeItem` takes an optional `Prisma.Decimal | null` and a new
     `getCentralStoreRestockLevelsByItemId` helper resolves the Central
     Store once and joins its levels into `listItems`, `getItemById`,
     `createItem`, and `updateItem`'s responses (the last two so a save's
     own response reflects the just-written level, not a stale value).
     `retireItem`/`restoreItem` were deliberately left defaulting to `null`
     — their responses aren't used to display restock data anywhere, so the
     extra query isn't worth it. Frontend mirror updated
     (`features/inventory/types/index.ts`), plus the item-form-screen.tsx
     `useEffect` fixed to read `item.centralStoreRestockLevel ?? ''` instead
     of hardcoding `''` (this was the actual root cause from item 5 of the
     handover — the data literally didn't exist on the wire before this).
     Test mocks (`inventory-service.test.ts`, `inventory-contract.test.ts`)
     updated with the new repository method and a default empty-map
     resolution; full 697-test suite green afterward.
  3. **Restock Level column added to the Item Catalog table — owner chose
     "yes, add it now" over deferring it.** New `restockLevel` field on
     `ItemCatalogRow` and a `formatRestockLevel()` helper in
     `item-catalog-screen.tsx` (`"{level} {usageUnit}"` or `"—"` when unset,
     matching the Pack/Units column conventions already in the table).
     Column placed after Pack, before Department scope (both are per-item
     quantity facts) — a genuine addition, not sourced from Paper, since
     Paper's file predates this data existing at all; documented inline in
     `item-catalog-table.tsx`'s own composite comment rather than silently
     added.

  **Caught and fixed during verification: the classic stale-`tsx watch`
  trap, reproduced a second time.** After the schema/repository/service
  changes, a live test (set a restock level via Edit item → Save → re-open)
  round-tripped correctly at the database layer (confirmed directly via
  Postgres: `level: "40.0000"`, `updated_at` fresh) but the UI kept showing
  the field blank and the column showing "—" for that item specifically.
  Root-caused to the same failure mode the handover flagged for the
  frontend dev server, this time on the backend: `tsx watch`'s
  already-running process (started before this session, well before the
  schema/service edits) never picked up the new code — killing and
  restarting `tsx watch src/server.ts` fixed it immediately, confirmed
  against the same item live (field now shows "40", column now shows
  "40 kg", and every other item with a pre-existing seeded restock level
  now correctly shows its real value instead of "—"). Worth calling out
  explicitly: this is not the frontend `.next` staleness the handover
  already documented — it is the equivalent failure on the backend process,
  and evidently just as easy to be fooled by (the API was still answering
  health checks the whole time; only the inventory route's new code was
  stale).

  All three items verified: `npx tsc --noEmit` clean on both `frontend/`
  and `backend/`, `backend/`'s `pnpm build` clean, `frontend/`'s `pnpm
  build` clean (including `check-wds-tokens.ts`), full backend suite green
  (66 files / 697 tests) after updating the two inventory test files' repo
  mocks, and the full round trip exercised live end-to-end against real
  seeded data post-restart: setting "210 Home Baking Flour 12x2kg"'s
  restock level to 40 kg, confirming it in Postgres, re-opening the item to
  see "40" pre-filled (not blank), seeing "40 kg" in the new catalog
  column, and every other seeded item's pre-existing restock level (set in
  earlier sessions/QA) now correctly appearing in that same column instead
  of a universal "—". Also reconfirmed the Restock Levels drawer still
  renders correctly with the "+ Add an item" button gone.

- **Persistent Inventory shell + loading polish (2026-09-15, closing item for
  Milestone One)** — fixed the remount-on-navigate bug: every Inventory
  screen previously mounted its own copy of the sidebar (desktop) and nav
  drawer (mobile), so clicking a sidebar link unmounted/remounted the whole
  shell along with the content, producing a blank-page-then-spinner flash.

  Catalog and Suppliers (the two screens sharing one sidebar-driven nav) now
  live under a route group, `app/app/inventory/(shell)/`, with a persistent
  `layout.tsx` that mounts `InventorySidebar` / `InventoryMobileNavDrawer`
  once — only `children` swaps across navigation within the group. Restock
  Levels stays outside the group by design (a separate, mobile-only
  full-screen task route reached directly, not via sidebar nav).
  `use-mobile-nav-drawer.tsx` adds a small context (`MobileNavDrawerProvider`
  / `useMobileNavDrawer`) so screens can open the drawer via their
  `MobileHubHeader`'s `onMenuClick` while the layout owns the drawer's
  render/close.

  `(shell)/loading.tsx` replaces Next's default bare spinner with the
  existing shared `LoadingState` for the content region only — the sidebar
  in the layout is a separate layout boundary and stays mounted, unaffected
  by this Suspense fallback. New screen-mirroring skeletons
  (`features/inventory/components/skeletons.tsx`) — Suppliers list/detail
  (desktop sourced from Paper `5R3-0`/`71E-0`; mobile has no Paper node,
  follows the same "real header/toolbar stays, data region becomes
  skeleton" convention) and an Item Catalog skeleton (no Paper node either,
  same convention, column widths matched to `item-catalog-table.tsx`).

  Also replaced the app-wide auth/session-hydration spinner (`app/app/
  layout.tsx`, shown during the ~200ms–1s refresh-token round trip in
  `authStore`'s `hydrateSession`) with `PourReveal`
  (`components/app/shell/pour-reveal.tsx`), a Paper-approved ("Loading mark
  explorations, 1 · Pour reveal") wordmark loading mark. Added a narrowly-
  scoped `Playfair_Display` italic font load (`app/layout.tsx`,
  `--font-wordmark`) for this component's one consumer — not part of the WDS
  token system, since it has exactly one use site.

  Verified: `npx tsc --noEmit` clean, `pnpm build` clean (including
  `check-wds-tokens.ts`), confirmed live in a real browser — sidebar/drawer
  persist across Catalog↔Suppliers navigation with no remount flash, loading
  skeletons render correctly, `PourReveal` shows during session hydration.

  **This closes out Milestone One (Catalog, Suppliers & Restock Levels).**
  Everything in this doc's Milestone One scope is built, verified, and
  committed. Remaining open items are owner-facing decisions already flagged
  above (full resizable catalog columns vs. a narrower Units-column fix) —
  not blockers, and not part of this milestone's must-ship scope.

Update the checkboxes as Step 4 build work completes each item — this is a live
build log now, not just a plan.
