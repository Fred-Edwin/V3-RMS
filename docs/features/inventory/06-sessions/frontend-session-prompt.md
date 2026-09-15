# Frontend build session — Inventory Milestone One (Catalog, Suppliers & Restock Levels)

Paste everything below the line to the agent running the frontend build for
Inventory Milestone One (**plan Session 4**). It runs **in parallel** with the
backend session — you build against a mock of the frozen contract and never wait
on the backend.

---

You are running the **frontend build** for **Inventory Milestone One — Catalog,
Suppliers & Restock Levels**, Step 7 of the Feature Redo Playbook.

**This is not a component build.** Every primitive (7) and composite (9) these
screens need is already built, verified against Paper, and committed. Your job is
to **assemble them into six real screens**, add the surrounding chrome the
composites deliberately don't own, wire them to a mock of the frozen contract,
and visual-diff each screen against its Paper artboard.

## Read these first, in this order

**Read the named sections, not the whole documents.**

1. **`docs/features/inventory/05-plan.md`**
   - **§0** — the six screens, their artboard IDs, and what is out of scope
   - **§5.1–5.3** — the contract's shape, conventions, and every endpoint with
     its roles
   - **§5.4** — the validation rules your forms must surface (especially #3,
     which is a *warning*, not an error)
2. **`backend/src/modules/inventory/inventory-validators.ts`** + **`inventory.types.ts`**
   — the **frozen contract**. Your mock and your `frontend/types/inventory.ts`
   mirror both derive from this. Read it in full.
3. **`docs/features/inventory/04-components.md`** — the Milestone One primitive
   and composite tables (what exists, and the Paper node each was built from),
   plus its **Status** section, which records per-composite decisions you must
   not undo.
4. **`docs/features/inventory/03-design.md`** — the Paper file/page pointer.
5. **`CLAUDE.md`** — "Frontend Hook Stability Rules". Non-negotiable; read before
   writing any hook or effect.
6. **`docs/CODING_STANDARDS.md` §9–10** — frontend structure, Zustand rules,
   design-token rules.

## The six screens

Paper page **`Milestone One · Catalog, Suppliers & Restock Levels`** (`B-0`),
file `01M1ZZJ6S3FZGF5C7PPBGTKY89`. Read them via the Paper MCP —
`get_computed_styles` / `get_jsx` for values, screenshots only to verify.

| # | Screen | Desktop | Mobile |
|---|---|---|---|
| 1 | Item catalog | `SFQ-0` (route) | `TLT-0` |
| 2 | Item create/edit | `SKV-0` (drawer, **500px**) | `TLU-0` (full-screen) |
| 3 | Manage categories | `SRB-0` (drawer, **420px**) | `TLV-0` (full-screen) |
| 4 | New/edit supplier | `SX5-0` (drawer, **460px**) | `TLW-0` (full-screen) |
| 5 | Restock levels · Central Store | `T52-0` (drawer, **440px**) | `TLX-0` (full-screen) |
| 6 | Restock levels · department | — | `TD1-0` (mobile-only) |

Every screen also needs the universal states from the Session-0 shell (`15W-0` on
page `3-0`): `loading` · `empty` · `error` · `permission-denied`. These are never
redrawn per screen — use the shell pattern.

## What already exists — do not rebuild

In `frontend/components/`:

- **`ui2/`** — Sheet, Select, Toggle Group, Table, Dropdown Menu, Avatar, Search
  Input, plus Phase 0's button/input/badge/card/separator/skeleton/label/status-dot
- **`app/shell/`** — Sidebar Nav, Topbar, nav icons (cross-feature)
- **`inventory/`** (kebab-case files only) — `drawer-shell`, `item-catalog-table`,
  `item-form`, `category-manager-list`, `supplier-form`, `restock-level-grid`,
  `kpi-strip`, `item-type-icon`
- **`app/shell/`** also has `mobile-headers` and `mobile-status-bar`

> **`components/inventory/` also contains PascalCase files** — `ItemCombobox`,
> `QuantityStepper`, `QuantityInput`, `PriceTrendChart`, `Sparkline`,
> `PurchaseOrderStatusBadge`. These are **legacy**, built on the old
> `components/ui/` system for the not-yet-redone pages. Do not use them, extend
> them, or import from them. The kebab-case files are this milestone's set.

## What you are adding

1. **`frontend/types/inventory.ts`** — rewrite it to mirror the frozen contract.
   The current file describes the *old* Phase 1 shape (`PASS_THROUGH`,
   `reorderLevel`, `isActive`) and is wrong in almost every particular. Head the
   new file with a comment naming the backend file as authoritative.
2. **A mock service layer** typed to the contract, so screens run end-to-end with
   no backend. Seed the mocks from the reference data in the Paper artboards.
3. **Routes and screen chrome** — this is the real work. `04-components.md` is
   explicit that several composites deliberately don't own their surroundings:
   Save/Cancel footers, search boxes, toolbar wiring, drawer open/close state,
   form state and validation display. That is **this session's job**, not a gap
   in the component set.
4. **The six screens**, both breakpoints, all states.

## The six things most likely to go wrong

1. **Four different drawer widths — 500 / 420 / 460 / 440px.** Each was confirmed
   independently against its own Paper node during the component build
   (`04-components.md` records all four). They look like an inconsistency and are
   not. **Do not normalise them to one value.**

2. **Use the new copy tokens.** `--wds-text-copy-faint` / `--wds-text-copy-muted`
   are for **any copy a user reads** — helper text, captions, field labels, unit
   annotations. `--wds-text-faint` / `--wds-text-muted` are now **decorative-only**
   (placeholders, icon fills, inert glyphs) and fail WCAG AA as copy. Every
   existing composite was already migrated; new markup must follow the same rule.

3. **Restock levels is a bulk-save screen.** Both `T52-0` and `TD1-0` are one
   "Save restock levels" button over many edited rows — so you need dirty-state
   across rows, one submit, one `PUT`. A per-row save would misrepresent the
   screen and contradict the contract.

4. **A duplicate item name is a warning, not an error.** The save succeeds and
   returns `200` with a `warnings` array; the form shows the warning alongside a
   successful save. Do not model it as a validation failure.

5. **"Where it may exist" is conditional, and Paper draws both states.** For
   `RAW_INGREDIENT` it is a read-only display with explanatory helper text; for
   prepped/stocked it is an editable field. The Item Form composite already
   implements this — wire it, don't reimplement it.

6. **Hook stability.** Data-loading effects must not depend on unstable inline
   functions, and Zustand actions must be selected individually
   (`useStore((s) => s.action)`), never destructured. This project has had real
   refetch-loop bugs from exactly this. If you intentionally omit a dependency,
   comment why.

## Verification

Per `04-components.md`'s "Visual fidelity process":

- **Never source a value from a screenshot** — `get_computed_styles` / `get_jsx`
  supply the numbers; screenshots verify the result.
- Every raw value maps to a **design token**. A new spacing or fontSize value
  must be added to `tailwind.wds.preset.ts` in the same edit it is first used —
  and a new fontSize must also be registered in `lib/cn.ts`'s `customTextScale`.
  Both have silently dropped utilities before, with no build error.
- **Pixel-diff each screen** against its artboard at the matching width (1440
  desktop / 390 mobile): `pnpm visual-diff <paper.png> <built.png> <diff.png>`,
  threshold ≤2%. If the `export`-tool schema blocker from the component build is
  still present, fall back to the documented alternative — per-node
  `get_computed_styles` cross-checks plus a by-eye screenshot comparison — and
  say so explicitly in your report.
- **Spot-check ~768px and ~1024px**, which Paper never drew: no horizontal scroll
  on the page body, no clipped or overlapping content, tables scrolling in their
  own container, the sidebar and drawers resolving sensibly rather than sitting
  half-broken between the two designed states.
- **Use the real browser.** The `run-frontend-browser` skill covers launching the
  dev server and driving headless Chromium correctly. Check console errors as
  well as appearance — a page can render its shell while every fetch fails.

## Definition of done

- [ ] `frontend/types/inventory.ts` rewritten to mirror the frozen contract
- [ ] Mock service layer typed to the contract; screens run with no backend
- [ ] All six screens built, desktop and mobile where the table specifies
- [ ] `loading` / `empty` / `error` / `permission-denied` on every screen
- [ ] Visual-diff (or the documented fallback) passing per screen, with evidence
- [ ] 768px and 1024px spot-checked; no page-body horizontal scroll
- [ ] 0 console errors in a real browser
- [ ] `pnpm build` clean
- [ ] Use TodoWrite throughout and keep it live — the owner watches it

## Stop conditions

- **Do not touch backend code, the schema, or the migration.** A parallel session
  owns them.
- **Do not edit the frozen contract to unblock yourself.** If it is wrong — a
  field a screen needs but the contract lacks, a shape that can't render what
  Paper draws — **stop, say so, and wait for the owner to approve an amendment.**
  The backend session is building against the same file. An amendment is expected
  at least once per feature and is not a failure.
- **Do not delete the superseded inventory pages** (`app/app/inventory/*`). They
  come down in Session 5 alongside the backend's route removal, so the app stays
  runnable until then.
- **Do not rebuild an existing composite** because it looks slightly off. Check
  `04-components.md`'s Status entry for it first — several apparent
  inconsistencies (drawer widths, the desktop-vs-mobile payment-terms toggle
  styling, the amber-vs-red below-level tone, the 32px restock input) are
  documented, Paper-verified, deliberate differences.

## One known design amendment

Plan §8.2 q4: **supplier `location`** ("Nyeri town") appears on the supplier
detail header but is missing from the create/edit drawer. The owner approved
storing it and adding the field; the contract already includes it. Add it to the
drawer as part of this session, in the existing two-column row pattern, and note
it in your report so the Paper file gets updated to match.
