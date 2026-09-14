# Inventory & Procurement — Reports Spec

**Feature:** Inventory & Procurement (Feature 1 of the redo)
**Purpose:** Outline **what** the inventory reports must contain, **how** they
should be structured, and **how comparable systems** handle the same problems —
*before* any visual design. Screens are designed in a dedicated **Reports pass
after all 6 roles** (this spec informs Branch Manager / Director / Accountant
reports too).
**Status:** APPROVED by the owner 2026-09-10; **report set finalized and all
design work complete 2026-09-14** — 6 reports (not 9), no scheduled/recurring
email delivery (reports compute live on every open — see O-RPT-2 below).
**Date:** 2026-09-10, revised 2026-09-14
**Supersedes:** the single `F9 · Reports` sketch (a placeholder — it becomes
one of the report screens below, redrawn).
**Traces to:** `01-description.md` §2, §3 (Stage 8, C2), §4, §8 C3; `02-flows.md`
Flow 16, 20, 21; `02-screens.md` F8, F9.

---

## 1 · How best-in-class systems structure inventory reporting

Reasoning from what mature restaurant / hospitality / wholesale inventory
products actually do (MarketMan, Crunchtime, Restaurant365, Toast, Lightspeed
Restaurant, Marketman, Unleashed, DEAR/Cin7, xtraCHEF):

### 1.1 The pattern that has won: a **Report Library**, not a tab bar

- Small products start with a tab bar of 3–5 reports. It stops scaling around
  6 reports and gives no room for descriptions, favourites, or scheduling.
- Mature products use a **library page**: a categorised list of report cards,
  each with a title, a one-line "what it answers", the last-run date, a
  favourite star, and a "Run" / "Schedule" affordance. Categories group them
  (Stock & valuation · Variance & loss · Purchasing · Operations).
- Clicking a card opens the **report screen**: a consistent shell — title +
  description, a **parameter bar** (period, location, department, grouping),
  a **headline strip** (3–5 KPIs for the current parameters), an optional
  **chart**, the **data table** (sortable, groupable, every row deep-links to
  the source document), and **Export / Schedule / Save view** in the header.

### 1.2 Cross-cutting features every serious reporting area has

| Feature | Why | Our v1? |
|---|---|---|
| **Period picker** with presets (Today, This week, Last 7/30/90d, This month, Last month, Custom) | Every report is period-scoped | ✅ required |
| **Period comparison** ("vs. previous period" / "vs. same period last month") | Trends matter more than absolutes | ✅ required — a "compare" toggle |
| **Location / branch / department filter** | Multi-branch is the whole point | ✅ required, role-scoped |
| **Grouping / pivot** (by item, by category, by department, by supplier) | One report answers several questions | ✅ required where it makes sense |
| **Drill-down** — every row → the document behind it | A report that doesn't link to source is a dead end | ✅ required |
| **Export** — CSV always; PDF for the ones that get printed/emailed | Accountant + owner take these off-platform | ✅ CSV v1; PDF via O-PRINT |
| **Saved views** — a named set of parameters | "My Monday shrinkage check" | ▶ **v1.1** (flag) — design the affordance, wire later |
| **Scheduled email** | — | ❌ **not built, ever — reversed 2026-09-14.** Reports are computed live from the database on every open, "on demand." There is no cron/recurring-delivery concept anywhere in this product. Do not reintroduce a Schedule button or a scheduled-reports management screen. |
| **Threshold / exception highlighting** — rows over a configured limit flagged | Draws the eye to what matters | ✅ required (already in §8 C3) |
| **"Blended" honesty note** — where a number can't be trusted, say so | §3 C2: count gap = consumption + loss until sale deduction exists | ✅ required — a standing caveat on affected reports |

### 1.3 The framing that matters most: **variance / shrinkage as the hero**

Every mature food-inventory product treats the **theoretical vs. actual**
comparison as the centrepiece:

- **Theoretical usage** = what *should* have been consumed (from recipes / pars /
  dispatch). **Actual usage** = what the count says was consumed. The gap is
  **variance** — the single most-watched number in the category, because it is
  the proxy for over-portioning, waste, and theft.
- Wendo cannot compute true theoretical usage yet (no recipe-level sale
  deduction — §3 C2). **So our variance reports must be explicit**: the count
  gap is *consumption + loss blended*. We report the gap honestly and flag it,
  we do not pretend it is pure shrinkage. This is the single most important
  design constraint on this whole area — the report must not imply a precision
  the data doesn't have.

### 1.4 What we deliberately do NOT build in v1

- No recipe-level theoretical usage / plate-cost variance (needs POS integration
  — §3 C2, deferred).
- No forecasting / par-level suggestions / auto-ordering.
- No supplier scorecards beyond price trend + fill.
- No custom report builder — a fixed set, well-designed, beats a builder nobody
  uses.

---

## 2 · The report set

**Six reports, four categories** (reduced from an original nine — A3 Negative
Stock Incidents, B3 Transit & Receiving Discrepancies, D1 Dispatch Shortfall/
Fill Rate, and D3 Overnight Variance were cut by owner decision 2026-09-14;
their spec entries are removed below rather than kept as dead documentation).
Each is **one screen**. The old F9 tab bar is replaced by the **Report
Library** (§3) plus these six screens.

### Category A — Stock & valuation

#### A1 · Stock on hand & valuation
- **Answers:** "What stock do we hold right now, and what is it worth — per
  location, per category?"
- **Primary actor:** Store Manager (Central Store), Branch Manager (their
  branch), Accountant + Director (all).
- **Parameter bar:** as-of date (default now; can be a past date — reconstructs
  from the ledger), location, category, item-type.
- **Headline strip:** Total on-hand value · # items tracked · # below par ·
  # negative · value of negative stock.
- **Chart:** stacked bar — value by category, per location (or a treemap if the
  category count is high). Toggle: value vs. quantity.
- **Table:** location · category · item · type · on-hand qty · usage unit ·
  current cost · **value** · par · flag (low / negative). Group by category
  with sub-totals; group by location with sub-totals.
- **Drill:** row → F5 stock ledger drill (item × location).
- **Export:** CSV + PDF (this is a month-end document).
- **Caveat:** none — this is a hard, derived number.
- **Comparable:** Unleashed "Stock on Hand", MarketMan "Inventory Value",
  R365 "Inventory Valuation".

#### A2 · Latest-price revaluation effect *(Accountant-focused)*
- **Answers:** "How much has latest-price costing moved our stock value versus
  what we actually paid — the figure that would distort month-end if not shown?"
  (§2 Accountant, §4 known trade-off.)
- **Primary actor:** Accountant (working view); Director (summary only).
- **Parameter bar:** period, location.
- **Headline strip:** Closing stock value (latest-price) · Closing stock value
  (at actual purchase cost) · **Revaluation delta** · as a % of stock value.
- **Chart:** waterfall — opening value → purchases → usage → **revaluation
  adjustment** → closing value.
- **Table:** item · qty on hand · latest cost · weighted actual cost · value
  (latest) · value (actual) · **revaluation delta**. Sorted by |delta|.
- **Drill:** row → F5 ledger for that item.
- **Export:** CSV + PDF.
- **Caveat:** none — but the report's whole job is to make the trade-off visible.
- **Comparable:** this is a Wendo-specific report driven by the latest-price
  decision; closest analogue is a "FIFO vs. weighted-average variance" note in
  accounting-grade systems (Cin7, DEAR).

~~A3 · Negative stock incidents~~ — **CUT, owner decision 2026-09-14.** Not
built. Was: a data-quality report on items that went below zero on-hand.

### Category B — Variance & loss (the hero category)

#### B1 · Count variance *(the shrinkage report)*
- **Answers:** "Where is stock disappearing between counts — which
  location/department/item, how much, trending which way?"
- **Primary actor:** Store Manager (Central Store), Branch Manager (their
  branch, per department), Director (all).
- **Parameter bar:** period, location, department, category, **compare to
  previous period** toggle, "above threshold only" toggle.
- **Headline strip:** Total variance value (period) · vs. previous period (Δ%) ·
  # count events · # above threshold · worst department.
- **Chart:**
  - primary: **variance value by department over time** (line, one series per
    department) — the trend read.
  - secondary (on a "by item" grouping): horizontal bar, top 10 items by
    |variance value|.
- **Table:** date · location · department · item · counted · expected · variance
  qty · **variance value** · reason (if logged) · signed by. Group by
  department, by item, or by count event. Above-threshold rows flagged.
- **Drill:** row → the D4 / E2 count verification document.
- **Export:** CSV + PDF (owner wants this weekly).
- **Caveat: NONE — reversed 2026-09-14 (O-RPT-7 resolved).** The original
  spec called for a "consumption + loss blended" caveat here. Owner decision:
  automatic sale deduction is expected to ship before this report goes live,
  so by build time the count gap is trustworthy shrinkage/loss data — the
  caveat would be a false disclaimer at launch. Designed treating the gap as
  real loss: no hedge language, KPI/table copy says "variance value" plainly.
  **If automatic deduction slips past this feature's ship date, this decision
  must be revisited before launch** — the original caveat wording is
  preserved above in this file's git history if still needed.
- **Comparable:** MarketMan "Variance Report", Crunchtime "Theoretical vs
  Actual", R365 "Waste & Variance" — but all of those *do* have theoretical
  usage; ours is explicitly the blended version and says so.

#### B2 · Waste analysis
- **Answers:** "What are we throwing away, why, where, and what does it cost —
  is it getting better or worse?" (Flow 6, Flow 13.)
- **Primary actor:** Store Manager (Central Store), Branch Manager (their
  branch), Director (all).
- **Parameter bar:** period, location, department, category, reason, **compare**
  toggle.
- **Headline strip:** Total waste value (period) · vs. previous period (Δ%) ·
  waste as % of stock value · top reason · top item.
- **Chart:**
  - **waste value by reason** (donut or stacked bar) — spoilage / expiry /
    damage-in-store / prep error / other.
  - **waste value by week** (bar) with the compare period overlaid.
- **Table:** date · location · department · item · qty · reason · **value** ·
  logged by · linked receipt (if a supplier claim). Group by reason, item, or
  department.
- **Drill:** row → the waste ledger entry; supplier-claim rows → the linked
  goods receipt.
- **Export:** CSV + PDF.
- **Caveat:** none — waste is directly logged.
- **Comparable:** every product has this; MarketMan "Waste Log Report",
  Lightspeed "Wastage".

~~B3 · Transit & receiving discrepancies~~ — **CUT, owner decision
2026-09-14.** Not built. Was: dispatched-vs-received gap tracking by branch.

### Category C — Purchasing

#### C1 · Purchase & price trend
- **Answers:** "What have we bought, from whom, at what price — and how are unit
  prices moving?" (Flow 1, Flow 2, §6 price-change alerts.)
- **Primary actor:** Store Manager, Accountant, Director. **Domain
  correction 2026-09-14: only Central Store purchases anything — branches
  never buy, they only receive dispatches from Central Store (D-15 hub
  scoping).** This means there is no per-branch breakdown possible for this
  report, and all three roles see identical content (Accountant/Director are
  sidebar-only clones of the Store Manager screen, not independently scoped
  data) — there is only one source of purchase data in the whole product.
- **Parameter bar:** period, supplier, category, item.
- **Headline strip:** Total purchased (value) · # goods receipts · # price
  alerts fired · biggest price increase (item + %) · biggest decrease.
- **Chart — CHANGED 2026-09-14 from the original spec below:** total
  purchase value by month (simple single-series bar, one bar per month
  within the selected period, no breakdown). The original per-item unit-price
  line chart (kept for reference) was rejected as too narrow — a single
  item's price doesn't answer "are we spending more, and is it trending" the
  way a KPMG/McKinsey-register report should; per-item price movement is
  still fully covered by the table's Unit Price / vs. Previous / Price Alert
  columns, just not charted.
  - ~~Original: unit price over time for a selected item (line), with the
    price-alert threshold band shown; default shows the item with the most
    volatility.~~
- **Table:** date · supplier · item · qty · unit price · vs. previous price
  (Δ%) · price-alert flag · GRN. Group by supplier or item.
- **Drill:** row → the A7 goods receipt.
- **Export:** CSV + PDF.
- **Caveat:** none.
- **Comparable:** MarketMan "Price Tracker", xtraCHEF "Price Fluctuation",
  Unleashed "Purchase Price Variance".

#### C2 · Supplier aging & AP *(already exists on A2 Suppliers/AP landing)*
- **Not a separate report screen.** Aging *is* the AP position of the Suppliers
  list (owner decision 2026-09-10, folded A11 into A2). The Report Library links
  to A2 rather than duplicating it.
- Listed here only so the library feels complete and the Accountant/Director
  find it where they expect.

### Category D — Operations

~~D1 · Dispatch shortfall / fill rate~~ — **CUT, owner decision 2026-09-14.**
Not built. Was: fill-rate tracking for branch requisitions.

#### D2 · Prep yield
- **Answers:** "Which prep items yield below the rolling norm, by how much, and
  which attendant / batch — the store's own performance signal." (Flow 3, 3a,
  §3 Stage 3.)
- **Primary actor:** Store Manager, Director. (Central Store only — prep is not
  a branch activity.)
- **Parameter bar:** period, output item, prepared-by.
- **Headline strip:** # runs (period) · # below-norm runs · avg yield variance ·
  worst item · estimated value of lost yield.
- **Chart: NONE — decided 2026-09-14.** The spec originally called for a
  scatter/line of yield vs. rolling average. Dropped: with likely low prep-run
  volume (a handful per week), a chart would just restate what a 5–10-row
  table already shows — the shell's own allowance for table-only reports (§4)
  applies here. KPI strip + table + caveat band carry the full report.
- **Table:** date · output item · inputs (summary) · actual yield · rolling avg ·
  variance qty / % · **value of variance** · prepared by. Flag runs beyond the
  configured band.
- **Drill:** row → the D2 prep run record + F5 ledger for the output item.
- **Export:** CSV.
- **Caveat:** "rolling average is a reference, not a target — it is never
  enforced (§3 Stage 3)." **This caveat stays** (unlike B1's, which was
  removed) — it's about how the number should be used, not a data-trust
  problem a future feature will fix, so it doesn't go stale the way B1's did.
- **Comparable:** yield / production variance reports (Crunchtime "Production",
  Unleashed "Assembly").

~~D3 · Overnight variance~~ — **CUT, owner decision 2026-09-14.** Not built.
Was: morning-count-vs-last-night's-close tracking by branch/department.

---

## 3 · The Report Library screen

Replaces the F9 tab bar. The Reports nav item lands here.

- **Header:** "Reports" · a global period picker (sets the default period every
  report opens with). **No "Scheduled reports" link — removed 2026-09-14.**
  There is no report-scheduling feature in this product; every report
  recomputes live from the database on open.
- **Body:** report cards grouped under the four category headings
  (Stock & valuation · Variance & loss · Purchasing · Operations).
- **Each card:** icon · title · one-line "what it answers" · last-run / last-
  viewed · favourite star · "Open →". Cards the role can't see are hidden
  (server-enforced, per §2 role table).
- **Favourites** pinned to a "Starred" band at the top.
- **No data on the library itself** — it is a directory. (Some products put a
  mini KPI on each card; decision: **not v1** — it doubles the query cost of a
  page that is just navigation. Flag for v1.1.)

### Role visibility (final 6-report set, as built 2026-09-14)

| Report | Store Manager | Store Attendant | Branch Manager | Dept Head | Accountant | Director |
|---|---|---|---|---|---|---|
| A1 Stock on hand & valuation | ✅ Central Store | — | ✅ their branch | — | ✅ all | ✅ all |
| A2 Revaluation effect | — | — | — | — | ✅ full | ✅ full (identical to Accountant, not summary-only — owner decision 2026-09-14) |
| B1 Count variance | ✅ Central Store, by category | — | ✅ their branch, per dept | — | — | ✅ all locations |
| B2 Waste analysis | ✅ Central Store, by category | — | ✅ their branch, by dept | — | — | ✅ all locations |
| C1 Purchase & price trend | ✅ | — | — | — | ✅ (identical content) | ✅ (identical content) |
| D2 Prep yield | ✅ | — | — | — | — | ✅ (identical content) |

Store Attendant and Department Head reach **no** reports — they work operational
screens, not analysis. (Consistent with the nav tables in `02-screens.md`.)

---

## 4 · The report screen shell (shared)

Every one of the six report screens uses this shell — designed once, reused:

1. **Top bar:** breadcrumb (Reports / <report name>) · **Export only** (CSV ·
   PDF where applicable). **No Schedule button — removed 2026-09-14, there is
   no report-scheduling feature in this product.** Save view (v1.1, shown
   disabled).
2. **Parameter bar** (sticky under the top bar): period picker · compare toggle ·
   location/branch · department · category · grouping ▾ · "above threshold only"
   toggle where relevant. Active non-default parameters shown as removable chips.
3. **Headline strip:** 3–5 KPI cells (same visual as the hub KPI strips), recomputed
   for the current parameters; the compare toggle adds a "vs. prev" sub-line.
4. **Chart card:** one chart, sometimes with a small toggle (value/qty, or a
   series selector). Uses the design-system chart palette (espresso / caramel /
   semantic). Optional — table-only reports (D2 Prep Yield) skip it entirely.
5. **Data table:** the ledger-table style (`data-table`), sortable, groupable
   with sub-total rows, above-threshold rows flagged (dot + tinted row), every
   row deep-links. Sticky header. Horizontal scroll container.
6. **Caveat band** (only on D2 — B1's was removed 2026-09-14, see above): a
   calm info-toned strip stating the data limitation, always visible, not
   dismissible.
7. **Empty / loading / error** → the universal `15W-0` shells.

### 4.1 · Chart standard (owner wants these visually premium)

All report charts must read as **one system** and feel considered, not
auto-generated. Load the project `dataviz` skill before designing any of them.

- **Palette:** the design-system tokens only — espresso `#693C1B` as the primary
  series, caramel `#D9A65E` as the secondary, the semantic tones
  (`--color-warning-fg` / `--color-error-fg` / `--color-success-fg`) for
  threshold / over / under. **No rainbow.** One strong colour moment per chart;
  everything else muted.
- **Compare series:** the current period is the solid espresso series; the
  compare period (`vs. prev`) is a thin muted "ghost" line/bar behind it, never
  competing for attention.
- **Type per report, as actually built 2026-09-14** (the bullets below
  supersede the original picks above where they differ — several were
  changed after owner review):
  - A1 Stock on Hand & Valuation → value by location (horizontal bar) +
    value by category (treemap-style blocks), side by side.
  - A2 Revaluation Effect → **ranked horizontal bar**, top 10 items by
    |revaluation delta| — NOT the waterfall originally specced; the
    waterfall was built, reviewed on-screen, and explicitly rejected by the
    owner as not premium enough and less useful than a ranked driver list.
    Use the ranked-bar pattern (thin bars, mono value labels, single blue
    ramp, quiet neutral track) wherever a report's story is "which items are
    the problem," not a flow/waterfall.
  - B1 Count Variance → two charts: a **line**, one series per department/
    category/location (role-dependent — see §2 B1), for the trend read; plus
    a **ranked horizontal bar**, top items by |variance value|, same pattern
    as A2.
  - B2 Waste Analysis → two charts: a **donut** for value-by-reason
    (Spoilage/Expiry/Damage/Prep error/Other, single blue ramp — not 4
    competing hues) + a **grouped bar**, this-period vs. last-period, by week.
  - C1 Purchase & Price Trend → **single-series bar**, one bar per month,
    total purchase value — NOT a per-item unit-price line as originally
    specced (see the C1 entry above for why that was changed). Bars grouped
    and centered as one visual unit with deliberate gaps, not stretched to
    fill the card width at only 2–3 data points.
  - D2 Prep Yield → **no chart** (see D2 entry above).
  - Every ranked-bar and bar-chart hue is drawn from the single validated
    blue ramp (`#0D366B` → `#1C5CAB` → `#5598E7` → `#9EC5F4`, darkest =
    largest/primary), plus `#E34948`/`#97281D` reserved strictly for a
    genuine problem number, never a neutral one. This is now the standing
    chart palette for the whole Inventory feature — see
    `docs/DESIGN_SYSTEM.md` for the formal token entry.
- **Craft rules:** generous padding; hairline gridlines (`--color-border`, and
  only horizontal); axis numerals + currency in Geist Mono; **direct labels over
  legends** wherever the series count allows; no 3D, no drop shadows, no
  gradients on data marks; a chart is never the only thing on the screen — it
  sits above the table it summarises.
- **Interaction:** hover a point/bar → a small tooltip (item, exact value,
  period); click a mark → same drill-down as the corresponding table row.
- **Theme:** charts must hold up in light and dark (the design system is
  theme-aware); define chart colours as tokens, not literals.
- **Empty chart:** a calm "no data for these parameters" state inside the chart
  card, not a broken axis.

---

## 5 · Flags — all resolved 2026-09-14

- **O-RPT-1 — Library vs. tabs.** ✅ **Resolved — Report Library**, Option A
  editorial index (left category rail + compact right-hand list). Built and
  approved on the `F1 Inventory · Reports & Documents` Paper page.
- **O-RPT-2 — Scheduled email.** ✅ **Resolved — REVERSED from the 2026-09-10
  decision. Not built, ever.** The owner clarified reports are computed live
  from the database on every open ("on demand"), not scheduled. No Schedule
  button, no scheduled-reports management screen, no cron/recurring-delivery
  concept anywhere in this product. **Saved views** stays v1.1 (unbuilt).
- **O-RPT-3 — Period comparison everywhere.** ✅ **Resolved — yes.** A
  "compare" toggle is on every trend-bearing report (B1, B2; C1 and D2 don't
  carry one, their content doesn't call for it).
- **O-RPT-4 — As-of historical reconstruction (A1, A2).** ✅ **Resolved —
  yes**, both reports carry an as-of/period picker that can target a past
  point.
- **O-RPT-5 — A2 revaluation report.** ✅ **Resolved — yes, it's a full
  screen**, not folded into the Overview. Built with identical content for
  Accountant and Director (no summary-only variant — owner explicitly
  rejected simplifying the Director view).
- **O-RPT-6 — Report count.** ✅ **Resolved — 6 reports, not 9.** A3, B3, D1,
  D3 cut entirely (not deferred to v1.1 — removed from scope). Final set:
  A1 Stock on Hand & Valuation, A2 Revaluation Effect, B1 Count Variance,
  B2 Waste Analysis, C1 Purchase & Price Trend, D2 Prep Yield.
- **O-RPT-7 — Blended-variance caveat wording.** ✅ **Resolved — caveat
  removed from B1 entirely**, not just reworded. See the B1 entry above:
  automatic sale deduction is expected before this report ships, so the
  count gap will be trustworthy loss data by launch, making the caveat a
  false disclaimer if kept. D2's caveat (rolling average is a reference, not
  a target) stays — it's a usage note, not a data-trust caveat, so it
  doesn't have the same staleness risk.

---

## 6 · Status — design complete

1. ✅ Owner approved this spec (2026-09-10), then approved the report-set
   reduction, chart changes, and no-scheduling decision (2026-09-14).
2. ✅ The **Reports pass** designed: the Report Library + the shared
   report-screen shell + one screen per report in the final 6-report set,
   with role-scoped clones where content actually differs by role.
3. PDF exports for A1, A2, B1, B2, C1 were designed in the **O-PRINT pass**
   alongside the other document print layouts (D2 is CSV-only, no PDF).
4. **This closes O-REPORTS.** The whole Inventory & Procurement Feature 1
   design (all 6 roles + O-PRINT + O-REPORTS) is now complete — see
   `HANDOFF-role-complete-design.md` for the handoff to the build/engineering
   stage.
