# Inventory & Procurement — Reports Spec

**Feature:** Inventory & Procurement (Feature 1 of the redo)
**Purpose:** Outline **what** the inventory reports must contain, **how** they
should be structured, and **how comparable systems** handle the same problems —
*before* any visual design. Screens are designed in a dedicated **Reports pass
after all 6 roles** (this spec informs Branch Manager / Director / Accountant
reports too).
**Status:** APPROVED by the owner 2026-09-10. Scheduled email is a v1 feature
(O-RPT-2). Remaining open flags (O-RPT-1, 3, 4, 5, 6, 7) to be settled at the
start of the Reports pass.
**Date:** 2026-09-10
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
| **Scheduled email** — a report emailed on a cadence | Owner wants the weekly variance report in their inbox | ✅ **v1** (owner decision 2026-09-10) — full feature: pick report + parameters + recipients + cadence, delivered as PDF |
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

Nine reports, four categories. Each is **one screen**. The old F9 tab bar is
replaced by the **Report Library** (§3) plus these nine screens.

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

#### A3 · Negative stock incidents
- **Answers:** "Which items went below zero, where, when, and for how long —
  the data-quality signal." (Flow 21.)
- **Primary actor:** Store Manager, Branch Manager (their branch), Director.
- **Parameter bar:** period, location, resolved / unresolved.
- **Headline strip:** # incidents in period · # currently negative · longest
  time negative · most-affected item.
- **Chart:** timeline / gantt — each incident as a bar from went-negative to
  resolved.
- **Table:** location · item · went negative (date) · lowest point · resolved
  (date or "still negative") · duration · likely cause (un-logged prep /
  receiving lag / miscount — inferred from the ledger around the event).
- **Drill:** row → F5 ledger for that item × location, positioned at the event.
- **Export:** CSV.
- **Caveat:** "cause" is inferred, not asserted.
- **Comparable:** most systems bury this in an "exceptions" list; giving it a
  screen is a deliberate data-hygiene move.

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
- **Caveat (prominent, always shown):** "A department's count gap is
  **consumption + loss blended**. Wendo cannot separate sold from lost until
  automatic sale deduction exists (§3 C2). Treat trends and outliers as the
  signal, not the absolute number."
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

#### B3 · Transit & receiving discrepancies
- **Answers:** "How often does dispatched ≠ received, on which routes/branches,
  and how are they resolved?" (Flow 10a, Flow 11, Flow 20.)
- **Primary actor:** Store Manager, Branch Manager (their branch), Director.
- **Parameter bar:** period, branch, department, outcome (found / write-off /
  miscount / open).
- **Headline strip:** # discrepancies (period) · total gap value · # open ·
  avg time to resolve · worst branch/route.
- **Chart:** discrepancy count + value by branch (grouped bar).
- **Table:** date · branch · department · dispatched · confirmed · gap qty ·
  **gap value (frozen cost)** · outcome · resolved by · time to resolve.
- **Drill:** row → the C6 discrepancy resolution record.
- **Export:** CSV.
- **Caveat:** none.
- **Comparable:** transfer-variance reports in multi-site systems (Crunchtime,
  R365 "Transfer Report").

### Category C — Purchasing

#### C1 · Purchase & price trend
- **Answers:** "What have we bought, from whom, at what price — and how are unit
  prices moving?" (Flow 1, Flow 2, §6 price-change alerts.)
- **Primary actor:** Store Manager, Accountant, Director.
- **Parameter bar:** period, supplier, category, item.
- **Headline strip:** Total purchased (value) · # goods receipts · # price
  alerts fired · biggest price increase (item + %) · biggest decrease.
- **Chart:** **unit price over time** for a selected item (line), with the
  price-alert threshold band shown; default shows the item with the most
  volatility.
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

#### D1 · Dispatch shortfall / fill rate
- **Answers:** "Which branches/departments consistently don't get what they
  requisition, and is it improving?" (§3 Stage 8, Flow 9a.)
- **Primary actor:** Store Manager, Branch Manager (their branch), Director.
- **Parameter bar:** period, branch, department, category, **compare** toggle.
- **Headline strip:** Overall fill rate (dispatched ÷ requested) · vs. previous
  period · worst department · # requisitions with a shortfall · most-shorted item.
- **Chart:** **fill rate by department over time** (line). Secondary: shortfall
  value by department (bar).
- **Table:** period · branch · department · requested (qty / value) ·
  dispatched · **shortfall %** · # requisitions · most-shorted item.
- **Drill:** row → the C2 fulfilment records for that branch/department/period.
- **Export:** CSV + PDF.
- **Caveat:** none.
- **Comparable:** transfer fill-rate / order fill-rate reports (Crunchtime,
  R365).

#### D2 · Prep yield
- **Answers:** "Which prep items yield below the rolling norm, by how much, and
  which attendant / batch — the store's own performance signal." (Flow 3, 3a,
  §3 Stage 3.)
- **Primary actor:** Store Manager, Director. (Central Store only — prep is not
  a branch activity.)
- **Parameter bar:** period, output item, prepared-by.
- **Headline strip:** # runs (period) · # below-norm runs · avg yield variance ·
  worst item · estimated value of lost yield.
- **Chart:** yield vs. rolling average per run (scatter or line) for a selected
  output item.
- **Table:** date · output item · inputs (summary) · actual yield · rolling avg ·
  variance qty / % · **value of variance** · prepared by. Flag runs beyond the
  configured band.
- **Drill:** row → the D2 prep run record + F5 ledger for the output item.
- **Export:** CSV.
- **Caveat:** "rolling average is a reference, not a target — it is never
  enforced (§3 Stage 3)."
- **Comparable:** yield / production variance reports (Crunchtime "Production",
  Unleashed "Assembly").

#### D3 · Overnight variance *(branch)*
- **Answers:** "Which departments' morning opening figures don't match the
  previous night's close, and how often?" (Flow 12c.)
- **Primary actor:** Branch Manager (their branch), Director.
- **Parameter bar:** period, branch, department.
- **Headline strip:** # overnight variances (period) · total variance value ·
  worst department · # above threshold.
- **Chart:** overnight variance count by department (bar).
- **Table:** date · branch · department · item · last close · morning recount ·
  variance qty / value · flagged (above threshold). Group by department.
- **Drill:** row → the E3 next-morning opening record.
- **Export:** CSV.
- **Caveat:** none.
- **Comparable:** open/close variance (R365 "Daily Sales & Labor" analogue for
  inventory; niche — most systems fold this into stock variance).

---

## 3 · The Report Library screen

Replaces the F9 tab bar. The Reports nav item lands here.

- **Header:** "Reports" · a global period picker (sets the default period every
  report opens with) · **"Scheduled reports" link** → a management screen listing
  every schedule (report · parameters · recipients · cadence · next send · last
  sent) with add / edit / pause / delete. A schedule is also created from the
  **"Schedule" button in the report-screen shell** (§4), pre-filled with that
  report + its current parameters.
- **Body:** report cards grouped under the four category headings
  (Stock & valuation · Variance & loss · Purchasing · Operations).
- **Each card:** icon · title · one-line "what it answers" · last-run / last-
  viewed · favourite star · "Open →". Cards the role can't see are hidden
  (server-enforced, per §2 role table).
- **Favourites** pinned to a "Starred" band at the top.
- **No data on the library itself** — it is a directory. (Some products put a
  mini KPI on each card; decision: **not v1** — it doubles the query cost of a
  page that is just navigation. Flag for v1.1.)

### Role visibility (from `01-description.md` §2)

| Report | Store Manager | Store Attendant | Branch Manager | Dept Head | Accountant | Director |
|---|---|---|---|---|---|---|
| A1 Stock on hand & valuation | ✅ Central Store | — | ✅ their branch | — | ✅ all | ✅ all |
| A2 Revaluation effect | — | — | — | — | ✅ working view | summary only |
| A3 Negative stock | ✅ | — | ✅ their branch | — | read | ✅ |
| B1 Count variance | ✅ Central Store | — | ✅ their branch, per dept | — | cost view | ✅ all |
| B2 Waste analysis | ✅ Central Store | — | ✅ their branch | — | cost view | ✅ all |
| B3 Transit discrepancies | ✅ | — | ✅ their branch | — | — | ✅ |
| C1 Purchase & price trend | ✅ | — | — | — | ✅ | ✅ |
| D1 Dispatch shortfall | ✅ | — | ✅ their branch | — | — | ✅ |
| D2 Prep yield | ✅ | — | — | — | — | ✅ |
| D3 Overnight variance | — | — | ✅ their branch | — | — | ✅ |

Store Attendant and Department Head reach **no** reports — they work operational
screens, not analysis. (Consistent with the nav tables in `02-screens.md`.)

---

## 4 · The report screen shell (shared)

Every one of the nine report screens uses this shell — designed once, reused:

1. **Top bar:** breadcrumb (Reports / <report name>) · Export ▾ (CSV · PDF where
   applicable) · **Schedule** (opens a drawer: recipients · cadence — daily /
   weekly on <day> / monthly on <date> · format PDF · uses the current
   parameters, shown for confirmation) · Save view (v1.1, shown disabled).
2. **Parameter bar** (sticky under the top bar): period picker · compare toggle ·
   location/branch · department · category · grouping ▾ · "above threshold only"
   toggle where relevant. Active non-default parameters shown as removable chips.
3. **Headline strip:** 3–5 KPI cells (same visual as the hub KPI strips), recomputed
   for the current parameters; the compare toggle adds a "vs. prev" sub-line.
4. **Chart card:** one chart, sometimes with a small toggle (value/qty, or a
   series selector). Uses the design-system chart palette (espresso / caramel /
   semantic). Optional — a few reports are table-only.
5. **Data table:** the ledger-table style (`data-table`), sortable, groupable
   with sub-total rows, above-threshold rows flagged (dot + tinted row), every
   row deep-links. Sticky header. Horizontal scroll container.
6. **Caveat band** (only on B1, D2, A3): a calm info-toned strip stating the
   data limitation, always visible, not dismissible.
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
- **Type per report** (fixed choices, not a picker):
  - B1 count variance, D1 fill rate, B2 waste-by-week, D2 prep yield trend →
    **line** (one series per department / item), thin 1.5px strokes, dots only
    on hover.
  - A1 value by category × location, B3 discrepancies by branch, D3 overnight by
    department → **stacked / grouped bar**, 2px crisp radii on bar tops.
  - B2 waste by reason → **donut** with the value in the centre; segment labels
    direct, no legend.
  - A2 revaluation → **waterfall** (opening → purchases → usage → revaluation →
    closing), the revaluation bar in caramel.
  - B1 / C1 "top 10 items by |variance|" → **horizontal bar**, sorted, value
    labels at bar end.
  - A3 negative-stock incidents → **timeline / gantt**, one bar per incident,
    error-toned.
  - C1 unit price over time → **line** with the price-alert threshold shown as a
    faint horizontal band.
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

## 5 · Open flags for the owner

- **O-RPT-1 — Library vs. tabs.** Recommendation: **Report Library** (§3). It
  scales, it has room for descriptions + favourites + scheduling, it is what
  mature products do. Confirm, or keep a simpler tab bar for v1.
- **O-RPT-2 — Scheduled email.** ✅ **Resolved 2026-09-10 — in for v1, full
  feature.** Schedule drawer in the report-screen shell + a "Scheduled reports"
  management screen off the library. PDF delivery. **Saved views** stays v1.1
  (affordance designed, shown disabled).
- **O-RPT-3 — Period comparison everywhere.** Recommendation: yes, a "compare"
  toggle on every trend-bearing report (B1, B2, C1, D1). Adds query cost; worth
  it.
- **O-RPT-4 — As-of historical reconstruction (A1, A2).** These reports can be
  run for a past date by summing the ledger to that point. Confirm this is
  wanted for v1 (it is standard, but it is real query work).
- **O-RPT-5 — A2 revaluation report.** This is unusual and specific to the
  latest-price decision. Confirm the Accountant actually needs it as a screen
  vs. a line on the F8 Accountant Overview.
- **O-RPT-6 — Report count.** Nine screens is a lot to design. Could defer
  A2, A3, D2, D3 to v1.1 and ship with B1, B2, B3, C1, D1, A1 (the six that get
  looked at weekly). Confirm the v1 set.
- **O-RPT-7 — Blended-variance caveat wording.** The B1 caveat is the single
  most important sentence in this area. Owner to approve the exact wording
  before design (draft in B1 above).

---

## 6 · What happens after sign-off

1. Owner approves this spec (the report set, the library approach, the v1 vs.
   v1.1 split, the caveat wording).
2. The **Reports pass** (after all 6 roles) designs: the Report Library +
   the shared report-screen shell + one screen per report in the v1 set.
3. PDF exports for A1, A2, B1, B2, C1, D1 are designed in the **O-PRINT pass**
   alongside the other document print layouts.
