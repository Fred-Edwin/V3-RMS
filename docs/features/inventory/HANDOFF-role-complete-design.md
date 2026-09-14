# HANDOFF — Inventory & Procurement redo · Step 3 design · role-complete pass

**For a fresh session. This file is the running handoff for the role-by-role
design pass. Update it at the end of each session; don't delete it until the
whole feature's design is done.**

You are a senior product designer continuing the feature-by-feature redo of Wendo
RMS's Inventory & Procurement feature (Feature 1). The **ROLE-COMPLETE design
strategy** (locked by the owner 2026-09-10) is in force. Read
`docs/FEATURE_REDO_PLAYBOOK.md` §5 (Steps 2–3) and the auto-memory
`project_inventory_design_strategy.md` first — that memory is the authority.

═══════════════════════════════════════════════════════════════════════
WHERE THINGS STAND (updated 2026-09-14 — O-PRINT complete, O-REPORTS in progress)
═══════════════════════════════════════════════════════════════════════

Roles done: 1 Store Manager, 2 Store Attendant, 3 Branch Manager, 4 Department
Head, 5 Accountant, 6 Director. **O-PRINT is now complete.** O-REPORTS is
in progress (1 of 9 report screens + the Report Library done). This is the
last pass before the whole Inventory & Procurement design is done.

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
- Latest-Price Revaluation Effect (Accountant-focused; waterfall chart per
  spec — validate any new chart-mark color choice before using it)
- Negative Stock Incidents (timeline/gantt per spec)

Variance & loss:
- **Count Variance** — the flagship/hero report. Carries a mandatory,
  prominently-shown caveat: Wendo cannot separate "sold" from "lost" in a
  count gap yet, so the report must say so plainly, not imply false
  precision. Draft caveat wording is in `02-reports-spec.md` §2 B1 — get
  owner sign-off on the exact wording (flagged there as O-RPT-7, still open)
  before shipping this screen.
- Waste Analysis (donut chart for waste-by-reason, per spec)
- Transit & Receiving Discrepancies

Purchasing:
- Purchase & Price Trend (line chart with a price-alert threshold band)

Operations:
- Dispatch Shortfall / Fill Rate
- Prep Yield (Store Manager + Director only — not branch-scoped)
- Overnight Variance (Branch Manager + Director only)

**Before designing each one:** outline its content/actions and get owner
approval on that outline FIRST (see the process note above — this was a
correction mid-session, don't skip it a second time), then the structure,
then build. Don't jump straight into Paper just because the shell pattern
is now reusable.

**Then, to close out O-REPORTS:**
1. Add a Schedule button back onto the reports that genuinely warrant
   recurring email delivery (Count Variance and Waste Analysis are the
   most likely candidates per the spec's "owner wants this weekly" framing
   — confirm with the owner, don't assume the full list).
2. Design the "Scheduled reports" management screen the header pill links to
   (per spec §3 — list of schedules with add/edit/pause/delete) — not yet
   designed.
3. Settle the still-open O-RPT-1, 3, 4, 5, 6 flags in `02-reports-spec.md`
   §5 (O-RPT-2 is already resolved; O-RPT-7 is called out above) — check
   which the owner has already implicitly decided this session (e.g.
   O-RPT-1 "library vs tabs" is resolved — Option A editorial index) vs.
   which are still genuinely open.
4. Formally add the validated chart palette (blue ramp + red for problems,
   see above) to `docs/DESIGN_SYSTEM.md` as new tokens — it was authorized
   by the owner this session but never written back to the design system doc.
5. Update this handoff file's status header once every report screen is
   built and reviewed.

═══════════════════════════════════════════════════════════════════════
DONE (this pass's milestone) = O-REPORTS: Report Library + all 9 report
screens + shared shell + chart standard + scheduled-reports management
screen, all reviewed and owner-approved. Once this is complete, the entire
Inventory & Procurement Feature 1 design is done — update this handoff to
say so and hand off to the build/engineering stage per
`docs/FEATURE_REDO_PLAYBOOK.md`.
═══════════════════════════════════════════════════════════════════════
