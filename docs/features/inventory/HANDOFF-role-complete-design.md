# HANDOFF — Inventory & Procurement redo · Step 3 design · DESIGN COMPLETE

**The entire Inventory & Procurement (Feature 1) design is DONE as of
2026-09-14.** This file is kept as the historical record of how the
role-complete pass was run — read it for context on *why* screens look the
way they do, not as a task list. The next stage is
`docs/FEATURE_REDO_PLAYBOOK.md`'s build/engineering step (Step 4+), not
further design work, unless the owner opens a specific revision.

═══════════════════════════════════════════════════════════════════════
WHERE THINGS STAND — ALL DESIGN WORK COMPLETE (2026-09-14)
═══════════════════════════════════════════════════════════════════════

All 6 roles done: 1 Store Manager, 2 Store Attendant, 3 Branch Manager,
4 Department Head, 5 Accountant, 6 Director. **O-PRINT is complete**
(5 signed print documents). **O-REPORTS is complete**: Report Library +
all 6 final reports (Stock on Hand & Valuation, Latest-Price Revaluation
Effect, Count Variance, Waste Analysis, Purchase & Price Trend, Prep
Yield), each with every role-scoped view it needs. `02-reports-spec.md`
and `docs/DESIGN_SYSTEM.md` are updated to match final scope. **This is
the end of the Inventory & Procurement Feature 1 design pass.**

**Report scope cut down 2026-09-14 (owner decision, second cut this
session) — the report set is now final at 6 reports, not 9:**
- A1 Stock on Hand & Valuation — done
- A2 Latest-Price Revaluation Effect — done
- B1 Count Variance — done (all 3 role-scoped views)
- ~~A3 Negative Stock Incidents~~ — **CUT** (see above, first cut)
- B2 Waste Analysis — done (all 3 role-scoped views)
- ~~B3 Transit & Receiving Discrepancies~~ — **CUT 2026-09-14.** Owner
  decision: not needed as a standalone report. Remove from
  `02-reports-spec.md` §2 Category B and the Report Library row list.
- **C1 Purchase & Price Trend — remaining to build** (Store Manager,
  Accountant, Director).
- ~~D1 Dispatch Shortfall / Fill Rate~~ — **CUT 2026-09-14.** Remove from
  spec §2 Category D and the Report Library.
- **D2 Prep Yield — remaining to build** (Store Manager, Director only —
  not branch-scoped, so this is NOT a 3-way BM/SM/Director clone set like
  B1/B2, just Store Manager + Director, likely a much simpler 2-clone job
  or even a single shared view with a location picker for Director).
- ~~D3 Overnight Variance~~ — **CUT 2026-09-14.** Remove from spec §2
  Category D and the Report Library.

**O-REPORTS-SCHED — RESOLVED 2026-09-14, reversing the earlier "owner
wants this weekly" framing: there is NO scheduled/recurring email delivery
feature in this product at all.** The owner clarified reports are computed
live from the database on every open — "on demand," not scheduled — and
does not want the concept of report scheduling to exist anywhere in the
design. **This reverses prior decisions in this same file** that assumed
a Schedule button + scheduled-reports management screen:
- Remove the **Schedule** button from the Count Variance topbar (all 3
  role clones) and the Waste Analysis topbar (all 3 role clones) — Export
  only, matching Stock on Hand & Valuation and Revaluation Effect's
  topbar pattern (those two never had a Schedule button and were correct
  all along).
- **Do NOT build the "Scheduled reports" management screen** referenced
  in `02-reports-spec.md` §3 and this file's earlier checklist — it does
  not exist in this product.
- Remove the "N scheduled · next <day> <time>" pill from the Report
  Library header (`OSX-0`) if it was built — check and remove.
- When touching `02-reports-spec.md` for the report-set cuts above, also
  strip every "Schedule" / scheduled-email reference from §3, §4, and each
  remaining report's own spec entry (C1, D2).

**C1 Purchase & Price Trend — DONE, all 3 roles** (Store Manager,
Accountant, Director — artboards on page `A-0`). Key domain correction
this session: **only Central Store purchases anything — branches never
buy, they only receive dispatches from Central Store** (same D-15 hub
scoping rule as everywhere else in this feature). This means there is
**no per-branch breakdown possible for this report at all** — an earlier
in-session direction (chart by branch, then by category) was wrong for
that reason and was corrected. The three role views are **content-identical**
(same chart, same KPIs, same table) — Accountant and Director are sidebar
+ breadcrumb swaps of the Store Manager screen, not independently scoped
data, because there is only one source of purchase data in the whole
product. Chart: single-series bar, one bar per month, thin bars grouped
and centered in the card with deliberate gaps (NOT stretched full-width
with `flex:1` per column — that reads as sparse/awkward at only 3 data
points; group the bars as one visual unit and center them, sizing gaps
deliberately rather than letting a wide container dictate spacing).
Floating bold-mono total per bar, red delta annotation on the latest
month. KPIs: Total Purchased, Goods Receipts, Price Alerts Fired (red),
Biggest Increase (red), Biggest Decrease (green — a price drop is good
news, don't reflexively color it as a problem). Table: Date, Supplier,
Item, Qty, Unit Price, vs. Previous (sortable, red only on the row that
triggered an alert), Price Alert, GRN.

**Reports set final scope — 6 reports, ALL DONE:** Stock on Hand &
Valuation, Latest-Price Revaluation Effect, Count Variance (3 roles),
Waste Analysis (3 roles), Purchase & Price Trend (3 roles), Prep Yield
(2 roles: Store Manager + Director, no chart — see below). **O-REPORTS
design work is complete.**

**D2 Prep Yield — DONE, 2 roles (Store Manager, Director — not
branch-scoped, prep only happens at Central Store).** Deliberately
**no chart** — with likely low run volume (a handful of prep runs per
week), a chart would just restate what the table already shows in 5-10
rows; the shell's own spec allows table-only reports, use that instead of
forcing a chart in for its own sake. KPI strip: Prep Runs · Below Norm
(red) · Avg Yield Variance (red) · Worst Item (sans, not mono — it's a
name) · Value of Lost Yield (red). **Caveat band included** (this report
keeps its caveat, unlike Count Variance — the rolling-average-not-a-target
caveat is about how the number should be *used*, not about data
trustworthiness, so it doesn't have the same "will be resolved by a future
feature" problem that got Count Variance's caveat cut) — info-toned per
`--color-info-*` tokens, not the red/error tones. Table: Date, Output Item,
Inputs, Actual Yield, Rolling Avg, Variance (sortable), Value of Variance,
Prepared By. Director is a straight sidebar+breadcrumb clone of Store
Manager (same content, no other purchasing/prep data exists to scope by,
same reasoning as Purchase & Price Trend).

**Gotcha this session:** when cloning a report to a new role, editing text
by re-using a node ID from the *source* artboard (not the newly-created
clone's mapped ID) silently edits the wrong artboard. Always read the
`duplicate_nodes` result's `descendantIdMap` and use the **mapped
(new)** ID for every subsequent edit on the clone — caught and fixed once
this session (Director breadcrumb briefly edited on the Store Manager
artboard instead of its own clone).

**O-REPORTS design work is now fully complete — all 6 reports, all role
views, done and reviewed.** Remaining before the whole Inventory &
Procurement Feature 1 design can be declared done: settle open O-RPT spec
flags (§5), add the validated chart palette to `docs/DESIGN_SYSTEM.md`,
update `02-reports-spec.md` to match the final 6-report scope (remove A3,
B3, D1, D3 and every "Schedule" / scheduled-email reference — there is no
report scheduling feature in this product, reports compute live on every
open), final handoff update declaring the whole feature done.

**Housekeeping note:** this file, `01-description.md`, `02-flows.md`,
`02-reports-spec.md`, `02-screens-by-role.md`, `02-screens.md`, and
`docs/DESIGN_SYSTEM.md`'s sidebar-token update were recovered on 2026-09-14
from `origin/backup/uncommitted-2026-09-12` (an OS-crash safety-net branch)
and restored to the working tree as **uncommitted** files. Commit them (or
confirm they're already committed) before doing anything else — don't lose
them a second time.

## O-PRINT — COMPLETE (2026-09-14)

New Paper page: **`F1 Inventory · Reports & Documents`** (pageId `A-0`) —
cross-cutting, not filed under any one role's page. All print layouts use a
**shared PDF shell** artboard (`PDF Shell · A4 portrait · reference`, 794×1123,
true A4): logo-free letterhead (large Times New Roman wordmark + thin rule
in place of a logo), two-party info block, itemized table zone, signature
block, footer. **Print typography is Times New Roman throughout** — deliberately
different from the app's Geist/Geist Mono, per owner direction ("professional
documents" register). Colors: black/gray text hierarchy + one navy accent
(`#1F3A5F`) for status/total emphasis — no espresso/caramel brand color on
these documents. Signatures use `'Alex Brush', cursive` **set as a literal
font-family string on every signature node, never `var(--font-signature)`** —
Paper does not resolve that CSS var reliably after duplication; this bit us
once already, don't reintroduce it.

Five documents designed, each in both a routine and an exception state:
- **Requisition** — Approved / Returned (`O5H-0` / `O7N-0`)
- **Delivery Note** — Received clean / Received with discrepancy (`OC2-0` / `O9S-0`)
- **Day-Close** — Closed / Reopened (`OE0-0` / `OGG-0`)
- **Discrepancy Resolution** — Resolved (`OI0-0`) — single-signatory document
  ("Resolved and signed by"), paired with a Ledger info panel instead of a
  second signature; uses a 4-stat "The Gap" row (Dispatched/Confirmed/Gap/Value)
  instead of a line-item table
- **Count Verification** — Verified clean / Variance flagged (`ONU-0` / `OKU-0`)
  — two-signatory (Counted by / Verified and signed by)

A status stamp/rubber-stamp graphic device was **deliberately rejected** —
the signature block already carries who/when/capacity; a stamp would be
decorative duplication. Exception states (Returned, Reopened, Discrepancy,
Variance) are communicated via a plain STATUS field (navy, bold, uppercase),
not a stamp.

Domain corrections made this pass — **do not re-introduce these errors**:
- Requisitions are approved by the **Branch Manager**, not the Store Manager.
  The Store Manager's role is fulfilling/dispatching (Delivery Note), a
  separate downstream step against an already-approved requisition.
- The print shell must render at true A4 height (1123px) — don't leave it at
  `height: fit-content` as a leftover from removing dead space; adjust content
  instead of the page height.

## O-REPORTS — IN PROGRESS (started 2026-09-14)

Same Paper page (`A-0`). Governing doc: `docs/features/inventory/02-reports-spec.md`
(owner-approved 2026-09-10) — **read it in full before designing another report**,
but the following owner decisions from this session **override/refine** what's
written there where they differ:

**Report Library (the "Reports" landing/directory screen) — DONE.**
Artboard `Report Library · Option A — Editorial index` (renamed on the
`A-0` page, was duplicated off the Store Manager page — moved to `A-0`,
don't repeat that placement mistake). Three directions were built and
compared (dense editorial index / refined minimal cards / single index no
rail) — **owner picked Option A**, the editorial index: left category rail +
compact right-hand list, one row per report (title, one-line description,
a live preview value, last-run timestamp), grouped under 4 category headers
(Stock & valuation · Variance & loss · Purchasing · Operations). This
**replaces** the spec's card-grid description in §3 — treat "Option A" as
the actual approved layout, the spec's card language is superseded.

Enrichments added beyond the spec (owner-requested, "make it more than a
list"):
- **Summary band** — 4 KPI cells above the list (Stock Value, Variance This
  Week, Waste This Week, Open Discrepancies). Only the KPI that's a genuine
  problem gets color (Variance This Week is red); the rest stay ink — see
  color rule below.
- **"Needs attention" strip** — 2-3 lines surfacing real flagged items across
  reports, styled as a **left-edge 3px red rule + bold label**, NOT a bordered/
  filled banner box. A boxed amber-background version was tried and explicitly
  rejected by the owner as "breaking the visual balance" — don't reintroduce
  a filled-box treatment here.
- **Per-row preview values** — every report row shows its own current headline
  figure (e.g. Count Variance row shows "−KES 1,240"), right-aligned above the
  timestamp. Color follows the same rule as the KPI strip (below).
- **Scheduled-reports pill** — top-right of the header, "N scheduled · next
  <day> <time>", opens/links to the schedule management screen (not yet
  designed).
- **Favorites/star was explicitly rejected and removed** — owner's reasoning:
  it's a personal-shortcut bookmark, not a real status signal, not worth the
  visual weight. Do not add a star/favorite affordance back into the library
  or any report screen unless the owner asks again.

**Color rule (owner-set this session, applies to every report and the
library — the single most important standing instruction for this pass):**
"One accent color, used with intent" — most numbers/text stay black/ink.
Color (red for a problem, or the report's chart accent) is reserved **only**
for the one genuinely actionable/headline figure per context — never
decorate multiple KPIs or table cells with different colors just because
data is present. If unsure whether a number deserves color, default to ink.

**Chart color palette — validated, not eyeballed.** The product's brand
colors (espresso `#693C1B`, caramel `#D9A65E`) **fail the accessibility
validator as chart marks** (too low-chroma, reads as gray) — confirmed via
`scripts/validate_palette.js` in the bundled `dataviz` skill. Charts use a
**separate, validated palette**, authorized by the owner as a new addition to
the design system (not yet formally added to `docs/DESIGN_SYSTEM.md` — do
that as part of finishing O-REPORTS). Load the `dataviz` skill before
designing any chart, and validate any new hue combination with
`node scripts/validate_palette.js "<hex,hex,...>" --mode light` before using
it — don't eyeball. Decisions locked this session:
- Primary chart hue: blue ramp (`#0d366b` → `#1c5cab` → `#5598e7` → `#9ec5f4`,
  darkest = largest/primary). Used for both the "value by location" bar chart
  and the "value by category" treemap on the Stock on Hand & Valuation report
  — **owner explicitly chose to unify both charts in the same blue family**
  rather than give each chart its own hue (teal and amber variants were
  designed and compared, then rejected in favor of blue-only). Reuse this
  same blue ramp as the default chart hue for the remaining reports unless a
  report's own story genuinely needs a second series (e.g., a real
  current-vs-compare-period pair) — see marks-and-anatomy.md for how to add
  a second hue without breaking the "one accent" rule.
- Red `#e34948` reserved strictly for genuine problems (negative stock, open
  discrepancies, below-norm variance) — never for a neutral/informational
  number.
- Stacked bar charts with 4 flat competing hues were **explicitly rejected**
  ("ugly", "absolutely not") — don't build one. Prefer a treemap for
  composition/breakdown questions, simple monochrome-ramp horizontal bars for
  ranked comparisons.

**A2 · Latest-Price Revaluation Effect — DONE** (artboard `Report ·
Latest-Price Revaluation Effect`, Accountant sidebar clone, Reports active).
KPI strip: Closing Value (Latest-Price) · Closing Value (Actual Cost) ·
Revaluation Delta · Delta as % of Stock Value — the two closing-value
figures stay ink, only Delta and its % get the blue accent (they're the
two actionable numbers). Director sees the **identical full screen**, no
stripped-down summary variant — owner explicitly rejected simplifying the
Director view this session, don't reintroduce a "summary only" variant.

**Chart type correction this session — apply to remaining reports with a
"top offenders" story (not just A2):** the spec's waterfall chart
(opening → purchases → usage → revaluation → closing) was built, reviewed
on-screen, and then **explicitly rejected by the owner** as not premium/
McKinsey-grade and not actually the most useful view — a flow diagram
explains a concept the Accountant doesn't need re-taught, when what they
actually need is "which items to look at." **Replaced with a ranked
horizontal bar chart, top 10 items by |revaluation delta|** — thin bars
(16px), generous row rhythm (11px gap), mono right-aligned value labels,
quiet neutral track (`--color-neutral-100`), single blue ramp for all bars
(NOT one item singled out in a different accent color — owner corrected
this too, keep the top bar in the same blue family as the rest, don't use
espresso/caramel as a "look here" highlight on a data bar). This is the
same pattern B1 Count Variance's spec already calls for ("horizontal bar,
top 10 items by |variance value|") — **use this ranked-bar treatment
wherever a report's spec calls for a waterfall or an ambiguous "flow"
chart**, don't build another waterfall without checking with the owner
first.

**Report screen shell — DONE, this is the reference pattern for the
remaining 8 reports.** Built and approved on **Stock on Hand & Valuation**
(artboard `Report · Stock on Hand & Valuation`). Structure, top to bottom:
1. Topbar: breadcrumb (`Central Store / Reports / <report name>`) + **Export
   only** — **no Schedule button on this report** (owner: on-demand
   look-something-up reports don't need scheduling; add Schedule back only
   on reports someone would want emailed weekly, e.g. Count Variance, Waste
   Analysis — use judgment per report, don't blanket-add or blanket-remove it)
2. Header: report title + one-line description
3. Parameter bar: As of / Location / Category / Type + Group by — **scopes
   everything below it** (KPIs, charts, table all reflect the active filters)
4. KPI strip: **only actionable numbers** — this report uses Total On-Hand
   Value, Items Tracked, Below-Par Items (owner explicitly dropped a 4th
   "Negative Stock Value" cell that was in an earlier draft — re-derive each
   report's KPI set from what the user would actually act on, per
   `01-description.md`/spec, don't default to whatever fits in 3-4 boxes)
5. Two side-by-side chart cards (NOT one combined chart) — one per
   breakdown dimension (e.g. by location, by category) — see color rule above
6. Data table — the actual workhorse of the screen, not a footnote. Required
   pattern, apply to every report's table:
   - **Toolbar row** above the column headers: search box + a relevant
     quick-filter toggle (e.g. "Show flagged only") + live result count
   - **Sortable column headers** — chevron affordance, at least the primary
     identity column (Item) and the primary value column sortable, the
     active sort shown bold+filled-chevron
   - **Row hover state** (subtle bg tint) signaling the row drills through
     to that item's stock-ledger history (per spec §2 "every row deep-links")
   - **"Load N more · M remaining"** control at the bottom instead of a
     static "+N more items" label — real tables don't render all rows at once
7. Table footer row: row count + total + "Updated <when>" timestamp — **not**
   a duplicate Export button. Do NOT put agency/company advertising in this
   footer or anywhere in the product UI — the owner explicitly rejected that
   for an internal daily-use tool; if branding of the design agency is wanted
   anywhere, it belongs on a login screen, About page, or an external handoff
   document, never inside a report a staff member opens all day.

**Process note for the rest of O-REPORTS — read before designing any more
reports:** this session initially jumped straight to visual layout for Stock
on Hand & Valuation using the spec's suggested chart type, and the owner
stopped it: **outline the report's content and user actions FIRST (what
does the user need to know, what can they do here, does each proposed
chart/KPI actually earn its place) and get owner approval on that outline,
THEN design the structure, THEN build it in Paper.** Do this for every
remaining report — don't skip straight to Paper because the shell pattern is
now established. The shell being reusable doesn't mean the content-planning
step is skippable.

## The strategy (locked — do not re-litigate)

- Design **role by role**, every screen a role touches, as one coherent set,
  before the next role. Order (owner-approved):
  **Store Manager → Store Attendant → Branch Manager → Department Head →
  Accountant → Director.**
- Within a role: desktop first, then mobile; dashboard/landing → lists →
  detail → action surfaces.
- Slices (A → B → …) are **build-sequencing only** now, not the design unit.
- The governing doc is **`docs/features/inventory/02-screens-by-role.md`**
  (owner-approved) — every screen re-filed by role, marked DESIGNED / MISSING,
  with the Paper page split.

## Role 1 — Store Manager — COMPLETE (Paper page `F1 Inventory · Store Manager`, `4-0`)

~27 artboards + labels. All on the approved coffee shell (espresso sidebar,
blue-grey `#E7EEF7` table headers, dot+label statuses, Geist / Geist Mono,
KPI-strip + right-rail patterns).

| Screen | Artboards |
|---|---|
| C1 Dispatch queue | populated |
| C2 Fulfil & dispatch | populated · mid-signature · **dispatched (signed)** |
| C3 Delivery note | on-screen signed view (print layout → O-PRINT pass) |
| C6 Discrepancy resolution | populated · mid-signature · **resolved (signed)** |
| F4 Stock & counts hub | populated (Par-levels entry = band-header button + per-row action; on-hand row click → F5) |
| → D6 Log waste drawer | drawer |
| → D5 Spot count drawer | drawer · mid-signature · **signed (drawer confirmation)** |
| → F3 Par levels drawer | drawer |
| D4 Count verification | populated · mid-signature · **verified (signed)** — dual signature (counter + verifier). Reached via F4's "Verify" button. |
| F5 Stock ledger drill | populated |
| D1 Prep runs list | populated |
| → D2 New prep run drawer | drawer |
| F1 Item catalog | populated — Category column + filter chip + "Manage categories" link |
| → F2 Item create/edit drawer | drawer — Category picker (inline "add new") |
| → F1b Manage categories drawer | drawer (add / rename / retire / restore) |
| F9 Reports | **PLACEHOLDER only** — see Reports spec below |

Every PIN-signed screen (C2, C6, D4, D5) has a read-only **post-signing state**:
signer name in **Alex Brush** script + PIN timestamp + committed figures +
ledger IDs. Universal empty/loading/error are **not** redrawn per screen —
noted per screen as → `15W-0` (the Session-0 shell).

**Goods Receipt sign + signed record (A6/A7) live on the Slice A page, not
here** — they predate the role-complete pass: `3YT-0` (Sign sheet), `8CJ-0` /
`8RJ-0` (signed record, desktop/mobile), all on page `Inventory — Feature 1`
(`3-0`). Cross-referenced on the Store Manager page guide (`CSV-0`) as of
2026-09-11 so this doesn't get lost again — **check that note is still there**
before assuming a signing screen is missing.

## Role 2 — Store Attendant — COMPLETE (Paper page `F1 Inventory · Store Attendant`, `5-0`)

18 artboards + 13 labels + page guide (`HH5-0`). All 12 screens from
`02-screens-by-role.md` §2 + a permission-denied screen.

**Locked this pass:**
- **O-ATT-SIDEBAR resolved — spec wins.** Attendant nav = Dashboard · Receiving ·
  Prep · Dispatch · Stock & counts. No PROCUREMENT group. `2LZ-0` / `5C8-0` /
  `DQY-0` cloned onto `5-0` with nav fixed; Slice A / SM originals untouched.
- **Mobile nav = hamburger → slide-in sidebar drawer** (owner corrected: NOT
  bottom nav). Full-screen task views (prep run, fulfil, log waste, blind count)
  use a task header (back + title + Cancel), no hamburger, no drawers.
- **O-FIN-SCOPE (new):** no *managerial* financials on Attendant screens —
  valuation, AP / supplier balances, at-risk money, procurement cost analysis
  OUT. KES receipt totals, waste value in KES, cost/value columns ALLOWED.
  Dashboard KPI strip reworked to operational metrics.
- Blind daily count (`IFS-0` / `IHQ-0`) = flagship, properly blind (counted qty
  only, no expected / hint / variance / value).
- Screens #3/#4 (Goods Receipt mobile) reuse Slice A `898-0` / `8RJ-0` unchanged.

## Reports & Categories (cross-cutting, already settled — don't re-litigate)

- **`02-reports-spec.md`** — owner-approved. Report Library + 9 reports in 4
  categories + shared report-screen shell + **chart standard** (§4.1, load the
  `dataviz` skill before designing any chart) + **scheduled email (v1, owner
  decision)** + role-visibility matrix. Built in a **dedicated Reports pass
  after all 6 roles**. O-RPT-1..7 open, settle at the start of that pass.
- **Item categories** — free-form, manager-managed, one per item (owner
  decision). Drawn on Store Manager's F1/F2/F1b.

### Paper file

- **File:** `V3-RMS` — id `01M1ZZJ6S3FZGF5C7PPBGTKY89`
- **Pages:** `Inventory — Feature 1` (`3-0`) = the frozen Slice A + Session-0
  shells (`15W-0`), untouched. `F1 Inventory · Store Manager` (`4-0`) = done.
  `F1 Inventory · Store Attendant` (`5-0`) = done. Empty stubs: `Branch Manager`
  (`6-0`), `Department Head` (`7-0`), `Accountant` (`8-0`), `Director` (`9-0`).
- `00 · Design System` page was **not** built — reference `15W-0` on `3-0`
  in place (clone by node-id works across pages).
- Live tokens `contentHash` = `aca3ae52` (re-verify at session start — this
  drifts each time a token is added/changed, expect it to differ again).

═══════════════════════════════════════════════════════════════════════
Role 3 — Branch Manager — COMPLETE (Paper page `F1 Inventory · Branch Manager`, `6-0`)
═══════════════════════════════════════════════════════════════════════

13 of 15 screen-list rows designed (2026-09-11). Screen 15 (Reports,
branch-scoped) deferred — link only, per O-REPORTS. All on the coffee shell,
Branch sidebar clone (`ARS-0` inside `ARO-0`, page `3-0`), full token coverage
(color + typography — this role's screens are the first built 100%
token-referenced from the start; see `feedback_design_token_discipline`
auto-memory).

| # | Screen | Artboard(s) |
|---|---|---|
| 1 | Branch hub | `IQE-0` — populated, per-department table (never a lone total), alerts band |
| 2 | Requisitions list | `J18-0` — **rebuilt from spec, not the Slice B card design** (owner rejected the clone-and-patch approach); table rows per `02-screens.md`'s own "table rows" instruction; text-link row actions (owner: no buttons in table rows); cross-link "N dispatches" → Deliveries |
| 3 | Branch manager approval | `J74-0` populated · `JDM-0` mid-signature · `JKM-0` approved (signed) — signed state rebuilt clean (no inputs/delete icons, matches SM precedent) |
| 4 | Signed requisition doc + print | Same as 3's signed state (`JKM-0`) for on-screen; `JOP-0` = dedicated print layout (A4, letterhead, no app chrome) |
| 6 | Branch incoming dispatches | `JQL-0` — full status spread incl. discrepancy-open |
| 7 | Confirm branch receipt (confirm-on-behalf) | `JUO-0` — kept as full route, not a drawer (consistent with every other PIN-signing screen; owner confirmed) |
| 8 | Discrepancy detail (read-only) | `JXT-0` — explicit "View only — Store Manager resolves" |
| 9 | Day overview | `K09-0` — 5 department cards, blocked/not-closed states |
| 10 | End-of-day count & close | `K6O-0` — expandable panels, reason-required gate, right rail, disabled Sign until unblocked |
| 11 | Reopen a closed day | `KB6-0` — drawer, mandatory reason, destructive-red action |
| 12 | Signed day-close doc + print | `KI7-0` |
| 14 | Stock ledger drill | `KL3-0` — reused SM's F5 shell, branch/department-scoped, `dispatch_in` movement type |
| 15 | Reports | deferred — link only |

**Terminology note:** "round" → "requisition" renamed across all docs +
existing SM/Attendant Paper text this session (see
`project_inventory_round_states` auto-memory) before this role's screens were
built, so no retrofit needed here.

**Owner corrections this session (apply going forward):**
- Table-row actions are colored text links (hover-underline), never button
  chrome, on list screens — see Requisitions list.
- Don't clone-and-patch a weak prior design; when a screen doesn't work,
  check what the spec actually calls for (here: table rows, not cards) and
  rebuild from that.
- Confirm-on-behalf / any PIN-signing screen stays a full route, not a
  drawer — drawers are for quick low-stakes edits only.

**Walled-off, enforced in the design:** never a lone branch total without the
per-department breakdown; never the store's purchasing/supplier costs; a
department head reaching a Branch Manager route → permission-denied.

═══════════════════════════════════════════════════════════════════════
Role 4 — Department Head — COMPLETE (Paper page `F1 Inventory · Department Head`, `7-0`)
═══════════════════════════════════════════════════════════════════════

All 10 screens from `02-screens-by-role.md` §4 designed, 2026-09-11. **Mobile
only** — their chef/waiter role already owns the bottom nav, so inventory nav
is a hamburger → slide-in drawer (`ARO-0` Dept Head mobile treatment, page
`3-0`), no bottom nav. Nav drawer = Requisitions · Deliveries · Day · Waste.
Sees **only their own department everywhere** — data-enforced, not just
UI-hidden. O-FIN-SCOPE tight tier applied throughout: no managerial
financials, no stock valuation, no supplier/purchasing costs, no
cross-department comparison (item-level cost/waste-value in KES still shown,
consistent with the Attendant tier).

Page layout: one screen per row in journey order, `DH · Page guide` header at
top, `LABEL ·` artboard above each row, populated state at x=0 with variant
states cascading right in the same row — matching the Branch Manager page's
convention.

| # | Screen | Artboard(s) |
|---|---|---|
| 1 | Department landing / dashboard | `KOL-0` — new connective home: open requisition + dispatch-to-confirm cards, today's opening status, shortcuts (Log waste / Par levels / Ledger) |
| 2 | Branch requisitions list (their requisitions) | `KQJ-0` — reused from Slice B, round→requisition renamed |
| 3 | Department requisition section (fill) | `KS4-0` empty · `KTZ-0` partially-filled · `KW4-0` submitting · `KY9-0` error/offline · `L0J-0` submitted · `L2Q-0` returned — 6 states, reused from Slice B |
| 4 | Branch incoming dispatches (their department only) | `LIU-0` — new; mobile single-department feed (unlike BM's `JQL-0` all-department table): summary row + action card + in-transit + history |
| 5 | Confirm branch receipt (per department) | `L8K-0` mid-signature · `LAU-0` signed — reused from prior work, no confirm-on-behalf |
| 6 | Delivery note (view, mobile) | `LKE-0` — new; mobile read view of the driver's copy, reuses the Session-0 signed-document shell content pattern |
| 7 | Next-morning opening | `LLH-0` accept-carried-over-close (populated) · `LMO-0` recount + overnight-variance-flagged — new, two states |
| 8 | Log waste (their department) | `LOL-0` — adapted from Attendant's `IDZ-0`, rescoped to Kitchen department, dropped the supplier-claim checkbox (out of O-FIN-SCOPE tight tier) |
| 9 | Par levels (their department's items) | `LQD-0` — new; item/on-hand/par list matching SM's F3 drawer field pattern, cross-references "department pars are set by each department head, not here" from `EOV-0` |
| 10 | Stock ledger drill (their department only) | `LS0-0` — adapted from Attendant's `IKA-0`, rescoped to Kitchen, department-scoped movement types (dispatch_in from Central Store, waste, day-close adjustment) |

**Walled-off, enforced in the design:** a department head never sees another
department's section contents, ledger, or dispatches — only their own,
everywhere. No managerial financials (O-FIN-SCOPE, tight tier).

**Note on concurrent work:** screens 1, 2, 3, and 5 were already built by a
parallel session sharing this Paper file before this session started (the
work was high quality and matched spec) — this session verified, renamed for
consistency, laid them into the journey-order grid, and built the remaining
screens (4, 6, 7, 8, 9, 10) around them rather than duplicating.

═══════════════════════════════════════════════════════════════════════
Role 5 — Accountant — COMPLETE (Paper page `F1 Inventory · Accountant`, `8-0`)
═══════════════════════════════════════════════════════════════════════

All 7 screens from `02-screens-by-role.md` §5 designed, 2026-09-11. **Desktop
only**, company-wide money view. Nav = Overview · Suppliers · Supplier AP ·
Reports (no stock-moving items at all — Receiving/Purchasing/Prep/Dispatch/
Stock & counts absent from the sidebar entirely, not just hidden per-role).
O-FIN-SCOPE tier: **full** — the opposite end from Attendant/Dept-Head.

| # | Screen | Artboard(s) |
|---|---|---|
| 1 | Accountant Overview | `LYN-0` — new: KPI strip (closing stock value, COGS 30d, waste value 30d, outstanding AP) + closing stock value by location with an explicit revaluation-effect column and callout + cost breakdown (dispatched/prep/waste → total COGS) + supplier AP aging band |
| 2 | Suppliers / AP landing | `M43-0` — Store Manager's `5GE-0` content cloned as-is, sidebar swapped to Accountant nav, "New supplier" button removed (no create action) |
| 3 | Supplier detail | `MAY-0` — Store Manager's `6IJ-0` content cloned as-is, sidebar swapped, "Edit supplier" button removed (read + reconcile + pay only, matches the AP panel's own "Store Manager, Accountant & Directors only" label) |
| 4 | → Record supplier payment | Unchanged shared drawer, `4UM-0` / `53P-0` on page `3-0` — opens over screen 3 regardless of role, no Accountant-specific state needed |
| 5 | Supplier statement reconciliation | Unchanged shared route, `9U5-0` + variants on page `3-0` — same reasoning as #4 |
| 6 | Stock ledger drill (all locations, read) | `MGP-0` — Store Manager's `FCM-0` (F5) shell cloned, sidebar swapped, **added a location picker** above the movements table (SM's original is implicitly Central-Store-only; Accountant needs to choose which location's ledger to view) |
| 7 | Reports (cost angles) | `ML0-0` — link-only placeholder, same pattern as SM's F9, deferred to the dedicated Reports pass per O-REPORTS; body copy notes Accountant scope = cost/valuation angles |

**Sidebar active-state gotcha hit this session:** cloning a shared shell brings
its active nav item along. Each reused screen needed its active-state moved
(text color/weight + icon stroke color + the `Label` wrapper's caramel
`border-bottom` — note the border lives on an intermediate wrapper div per
item on some clones, not on the text node itself, so check `get_jsx` before
assuming a color-only fix is enough) from the source's active item onto the
correct item for this screen (Overview for #1/#6, Suppliers for #2/#3,
Reports for #7).

**Walled-off, enforced in the design:** no route or button anywhere mutates
stock — confirmed by omitting Receiving/Purchasing/Prep/Dispatch/Stock&counts
from the sidebar entirely (not a hidden-but-present item), and by removing
the "New supplier" and "Edit supplier" actions from the reused Suppliers/AP
screens. A deep-link attempt to any stock-moving route lands on
permission-denied (→ `15W-0` on page `3-0`), same as every other role.

═══════════════════════════════════════════════════════════════════════
Role 6 — Director — COMPLETE (Paper page `F1 Inventory · Director`, `9-0`)
═══════════════════════════════════════════════════════════════════════

All 10 screens from `02-screens-by-role.md` §6 designed, 2026-09-11. **Desktop
only**, company-wide visibility + exceptions. **Gates nothing** on the routine
path — no approval control anywhere; confirmed by omitting every stock-moving
route from the sidebar (Nav = Overview · Suppliers/AP · Reports, same shape as
Accountant) and by removing operational action buttons (Log waste, Start day
close) from reused screens, keeping only the two explicit Director powers:
reopen a closed day, and stalemate adjudication. O-FIN-SCOPE tier: **full**,
same as Accountant.

| # | Screen | Artboard(s) |
|---|---|---|
| 1 | Director rollup / Overview | `MMT-0` — new (F7): cloned Accountant's Overview (`LYN-0` on page `8-0`) as the base (closing stock value, COGS, waste, AP aging all already company-wide), sidebar swapped to Director + Suppliers/Supplier AP merged into one "Suppliers/AP" row, extended with a new "Variance & discrepancy feed" (stalemate/above-threshold/unresolved rows, fixed-width label + action lanes) and "Frequently reopened days" band — folds in screen 10 |
| 2 | Suppliers/AP landing (read) | `MSL-0` — sidebar-swapped clone of the shared `5GE-0`/Accountant's `M43-0`; no create/edit actions (already true of the source) |
| 3 | Supplier detail (read) | `MYB-0` — sidebar-swapped clone of the shared `6IJ-0`/Accountant's `MAY-0`; "Store Manager, Accountant & Directors only" label already correct, no edit/payment actions added |
| 4 | Branch aggregate (any branch) | `N3U-0` — sidebar-swapped clone of Branch Manager's Branch hub (`IQE-0` on page `6-0`); "Log waste" button replaced with a branch picker (Director scope is all-branch, unlike BM's single-branch home) |
| 5 | Branch day overview (any branch, read + reopen) | `N98-0` — sidebar-swapped clone of BM's Day (`K09-0`); "Start day close" button replaced with the same branch picker; "Close yesterday" link and per-department reopen entry points kept as the path into screen 6 |
| 6 | → Reopen a closed day | `NFG-0` — the shared drawer content itself is fully role-agnostic (already reads "signed by you"); the dimmed Branch-Manager background clone was deleted and replaced with a plain scrim, since re-cloning BM's full screen behind it would have shown the wrong sidebar/actions permanently |
| 7 | Discrepancy detail + stalemate adjudication | `NOR-0` — new (C6 Director variant): adapted from Store Manager's C6 (`DGY-0` on page `4-0`), which already had the exact walled-off note built in ("if you and the branch manager can't agree, leave it open — a director adjudicates"). Self-resolve outcome radios replaced with "Director's decision" (uphold SM count / uphold BM count / split the difference), gap card reworked to show both parties' conflicting counts side by side, footer button relabelled "Sign adjudication" |
| 8 | Stock ledger drill (all locations, read) | `NUF-0` — sidebar-swapped clone of Accountant's `MGP-0`, which already has the location picker (all-scope read) this screen needed |
| 9 | Reports (all) + variance/discrepancy feed | `NYN-0` — link-only placeholder, same pattern as SM's F9 / Accountant's `ML0-0`; deferred to the dedicated Reports pass per O-REPORTS |
| 10 | Count verification alerts / above-threshold variance feed | Folded into screen 1's "Variance & discrepancy feed" + "Frequently reopened days" bands — not a separate screen |

**Sidebar active-state gotcha applied again this session** (same fix as Role
5): every cloned shared shell needed its active nav item moved from the
source's item to the correct one for the new screen — text color/weight +
icon stroke color + the border-bottom wrapper. Confirmed the border lives on
an intermediate `Label` wrapper div, not the text node, on every clone touched
this session (Overview sidebar's own build, plus every sidebar-swap after it).

**New this session — merging two nav rows into one.** Director's nav has
"Suppliers/AP" as a single item where Accountant/SM have separate "Suppliers"
and "Supplier AP" rows. Pattern used everywhere this was needed: rename the
"Suppliers" item's text to "Suppliers/AP" and delete the "Supplier AP" item's
whole frame (icon + text together) — deleting only the text node once left an
orphaned icon with no label; always delete the parent `Item · ...` frame.

**Layout gotcha hit this session:** artboards placed by `create_artboard` /
`duplicate_nodes` land at an arbitrary auto-placed position, not where you
intend — always `update_styles({position:"absolute", left, top})` immediately
after, and check for vertical overlap against every other row at the same x
before considering a screen done. Two rows (#4-6 and #7, then #7 and #8-9)
were caught overlapping mid-session and re-positioned; the final layout is
row-by-row in journey order with 40-90px gaps, no overlaps.

**Walled-off, enforced in the design:** no approval control anywhere on the
routine path; the only mutating actions are reopen-a-closed-day and stalemate
adjudication, both explicitly Director powers per spec, not approvals.

═══════════════════════════════════════════════════════════════════════
DESKTOP LAYOUT DOCTRINE (unchanged — owner was unhappy with early attempts)
═══════════════════════════════════════════════════════════════════════

Desktop manager screens = considered workspace, not a list page: KPI strip
(real numbers) · dense geometrically-aligned content · charts where a chart
reads better than a table · right-side modules/drawers for edits (never a
separate route) · strong hierarchy, ledger-like. References that work: Slice A
`A1 Central Store dashboard`, the Purchasing hub, and the Store Manager screens
(the C2 / C6 right-rail summary cards, the F4 hub) — all on page `4-0`.

═══════════════════════════════════════════════════════════════════════
GROUND RULES (unchanged)
═══════════════════════════════════════════════════════════════════════

- Behaviour + visual design only. No data model, no API shape, no routes.
- **Do NOT commit anything.** Do NOT run git branch / checkout / stash / reset —
  the working tree is shared with other sessions.
- Reference colours ONLY via `var(--color-*)` tokens; read live token values at
  session start.
- Signature font: literal string `"Alex Brush"` per node (not `var()`).
- Paper gotchas: move a top-level artboard with
  `update_styles({position:"absolute", left, top})` — NOT worldX/worldY.
  `display:none` does nothing — delete the node. `duplicate_nodes` drops the
  copy at an arbitrary offset — reposition after. Paper honors
  `position:absolute; inset:0` for a full-bleed scrim as the last child.
  `write_html` insert-children appends to the end — use `move_nodes` to reorder.
- Clone shells from existing artboards by node-id rather than rebuilding. The
  Branch sidebar variant is `ARO-0` (page `3-0`). Store Manager sidebar clones
  (e.g. `CT1-0`) and the right-rail summary-card pattern live on page `4-0`.
- When you set a nav item active: brighter text `#F5F3EF` + weight 500 + the
  icon strokes to caramel `rgb(217 166 94)`; revert the previously-active item
  to `#B5AEA5` / weight 400 / `#8A7F76` strokes.
- Per-screen labels: an artboard-as-label above each row naming the screen +
  "empty/loading/error → 15W-0".
- **Layout on the page:** one screen per row, journey order top→bottom;
  populated artboard in the left lane; variant states (mid-signature, drawers,
  signed) to the right in the same row.
- Universal `loading / empty / error / permission-denied` = `15W-0`, **never
  redrawn per screen** unless the state genuinely changes that screen's layout.
- **Every PIN-signed screen gets a post-signing read-only "signed" state**
  (signer name in Alex Brush + timestamp + what was committed + ledger IDs) —
  this is now the standard, not optional. Owner asked for it explicitly on
  Store Manager and expects it here too (B4 approval, E2 day-close, C5-style
  confirm-on-behalf).
- Add a **cross-page link note** on the page guide for anything that opens a
  screen living on another page (e.g. if a Branch Manager screen links into a
  Store Manager or Slice A screen) — don't let that gap recur.
- Screenshot after each screen; run the Paper review checklist (spacing,
  typography, contrast, alignment, artboard fit); fix before moving on.
- Conflicts: go with your expert recommendation as the default; flag every
  conflict to the owner at the end.

═══════════════════════════════════════════════════════════════════════
DEFERRED CLEANUP (do at end of the 6-role pass, not per-screen)
═══════════════════════════════════════════════════════════════════════

- **Typography tokens retrofit.** 2026-09-11: 20 typography tokens created
  (`--text-*`, `--weight-*`, `--leading-*`, `--tracking-*`, `--font-sans`,
  `--font-mono`) on the file, sourced from real values already shipped on
  Store Manager (page title 24/600, KPI numbers 28/500 mono, table header
  labels weight 600, etc.). The Branch Manager Branch hub (screen 1) is fully
  retrofitted to reference them. **Store Manager (`4-0`) and Store Attendant
  (`5-0`) screens still use raw px/weight values** — the values are already
  correct (they were the sampling source), they just don't reference the
  token by name. Retrofit them to `var(--text-*)` etc. as a dedicated pass
  after all 6 roles are designed, alongside any other polish. Colors were
  already fully tokenized from Phase 0 — this is typography-only.

═══════════════════════════════════════════════════════════════════════
CARRIED FLAGS (owner to settle)
═══════════════════════════════════════════════════════════════════════

- **O-REQ-1 — RESOLVED 2026-09-11.** Keep both `partially-filled` AND
  `returned` as distinct requisition states — not collapsed. `returned` takes
  priority over `partially-filled` in the B1 status dot. See
  `project_inventory_round_states` (auto-memory).
- **O-FIN-SCOPE** — locked pattern: Attendant/Dept-Head = no managerial
  financials; Store Manager = full; Branch Manager = per-department stock value
  + day-close, no purchasing/supplier costs; Accountant/Director = full. Apply
  the Branch Manager tier when proposing screens.
- **O-SM1** — Store Manager mobile: no SM-specific mobile artboards planned
  (reuse Attendant mobile / drawers). Still just a recommendation, not
  contradicted since.
- **O-PRINT** — print stylesheets for every document screen (goods receipt,
  delivery note, count sheets, requisitions, statements, aging export, report
  PDFs). Standalone O-PRINT pass after all 6 roles. The on-screen document view
  is what the user sees *in the app*; printing swaps in a dedicated print
  layout (no app chrome, A4, letterhead, page breaks, signature line).
- **O-REPORTS** — Reports area spec approved; built in a dedicated Reports pass
  after all 6 roles. Not this session's concern beyond noting report links.

═══════════════════════════════════════════════════════════════════════
YOUR JOB THIS SESSION — finish O-REPORTS (O-PRINT is done)
═══════════════════════════════════════════════════════════════════════

O-PRINT is complete (see above). O-REPORTS is in progress: the Report
Library and 1 of 9 report screens (Stock on Hand & Valuation) are designed
and owner-approved, on Paper page `F1 Inventory · Reports & Documents`
(pageId `A-0`). Your job is to design the remaining **8 report screens**
using the now-established pattern, then close out the pass.

**Remaining reports, in spec order** (full detail — KPIs, chart type,
table columns, drill target, caveats — is in `02-reports-spec.md` §2; the
category/chart-type suggestions there are a starting point, not a mandate —
re-derive KPIs from what's actually actionable, per the process note above):

Stock & valuation:
- Latest-Price Revaluation Effect — **DONE**, see above.
- ~~Negative Stock Incidents~~ — **CUT from the report set, owner decision
  2026-09-14.** Owner reviewed the outline (timeline/gantt of went-negative
  → resolved incidents) and decided this doesn't warrant a separate report
  screen. Do not build A3. Remove it from `02-reports-spec.md` §2 Category A
  and the Report Library's row list as part of closing out O-REPORTS.

Variance & loss:
- **Count Variance** — the flagship/hero report.
  **O-RPT-7 RESOLVED 2026-09-14 — owner decision: NO caveat band.** Owner
  confirmed automatic sale deduction is expected to ship before this
  report goes live, so by build time the count gap will be trustworthy
  shrinkage/loss data — shipping the "blended, can't separate sold from
  lost" caveat now would bake in a disclaimer that's already false by
  launch. Designed for that future state: gap = real loss, no hedge
  language, no caveat band, KPI/table copy says "variance value" /
  "shrinkage" plainly. **Flag for engineering:** if automatic deduction
  slips past this feature's actual ship date, this decision must be
  revisited before the report goes live — original caveat wording is
  preserved in git history (`02-reports-spec.md` §2 B1) if still needed.
  **Scoping — one shell, 3 role-scoped clones — ALL 3 DONE**, same pattern
  as every other reused shell this pass:
  - `Report · Count Variance · Branch Manager` — Nyeri Town Branch sidebar,
    Department filter (not Location — BM is locked to one branch), KPI
    "Worst Department", charts grouped by department, 9 count events/
    KES 71,400 total (this branch only).
  - `Report · Count Variance · Store Manager` — Central Store (HUB) sidebar,
    Category filter (not Department — Central Store isn't departmentalized),
    KPI "Worst Category", charts grouped by category, 14 count events/
    KES 142,800 total, top-item chart correctly extended to 10 rows.
  - `Report · Count Variance · Director` — Director (HUB) sidebar, **both**
    Location AND Department filters (all-branch scope needs both axes),
    KPI "Worst Location", charts grouped by location (Nyeri Town / Kamakwa /
    Central Store / Other branches), 38 count events/KES 486,200 total
    (company-wide), **data table gained a 9th Location column** (Date,
    Location, Department, Item, Counted, Expected, Variance Qty, Variance
    Value, Signed By) — the only one of the three with 9 table columns
    instead of 8, since Director genuinely needs both axes visible.
  All three live on page `A-0`, cloned from each other in sequence
  (Branch Manager → Store Manager → Director), not rebuilt from scratch.

**B2 · Waste Analysis — ALL 3 ROLE-SCOPED VIEWS DONE** (same BM→SM→Director
clone sequence as B1, all on page `A-0`):
  - `Report · Waste Analysis · Branch Manager` — donut chart "By reason"
    (Spoilage/Expiry/Damage in store/Prep error/Other, all-blue ramp, no
    single-item highlight color per the "one accent" rule) + grouped bar
    "By week" (this-period solid navy vs. last-period outlined neutral,
    with a small legend) — genuinely different chart types for genuinely
    different questions (composition vs. trend), not decoration.
    KPIs: Total Waste Value · vs. Previous Period (green when improving,
    waste trending down is good news, don't reflexively color it red) ·
    % of Stock Value · Top Reason · Top Item. Table: Date, Department,
    Item, Qty, Reason, Value(sortable), Logged By, Linked Receipt (shows
    a GRN reference for supplier-claim rows, "—" otherwise — this is the
    one report in the pass with a genuine cross-report drill target
    distinct from the row's own record).
  - `Report · Waste Analysis · Store Manager` — Central Store sidebar,
    Department filter dropped (Central Store isn't departmentalized),
    table's Department column swapped to Category, figures scaled ~2x
    branch. No "Above threshold" toggle in the parameter bar for this
    report — replaced by Category/Reason filters instead (waste has no
    threshold concept, unlike Count Variance).
  - `Report · Waste Analysis · Director` — Director sidebar, **Location
    filter added back** (Director needs both Location AND Department,
    dropped Category to avoid a 4-filter-pill bar), data table gained a
    Location column (9 columns total, same pattern as Count Variance's
    Director table), figures scaled to company-wide.

  **New gotcha this session — silent node detachment.** After manually
  fixing a broken parameter bar (see below), the fixed frame reported a
  valid `parentId` via `get_node_info` and even rendered correctly in one
  screenshot, but `get_tree_summary` on the parent silently omitted it as
  a child, and a subsequent `duplicate_nodes` of the parent artboard did
  NOT carry the parameter bar into the clone at all — it had to be
  rebuilt from scratch on the Store Manager clone. **If a node's presence
  is ever in doubt after manual surgery (delete + rebuild, cross-parent
  moves), verify with `get_screenshot` on the exact parent AND re-check
  after any subsequent `duplicate_nodes` of an ancestor — don't trust
  `get_node_info`'s parentId alone.**

  **`write_html` with `mode: "replace"` is unsafe for multi-element
  content — confirmed a second time this session.** Replacing a parameter
  bar's children in one call with several sibling filter pills wiped the
  target frame's children entirely and dropped the new content as
  orphaned, full-width siblings on the grandparent Content frame,
  producing a badly broken layout that required manual cleanup. **Rule:
  never use `mode: "replace"` for more than one element at a time.** To
  swap N sibling elements: `delete_nodes` the old ones explicitly, then
  make N separate `write_html` calls with `mode: "insert-children"`, one
  filter/pill/row per call. This is slower but is the only path that has
  worked reliably across this session — every multi-element `replace`
  attempt has broken layout.

  **Branch Manager build notes / gotchas hit this session:**
  - The Branch Manager sidebar (`IQG-0` on page `6-0`) has **no Reports nav
    item** — it was never built because BM's report screen was deferred
    (link-only) in the original role pass. Had to add one: duplicated the
    "Waste" item, retexted, rebuilt its icon via `write_html` targeted at
    the **Nav frame directly** (`Q8E-0`), not at the empty item frame
    (`write_html` with `mode: "replace"` on an item frame wiped it and
    orphaned the new content as loose siblings — insert fresh content into
    the parent Nav frame instead, then `move_nodes` it into position).
  - Parameter bar for this role uses **Department** instead of **Location**
    (BM is locked to one branch, so a location filter is meaningless) —
    apply the same substitution on the Store Manager clone (Central Store
    is also one location) but the Director clone genuinely needs Location
    back (all-branch scope), see `MGP-0`/`NUF-0` pattern.
  - KPI strip needed a 5th cell (spec calls for 5: Total Variance Value ·
    vs. Previous Period Δ% · Count Events · Above Threshold · Worst
    Department) — duplicate a 4-cell strip's last cell rather than
    rebuilding, then fix borders (only cells 1-4 get a right border, not 5).
  - **Color rule applied:** Total Variance Value and vs-Previous-Period get
    the red accent (`#97281D`) since — per the no-caveat decision above —
    this is now treated as real loss, and the trend is worsening. Count
    Events / Above Threshold / Worst Department stay ink. A text-value KPI
    (Worst Department = "Kitchen") should be **sans, not mono** — mono is
    for numerals; a duplicated KPI cell inherits mono by default, fix it.
  - **Two-chart-card pattern**: to convert a single full-width chart card
    into two side-by-side sub-cards (matching Stock on Hand's layout), strip
    the outer card to `padding:0; border:none`, insert a `Charts row` flex
    frame inside it, then move the existing chart content into a bordered
    sub-card frame as the first child and build the second sub-card fresh
    alongside it. Building an empty `<div>` via `write_html` to get a
    container node silently creates a zero-content Rectangle, not a Frame —
    always seed the `write_html` call with at least one real child (e.g. a
    placeholder `<div style="width:10px">`) if you need the container node
    first, then delete the placeholder.
  - **Two charts must tell genuinely different, mutually consistent
    stories** — don't leave a cloned chart's placeholder data untouched.
    The ranked "by item" bar chart's values must reconcile with the data
    table's per-event rows (same items, same relative ordering) or the
    screen reads as internally inconsistent. Also rescale the row count to
    match reality — a "top 10" bar chart on a report with only 9 total
    count events should show 9 rows and say so, not silently pad to 10.
  - Line chart built as raw SVG `<polyline>` points computed by hand
    (`180 - value*scale`, plot height 180-200px) — no charting library
    available in Paper, this is the correct approach, same as the ranked
    bar chart's div-based bars. Keep the "hairline baseline, no gridlines,
    mono value labels" register from the revaluation report's chart
    consistent across every chart in this pass.
  - Topbar **Schedule** button: initially added, then **removed from all 6
    report screens** later this same session — see O-REPORTS-SCHED below.
    The `move_nodes`-before-`order` lesson still applies to any future
    topbar button reordering.

**Second scope correction this session — the report set was cut a second
time, down to 6 reports total, and the whole "scheduled reports" concept
was reversed and removed:**

- ~~Transit & Receiving Discrepancies~~, ~~Dispatch Shortfall / Fill
  Rate~~, ~~Overnight Variance~~ — **all three CUT**, owner decision
  2026-09-14. Not designed, not built.
- **C1 Purchase & Price Trend — DONE**, all 3 roles (Store Manager,
  Accountant, Director). **Domain correction:** only Central Store
  purchases anything — branches never buy, only receive dispatches — so
  there is no per-branch breakdown possible and all 3 role views are
  content-identical (sidebar/breadcrumb clones only). Chart: single-series
  bar, one bar per month, total spend — NOT a per-item unit-price line as
  the spec originally called for (that felt too narrow once built; see
  `02-reports-spec.md` C1 for the full reasoning). **Layout gotcha:** don't
  stretch N bars to fill the full card width with `flex:1` per column —
  at only 2-3 data points that reads as sparse/awkward. Group the bars as
  one fixed-width unit with deliberate gaps and center that unit in the
  card instead.
- **D2 Prep Yield — DONE**, 2 roles (Store Manager, Director — not
  branch-scoped). **Deliberately no chart** — low run volume means a chart
  would just restate a 5-10 row table; the shell's own table-only
  allowance applies. Keeps its caveat band (rolling-average-not-a-target)
  since that's a usage note, not a data-trust caveat, so it doesn't have
  B1's staleness problem.
- **O-REPORTS-SCHED — reversed entirely.** There is **no scheduled/
  recurring-email report feature in this product at all** — reports
  compute live from the database on every open. This reverses the
  2026-09-10 "Schedule is a v1 feature" decision recorded earlier in this
  file. Removed: the Schedule button from all 6 report topbars (Count
  Variance ×3, Waste Analysis ×3 — Stock on Hand, Revaluation Effect,
  Purchase & Price Trend, and Prep Yield never had one to begin with), the
  "N scheduled · next <day> <time>" pill from the Report Library header,
  and the "Scheduled reports" management screen was never designed (don't
  build it). `02-reports-spec.md` is updated throughout to match.
- **Gotcha:** when cloning a report to a new role, always use the **mapped
  (new) node ID** from `duplicate_nodes`'s `descendantIdMap` for
  subsequent edits — editing by the *source* artboard's ID silently edits
  the wrong artboard. Caught once on Prep Yield's Director breadcrumb.

═══════════════════════════════════════════════════════════════════════
DONE — O-REPORTS is complete: Report Library + all 6 final reports (Stock
on Hand & Valuation, Latest-Price Revaluation Effect, Count Variance,
Waste Analysis, Purchase & Price Trend, Prep Yield), each with every
role-scoped view it needs, shared shell, validated chart palette (now in
`docs/DESIGN_SYSTEM.md` §3.7), no scheduling anywhere. `02-reports-spec.md`
§5 open flags all resolved. **The entire Inventory & Procurement Feature 1
design is done.** Hand off to the build/engineering stage per
`docs/FEATURE_REDO_PLAYBOOK.md`.
═══════════════════════════════════════════════════════════════════════
