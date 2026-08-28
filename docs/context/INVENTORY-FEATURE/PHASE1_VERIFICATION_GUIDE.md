# Phase 1 — Hands-On Verification Guide

**Purpose:** establish what is *actually* implemented, by using it — not by reading
documentation. Written 2026-08-20 for the owner to execute personally.

**Why this exists:** Phase 1 is documented as complete and is deployed to production,
but nobody has sat down and confirmed that claim screen by screen. Phase 2 reuses Phase
1's count, waste, stock-on-hand and ledger components across 5 departments × N branches,
so a defect here multiplies by ~50. This pass is the cheap insurance.

---

## How to use this guide

Work top to bottom. Each check has a **✅ Pass condition** — read it before clicking, so
you're testing against an expectation rather than forming one after the fact.

Mark each check:

| Mark | Meaning |
|---|---|
| **P** | Pass — works as described |
| **F** | Fail — broken, wrong, or errors |
| **?** | Unclear / confusing / ugly but functional |

`?` is as valuable as `F`. A confusing screen that technically works is a real finding —
note it and move on rather than deciding whether it "counts."

Keep notes inline in this file, or in a scratch doc — whatever's faster. What matters is
that every line gets a mark.

---

## Environment

Already running as of this session:

| Service | Where | State |
|---|---|---|
| Postgres | `localhost:5433` (Docker `wendo-postgres`) | up |
| Redis | `localhost:6379` (Docker `wendo-redis`) | up |
| Backend API | `http://localhost:4000` | health green, DB + Redis up |
| Frontend | `http://localhost:3000` | serving |

**If you need to restart later:**

```powershell
docker compose up -d postgres redis
# then, in two terminals:
cd backend  ; pnpm dev
cd frontend ; pnpm dev
```

### Logins

| Role | Email | Password |
|---|---|---|
| Store Manager | `store.manager@wendo.co.ke` | `password123` |
| Store Attendant | `store.attendant@wendo.co.ke` | `password123` |

Both live on the **Central Store** hub organization. Both confirmed working (HTTP 200).

> **Note on the data:** this is your restored production copy. The catalog is real client
> data (Aberdare, Highland, Mt. Kenya suppliers etc.). Feel free to create POs, prep
> records, waste entries and counts — it's local only. Avoid *deleting* the seeded
> records named below, since later checks depend on them.

---

## Already verified for you (API layer)

I checked these directly against the running backend, so you don't need to re-test them.
They're recorded here because they're the load-bearing correctness claims:

| Claim | Result |
|---|---|
| All 7 inventory route groups mounted, 401 unauthenticated | ✅ |
| Attendant blocked from Supplier AP | ✅ hard **403** |
| Attendant blocked from all 7 reports | ✅ hard **403** |
| **D-14 blind count enforced server-side** | ✅ Attendant's API response **omits `expectedQty` entirely** — not merely hidden in UI |
| Stock valuation returns costed lines | ✅ |
| Prep rolling average computes | ✅ 2 samples, avg yield 10.1 |
| Manager token scoped to hub org | ✅ |

**What this does *not* tell us:** whether the screens work, whether the numbers shown are
right, and whether the workflows are usable. That's what you're testing.

---

## Reference data in your local DB

The checks below refer to these real records.

**Purchase orders**

| PO | Status | Supplier | Lines | Value |
|---|---|---|---|---|
| `PO-DEMO-001` | **DRAFT** | Nyeri Highlands Wholesalers | 2 | 11,400 |
| `PO-DEMO-002` | **SENT** | Aberdare Fresh Farm Supplies | 2 | 10,470 |
| `PO-DEMO-AP1` | CLOSED | Nyeri Highlands Wholesalers | 2 | 18,240 |
| `PO-DEMO-AP2` | CLOSED | Aberdare Fresh Farm Supplies | 2 | 12,120 |
| `PO-DEMO-AP3` | CLOSED | Mt. Kenya Bulk Traders | 2 | 6,300 |

**Supplier invoices**

| Reference | Supplier | Status | Amount | Paid |
|---|---|---|---|---|
| `AFF-INV-207` | Aberdare Fresh Farm | **UNPAID** | 12,150 | 0 |
| `NHW-INV-101` | Nyeri Highlands | **PARTIALLY_PAID** | 18,400 | 10,000 |
| `MKB-INV-330` | Mt. Kenya Bulk | **PAID** | 6,300 | 6,300 |

**Stock counts:** two `IN_PROGRESS`, one `SUBMITTED` (awaiting approval)

**Catalog:** 23 items — 16 RAW, 6 PASS_THROUGH, 1 PREPPED (`Prepped Simple Syrup`)

**Prep:** 1 recipe + 2 records against `Prepped Simple Syrup` (yields 10.2 and 10.0)

---

# PART A — Store Manager, Desktop

Log in as **store.manager**. Use a normal desktop browser window.

## A1 · Dashboard & navigation

| # | Check | ✅ Pass condition | Mark |
|---|---|---|---|
| A1.1 | Land after login | Inventory dashboard loads, no error, no infinite spinner | |
| A1.2 | Read the dashboard | Numbers shown are plausible vs. reference data above — not zeros, not `NaN`, not blank | |
| A1.3 | Every sidebar/nav item | Each one opens a real screen; nothing 404s or dead-ends | |
| A1.4 | Overall first impression | Looks like a finished product, not a prototype | |

## A2 · Item Catalog

| # | Check | ✅ Pass condition | Mark |
|---|---|---|---|
| A2.1 | Open Item Catalog | 23 items listed | |
| A2.2 | Type badges | RAW / PREPPED / PASS_THROUGH visually distinct | |
| A2.3 | Search | Type `Highland` → list filters correctly | |
| A2.4 | Open an item (e.g. `Highland Chicken Breast`) | Detail opens; buy unit `kg`, usage unit `kg`, cost ~490 | |
| A2.5 | Check a conversion item (`Aberdare Fresh Eggs (Tray of 30)`) | Buy unit `tray`, usage `pc`, conversion **30**, cost ~15.33/pc — i.e. the **conversion is applied**, not ignored (D-7) | |
| A2.6 | Department tags visible | e.g. eggs show `KITCHEN, PASTRY` | |
| A2.7 | Create a new item | Saves and appears in list | |
| A2.8 | Try to create a **PREPPED** item | **Should NOT be offered** — prepped items come from recipes only (D-12 as reopened in Flow 3) | |
| A2.9 | Edit an existing item | Change persists after refresh | |
| A2.10 | Movement history | Opening an item shows its ledger entries | |

## A3 · Suppliers

| # | Check | ✅ Pass condition | Mark |
|---|---|---|---|
| A3.1 | Supplier list | 4 suppliers, with item counts (10 / 8 / 4 / 1) | |
| A3.2 | Open `Mt. Kenya Bulk Traders` | Contact `Grace Wanjiru`, phone `0722334455`, 10 linked items | |
| A3.3 | Price history | Chart or sparkline renders for an item with receipts | |
| A3.4 | Assign default supplier | Action works and persists | |
| A3.5 | Create supplier | Saves, appears in list | |

## A4 · Purchase Orders — the core flow

| # | Check | ✅ Pass condition | Mark |
|---|---|---|---|
| A4.1 | PO list | All 5 POs, correct status badges | |
| A4.2 | Filter by status | Works | |
| A4.3 | Open `PO-DEMO-001` (DRAFT) | 2 lines, total **11,400** | |
| A4.4 | **Send** action present | Visible for Manager on a DRAFT PO | |
| A4.5 | Click Send | Confirm step appears; status → SENT | |
| A4.6 | ⚠️ **New PO on desktop** | **Known suspected gap:** the desktop `/purchase-orders/new` route is believed to render the *mobile* step-by-step picker instead of a desktop layout. Confirm whether this is true. | |
| A4.7 | Create a draft PO | Add lines, save, appears as DRAFT | |
| A4.8 | "Suggest order" prefill | Populates from low-stock items | |
| A4.9 | Cancel a PO | Works, with confirm | |

## A5 · Receiving

Use `PO-DEMO-002` (SENT), or the PO you just sent in A4.5.

| # | Check | ✅ Pass condition | Mark |
|---|---|---|---|
| A5.1 | Open receiving for a SENT PO | Lines listed, ordered qty prefilled | |
| A5.2 | Receive **exact** ordered qty | Accepts | |
| A5.3 | Receive **less** than ordered | Accepts, discrepancy highlighted | |
| A5.4 | Enter an invoice price ≠ PO price | Accepts both, keeps them distinct | |
| A5.5 | Confirm receipt | PO status advances (PARTIALLY_RECEIVED or CLOSED) | |
| A5.6 | **Stock actually moved** | Go to Stock on Hand — received item's qty **increased by what you received** | |
| A5.7 | **Cost updated** | Item's current cost reflects the invoice price via weighted average (D-8) — not the old cost, not simply the newest price | |
| A5.8 | Ledger entry | Item movement history shows a `RECEIVE` row | |

> **A5.6 + A5.7 are the most important checks in this guide.** They prove the ledger and
> costing actually work. If either fails, Phase 2 cannot proceed — dispatch costing is
> built directly on this.

## A6 · Prep

| # | Check | ✅ Pass condition | Mark |
|---|---|---|---|
| A6.1 | Open Prep | Log Prep + Prep Recipes tabs visible (Manager only) | |
| A6.2 | Prep Recipes tab | `Prepped Simple Syrup` recipe listed | |
| A6.3 | Open the recipe | Ingredients + expected yield (10) shown | |
| A6.4 | Create a new recipe | Creates the output item **and** the recipe together | |
| A6.5 | Then check Item Catalog | The new PREPPED item now exists there (created via recipe, per A2.8) | |
| A6.6 | Log Prep → select Simple Syrup | Ingredients + expected yield **pre-fill** from recipe | |
| A6.7 | Rolling-average hint | Shows a soft reference (~10.1 avg yield from 2 records) | |
| A6.8 | Edit prefilled values | Fully editable, never blocking (D-12) | |
| A6.9 | Submit a prep run | Saves | |
| A6.10 | **Stock effect** | Input items **decreased**, output item **increased** | |
| A6.11 | Ledger | `PREP_CONSUME` + `PREP_PRODUCE` rows appear | |
| A6.12 | Cost of prepped item | Computed as total input cost ÷ actual yield | |

## A7 · Stock Counts

| # | Check | ✅ Pass condition | Mark |
|---|---|---|---|
| A7.1 | Count list | 3 counts, correct statuses | |
| A7.2 | Create a session | Label, date, item selection all work | |
| A7.3 | **Manager sees expected qty** | Expected quantities **visible** (D-14 — Manager always sees) | |
| A7.4 | Open the SUBMITTED count | Variance view: expected vs. counted vs. gap, valued in KES | |
| A7.5 | Edit before approving | Manager can correct a line before approval | |
| A7.6 | Approve | Posts adjustments | |
| A7.7 | **Stock adjusted** | On-hand now matches counted qty | |
| A7.8 | Ledger | `ADJUSTMENT` rows written | |

## A8 · Waste

| # | Check | ✅ Pass condition | Mark |
|---|---|---|---|
| A8.1 | Waste log list | Existing entry visible | |
| A8.2 | Log waste | Item, qty, reason picker, optional note | |
| A8.3 | **Stock decreased** | On-hand drops by the wasted qty | |
| A8.4 | Ledger | `WASTE` row appears | |
| A8.5 | Filter by reason / date | Works | |

## A9 · Supplier AP

| # | Check | ✅ Pass condition | Mark |
|---|---|---|---|
| A9.1 | Purchases → Supplier Invoices tab | Reachable | |
| A9.2 | Invoice table | All 3 invoices, correct statuses | |
| A9.3 | Aging buckets | 0–7 / 8–30 / 31+ shown | |
| A9.4 | Totals by supplier | Correct sums | |
| A9.5 | Open `NHW-INV-101` | 18,400 total, 10,000 paid, 8,400 outstanding | |
| A9.6 | Record a payment | Pre-fills outstanding amount | |
| A9.7 | **Overpayment blocked** | Paying more than outstanding is rejected | |
| A9.8 | Pay in full | Status → PAID | |
| A9.9 | Record a new invoice | Selecting a PO pre-fills supplier + amount | |

## A10 · Reports

All 7 are Manager-only. Note the ones that are desktop-only.

| # | Report | ✅ Pass condition | Mark |
|---|---|---|---|
| A10.1 | Stock valuation | Lists items with qty × cost = value | |
| A10.2 | Low-stock alerts | Flags items below reorder level | |
| A10.3 | Price history | Renders per item | |
| A10.4 | Prep yield | Shows yield by output item | |
| A10.5 | Count discrepancy | Shows variances | |
| A10.6 | True cost per prepped item | Computes | |
| A10.7 | Supplier AP aging | Matches A9.3 | |
| A10.8 | CSV export | Works (PDF is a known v1 cut — not a finding) | |

---

# PART B — Store Manager, Mobile

Same login. Use browser DevTools device emulation (or your phone on the LAN).

> Manager screens were built as **two purpose-built layouts**, not one responsive layout.
> So mobile should look *deliberately different* from desktop — not a squeezed copy.

| # | Check | ✅ Pass condition | Mark |
|---|---|---|---|
| B1 | Mobile nav | Bottom-tab shell, thumb-reachable | |
| B2 | Stock on Hand | **Card list**, not a squeezed table | |
| B3 | Tap an item | Full-screen movement history | |
| B4 | Receiving on mobile | Genuinely usable one-handed — this is the primary surface | |
| B5 | Prep on mobile | Step flow, numeric keypad | |
| B6 | Waste on mobile | ~3 taps: item, qty, reason | |
| B7 | Count execution | Expected qty **visible** (Manager) | |
| B8 | AP on mobile | Invoice cards, status badges, Record Payment | |
| B9 | **FAB positioning** | No floating action button hidden behind the bottom nav (was a past bug) | |
| B10 | Reports on mobile | Summary cards; note which reports are desktop-only | |

---

# PART C — Store Attendant, Mobile

**Log out. Log in as `store.attendant`.** This part is about what they *cannot* do.

## C1 · Permission boundaries — the critical checks

| # | Check | ✅ Pass condition | Mark |
|---|---|---|---|
| C1.1 | Nav contents | **No** Item Catalog CRUD, **no** Suppliers CRUD, **no** Supplier AP, **no** Reports | |
| C1.2 | Supplier AP | Not present in nav at all (API already confirmed 403) | |
| C1.3 | Reports | Not present in nav at all (API already confirmed 403) | |
| C1.4 | Open a DRAFT PO | **No Send button** | |
| C1.5 | Stock count | **Cannot create** a session | |
| C1.6 | SUBMITTED count | **Cannot approve** | |
| C1.7 | Prep Recipes tab | **No tab bar visible at all** for Attendant | |
| C1.8 | Item Catalog | Read-only if visible — no create/edit/delete | |

## C2 · The blind count — D-14

**The single most important behavioural check in Phase 1.**

| # | Check | ✅ Pass condition | Mark |
|---|---|---|---|
| C2.1 | Open an IN_PROGRESS count as Attendant | **Expected quantity is NOWHERE on screen** | |
| C2.2 | Enter counted quantities | Accepts | |
| C2.3 | Submit | Hands off to Manager | |
| C2.4 | Re-check as Manager | Manager now sees expected vs. counted variance | |

> Already confirmed server-side: the Attendant's API response omits `expectedQty`
> entirely. C2.1 confirms the UI matches.

## C3 · Attendant daily work

| # | Check | ✅ Pass condition | Mark |
|---|---|---|---|
| C3.1 | Attendant dashboard | Loads; content relevant to *their* day (not a copy of Manager's) | |
| C3.2 | Stock on Hand | Read-only, with costs visible (D-2 — operational cost is allowed) | |
| C3.3 | Receiving | Full flow works — their core task | |
| C3.4 | Prep entry | Full flow works — their other core task | |
| C3.5 | Create a draft PO | Allowed (but cannot send) | |
| C3.6 | Log waste | Works | |
| C3.7 | Profile / logout | Reachable | |

---

# PART D — Cross-cutting

| # | Check | ✅ Pass condition | Mark |
|---|---|---|---|
| D1 | **Ledger consistency** | After all your test transactions, on-hand for a touched item = sum of its ledger movements | |
| D2 | Browser console | No red errors during normal use | |
| D3 | Refresh mid-flow | State survives; no crash | |
| D4 | Empty states | Filtering to no results shows a proper empty state, not a blank void | |
| D5 | Error handling | Submitting an invalid form gives a readable message, not a raw error | |
| D6 | Loading states | Spinners/skeletons, not blank flashes | |
| D7 | Numbers formatting | Currency and quantities consistently formatted throughout | |
| D8 | **Hub-org visibility (D-15)** | Central Store appears in people contexts (HR/staff) but **never** in sales/revenue contexts | |

---

# Recording findings

For anything marked **F** or **?**:

```
[SCREEN] — [ROLE/SHELL] — [P/F/?]
What I did:
What I expected:
What happened:
Severity: blocker / annoying / cosmetic
```

**Severity guidance for Phase 2 planning:**

- **Blocker** — ledger or costing is wrong (A5.6, A5.7, A6.10, A6.12, A7.7, D1), or a
  permission boundary leaks (C1.x, C2.1). These must be fixed before Phase 2 code.
- **Annoying** — works but the workflow is clumsy. Feeds the UI/UX audit backlog.
- **Cosmetic** — visual only. Batch into a later design pass.

---

# What we do with the results

1. **Blockers** → fix before any Phase 2 schema work
2. **Annoying** → fold into the remaining UI/UX audit (Waste Log review, Attendant
   Dashboard, Flows 4/5/7 are already outstanding)
3. **Cosmetic** → defer to the design-system pass
4. The completed marks become **the real Phase 1 status** — replacing the documentation's
   unverified claim, and the honest baseline Phase 2 builds on

---

*Created 2026-08-20. Companion to `INVENTORY_FEATURE_PLAN.md` (feature spec),
`INVENTORY_PHASE1_SESSION_PLAN.md` (build log) and `UI_UX_DESIGN_AUDIT.md` (design pass).
This file is the functional verification pass — deliberately distinct from the design
audit, which judges look and feel rather than correctness.*
