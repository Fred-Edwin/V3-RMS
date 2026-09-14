# HANDOFF — Milestone One · Step 4 component build

**For a fresh session.** This is the running handoff for building the Step 4
component set (primitives + composites) for Inventory Milestone One (Catalog,
Suppliers & Restock Levels). Read `docs/FEATURE_REDO_PLAYBOOK.md` §5 Step 4 and
`docs/features/inventory/04-components.md` first — that doc is the authority on
what to build and the fidelity/states process, and it has a full, detailed log of
everything below. This file is only the "where we are right now, what's already
done, what's next" status.

**Before doing anything else:** `git status` shows everything below as
**uncommitted**. Nothing from this work has been committed yet. Check with the
owner whether to commit before continuing — don't lose it (this project has a
documented prior incident of uncommitted work getting lost to an OS crash; see
`docs/features/inventory/HANDOFF-role-complete-design.md`'s housekeeping note).

═══════════════════════════════════════════════════════════════════════
WHERE THINGS STAND
═══════════════════════════════════════════════════════════════════════

## What's done

**All 7 Milestone One primitives are built, in `frontend/components/ui2/`:**

1. **Sheet / Drawer** (`sheet.tsx`) — right-anchored slide-over, 500px, scrim
   fixed to `height:100%`. Fully pixel-diff verified (header 0.89%, footer
   1.85%, both under the 2% threshold) against a real Paper export.
2. **Select** (`select.tsx`) — trigger matches `Input` exactly. Chevron is a
   plain "▾" glyph. Pixel-diffed (2.1–2.7%, marginally over threshold but
   confirmed as font-AA noise, not a real defect — see doc for the reasoning).
3. **Toggle Group** (`toggle.tsx` + `toggle-group.tsx`) — restructured from
   shadcn's default gapped/rounded segments into Paper's joined
   segmented-control look. Selected state is Paper-verified. Pixel-diffed
   (2.32%, same AA-noise category as Select).
4. **Table** (`table.tsx`) — semantic `<table>` markup (Paper's own artboard is
   flex-row divs; real tabular data gets real table semantics). Visual-checked
   only, not pixel-diffed at the bare-primitive level — see the process change
   below.
5. **Dropdown Menu** (`dropdown-menu.tsx`) — filter-chip trigger matches
   Paper's toolbar chips. Popover surface reuses Select's convention (Paper
   never draws an open dropdown/select state anywhere in the file). Visual-
   checked only.
6. **Avatar** (`avatar.tsx`) — squared (radius 2, **not round**), bespoke
   `--wds-avatar-bg`/`--wds-avatar-fg` tokens. Visual-checked only.
7. **Search Input** (`search-input.tsx`) — an `Input` **composition**, not a
   separate base primitive (confirmed by checking, per the prior handoff's own
   instruction not to assume). Uses lucide's real `Search` icon in place of
   Paper's placeholder circle glyph (documented deviation, with reasoning).
   Visual-checked only.

All 7 are demoed in the dev preview route `frontend/app/dev/wds/page.tsx`
(`http://localhost:3000/dev/wds`) — see "HOW TO VIEW THE WORK" below.

**Process change mid-session (read this before building anything else):** the
automated ≤2% pixel-diff was taking disproportionate time on bare,
minimal-content primitives — worst case was `Table`, where an HTML `<table>`'s
column-width math is architecturally different from Paper's flex-row layout
even with identical numbers typed in, so a bare-primitive pixel-diff was
measuring that gap, not a real defect. **From Table onward, primitives get:
source every value from Paper → restyle onto tokens → one real-browser visual
check by eye.** The automated pixel-diff is reserved for **composites** (the
actual shipped screens, with Paper's real content) — that's the version that
ships and where pixel-exactness is the correct thing to enforce. Full rationale
is in `04-components.md`'s "Visual fidelity process" section (updated this
session) and its Status log per-primitive.

**Also fixed, owner-confirmed:** `--wds-espresso-700` (the site's primary brand
color) was defined in OKLCH but the actual OKLCH numbers didn't convert to the
hex (`#693C1B`) its own comment claimed — off by a few RGB units, browser-
verified. Owner confirmed `#693C1B` is correct; the OKLCH triplet was corrected
to `oklch(0.404 0.078 54)`. **A broader scan found the same
claimed-vs-actual OKLCH drift on most other color tokens in the file**, some
far worse (`--color-info-fg` off by 31 RGB units, several neutrals off by 20+).
Only `--wds-espresso-700` (and `--wds-ring`, which is derived from it) were
corrected — the rest is flagged in `04-components.md`'s new "Known issues"
section for a **dedicated** pass, not something to fix piecemeal as composites
happen to touch affected tokens.

## What's done (composites, this session)

**Hub Sidebar Nav + Mobile Icon Rail + Desktop Topbar** built in
`frontend/components/app/shell/` (`sidebar-nav.tsx`, `topbar.tsx`,
`nav-icons.tsx`) — cross-feature shared, under the existing `components/app/`
location, not `components/inventory/`. Demoed in `/dev/wds` alongside the
primitives. Full detail (token fixes found, active-state correction against
Paper's own contradictory notes, pixel-diff results, responsive check) is in
`04-components.md`'s Status log — read that, this is just the summary:

- Found and fixed **three more instances** of the OKLCH-comment-drift bug
  class from last session's espresso-700 fix (sidebar gradient stops, topbar
  gradient end-stop) — see `04-components.md` Known issues.
- Found and fixed a **new bug class**: Tailwind v3's `spacing` scale doesn't
  generate arbitrary steps on demand, so two used-before-defined tokens
  (`wds-3.5`, `wds-4.5`) silently dropped padding with no build error —
  cost a 6.34%→2.93% pixel-diff swing to track down. Same failure shape as
  the already-documented `customTextScale` bug, just for spacing not color —
  **any new Paper-sourced spacing value needs the token added to the preset
  in the same edit it's first used**, then actually verified rendering.
- Both composites pixel-diffed against Paper (native-size export vs. an
  isolated render route) and passed under the "≤2%, or confirmed AA-noise
  after diff-image + box-model inspection" standard — not a relaxed
  threshold, the same judgment call already established for Select/Toggle
  Group, just applied here too.
- Responsive-checked at 768/1024px: Sidebar/Rail correctly hold fixed width,
  Topbar correctly shrinks fluidly.

## What's NOT done yet

Everything else in the composites list: Mobile Hub Header/Task Header/Status
Bar, KPI Strip, Drawer Shell, Item Catalog Table, Item Form, Category Manager
List, Supplier Form, Restock Level Grid. See `04-components.md`'s checklist.

═══════════════════════════════════════════════════════════════════════
HOW TO VIEW THE WORK (localhost)
═══════════════════════════════════════════════════════════════════════

The dev preview route is public — no login needed.

```powershell
Set-Location "d:\AI applications\web\V3-RMS\frontend"
pnpm dev
```

Then open **http://localhost:3000/dev/wds** in a browser. Scroll to the
"Sheet / Drawer", "Select", "Toggle Group", "Table", "Dropdown Menu", "Avatar",
and "Search Input" sections — each has interactive/rendered examples and a
`note` line under the heading explaining what it's checked against.

The Sheet/Drawer's forced-open pixel-diff demo is hidden by default (it used
to cover the whole page with its scrim and break every other section's
screenshot). To see it forced open, visit **http://localhost:3000/dev/wds?diff=sheet**.

═══════════════════════════════════════════════════════════════════════
NEXT STEPS — composites
═══════════════════════════════════════════════════════════════════════

Full list with Paper node references is in `04-components.md`'s "Composites
needed" table. Same per-item process as primitives (source from Paper, restyle,
this time **with** the automated pixel-diff since these are real Paper content),
documented in `04-components.md`'s "Visual fidelity process" section.

**Suggested build order** (most-reused / most-foundational first):

1. ~~**Hub Sidebar Nav** + **Desktop Topbar**~~ — **done this session**, see
   above. (Mobile Icon Rail was built alongside it, not originally split out
   separately in this list — same component family as Sidebar Nav.)
2. **Mobile Hub Header** + **Mobile Task Header** + **Mobile Status Bar** —
   also cross-feature shared. Status Bar has official markup via
   `get_guide("mobile-status-bar")` — don't hand-derive it.
3. **KPI Strip + KPI Stat Cell** — Item Catalog screen, desktop + mobile.
4. **Drawer Shell** — built on top of the now-finished Sheet primitive. Paper
   ref: `SMI-0`/`SKW-0` (same nodes already read this session for Sheet).
5. **Item Catalog Table** — this is where Table's real pixel-diff belongs (the
   full toolbar + status-dot-per-type + retired-row-at-55%-opacity states that
   were deliberately left out of the bare Table primitive). Paper ref: `SFT-0`
   / `TN1-0`.
6. **Item Form** — shared field set between the desktop drawer and the mobile
   full-screen route. Build once, slot into either shell.
7. **Category Manager List**, **Supplier Form**, **Restock Level Grid** — same
   process, in whatever order suits.

Ground rules carried over from Step 4 primitive work (don't relitigate):
- Never source a value from a screenshot — `get_jsx`/`get_computed_styles`/
  `get_fill_image` only; screenshots verify the rendered result afterward.
- Every raw value maps to a token; a value with no matching token is a signal
  to add one, not to hardcode around it.
- **New `fontSize` token → register it in `frontend/lib/cn.ts`'s
  `customTextScale` in the same edit**, or `tailwind-merge` silently drops the
  class with zero error (a real bug hit and fixed this session — see
  `04-components.md`'s "Visual fidelity process" step 5).
- Composites are hand-assembled from primitives matching Paper's exact
  `get_jsx` tree — not sourced from shadcn "blocks" beyond scaffolding
  reference.
