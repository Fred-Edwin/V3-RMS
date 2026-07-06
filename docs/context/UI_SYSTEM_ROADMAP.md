# UI System Roadmap — Design Tokens, Data Components & Cleanup

**Status:** Round 0 complete (PR: `feat/design-system-data-components`), Rounds 1–6 pending
**Date:** 2026-07-06
**Read with:** `docs/DESIGN_SYSTEM.md` §14 (Data Surfaces — Office Mode)

## Decisions already made (do not re-litigate)

1. **Single warm canvas** *(revised 2026-07-06 — owner reversed the hybrid canvas after seeing it live)* — **crema `#F5F0E8` is the primary page background on ALL pages**, floor and back-office alike. Do not apply `bg-office-canvas` to pages. The "office" treatment lives in the data surfaces themselves (white ExcelTable/Sheet cards with gridlines) sitting on the crema canvas. Espresso/amber stay the accent colors everywhere.
2. **Fonts follow function** — Inter (via `--font-sans`) for all operational UI; Cormorant Garamond for titles/brand moments only; numbers always Inter semibold + `tabular-nums`; Calibri stack (`font-sheet`) only inside Sheet/ExcelTable. Jost was removed after real-world review. The Tailwind `fontFamily` must reference the next/font CSS variables — never literal font names.
3. **No dark mode** — display screens stay light (owner decision).
4. **Two sanctioned table components** — `Table` (soft lists), `ExcelTable` (read-only corporate data), plus `Sheet` (editable grids). Pages must not hand-roll `<table>`.

## What Round 0 delivered

- Font pipeline fix + Inter; semantic tokens (`danger/success/warning`) + `sheet.*` token set
- `components/ui/ExcelTable.tsx` and `components/ui/sheet/` (engine + cells + chrome, 14 unit tests, gallery demos at `/dev/components` §29b/29c)
- HR payroll rewritten onto the components (reference implementation: `app/app/hr/payroll/` — `page.tsx` logic only, `sheet-config.tsx` columns); fullscreen focus mode with action bar
- `DESIGN_SYSTEM.md` §4 + §12.3 + §14 updated

## Remaining rounds (in order)

### Round 1 — Role-by-role page sweep (one page per PR)
Sweep order: **Director → Accountant → Manager → HR → Admin**. Each page gets, together in one PR:
- Hand-rolled `<table>` markup → `ExcelTable` (or `Sheet` if the grid is editable). Div-based leaderboards, rank lists and interactive status lists stay as soft lists (owner decision, 2026-07-06)
- Hardcoded hex/inline styles → tokens in every touched block
- Page canvas stays crema (see decision 1 — `bg-office-canvas` removed from the sweep)
- List planned table/component changes and get owner approval before editing each page

Floor roles (waiter, KDS/BDS) are untouched by design.

Progress:
- ✅ `director/analytics` (9 tables) — PR #27, merged 2026-07-06
- Director: `director/` dashboard → `director/branches` → branch detail pages
- Accountant: `accountant/reconciliation` (6 tables) → `accountant/analytics` (5) → credit pages
- Manager: `manage/reports` (4 tables) → remaining manage pages
- HR: attendance → leave
- Admin: `admin/order-corrections`

### Round 2 — Status system unification
Create `lib/status.ts` as the single status→tone+label map (order/ticket/leave/payroll/incident). Generalize `Badge` (tone + custom children). Delete the 10+ per-page status color maps (e.g. `hr/my-leave/page.tsx` inline ternary styles).

### Round 3 — Lint guardrails (land early, before Round 4)
- `eslint-plugin-tailwindcss` `no-arbitrary-value` as warning
- CI grep banning hex colors in `className` outside `tailwind.config.ts`/`globals.css`, with a **ratchet** (fail only on count increase per directory)
- `react/forbid-elements` for raw `<button>` in `app/**` (~80 instances; likely justifies a `Tab`/`Chip` primitive)

### Round 4 — Page-by-page hex/arbitrary-value cleanup
~1,700 hex values remain in pages. Clean in traffic order (orders flow → dashboards → HR), flip each directory's lint rule warning→error when done. Floor pages: style-only diffs, no DOM restructuring, no tap-target changes.

### Round 5 — Primitive polish
- `Table`: `aria-sort` + button semantics on sortable headers, sticky header, numeric right-align, compact density
- `focus-visible` sweep (only 6/46 ui primitives have it); `Modal` focus-restore on close
- Consolidate 14 duplicate `formatCurrency` into `lib/format.ts`
- Snap off-scale radii (`rounded-[24px]`/`[20px]`/`[14px]` in payslips pages) to tokens

### Round 6 — Structural cleanups
- Extract role-nav config from the 679-line `app/app/layout.tsx` into a config module
- Split remaining 1,000+ line pages (`admin/order-corrections` 1,383) into feature components

## Working rules for these rounds

- One round (or one Round-1 page) per session/PR — small, reviewable diffs
- Every push to `main` auto-deploys; work on branches, merge when verified
- `pnpm build` + `pnpm test` (frontend) before every push; typecheck alone is not sufficient
- KDS/BDS and order-flow surfaces: never change dimensions, tap targets, or add animation
