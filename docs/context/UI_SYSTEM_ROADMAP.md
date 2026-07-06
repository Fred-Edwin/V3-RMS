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
- ✅ `director/` dashboard — local branch `feat/round1-director-dashboard-exceltable`, owner-tested 2026-07-06 (late-orders modal → ExcelTable red; leaderboards stayed lists after owner revert)
- ✅ `director/branches/[branchId]` — same branch, owner-tested 2026-07-06 (no ExcelTables by owner decision; tokens + shared primitives only)
- ✅ `director/other-income` — same branch, owner-tested 2026-07-06 (Categories + Entries tables → ExcelTable gray, TabBar segmented, status.pending/espresso tokens)
- ✅ `director/settings` — same branch, owner-tested 2026-07-06 (no tables on this page — Select primitive + success/status.pending tokens only)
- ✅ `director/incidents` — same branch, owner-tested 2026-07-06 (Badge primitive replaces 8-line hex map; stays an expandable status list by design)
- ✅ Director sweep complete. `director/corporate-accounts` and `director/outstanding-balances` are re-export shims (no content of their own) — see below.
- ✅ Pulled forward ahead of order (same branch, not yet owner-tested after last change): `admin/corporate-accounts` (ExcelTable gray + Badge status pill) and `manage/outstanding-balances` (3 ExcelTables + TabBar underline + warning tokens) — these are the real pages behind Director's Credit nav links, which only appear when `NEXT_PUBLIC_CREDIT_ACCOUNTS_ENABLED=true` is set locally (Phase 7 feature flag, off by default).
- ✅ Shared primitives shipped on that branch: `TabBar` (underline/segmented), `ExportMenu`, `DateRangeBar`, `RankedItemList`, `Badge` tones, `lib/chart-colors.ts`
- 📌 **Parked idea (not started):** owner wants to merge `admin/corporate-accounts` + `manage/outstanding-balances` into one page with tabs (Corporate Accounts / Outstanding Balances-with-its-3-subtabs). Investigation found a 4th related page, `accountant/credit`, which is a separate fuller settlement workflow (not the same component) — and `manage/my-tab` is self-service for every role, confirmed out of scope for any merge. Owner said to pin this and resume the sweep; needs Plan mode + explicit re-scoping before starting given the role-gating complexity (Manager must never see the Corporate Accounts CRUD tab). Full detail in agent memory: `credit-pages-merge-pinned.md`.
- Next — Accountant: `accountant/reconciliation` (1,323 lines, 6 tables) → `accountant/analytics` (5) → credit pages
- Manager: `manage/reports` (4 tables) → remaining manage pages
- HR: attendance → leave
- Admin: `admin/order-corrections`

**Working process (owner-set, 2026-07-06):** per page — propose the table/component change list → owner approves → migrate → `pnpm build` + `pnpm test` → commit locally (NO push) → owner tests manually → corrections or approval → next page. Push + draft PR only when the owner says the batch is verified.

**Branch state as of this handoff:** `feat/round1-director-dashboard-exceltable`, all commits local (not pushed). Last commit: credit-pages ExcelTable/Badge/TabBar migration, build+test green, awaiting owner's manual verification pass.

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
