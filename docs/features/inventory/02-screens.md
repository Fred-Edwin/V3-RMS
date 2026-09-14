# Inventory & Procurement — Screen Inventory

**Feature:** Inventory & Procurement (Feature 1 of the redo)
**Step:** 2 of the per-feature pipeline — screens
**Status:** Working draft — assembled from `02-flows.md`. Reviewed per slice
against the Paper visual design, not as a whole up front (owner decision
2026-09-09). **Revised 2026-09-09 (Step 3, Slice A):** a full consolidation pass
applied the route-vs-surface doctrine below to every screen — see
"§ Consolidation & information architecture". Screen count dropped from ~41 to
~24 routed screens + ~11 drawers/panels. Original per-screen entries are kept
below with a **▸ Consolidation** note where the verdict changed.
**Date:** 2026-09-09
**Traces to:** `docs/features/inventory/02-flows.md`, `01-description.md`

> **Scope of this document.** Behaviour and inventory only — every screen the
> flows require, who reaches it on what device, its purpose, its states, its key
> elements (named against the `components/ui2/` set where possible), what it
> deliberately does **not** show, and the breakpoints that matter. **No layout,
> no visual design, no routes, no data model** — those are Steps 3–7.
>
> **Device rule (from the description).** Department heads and Store Attendants
> work on **mobile**. Branch managers, the Store Manager, and the Accountant work
> on **desktop**. Some managers use both — stated per screen. Directors are
> desktop (visibility + exceptions).
>
> **State vocabulary.** Every screen lists the states that apply to it from:
> `empty` · `loading` · `populated` · `error` · `permission-denied` ·
> `offline` · `mid-signature` (the PIN sheet is up) · `partially-filled` ·
> `awaiting-approval` · `in-transit` · `day-closed` · `reopened` · `submitting`.
> Not every screen has every state; only the relevant ones are listed.
>
> **Design-system anchors** (`docs/DESIGN_SYSTEM.md`): status is **dot + label**
> (`<StatusDot>`), never a pill (§9); counts use `<Badge>` (§9); navigation is a
> **sidebar** that collapses to an **icon rail** on mobile (§11); density is
> high — 32px controls, 13px table text (§12). Component set in §10; anything
> not yet built is called out as **[new ui2]**.

---

## Shared shells & primitives

These are designed **once, in Slice A**, and reused (not redesigned) by every
later slice. Later slices only design their screen-specific content inside these
shells.

| Shell / primitive | What it is | First designed in | Reused by |
|---|---|---|---|
| **App sidebar** (desktop) + **icon rail** (mobile) | Role-conditional nav. Espresso gradient; line icons; all-caps group labels (**no hairline** — removed 2026-09-09); active item = **brighter text + a caramel underline** under that link, no fill, no left marker (DESIGN_SYSTEM §11, revised). Store roles: Dashboard · Receiving *(Attendant)* / Purchasing *(Store Manager)* · Prep · Dispatch · Stock & counts · Suppliers · Catalog · Reports. Branch and company roles have their own nav sets — see "§ Consolidation → Revised navigation". | Slice A | all |
| **Ledger table** [new ui2: `data-table`] | Dense, sortable, `overflow-x:auto` scroll container. Columns: date, type (dot+label), item, qty, unit cost, value, location, user. Used read-only for stock history and drill-downs. | Slice A | D, E, F |
| **Line-entry grid** [new ui2: `form` + `table`] | The repeated pattern behind receipts, prep runs, counts, requisition sections, dispatches: one row per item, fixed-width slots for qty steppers and trailing actions (DESIGN_SYSTEM — fixed slots, not gap). Supports `partially-filled`. | Slice A (goods receipt) | B, C, D, E |
| **Sign sheet** [new ui2: `dialog` variant] | The PIN re-auth modal. Shows the document summary, a PIN input, and on success renders the signer's name in the stylised signature font. States: `idle` · `submitting` · `error (wrong PIN)` · `locked (N failures)` · `success`. This is the `mid-signature` state for every signed screen. | Slice A (goods receipt) | B (req approval), C (dispatch, branch receipt, resolution), D (counts), E (day close) |
| **Signed-document view + print layout** | The read-only rendering of a signed document (receipt, requisition, delivery note, count sheet) with the signature block, and its print stylesheet. **Print action is always present, never required.** | Slice A (goods receipt) | B, C, D, E |
| **Status set** (`<StatusDot>` tones) | The canonical mapping of inventory statuses → tone + label: `Awaiting delivery` (neutral), `Received — invoice pending` (info), `Received — paid` (success), `In Transit` (info), `Confirmed` / `Closed` (success), `Pending approval` / `Awaiting verification` (warning), `Disputed` / `Discrepancy open` (error), `Negative stock` (error), `Overdue` / `Not closed` (error), `Reopened` (warning). | Slice A | all |
| **KPI strip** [new ui2: composite on `<Card raised>`] | The dashboard stat row (DESIGN_SYSTEM §10 app composites). | Slice A (Central Store dashboard) or F | F |
| **Empty / error / permission-denied states** | House styles for the three universal non-happy states, so every screen references them rather than inventing. `permission-denied` is a real design (walled-off cases below rely on it). | Slice A | all |
| **Right-side drawer** [new ui2: `sheet`] | 420–520px slide-over from the right, scrim behind, header + scrolling body + sticky footer with the primary action. The home for every short form (new purchase, record invoice/payment, log waste, new item, par levels, spot count, reopen day). Added by the 2026-09-09 consolidation. | Slice A | A, D, E, F |
| **Hub-landing shell** | Page header + optional KPI strip + one or more **bands** (a band = titled section with an inline filter and a per-row action list; collapses to a calm line when its filter is empty — the A1 Needs-attention pattern generalised). Backs the Purchasing hub, the Stock & counts hub, the Branch hub, and the two company Overviews. Added by the 2026-09-09 consolidation. | Slice A | A, D, E, F |

**Walled-off cases the `permission-denied` / filtered states must enforce
(server-side, not just hidden):**

- **Store Attendants never see Supplier AP** — invoices, payments, aging,
  reconciliation. Not even read-only. (Flows 14–17)
- **A department head sees only their own department** — its items, its stock,
  its requisition section, its incoming dispatch, its waste. Never another
  department, never the store's purchasing or supplier costs. (§5)
- **The blind count never shows expected** to a Store Attendant — enforced in
  the count API, not merely omitted from the screen. (Flow 4)
- **The branch aggregate always breaks down by department** — a branch-level
  total with no department breakdown is never the only view. (§5)
- **The Accountant cannot reach any stock-moving action** — no requisition,
  dispatch, count, adjustment, catalog or par edit. (§2)
- **The Central Store (hub org) appears in people contexts, never sales
  contexts** — carried from D-15 / the CENTRAL_STORE_SCOPING_DESIGN visibility
  rule.

---

# Consolidation & information architecture

> Added 2026-09-09 during Step 3 (Slice A visual design), after the owner
> observed that a full desktop route "that is just a form" is wrong. Applied to
> **all** slices before resuming design, so the same mistake isn't repeated in
> B–F. Where a screen's verdict changed, the original entry below carries a
> **▸ Consolidation** note.

## The route-vs-surface test

Every screen answers one question: **does this earn a full route, or is it a
surface inside a workspace?**

| Verdict | When | Examples |
|---|---|---|
| **Route** (full screen) | Heavy working surface · PIN signing / attestation · mobile-primary field task · a real filterable report · a list you live in and filter | Goods Receipt, requisition approval, dispatch fulfilment, branch day-close, aging report, ledger drill, a hub landing |
| **Drawer** (right-side slide-over, ~420–520px) | A short form (≤ ~6 fields, optionally one line grid) · an action taken *on* a record already on screen · no signing | New purchase, record invoice, record payment, log waste, new item, par levels, spot count, reopen day |
| **Band / panel** (a section of a route) | A list that is really a slice of a bigger workspace · a queue that is one filter of another list | "invoices to record" (a filter of the Purchasing hub), "counts to verify" (a band on the Store dashboard), the discrepancy inbox |
| **Modal** (centred dialog) | Blocking confirm · the Sign sheet | Sign sheet, destructive confirms |
| **State, not screen** | Already documented as such | C7 alert inbox |

**Doctrine, stated once:**

1. A routed page must justify its navigation cost. If the whole page is one form,
   it is a drawer.
2. Actions belong *next to the thing they act on*. "Receive", "Add invoice",
   "Record payment" open from a row in a list — you do not navigate away to a
   separate destination and back.
3. One workspace per domain. The Store Manager has a **Purchasing** hub, a
   **Stock & counts** hub, a **Dispatch** queue — not fifteen sibling list
   screens. History, status, and the entry actions all live in the hub.
4. A queue is usually a saved filter of a bigger list, not its own screen.
5. Two screens showing the same records to the same role = merge them.
6. Signing is always a modal (`Sign sheet`), regardless of what launched it.
7. Mobile field tasks (department head / attendant) stay full-screen — a phone
   has no room for a drawer, and these are the user's whole job at that moment.

## Revised navigation

**Store roles (hub org) — Store Manager sees all; Attendant sees a subset:**

| Nav item | Landing | Attendant sees |
|---|---|---|
| **Dashboard** | A1 Central Store dashboard | A1 (Attendant variant — no AP) |
| **Receiving** | Attendant-only inbound worklist (expected + receive). Store Manager does *not* use this — they use Purchasing. | ✅ this is the Attendant's main screen |
| **Purchasing** | The Purchasing hub (KPI strip · INBOUND band · HISTORY band). Drawers: new purchase, add invoice, record payment. | ❌ hidden (walled-off AP) |
| **Prep** | D1 prep runs list. Drawer: new prep run (mobile: full-screen). | ✅ |
| **Dispatch** | C1 dispatch queue → C2 fulfilment (route). | ✅ |
| **Stock & counts** | Stock-and-counts hub (on-hand table · count status · ledger drill · waste). Drawers: log waste, spot count, par levels. | ✅ (no AP; blind count still blind) |
| **Suppliers** | A2 list → A3 detail (route — it carries the supplier AP panel and history). | ❌ hidden |
| **Catalog** | F1 item list. Drawer: new/edit item. | ❌ hidden |
| **Reports** | F9 reports (tabs). Aging lives on A2, not here. | ❌ (aging hidden; ops reports may show) |

**Branch roles:**

| Nav item | Branch Manager | Department Head (mobile) |
|---|---|---|
| **Branch** | F6 branch aggregate (their branch, per-department) | — |
| **Requisitions** | B1 requisitions list → B4 approval (route) | B1 (their requisitions) → B2 section fill (route, mobile) |
| **Deliveries** | C4 incoming (all depts) → C5 confirm-on-behalf | C4 (their dept) → C5 confirm (route, mobile) |
| **Day** | E1 day overview → E2 close (route). Drawer: reopen. | E3 next-morning opening (route, mobile) |
| **Waste** | — | E5 log waste (route, mobile) — or a drawer on F6 for the manager |

**Company roles:**

| Nav item | Director | Accountant |
|---|---|---|
| **Overview** | F7 director rollup | F8 accountant reporting |
| **Suppliers / AP** | A2 (read — the AP landing page carries aging) · A3 (read) | A2 (AP landing + aging) · A3 · A12 reconciliation (route — it is heavy match work) · record-payment drawer |
| **Reports** | F9 (all) · variance / discrepancy feed | F9 (cost angles) |

## Per-screen verdicts

**Slice A — Purchasing & AP**

| Screen | Was | Verdict | Why |
|---|---|---|---|
| A1 Central Store dashboard | route | **route** (unchanged) | The at-a-glance home. Already restructured (Needs-attention panel + standing blocks) so it never empties. |
| A2 Suppliers list | route | **route** — now the **Suppliers / AP landing page** (absorbs A11 aging: KPI totals + age-bucket table columns + age/date filters + Export). See A11 row. |
| A3 Supplier detail / create-edit | route | **route** for detail; **drawer** for create/edit | Detail carries the AP panel, invoices, payments, history — a workspace. Creating a supplier is 3 fields → drawer (also reachable inline from the New-purchase drawer). |
| A4 New Purchase | route | **drawer** off the Purchasing hub | Supplier + a few estimate lines. Textbook drawer. Not a PO — do not dignify it with a route. |
| A5 Expected deliveries list | route | **band** — the INBOUND band of the Purchasing hub (Store Manager) / the Receiving worklist (Attendant) | It is one status-slice of "purchases". Merged. |
| A6 New Goods Receipt | route | **route** (unchanged) | The heavy one: pricing line grid, price alerts, damage notes, **PIN signing**, mobile-primary at the delivery door. Reached via **Receive** on a hub/worklist row (pre-filled) or **+ Goods receipt** (blank walk-in). |
| A7 Goods Receipt detail + print | route | **route** | The immutable signed document + print. A record you link to and print. |
| A8 Invoices to record (queue) | route | **band** — a filter of the Purchasing hub HISTORY / a "needs invoice" tab | A queue is a saved filter. The rows already appear in the hub's INBOUND band with an **Add invoice** action. |
| A9 Record supplier invoice | route | **drawer** | Invoice no. + date + amount + mismatch check. Opens from an "invoice pending" row. |
| A10 Record supplier payment | route | **drawer** | Amount + method + allocation. Opens from a supplier / invoice row. Same drawer for Store Manager and Accountant. |
| A11 Supplier aging report | route | **folded into A2** (owner decision 2026-09-10) | Aging *is* the AP position of the supplier list. A2 becomes the Suppliers / AP landing page: KPI strip carries the AP totals, the table carries the age-bucket columns (Invoiced / Paid / Current / 1–30 / 31–60 / 60–90 / 90+ / Outstanding), filters gain an age-bucket + date-range control, Export lives on the page. No separate route, no Reports tab. The hub's "Owed (AP)" KPI now deep-links to A2. |
| A12 Supplier statement reconciliation | route | **route** | Heavy two-column match work with reasoned adjustments. Accountant-only. Earns its screen. |

> **▸ Print layouts (Slice A follow-up, flagged 2026-09-10).** Every screen that
> renders a document — A7 goods receipt, C3 delivery note, D-count sheets, B
> requisitions, A11/A2 aging export, supplier statements — needs a **dedicated
> print stylesheet / layout**, not the on-screen view sent to the printer:
> paper margins, a letterhead / branding block, no app chrome, tabular mono
> figures, page breaks, "Page N of M", a signature line. To be designed as its
> own pass (a "Print layouts" mini-slice or the tail of Slice A build).

**Net Slice A:** 12 routes → **6 routes** (A1, A2 *(Suppliers / AP landing — absorbs A11)*, A3-detail, A6, A7, A12) **+ 4 drawers** (new purchase, new supplier, record invoice, record payment) **+ 2 bands** (expected, invoices-to-record) folded into the Purchasing hub. New surface introduced: **the Purchasing hub** (1 route) and the **Attendant Receiving worklist** (1 route). *(A11 folded into A2 on 2026-09-10 — one fewer route.)*

**Slice B — Requisition & approval**

| Screen | Was | Verdict | Why |
|---|---|---|---|
| B1 Requisitions list | route | **route** | The branch's requisition activity — a list you live in. |
| B2 Department section fill | route (mobile) | **route** (mobile) | A department head's whole job at that moment, on a phone. Full-screen. |
| B4 Branch manager approval | route | **route** | The hard gate: all department sections, line edits, one signature. Heavy. |

**Net B:** 3 routes, zero states-as-screens. (B5 urgent/escalation removed
2026-09-10 — "a requisition is a requisition"; no priority flag anywhere.)
Already lean.

**Slice C — Dispatch, receiving, discrepancy**

| Screen | Was | Verdict | Why |
|---|---|---|---|
| C1 Dispatch queue | route | **route** | The queue you work all shift. |
| C2 Fulfil & dispatch | route | **route** | Per-line quantities, substitutions, per-department signing. Heavy. |
| C3 Delivery note + print | route | **route** (print artefact) | A printable signed document. Keep. |
| C4 Branch incoming dispatches | route | **route** | The list a department head / branch manager checks to find what to confirm. |
| C5 Confirm branch receipt | route (mobile) | **route** (mobile) | Signed confirmation at the receiving door. Full-screen. |
| C6 Discrepancy resolution | route | **route** | Signed outcome + ledger entry. Store-Manager-only, but a real decision surface — keep as a route (reached from the alert inbox band). |
| C7 Alert inbox | state / band | **band** — a filtered feed on each role's dashboard/overview | Not its own destination. Confirmed. |

**Net C:** 6 routes + 1 band. C6 could be a wide drawer off C4 — **open question O-C1** below.

**Slice D — Prep & Central Store count**

| Screen | Was | Verdict | Why |
|---|---|---|---|
| D1 Prep runs list | route | **band** of the Stock & counts hub (or its own route if prep volume is high) — **open question O-D1** | It is a short history list. Could be a tab. |
| D2 New prep run | route | **route** (mobile) / **drawer** (Store Manager desktop) | Mobile: full-screen (attendant's task at the bench). Desktop: drawer — it is output + inputs + yield. |
| D3 Daily count (blind) | route (mobile) | **route** (mobile) | The whole count, on a phone, blind. Full-screen. |
| D4 Count verification | route | **route** | Adjudication with signing. Heavy. |
| D5 Spot count | route | **drawer** | Pick a few items, enter counts, sign. Small. Opens from the on-hand table. |
| D6 Log waste (Central Store) | route | **drawer** | Item + qty + reason. Opens from on-hand or the hub. Mobile: full-screen. |

**Net D:** 6 routes → **2–3 routes** (D3, D4, maybe D1) **+ 3 drawers** (new prep [desktop], spot count, log waste). All fold into a **Stock & counts hub**.

**Slice E — Branch day close**

| Screen | Was | Verdict | Why |
|---|---|---|---|
| E1 Day overview | route | **route** | The branch's daily position — a workspace. |
| E2 End-of-day count & close | route | **route** | Five departments, gaps, reasons, one signature. Heavy. |
| E3 Next-morning opening | route (mobile) | **route** (mobile) | Department head's phone task. Full-screen. |
| E4 Reopen a closed day | route | **drawer** | One reason field + a recompute confirm. Opens from E1. |
| E5 Log waste (branch dept) | route (mobile) | **route** (mobile) / drawer on F6 for the manager | Phone task → full-screen for the head. |

**Net E:** 5 routes → **3–4 routes** + 1 drawer (reopen).

**Slice F — Catalog, par, dashboards, reports**

| Screen | Was | Verdict | Why |
|---|---|---|---|
| F1 Item catalog list | route | **route** | A list you filter and manage. Lives under **Catalog**. |
| F2 Item create / edit | route | **drawer** | Name + type + units + scope. Opens from F1. |
| F3 Par levels | route | **drawer** (Store Manager, from on-hand) / **route** (mobile, dept head) | Item + number. Tiny. Mobile dept-head view is full-screen. |
| F4 Central Store stock (on-hand) | route | **route** — the main surface of the **Stock & counts hub** | The live position + drill point. |
| F5 Stock ledger drill | route | **route** | The append-only proof surface. Reached from any stock row. |
| F6 Branch aggregate | route | **route** — the **Branch** hub for a branch manager | Their whole branch in one place. |
| F7 Director rollup | route | **route** — the Director **Overview** | Company-wide workspace. |
| F8 Accountant reporting | route | **route** — the Accountant **Overview** | The money view. |
| F9 Reports (shortfall/variance/yield) | route | **route** (tabs) — lives under **Reports** | Real filterable reports. |

**Net F:** 9 routes → **7 routes** + 2 drawers (item edit, par levels-desktop).

## Revised totals

| | Routes | Drawers | Bands/panels | States | Modals |
|---|---|---|---|---|---|
| Shared shells | — | — | — | — | Sign sheet |
| A | 7 + Purchasing hub + Attendant worklist = **9** | 4 | 2 | — | — |
| B | 3 | — | — | — | — |
| C | 6 | — | 1 | — | — |
| D | 3 (incl. hub if D1 folds: 2) | 3 | 1 | — | — |
| E | 4 | 1 | — | — | — |
| F | 7 (Stock hub shared w/ D) | 2 | — | — | — |
| **Total** | **~24 routes** (several shared across roles) | **~11 drawers** | **~5 bands** | **1 state** | **1 modal** |

Down from ~41. Fewer destinations, every action next to its record, one
workspace per domain.

## New / changed shared primitives (add to Slice A)

- **Right-side drawer** [new ui2: `sheet`] — 420–520px, slides from the right,
  scrim behind, header + body + sticky footer with the primary action. Used by
  ~11 flows. Design once in Slice A.
- **Hub landing shell** — page header + KPI strip + one or more **bands** (a band
  = titled section with a filter control and a list). The Purchasing hub, the
  Stock & counts hub, the Branch hub, the two company Overviews all share it.
- **Band** — titled list section with an inline filter and per-row actions;
  collapses to an empty line when its filter returns nothing (the A1
  Needs-attention pattern, generalised).
- The **sidebar** loses the "Purchases" item added mid-session; **"Receiving"**
  is Attendant-only, **"Purchasing"** is Store-Manager. (DESIGN_SYSTEM §11 — the
  active-item treatment is now brighter text + a caramel underline, no fill.)

## Open questions (from the audit) — resolved 2026-09-09

Owner: "go with your recommendation as the default; I'll correct against the
visual design." All five settled as stated; each is now reflected in the
per-slice tables above.

- **O-C1 — Discrepancy resolution (C6):** ✅ **Route.** It is a signed decision
  record (outcome picker + ledger write), not a quick edit — earns a full
  screen. Reached from the alert inbox band / C4.
- **O-D1 — Prep runs list (D1):** ✅ **Its own route**, under a "Prep" nav item
  — not folded into the Stock & counts hub. Prep is a distinct daily rhythm for
  the attendant, not a slice of stock.
- **O-D2 — New prep run, desktop:** ✅ **Drawer.** The Store Manager rarely logs
  prep themselves; mobile stays the primary full-screen route for the attendant.
- **O-E1 — Branch waste (E5), for the manager:** ✅ **Drawer** on the Branch hub
  for the Branch Manager; the Department Head keeps the full-screen mobile route.
- **O-A1 — Attendant Receiving worklist vs. Purchasing hub:** ✅ **Separate
  simpler screen** (confirmed earlier) — not the hub with AP hidden.

---

# Slice A — Buying, Receiving & Supplier AP

Flows 1, 2 (2a–2e), 14, 15, 16, 17 (17a). This slice also delivers all the
shared shells above.

### A1 — Central Store dashboard *(shell + landing)*

- **Route intent.** Store landing / home for hub-org store roles.
- **Roles / device.** Store Manager (desktop), Store Attendant (desktop; the
  attendant also has a mobile rail). 
- **Purpose.** One glance at what needs doing at the Central Store: low-stock
  items, expected deliveries, receipts awaiting an invoice, counts to verify,
  open discrepancies.
- **States.** `loading` · `populated` · `empty` (nothing outstanding) · `error`.
- **Key elements.** KPI strip (on-hand value, low-stock count `<Badge>`,
  outstanding AP total — *Store Manager only*, open discrepancies). Action
  lists: "Expected deliveries" (status dots), "Receipts awaiting invoice"
  (*Store Manager only*), "Counts to verify" (*Store Manager only*), "Low
  stock — consider buying". Each row deep-links into its flow.
- **Does NOT show.** For the **Attendant**: the AP total, the receipts-awaiting-
  invoice list, and anything from Supplier AP. Sales/revenue figures (this is a
  store, not a POS).
- **Breakpoints.** Store Manager desktop; Attendant desktop primary, mobile rail
  secondary.

### A2 — Suppliers / AP landing page

> **▸ Consolidation (2026-09-10):** A2 absorbs **A11 (supplier aging)**. It is
> the one place for "who we buy from" *and* "our AP position". No separate aging
> report, no Reports tab for it.

- **Route intent.** Supplier index **+ the AP position across all suppliers**.
- **Roles / device.** Store Manager (desktop, full control); Accountant
  (desktop, read + reconciliation entry); Director (desktop, read). Desktop only.
- **Purpose.** Find a supplier; see default terms, what's owed, and how old the
  debt is — at a glance, filterable, exportable.
- **States.** `loading` · `populated` · `empty` (no suppliers — first-run) ·
  `error` · `permission-denied` (Attendant).
- **Key elements.**
  - **KPI strip** (*Store Manager + Accountant + Director only*): Total invoiced
    (period) · Total paid · Outstanding · Overdue >30d. On the Attendant this
    page is not reachable at all.
  - **Table:** Supplier · default terms (dot+label: *Invoice to follow* /
    *Pay now*) · last purchase · **Invoiced** · **Paid** · **Current** ·
    **1–30** · **31–60** · **60–90** · **90+** · **Outstanding**. The old thin
    aging mini-bar is replaced by these figures. `Disputed` invoices flag inline
    on the supplier row. Row → A3 detail.
  - **Filters:** supplier search · terms · **age bucket** · **date range** ·
    has-balance.
  - **Export** on the page header (was A11's export).
  - "New supplier" (Store Manager only) → A3-create drawer.
- **Does NOT show.** The KPI strip / money columns to anyone but Store Manager,
  Accountant, Director. Nothing at all to the Attendant (permission-denied).
  Stock quantities (this is money).
- **Breakpoints.** Desktop only.

### A3 — Supplier detail / create-edit

> **▸ Consolidation (2026-09-09):** detail stays a **route** (it is the supplier
> workspace — AP panel, invoices, payments, history). **Create / edit becomes a
> drawer**, also reachable inline from the New-purchase drawer.

- **Route intent.** One supplier — its profile and its AP position.
- **Roles / device.** Store Manager (desktop, create/edit + everything);
  Accountant (desktop, read + reconciliation); Director (desktop, read).
- **Purpose.** Maintain the supplier record; see its invoices, payments, and
  reconciliation state.
- **States.** `loading` · `populated` · `empty` (new supplier form) ·
  `submitting` · `error` · `permission-denied` (Attendant).
- **Key elements.** Profile: name, contact, **default payment terms**
  (*Invoice to follow* / *Pay now*). AP panel (*Store Manager + Accountant +
  Director*): invoices list with status dots (`UNPAID` / `PARTIALLY_PAID` /
  `PAID` / `Disputed`), payments list, "Record payment" (Store Manager /
  Accountant), "Reconcile statement" (Accountant), aging buckets. Purchase
  history.
- **Does NOT show.** The AP panel to the Attendant (they can't reach this screen
  at all).
- **Breakpoints.** Desktop only.

### A4 — New Purchase (expected delivery)

> **▸ Consolidation (2026-09-09):** **now a right-side drawer** off the Purchasing
> hub, not a route. Supplier picker + a short **Variant A-lite** line grid
> (item / expected qty / estimated unit price, pre-filled from last price, styled
> as an estimate — dashed inputs, muted total). "Save" → an `Awaiting delivery`
> row appears in the hub's INBOUND band. Owner confirmed "expected price shows"
> (A4 keeps a price column; it is an estimate, not a costed line).

- **Route intent.** Record an intended purchase.
- **Roles / device.** Store Manager only. Desktop primary; usable on mobile
  (the manager may raise it from the market).
- **Purpose.** Log what's been ordered so it shows on the dashboard and can
  pre-fill a goods receipt. **Not a PO.**
- **States.** `loading` · `empty` (fresh form) · `partially-filled` (draft
  saved) · `submitting` · `error`.
- **Key elements.** Supplier picker (shows default payment terms + last purchase
  date). Line-entry grid: item (scoped to raw + stocked catalog), expected qty
  (buy unit), expected unit price (pre-filled from last price). Save →
  `Awaiting delivery`. No approval control. No "how bought" field.
- **Does NOT show.** Any approval / authorisation step. Any cost total framed as
  a commitment — it's an estimate.
- **Breakpoints.** Desktop + mobile.

### A5 — Expected deliveries list

> **▸ Consolidation (2026-09-09):** **no longer its own screen.** For the Store
> Manager it is the **INBOUND band** of the Purchasing hub. For the Attendant it
> is the **Receiving worklist** (a separate, simpler Attendant-only route — no
> KPIs, no history, no AP). Same rows, same "Receive →" action, two contexts.

- **Route intent.** What's on its way in.
- **Roles / device.** Store Manager (desktop), Attendant (desktop + mobile —
  they need it when goods arrive).
- **Purpose.** Track outstanding purchases; start a goods receipt from one.
- **States.** `loading` · `populated` · `empty` · `error`.
- **Key elements.** Table: supplier, expected lines summary, age, status dot
  (`Awaiting delivery` / `Overdue`). Row action: "Receive" → A6 pre-filled.
  "Cancel" (Store Manager only) for a purchase that never came.
- **Does NOT show.** Cost commitments; AP.
- **Breakpoints.** Desktop + mobile (Attendant).

### A6 — New Goods Receipt

- **Route intent.** Record what physically arrived.
- **Roles / device.** Store Attendant (mobile primary — they're at the delivery
  door) and Store Manager (desktop). **Shared screen, role-identical content.**
- **Purpose.** The receipt *is* the record. Capture actual item / qty / price,
  sign it, move stock.
- **States.** `loading` · `empty` (blank receipt) · `partially-filled` (draft) ·
  `pre-filled` (from an expected delivery) · `submitting` · `mid-signature`
  (Sign sheet) · `error` · `offline` (held as local draft; ledger writes + the
  `Received` status apply on reconnect — banner shown) · `price-alert` (one or
  more lines flagged).
- **Key elements.** Header: supplier, **payment-terms toggle** (*Invoice to
  follow* / *Pay now*, defaulted from supplier), invoice / delivery-note number,
  invoice date. Line-entry grid: item, qty (buy unit), unit price; per-line
  **price-change alert** (dot+label, warning tone, inline, non-blocking) when
  price exceeds the item's last price by the configured %; per-line **damage
  note** field (good qty recorded, damaged qty + reason captured as a supplier
  claim — never a stock line). Footer: receipt total, "Sign & save" → **Sign
  sheet**.
- **On save.** `receive` ledger entry per line at the Central Store; item
  current cost := entered price (latest-price). `Invoice to follow` → status
  `Received — invoice pending` + Store Manager notified. `Pay now` → header
  shows Paid (cash, = total), status `Received — paid`, no AP.
- **Does NOT show.** Anything to "check against" (no PO reconciliation panel).
  Weighted-average cost (costing is latest-price). Damaged stock as an on-hand
  line.
- **Breakpoints.** **Attendant mobile + Store Manager desktop** — both first-
  class.

### A7 — Goods Receipt detail (signed) + print

- **Route intent.** A completed receipt.
- **Roles / device.** Store Attendant (mobile + desktop), Store Manager
  (desktop). Accountant (desktop, read — it backs an invoice).
- **Purpose.** The immutable signed record; the hard copy for the store's file.
- **States.** `loading` · `populated` · `error`. Sub-status via dot+label:
  `Received — invoice pending` / `Received — paid` / `Invoice recorded`.
- **Key elements.** Read-only line-entry grid, signature block (signer name in
  signature font, timestamp), damage-note / supplier-claim callout if any,
  price-alert history if any, **Print** action. Link to the linked supplier
  invoice once recorded.
- **Does NOT show.** Any edit affordance (immutable). Payment status to the
  Attendant beyond the receipt's own `Paid` stamp.
- **Breakpoints.** Desktop + mobile.

### A8 — Invoices to record *(queue)*

> **▸ Consolidation (2026-09-09):** **a band / saved filter**, not a route. The
> `Received — invoice pending` rows already surface in the Purchasing hub's
> INBOUND band with an **Add invoice** action; a "Needs invoice" filter chip on
> the hub HISTORY band gives the same list when the manager wants to work through
> them in bulk. One invoice can still bundle several receipts (Flow 14) — the
> drawer (A9) has a receipt multi-select.

- **Route intent.** Receipts that need an invoice attached.
- **Roles / device.** Store Manager only. Desktop.
- **Purpose.** Turn `invoice pending` receipts into AP.
- **States.** `loading` · `populated` · `empty` (nothing pending) · `error` ·
  `permission-denied` (everyone else, esp. Attendant).
- **Key elements.** List of `Received — invoice pending` receipts grouped by
  supplier (so several can be bundled into one invoice). Row → A9.
- **Does NOT show.** `Pay now` receipts (they never enter AP).
- **Breakpoints.** Desktop only.

### A9 — Record supplier invoice

> **▸ Consolidation (2026-09-09):** **now a right-side drawer.** Opens from an
> "invoice pending" row (hub INBOUND band or Suppliers → supplier detail).
> Receipt multi-select (bundle several from one supplier), invoice no. / date /
> amount, mismatch callout. "Save" → `UNPAID` invoice, row moves to
> `Invoice recorded`. Still Store-Manager-only; `permission-denied` handled by
> the drawer never being offered.

- **Route intent.** Enter an invoice against one or more receipts.
- **Roles / device.** Store Manager only. Desktop.
- **Purpose.** Create the `UNPAID` supplier-invoice record.
- **States.** `loading` · `populated` · `submitting` · `error` ·
  `mismatch` (billed ≠ receipt total) · `duplicate` (invoice number already
  exists for the supplier — blocked) · `permission-denied`.
- **Key elements.** Receipt(s) selector (one supplier; multi-select to bundle),
  combined receipt total shown as "our figure". Fields: invoice number, invoice
  date, amount billed. **Mismatch callout** (dot+label warning) with the
  difference and two choices: record at billed amount (opens a tracked dispute)
  or hold. Save → `UNPAID` invoice, supplier balance up.
- **Does NOT show.** Any stock lines as editable (stock already moved). A
  payment step (that's A10).
- **Breakpoints.** Desktop only.

### A10 — Record supplier payment

> **▸ Consolidation (2026-09-09):** **now a right-side drawer.** Opens from a
> supplier row (Suppliers, or the Purchasing hub "Owed" drill) or an unpaid
> invoice. Same drawer for Store Manager (cash on the spot) and Accountant (bank
> settlement); the record shows who posted it. Allocation across invoices,
> partial payments, overpayment → supplier credit.

- **Route intent.** Log a payment to a supplier.
- **Roles / device.** Store Manager (desktop; cash-on-the-spot) **or**
  Accountant (desktop; bank settlement). Same screen, same record.
- **Purpose.** Reduce what's owed; move invoice statuses.
- **States.** `loading` · `populated` · `submitting` · `error` ·
  `overpayment` (payment > outstanding → allowed, excess becomes supplier
  credit) · `permission-denied` (Attendant, Director).
- **Key elements.** Supplier's outstanding invoices (oldest first) with amounts
  outstanding. Payment fields: amount, date, method (cash / bank / M-Pesa),
  reference. Allocation control across invoices (default oldest-first).
  Post-save: each touched invoice's status recomputed (`UNPAID` →
  `PARTIALLY_PAID` → `PAID`).
- **Does NOT show.** An "edit payment" affordance — payments are immutable;
  correction is a reversal entry (negative allocation + reason) then re-entry.
- **Breakpoints.** Desktop only.

### A11 — Supplier aging report  *(FOLDED INTO A2, 2026-09-10)*

> **▸ Consolidation (2026-09-10, owner decision):** aging is not a separate
> destination — it **is** the AP position of the Suppliers list. Merged into A2.
> A2 is now the **Suppliers / AP landing page**:
> - **KPI strip** carries the AP totals: Total invoiced (period) · Total paid ·
>   Outstanding · Overdue >30d (all gated to Store Manager + Accountant +
>   Director; the Attendant never reaches A2).
> - **Table** gains the age-bucket columns: Supplier · Terms · Last purchase ·
>   Invoiced · Paid · Current · 1–30 · 31–60 · 60–90 · 90+ · Outstanding. The
>   thin aging mini-bar from the old A2 is replaced by these real figures.
> - **Filters** gain an **age-bucket** chip and a **date-range** chip alongside
>   supplier search / terms / has-balance.
> - **Export** lives on the page header (was A11's export).
> - `Disputed` invoices flag inline on the supplier row.
> - Row → A3 supplier detail (unchanged drill-down).
> The Purchasing hub's "Owed (AP)" KPI now links to A2, not to a separate report.
> No Reports tab for aging.

- **Purpose (retained).** "Our position" — what's owed, to whom, how old.
- **Roles / device.** Store Manager, Accountant, Director. Desktop. **Not
  Attendants** (whole page is permission-denied for them).
- **Does NOT show.** Anything to the Attendant. Stock quantities (this is money).

### A12 — Supplier statement reconciliation

- **Route intent.** Work a supplier's month-end statement against our AP.
- **Roles / device.** Accountant only. Desktop.
- **Purpose.** Match statement lines to our invoices/payments; record reasoned
  adjustments; mark the period reconciled.
- **States.** `loading` · `populated` · `submitting` · `error` ·
  `matched` (all lines reconcile) · `dispute-open` (a specific invoice
  disputed) · `permission-denied` (everyone else).
- **Key elements.** Two-column match view (our AP vs. statement), matched /
  unmatched highlighting. Per difference: "Record adjustment" with a **mandatory
  reason**; adjusts the invoice's billed / outstanding figure only. "Mark
  reconciled" for the period (Accountant name recorded). `Disputed` marker on an
  invoice; resolution path (credit note → adjustment, or concede at supplier's
  figure with a reason). Export / print (optional).
- **Does NOT show.** Any control that changes a stock quantity or a ledger row —
  the Accountant cannot move stock. Only the money figure on an invoice is
  adjustable.
- **Breakpoints.** Desktop only.

---

# Slice B — Requisition & Branch Approval

Flows 7 (7a), 8 (8a, 8b). Reuses: sidebar/rail, line-entry grid (variant B —
"quantity only"), Sign sheet, signed-document view + print, status set,
universal empty/loading/error/permission-denied states.

**Model, as finalised with the owner (2026-09-10):**
- A branch runs **requisitions** (morning / afternoon / evening / ad-hoc — the count is
  not fixed; a requisition is opened whenever stock is needed). Opening a requisition creates
  the branch requisition document with one **section per department** (Kitchen,
  Pastry, Barista, Service, Housekeeping).
- Each **department head fills their own section** — framed to the head as "my
  requisition form". They see **only their section and only their department's
  catalog slice** (prepped + stocked items, never raw). Sections build in
  isolation; the manager sees a section **only once it is submitted**.
- Heads submit **when ready, independently** — a slow or absent department never
  blocks the others. Every submit fires an **immediate push + in-app
  notification** to the branch manager (no priority flag — a requisition is a
  requisition).
- The branch manager reviews **all submitted sections together on one screen**
  (B4) and approves the requisition with **one PIN signature — all-or-nothing**. On
  approval each department's section travels to the Central Store as its **own
  requisition line-up within that branch** (Slice C dispatches per department).
- **Hard gate.** No auto-approve, no timer, **no fallback approver, no Director
  escalation**. If the manager is off-shift the requisition just **waits** at
  `awaiting-approval`; the manager signs from their phone, from anywhere.
- **States a requisition moves through:** `draft` · `awaiting-approval` ·
  `partially-filled` (some sections in, others not) · `returned` (manager bounced
  a section back to its head) · `approved` · `dispatched` (read-only echo once
  Slice C acts).

### B1 — Branch requisitions list

- **Route intent.** The branch's requisition activity — a list you live in.
- **Roles / device.** Branch Manager (**desktop**), Department Head (**mobile** —
  sees only requisitions relevant to their department; opens their own section from a
  row).
- **Purpose.** See open / past requisitions; open a new requisition; jump straight to the
  section (head) or the approval (manager) that needs the user.
- **States.** `loading` · `populated` · `empty` (no requisitions today) · `error` ·
  `permission-denied` (a non-branch role — falls back to the universal state).
- **Key elements.** Requisitions list, newest first: requisition label (morning / afternoon /
  evening / ad-hoc), opened-by + time (mono), **status dot** from the requisition state
  set (`Draft` / `Awaiting approval` / `Partially filled` / `Returned` /
  `Approved` / `Dispatched` — tones per the Slice A status set), **per-department
  fill indicator** (one tick per department section that is `Submitted`; N of 5),
  and the primary row action — **"Open my section"** (head, if theirs isn't
  submitted) or **"Review & approve"** (manager, once ≥1 section is in).
  **"Open new requisition"** button in the header (Branch Manager or any Department
  Head). Counts use `<Badge>`.
- **Does NOT show.** To a Department Head: any other department's section
  contents — only the anonymous fill-tick count. To anyone here: the store's
  dispatch decisions or availability (Slice C). No priority / urgent flag.
- **Breakpoints.** Branch Manager desktop (sidebar + top bar shell, table rows);
  Department Head mobile (branch mobile header / icon rail, stacked cards).

### B2 — Department requisition section (fill)

- **Route intent.** One department head's own section of an open requisition — their
  whole job at that moment.
- **Roles / device.** Department Head only, **mobile** (full-screen — a phone has
  no room for a drawer and this is the user's entire task). The Branch Manager
  never opens B2 — they reach the same content inside B4 on desktop.
- **Purpose.** Say what this department needs this requisition, in under 5 minutes.
- **States.** `loading` · `empty` (not started — pre-suggested lines offered) ·
  `partially-filled` (draft, some quantities entered) · `submitting` ·
  `submitted` (read-only; **"Recall"** available while the requisition is still
  `awaiting-approval` / `partially-filled`) · `returned` (manager bounced it back
  with a note — banner + the note, editable again) · `error` · `offline` (held
  locally, submits on reconnect).
- **Key elements.** **Line-entry grid variant B ("quantity only")** scoped to
  **this department's catalog slice** (prepped + stocked items — **never raw
  ingredients**, data-enforced): per line — item name, **current on-hand**
  (derived from this department's ledger, mono), **par** (mono), and a
  **pre-suggested qty = max(par − on-hand, 0)** pre-filled into an editable qty
  stepper, with the entered value shown against the suggestion when they differ.
  **"Add item"** (picker limited to the slice). Free-text **"note line"** for
  something not in the slice (the manager can convert it to a real line at B4).
  Sticky **"Submit section"** at the bottom. **"Recall"** when already submitted.
- **Does NOT show.** Any other department's items or section. Raw ingredients.
  The store's on-hand or costs. Any priority / urgent toggle. No signature (the
  manager's single signature at B4 covers the whole requisition).
- **Breakpoints.** Mobile only (390px reference).

### B3 — (removed — folded into B1/B2)

### B4 — Branch manager approval view

- **Route intent.** Review, edit and sign the whole branch requisition.
- **Roles / device.** Branch Manager only. **Desktop.**
- **Purpose.** The hard gate. See every submitted department section at once,
  change any line (with a reason), sign **once**.
- **States.** `loading` · `populated` · `one-section-edited` (a section carries
  unsaved `requested → approved` changes) · `some-sections-missing` (**Not
  submitted** shown per absent department) · `submitting` · `mid-signature` (Sign
  sheet up) · `approved` (read-only signed document + Print) ·
  `already-approved` (opened after the fact — read-only) · `error` · `offline`
  (review only; Approve & sign completes on reconnect) · `permission-denied`
  (a Department Head who reaches the route — universal permission-denied state).
- **Key elements.** All submitted department sections in one scroll, each a
  labelled group: its lines with **item / on-hand / par / requested qty**;
  **inline edit** of any quantity **up or down**; **delete line**; **add line**
  into any section (from that department's slice); a **reason is required for any
  change** (a compact reason field on the edited row). Every change captured as a
  **`requested → approved` diff** with the manager + timestamp. A **running
  total** per section and for the requisition. Sections **Not submitted** show as such
  with **"Fill it myself"** / **"Bounce back to head"** (with a note → sets that
  section `returned`) / **"Send without"**. **"Approve & sign"** (one signature,
  whole document, **all-or-nothing**) → **Sign sheet** → **signed-document view**
  of the committed requisition with the signature block + **Print** (per the
  print-layouts follow-up). On approve: requisition → `approved` and each department's
  line-up enters the Central Store dispatch queue; **every affected department
  head is notified with their diff**; the requisition closes to section edits.
- **Does NOT show.** A per-section signature (one signature covers all). Any
  auto-approve / timer / escalation affordance (the gate is hard — it just
  waits). Partial-approve controls (all-or-nothing). The store's availability
  (Slice C).
- **Breakpoints.** Desktop only (sidebar + top bar shell; min-height artboard so
  the sidebar clone stretches full height).

### Branch-roles sidebar nav set (drawn once here, reused by C and E)

A new **sidebar variant** — clone of the Slice A store sidebar (espresso
gradient, line icons, active = brighter text + caramel underline, no fill), with
the **branch nav set**:

| Nav item | Branch Manager (desktop) | Department Head (mobile) |
|---|---|---|
| **Branch** | branch aggregate (per-department) — Slice F | — (not shown) |
| **Requisitions** | B1 → B4 | B1 (their requisitions) → B2 |
| **Deliveries** | Slice C incoming (all depts) → confirm-on-behalf | Slice C (their dept) → confirm |
| **Day** | Slice E day overview → close | Slice E next-morning opening |
| **Waste** | (drawer on Branch aggregate) | Slice E log waste |

- **Branch Manager:** full sidebar + top bar shell, as Slice A.
- **Department Head:** **mobile** only — a compact **branch mobile header**
  (branch name + requisition context + overflow) over the full-screen task; no
  persistent sidebar. If an icon rail is shown at all it carries only
  Requisitions / Deliveries / Day / Waste (no Branch item). Walled-off: the head
  never sees another department, store purchasing, or supplier costs anywhere in
  this shell.

---

# Slice C — Dispatch, Branch Receiving & Discrepancy

Flows 9 (9a, 9b), 10 (10a, 10b), 11, 20. Reuses: sidebar/rail, line-entry grid,
Sign sheet, signed-document view + print (delivery note), status set.

### C1 — Central Store dispatch queue

- **Route intent.** Approved requisitions waiting to be fulfilled.
- **Roles / device.** Store Attendant (picks/packs) and Store Manager
  (confirms/signs). Desktop primary; Attendant may use mobile on the floor.
- **Purpose.** Work the queue **oldest-first** (no priority flag); fulfil per
  department.
- **States.** `loading` · `populated` · `empty` · `error`.
- **Key elements.** **One card per branch**, expandable into its five department
  sections; age; per-branch progress (which departments dispatched).
  Row → C2.
- **Does NOT show.** Branch-internal requisition history / approval edits beyond
  the approved figures. Sales data.
- **Breakpoints.** Desktop + mobile (Attendant).

### C2 — Fulfil & dispatch (per branch → per department)

- **Route intent.** Enter dispatched quantities and confirm each department's
  dispatch.
- **Roles / device.** Store Attendant + Store Manager. Desktop primary; mobile
  possible.
- **Purpose.** Dispatch whatever's available (partial is normal); sign each
  department's dispatch; print delivery notes.
- **States.** `loading` · `populated` · `partially-filled` · `submitting` ·
  `mid-signature` (Sign sheet, per department) · `in-transit` (after confirm) ·
  `short` (requested − dispatched > 0 on lines) · `substitution` (added line) ·
  `error` · `offline` (confirm held locally; `dispatch_out` + In Transit on
  reconnect; delivery note still prints from the local draft).
- **Key elements.** Lines grouped **by department** → one dispatch per
  department. Per line: requested, **available on hand** (Central Store derived),
  **dispatched qty** input pre-filled `min(requested, available)`; shortfall
  shown. **Add substitute line** (not on the requisition) + set original to zero.
  Per department: "Confirm & sign" → Sign sheet → `dispatch_out` at the item's
  **current cost, frozen on the line**; department dispatch → **In Transit**;
  **Print delivery note** (optional).
- **Does NOT show.** A block on partial fulfilment (it's expected, not an error).
  Branch-side confirmation status yet (that's C4). A re-approval step for
  substitutions.
- **Breakpoints.** Desktop primary; Attendant mobile secondary.

### C3 — Delivery note (signed) + print

- **Route intent.** The document the driver carries, per department.
- **Roles / device.** Store (generate/print, desktop/mobile); Department Head
  (view on mobile when receiving); Branch Manager (view).
- **Purpose.** Hard copy of one department's dispatch. Optional — nothing blocks
  if there's no printer.
- **States.** `loading` · `populated` · `error`.
- **Key elements.** Store signature block, per-line dispatched qty, shortfall /
  substitution annotations, branch + department, **Print**.
- **Does NOT show.** Cost (the driver doesn't need it — or show it, owner's call
  at design; default: hide cost on the driver copy).
- **Breakpoints.** Print layout + on-screen (desktop + mobile).

### C4 — Branch incoming dispatches list

- **Route intent.** What's arriving / arrived for this branch.
- **Roles / device.** Department Head (mobile — **only their department's**
  dispatches); Branch Manager (desktop — all five, for oversight and
  confirm-on-behalf).
- **Purpose.** Find the dispatch to confirm; see what's still unconfirmed.
- **States.** `loading` · `populated` · `empty` · `error` · `in-transit` ·
  `partially-confirmed` (some departments in) · `discrepancy-open`.
- **Key elements.** Per dispatch: status dot (`In Transit` / `Confirmed` /
  `Closed` / `Discrepancy open`), department, line count, age. Department Head
  sees only theirs; Branch Manager sees all with a per-department confirm state.
- **Does NOT show.** To a Department Head: other departments' dispatches or
  lines.
- **Breakpoints.** Department Head mobile + Branch Manager desktop.

### C5 — Confirm branch receipt (per department)

- **Route intent.** A department head confirms their own dispatched lines.
- **Roles / device.** Department Head, **mobile** (primary). Branch Manager,
  desktop — **confirm-on-behalf** of an absent head (real signer recorded).
- **Purpose.** Turn an In-Transit dispatch into department stock at the actual
  received quantity; sign.
- **States.** `loading` · `populated` (dispatched qty pre-filled) ·
  `partially-filled` · `submitting` · `mid-signature` (Sign sheet) ·
  `confirmed` · `discrepancy` (confirmed ≠ dispatched → raises transit
  discrepancy) · `substitution` (both the zeroed original and the added
  substitute shown) · `error` · `offline` (confirmation + any discrepancy post
  on reconnect).
- **Key elements.** Line grid: item, requested (ref), **dispatched qty
  pre-filled**, **confirmed qty** input. On "Sign & confirm" → Sign sheet →
  `dispatch_in` at **confirmed qty** at the **department location (branch org)**,
  cost = **frozen carried cost**. If any line differs → **transit discrepancy**
  raised, alert fan-out (Store Manager + Branch Manager + Directors), dispatch
  stays **open**. Department portion → `Confirmed`; whole dispatch `Closed` only
  when all departments confirmed. Print (optional).
- **Does NOT show.** Other departments' lines. A way to close the whole dispatch
  from one department. The frozen cost as editable.
- **Breakpoints.** **Department Head mobile + Branch Manager desktop.**

### C6 — Discrepancy resolution

- **Route intent.** Store Manager resolves an open transit discrepancy.
- **Roles / device.** Store Manager only. Desktop.
- **Purpose.** Record a signed outcome; write the matching ledger entry; close
  the loop to Branch Manager + Directors.
- **States.** `loading` · `populated` · `submitting` · `mid-signature` (Sign
  sheet) · `resolved` · `stalemate` (Store Manager / Branch Manager disagree →
  stays open, Director adjudicates) · `error`.
- **Key elements.** Discrepancy summary: dispatched, confirmed, gap (qty +
  value at frozen cost), department / branch, who confirmed, when. Outcome
  picker: **Found & re-delivered** (spawns a follow-up dispatch cycle) /
  **Transit loss — write off** (`adjustment` at Central Store, reason "transit
  loss") / **Miscount corrected** (`adjustment` at department to corrected qty,
  reason "receiving miscount"). "Sign resolution" → Sign sheet. Notifies Branch
  Manager + Directors of the outcome.
- **Does NOT show.** An auto-blame field (no one is auto-attributed). A way to
  resolve without a signed outcome.
- **Breakpoints.** Desktop only.

### C7 — Discrepancy / alert inbox (surfaced view)

Not a new shell — a filtered view of notifications + open discrepancies for
Store Manager, Branch Manager, Director, each scoped to what they own. Links
into C6 (Store Manager) or a read-only discrepancy detail (Branch Manager,
Director).

---

# Slice D — Prep & Central Store Count

Flows 3 (3a), 4, 5 (5a), 6. Reuses: sidebar/rail, line-entry grid, ledger table,
Sign sheet, status set.

### D1 — Prep runs list

- **Route intent.** Recent prep activity at the Central Store.
- **Roles / device.** Store Attendant + Store Manager. Attendant mobile primary;
  Store Manager desktop.
- **Purpose.** See what's been prepped; start a new run; spot yield-variance
  flags.
- **States.** `loading` · `populated` · `empty` · `error`.
- **Key elements.** List: output item, inputs summary, actual yield, yield-
  variance flag (dot+label) vs. rolling average, who / when. "New prep run".
- **Does NOT show.** Any recipe / plan (prep is after-the-fact). A branch view
  (prep is Central Store only).
- **Breakpoints.** Attendant mobile + Store Manager desktop.

### D2 — New prep run

- **Route intent.** Record a completed prep batch.
- **Roles / device.** Store Attendant, **mobile** primary. Store Manager desktop.
- **Purpose.** Pick output → record inputs consumed → record actual yield →
  confirm. One atomic ledger transaction.
- **States.** `loading` · `empty` · `partially-filled` (draft) · `submitting` ·
  `confirmed` · `yield-warning` (yield far off the rolling average — non-
  blocking) · `negative-input` (an input goes negative — allowed, flagged) ·
  `error` · `offline` (atomic transaction posts on reconnect).
- **Key elements.** Output item picker (prepped items). **Soft reference** panel:
  "Typical: ~6 kg chicken → ~22 portions" (rolling average — nudge only, never
  validates). Input line grid: item + qty consumed (raw / prepped / stocked).
  Actual yield input. "Confirm" → `prep_consume` per input + `prep_produce` for
  output at the Central Store; output unit cost := Σ input cost ÷ yield. Yield
  variance stored.
- **Does NOT show.** A signature step (prep isn't signed — ledger row records
  who/when). An "edit after confirm" affordance (immutable; corrections via spot
  count / waste). A hard validation on yield.
- **Breakpoints.** Attendant mobile primary; Store Manager desktop.

### D3 — Central Store daily count (Attendant — BLIND)

- **Route intent.** The daily blind count.
- **Roles / device.** Store Attendant, **mobile** primary (also desktop).
- **Purpose.** Produce the observation. Enter counted quantities only.
- **States.** `loading` · `empty` (fresh count for today) · `partially-filled`
  (save & resume) · `submitting` · `mid-signature` (Sign sheet) · `submitted`
  (to Store Manager's verify queue) · `error` · `offline` (submits on
  reconnect).
- **Key elements.** One row per item in the count scope: item, usage unit,
  **counted qty** input. **No expected column, no hint, no variance** — the
  count API returns no expected figure to a `STORE_ATTENDANT` (server-enforced).
  Line note (e.g. "can't find any"). "Sign & submit" → Sign sheet → status
  `Submitted — awaiting verification`. **No `adjustment` entries written yet.**
- **Does NOT show.** Expected on-hand. Variance. The verify screen. Any way to
  reveal expected via drill-down.
- **Breakpoints.** Attendant mobile primary; desktop secondary.

### D4 — Central Store count verification (Store Manager)

- **Route intent.** Adjudicate a submitted count.
- **Roles / device.** Store Manager only. Desktop.
- **Purpose.** Review counted vs. expected vs. variance; accept or return;
  approve & sign; write adjustments.
- **States.** `loading` · `populated` · `reviewing` · `submitting` ·
  `mid-signature` (Sign sheet) · `verified` · `returned` (bounced to Attendant,
  no ledger entries) · `reason-required` (an above-threshold line has no
  reason — Approve blocked) · `error`.
- **Key elements.** Per line: counted (Attendant), **expected** (shown — the
  Store Manager is adjudicating, not observing), **variance** (qty + value).
  Per line: **Accept** (→ `adjustment` at Central Store for counted − expected;
  reason mandatory above threshold) or **Query** (→ return whole count to
  Attendant with a note). "Approve & sign" → Sign sheet → adjustments written,
  count `Verified`, both counter + verifier recorded. Above-threshold variance
  → Director alert. Print (optional).
- **Does NOT show.** A way to edit the Attendant's counted figures (only accept
  / query). A path that writes adjustments without a signature.
- **Breakpoints.** Desktop only.

### D5 — Spot count (Store Manager)

- **Route intent.** Ad-hoc count of a few items outside the daily rhythm.
- **Roles / device.** Store Manager only. Desktop + mobile.
- **Purpose.** Correct a number that looks wrong, now.
- **States.** `loading` · `empty` · `partially-filled` · `submitting` ·
  `mid-signature` · `done` · `reason-required` · `error`.
- **Key elements.** Item multi-picker; counted qty per item; **expected shown**
  (Store Manager owns the stock, adjudicates directly). "Sign" → `adjustment`
  per corrected item at the Central Store, reason required; above-threshold →
  Director alert. Recorded separately from the daily count so it doesn't distort
  daily-count reporting.
- **Does NOT show.** In the daily-count rhythm reports as a daily count.
- **Breakpoints.** Desktop + mobile.

### D6 — Log waste (Central Store)

- **Route intent.** Record spoiled / expired / damaged store stock.
- **Roles / device.** Store Attendant + Store Manager. Attendant mobile primary.
- **Purpose.** Write a `waste` ledger entry with a reason.
- **States.** `loading` · `empty` · `partially-filled` · `submitting` · `done` ·
  `negative-stock` (allowed, flagged) · `error` · `offline`.
- **Key elements.** Item picker (Central Store items), qty, **mandatory reason**
  (spoilage / expiry / damage-in-store / prep error / …). Save → `waste` at the
  Central Store at current cost. Optionally note against an originating receipt
  as a supplier claim (links to A7 / A12).
- **Does NOT show.** A signature step (not on the signed-documents list).
- **Breakpoints.** Attendant mobile primary; Store Manager desktop.

---

# Slice E — Branch Day Close

Flows 12 (12a, 12b, 12c), 13. Reuses: sidebar/rail, line-entry grid, ledger
table, Sign sheet, signed-document view + print, status set.

### E1 — Branch day (open/close) overview

- **Route intent.** The branch's daily open/close position.
- **Roles / device.** Branch Manager (desktop) primary; Director (desktop,
  read + reopen); Department Head (mobile — their department's opening only).
- **Purpose.** See today's state per department; run the close; handle
  yesterday-not-closed.
- **States.** `loading` · `populated` · `day-open` · `day-closed` · `reopened` ·
  `blocked` (a department has an unconfirmed dispatch — that department can't
  close) · `not-closed` (yesterday still open — flagged) · `error`.
- **Key elements.** Per-department cards: open figure source (carried from last
  close), dispatch-in today, waste today, adjustments, **expected close**,
  **counted close** (once entered), status dot. "Start day close" (Branch
  Manager). "Reopen" (Branch Manager / Director). Aggregate strip — **always
  broken down by department**, never a lone branch total.
- **Does NOT show.** A branch-level-only number with no department breakdown.
  Other branches (unless Director).
- **Breakpoints.** Branch Manager desktop; Director desktop; Department Head
  mobile (opening only).

### E2 — End-of-day count & close (Branch Manager)

- **Route intent.** Count all five departments and close the day.
- **Roles / device.** Branch Manager only. Desktop. (Department heads may assist
  in person; the Branch Manager signs.)
- **Purpose.** Enter counted close per department, reason every gap, sign, close.
- **States.** `loading` · `populated` · `partially-filled` · `submitting` ·
  `mid-signature` (Sign sheet) · `reason-required` (above-threshold gap without
  a reason — Close blocked) · `blocked` (unconfirmed dispatch on a department) ·
  `closed` · `error` · `offline` (adjustments + `Closed` on reconnect).
- **Key elements.** Five expandable department panels; per item: **expected**
  (opening + `dispatch_in` − waste ± adjustments) and **counted** input; gap +
  **reason** field (mandatory above threshold). "Sign" (whole branch, one
  signature) → Sign sheet. "Close day" → `adjustment` per gap at the department
  location; each department's counted close becomes tomorrow's opening;
  branch day → `Closed` (soft). Above-threshold gap → Director alert. Print per
  department (optional).
- **Does NOT show.** A hard lock (close is a soft, reopenable checkpoint). A
  branch-only roll-up without the per-department breakdown. A way to close a
  department with an unconfirmed dispatch.
- **Breakpoints.** Desktop only.

### E3 — Next-morning opening (Department Head)

- **Route intent.** Confirm or recount the department's opening figure.
- **Roles / device.** Department Head, **mobile**.
- **Purpose.** Accept the carried-over close, or recount and flag an overnight
  variance.
- **States.** `loading` · `pre-filled` (from last night's close) · `editing`
  (recount) · `submitting` · `accepted` · `overnight-variance` (morning ≠ last
  close → flagged, `adjustment` "overnight variance", above threshold → Branch
  Manager alert) · `error` · `offline`.
- **Key elements.** Per item: carried close (pre-filled), **recount** input,
  variance indicator. "Accept opening" or "Save recount".
- **Does NOT show.** Other departments. The branch aggregate.
- **Breakpoints.** Mobile only.

### E4 — Reopen a closed day

- **Route intent.** Reopen `Closed` → `Open` with a reason.
- **Roles / device.** Branch Manager or Director. Desktop.
- **Purpose.** Correct a closed day; leave a permanent record.
- **States.** `loading` · `populated` · `submitting` · `reopened` · `error` ·
  `permission-denied` (anyone else).
- **Key elements.** Reason field (**mandatory**); confirmation that re-closing
  recomputes adjustments (superseded ones reversed with linked entries) and any
  already-populated next-morning opening. Reopen record: who / when / why,
  immutable. Frequent-reopen visibility on the Director report.
- **Does NOT show.** A silent reopen (always reasoned + recorded).
- **Breakpoints.** Desktop only.

### E5 — Log waste (branch department)

- **Route intent.** A department head records their department's waste.
- **Roles / device.** Department Head, **mobile** — **their own department only**.
- **Purpose.** `waste` ledger entry at the department location with a reason.
- **States.** `loading` · `empty` · `partially-filled` · `submitting` · `done` ·
  `negative-stock` (allowed, flagged) · `error` · `offline`.
- **Key elements.** **Only this department's items**; qty; **mandatory reason**.
  Save → `waste` at the department location at the carried cost.
- **Does NOT show.** Other departments' items. A signature step.
- **Breakpoints.** Mobile only.

---

# Slice F — Catalog, Par Levels, Dashboards & Reports

Flows 18, 19, 21, plus the aggregate / rollup views implied by §5 and §2. Reuses
every shell; adds the KPI strip and the report table styles.

### F1 — Item catalog list

- **Roles / device.** Store Manager (desktop, full control). Read-only glimpses
  elsewhere are via department-scoped screens, not this list.
- **Purpose.** Find / manage items.
- **States.** `loading` · `populated` · `empty` (first-run) · `error` ·
  `permission-denied` (non–Store-Manager).
- **Key elements.** Table: name, **type** (dot+label: raw ingredient / prepped /
  stocked), buy unit, usage unit, conversion, pack size, department scope
  (chips), Central Store par, `deleted_at` (retired) filter. "New item".
- **Does NOT show.** "Pass-through" (renamed **stocked item**). Any way to scope
  a **raw ingredient** to a department.
- **Breakpoints.** Desktop only.

### F2 — Item create / edit

- **Roles / device.** Store Manager only. Desktop.
- **States.** `loading` · `empty` · `submitting` · `error` ·
  `blocked` (raw ingredient + department scope attempted; or a type change that
  would strand department stock) · `duplicate-name` (warned).
- **Key elements.** Name; **type** (raw / prepped / stocked); buy unit; usage
  unit; **conversion**; **pack size**; **where it may exist** — raw → Central
  Store only (department scope disabled with an explanation); prepped / stocked →
  Central Store + selectable **departments**. Central Store par (optional).
  Retire = soft delete (history preserved).
- **Does NOT show.** A hard delete. A raw-ingredient → department control.
- **Breakpoints.** Desktop only.

### F3 — Par levels (owner of the stock)

- **Roles / device.** Department Head (mobile — **their own department's items
  only**); Store Manager (desktop — **Central Store items only**).
- **Purpose.** Set par per item for the location the actor owns.
- **States.** `loading` · `populated` · `empty` · `submitting` · `error` ·
  `permission-denied` (another department's items).
- **Key elements.** Item + par qty (usage unit). Effect note: department pars
  drive requisition pre-suggestions + low-stock signal; store pars drive the
  store low-stock signal.
- **Does NOT show.** Items outside the actor's location. Another department's
  pars to a Department Head.
- **Breakpoints.** Department Head mobile + Store Manager desktop.

### F4 — Central Store stock (on-hand)

- **Roles / device.** Store Manager + Store Attendant. Desktop primary.
- **Purpose.** Live derived on-hand at the Central Store; drill to ledger.
- **States.** `loading` · `populated` · `empty` · `error` · `negative`
  (items below zero flagged, error tone).
- **Key elements.** Table: item, type, on-hand (derived), usage unit, current
  cost, value, par, low-stock flag, **negative flag**. Row → F5 (ledger drill).
- **Does NOT show.** To the Attendant: nothing extra is hidden here (they see
  operational cost) — but **no Supplier AP**.
- **Breakpoints.** Desktop primary; Attendant mobile secondary.

### F5 — Stock ledger drill (item × location)

- **Roles / device.** Store Manager, Attendant (Central Store); Branch Manager,
  Department Head (their department); Accountant, Director (all, read).
- **Purpose.** The append-only history for one item at one location — proof of
  how on-hand was derived.
- **States.** `loading` · `populated` · `empty` · `error` · `permission-denied`
  (out-of-scope location).
- **Key elements.** Ledger table: date, **type** (dot+label — `receive` /
  `prep_consume` / `prep_produce` / `dispatch_out` / `dispatch_in` /
  `adjustment` / `waste`), qty (+/−), unit cost, value, counterparty
  (supplier / department / branch), user, running on-hand.
- **Does NOT show.** Any edit / delete (append-only). A Department Head another
  department's ledger.
- **Breakpoints.** Desktop primary; mobile read.

### F6 — Branch aggregate (Branch Manager)

- **Roles / device.** Branch Manager (desktop); Director (desktop, any branch).
- **Purpose.** One place for all five departments — live stock, requisition
  sections, incoming/unconfirmed dispatches, discrepancies, open/close position.
- **States.** `loading` · `populated` · `empty` · `error` · `day-open` ·
  `day-closed` · `discrepancy-open`.
- **Key elements.** Per-department breakdown of every figure (**never a lone
  branch total** — §5): stock value, low-stock counts, today's dispatch-in,
  unconfirmed dispatches, waste, adjustments, day status. Cross-links into B4,
  C4, E2.
- **Does NOT show.** The store's purchasing / supplier costs. Other branches
  (Branch Manager). A branch-only number without department breakdown.
- **Breakpoints.** Desktop only.

### F7 — Director rollup

- **Roles / device.** Director only (Accountant has a parallel money-focused
  view — F8). Desktop.
- **Purpose.** All locations, all stock, all supplier balances, all cost /
  variance reporting; receives discrepancy alerts; can reopen a closed day.
- **States.** `loading` · `populated` · `error`.
- **Key elements.** Company-wide KPI strip; per-branch and Central Store
  breakdowns; variance / discrepancy feed; frequent-reopen list; supplier
  balance totals. Drill everywhere (read), reopen (E4), adjudicate stalemated
  discrepancies (read into C6 context).
- **Does NOT show.** Any routine-path approval control (the Director gates
  nothing — §2). Sales contexts mixing in the hub org.
- **Breakpoints.** Desktop only.

### F8 — Accountant reporting (stock valuation & cost)

- **Roles / device.** Accountant only. Desktop.
- **Purpose.** The money view: closing stock value per location, cost of goods,
  **the revaluation effect of latest-price costing** (shown explicitly), waste
  value, prep/dispatch cost, supplier aging.
- **States.** `loading` · `populated` · `error` · `permission-denied` (non-
  Accountant reaching the revaluation breakdown — Director sees a summary, not
  this working view).
- **Key elements.** Valuation table per location + period; **latest-price
  revaluation line** called out separately (the figure that would otherwise
  distort month-end — §2, §4); cost-of-goods; waste value; links to A11 (aging)
  and A12 (reconciliation).
- **Does NOT show.** Any stock-moving control (Accountant cannot move stock).
  Weighted-average figures (costing is latest-price; revaluation is surfaced,
  not smoothed).
- **Breakpoints.** Desktop only.

### F9 — Reports: shortfall / variance / yield

- **Roles / device.** Store Manager, Branch Manager (their branch), Director
  (all), Accountant (cost angles). Desktop.
- **Purpose.** The recurring operational signals: chronic dispatch shortfall by
  department, count variance trends, prep yield variance, overnight variance,
  negative-stock incidents.
- **States.** `loading` · `populated` · `empty` · `error` · scope-filtered per
  role.
- **Key elements.** Filterable tables + simple trend viz; each row deep-links to
  the underlying document. Negative-stock section (Flow 21). Thresholds shown as
  the configured values (Flow 20 / §8 C3).
- **Does NOT show.** A claim to separate "sold" from "stolen" — until automatic
  sale deduction exists, a department's count gap is **consumption + loss
  blended**, and the report says so (§3 Stage 8, §8 C2).
- **Breakpoints.** Desktop only.

---

## Screen count & shared-vs-distinct summary

> **Superseded 2026-09-09** by "§ Consolidation & information architecture"
> above. The pre-consolidation count was ~41 routed screens. Post-consolidation:
> **~24 routes + ~11 drawers + ~5 bands + 2 states + 1 modal.** The table below
> is kept for traceability; read the consolidation section for the live IA.

| Slice | Post-consolidation | Notes |
|---|---|---|
| A | 7 routes (A1, A2, A3-detail, A6, A7, A11, A12) + **Purchasing hub** + **Attendant Receiving worklist** · 4 drawers (new purchase, new supplier, record invoice, record payment) · 2 bands folded into the hub | Slice A also delivers the **drawer** and **hub-landing** shared shells |
| B | 3 routes (B1, B2-mobile, B4) + 1 state | unchanged — already lean |
| C | 6 routes (C1, C2, C3, C4, C5, C6) + 1 band (alert inbox) | O-C1: C6 route vs drawer |
| D | 2–3 routes (D3, D4, maybe D1) + 3 drawers (new prep-desktop, spot count, log waste) → **Stock & counts hub** | O-D1, O-D2 |
| E | 3–4 routes (E1, E2, E3-mobile, E5-mobile) + 1 drawer (reopen) | O-E1 |
| F | 7 routes (F1, F4/Stock hub, F5, F6/Branch hub, F7, F8, F9) + 2 drawers (item edit, par-levels-desktop) | Stock hub shared with D |

**Design sessions (Step 3), in order:** A → B → C → D → E → F. Slice A is the
heaviest — it now also delivers the **right-side drawer**, the **hub-landing
shell**, and the **band** primitive on top of the original shared shells. B–F
reuse them. Each slice is designed, visually reviewed with the owner, and
approved before its build session starts; a later slice's design can run in
parallel with an earlier slice's build.
