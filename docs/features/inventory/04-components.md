# Inventory & Procurement — Component Inventory (Step 4)

**Feature:** Inventory & Procurement (Feature 1 of the redo)
**Step:** 4 of the per-feature pipeline — extract components into the codebase
**Status:** Milestone One complete, Milestone Two complete. Milestone Three
(Prep) reuse audit done (2026-09-19) — see its section below; net-new build
is small, most of the screen is existing composites.
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

### Table and list-screen quality bar — non-negotiable, checked before "done"

**Established 2026-09-16, after a Milestone One review found tables that
rendered correctly against Paper's mock data but broke under real
conditions** — no pagination (an unbounded render past Paper's ~5-row mock),
columns that didn't hold their width, and no horizontal handling on narrow
viewports. The root cause: a screen was marked done once it visually matched
Paper, and visual match was silently treated as the whole definition of
done. It isn't. **Every data table or list screen in this feature — whether
or not Paper's artboard shows it at scale — must handle:**

1. **Pagination or cursor-based load-more past ~20–30 rows.** Every list
   endpoint in this feature's contract already returns `limit`/`cursor` —
   using them is not optional polish, it's consuming a parameter the backend
   already sends. Never an unbounded render, regardless of how few rows
   Paper's mock data happened to show.
2. **Deliberate column widths.** Numeric and money columns are right-aligned
   and fixed-width. Text columns truncate with the full value available on
   hover/title, not a layout that reflows unpredictably as content length
   varies row to row.
3. **Horizontal scroll on narrow viewports, never silent column-squashing.**
   A table that becomes unreadable rather than scrollable on a narrow screen
   is not built to this project's standard, mobile-card-per-row layouts
   (already this project's established pattern in places) are the preferred
   alternative where one exists.
4. **Sort where the data model supports it cheaply and the screen's own
   design implies ordering matters** (a flow doc or artboard using language
   like "oldest-first").

**Loading, empty, and error states are part of this same bar, not a separate
concern:** every list/table screen has all three, using the shared
`shell-states.tsx` primitives unless it mirrors a bespoke Paper artboard (see
"Placement rules" above) — and the loading state is the real screen-mirroring
skeleton, not a generic spinner, for any screen with a defined layout.

**Verification is two separate checks, not one.** A pixel-diff against Paper
(`get_screenshot` vs. the running screen) confirms *layout fidelity* —
spacing, color, type match the design. It does **not** confirm *functional
completeness* — that pagination actually works, that all three states
render, that the table holds up under more rows than the mock (and, per the
two subsections below, that interactive states are wired and that failed
actions give feedback). Both checks are required before a screen is marked
done in any session's stop condition; passing the visual diff alone is not
sufficient and should never be reported as "done" on its own.

### Interactive states — every interactive element, not just the default

**Added 2026-09-16, same root cause as the table bar above.** Paper draws one
static state per artboard — usually the resting/default state. Nothing about
matching that one drawing pixel-for-pixel implies the other states exist;
they only exist if someone deliberately wires them. **Every interactive
element — button, link, input, table row with a click/hover action, toggle,
tab — must have, at minimum:**

- **Hover** — a visible change for pointer users (this project's design
  tokens already define hover treatments for the seeded `ui2/` primitives;
  use them, don't invent new ones per screen).
- **Focus-visible** — a visible focus ring or equivalent for keyboard
  navigation, not just mouse hover. This is not the same state as hover and
  both must exist independently; an element that only responds to mouse
  hover is not focus-accessible.
- **Active/pressed** — visible feedback for the moment of the click/tap
  itself, distinct from hover.
- **Disabled** — where an element can legitimately be disabled (a submit
  button mid-request, an action blocked by role/permission), it must look
  and behave disabled, not just silently do nothing on click.

If a shared `ui2/` primitive already implements a state correctly, reuse it —
this rule is about not skipping states when assembling a screen or composite
from primitives, not about redesigning states that already exist.

### Feedback on failed actions — no silent failures

**Added 2026-09-16.** An action that calls an endpoint and gets a 400/403/409
back must surface that to the user — a toast, an inline error, a field-level
message from the response — not fail with nothing visible beyond a browser
console error. This is the same class of gap as a filter that doesn't filter
(Milestone One, 2026-09-16 review): the control *looks* wired because it's
present and clickable, but a user watching the screen has no way to tell the
action failed. Every write action (`POST`/`PATCH`/`DELETE`) built in this
feature must have a real, verified failure path — test it by triggering an
actual error response, not just the happy path.

### Worth checking, lower priority than the above — use judgment

Not held to the same "non-negotiable, checked before done" bar as the
sections above, but worth a look on any screen with meaningful write actions
or complex navigation:

- **Keyboard operability** — can every action on the screen be reached and
  triggered without a mouse (sane tab order; custom interactive elements
  respond to Enter/Space, not just click)? Matters more on desktop screens
  used at a shared terminal than on mobile-only ones.
- **Optimistic vs. pessimistic UI consistency** — does the screen wait for a
  write's server response before updating, or assume success and roll back
  on failure? Either is acceptable; an unstated mix of both across screens in
  the same feature reads as unpolished. Pick one approach per feature and
  note the choice if it isn't obvious from the surrounding code.

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

**Not yet built — designed but no code, not scoped to any one milestone:**

| Composite | Screens | Paper reference | Notes |
|---|---|---|---|
| Mobile Universal States (empty / loading / error / permission-denied) | every mobile screen (cross-feature) | `X7O-0` (page `3-0`, added 2026-09-15) | The mobile counterpart to `15W-0`'s desktop universal-states shell — didn't exist until the Milestone Two design-completion session found the gap. Same category as Mobile Hub Header / Mobile Task Header above (cross-feature shell, not Inventory-specific), so it belongs in `frontend/components/app/shell/` (e.g. `mobile-states.tsx`) alongside `mobile-headers.tsx` / `mobile-status-bar.tsx`, not under `components/inventory/`. **Deliberately not built this session** — no live mobile screen exists yet to verify it against with a real pixel-diff (Milestone One's mobile screens don't consume it; Milestone Two's do, but Milestone Two hasn't reached Step 7). Build it as part of whichever Step 7 session first ships a mobile screen that needs a real empty/loading/error state — verify it the same way every other composite in this doc was (pixel-diff + structural + accessibility, logged in Status below) rather than building it in isolation now and trusting the Paper screenshot alone. |

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

### Verification standard: by-eye + computed-styles (mandatory; automated pixel-diff is banned)

**Owner decision, 2026-09-16 (during the Milestone Two S0 session): the
automated `pnpm visual-diff` / `pixelmatch` pixel-diff approach is banned
project-wide, permanently, not just for this session.** Do not resurrect
it, propose it, or fall back to it even as an optional extra check. Reason:
it requires the Paper export and the built-component screenshot to be
*exactly* the same pixel dimensions before it will even run, and most real
composites render variable-length production content (names, reference
numbers, dynamic helper text) — a placeholder string in a demo that wraps
to a different number of lines than Paper's specific reference copy is
enough to make the tool refuse to run, or return a large "mismatch" that
is actually just differently-positioned text glyphs, not a real layout,
spacing, or color defect. Chasing exact-dimension matches by rewriting
demo copy over and over wasted significant time for no accuracy gain over
the alternative below, which sources the same values from Paper directly.
`scripts/visual-diff.ts` may stay in the repo as dead code, or be deleted
in a later cleanup pass — either way, do not run it.

**The mandatory standard for every primitive and composite, no exceptions:**

1. **Source every value from Paper directly** — `get_jsx`, `get_computed_styles`,
   `get_node_info` on the real node. Never a bare magic number when a
   design token already covers the value; never a value read off a
   screenshot.
2. **Map every value to a design token** where one exists; add a new token
   (following this doc's existing conventions) when Paper draws a
   genuinely new value, rather than force-fitting a nearby token.
3. **Build the component**, then take **one real-browser screenshot**
   (Playwright or chrome-devtools MCP) and compare it **by eye** against a
   `get_screenshot` capture of the Paper reference node — structure,
   spacing, colors, type, borders, and any conditional/populated states
   Paper actually draws.
4. **Cross-check the specific values that matter** with
   `get_computed_styles` / `getComputedStyle()` in the browser rather than
   trusting the screenshot alone for anything precise (exact px values,
   exact colors) — this is what makes the check more than "looks about
   right."
5. Check the browser console for errors as part of the same pass — zero
   console errors is part of "done," not a separate step.
6. Log the verification in this doc's Status section: what was checked,
   against which Paper node, and any real defect found and fixed. A
   by-eye check is still a real check and gets logged with the same rigor
   an automated diff result would have — cite the specific nodes and
   values compared, not just "looks right."

This replaces the old two-tier standard (relaxed check for primitives,
automated diff for composites) with one standard for everything. It is not
a lowering of rigor — sourcing values from Paper and cross-checking with
`get_computed_styles` catches the same class of defect (wrong spacing,
wrong color, wrong token) the automated diff caught; it just doesn't get
tripped up by content-length differences that were never real defects.

### Responsiveness — the part Paper can't verify for us

Paper only designed **two fixed points**: 1440px desktop and 390px mobile. Nothing
in between, nothing beyond. The by-eye check above only confirms those two exact
widths are correct — it says nothing about whether the component holds up at every
width a real user's window/device actually is. Per `FEATURE_REDO_PLAYBOOK.md` §5 Step 3:
"Paper artboards are fixed-width; anything not drawn is left to the frontend agent's
responsive judgement" — that judgement has to be exercised deliberately, not skipped.

For every composite:
1. Build with Tailwind's responsive utilities and the spacing/type tokens (not fixed
   pixel widths) so it flexes rather than breaks between the two anchors.
2. Verify the two exact Paper anchors by eye + computed-styles (above).
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

- **Mobile Universal States composite designed, not yet built.** See the
  "Not yet built" row in the Composites table above (`X7O-0`) — a cross-
  feature shell, deliberately deferred to the first Step 7 session that ships
  a mobile screen needing a real empty/loading/error state, so it gets
  verified against something live rather than built in isolation.
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
      orphan protection already documented in `milestone-1-plan.md`), but no screen
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
        `milestone-1-plan.md`'s own line ("Items keep the reference; the label just
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
  refinement entry. Confirmed in scope per `milestone-1-plan.md`'s own milestone
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

- **Owner follow-up (2026-09-15, during Milestone Two screen review) — one
  more Item Catalog Table gap found, not yet built.** Reviewing Milestone
  Two's New Purchase drawer (which shows a per-line "last price" reference
  next to the estimate) surfaced that the Item Catalog Table has no
  equivalent — there is currently no way to see an item's latest buying price
  from the catalog itself. **Add a "Last price" column to
  `item-catalog-table.tsx`** (desktop + mobile), sourced the same way the
  Item Form's existing "last: KES …" reference already is. Bundle this with
  the already-flagged Units-column fix (resizable columns vs. a narrower
  Units-only legibility fix, still awaiting the owner's choice) since both
  touch the same table in the same pass. Neither blocks Milestone Two.

## Milestone Two — Receiving & Supplier AP (S0 component inventory)

Paper reference: page `Milestone Two · Receiving & Supplier AP` (`C-0`), file
`01M1ZZJ6S3FZGF5C7PPBGTKY89`. Full audit and screen-by-screen breakdown:
`docs/features/inventory/milestone-2-plan.md` §6. This is the S0 session
(`06-sessions/milestone-2-s0-component-inventory-prompt.md`) — component
extraction only, no schema/endpoint/screen-assembly work.

**Reused as-is from Milestone One (plan §6.1), confirmed still fitting —
zero new build, zero re-diff:** KPI Strip, Drawer Shell, Inventory Shell,
Skeletons (as a primitive to compose from), Supplier Form, Table primitive,
Status Dot, Toggle Group, Search Input/Combobox/Select, Mobile Hub
Header/Task Header/Status Bar.

**Adapted from an existing pattern, not reused as-is (plan §6.2):**
`restock-level-grid.tsx` is the row-layout pattern reference for the new
Receipt Line Grid (item 3 below), not extended directly. `shell-states.tsx`'s
desktop Empty/Loading/Error/PermissionDenied cards are reused verbatim for
desktop; the mobile counterpart is item 9 below.

**Genuinely new this milestone (plan §6.3) — status:**

| # | Composite | File | Status |
|---|---|---|---|
| 1 | Signature font token | `frontend/app/layout.tsx`, `tailwind.wds.preset.ts` | Built |
| 2 | Sign sheet (PIN entry + signed state) | `frontend/features/inventory/components/sign-sheet.tsx` | Built |
| 3 | Receipt Line Grid | `frontend/features/inventory/components/receipt-line-grid.tsx` | Built |
| 4 | Bundling checkbox list | `frontend/features/inventory/components/bundle-checkbox-list.tsx` | Built |
| 5 | Mismatch/dispute callout | `frontend/features/inventory/components/dispute-callout.tsx` | Built |
| 6 | "How overdue" bucket table | `frontend/features/inventory/components/aging-bucket-table.tsx` | Built |
| 7 | "What we owe" bucket panel | `frontend/features/inventory/components/aging-bucket-panel.tsx` | Built |
| 8 | Mixed-type Inbound/History row | `frontend/features/inventory/components/purchasing-history-row.tsx` | Built |
| 9 | Mobile universal states | `frontend/components/app/shell/mobile-states.tsx` | Built |

- [x] **Signature font token built** — `frontend/app/layout.tsx` adds
      `alexBrush` (`next/font/google`'s `Alex_Brush`, weight 400, scoped
      narrowly like the existing `playfairDisplay` wordmark font — not part
      of the general wds-sans/wds-mono system), registering the
      `--font-signature` CSS var on `<html>`/`<body>`.
      `tailwind.wds.preset.ts`'s `fontFamily` gains
      `wds-signature: ['var(--font-signature)', 'Alex Brush', 'cursive']`,
      matching Paper's own token (`--font-signature: 'Alex Brush', cursive`,
      confirmed via `get_tokens`) and the existing `wds-sans`/`wds-mono`
      convention of pointing at the CSS var next/font registers, not a
      hardcoded family name. Consumed as `font-wds-signature`.

      **Verified in a real browser, not just that it compiles:** added a demo
      swatch to `/dev/wds` (`Section "Signature font token"`), started the
      dev server, and read `getComputedStyle(...).fontFamily` on the
      rendered node via Playwright — resolved to
      `__Alex_Brush_e47be3, __Alex_Brush_Fallback_e47be3, "Alex Brush", cursive`
      (next/font's actual loaded font, not the fallback), zero console
      errors. Screenshot confirms a genuine cursive script render, not a
      silent fallback to the browser's generic `cursive` font (which would
      look structurally different — this was the actual failure mode this
      token exists to prevent, per the plan's own warning that a missed
      token silently falls back with no build error).

- **Process note (owner-approved 2026-09-16): the automated `pnpm
  visual-diff` pixel-diff is dropped for the remainder of this session's
  composites, falling back to the standard `04-components.md` already
  established for primitives when the automated path wasn't practical**
  (`get_computed_styles`/`get_jsx` sourcing + a real-browser by-eye
  screenshot check, no `pixelmatch` run). Reason: composites in this
  milestone render variable-length production content (receipt numbers,
  supplier names, dynamic helper text), so the automated diff's
  exact-dimension requirement forces a root-cause-and-recapture loop for
  every text-wrap difference between the Paper reference's specific copy and
  a demo's placeholder copy — as happened on the Sign Sheet below, where a
  12% mismatch traced entirely to different helper-text copy lengths
  changing line-wrap, not a real layout/color/spacing defect (confirmed via
  `get_computed_styles` cross-check once identified). This is the same
  category of gap the Milestone One Status log already documents repeatedly
  for the `export`-tool schema blocker; this session hits it for a different
  reason (dynamic content, not tooling) and applies the same documented
  fallback rather than inventing a new one.

- [x] **Sign sheet built** —
      `frontend/features/inventory/components/sign-sheet.tsx`
      (`SignSheetDialog` — PIN re-entry modal; `SignedBySignature` — the
      read-only rendered-signature block). Reference: page `4-0` (Store
      Manager), `D61-0` ("C2 · Fulfil & dispatch · desktop · mid-signature")
      for the PIN dialog — Paper's own layer is literally named "Sign
      sheet" (node `DBX-0`), confirming this is the right cross-flow
      reference — and `GEO-0` ("C2 · Fulfil & dispatch · desktop ·
      dispatched (signed)") for the rendered-signature block. Not cloned
      onto Milestone Two's own page (`C-0`); the New Goods Receipt (sign &
      save) and signed Goods Receipt detail screens (S6) reuse this exact
      pattern per the S0 brief.

      **New primitive: `components/ui2/input-otp.tsx`** — added via
      `npx shadcn@latest add input-otp`, then restyled: shadcn's default
      joins slots into one first/last-rounded group, but Paper draws 4
      independently-bordered 40×44px boxes with an 8px gap between them
      (confirmed via `get_jsx`/`get_computed_styles` on `D61-0`'s 4
      `Rectangle` children, each exactly 48px apart = 40px box + 8px gap) —
      restructured `InputOTPSlot` to render each slot as its own bordered
      box rather than using the group's shared-border convention. Filled
      state is `border-wds-neutral-950 bg-wds-neutral-950` with no visible
      character (Paper's filled boxes render solid, no dot/digit glyph at
      all — confirmed by reading the JSX, not assumed); empty state is
      `border-wds-border-strong bg-wds-surface`. Active slot gets
      `shadow-wds-ring`, the same focus treatment every other primitive
      uses.

      **Bug found by `pnpm build`'s own `check-wds-tokens.ts`, not by
      review — a leftover `bg-wds-ink` on the caret-blink indicator**
      (shadcn's default fake-caret element, restyled but not fully swept):
      `wds-ink` was never a registered color utility (`ink` lives under the
      `wds-text` color group as `text-wds-text-ink`, not as a flat
      `wds-ink` — the same distinction already documented for the Sign
      Sheet composite above). This one specifically survived the earlier
      per-primitive fix because it's on an internal, rarely-rendered
      sub-element (`hasFakeCaret`) that the by-eye screenshot check never
      triggered. Fixed to `bg-wds-neutral-950`, matching the filled-slot
      color already used elsewhere in the same file. **Confirms the value
      of running the project's own `pnpm build` (which runs
      `check-wds-tokens.ts`) at the end of a build session, not just
      `tsc --noEmit`** — this class of bug (a token name that looks
      plausible but was never registered) is exactly what that script
      exists to catch, and it caught one here that manual review missed.

      **Two new tokens added, both confirmed against Paper values before
      being added (not force-fit onto an existing step):** `wds-section`
      fontSize (15px/20px/600 — Paper's own `--text-section`/
      `--leading-section` pair, a real distinct type-scale step below `h3`
      that nothing existing covered, used for the dialog's title) and
      `wds-1.25` spacing (5px — the gap in `SignedBySignature`'s label
      stack). `wds-section` registered in `lib/cn.ts`'s `customTextScale`
      allowlist in the same edit, per the documented `tailwind-merge`
      gotcha (a token missing from that list silently loses to a
      `text-wds-*-ink` color class on the same element with no build
      error).

      **Verification — by-eye + computed-styles (see process note above),
      not the automated pixel-diff:** `get_computed_styles` on every Paper
      node in the Sign sheet subtree (`DBY-0`/`DC1-0`/`DC9-0` section
      padding/gap; `DC2-0`/`DC8-0` label/helper text size+weight+color;
      `DC4-0` PIN box dims; `DCA-0`/`DCC-0` footer button height/gradient)
      cross-checked exactly against the built component's Tailwind classes
      — all matched on first pass except one real 1px gap found and fixed:
      the helper text is `11px/15px` in Paper (`DC8-0`), one px looser than
      the existing `wds-field-label`/`wds-helper` tokens (both `11px/14px`)
      — not worth a new token for a single 1px variant, so kept as an
      inline arbitrary Tailwind value (`text-[11px] leading-[15px]`) with an
      inline comment explaining why. A real-browser screenshot (Playwright,
      `/dev/wds` demo, both the empty and mid-entry PIN states, plus the
      signed block) confirmed the fix and that structure/spacing/colors
      match Paper's `D61-0`/`GEO-0` exactly — box borders, radius, gradient
      direction on the primary button, and signature rendering in
      `font-wds-signature` all correct. Zero console errors.

      Also attempted the automated `pnpm visual-diff` before the process
      change above was approved: `export`'d Paper's `DBX-0` ("Sign sheet")
      node directly to disk (the `export` tool works cleanly this session,
      no schema issue), captured the built dialog at matching dimensions
      via a Playwright `clip`, and got a 12.06% mismatch — inspected the
      diff image and confirmed it was entirely overlapping text-glyph
      outlines from different copy (Paper's reference reads "Confirm & sign
      dispatch — Kitchen" / "Sign & dispatch", a different domain's actual
      button/title text since this is a cross-flow reused pattern; the
      Goods Receipt demo naturally uses different, real words), not a
      structural defect — this is what prompted dropping the automated
      diff for the rest of the session rather than continuing to chase
      demo-copy-length matches.

      **Bug found and fixed after the fact, while building item 3 (same
      class as the `wds-3.5`/`wds-4.5` spacing gap and the sidebar
      `top`/`mid`/`bottom` color gap already documented in Milestone One's
      Known issues — a bare (non-`wds-`-prefixed) Tailwind numeric utility
      that isn't on Tailwind's default scale silently generates no rule):**
      `w-55` (used for the signature divider's 220px width) isn't a real
      Tailwind width step (the default scale jumps 44→48→52→56, no 55) —
      confirmed by grepping `tailwindcss/defaultTheme`'s spacing keys, not
      assumed. It compiled without error and rendered a zero-width divider
      with no visible defect at the placeholder-text lengths tested, which
      is exactly why this class of bug is dangerous: no build error, no
      obviously-broken screenshot. Fixed to the arbitrary value
      `w-[220px]`. Re-verified visually — the divider now renders at the
      correct width.

- [x] **Receipt Line Grid built** —
      `frontend/features/inventory/components/receipt-line-grid.tsx`
      (`ReceiptLineGrid`, desktop-only — Paper draws no mobile counterpart
      for this screen this milestone). Reference: `UQE-0` ("4 · New Goods
      Receipt · desktop"), grid node `UQV-0`. Built fresh per plan §6.2,
      using `restock-level-grid.tsx` as the row-layout/tone-convention
      pattern reference only (a materially different row shape: qty input
      with a trailing buy-unit chip, a unit-price input that gets a warning
      border when a price alert fires, a computed subtotal, and an inline
      price-alert badge next to the item name — none of which
      `restock-level-grid.tsx`'s single-editable-number-per-row shape has).

      **Price-alert state is Paper-verified, not invented:** row 2
      (`Dormans Syrup Hazelnut 750ml`) shows a `warning-fg` dot + "38% above
      last" label inline next to the item name, and its unit-price input
      gets a `border-warning-fg` outline instead of the ordinary
      `border-border-strong` — confirmed via `get_jsx` on `UQV-0`, modeled
      as a single optional `priceAlertLabel` prop that drives both the
      badge and the input border together (never settable independently —
      Paper draws them as one state, not two).

      **Real bug found and fixed before this was verified correct — a bare
      numeric Tailwind utility not on Tailwind's default scale (`w-27.5`,
      `w-30`, `h-11.5`, `h-7.5`, `size-1.25`), same failure class as the
      `w-55` bug above and the `wds-3.5`/`wds-4.5` spacing gap already
      documented in Milestone One's Known issues: these compiled with zero
      build error but generated no actual width/height/size rule, so the
      column header labels ("QTY", "UNIT PRICE", "SUBTOTAL") rendered with
      no box constraint at all and ran together as `QtyUnit
      priceSubtotal`.** Caught in the first real-browser screenshot (not
      assumed fine from the code), confirmed via
      `getComputedStyle(...).width` returning `1036px` instead of the
      intended `110px` for one label. Fixed by converting every bare
      fractional/uncommon-value utility to an explicit arbitrary value
      (`w-[110px]`, `w-[120px]`, `h-[46px]`, `h-[30px]`, `size-[5px]`) —
      matching the precedent already set in `restock-level-grid.tsx`'s own
      `w-[100px]`/`w-[72px]` usage for the same reason. **This bug class
      (a bare Tailwind numeric step that looks plausible but isn't on the
      default scale) is now confirmed to have hit three separate composites
      this session (Sign sheet's `w-55`, this grid's five instances) — flag
      it as a recurring gotcha worth checking explicitly on every future
      composite that copies a Paper pixel value into a bare `w-`/`h-`/`size-`
      class, not just the `wds-`-prefixed custom scale.**

      **Verification — by-eye + computed-styles (per the process note
      above):** `get_jsx`/`get_computed_styles` on `UQV-0` and its row/cell
      children confirmed header height (30px), row height (46px), column
      widths (110/120/110px for Qty/Unit price/Subtotal, matching Paper's
      `w-27.5`/`w-30`/`w-27.5` Tailwind arbitrary units converted to px),
      qty-input unit-chip structure, and price-alert dot+label+border
      styling. Real-browser screenshot (Playwright, `/dev/wds` demo, both
      rows with matching Paper's own two demo items) confirmed the fix and
      full visual match against `UQE-0`'s screenshot — spacing, colors,
      borders, and the warning-toned second row all correct. Zero console
      errors.

- [x] **Bundling checkbox list built** —
      `frontend/features/inventory/components/bundle-checkbox-list.tsx`
      (`BundleCheckboxList` + `BundleRunningTotal`). Reference: `UZJ-0`
      ("6 · Record supplier invoice · drawer"), panel node `V0L-0`
      (checkbox rows) + `V0I-0` (running-total row). Record supplier invoice
      and Record supplier payment (`V7Z-0`) use the identical pattern
      (checkbox rows + a running total that recomputes live) — built once
      here per the S0 brief, both drawers consume the same component with
      different `title`/row data.

      **Checked vs. unchecked is a real, Paper-drawn state pair, not
      derived:** `get_jsx` on `V0L-0` shows the checked row's box is
      `espresso-700` fill + `espresso-700` border, `1.5px` border width, and
      its label is full `--color-ink`; the unchecked row's box is
      transparent with a `border-strong` outline and its label (both title
      and amount) drops to `--color-text-muted` — modeled as one `checked`
      boolean driving box fill, border, and label/amount tone together, not
      three independent props.

      **Built this one using arbitrary pixel values from the start
      (`h-[30px]`, `size-[14px]`)** rather than bare numeric Tailwind
      classes, applying the lesson from the Receipt Line Grid bug
      immediately above rather than re-discovering it a third time.

      **Verification — by-eye + computed-styles:** `get_jsx`/
      `get_computed_styles` on `V0L-0`/`V0I-0` confirmed header height
      (30px), row height (44px), checkbox size (14px, 1.5px border) and
      color states, and the running-total row's `neutral-50` background +
      `body`-sized amount vs. `caption`-sized label. Real-browser screenshot
      (Playwright, `/dev/wds` demo) before and after clicking an unchecked
      row confirmed: the checkbox fills, the label brightens from muted to
      ink, and the running total recomputes live (1 receipt · KES 7,668 → 2
      receipts · KES 10,788) — the actual interaction the "running total
      that recomputes live" requirement describes, not just a static
      screenshot match. Zero console errors.

- [x] **Mismatch/dispute callout built** —
      `frontend/features/inventory/components/dispute-callout.tsx`
      (`DisputeCallout`). Reference: `UZJ-0`, callout node `UZV-0`.
      Warning-toned (`wds-warning-bg`/`wds-warning-border`), dot + bold
      title + muted description + two outlined action buttons (Hold /
      Record at billed — open dispute). The composite renders the callout
      only — per plan §3.2 both buttons hit the same
      `POST /supplier-invoices` endpoint (Hold is the genuine no-write
      branch that just closes the drawer), so the write-path decision
      belongs to the consuming screen (S8), not this component.

      **Verification — by-eye + computed-styles:** `get_jsx` on `UZV-0`
      confirmed padding (`py-3 px-3.5`), dot size/position (`size-1.5`,
      `mt-1.25`≈5px), title weight (500)/description tone
      (`text-copy-muted`), and both buttons' shared styling (`py-1 px-2.5`,
      `border-strong`, `rounded-sm`) — all matched on first pass, no bugs
      found this time (built directly with arbitrary/default-scale values
      throughout, applying the lesson from items 3–4). Real-browser
      screenshot (Playwright, `/dev/wds` demo) confirmed full visual match
      against `UZJ-0`'s reference screenshot. Zero console errors.

- [x] **"How overdue" bucket table built** —
      `frontend/features/inventory/components/aging-bucket-table.tsx`
      (`AgingBucketTable`) + a new shared file,
      `frontend/features/inventory/components/aging-bucket-cell.tsx`
      (`AgingBucketCell`, `AGING_BUCKET_COLUMNS`). Reference: `VGE-0` ("8 ·
      Suppliers / AP landing · desktop"), header row `VIY-0`, populated row
      `VIJ-0` (Kimathi Butchery — Paper's own disputed-supplier reference
      case). Built item 6 before item 7 per the S0 brief's explicit
      dependency — the shared bucket-cell component is built here first,
      then item 7's panel consumes it.

      **The five-bucket tone assignment is fixed per column, not derived
      from whether a cell is populated — confirmed by reading multiple
      cells independently, not assumed uniform:** `get_jsx` on `VIJ-0`
      shows CURRENT always renders in plain ink, 1-30/31-60 always in
      `warning-fg`, and 61-90/90+ always in `error-fg` — including their
      empty "–" values (`VIJ-0`'s 61-90 cell is "–" but still `error-fg`,
      not neutral). This is a real, deliberate Paper-drawn detail (the last
      two buckets read as "hotter" even when empty) — modeled as a
      `tone: 'neutral' | 'warning' | 'error'` fixed on `AGING_BUCKET_COLUMNS`
      per column, applied identically whether the cell value is populated
      or "–", not conditionally recomputed per cell.

      **The disputed badge (`error-bg`/`error-border`, dot + "N disputed")
      and the terms/last-activity caption in `info-fg`** (a blue tone,
      distinct from the usual muted caption color — confirmed via `get_jsx`
      on `VIJ-0`, not assumed to be the standard caption tone) are both
      per-row conditional/styled elements sourced exactly from Paper, not
      invented.

      **A "— DAYS OVERDUE —" spanning label row sits above the real column
      header row** (`VJ8-0`, 20px tall, `text-faint`, `0.08em` tracking,
      centered over the five bucket columns only — confirmed via
      `get_computed_styles`, the supplier/invoiced/paid/outstanding columns
      have empty spacer divs at this row so the label visually centers only
      over the bucket span) — modeled as its own 20px row above the 30px
      header row, not merged into one taller header.

      **Verification — by-eye + computed-styles:** `get_jsx`/
      `get_computed_styles` on `VIY-0` (header) and `VIJ-0` (row) confirmed
      all 9 column widths (180/96/90/78×4/104px, converted from Paper's
      `min-w-45`/`w-24`/`w-22.5`/`w-22`/`w-19.5`×4/`w-26` Tailwind
      arbitrary-scale units), row min-height (52px), disputed-badge styling,
      and bucket tone-per-column. Built every width as an explicit
      `w-[Npx]` arbitrary value from the start (no bare numeric utilities),
      applying the item-3 lesson. Real-browser screenshot (Playwright,
      `/dev/wds` demo, both rows matching Paper's own Kimathi
      Butchery/Samrat Ltd data) confirmed full visual match — bucket tones,
      disputed badge, spanning label row, and column alignment all correct.
      Zero console errors.

- [x] **"What we owe" bucket panel built** —
      `frontend/features/inventory/components/aging-bucket-panel.tsx`
      (`AgingBucketPanel`). Reference: `VND-0` ("9 · Supplier detail ·
      desktop"), panel node `VQ2-0`. Four visible columns (merges 61-90 and
      90+ into one "60+ DAYS" column for display, plan §7 Q4) over the same
      underlying five-bucket data item 6's table uses — the merge is a
      caller-side formatting choice (sum 61-90 + 90+ before passing
      `sixtyPlus`), never a separate four-bucket calculation inside this
      component.

      **Zero-value cell tone is a genuine, independently-confirmed
      difference from item 6's aging table — checked, not assumed to
      match:** `get_jsx` on `VQ2-0` shows the empty 31-60/60+ cells render
      `text-faint` (a plain "nothing here" gray), unlike the aging table's
      convention (item 6) where an empty bucket still carries its column's
      fixed warning/error tone. Modeled as: tone applies only when the cell
      has a real value; an empty ("–"/"—") cell always renders
      `text-faint` regardless of its assigned tone. This is the second
      case this milestone (after Supplier Form's payment-terms toggle and
      Restock Level Grid's tone split in Milestone One) where reading each
      composite's actual empty-state rendering independently — rather than
      assuming one established convention carries over — caught a real
      difference.

      **Verification — by-eye + computed-styles:** `get_jsx` on `VQ2-0`
      confirmed all 5 cells' padding (`py-3 px-3.5`), label styling
      (`field-label`/muted), value size (16px/20px — a size not used
      elsewhere, kept as an arbitrary value rather than forcing `wds-body`
      or `wds-h3`), the OUTSTANDING cell's `neutral-50` background + medium
      weight, and the empty-cell `text-faint` override. Real-browser
      screenshot (Playwright, `/dev/wds` demo, Samrat Ltd's own data from
      `VND-0`) confirmed full visual match. Zero console errors.

- [x] **Mixed-type Inbound/History row built** —
      `frontend/features/inventory/components/purchasing-history-row.tsx`
      (`PurchasingHistoryRowView`, a `PurchasingHistoryRow` discriminated
      union on `type: 'expectedDelivery' | 'goodsReceipt'`). Reference:
      `U7V-0` ("1 · Purchasing hub · desktop"), expected-delivery row
      `UAQ-0` (Samrat Ltd, "Awaiting delivery") and goods-receipt row
      `U9K-0` (GRN-1042, "Received — invoice pending").

      **Three status-tone variants confirmed independently, not assumed
      from two rows:** `get_computed_styles` on the "Overdue" row's status
      text (a third row, not `UAQ-0`/`U9K-0`) confirmed `error-fg` —
      combined with `UAQ-0`'s `neutral-500` ("Awaiting delivery") and
      `U9K-0`'s `info-fg` ("Received — invoice pending"), that's all three
      tones this composite needs, each read off its own real row rather
      than guessed from the two rows already open.

      **Both row types share one skeleton** (200px title/subtitle column,
      grow detail column, 90px age column, 150px status column with a
      `pl-6` indent, 150px action-button column) **and differ only in
      content** — confirmed via `get_jsx` on both `UAQ-0` and `U9K-0`
      showing byte-identical Tailwind classes for the shell, just different
      text/tone/action-label values — modeled as one row view function
      switching on the union's `type` for which fields to read, not two
      separate row components.

      **Flagged, not built into this composite:** the Purchasing hub's KPI
      strip in the current `U7V-0` screenshot still shows 4 tiles including
      `IN TRANSIT` — per the plan's Q1 resolution this is dropped to 3
      tiles (Expected / Awaiting invoice / Owed). That's the KPI Strip
      composite (already built, Milestone One), not this row renderer, and
      is a Paper-artboard-needs-redrawing flag for S5 to carry forward, per
      the plan's own note — not a gap in this item.

      **Verification — by-eye + computed-styles:** `get_jsx` on `UAQ-0`/
      `U9K-0` confirmed the shared shell's column widths, row height (56px),
      and both rows' distinct detail/status/action content. Real-browser
      screenshot (Playwright, `/dev/wds` demo, 3 rows: two
      `expectedDelivery` — one neutral, one error/overdue — and one
      `goodsReceipt`) confirmed full visual match against `U7V-0`'s
      Inbound band. Zero console errors.

- [x] **Mobile universal states built** —
      `frontend/components/app/shell/mobile-states.tsx`
      (`MobileEmptyState`, `MobileLoadingState`, `MobileErrorState`,
      `MobilePermissionDeniedState`). Lands in
      `components/app/shell/` per the placement rules — cross-feature shell,
      same category as `mobile-headers.tsx`/`mobile-status-bar.tsx`, not
      under `features/inventory/`. Reference: page `3-0`, node `X7O-0`
      ("10m · Universal states · mobile") — designed alongside the desktop
      set (`shell-states.tsx`/`15W-0`) but deliberately left unbuilt in
      Milestone One, per its own note, until a real mobile screen needed a
      genuine empty/loading/error state. This session is that build; no
      live Milestone Two mobile screen consumes it yet (that's S5/S8), so
      it's verified as a standalone composite the same way Milestone One's
      composites were, not against a real screen.

      **This composite renders only the content area, not the header —
      confirmed from Paper's own subtitle on `X7O-0`:** *"Composited with
      the Mobile Hub Header; chrome stays, content area swaps."* Each
      exported state is a content-only block; the consuming screen renders
      `MobileHubHeader` itself (already built, Milestone One) and swaps in
      one of these four as the body. Mirrors the desktop `shell-states.tsx`
      API shape (`title`/`description`/`onRetry`/`action`) for consistency
      between the two platforms' state components, while the visual layout
      is genuinely different per platform — confirmed by reading `X7O-0`
      directly rather than assuming the desktop 320×220 card just resizes
      (it's a different composition: full-width content area under a
      header, not a centered fixed-size card).

      **The loading skeleton shape is Paper-specific, not a resize of the
      desktop's three lines:** `get_jsx` on `X86-0` shows a KPI-strip-shaped
      two-cell skeleton followed by two bordered card skeletons (Paper's
      own inline note: *"skeleton · animated sweep, neutral not
      espresso"*) — a materially different shape from the desktop card's
      three left-aligned lines, confirmed by reading the actual node rather
      than assuming the same skeleton pattern applies at a smaller size.
      Modeled with a `rows` prop so a consuming screen can add more card
      skeletons for a longer list, rather than hardcoding exactly two.

      **Bug found and fixed:** used `bg-wds-bg` (Paper's `--color-bg`
      token name, read directly off the JSX) before checking it against
      this codebase's actual preset — `wds-bg` was never registered as a
      Tailwind color utility here; the codebase's equivalent is
      `wds-canvas` (`--wds-canvas`, pointing at the same `neutral-0` value).
      Caught by grepping the preset before trusting the class compiled
      silently wrong (same discipline applied after the Receipt Line
      Grid/Sign Sheet bugs, not by accident) — fixed to `bg-wds-canvas`.

      **Verification — by-eye + computed-styles:** `get_jsx` on `X7U-0`
      (Empty)/`X86-0` (Loading)/`X8T-0` (Error)/`X97-0` (Permission-denied)
      confirmed padding (`py-12 px-6`), glyph sizes/styles (dashed square,
      error dot, ring), title/description sizing, and the Retry button's
      border/padding. Real-browser screenshot (Playwright, `/dev/wds`
      demo, each state composed with a real `MobileHubHeader` per Paper's
      own compositing note) confirmed all four states render correctly
      side-by-side, matching `X7O-0`'s reference screenshot. Zero console
      errors.

**All 9 items in the S0 component inventory are now built and verified.**
Per the owner-approved process change (2026-09-16, logged above), items 2–9
were verified by-eye + computed-styles rather than the automated
`pnpm visual-diff` pixel-diff, after item 2 (Sign Sheet) demonstrated the
automated diff's exact-dimension requirement was a poor fit for composites
rendering variable-length production content. This session found and fixed
five real bugs across the nine composites — three instances of a bare
Tailwind numeric utility not on the default scale silently generating no
layout rule (`w-55`, and five instances in the Receipt Line Grid), and one
instance of a Paper-token-name color class (`wds-bg`) not actually
registered under that name in this codebase's preset — all caught by
real-browser verification before being marked done, not assumed correct
from the code alone.

Update the checkboxes as Step 4 build work completes each item — this is a live
build log now, not just a plan.

## Milestone Two — S5 (Purchasing hub, New purchase, Receiving worklist)

Session `06-sessions/milestone-2-s5-frontend-purchasing-hub-prompt.md`. Built
against S3's real endpoints, no mocks. All three screens assembled from S0's
already-built composites (`KpiStrip`/`KpiRow`, `PurchasingHistoryRowView`,
`shell-states.tsx`/`mobile-states.tsx`) plus new screen-local pieces:

- **Purchasing hub** (`purchasing-hub-screen.tsx`) — 3-tile KPI strip
  (`IN TRANSIT` dropped per plan §7 Q1), Inbound band (real `ExpectedDelivery`
  rows only — S4's `GoodsReceipt` rows aren't live yet), History band via the
  existing `PurchasingHistoryRowView` composite. Bespoke loading (`WK4-0`) and
  error (`WPL-0`) skeletons added to `skeletons.tsx`
  (`PurchasingHubKpiSkeletonDesktop`/`InboundSkeletonDesktop`/
  `HistorySkeletonDesktop`/`SkeletonMobile`).

  **Mobile KPI grid is a screen-local composite, not a reuse of `KpiRow`** —
  confirmed via `get_jsx` on `WUL-0` that Paper draws a 2×2 wrapping grid
  (joined hairline cells, `flex-wrap` + `basis-[45%]`), a materially
  different layout from `KpiRow`'s single non-wrapping row. Built as
  `MobilePurchasingKpiGrid` inside the screen file rather than changing the
  shared composite other screens depend on.

- **New purchase** (`new-purchase-screen.tsx`, `NewPurchaseDrawer`) —
  supplier picker + "Last purchase …" caption (from
  `GET /inventory/items/:id/last-price`, keyed off the first line's item
  since the endpoint is per-item not per-supplier), payment-terms toggle
  (`INVOICE_TO_FOLLOW`/`PAY_NOW` enum unchanged, "Invoice"/"Paid on delivery"
  display labels only, plan §7 Q3a — confirmed against `UEP-0`'s `get_jsx`:
  selected state is a flat `espresso-700` fill + white text, a different
  selected treatment from Supplier Form's `espresso-50` tint, read
  independently not assumed to match), line entry, `POST
  /expected-deliveries` on save. Desktop drawer + mobile full-screen
  (`MobileTaskHeader` + sticky footer Save button, matching the established
  Item Form convention).

- **Receiving worklist** (`receiving-worklist-screen.tsx`), Attendant-only —
  no money columns at all. Renders conditionally on `estimatedTotal` being
  present in the response rather than adding a client-side role check
  (plan §3.1: the backend already omits the field for this role). No bespoke
  Paper artboard exists for loading (plan §3a) — built the generic
  screen-mirroring skeleton default (`ReceivingWorklistSkeletonDesktop`/
  `Mobile`) per the placement rules.

**Routes:** `app/app/inventory/(shell)/purchasing/page.tsx` and
`(shell)/receiving/page.tsx` — both inside the existing shell route group
(both are proper sidebar-nav destinations per their own artboards' sidebar,
unlike Restock Levels' standalone-task placement). Sidebar `NAV_GROUPS`
hrefs updated from `#` to real routes for `purchasing`/`receiving`;
`(shell)/layout.tsx`'s `activeKeyFromPathname` extended to match both.

**Verification — real browser, real backend, no mocks:** started the actual
`pnpm dev` backend + frontend, logged in as `store.manager@wendo.test` /
`store.attendant@wendo.test` (seeded dev accounts), and drove the full
create → cancel write path through the real `POST /expected-deliveries` /
`POST /expected-deliveries/:id/cancel` endpoints via Playwright — confirmed
end-to-end on both desktop and mobile, not just that the code compiles.
Screenshotted every screen/state (populated desktop + mobile, bespoke
loading via a delayed-route simulation, bespoke error via an aborted-route
simulation, Attendant's no-money worklist) and compared against the Paper
screenshots/`get_jsx` captured at the start of the session. One real bug
caught this way and fixed: `useNewPurchaseOptions` requested
`perPage: 200` for the item picker, exceeding the backend's actual
`perPage.max(100)` validator — a 400 that only surfaced once the drawer's
option-loading hook actually ran against the real endpoint, not from
type-checking or a mock. Zero console errors on any screen after the fix.

**Second pass — table/list quality-bar audit + a real desktop rendering bug.**
Partway through the session the owner added the "Table and list-screen
quality bar" standard (see "Placement rules" above) after S5's first pass was
already built. Re-audited all three screens against it:

- Real `limit`/cursor pagination wired for Inbound and History (Purchasing
  hub) and the Receiving worklist, replacing unbounded rendering. History has
  no real cursor from the backend (`GET /inventory/purchasing/history`'s
  schema and repository omit it end to end) — its "Load more" bumps `limit`
  instead; documented as a backend gap in `use-purchasing-hub.ts`'s doc
  comment, not papered over.
- Fixed-width, right-aligned `Est.`/`Age` columns; `overflow-x-auto` row
  wrappers with `min-w-[...]` bodies; `truncate` + `title=` on
  Supplier/Detail text.
- Hover/focus-visible/active states added to every plain `<button>` and
  hand-rolled table row across all three screens plus
  `purchasing-history-row.tsx`, matching existing `Button`/`TableRow`/
  `SidebarNav` conventions.
- `Receive` buttons disabled with an explanatory `title` (S6, Goods Receipt
  entry, doesn't exist yet) instead of looking broken with no affordance.
- Real data bug fixed in `new-purchase-screen.tsx`: the unit-price field only
  showed `item.currentCost` as a `placeholder`, never seeding it as the
  actual controlled value — tabbing past the field silently submitted `'0'`.
  `onValueChange` for the item picker now seeds `estimatedUnitPrice` from
  `selected.currentCost` when the field is still empty.
- Verified pagination and horizontal-scroll mechanics end-to-end against 30
  real `ExpectedDelivery` rows (bulk-created via `POST /expected-deliveries`,
  not a DB insert) — Inbound's cursor-based "Load more" and History's
  limit-bump "Load more" both correctly hide once exhausted.

**Bug found and fixed: `KpiStrip` clipped its own cell content on desktop.**
`purchasing-hub-screen.tsx` was the first screen to give `KpiStrip` cells
with three stacked lines (label + `text-wds-kpi` value + detail, ~108px of
content) — `item-catalog-screen.tsx`'s cells only ever had two. Root cause,
confirmed via direct DOM measurement (`getBoundingClientRect`/computed
styles) rather than guessing from a screenshot: the row's `overflow-hidden`
(used only to clip the joined-cell background to the strip's rounded
corners) triggers a Chromium flexbox quirk where a `flex-row` container with
`overflow: hidden` computes its own auto height from something shorter than
its tallest child's actual content box, independent of `align-items`. Toggling
just the `overflow-hidden` class in a live devtools session reproduced it
directly: 24.97px with the class present, 110px (correct) with it removed —
`align-items`/`align-content` permutations made no difference, isolating the
cause to `overflow-hidden` itself, not stretch behavior. Fix: dropped
`overflow-hidden` from the row and moved corner-rounding to the first/last
cell individually (`rounded-l-wds-md`/`rounded-r-wds-md`) — same visual
result, no clipping. Verified fixed on both `KpiStrip` consumers (Purchasing
hub, Item Catalog) at 1440px.

---

## Milestone Two — S5 refinements (batch 2)

Owner walked the real S5 build live (both by eye and in DevTools) after batch
1 (mobile scroll fixes, Receiving worklist money column, KPI copy — folded
into the S5 commit) and asked for a larger UX pass on three things: the
Purchasing hub's Inbound/History bands being cramped inline tables, the New
Purchase drawer's item picker being a plain scrollable dropdown over the
whole catalog, and no way to create a supplier without leaving the flow.
Built directly in the primary checkout (not delegated to a background
agent — two prior attempts at delegating this batch failed on worktree/
commit-sync issues before any code was written; see the session transcript,
not repeated here since it's process history, not a build decision).

**Purchasing hub → compact previews + two new dedicated pages.** The hub's
Inbound and History bands no longer render their full result set inline —
`usePurchasingHub` now fetches an 8-row preview batch (`PREVIEW_SIZE` in
`use-purchasing-hub.ts`) per band, each with a "View all →" link. Two new
routes hold the full experience:
- `/inventory/purchasing/inbound` (`inbound-list-screen.tsx`,
  `use-inbound-list.ts`) — real cursor pagination (same
  `GET /inventory/expected-deliveries` endpoint), a search box, sticky
  table header.
- `/inventory/purchasing/history` (`history-list-screen.tsx`,
  `use-purchasing-history-list.ts`) — same limit-bump "Load more" workaround
  `usePurchasingHub` already used and documented (`GET
  /inventory/purchasing/history` still has no real cursor server-side; this
  refinement does not add one, out of scope per the plan).

The shared "Load more" button row moved from a private function inside
`purchasing-hub-screen.tsx` to an exported `LoadMoreRow` in
`purchasing-history-row.tsx`, since three screens need it now instead of one.

**New Purchase: drawer → full-page builder.** `NewPurchaseDrawer` is gone;
`NewPurchaseScreen` (same file, `new-purchase-screen.tsx`) is now a full page
at `/inventory/purchasing/new`, used by both desktop and mobile (no more
separate drawer/full-screen variants). Same underlying save call
(`POST /expected-deliveries`, still "not a purchase order — an estimate").

**Item picker: new `ItemPickerCombobox` composite.** Replaces the plain
`<Select>` scrollable dropdown. Type-to-filter over the full catalog, plus a
"Recently purchased from this supplier" section shown first (with per-item
last price) once a supplier is selected. Deliberately not built on the
shared `components/ui2/combobox.tsx` primitive — that one only supports a
flat option list, and adding a sectioned "Recent" group to its contract
would change behavior for its one other consumer (`item-form.tsx`'s
category/supplier pickers) for a need only this screen has. Same visual
language and keyboard conventions (`Escape`/`ArrowUp`/`ArrowDown`/`Enter`) as
the shared primitive, so it reads as the same field family.

**New backend endpoint: `GET /inventory/suppliers/:id/recent-items`.**
Added to the existing `receiving-*.ts` file set (not a new module), same
pattern as every other Milestone Two endpoint — `authenticate` +
`requireRole('STORE_MANAGER')`, `organizationId`-scoped, decimal-as-string
wire format. Sourced from `ExpectedDeliveryLine` (this milestone's own
table — no dependency on `GoodsReceipt`, which has no real signed data until
S4 ships). `recentSupplierItemsRepository.findRecentBySupplier` fetches a
generous window (`limit * 5`) ordered by delivery `createdAt` desc and
dedupes to distinct items in application code, rather than a raw SQL
window-function query — per-supplier line counts are small enough (tens of
rows) that this is simpler and cheap at this data volume. Documented in
`receiving-validators.ts` as an AMENDMENT (2026-09-17, post-freeze), same
convention as the `PurchasingHistoryRowSchema` amendment S3 made. Backend
tests added to `receiving-service.test.ts` (hub-org scoping, 404 on unknown
supplier, decimal/date contract shape) and `receiving-contract.test.ts`
(`RecentSupplierItemSchema` drift guard) — 737 backend tests pass total (up
from 697 before this session), full suite, no failures.

**Inline supplier quick-create.** Uses the shared `Combobox` primitive's
existing `onCreate` hook (already built for `item-form.tsx`'s category
field) — typing a name with no match shows "+ Create '<name>'", which opens
a small nested panel (name pre-filled in the header, phone, payment-terms
toggle) inline in the page, not a stacked drawer/dialog. No new backend
work: reuses `POST /inventory/suppliers` and the existing `createSupplier()`
client function. `useNewPurchaseOptions` gained an `addSupplier` action that
appends the newly created supplier to local state so it's selectable
immediately, instead of a full supplier-list reload.

**Real bugs found and fixed during verification, not just compile-checked:**
- **Supplier combobox showed the raw UUID instead of the supplier's name**
  once selected. Root cause: the shared `Combobox` primitive's `value` prop
  is the *displayed label*, not an id to look up — `item-form.tsx`'s
  existing usage already does `options.find(...).label ?? ''` before
  passing `value`, which this screen's first draft skipped. Fixed by doing
  the same lookup. Confirmed via live snapshot (`value="c3d67be8-…"` before,
  `value="Summer Limited"` after) — a real functional gap unrelated to any
  layout/compile check.
- **Unit price seeded to a real but useless `"0"` for some items.** The
  original seeding logic (`chosen?.currentCost`) is correct, but several
  seed-data items genuinely have `currentCost: "0"` in the catalog (never
  received yet), so the field silently filled with a wrong-looking zero
  instead of staying empty or using a better default. Fixed by preferring
  the selected supplier's own last price from `recentItems` (already fetched
  for the "Recently purchased" section) over `currentCost`, and treating a
  `"0"` result as "no real price" rather than seeding it. Caught by actually
  selecting a real item in the running app, not by reading the code.
- **Item combobox dropdown was clipped by its own table's rounded corners.**
  The New Purchase line-items table wrapper used `overflow-hidden` (to clip
  the header background to the table's `rounded-wds-md` corners), which also
  clipped the item combobox's absolutely-positioned dropdown to a sliver a
  few rows tall — reported live by the owner mid-session, screenshotted from
  an actual browser window (not this session's own devtools session), a
  genuinely different failure mode from anything a static code read would
  have caught. Fixed by removing `overflow-hidden` from the table wrapper
  and moving the corner-rounding to the header row (`rounded-t-wds-md`) and
  the trailing "+ Add line" button (`rounded-b-wds-md`) individually — same
  visual result, no clipping. The same class of fix as the `KpiStrip`
  clipping bug above, different composite.

**Verification — real browser, real backend, no mocks, per the table/list
quality bar and failure-feedback standards this doc already sets:**
- Navigated the full flow end to end against the real running dev servers
  (logged in as `store.manager@wendo.test`, no session/auth mocking):
  Purchasing hub → "View all" on both Inbound and History (confirmed sticky
  header, sticky search, pagination/"Load more" both work) → "New purchase"
  → supplier search/select → item search, confirmed the "Recently purchased"
  section renders real data from the new endpoint (checked the network
  response body directly, not just the rendered UI) → filled qty/price →
  saved → confirmed `POST /expected-deliveries` returned `201`, redirected
  back to the hub, and the new row appeared in both the Inbound preview
  (`Today`) and the KPI count (30 → 31) — an actual end-to-end write, not a
  UI-only check.
- Inline supplier quick-create exercised fully: typed a non-matching name,
  clicked "+ Create", filled phone + terms, clicked "Create & select",
  confirmed `POST /inventory/suppliers` returned `201` and the new supplier
  was immediately selected and usable in the same purchase (verified its
  "Recently purchased" section came back empty, correctly, since it has no
  purchase history yet).
- Failure feedback tested by patching `window.fetch` in a live devtools
  session to force a `400` on `POST /expected-deliveries`: confirmed a
  visible red error message renders on the page (not just console), the
  entered form data is preserved, and the user can retry — no silent
  failure.
- Both new pages and the new full-page builder checked on desktop (1440px)
  and mobile (390px) viewports; zero console errors on any screen across the
  whole session.
- `cd backend && pnpm build && pnpm test` — clean build, 737/737 tests pass.
- `cd frontend && pnpm build` — clean build (had to kill a stray dev-server
  process bound to the same `.next` directory first; the concurrent write
  produced a misleading `PageNotFoundError` on an unrelated route the first
  time, resolved by stopping the dev server before rebuilding — not a code
  regression, see the session's own note on why the two must not run
  concurrently against the same `.next`).

**Not done this session, flagged for later:** the `ageLabel` formatter
occasionally renders "expected Today ago" (should read "expected today") —
a pre-existing cosmetic string-concatenation quirk noticed during mobile
verification, not introduced by this refinement and not fixed here since it
wasn't part of the requested scope.

---

## Milestone Two — New Purchase redesign (owner-approved Paper flow, 2026-09-17)

Replaces the full-page line-by-line builder (`new-purchase-screen.tsx`,
previous entry above) with the checkbox-driven catalog picker + live
selection panel flow approved in Paper. Six artboards, all on page `C-0`:
`X9J-0` (desktop), `XN8-0` (printable list), `XOK-0` (desktop confirmation),
`XUT-0` (mobile catalog), `XXR-0` (mobile review tray), `XZM-0` (mobile
confirmation). Superseded artboards `UEP-0`/`X1O-0` are not built against.

### Reused as-is (no rebuild, no re-diff)

Per §6.1 of `milestone-2-plan.md`, confirmed still correct for this screen:
KPI-strip pattern N/A here, but Drawer Shell/Inventory Shell/Topbar,
`MobileStatusBar`, `MobileTaskHeader`, `components/ui2/button.tsx`,
`components/ui2/combobox.tsx` (for the optional supplier field —
`item-form.tsx`'s `options.find(...).label` pattern applies again),
`components/ui2/toggle-group.tsx`-equivalent segmented control pattern (the
existing hand-rolled `PaymentTermsToggle` in the old `new-purchase-screen.tsx`
is kept, now with a disabled/45%-opacity state added per Paper), and
`useSaveExpectedDelivery` / `useNewPurchaseOptions` / `useCreateSupplierInline`
/ `useRecentSupplierItems` from `use-new-purchase-form.ts` (all reused
unchanged — only the catalog-selection and layout are new, per this task's
brief).

### New primitive

| Component | File | Paper reference | Notes |
|---|---|---|---|
| Checkbox | `components/ui2/checkbox.tsx` | `XDD-0`'s `get_jsx` (checked/unchecked catalog rows) | Added via `npx shadcn@latest add checkbox`, then restyled off the stock rounded/filled treatment to match Paper exactly: square (no radius), `1.5px` border, unchecked = `--wds-border-strong` border on `--wds-surface` fill; checked = `--wds-select-blue` border, fill stays `--wds-surface` (not solid blue — the tick alone carries the color), tick `size-2.5` `strokeWidth 3` in `--wds-select-blue`. New token `--wds-select-blue: #2C6ECB` added to `tokens.wds.css` + `tailwind.wds.preset.ts` (was on Paper's token list, not yet in the codebase — confirmed via `get_tokens`). This is Paper's one deliberate departure from the espresso/caramel palette for this control. |

### New composites — `frontend/features/inventory/components/`

| Component | File | Screens / Paper reference | Notes |
|---|---|---|---|
| Purchase Catalog Picker | `purchase-catalog-picker.tsx` | Desktop table `X9J-0` → `XDD-0`/`XCW-0`; mobile list `XUT-0` | Desktop: filter bar (search + category select + stock-level select + low-stock toggle chip) above a bordered table (`Item`/`Category`/`On hand`/`Par` columns, `Checkbox` primitive leading each row, item name + buy-unit/pack sub-line, category name, on-hand as status-dot + value, par as muted value). Mobile: condensed filter bar (search + "Filters" button opening a `Sheet` — sheet contents not designed in Paper, built to `DESIGN_SYSTEM.md` conventions per the brief's explicit allowance) + low-stock chip + card rows (name/category·unit sub-line left, status-dot qty + "par N" right). Both share one row-data shape and selection-state contract; only the outer chrome differs per breakpoint. |
| Purchase Selection Panel | `purchase-selection-panel.tsx` | Desktop `XEW-0` (panel shell: header count badge, selected-list, supplier section, footer); mobile expanded tray `XXR-0` | Per-item row: name + `KES <price>/<unit>` stacked left, stepper directly above the line total on the right (exact grouping the brief calls a hard requirement — verified against `XEW-0`'s `get_jsx`, which stacks the stepper over the total, not price over stepper). Supplier field uses `Combobox`, labelled "Supplier · optional"; payment-terms toggle sits below at 45% opacity + `pointer-events-none` until a supplier is chosen, matching `XEW-0`'s `opacity-[0.45]` on the whole payment-terms block. Footer: Est. total row, gradient "Save purchase" primary button, outline "Print list" secondary button (icon + label). The mobile tray (`XXR-0`) is the same panel content, full-screen, with a dark `MobileTaskHeader`-style header showing "Review purchase" + item count/total, and a sticky footer (`box-shadow` per `get_jsx`) instead of the desktop's plain bordered footer. |
| Purchase Stepper | inlined in `purchase-selection-panel.tsx` (not split into its own file — a 3-cell `–`/count/`+` control with no reuse elsewhere yet) | `XEW-0` (desktop `h-6.5`), `XXR-0` (mobile `h-7`, wider cells) | Kept as a private component in the selection panel file rather than promoted to `ui2/` — only one consumer exists; promote later if a second screen needs it, per the "don't build ahead of a second real consumer" default. |
| Printable Purchase List | `printable-purchase-list.tsx` | `XN8-0` | Distinct print-only layout, no app chrome: masthead (org name + "Central Store — Purchase list", date + "Not a purchase order"), supplier/requested-by two-column meta row, item table (checkbox column for physical tick-off, Item/Quantity/Unit/Est. cost), total row with "Estimate only — confirm prices at time of purchase." caption, Notes divider, two-column signature-line section ("Purchased by / date", "Actual amount paid"). Rendered at a route the app opens in a new tab and calls `window.print()` on (desktop) — mobile routes the same content through the OS share sheet per the brief (no `window.print()` on mobile). |
| New Purchase Confirmation | `purchase-confirmation.tsx` | Desktop `XOK-0`; mobile `XZM-0` | Shared success-state content (success-tone circular check icon, "Purchase list saved" heading, "N items · ~KES total · saved to Inbound as a shopping list" line) rendered two ways: desktop keeps the persistent shell (topbar breadcrumb visible) with inline Print list + Go to Purchasing buttons; mobile is full-bleed on a light background (explicitly *not* the dark status bar/task header pattern — confirmed by `get_jsx` on `XZM-0`, which has no `MobileStatusBar`/dark header at all, just `bg-surface` top to bottom) with a sticky footer (Go to Purchasing primary, "Share / print list" secondary using the OS share sheet, not `window.print()`). |

### Judgement calls

- **Mobile "Filters" sheet contents** — Paper's `XUT-0` shows only a
  "Filters" button, no expanded sheet artboard. Built a `Sheet` (existing
  `ui2/sheet.tsx`) containing the same category/stock-level controls the
  desktop filter bar shows inline, per the brief's explicit allowance to use
  judgement here.
- **Print route** — Paper doesn't specify a URL. Added
  `app/app/inventory/purchasing-print/new/page.tsx` (deliberately outside
  the `(shell)` route group, alongside the existing standalone
  `restock-levels` route — no sidebar/topbar chrome, per requirement #5) as
  a thin routing shell rendering `PrintablePurchaseList`, reading the draft
  from a short-lived client-side handoff (`sessionStorage`, key
  `inventory:new-purchase:print-draft`) written by the screen right before
  `window.open` rather than fetching the just-saved delivery back from the
  API — the printable list is the *draft estimate* being saved, not a
  re-fetch, and the copy explicitly says "estimate only," so re-fetching a
  persisted record isn't required.
- **Stepper min bound** — Paper's stepper always shows a live "–" as fully
  enabled; built it to floor at quantity 1 (decrementing from 1 removes the
  row, mirroring the row's own trailing "×" remove action) since Paper's
  static frame doesn't show a boundary state and 0/negative quantities have
  no meaning here.

### Visual verification status

See the session's final report for the per-screen by-eye + computed-styles
verification record (screenshot-vs-Paper for all six artboards, or an
explicit list of which were not completed if the session ran out of budget
before finishing all six) — not duplicated here to avoid drift between two
copies of the same record.

---

## Milestone Three — Prep (reuse audit, 2026-09-19)

**Paper reference:** page `Milestone Three · Prep`, file
`01M1ZZJ6S3FZGF5C7PPBGTKY89`. 8 screens: Prep runs list (desktop `Z61-0` /
mobile `ZGY-0`), New prep run (desktop drawer `ZAR-0` / mobile `ZIY-0` +
confirm sheet `ZKJ-0`), Prep run detail (desktop drawer `ZMU-0` / mobile
`ZUK-0`), Prep History (desktop `ZZQ-0` / mobile `10AN-0`) — the last 4
(detail + History, both breakpoints) were designed fresh during owner
review, not part of the original 4-screen milestone scope.

**This is a reuse audit, not a fresh inventory.** Checked every Prep screen
against what Milestone One/Two already built in `components/ui2/` and
`features/inventory/components/` before assuming anything is new — per this
doc's own "Sourcing" rule, composites aren't rebuilt once verified for an
earlier milestone. Result: **no new primitives, no new composites.** Every
shape Prep's screens need already exists, built and verified against a
different milestone's data. This section records what to reuse and from
where — a build session should treat this as the actual Step 4 deliverable
for Prep, not a reason to stop and design new components.

### Primitives — all reused, none new

Table, Input (via `SearchInput`), Sheet/Drawer, Select, Dropdown Menu —
every primitive Prep's screens touch was already built in Milestone One and
is untouched by Prep's shape. Nothing in Prep's screens needs a primitive
that doesn't already exist.

### Composites — reuse map

| Prep screen | Reuses | Notes |
|---|---|---|
| Prep runs list (desktop + mobile) | `KpiStrip` (`features/inventory/components/kpi-strip.tsx`) for the "Runs this week / Yield flags / Prep value" row; `Table` primitive + shared row/header pattern (same shape as `item-catalog-table.tsx`'s header/row structure, not that component itself — Prep's columns differ) | `KpiStrip` is fully data-driven (`cells: KpiCellData[]`, `tone`), no changes needed — just pass Prep's 3 cells instead of Catalog's. |
| New prep run (drawer + mobile) | `Sheet`/`SheetContent`/`SheetHeader`/`SheetFooter` (`ui2/sheet.tsx`); **not** `DrawerShell` as-is — `DrawerShellProps` requires `primaryLabel`/`onPrimaryAction`, which fits (this screen has a real "Confirm run" primary action), so `DrawerShell` **is** reusable here, unlike Prep run detail below | Same drawer chrome Milestone One's 4 drawers already use. |
| Prep run detail (drawer + mobile) | `Sheet` primitives directly (not `DrawerShell` — this is read-only, no primary action, so `DrawerShellProps`'s required `primaryLabel` doesn't fit); row/table shape closely matches `ReceiptLineListReadonly` (`features/inventory/components/receipt-line-list-readonly.tsx`) — same "grow name column + fixed-width numeric columns, sticky header" skeleton, different fields (inputs consumed vs. receipt lines) | **One net-new small composite is justified:** a plain read-only drawer/screen shell (header + body + close-only footer, no primary action) — `DrawerShell` structurally assumes an edit/create flow. Given `GoodsReceiptDetailScreen` already hand-rolls this exact shape without `DrawerShell` (plain `Topbar` + content, no drawer at all, since it's a full route not a drawer), the closest real precedent is: build Prep run detail's *drawer* variant as a thin wrapper directly over `Sheet` (bypass `DrawerShell`), following `GoodsReceiptDetailScreen`'s content structure (header block, line table, footer stat) for the body. Not a new primitive — a new but small composite, or arguably just a usage pattern, not worth a dedicated file if it's this thin. |
| Prep History (desktop + mobile) | `HistoryListScreen` (`features/inventory/components/screens/history-list-screen.tsx`) is the direct structural template — same shape: `Topbar` + `SearchInput` + filter row + sticky-header table (desktop) / `MobileHubHeader` + search + card list (mobile), same `LoadMoreRow`-style pagination pattern via `PurchasingHistoryRowView`'s sibling pattern. Prep History is a **new file** (different data shape, different filters — Output/Yield-flag instead of Supplier/Status) but copies this file's structure wholesale, not a redesign. Summary KPI strip reuses `KpiStrip` again. | Confirms the Step 3 owner-review addition (search/filter/History screen) was the right call — this exact screen shape was already a proven pattern from Receiving, not a new UI idea being introduced. |

### The one real "new" thing: the "+N more" truncated-inputs treatment

Not a component — an inline text-truncation convention (first ingredient +
`+N more` in a muted/faint color) introduced on the Prep runs table and
History table to fix the unbounded-text overflow risk flagged in owner
review. No existing Inventory screen needed this (Receiving's `INPUTS`-
equivalent columns don't exist — GRN lines are their own table, not a
condensed cell). Worth a one-line convention note if a future screen hits
the same "many short items in one cell" shape, but not worth extracting as
a component for a single consumer.

### Step 4 conclusion for Milestone Three

No shadcn primitives to add. No new composite files beyond: (1) Prep run
detail's thin read-only-drawer wrapper (build inline in the screen file,
following `GoodsReceiptDetailScreen`'s content pattern — don't create a new
shared "ReadOnlyDrawerShell" primitive for a single consumer unless a third
screen needs the same shape later), and (2) Prep History as a new screen
file structurally copied from `HistoryListScreen`. Step 5 planning can
proceed treating Prep as almost entirely an assembly task over Milestone
One/Two's already-verified component set, not a component-building task.
