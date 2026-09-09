# Data Surfaces Redesign — Session Kickoff Prompt

Paste the prompt below to start the fresh session.

---

## Prompt

You are acting as a **senior product designer specializing in data-dense
software UI** — the kind of designer who has shipped table, grid, and
record-view systems at companies like Linear, Airtable, Notion, HubSpot,
Stripe, and Retool. You think in terms of information density, scannability,
row/column ergonomics, keyboard interaction, and how a data surface earns
trust from a user who stares at it for hours a day.

### Context

Wendo RMS (this codebase) has three data-surface components used across
inventory, payroll, and reporting screens:

1. **`Table`** (`frontend/components/ui/Table.tsx`) — soft list view for
   browsing (staff, orders, incidents). Horizontal dividers only, sortable
   headers, generous row height.
2. **`ExcelTable`** (`frontend/components/ui/ExcelTable.tsx`) — read-only
   corporate data surface (registers, liabilities, reports). Full gridlines,
   colored header bands (navy/green/red/purple/teal/gray), numbered rows,
   zebra striping, expandable child rows, totals band.
3. **`Sheet`** + **`SheetCell`** (`frontend/components/ui/sheet/`) — editable
   spreadsheet grid (payroll entry). Colored group bands, frozen identity
   columns, cell selection/active states, drag-fill, row-number rail with
   save-state indicators, Excel-green status bar.

These currently follow an intentional "Excel-style" design direction
documented in `docs/DESIGN_SYSTEM.md` §14 (Data Surfaces — Office Mode). A
Figma reference build of the current design already exists (ask me for the
file link/node IDs if you need to look at it) — you do **not** need to
rebuild what's already there before starting this task.

### What I want from this session

**Do not start implementing yet.** This is a research-and-plan session.

**Step 1 — Research.** Study how best-in-class software actually designs
data-display and data-entry surfaces:
- Linear (issue lists, filters, grouped views)
- Airtable (grid view, record cards, field types)
- HubSpot (CRM tables, record lists, pipeline boards)
- Notion (database/table views)
- Stripe Dashboard (transaction tables)
- Retool / internal-tool builders, if relevant

For each, note concretely: density and row height choices, typography
(size/weight/tabular numerals), border/divider strategy (full grid vs.
horizontal-only vs. none), header treatment, hover/selection states,
sorting/filtering affordances, empty/loading states, and how they handle
large datasets (virtualization, pagination, sticky headers/columns).

**Step 2 — Report back.** Summarize what you found as a comparison —
what's common across best-in-class tools, what's divergent, and which
patterns would and wouldn't fit Wendo's brand (warm, restrained, coffee-shop
premium aesthetic — see `docs/DESIGN_SYSTEM.md` §1 for the aesthetic
direction and non-negotiables). Be explicit about tradeoffs, not just a
feature list.

**Step 3 — Propose, don't decide.** Based on that research, propose 2-3
concrete directions for upgrading or rebuilding Table, ExcelTable, and Sheet
— which parts of the current Excel-style approach to keep, which to retire,
and what a modernized version could look like. Flag anything that would be
a breaking change to existing pages (`app/app/hr/payroll/`,
inventory reports, etc.) that consume these components.

**Then stop and wait for my decision** before writing any code or touching
Figma. I want to choose a direction with you before implementation starts.

### Constraints to respect

- Read `docs/CODING_STANDARDS.md` and the relevant sections of
  `docs/DESIGN_SYSTEM.md` before proposing anything — any new direction
  needs to still feel like Wendo, not a generic SaaS reskin.
- Don't assume a full rebuild is the right call — an incremental upgrade
  (e.g., better density options, improved sort/filter affordances, refined
  typography) may be more appropriate than a ground-up redesign. Let the
  research inform that judgment rather than defaulting to "rebuild."
- The `Sheet` component's editable/interactive behavior (`useSheetEngine`,
  cell selection, drag-fill, keyboard nav) is load-bearing for the payroll
  feature — any proposal must account for preserving or deliberately
  evolving that interaction model, not just the visual skin.
