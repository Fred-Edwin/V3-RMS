# HANDOFF — Milestone One · Step 4 component build

**For a fresh session.** This is the running handoff for building the Step 4
component set (primitives + composites) for Inventory Milestone One (Catalog,
Suppliers & Restock Levels). Read `docs/FEATURE_REDO_PLAYBOOK.md` §5 Step 4 and
`docs/features/inventory/04-components.md` first — that doc is the authority on
what to build and the fidelity/states process. This file is only the "where we are
right now, what's already done, what's next" status.

**Before doing anything else:** `git status` shows everything below as
**uncommitted**. Nothing from this work has been committed yet. Check with the
owner whether to commit before continuing — don't lose it (this project has a
documented prior incident of uncommitted work getting lost to an OS crash; see
`docs/features/inventory/HANDOFF-role-complete-design.md`'s housekeeping note).

═══════════════════════════════════════════════════════════════════════
WHERE THINGS STAND
═══════════════════════════════════════════════════════════════════════

## What's done

1. **`docs/features/inventory/04-components.md` written** — the full component
   inventory for Milestone One: every primitive and composite needed, each with a
   Paper node reference, plus the visual-fidelity process, the pixel-diff method,
   the responsiveness requirement, and the component-states approach (Paper-verified
   vs. convention-derived). **Read this file in full before building anything** —
   it is the spec.

2. **`docs/FEATURE_REDO_PLAYBOOK.md` §5 Step 4 amended** — now formally names
   `docs/features/<feature>/04-components.md` as Step 4's output (previously
   unnamed), and documents the reuse rule: once a primitive/composite is built and
   verified for one build unit (milestone/slice), later ones reference it rather
   than rebuild it — only genuinely new composites go through the full process
   again. A full assembled screen still gets a quick screen-level visual diff even
   when built entirely from reused composites.

3. **Pixel-diff tooling installed and working**, in `frontend/`:
   - `pixelmatch`, `pngjs`, `tsx` added as devDependencies (`pnpm add -D pixelmatch
     pngjs @types/pixelmatch @types/pngjs tsx`).
   - `esbuild`'s postinstall build script approved (`pnpm approve-builds esbuild`)
     — required for `tsx` to work; already done, no need to redo.
   - `frontend/scripts/visual-diff.ts` written — takes two PNGs (Paper reference,
     built screenshot) at identical dimensions, runs `pixelmatch`, outputs a
     mismatch % and an optional red-highlighted diff image. Errors clearly if
     dimensions don't match (usually means wrong viewport width was used).
   - `pnpm visual-diff <paper.png> <built.png> [outDiff.png] [--threshold=2]` added
     to `package.json` scripts. Default threshold 2% (documented rationale in
     `04-components.md`: 0% isn't realistic — Paper's renderer and a real browser
     won't rasterize fonts bit-identically — 2% catches real defects while
     tolerating anti-aliasing noise).
   - Verified working: `pnpm tsx scripts/visual-diff.ts --help` printed usage
     correctly.

4. **First real fidelity bug found and fixed**: the `button.tsx` primitive
   (seeded in Phase 0) already used a gradient for its `primary` variant — but the
   *wrong* gradient. Code had `--wds-gradient-primary: espresso-600 → espresso-700`.
   Paper's actual approved button (confirmed on two nodes: `TD3-0` and `T55-0`,
   both on the Store Manager / Department Head pages) is
   `espresso-700 → #4A1D00` — a bespoke darker color with no existing scale step.
   Fixed in `frontend/app/tokens.wds.css`:
   - Added `--wds-primary-btn-end: #4A1D00` (new token, not on the espresso scale).
   - Changed `--wds-gradient-primary` to
     `linear-gradient(180deg in oklab, var(--wds-espresso-700) 0%, var(--wds-primary-btn-end) 100%)`.
   - **Not yet pixel-diff-verified in a browser** — the fix was made by comparing
     Paper's `get_computed_styles` output against the token file's source values,
     not by rendering the button and diffing it. That verification step is still
     owed (see "Next steps" below) — do this first, it's nearly free since the fix
     is already made.

## What's NOT done yet

Nothing else has been built. No primitives beyond the button-gradient token fix, no
composites, no preview/diff harness route exists yet.

═══════════════════════════════════════════════════════════════════════
NEXT STEPS — remaining primitives, in build order
═══════════════════════════════════════════════════════════════════════

Full per-primitive process (7 steps: add via shadcn CLI → source exact Paper values
→ restyle onto tokens → style the full state matrix → pixel-diff both anchors →
responsive spot-check → mark done in `04-components.md`) is spelled out in
`04-components.md`'s "Visual fidelity process" and "Component states" sections —
follow that, don't re-derive it.

**Build order** (most-reused first):

1. **Sheet / Drawer** — needed by all 4 desktop drawers. Fix the scrim's full-height
   behavior once here at the primitive level (`height: 100%` / `inset: 0`, not a
   fixed px value) — this exact bug already had to be manually fixed per-instance
   once this session on the Milestone One Paper page; don't let it recur in code.
   Paper reference: `SKV-0`'s `Drawer`/`Scrim` children.
2. **Select** — Category picker, Preferred supplier picker, Department filter.
   Paper reference: `SLU-0` (Category field, Item drawer).
3. **Toggle Group** (segmented control) — Type (Raw/Prepped/Stocked), Payment terms
   (Invoice to follow/Pay now). Both selected/unselected states are Paper-drawn —
   source both, don't invent the selected-state styling.
4. **Table** — Item catalog table, Restock Level grid, Category list. Paper
   reference: `SFT-0`.
5. **Dropdown Menu** — catalog toolbar filters ("Type ▾", "Department ▾",
   "Category ▾"). Distinct from Select — filters a list, doesn't set a field.
6. **Avatar** — user-initials circle, sidebar footer.
7. **Search Input** — search box + `⌘K` hint. Confirm during the build whether
   this needs a separate shadcn primitive or is just an `Input` composition with a
   leading-icon slot — don't assume, check.

**No Storybook exists in this repo.** Create a scratch preview route —
`frontend/app/dev/component-preview/page.tsx` — to render each primitive (and
later, composites) with mock content for screenshotting/diffing. Gate it obviously
as dev-only; delete or hide it once Milestone One is fully wired into real pages
during Step 7.

═══════════════════════════════════════════════════════════════════════
AFTER THE PRIMITIVES — outline only, not detailed (plan this fresh when reached)
═══════════════════════════════════════════════════════════════════════

1. **Composites** — same per-item process as primitives: Sidebar Nav, Desktop
   Topbar, Mobile Hub Header, Mobile Task Header, Mobile Status Bar, KPI Strip,
   Drawer Shell (built on the Sheet primitive), Item Catalog Table, Item Form
   (shared field set between desktop drawer + mobile route — build once, slot into
   either shell), Category Manager List, Supplier Form, Restock Level Grid. Full
   list with Paper node references is in `04-components.md`. Sidebar Nav / Topbar /
   Mobile headers / Status Bar are **cross-feature shared** — build once, not under
   `components/inventory/`.
2. **Step 5 — high-level plan for Milestone One**: data model changes, migration
   plan, API contract, session breakdown, test classification. Output:
   `docs/features/inventory/05-plan.md` (or a Milestone-One-scoped variant — decide
   when reached). Owner-approval gate.
3. **Step 6 — freeze the API contract** for Milestone One.
4. **Step 7 — build sessions**: backend builds real endpoints in
   `backend/src/modules/inventory/`; frontend wires the already-verified composites
   to the real contract, replacing the scratch preview harness with real routes.
   Can run in parallel once the contract is frozen.
5. **Step 8 — integration**, **Step 9 — migrate/deploy/observe** (owner watches a
   real user use it).
6. **In parallel, Milestone Two's Paper design** (Buying & Goods Receipt) can be
   regrouped and reviewed — doesn't block any of the above. Its own Step 4 pass
   will be lighter since most primitives will already exist.

═══════════════════════════════════════════════════════════════════════
GROUND RULES (carried from this session, don't relitigate)
═══════════════════════════════════════════════════════════════════════

- **Primitives**: shadcn CLI only, never hand-written. Restyle onto WDS tokens
  after adding.
- **Composites**: hand-assembled from primitives, matching Paper's exact `get_jsx`
  tree. Not from shadcn — shadcn "blocks" are fair game as scaffolding reference
  only, Paper is always the spec of record.
- **Never source a value from a screenshot.** `get_computed_styles` / `get_jsx` /
  `get_fill_image` supply real numbers; screenshots verify the rendered result
  afterward.
- **Every raw value maps to a token.** A value with no matching token is a signal
  to add one (like `--wds-primary-btn-end`), not to hardcode around it.
- **States**: Paper-drawn states (selected toggle, disabled field, active nav item,
  retired/muted row) get sourced + diffed like any default state. Hover /
  focus-visible / active / disabled — not individually drawn in Paper — derive
  consistently from existing tokens (`--wds-gradient-primary-hover`,
  `shadow-wds-ring`, `disabled:opacity-60` — all already used in `button.tsx`).
- **Pixel-diff threshold ≤2%**, both Paper anchor widths (1440 desktop / 390
  mobile) where applicable. A failing diff image should look like a solid red block
  (real defect) vs. scattered single pixels (font-rendering noise) — don't raise the
  threshold to make a real defect disappear.
- **Responsiveness**: Paper only designed the two anchors. Every composite also
  gets a judgment-based spot-check at ~768px/~1024px (no horizontal scroll, nothing
  clipped/overlapping) — there's nothing to diff against there, but it still has to
  be checked, not skipped.
- **Reuse across milestones is the point** (see playbook amendment above) — once
  built and verified here, later milestones reference, they don't rebuild.
