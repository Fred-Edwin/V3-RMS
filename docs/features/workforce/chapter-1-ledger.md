# Chapter 1 card ledger

**Chapter 1 ("Role homes and navigation") is finished only when every row below says "data wired".** The frame session (branch `feat/workforce-frame`, 17 Oct 2026) built the structure and every block; each later slice fills in the cards it owns, swaps that card's `noSource` data hook for a real one (`frontend/features/workforce/home/cards/`), and ticks the row here. A card with no data source is not shown. How a slice registers a card: `frontend/features/workforce/home/README.md`.

Status words: **frame built** (the block, its states and its card definition exist; nothing feeds it) and **data wired** (a slice feeds it; the row is ticked). Paper nodes are in file "Wendo RMS · Approved designs", page "Workforce · A. The people", artboard Chapter 1 (`OOK-0`).

## Home cards

| Card id | Paper | Who sees it (capability) | Data slice | Status |
|---|---|---|---|---|
| `workforce.hr-kpis` · KPI strip: Waiting for you, Onboarding, No contract yet, Pay run | `SVM-0` (HR Home `PG2-0`) | `employee.write_sensitive` (HR) | Waiting for you: 4; Onboarding and No contract yet: 1a; Pay run: 6 | Onboarding and No contract yet: **data wired** (1a, 17 Oct 2026); the other cells wait for their slices |
| `workforce.hr-attention` · Needs your attention (leave, report, finish hiring, probation ends, no head) | `PME-0` | `employee.write_sensitive` | Finish hiring, Probation ends: 1a; No head for a department: 1b; Report a problem: 4; Leave request: 5 | Finish hiring and Probation ends: **data wired** (1a, 17 Oct 2026); the other rows wait for their slices |
| `workforce.people-by-branch` · People by branch | `PNM-0` | `employee.write_sensitive` | 1a | **data wired** (1a, 17 Oct 2026) |
| `workforce.coming-up` · Coming up (also the Accountant's and Director's) | `POH-0` | `employee.write_sensitive`, `payrun.approve`, `payrun.reopen` | Leave starting: 5; Probation ends: 1a; Timesheets close: 4; Pay run goes to the Accountant, Payday: 6 | Probation ends: **data wired** (1a, 17 Oct 2026); the other events wait for their slices |
| `workforce.branch-kpis` · KPI strip: On shift now, Late today, Not in yet, Waiting for you | `SWB-0` (Branch Manager Home `PPM-0`) | `today.act` (Branch Manager, Store Manager) | On shift, Late, Not in: 3; Waiting for you: 4 | frame built |
| `workforce.today-board` · Department chips, Needs a look, On time and working (the branch right now) | `Q4S-0` | `today.act` | 3 (Attendance); department heads and "No head assigned": 1b | frame built |
| `workforce.waiting-for-you.desktop` · Waiting for you, approvals one tap each | `PXC-0` | `today.act` | 4 (overtime, Report a problem, casuals); 5 (leave) | frame built |
| `workforce.payrun-kpis` · The pay run strip (Accountant, Director) | reference table `OPQ-0` (no drawing) | `payrun.approve`, `payrun.reopen` | 6 | frame built |
| `workforce.payrun-steps` · Pay run steps and rule confirmations (Accountant) | `OPQ-0` | `payrun.approve` | 6 (steps); 7 (rule confirmations) | frame built |
| `workforce.overdue-approvals` · Overdue approvals (Director) | `OPQ-0` | `payrun.reopen` | 4 and 5 | frame built |
| `workforce.company-headcount` · Company headcount (Director) | `OPQ-0` | `payrun.reopen` | 1a | **data wired** (1a, 17 Oct 2026) |
| `workforce.clock` · The clock card (phone, card 01) | `QH7-0`, `QJA-0` | `time.own` | 3 | frame built |
| `workforce.waiting-for-you.phone` · Waiting for you on a head's phone (card 02) | `QJV-0` | `overtime.approve`, `casual.record` | 4 (overtime, casuals) | frame built |
| `workforce.job-cards-slot` · Dashed slot for the job's cards (card 03) | `QHS-0`, `QKK-0` | `time.own` | **Orders redo** (not a Workforce slice); remove the slot when it registers | frame built |
| `workforce.team-today` · Service team today (phone, card 04) | `QKM-0` | `today.read` | 3 (Attendance); heads: 1b | frame built |
| `workforce.this-week` · This week: hours, overtime waiting (phone, card 05) | `QHU-0`, `QLM-0` | `time.own` | 2 (planned bars), 3 (worked), 4 (overtime waiting) | frame built |

Unblocked outside the cards: the **shift pill** in the phone top bar (slice 3, a `TimerChip`) and the **job's primary action** in the same bar (the Orders redo, a `PhoneBarAction`); the **search box and the page's action** in the desktop top bar ("Add employee", "Build the rota": slices 1a and 2). All four are slots; none is drawn until its owner passes it.

## Menu rows (`frontend/components/app/shell/nav-table.ts`, `WORKFORCE_ROWS`)

Every row exists with its label, group, icon, link and who sees it. Only **Home** is shown. A row is shown when its slice removes `notBuilt: true` from it (that is the whole change). Legacy rows (Staff Profiles, Shifts, Payslips, Leave Requests, Payroll and the rest) are untouched; each slice moves its own.

| Row (Paper step 01) | Roles in Paper | Slice that builds the page and shows the row | Badge slot | Status |
|---|---|---|---|---|
| Home | HR, Branch Manager, Store Manager, Accountant, Director | frame | none | **shown** |
| Waiting for you (Overdue approvals for the Director) | HR, BM, SM, Accountant, Director | 4 | `workforce-waiting` | row defined, hidden |
| Schedule › Rota, Shift templates | HR, BM, SM, Director | 2 | none | row defined, hidden |
| Timesheets | HR, BM, SM, Director | 4 | `workforce-timesheets` | row defined, hidden |
| Employees (under Workforce for the Accountant) | HR, BM, SM, Director; Accountant | 1a | none | row defined, hidden |
| Organisation | HR, BM, Director | 1b | none | row defined, hidden |
| Leave | HR, BM, SM, Director | 5 | `workforce-leave` | row defined, hidden |
| Conduct | HR, BM, SM, Director | 7 | none | row defined, hidden |
| Pay runs, Payslips | HR, Accountant, Director | 6 | none | row defined, hidden |
| Rules | all five | 7 (Rules and rules store) | none | row defined, hidden |
| Audit log | all five | 7 | none | row defined, hidden |
| My time (Accountant) | Accountant | 3 | none | row defined, hidden |
| My leave, My payslips | all five | 5, 6 | none | row defined, hidden |
| Phone drawer, floor staff and heads: Home; Team (Waiting for you, Team today, Rota, Casuals, heads only); Me (My time › Hours this week, My shifts, Overtime, My requests; My leave; My payslips; Profile and security) | staff, department heads | Home link: 3 (Attendance gives staff a clock card); Team: 4, 3, 2, 4; Me: 3, 5, 6; Profile exists already | `workforce-waiting` | rows defined, hidden |

When a slice shows a row for floor staff it also widens the route gate in `frontend/lib/route-access.ts` (today `/app/workforce` opens for the five desktop roles only; `route-access.workforce.test.ts` says so).
