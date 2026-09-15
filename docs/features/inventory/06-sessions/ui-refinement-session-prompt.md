# UI refinement session — Inventory Milestone One (Catalog, Suppliers & Restock Levels)

Paste everything below the line to the agent running this session.

> **Note on scope, read before starting.** The owner spotted spacing/component
> discrepancies browsing the six screens on localhost against the Paper
> designs, but this prompt does **not** carry a specific list — none was
> captured. So this session is framed as a **systematic re-comparison pass**:
> go screen by screen, diff localhost against its Paper artboard, fix what's
> actually wrong. If the owner hands you a specific list of issues instead when
> this session starts, use that as your task list and treat the systematic
> pass below as the fallback method for each item on it, not as extra scope to
> do on top.

---

You are running a **UI refinement pass** for **Inventory Milestone One —
Catalog, Suppliers & Restock Levels**. This is **polish, not a new build.**

## What's already true — read before touching anything

The six screens exist, are wired to the real backend, and are **functionally
verified end to end**: Flow 18 (catalog item create/retire, the raw-ingredient
↔ department-scoping conditional) and Flow 19 (bulk restock-level edit, save,
DB-confirmed persistence) were both driven through a real browser against a
real backend in the prior session, using real data seeded from
`docs/inventory/reference-photos/`. The migration has also been run cleanly
against a restored production backup. **None of that is in question here.**
This session is strictly: **does the visual output match Paper's design,
pixel-for-pixel, spacing-for-spacing.**

One real bug was already found and fixed this way last session: the Item
Catalog Table's Units column had no overflow handling, so real data (longer
than the demo/mock strings used while building) visually spilled into the
adjacent column. Root cause was traced in the component source
(`whitespace-nowrap` in a fixed-width `table-fixed` column with no overflow
rule) and fixed to match Paper's own `overflow: clip` convention on that
table, not invented from scratch. **This is the model for how to work this
session** — read the actual computed values from Paper, find the actual cause
in the component, fix it to match the reference, don't guess.

## Read these first, in this order

**Read the named sections, not the whole documents.**

1. **`docs/features/inventory/05-plan.md` §0** — the six screens and their
   exact Paper artboard IDs (desktop + mobile), and what's explicitly out of
   scope for this milestone.
2. **`docs/features/inventory/04-components.md`** — in full, not skimmed. This
   is the single most important document for this session:
   - The **primitive and composite tables** — what each screen is built from,
     and the exact Paper node each was sourced against.
   - **"Visual fidelity process"** — the rule that values come from
     `get_computed_styles`/`get_jsx`, never from eyeballing a screenshot, and
     that every raw value must map to an existing design token (or get added
     as one, in the same edit it's first used).
   - **The Status section, read in full** — dozens of specific,
     Paper-verified decisions are already logged here. Before "fixing"
     anything that looks like an inconsistency, check here first. Confirmed
     examples of things that look like bugs and are not:
     - Four different drawer widths (Item Form 500px, Category Manager 420px,
       Supplier Form 460px, Restock Level Grid 440px) — each confirmed
       independently against its own Paper node.
     - Restock Level Grid's mobile input is 32px (`h-8`), not the 44px
       mobile-field convention used elsewhere — confirmed against Paper's
       own `TLX-0` (`w-14 h-8`), a deliberately smaller control for a compact
       row.
     - The below-restock-level tone is amber on desktop, red on mobile —
       two different Paper nodes, checked independently, genuinely different.
     - Item Form's mobile Type-toggle is `h-10`; Supplier Form's mobile
       payment-terms-toggle is `h-11` — different nodes, different heights,
       both correct.
     - Supplier Form's desktop payment-terms toggle uses a tint fill
       (`espresso-50` + colored text), not the gradient-fill convention every
       other toggle in this build uses — checked and confirmed a real,
       deliberate Paper difference, not a missed restyle.
   - **"Known issues"** — the WCAG AA contrast finding and its resolution
     (already fixed: `--wds-text-copy-faint`/`--wds-text-copy-muted` for real
     copy, `--wds-text-faint`/`--wds-text-muted` now decorative-only). Don't
     revert this.
3. **`docs/DESIGN_SYSTEM.md`** — token reference (spacing, radii, type scale,
   color roles).
4. **`docs/API_CONTRACT.md` §21** — the frozen contract, so you know what's
   contract-governed (data shapes, behaviours) vs. purely visual. You should
   not need to touch this file this session; read it so you recognize the
   difference when you see it.
5. **`CLAUDE.md`** — "Frontend Hook Stability Rules" and the frontend feature-
   module structure (`frontend/features/inventory/`). Fixes belong there, not
   in the legacy `components/`/`services/`/`types/` folders.

## Paper source of truth

File `01M1ZZJ6S3FZGF5C7PPBGTKY89`, page `B-0`
("Milestone One · Catalog, Suppliers & Restock Levels"). Artboards, from the
plan:

| # | Screen | Desktop | Mobile |
|---|---|---|---|
| 1 | Item catalog | `SFQ-0` | `TLT-0` |
| 2 | Item create/edit | `SKV-0` (drawer, 500px) | `TLU-0` |
| 3 | Manage categories | `SRB-0` (drawer, 420px) | `TLV-0` |
| 4 | New/edit supplier | `SX5-0` (drawer, 460px) | `TLW-0` |
| 5 | Restock levels · Central Store | `T52-0` (drawer, 440px) | `TLX-0` |
| 6 | Restock levels · department | — | `TD1-0` |

Use the Paper MCP directly: `get_screenshot` for a first-pass visual read,
then `get_computed_styles` / `get_jsx` on the specific node for the actual
numbers before changing any code. Never fix a spacing/color value from memory
or from eyeballing a screenshot comparison alone.

## Local environment

Both dev servers need to be running, and real seed data already exists from
the prior session (23 real items from `reference-photos/`, 2 categories, 2
suppliers, restock levels) — you likely do not need to re-seed.

```bash
# Backend (from backend/)
docker compose up -d postgres redis   # if not already up
npx tsx watch src/server.ts

# Frontend (from frontend/)
npx next dev -p 3000
```

Login: `store.manager@wendo.test` / `password123` (Store Manager, hub org —
covers screens 1–5: Catalog, Item create/edit, Manage categories, New/edit
supplier, Central Store Restock Levels).

**Screen 6 (department Restock Levels, `TD1-0`) has no ready login —
confirmed by reading `seed-dev.ts`: it seeds `MANAGER`, `WAITER`, `CHEF`,
`BARISTA`, display roles, and `STORE_MANAGER`, but never `DEPARTMENT_HEAD`.**
`User.departmentTag` / `User.isDepartmentHead` exist on the schema but nothing
sets them for a dev account. Before you can browser-test screen 6, create one
— either add a `DEPARTMENT_HEAD` entry to `seed-dev.ts`'s staff list (role
`DEPARTMENT_HEAD`, `departmentTag` set to e.g. `KITCHEN`, `isDepartmentHead:
true`, on one of the branch orgs, not the hub) and rerun it, or create one
by hand via Prisma Studio / a script against your local DB. Either way this
is dev-environment setup, not a product change — don't add department-head
seeding to production seed scripts as part of this.

If either dev server was already running from a prior session, check it's
serving current code before trusting anything it renders — `rm -rf .next`
and restart if you see stale-chunk 404s in the console. This exact failure
mode already cost real debugging time in the previous session.

## Process, per screen

1. Load the real screen in a browser (desktop 1440px, then mobile 390px).
2. Screenshot it.
3. `get_screenshot` the matching Paper artboard at the same width.
4. Compare. For anything that looks different — spacing, alignment, color,
   type size, radius, icon, border — **check `04-components.md`'s Status
   entry for that composite first.** If it's already documented as a
   confirmed, deliberate difference, leave it and move on.
5. For anything not already documented: `get_computed_styles` on the specific
   Paper node to get the real value. Compare to the component's current
   Tailwind class / token.
6. Trace the actual cause in the component source before changing anything —
   a missing token registration, a wrong token reference, a missing
   `overflow`/`truncate` rule, a hardcoded value that should be a token, a
   genuinely wrong class. Don't guess-and-check.
7. Fix. Re-screenshot. Confirm the fix actually resolves it and doesn't
   regress anything else on that screen.
8. **Check both breakpoints (1440 and 390) after any fix** — a fix for one
   can break the other if it wasn't built responsively.
9. Note the fix (what was wrong, what Paper node confirmed the correct value,
   what changed) — this session's version of the Status-section discipline
   `04-components.md` already established. Add an entry there for anything
   nontrivial, the same way prior sessions did.

## Known traps (from prior sessions' own documented history)

- **Tailwind spacing/fontSize tokens silently drop utilities if not
  registered.** A class like `py-wds-3.5` for a spacing value not yet in
  `tailwind.wds.preset.ts`'s `spacing` object compiles without error but
  applies **zero** — no warning, no build failure. Any new value pulled from
  Paper must be registered in the preset in the same edit it's first used.
  Check the class actually renders (computed styles in devtools) before
  trusting it.
- **A new `fontSize` token must also be added to `lib/cn.ts`'s
  `customTextScale`**, or `cn()`'s `tailwind-merge` logic silently treats it
  as conflicting with a `text-wds-*-ink`/`-secondary`/etc. color class on the
  same element and drops one of them — no build error either.
- **OKLCH-vs-comment token drift.** Every color token in `tokens.wds.css` was
  swept and corrected as of the 2026-09-15 verification pass — if you're
  reading a token's value, trust the OKLCH, and if you add a new one, verify
  it round-trips to its own hex comment (canvas `fillStyle` resolution in a
  real browser, not just visual inspection) before treating it as correct.
- **Stale dev server / leftover production build.** If `next dev` 404s its
  own JS/CSS chunks, `rm -rf .next` before restarting. Cost real time in the
  prior session.
- **`--wds-text-faint`/`--wds-text-muted` are decorative-only** (placeholders,
  icon fills, inert glyphs). Any real copy — helper text, captions, field
  labels — uses `--wds-text-copy-faint`/`--wds-text-copy-muted`. Don't
  introduce a new use of the old pair for real copy; that reintroduces a
  WCAG AA failure that was deliberately fixed.

## Non-negotiables

- TypeScript strict, no `any`.
- Frontend feature-module structure — fixes to Milestone One screens/
  composites go in `frontend/features/inventory/`, not the legacy
  `components/`/`services/`/`types/` folders.
- No ad hoc styling outside the token system (`docs/DESIGN_SYSTEM.md`).
- Hook stability rules (`CLAUDE.md`) if any fix touches a hook or effect.
- Use `pnpm` for everything.

## Definition of done

- [ ] Every screen (all 6, both breakpoints where applicable) compared
      against its Paper artboard
- [ ] Every real discrepancy found is either fixed and verified, or confirmed
      as an already-documented deliberate difference (cite the
      `04-components.md` entry)
- [ ] Any new token (spacing, color, fontSize) registered in
      `tailwind.wds.preset.ts` / `lib/cn.ts` in the same edit it's introduced
- [ ] `04-components.md` updated with a dated entry for any nontrivial fix,
      matching the existing Status-section format
- [ ] `pnpm build` clean on both `backend/` and `frontend/`
- [ ] Flow 18 and Flow 19 spot-checked once more after changes — a couple of
      real actions in the browser (not just visual comparison), confirming no
      regression to what was already verified working
- [ ] Use TodoWrite throughout and keep it live — one item per screen is a
      reasonable granularity

## Stop conditions

- **No schema, contract, or backend changes.** This is a frontend visual pass.
  If a fix genuinely seems to need a backend or contract change, **stop and
  flag it rather than working around it** — that's a signal the issue isn't
  actually a UI bug.
- **No new screens, fields, or features.** If something looks "missing"
  compared to Paper, check `04-components.md` and `05-plan.md` §0 first —
  it may be explicitly out of scope for Milestone One.
- **Don't touch the legacy `app/app/inventory/` pages or their removal** —
  already handled in a prior session.
- If the same discrepancy appears in multiple places and looks like it should
  be a design-token-level fix (not a per-component patch), do the token-level
  fix once, not N component-level patches — but flag it as such rather than
  silently deciding alone if it's ambiguous whether it's scoped enough for
  this session.
