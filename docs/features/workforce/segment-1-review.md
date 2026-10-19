# Segment 1 review: Timesheets rework (1A) and Rules (1B)

19 October 2026. The orchestrator's review of the approved Paper designs (Chapter 12 steps 01 to 12 for timesheets, Chapter 13 Rules, Chapter 9 phone) against what is already built (slice 4a and the slice 0 rules store). This is the input for the spec files and the back-end and front-end briefs. Sources: `design-pass-3-payroll.md`, `design-pass-4-shared-parts.md`, `design-pass-1-leave-conduct.md`, `backend/src/modules/workforce/timesheets/README.md`, `backend/src/modules/workforce/rules/README.md`, and Paper (file `01M3TP8J54R83RHC9FJ7RAHGKG`, page "Workforce · D. Pay": Chapter 12 node `314E-0`, Chapter 13 node `1K8V-0`).

## 1A. Timesheets (Chapter 12 steps 02 to 12, Chapter 9)

### Keep as built
The clock-time engine; days and weeks assembled from the rota and the clock events; a day that matches the rota approves itself; exceptions with reasons; overtime evidence and limits (counts only, never takings); Report a problem and "clocked out by mistake" requests, the manager's Requests inbox, escalation to HR after 3 days; My time and My rota on the phone; the `getApprovedHours` door; the per-site switch rule (no timesheets for a site whose switch is off).

### Change or remove
| Built today | New design | Work |
|---|---|---|
| Period closes by itself at 18:00 on the 2nd day after the month; sweep closes it | **No automatic close.** The site's manager approves the month | Back end: remove the auto-close step from the sweep; keep escalation |
| "Close early", HR "Reopen with a reason", manager PIN signature on a report | **Approve the month** with a PIN (once). Approved means locked and with payroll. No reopen. | Back end: month status machine OPEN, TO_APPROVE, APPROVED (payroll stages and Paid belong to Segment 2); front end: Approve dialog and Approved state |
| HR can decide days and overtime; Director and Accountant cannot | **Each site's manager approves their own timesheets** (Branch Manager; Store Manager for the Central Store; Director for Head office). HR cannot approve for a site. Accountant reads. | Back end: access table and tests |
| Department head decides overtime inside an allowance | **A department head approves nothing.** The Branch Manager decides overtime and missed clock-ins. | Back end: remove the head's decision path |
| Overtime: approve or decline | Approve **all, part or none**, with a reason and a PIN; the dialog shows planned, worked, extra, the evidence ("why, from the record") and the limits | Back end: part approval (minutes), PIN check; front end: the dialog |
| Closed period refuses every clock fix, HR included | Before the month is approved the Branch Manager fixes alone. After approval until Paid, HR or the Accountant corrects the **payslip** (Segment 2). The fix door answers "month approved, tell HR". | Back end: change the period-lock rule and message |
| Page: a period header, a week picker, a person's week | **Months list on the left, the month on the right.** Date range picker with quick picks per Monday-to-Sunday week. A person's drawer (month at a glance, days that need a look, last 7 days) and the person's **full month** page (every day). KPI strip: hours worked, overtime recorded, late recorded, "needs you before approving". | Front end: rebuild the page; back end: months list including the open month ("Today is 19 Oct, 3,118 h so far") |
| Export: CSV only | **PDF** (landscape, signed, department then A to Z, 20 people on page 1, a department never split) and **Excel** (one row per person, real numbers). Stamped "Draft, not approved" until approved. Document number TSH-0019. | Back end: PDF and Excel generation; front end: the export menu |
| Menu: Timesheets link for HR, Accountant, Director | Only Branch Managers and Store Managers keep a Timesheets link; HR, Accountant and Director read timesheets inside Payroll (Segment 2) | Front end: `nav-table.ts` |
| Home cards "Waiting for you" rows | Replaced by menu badges and a "Needs you" card (built in Segment 6). Segment 1 adds no new Waiting-for-you references. | Light touch only |

### New data and rules to confirm in the spec
- Evidence line "Head's note: [head] saw it, no objection" (Chapter 12 step 10). Default: a department head can leave a one-line note on an overtime item; it is evidence, never a decision.
- Whether "Approve September" is blocked until every exception is decided. Default: blocked, with the reason shown ("3 things need you before approving").
- Approvers per site type (Store Manager for the Central Store, Director for Head office) are assumed, not confirmed. Default: build as drawn.

## 1B. Rules (Chapter 13, 13 steps, ten tabs)

### What exists
Slice 0 built the rules store with versions (never edited, a new version with an effective date and a required reason), confirmations, per-field edit and confirm policy (`rules-field-policy.ts`), the read endpoints (`effective`, `versions`) and the ten groups. The README says the write endpoints and the screens are slice 4.

### Back end to build
Write endpoints for creating a version (effective date today or later, reason, PIN) and confirming it; row-level "who can change this" answers for the locked Change popover; "who is told" data for the dialog; the Statutory tab (Accountant types and confirms the tables; ships empty); the Holidays rows including the pay-on-holiday row only the Accountant can change; field policy aligned to the "Who edits what" table (Branch Manager only Lateness, Overtime and minimum cover, own site; Director the rest; HR leave types; Accountant statutory and holiday pay rate); remove the now-unused `timesheetCutoff` use and the `CALENDAR_MONTH` default stays.

### Front end to build
One Rules page with ten tabs (Lateness, Overtime, Attendance, Leave, Probation, Casual work, Conduct, Statutory, Holidays, Week and breaks); every changeable row has a **Change** link in a fixed column opening one shared dialog (NOW, NEW, FROM date, why, PIN, what it would change, who is told); a **locked** Change with a padlock and a popover saying who can; rows the system sets say **Fixed**; version history; the **Who edits what** table. Naming rule: never a bare name, role alone or name plus role; no he, she, her or his.

## What this means for the other built parts
- Slice 1a pay profile: M-Pesa and Cash removed, bank only (Segment 2).
- Attendance: the clock-fix rule above (Segment 1A back end).
- Frame: the "Waiting for you" menu row and card label become "Needs you" (Segment 6).

## Paper housekeeping found
- Chapter 12 step screens still show a "Waiting for you" row and badge in the sidebar of the embedded menus; `nav-table.ts` is the authority, not the Paper menus.
- Chapter 13 frame names are stale (two frames named "Step 07", two named "Step 04"); the on-screen step labels 01 to 13 are right, so nothing is missing.
- Not drawn, to be built in the same style and reported as beyond Paper: the Branch Manager's Lateness and Overtime view with locked rows for other sites.

## Proposed split
1A Timesheets and 1B Rules each get their own spec file, back-end brief and front-end brief (four build sessions plus two spec sessions). 1A first (it changes accepted code and unblocks Payroll's "approved hours"); 1B can run its back end beside the 1A front end.
