# Inventory & Procurement — Screens by Role

**Feature:** Inventory & Procurement (Feature 1 of the redo)
**Step:** 3 of the per-feature pipeline — design in Paper
**See `MILESTONES.md`** for which milestone each role's screens belong to and
current build status — this doc tracks design (DESIGNED/MISSING) only.
**Purpose of this doc:** the FIRST deliverable of the ROLE-COMPLETE design pass
(owner locked this strategy 2026-09-10). It re-files every screen the whole
feature needs — from `02-screens.md` (all of A–F) + `02-flows.md` — **by role**,
in the order that role moves through them, and marks each screen **DESIGNED**
(with its Paper artboard ID) or **MISSING**. This is the artifact that makes the
gaps visible so design proceeds role by role without orphan screens.
**Status:** DRAFT — awaiting owner sign-off. **No Paper work until this is approved.**
**Date:** 2026-09-10
**Traces to:** `02-screens.md`, `02-flows.md`, `03-design.md`,
`project_inventory_design_strategy.md` (auto-memory, the authority)

---

## How to read this

- **Role order** (owner-approved): Store Manager → Store Attendant → Branch
  Manager → Department Head → Accountant → Director.
- **Within a role:** desktop first, then mobile; dashboard/landing → lists →
  detail → action surfaces.
- **Surface type** applies the route-vs-surface doctrine from `02-screens.md`
  § Consolidation: **route** (full screen) · **drawer** (right-side slide-over) ·
  **band** (a section of a route) · **modal** (centred dialog) · **state**.
- **Status values:**
  - `DESIGNED` — approved artboard exists (Slice A / Session 0). ID given.
  - `DESIGNED-REUSE` — prior Slice B artboard is good as-is (per handoff notes).
  - `DESIGNED-REDO` — prior Slice B artboard exists but layout is weak; rebuild
    per the desktop doctrine, content ideas salvageable.
  - `MISSING` — never designed. The gap this pass fills.
- **Shared** = one artboard serves several roles; designed once, listed under the
  role that owns it, cross-referenced from the others.
- **State policy (owner decision 2026-09-10).** The universal
  `loading / empty / error / permission-denied` states are the Session-0 shell
  (`15W-0`) and are **never redrawn per screen** — a screen entry that says
  `MISSING` means one **populated** artboard plus only those state artboards that
  **change the screen's layout** (e.g. `mid-signature` with the Sign sheet up,
  Goods Receipt `price-alert`, payment `overpayment`, `Pay now` vs
  `Invoice to follow`). Those are working modes, not error states. Slice A's
  richer state lists (A2's 5, A6's 7) predate this policy and stay as the frozen
  Slice A record; new work follows the policy.

### Universal shared shells (designed once, Session 0 — `15W-0`)

Every role's screens sit inside these; they are **not re-listed per role**:
sidebar + icon rail, top bar, ledger table, line-entry grid (variant A pricing /
variant B qty-only), Sign sheet (4 states), signed-document + print, KPI strip,
universal empty/loading/error/permission-denied, right-side drawer, hub-landing
shell + band pattern. **Branch sidebar variant** = `ARO-0` (DESIGNED-REUSE —
Branch Manager desktop nav + Department Head mobile hamburger→slide-in drawer,
no bottom nav).

---

## 1 · Store Manager (desktop)

The hub-org buyer/adjudicator. Lives in three workspaces (Purchasing, Stock &
counts, Dispatch) plus Suppliers/AP, Catalog, Reports. Sees everything at the
Central Store; never a branch-internal or sales context.

| # | Screen | Purpose | Surface | Device | Status | Flows | Journey order |
|---|---|---|---|---|---|---|---|
| 1 | **Central Store dashboard** | At-a-glance: low stock, expected deliveries, receipts awaiting invoice, counts to verify, open discrepancies | route | desktop | **DESIGNED** — populated `1UF-0` · all-clear `2E7-0` · loading `2TM-0` · error `31Y-0` | 1,2,5,20 | 1 (home) |
| 2 | **Purchasing hub** | KPI strip (on-hand value, owed AP, overdue) · INBOUND band (expected + receive + add-invoice) · HISTORY band (needs-invoice filter) | route (hub-landing) | desktop | **DESIGNED** — populated `3JM-0` · empty `3OH-0` | 1,2,14 | 2 |
| 3 | → New purchase | Supplier + estimate lines; saves an `Awaiting delivery` row | drawer (off hub) | desktop | **DESIGNED** — `4D9-0` | 1 | 2a |
| 4 | → Record supplier invoice | Bundle receipts, invoice no./date/amount, mismatch callout → `UNPAID` | drawer | desktop | **DESIGNED** — `4LD-0` | 14 | 2b |
| 5 | → Record supplier payment | Allocate across invoices, partial, overpayment → credit | drawer | desktop | **DESIGNED** — `4UM-0` · overpayment `53P-0` | 15 | 2c |
| 6 | **New Goods Receipt** | Pricing line grid, price alerts, damage notes, PIN sign, move stock | route | desktop (mobile-primary for Attendant) | **DESIGNED** — price-alert `3TG-0` · Pay-now `44L-0` · mid-signature `3YT-0` · empty `7T0-0` · pre-filled `7Y9-0` · offline `83I-0` | 2,2a–2e | 3 |
| 7 | **Goods Receipt detail (signed) + print** | Immutable signed record; hard copy | route | desktop | **DESIGNED** — populated `8CJ-0` · loading `8J5-0` · error `8N1-0` | 2 | 3a |
| 8 | **Suppliers / AP landing** | Supplier index + AP position + aging (absorbs A11): KPI strip, age-bucket table, filters, export | route | desktop | **DESIGNED** — populated `5GE-0` · loading `5R3-0` · empty `5XA-0` · error `63H-0` · perm-denied `69O-0` | 16 | 4 |
| 9 | **Supplier detail** | One supplier: profile, AP panel, invoices, payments, history | route | desktop | **DESIGNED** — populated `6IJ-0` · loading `71E-0` · submitting `783-0` · error `7ES-0` · perm-denied `7LH-0` | 1,14,15 | 4a |
| 10 | → New / edit supplier | 3 fields | drawer (over detail; also inline from New-purchase) | desktop | **DESIGNED** — `6TF-0` | 18 | 4b |
| 11 | **Dispatch queue** | Approved requisitions waiting; one card per branch → 5 dept sections; oldest-first | route | desktop (mobile secondary) | **MISSING** (C1) — 1 artboard: populated | 9 | 5 |
| 12 | **Fulfil & dispatch** | Per-line dispatched qty, substitutions, per-department PIN sign, print delivery note | route | desktop | **MISSING** (C2) — 3: populated, mid-signature, dispatched (signed record: script-font signer + timestamp, In-Transit status, ledger written, print) | 9,9a,9b | 5a |
| 13 | **Delivery note (signed) + print** | The driver's copy, per department | route (print artefact) | desktop | **MISSING** (C3) — 1: on-screen signed view (print layout deferred to O-PRINT pass) | 9 | 5b |
| 14 | **Discrepancy resolution** | Signed outcome (found / write-off / miscount) + ledger entry; closes loop to BM + Directors | route | desktop | **MISSING** (C6) — 3: populated, mid-signature, **resolved (signed)** — read-only outcome record, Alex-Brush signature + PIN timestamp, ledger entry ADJ-… written, notify confirmation, Print | 11,20 | 6 |
| 15 | **Discrepancy / alert inbox** | Filtered feed of notifications + open discrepancies, scoped to what SM owns; links into #14 | band (on dashboard) | desktop | **MISSING** (C7) — 0 artboards: a band drawn into the dashboard row; note only | 20 | 6a |
| 16 | **Stock & counts hub** | KPI strip · on-hand table (main surface) · count-status band · ledger-drill · waste band | route (hub-landing) | desktop | **MISSING** (F4 as hub + D bands) — 1: populated | 4,5,6,21 | 7 |
| 17 | → Log waste (Central Store) | Item + qty + mandatory reason → `waste` at current cost | drawer | desktop | **MISSING** (D6) — 1 | 6 | 7a |
| 18 | → Spot count | Item multi-picker, counted qty, **expected shown** (SM adjudicates), PIN sign → `adjustment` | drawer | desktop | **MISSING** (D5) — 3: populated, mid-signature, signed (compact drawer confirmation: script-font signer + timestamp + adjustments written, before close) | 5a | 7b |
| 19 | → Par levels (Central Store items) | Item + par qty. **Entry points:** "Par levels" button in the on-hand band header + a per-row "Set par" action on each on-hand row | drawer (from on-hand) | desktop | **MISSING** (F3 desktop) — 1 | 19 | 7c |
| 20 | **Count verification** | Counted vs expected vs variance; accept/query per line; PIN sign → adjustments written | route | desktop | **MISSING** (D4) — 3: populated, mid-signature, verified (signed record: script-font verifier + timestamp, counter + verifier both shown, adjustments written, print) | 5 | 8 |
| 21 | **Stock ledger drill (item × location)** | Append-only history; proof of derived on-hand | route | desktop | **MISSING** (F5) — 1: populated | all | 9 |
| 22 | **Prep runs list** | Recent prep activity; yield-variance flags; start a run | route (its own nav item, O-D1) | desktop | **MISSING** (D1) — 1: populated | 3 | 10 |
| 23 | → New prep run | Output → inputs consumed → actual yield → confirm (atomic) | drawer (SM desktop; O-D2) | desktop | **MISSING** (D2 desktop) — 1 | 3,3a | 10a |
| 24 | **Item catalog list** | Find / manage items. Columns: name · **type** (system) · **category** (free-form, manager-managed, one per item) · units · pack · department scope. Category filter chip + "Manage categories" link | route (Catalog nav) | desktop | **DRAWN** (F1) — category column, filter chip, manage-categories link added 2026-09-10 | 18 | 11 |
| 25 | → Item create / edit | Name, type, **category** (picker + inline "type a new name to add it"), units, conversion, pack size, department scope | drawer (from F1) | desktop | **DRAWN** (F2) — category picker added 2026-09-10 | 18 | 11a |
| 25b | → Manage categories | Add / rename / retire / restore the free-form category list; shows item count per category | drawer (from F1) | desktop | **DRAWN** (F1b) — 2026-09-10 | 18 | 11b |
| 26 | **Reports** | See `docs/features/inventory/02-reports-spec.md` — full rethink. One screen per report tab, designed in a dedicated Reports pass after all 6 roles. Current F9 sketch is a placeholder | route (tabs / report library, Reports nav) | desktop | **SPEC IN PROGRESS** — screens deferred to Reports pass | 20,21 | 12 |

**New Store Manager artboards this session: ~23** (every PIN-signed screen — C2, C6, D4, D5 — gets a post-signing read-only `signed` state showing the signer's name in the script font + timestamp + what was committed, matching Slice A's A7 signed-goods-receipt pattern) (screens 11–14, 16–26; the
signing modes are the Session-0 Sign sheet composited over the screen). Screens
1–10 are already DESIGNED (Slice A) — not redrawn.

**Store Manager mobile:** the SM is desktop-primary. Goods Receipt (#6) and Spot
count (#18) are usable on mobile but reuse the Attendant mobile artboard / the
drawer; no SM-specific mobile artboards are planned. **Flag O-SM1** below.

### Store Manager — design status (Paper page `F1 Inventory · Store Manager`)

**All 24 screen artboards drawn and self-reviewed (awaiting owner review):**

| Screen | Artboards |
|---|---|
| C1 Dispatch queue | populated |
| C2 Fulfil & dispatch | populated · mid-signature · **dispatched (signed)** |
| C3 Delivery note | on-screen signed view |
| C6 Discrepancy resolution | populated · mid-signature · **resolved (signed)** |
| F4 Stock & counts hub | populated (Par-levels entry = band-header button + per-row action) |
| → D6 Log waste drawer | drawer |
| → D5 Spot count drawer | drawer · mid-signature · **signed (drawer confirmation)** |
| → F3 Par levels drawer | drawer |
| D4 Count verification | populated · mid-signature · **verified (signed)** — dual signature (counter + verifier) |
| F5 Stock ledger drill | populated |
| D1 Prep runs list | populated |
| → D2 New prep run drawer | drawer |
| F1 Item catalog | populated — **+ Category column, filter chip, "Manage categories" link** |
| → F2 Item create/edit drawer | drawer — **+ Category picker (inline "add new")** |
| → F1b Manage categories drawer | drawer — **new** (add / rename / retire / restore) |
| F9 Reports | **PLACEHOLDER** — old sketch retired; full redesign specified in `02-reports-spec.md`, built in the Reports pass after all 6 roles |

Every PIN-signed screen (C2, C6, D4, D5) has a read-only post-signing state:
signer name in **Alex Brush** script + PIN timestamp + committed figures +
ledger IDs (ADJ-…, dispatch_out) + notify/print. Universal empty/loading/error
not redrawn — noted per screen as → `15W-0`.

**Carried to build / later:** C3 print stylesheet (O-PRINT pass); F9 other 4 tabs
(same shell); the A1–A10 Slice-A screens stay frozen on the original page.

---

## 2 · Store Attendant (mobile primary, desktop secondary)

Hub-org floor worker. Receiving, prep, dispatch picking, blind count, waste. **No
Supplier AP anywhere** (walled-off, server-enforced). Nav = Dashboard ·
Receiving · Prep · Dispatch · Stock & counts only.

**ROLE COMPLETE — all screens designed on Paper page `F1 Inventory · Store
Attendant` (`5-0`), self-reviewed, awaiting owner review (2026-09-10).**

**Locked decisions this pass:**
- **O-ATT-SIDEBAR resolved — spec wins.** Attendant nav = Dashboard · Receiving ·
  Prep · Dispatch · Stock & counts (one flat CENTRAL STORE group, no PROCUREMENT
  group). Suppliers / Supplier AP / Catalog / Reports / Purchasing not shown at
  all; deep-links hit the permission-denied screen. `2LZ-0` / `5C8-0` / `DQY-0`
  were cloned onto page `5-0` with the nav corrected — Slice A / SM-page
  originals untouched.
- **Mobile nav:** compact espresso header + **hamburger → slide-in sidebar
  drawer** (no bottom nav), full-width content. Full-screen task views (prep run,
  fulfil, log waste, blind count) use a **task header** (back chevron + title +
  Cancel), no hamburger. No drawers on mobile — the task is the whole screen.
- **Financial-data scope (owner, 2026-09-10):** no *managerial* financials on
  Attendant screens — stock-on-hand **valuation**, AP / supplier balances,
  at-risk money, procurement cost analysis are all out. **Allowed:** KES receipt
  totals, waste value in KES, cost / value columns. Dashboard KPI strip was
  reworked to operational metrics (To receive today / To dispatch / Today's count
  / Expiring ≤7d). Stock & counts hub: valuation KPI → ITEMS TRACKED; COST/VALUE
  columns → LOCATION / LAST COUNT.

| # | Screen | Status | Paper artboards (page `5-0`) |
|---|---|---|---|
| 1 | **Central Store dashboard (Attendant)** | **DESIGNED** | desktop `HAZ-0` (cloned from `2LZ-0`, nav fixed, operational KPIs, "Start a task" card) · mobile `HIB-0` |
| 2 | **Receiving worklist** | **DESIGNED** | desktop `HLM-0` (cloned from `5C8-0`, nav fixed) · mobile `HPB-0` |
| 3 | **New Goods Receipt (mobile)** | **DESIGNED — REUSE** | Slice A `898-0` as-is (label `IPC-0`, not redrawn) |
| 4 | **Goods Receipt detail (signed) + print (mobile)** | **DESIGNED — REUSE** | Slice A `8RJ-0` as-is (label `IPC-0`, not redrawn) |
| 5 | **Prep runs list (mobile)** | **DESIGNED** | `HRA-0` — New-prep-run CTA + mini KPIs + run cards w/ yield flags. No prep-value KES |
| 6 | **New prep run (mobile, full-screen)** | **DESIGNED** | populated `HTC-0` · confirm sheet `HUZ-0`. Typical-yield nudge (never blocks); no output unit cost |
| 7 | **Dispatch queue (mobile)** | **DESIGNED** | `HX6-0` — branch cards (departments / lines / wait / progress), oldest-first. No KES value |
| 8 | **Fulfil & dispatch (mobile)** | **DESIGNED** | populated `HZB-0` · mid-signature `I1P-0` (Sign sheet). Per-line qty stepper + on-hand + short flag; no line/dispatch value |
| 9 | **Stock & counts hub (Attendant view)** | **DESIGNED** | desktop `I4M-0` (cloned from `DQY-0`, nav fixed, no valuation KPI, COST/VALUE → LOCATION/LAST COUNT, no Verify, no Par-levels action, identity → Amina Yusuf) · mobile `IBL-0` |
| 10 | **Log waste (Central Store, mobile full-screen)** | **DESIGNED** | `IDZ-0` — item + qty + mandatory reason chips + note + supplier-claim toggle. WASTE VALUE KES kept |
| 11 | **Central Store daily count — BLIND (mobile)** | **DESIGNED** | populated `IFS-0` · mid-signature `IHQ-0`. **FLAGSHIP** — counted qty ONLY, no expected / hint / variance / value. Blind-notice banner. On sign → Submitted, awaiting verification; no adjustment written |
| 12 | **Stock ledger drill (Central Store, read, mobile)** | **DESIGNED** | `IKA-0` — on-hand banner + movement cards (type / ±qty / counterparty / date / running on-hand). No value column |
| 13 | **Permission denied (walled-off proof)** | **DESIGNED** | desktop `ILY-0` (deep-link to Supplier AP → "Not available for your role"). Mobile equivalent = `15W-0` perm-denied shell |

**Page guide:** `HH5-0`. **Row labels:** `HHB-0`, `HP8-0`, `HR5-0`, `IPC-0`,
`IPF-0`, `IPI-0`, `IPL-0`, `IPO-0`, `IPR-0`, `IPU-0`, `IPX-0`, `IQ0-0`, `IQ3-0`.

Universal empty / loading / error / permission-denied = `15W-0`, not redrawn per
screen. Nothing committed — `02-screens-by-role.md` (this doc) and the HANDOFF
updated; only the Paper file changed.

---

## 3 · Branch Manager (desktop)

Branch-org oversight + the requisition hard gate + day close. Sees all five
departments, always broken down by department. Never the store's purchasing or
supplier costs. Nav = Branch · Requisitions · Deliveries · Day · Waste.

| # | Screen | Purpose | Surface | Device | Status | Flows | Journey order |
|---|---|---|---|---|---|---|---|
| 1 | **Branch aggregate / Branch hub** | All 5 departments in one place: live stock, requisition sections, incoming/unconfirmed dispatches, discrepancies, open/close position — per-department, never a lone branch total | route (hub-landing) | desktop | **MISSING** (F6) | 7–13 | 1 (home) |
| 2 | → Log waste (branch dept, on behalf) | Manager records a department's waste | drawer (on Branch hub, O-E1) | desktop | **MISSING** (E5 desktop drawer) | 13 | 1a |
| 3 | **Branch requisitions list** | Open/past requisitions; open a new requisition; jump to the approval that needs the user; per-department fill indicator | route | desktop | **DESIGNED-REDO** — `AZH-0` (populated) · `B52-0` (empty) · `BAD-0` (loading) · `BD6-0` (error). Layout weak — rebuild per desktop doctrine (KPI strip + density + right rail); requisitions-as-cards + fill chips salvageable | 7,8 | 2 |
| 4 | **Branch manager approval view** | The hard gate: every submitted department section on one screen, line edits both directions **with required reason**, one all-or-nothing PIN signature | route | desktop | **DESIGNED-REDO** — `BV8-0` (+ dupes). Structure ~right (collapsible dept sections, per-line edit + reason, Sign sheet, right rail). **Right-rail "This requisition" summary card — owner explicitly liked, keep + extend.** Density weak — upgrade. Last 3 state artboards half-converted — rebuild (approved / already-approved / permission-denied) | 8,8a,8b | 2a |
| 5 | **Signed requisition document + print** | Read-only committed requisition with signature block + per-department diff | route (print artefact) | desktop | **MISSING** (B4 signed view — reuse Session-0 signed-document shell) | 8 | 2b |
| 6 | **Branch incoming dispatches list** | All 5 departments' in-transit / arrived dispatches; per-department confirm state; find what to confirm-on-behalf | route | desktop | **MISSING** (C4 desktop) | 10 | 3 |
| 7 | **Confirm branch receipt (confirm-on-behalf)** | Confirm an absent head's department lines; real signer recorded | route | desktop | **MISSING** (C5 desktop) | 10,10a | 3a |
| 8 | **Discrepancy detail (read-only)** | Branch Manager's read into an open transit discrepancy (resolution is SM's — #14 in role 1) | route (read) | desktop | **MISSING** (C6 read variant / C7 link) | 11,20 | 3b |
| 9 | **Branch day (open/close) overview** | Today's state per department; run the close; handle yesterday-not-closed; blocked departments (unconfirmed dispatch) | route | desktop | **MISSING** (E1) | 12,12b,12c | 4 |
| 10 | **End-of-day count & close** | Five department panels, expected vs counted, reason every gap, one PIN signature, close | route | desktop | **MISSING** (E2) | 12,12a | 4a |
| 11 | → Reopen a closed day | One mandatory reason + recompute confirm | drawer (from E1) | desktop | **MISSING** (E4) | 12b | 4b |
| 12 | **Signed day-close document + print** | Per-department close sheet with signature | route (print artefact) | desktop | **MISSING** (E2 signed view — reuse signed-document shell) | 12 | 4c |
| 13 | **Discrepancy / alert inbox** | Filtered feed scoped to the branch | band (on Branch hub) | desktop | **MISSING** (C7) | 20 | 5 |
| 14 | **Stock ledger drill (their branch, per department)** | Append-only history for one item at one department location | route | desktop | **MISSING** (F5, branch scoping — reuse SM ledger shell) | all | 6 |
| 15 | **Reports (their branch)** | Shortfall / variance / yield, scope-filtered to their branch | route (tabs) | desktop | **MISSING** (F9, branch scope) | 20,21 | 7 |

---

## 4 · Department Head (mobile only)

Branch-org, one department. Sees **only their own department everywhere** —
data-enforced. Their chef/waiter role already owns the bottom nav, so the head's
inventory nav is a **hamburger → slide-in drawer** (`ARO-0`, DESIGNED-REUSE), no
bottom nav. Drawer nav = Requisitions · Deliveries · Day · Waste (no Branch item).

| # | Screen | Purpose | Surface | Device | Status | Flows | Journey order |
|---|---|---|---|---|---|---|---|
| 1 | **Department landing / dashboard** | The head's home: my open requisition section, incoming dispatch to confirm, this morning's opening, quick waste. The connective screen slice-thinking skipped | route (mobile) | mobile | **MISSING** — new | 7,10,12c,13 | 1 (home) |
| 2 | **Branch requisitions list (their requisitions)** | Requisitions relevant to their department; open their own section from a row; anonymous fill-tick count only | route (mobile) | mobile | **DESIGNED-REUSE** — `BFZ-0` (OK card list; still needs the dashboard #1 designed around it) | 7 | 2 |
| 3 | **Department requisition section (fill)** | "My requisition form": qty-only line grid scoped to this department's slice (prepped + stocked, **never raw**), pre-suggested qty = `max(par − on-hand, 0)`, add-item, note line, submit; recall while awaiting approval; returned banner | route (full-screen, mobile) | mobile | **DESIGNED-REUSE** — `BHM-0` + 5 dupes (6 states: empty / partially-filled / submitting / error+offline / submitted / returned). Line-entry grid variant B for mobile stacking, suggested-vs-entered "changed from N" delta — good | 7,7a | 2a |
| 4 | **Branch incoming dispatches list (their department)** | Only their department's in-transit / arrived dispatches | route (mobile) | mobile | **MISSING** (C4 mobile) | 10 | 3 |
| 5 | **Confirm branch receipt (per department)** | Turn in-transit into department stock at received qty; PIN sign; raises transit discrepancy if confirmed ≠ dispatched | route (full-screen, mobile) | mobile | **MISSING** (C5 mobile) | 10,10a,10b | 3a |
| 6 | **Delivery note (view, mobile)** | View the driver's copy when receiving | route (read) | mobile | **MISSING** (C3 mobile view — reuse shell) | 10 | 3b |
| 7 | **Next-morning opening** | Accept carried-over close, or recount and flag overnight variance | route (full-screen, mobile) | mobile | **MISSING** (E3) | 12c | 4 |
| 8 | **Log waste (branch department)** | Only this department's items; qty; mandatory reason → `waste` at carried cost | route (full-screen, mobile) | mobile | **MISSING** (E5) | 13 | 5 |
| 9 | **Par levels (their department's items)** | Item + par qty; drives requisition pre-suggestions + low-stock | route (full-screen, mobile) | mobile | **MISSING** (F3 mobile) | 19 | 6 |
| 10 | **Stock ledger drill (their department)** | Append-only history for one item at their department; never another department's | route (read, mobile) | mobile | **MISSING** (F5, department scoping) | all | 7 |

---

## 5 · Accountant (desktop)

Company-wide money view. **Cannot reach any stock-moving action** — no
requisition, dispatch, count, adjustment, catalog or par edit (server-enforced).
Nav = Overview · Suppliers/AP · Reports.

| # | Screen | Purpose | Surface | Device | Status | Flows | Journey order |
|---|---|---|---|---|---|---|---|
| 1 | **Accountant Overview** | The money home: closing stock value per location, cost of goods, **latest-price revaluation effect (shown explicitly)**, waste value, prep/dispatch cost, supplier aging; links to #3, #4 | route (hub-landing) | desktop | **MISSING** (F8) | 16,17 | 1 (home) |
| 2 | **Suppliers / AP landing (read + reconciliation entry)** | Same page as SM #8; Accountant gets read + "Reconcile statement" + record-payment | route | desktop | **DESIGNED** — `5GE-0` etc. (shared with SM #8; Accountant variant of the same artboard — confirm whether a distinct state is needed) | 16 | 2 |
| 3 | **Supplier detail (read + reconciliation)** | Shared with SM #9; AP panel read, "Record payment", "Reconcile statement" | route | desktop | **DESIGNED** — `6IJ-0` etc. (shared) | 15,17 | 2a |
| 4 | → Record supplier payment | Bank settlement; same drawer as SM #5, record shows who posted | drawer | desktop | **DESIGNED** — `4UM-0` / `53P-0` (shared) | 15 | 2b |
| 5 | **Supplier statement reconciliation** | Two-column match (our AP vs statement), reasoned adjustments (mandatory reason), mark period reconciled, dispute path. Adjusts the money figure only — never a stock qty | route | desktop | **DESIGNED** — populated `9U5-0` · matched `A2T-0` · dispute-open `A6P-0` · loading `AAL-0` · error `AEH-0` · perm-denied `AID-0` | 17,17a | 2c |
| 6 | **Stock ledger drill (all locations, read)** | Read-only proof surface, any location | route (read) | desktop | **MISSING** (F5, Accountant all-scope read — reuse shell) | all | 3 |
| 7 | **Reports (cost angles)** | F9 filtered to cost / valuation angles | route (tabs) | desktop | **MISSING** (F9, Accountant scope) | 20,21 | 4 |

---

## 6 · Director (desktop)

Company-wide visibility + exceptions. **Gates nothing** on the routine path — no
approval control anywhere. Can reopen a closed day and adjudicate stalemated
discrepancies. Nav = Overview · Suppliers/AP · Reports.

| # | Screen | Purpose | Surface | Device | Status | Flows | Journey order |
|---|---|---|---|---|---|---|---|
| 1 | **Director rollup / Overview** | All locations, all stock, all supplier balances, all cost/variance reporting; company-wide KPI strip; variance/discrepancy feed; frequent-reopen list | route (hub-landing) | desktop | **MISSING** (F7) | 20,12b | 1 (home) |
| 2 | **Suppliers / AP landing (read)** | Shared with SM #8 / Accountant #2 — read only, aging visible | route | desktop | **DESIGNED** — `5GE-0` etc. (shared; Director read variant) | 16 | 2 |
| 3 | **Supplier detail (read)** | Shared with SM #9 — read only | route | desktop | **DESIGNED** — `6IJ-0` etc. (shared) | — | 2a |
| 4 | **Branch aggregate (any branch)** | Shared with BM #1 — Director can view any branch's per-department breakdown | route | desktop | **MISSING** (F6, Director all-branch scope) | 7–13 | 3 |
| 5 | **Branch day overview (any branch, read + reopen)** | Shared with BM #9 — read, plus reopen | route | desktop | **MISSING** (E1, Director scope) | 12b | 3a |
| 6 | → Reopen a closed day | Shared drawer with BM #11 | drawer | desktop | **MISSING** (E4, shared) | 12b | 3b |
| 7 | **Discrepancy detail + stalemate adjudication** | Read into the C6 resolution context; adjudicate when SM / BM disagree | route (read + adjudicate) | desktop | **MISSING** (C6 Director variant) | 11,20 | 4 |
| 8 | **Stock ledger drill (all locations, read)** | Shared with Accountant #6 | route (read) | desktop | **MISSING** (F5, shared all-scope read) | all | 5 |
| 9 | **Reports (all)** + variance / discrepancy feed | F9, unrestricted scope | route (tabs) | desktop | **MISSING** (F9, all scope) | 20,21 | 6 |
| 10 | **Count verification alerts / above-threshold variance feed** | Where Director-threshold alerts land (from D4, D5, E2, E3) — a band on the Overview | band (on Overview) | desktop | **MISSING** (C7 Director scope) | 5,20 | 1a |

---

## Gap summary (what this pass must design)

| Role | Total screens | Designed / reuse | **Missing** |
|---|---|---|---|
| Store Manager | 26 | 10 | **16** |
| Store Attendant | 13 | 13 | **0 — ROLE COMPLETE (2026-09-10)** |
| Branch Manager | 15 | 2 (redo) | **13** |
| Department Head | 10 | 3 (reuse) | **7** |
| Accountant | 7 | 4 (shared) | **3** |
| Director | 10 | 3 (shared) | **7** |

Many "missing" screens are **shared** across roles (F5 ledger drill, F6 branch
hub, F9 reports, C4/C5, D-hub bands) — the true count of distinct new artboards
is lower. The biggest genuinely-new design work:

1. **Stock & counts hub** (SM + Attendant) — on-hand table as a workspace with
   count-status / waste bands and the D5/D6/F3 drawers.
2. **Dispatch** (C1/C2/C3) — queue → fulfil → delivery note, desktop + mobile.
3. **Branch hub** (F6) — the Branch Manager's home, per-department everything.
4. **Branch day close** (E1/E2/E3/E4) — overview → count → close, + next-morning.
5. **Department Head landing** (new) — the connective dashboard the whole
   role-complete strategy exists to stop skipping.
6. **Company Overviews** (F7 Director, F8 Accountant) — money + variance rollups.
7. **Discrepancy resolution + alert inboxes** (C6/C7) across SM / BM / Director.
8. **Catalog + Prep** (F1/F2, D1/D2) — SM desktop + Attendant mobile.

---

## Proposed Paper page split

Everything is on one page (`3-0`, "Inventory — Feature 1") and it is unreadable.
Split into **role-scoped, self-describing pages** — named by the rule of which
screens belong to them:

| Page name | Contains |
|---|---|
| `00 · Design System` | Session-0 shells (`15W-0`), store sidebar, branch sidebar variant (`ARO-0`), the Department-Head hamburger/drawer nav |
| `F1 Inventory · Store Manager` | All Store Manager screens (desktop; the few mobile-usable ones cross-referenced, not duplicated) |
| `F1 Inventory · Store Attendant` | All Attendant screens (mobile + desktop-secondary) |
| `F1 Inventory · Branch Manager` | All Branch Manager screens (desktop) |
| `F1 Inventory · Department Head` | All Department Head screens (mobile) |
| `F1 Inventory · Accountant` | All Accountant screens (desktop) |
| `F1 Inventory · Director` | All Director screens (desktop) |
| `F1 Inventory · Slice A (approved)` | The frozen A1–A12 artboards, kept intact as the build reference for Slice A |

**Shared artboards** (e.g. `5GE-0` Suppliers/AP, used by SM + Accountant +
Director) live on the **owning role's page** (the role with full control — here
Store Manager) and are referenced by ID from the other role pages in this doc.
They are **not** cloned onto every page.

**Recommendation on Slice A artboards:** keep them on their own
`F1 Inventory · Slice A (approved)` page **as-is** — they are frozen and a build
session already depends on their IDs. Do **not** re-file them by role (moving
artboards between Paper pages is unreliable, and re-filing frozen work risks
breaking the build reference). New role pages clone *from* them as reference.

**Build note:** moving artboards between Paper pages may not be supported by the
MCP tools. The design pass will **rebuild** on the new role pages, cloning from
`00 · Design System` and from Slice A artboards. The Slice A page stays untouched.

---

## Open flags for the owner

- **O-REQ-1 (carried, confirm early):** the requisition state set —
  earlier you gave a contradictory answer on keeping **both** `partially-filled`
  AND `returned`. The prior session kept both. Current doc set:
  `draft · awaiting-approval · partially-filled · returned · approved ·
  dispatched`. Confirm this is right before Branch Manager / Department Head
  design.
- **O-SM1:** Store Manager is desktop-primary but a few tasks (Goods Receipt,
  Spot count) are "usable on mobile". Recommendation: **no** SM-specific mobile
  artboards — the SM on a phone reuses the Attendant mobile receipt / the drawer.
  Confirm.
- **O-ATT-SIDEBAR — RESOLVED 2026-09-10 (spec wins).** Attendant nav = Dashboard ·
  Receiving · Prep · Dispatch · Stock & counts (no PROCUREMENT group). Locked;
  applied on page `5-0`. Deep-links to hidden areas → permission-denied (`ILY-0`).
- **O-PRINT (carried):** print layouts for every document-rendering screen (goods
  receipt, delivery note, count sheets, requisitions, supplier statements, aging
  export) are still undesigned. Recommendation: a **standalone "Print layouts"
  mini-pass** after the Director role, rather than slotting one into each role.
  Confirm. **Clarified 2026-09-10:** the on-screen document view (e.g. C3
  `DF8-0`) is what the user sees *in the app* when they open a document — inside
  the app shell, for lookup, with a Print button. Printing does **not** print the
  screen: a dedicated print stylesheet takes over (no app chrome, A4 margins,
  letterhead, tabular mono figures, page breaks, "Page N of M", physical
  signature line). The O-PRINT pass designs those print layouts as one
  consistent system across goods receipt / delivery note / count sheets /
  requisitions / statements / aging export.

- **O-REPORTS (new 2026-09-10):** the Reports area needs a full rethink — content
  outline + structure + best-practice research before visual design, then **one
  screen per report tab**. Spec: `docs/features/inventory/02-reports-spec.md`.
  Report screens are designed in a **dedicated Reports pass after all 6 roles**
  (the spec informs Branch Manager / Director / Accountant reports too, so it is
  written now). Current F9 is a placeholder sketch.
- **O-SHARED-STATE:** for shared AP artboards (`5GE-0`, `6IJ-0`), do the
  Accountant / Director read variants need their own state artboards, or is
  role-conditional content on the one artboard enough for design purposes?
  Recommendation: one artboard, note the role-conditional differences in the
  screen entry.

---

## What happens after sign-off

1. Owner approves this doc + the page split.
2. Design proceeds **role by role**, Store Manager first. Before designing each
   role: propose that role's complete screen list + the desktop layout approach,
   get sign-off, design every pending screen + state (desktop then mobile,
   dashboard → lists → detail → actions), pause for reaction after each screen or
   small group. Owner approves **the whole role** before the next.
3. After all six roles: the "Print layouts" mini-pass, then organise into
   flows / hand to build. Slices (A → B → …) resume meaning only as
   build-sequencing.
