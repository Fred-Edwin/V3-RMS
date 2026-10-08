# Inventory role coverage: what each role sees and writes, and the gaps (8 Oct 2026)

Why this exists: after Stock, Counting and Waste were built, the owner found gaps in production that no per-journey review had caught (no home for the Attendant, no history, no date picker on a desktop list). This page lists every role's front door, lists, history, files and actions, side by side, so the gaps show. It is a working document: a gap is closed when it is drawn (Paper) or fixed (code) and the row is ticked.

**Sources:** `frontend/components/app/shell/nav-table.ts` on `main` (including the Stock, Counting and Waste rebuild, #95), the route list under `frontend/app/app/inventory` and `/branch`, the Paper screens indexes (Stock, Counting and Waste chapter 10; Requisitions, Dispatch, Branch day and Branch waste covers and indexes), and the sub-module READMEs.
**Production check (8 Oct 2026):** walked in the live app at `app.wendo-rms.co.ke` as the Store Attendant (phone width) and the Store Manager (1440). Every link in both sidebars was opened; the list screens' controls were read from the page. Findings are in section 2 marked "(seen in production)".
**Coverage so far:** Stock, Counting, Waste, Prep, Purchasing and Receiving, Audit log and the old Dispatch page were opened in production. Requisitions, Branch day, Branch waste and Dispatch (new) are designs only (not built); Catalog, Suppliers and Settings were not opened yet.

**Owner rulings (8 Oct 2026):** G10 means count history. Add the Attendant's front door (G1). Add waste history for the Attendant and for department members (G5). The Branch Manager gets an Audit log link limited to their branch (G8).

Read means the role sees it, write means the role can act on it. AT Store Attendant, SM Store Manager, SA System Admin, DIR Director, ACC Accountant, BM Branch Manager, DH Department Head or member.

## 1. Role by role

### Store Attendant (phone-width column at every width)
| Area | Sees | Writes | Front door | History |
|---|---|---|---|---|
| Stock and counts | Pick a section, count, review, sign, submitted | Counts blind, signs with their PIN | **None: the "Stock & counts" link opens Pick a section** | **None: no list of my past counts** |
| Waste | Own entries today | Logs, reverses own entry the same day | The waste page itself (my waste today) | **None: only today's entries** |
| Stock overview, All items, Stock ledger | Nothing (403 by design) | none | n/a | n/a |
| Prep, Receiving, Purchasing, Catalog | per their own rebuilt pages | per capability | yes | Prep has History |
| Dispatch | old flow | old flow | old flow | old flow (Group D to be built) |

### Store Manager and System Admin
| Area | Sees | Writes | Front door | History |
|---|---|---|---|---|
| Stock and counts | Overview, All items, Counts, Count setup, Stock ledger, Stock card | Starts and counts, reviews, approves with PIN, Count setup and settings | Overview | The Counts list (**no date range, no pager**) |
| Waste | Every entry, with values | Logs, reverses any | the Waste list | tabs Today, Last 7 days, Reversed (**no date range, no search, no filters, no pager**) |
| Everything else Central Store | Purchasing, Receiving, Prep, Catalog, Suppliers, Audit log, Settings | per the access table | yes | yes |

### Branch Manager
| Area | Sees | Writes | Front door | History |
|---|---|---|---|---|
| Branch group (code today) | Requisitions, Deliveries, Day | approves, confirms, closes | Requisitions | per page |
| Branch group (design, approved 8 Oct) | Requisitions, Day (Today, History), Waste | as designed | Requisitions | Day History, Branch waste |
| Central Store | reads Stock overview, Counts, Waste, Catalog, restock levels, suppliers, audit log | nothing | the group's rows | per page |

### Director, Accountant
| Area | Sees | Writes | Front door | History |
|---|---|---|---|---|
| Central Store | everything the Store Manager reads | DIR: Mark seen on a flagged count; nothing else | Overview | as the Store Manager |
| Branches (design) | Day (Today, History) and Waste for any branch, read only | none | Day Today | Day History, Branch waste |
| Branches (code today) | **No Day or Waste rows** | | | |

### Department Head and members (phone)
| Area | Sees | Writes | Front door | History |
|---|---|---|---|---|
| Requisitions, Count, Waste (design) | own department | request, count, log waste, reverse own | the drawer rows | **only Kitchen waste today; no earlier days** |
| Code today | legacy bottom tabs; Requisitions on the old flow | | | |

## 2. Gaps found

Kind: **Draw** (a screen is missing in Paper), **Fix** (the design exists, code or the live app differs), **Decide** (needs an owner decision).

| # | Gap | Role | Kind | Evidence |
|---|---|---|---|---|
| G1 | **No home for Stock and counts for the Attendant.** The Attendant is blocked from Overview (403), so the link opens Pick a section. Needs a front door: today's counts, my section state, last counted, Log waste | AT | Draw, Decide | nav-table.ts (`counts` link, `overview` is DESKTOP_HUB); screens index (step 42 is desktop only) |
| G2 | **No history of my counts** (past counts, signed and approved, what was decided) | AT | Draw | screens index has Submitted (7) and nothing after |
| G3 | **Counts list (desktop) has no date range and no pager** | SM, SA, DIR, ACC, BM | Draw, Fix | Paper step 8: status tabs and search only. Owner saw the same in production |
| G4 | **Waste list (desktop) has no search, filters, date range or pager** (three tabs stand in) | SM, SA, DIR, ACC, BM | Draw, Fix | Paper step 21 |
| G5 | **Waste history beyond today** for the Attendant (my waste today only) and for department members (Kitchen waste today only) | AT, DH | Draw, Decide | steps 19 and W4 |
| G6 | Stock ledger, All items and Prep history: date range, search and pager not verified | SM, SA, DIR, ACC, BM | Check, then Draw or Fix | Paper steps 27 to 29; Prep built |
| G7 | Branch Manager and hub roles have **no Day or Waste rows** in the nav table; the Branch group still lists Deliveries | BM, DIR, ACC, SM, SA | Fix (at build) | nav-table.ts lines for `mgr-branch`; Group B and W designs |
| G8 | The Branch Manager's branch-scoped Audit log link is not drawn | BM | Draw, Decide | branch-day-flow.md "Audit trail" |
| G9 | The Attendant has no stock-card or on-hand view: by design (blind rule), but the Attendant also cannot see item cost history or restock levels; confirm this is intended | AT | Decide | stock README, 403 on all five stock endpoints |
| G10 | "Account history" is the count history (G2). **Confirmed by the owner** | AT | closed into G2 | owner, 8 Oct |
| G11 | **Fake phone status bar ("9:41") is in the built app**: seen on the Attendant's Catalog and Dispatch pages and on the Store Manager at phone width. Rule: `UI_BUILD_RULES` §7a, owner memory "no phone status bar" | AT, SM, all phone users | Fix | production, 8 Oct |
| G12 | **The Audit log has no Counting, Waste or stock-adjustment areas.** Its chips are Catalog, Suppliers, Restock levels, Prep, Purchasing and payments. Counts signed and approved, waste logged and reversed, and ledger adjustments are not traceable there | SM, ACC, DIR | Draw, Fix | production, 8 Oct (areas row); the same gap the owner raised for Branch day |
| G13 | **The Audit log's "When" menu is Today / Show any time**, not the approved date range picker | SM, ACC, DIR | Fix | production |
| G14 | **Prep history has no date range** (filters: search, output, person, status) | SM, SA, DIR, ACC, BM | Draw, Fix | production |
| G15 | The Attendant's Stock and counts parent has only Counts and Waste; Receiving opens the Purchasing page on its Receive tab (fine, but the sidebar label and the page title differ: "Receiving" and "Purchasing") | AT | Decide | production |
| G16 | **Counts list shows a pager and rows per page in production, but Paper step 8 does not draw them**; Paper must catch up | SM | Draw | production versus Paper |

### Drawn in response (Paper page "Inventory · Counting redesign (Oct 7)", chapter 11, 8 Oct 2026)
Batch 1 (approved): **52** Stock & counts home (Attendant), **53** My counts, **54** My waste today and earlier (Attendant), **55** Kitchen waste today and earlier (department head or member). Batch 2: **56** Counts with a date range and a pager (G3, G16), **57** Waste with search, filters, a date range and a pager (G4), **58** the Audit log with an Area menu listing the new areas Stock counts, Waste and Stock adjustments (G12), **59** the Audit log with the date range picker (G13), **60** the Branch Manager's Audit log for their own branch (G8).
**G14 is a code fix, not a drawing:** the approved Prep history design (Prep page, step 13) already has From and To dates; production does not show them. Fix in code. G7 (nav rows) is also a code fix at build time. G11 (the "9:41" bar) is a code fix.

## 3. Controls audit (every list screen against the table convention)

The rule (`UI_BUILD_RULES` §4a): search and filters first, type-ahead, a numbered pager with rows per page, a date range wherever the list is historical, and the one States kit.

| List | Search | Filters | Date range | Pager | States |
|---|---|---|---|---|---|
| Counts (desktop; production) | yes | status tabs | **no** | yes (not in Paper) | yes |
| Waste (desktop; production) | yes | tabs only | **no** | **no** | yes |
| Stock ledger (production) | yes | yes (adjustments, waste, negative, section) | yes (Last 30 days) | yes | yes |
| All items (production) | yes | yes (category, type, department, section) | n/a | yes | yes |
| Prep history (production) | yes | yes (output, person, status) | **no** | not seen | yes |
| Audit log (production) | no search | area chips, Who | "When: Today / any time" (not the range picker) | **no** | check |
| Purchasing list (production) | not seen | tabs, group by supplier | not seen | not seen | check |
| Branch Day History (B10) | yes | yes | yes | yes | kit |
| Branch waste (W6, W8) | yes | yes | yes | yes | kit |

## 4. What I could not check

- **Production has little data** (no waste, one open count, no signed counts), so populated states (a list with many rows, a signed count's history) were not seen live; those come from the Paper designs.
- **Not opened in production yet:** Catalog, Suppliers, Settings, Receiving (as the Manager), Count setup, a count's review page, and the Director, Accountant, Branch Manager and department-head views (no logins).
- The rows marked "check" need one look at the built screen.

## 5. Proposed next step

1. Owner rules on the remaining **Decide** rows (G9, G15) and on the new ones (G12 to G16).
2. One Paper batch on "Inventory · Counting redesign (Oct 7)": Attendant home (G1), my counts history (G2), date range and pager on the Counts and Waste lists (G3, G4, G16), waste history for the Attendant and department members (G5), the Prep history date range (G14), and the Audit log's new areas and date range (G12, G13) with the Branch Manager's branch-scoped Audit log (G8). Same stop for review.
3. Fix the live screens against the new designs, in the same PR as the code plan for Stock, Counting and Waste.

## 6. Audit of the four design groups: Requisitions, Dispatch, Branch day, Branch waste (8 Oct 2026)

Method: each group's screens index and flow doc against the same seven checks (front door, lists, history, record file, actions, exceptions, shared controls), role by role. These groups are designs only, so nothing here was seen in production except the old Dispatch page (opened as the Store Manager and the Attendant: it exists, with a Discrepancies tab, and still shows the "9:41" bar on the Attendant's phone). The Department Head, Branch Manager, Director and Accountant views were not seen live (no logins).

**What holds up:** every group has a front door for its main role (Requisitions home step 1, To pack D1, Day step B0, the waste page), a record file with Items, Documents and Activity, an A4 print where one is needed, a States kit or wording table, and Audit log coverage (steps 17, 58 and 60).

| # | Gap | Group | Role | Kind | Evidence |
|---|---|---|---|---|---|
| A1 | **The Requisitions list for the hub roles is not drawn**: a Branch column and a Branch filter, and where each role opens | Requisitions | DIR, ACC, SM, SA | Draw | requisitions-flow.md line 174: "Not yet drawn for them" |
| A2 | **No date range on the Requisitions list** (the Closed and To confirm tabs are historical); the index has a pager and search only | Requisitions | all desktop roles | Draw | screens index step 07; no "Date" text on the page |
| A3 | **A Department Head cannot see past requisitions or past deliveries** (a closed list, a re-print, how a delivery or finding ended). Step 1 offers "start" or "open my section" only | Requisitions, Dispatch | DH | Draw, Decide | screens index steps 01 to 06, 14 |
| A4 | **The Attendant has no dispatch history** (what I packed and signed last week); the phone shows To pack and On the way only | Dispatch | AT | Draw, Decide | dispatch index D1 to D6 |
| A5 | **A department member's deliveries end at "Confirmed"** (D12): no list of past deliveries and no view of how a gap ended (finding, reversal) | Dispatch | DH, member | Draw, Decide | dispatch index D7 to D12 |
| A6 | **A Department Head has no Day history** (their department's past counts and figures, no costs); Day gives them Today only. Mirrors G2 for the Attendant | Branch day | DH | Draw, Decide | branch-day-flow.md: heads see their own slice; screens B0 to B4 |
| A7 | **Branch waste W4 shows today only**; step 55 (Kitchen waste, today and earlier) replaces it. Update the screens index and the flow doc so there is one waste list for a department | Branch waste | DH, member | Fix (docs, Paper index) | steps W4 and 55 |
| A8 | **The phone menu drawer is not drawn per role**: which rows the Attendant, a Department Head and a member see (Requisitions, Deliveries waiting, Count, Waste, Day). Today the rows live only in `nav-table.ts` and in notes | all four | AT, DH, member | Draw | paper-updates-needed.md ("Phone versions", "Floor-staff heads"); production shows the Attendant's drawer |
| A9 | **No notification map**: who is told what and where (head told on approval, Branch Manager told of an unconfirmed delivery, Director alert, Attendant told of a new dispatch). Some are drawn (steps 10, 46), the set is not | Requisitions, Dispatch, Branch day | all | Decide, then Draw | flows mention them one by one |
| A10 | The Director's hub-level Departments settings and Carriers are not drawn (Branch Manager and Store Manager only); confirm that is intended | Requisitions, Dispatch | DIR | Decide | requisitions-flow.md line 156 |

### Rulings (owner, 8 Oct 2026)
A3 to A6: yes, past-record lists in the same shape as steps 53 to 55 (date range, no costs for heads). A9: yes, draw the notification map. A10: Departments and Carriers are read-only for the Director and Accountant (with a branch picker on Departments), and the System Admin can change them. One map page, and the old Stock and Counting chapters 1 to 5 deleted.

### Re-check after the Dispatch session's work (8 Oct 2026)
A1 and A2 are **closed**: the page now has the Director's Requisitions queue with a Branch column and filter (step 18b), and a hub Requisitions History with a Branch filter and a date range (step 7d), plus a hub Discrepancies list (step 7c). They were already drawn when the audit text was written from the earlier index.

### Open items decided (owner, 8 Oct 2026: "go with your proposal"; the drawings are approved)
The Director reaches Departments through Operations › Branch Settings › Departments (a new nav row at build). A dispatch that is signed and sent pushes the department members at the branch. The Director's count alert is an Inbox row and a push, as Paper step 46 draws it; the counting README ("no Inbox row") is updated at build to follow Paper. Both notification-map rows are marked Decided.

### Drawn in response (approved by the owner, 8 Oct 2026)
- **A3, A5, A4, A10** on the new Paper page "Inventory · Requisition and dispatch: gap fixes (8 Oct)": **G1** My requisitions (Department Head), **G2** My deliveries (head and member, with gap results), **G3** the Attendant's Dispatch with a Done tab, **G4** Departments of any branch, read only. The Director's route to Departments (Operations › Branch Settings › Departments) is a **proposal**; the nav table has no such row.
- **A6** on "Inventory · Counting and closing", chapter 5: step **19** My department's past days, step **20** one past day (quantities only).
- **A8** and **A9** on the new page "Inventory · Final design pass: map": the phone menus for the Attendant, a Department Head and a member, and the notification map (16 rows; two Open items: the Director's count alert Inbox row, where code and Paper disagree, and the push for a dispatch that is on its way).
- **A7**: handled in the map page text (Branch waste W4 is superseded by step 55); the Branch waste screens index was left as approved.
- The map page (indexes by page and by role) is "Map · Every screen by page and role" on the same page.
