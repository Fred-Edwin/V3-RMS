# Workforce

The people who work for Wendo, what they are scheduled for, what they worked, and what they are paid. Being redone from scratch in the design lane (`docs/sessions/design-lane-workforce.md`). Nothing is built yet.

## Where things live

| What | Where |
|---|---|
| What exists today, and what is wrong with it | [audit-and-critique.md](audit-and-critique.md) |
| The approved approach: structure, flows, rules, access, decisions record | [proposal.md](proposal.md) (v2, owner's decisions recorded in section 0) |
| How screens look | Paper file "Wendo RMS · Approved designs" (`01M3TP8J54R83RHC9FJ7RAHGKG`): pages "Workforce · Proposal" and "Workforce · A. The people" |
| Audit screenshots | [audit-screens/](audit-screens/) |

If sources disagree: **Paper approved page > this README > proposal.md > code.**

## Design status

Chapters by job, each step tagged with who acts and on which device. One chapter at a time; the owner approves each before the next starts.

| Group | Chapter | Paper page | Status |
|---|---|---|---|
| A. The people | 1 Role homes and navigation | Workforce · A. The people | **Approved by the owner, 4 Oct 2026**, with these changes made: timeline dots get a concentric ring; the Branch Manager Home is built for many staff (department filter, "Needs a look" first, healthy people collapsed by department); a department head sees their own pay data only |
| | 2 Hire an employee | same | **Approved by the owner, 4 Oct 2026** (9 steps: directory, five-step Add employee, the new file with its onboarding checklist, the employee's first sign-in on a phone, and the casual path) |
| | 3 Departments and heads | same | **Approved by the owner, 5 Oct 2026** (revised after feedback): (9 steps: Organisation as a two-column page with sites on the left and a Positions tab, one department page, assign a head with a "what changes" summary, a head on leave, add a department, the Positions page, and three position dialogs: add, change "clocks in" with who it affects, retire) |
| | 4 Employee file and HR workspace | same | **Approved by the owner, 5 Oct 2026** (revised after feedback): (15 steps: file Overview with a completeness ring, probation card and life timeline; Job and pay; Documents; Activity; Transfer; the Branch Manager's view with pay and bank locked; probation decision; send to another site; exit; an exited file with undo and rehire; edit job; change pay; create the contract; upload a document; the employee's phone for the emergency contact) |
| B. Schedule and time | 5 Build the rota | Workforce · B. Schedule and time | **Drawn, awaiting owner review.** 10 steps (steps 9 and 10 are the department head's phone rota and the printed weekly rota ROT-0042). The first 8: two-column rota (departments left for a Branch Manager), cell popover, start from last week, approved-leave override, change-after-publish summary, Shift templates, add or edit a shift (unpaid break is part of the template), and the HR view (sites left, department filter). Still to draw: department head's phone rota and the printed weekly rota |
| | 6 A day at work | same | **Drawn, awaiting owner review.** 6 phone steps: clock in with 2-minute undo, on shift and the 10-minute heads-up, the shift-end prompt (finish now, or stay on with a reason), leaving early and "clocked out by mistake" (goes to the Branch Manager and System Admin), no signal and the 15-minute auto-close, and the prompt content for Waiter, Barista and Store Attendant |
| | 7 Today board and fixing time · 8 Timesheets and overtime · 9 My time and Report a problem | to come | not started |
| C. Leave and conduct | 10 Leave · 11 Conduct | to come | not started |
| D. Pay | 12 Payroll · 13 Rules | to come | not started |
| E. Trust and shared parts | 14 Audit and security · 15 Waiting for you · 16 When things go wrong · Signed documents index | to come | not started |

**KPI strips (owner, 4 Oct 2026):** every strip copies the approved Catalog strip: one bordered band with a soft white-to-grey fill; each cell has a 10px Geist Mono caption, a 30px semibold number and a 12px grey line; cells you can act on get a 2px warning top border, a warning-coloured number and a "→". Applied to the Employees directory, the HR Home, the Branch Manager Home and all of Chapter 3.

**Decisions from the owner's Chapter 3 and 4 feedback (4 Oct 2026):**
- **Layout:** a list with a detail beside it (two columns, selected row marked in caramel) replaces expanding rows, as in the old Dispatch screens.
- **Navigation:** every screen's step title says how you get there, for example "(Organisation, Positions tab)". Positions is a tab inside Organisation, not its own menu item.
- **Probation:** 3 months by default, one extension of up to 3 months, set by the Director in Rules. HR decides: confirm, extend once, or end. Confirmation completes only once the contract is signed. The Rules screen for it is drawn in Chapter 13.
- **Exit:** the file stays marked Exited. An exit can be undone for 7 days; after that, Rehire reopens the same file with a new start date, new probation and new contract, and the gap shows on the timeline. There is never a second file.
- **Same-day site transfer:** HR can send someone to another site for a day or a few days ("Send to another site") with no approval. Their home department and approvals do not change, it ends by itself, and both Branch Managers are told.

**Documents (owner, 5 Oct 2026):** every document follows the approved LPO style (Paper page "Inventory · Purchasing", step 9): A4, navy bar and navy accents only (no espresso on documents), the real Wendo logo image, small-caps document type with a number, a signature in Alex Brush with "Signed with PIN" and time, the same QR pattern as the LPO with "Scan to open", and a footer. All document text is Times New Roman; only the signature is Alex Brush. Letters (offer, appointment, pay change, probation, transfer) are plain letters on one letterhead with no tables. Contract wording is standard Kenyan clauses under the Employment Act, 2007 and the lawyer replaces the wording later. Drawn so far: offer letter and employment contract (Chapter 2, steps 10 and 11), head appointment letter (Chapter 3, step 10), pay change, probation decision, transfer letter and certificate of service (Chapter 4, steps 16 to 19). Still to draw with their chapters: weekly rota, timesheet sign-off, leave slip, warning notice, payslip, pay run summary, casual daily pay voucher.

**Colour (owner, 5 Oct 2026):** brown is for buttons and the active menu item only. Status uses colour: the file-completeness ring is red under 50%, amber 50 to 84%, green 85 to 99%, solid green with a tick at 100%; the probation bar is green with more than 30 days left, amber at 30 or fewer, red at 7 or fewer.

Also to draw: one "Workforce · Interaction spec" artboard for the whole module, and the states kit and wording table.

## Navigation (as drawn in Chapter 1)

One Workforce menu in the approved geometric sidebar style. A link a role cannot open is hidden, never greyed. Groups and links by role:

| Role | Workforce | People | Pay | Settings | Me |
|---|---|---|---|---|---|
| HR Manager | Home, Waiting for you, Schedule (Rota, Shift templates), Timesheets | Employees, Organisation, Leave, Conduct | Pay runs, Payslips | Rules, Audit log | My leave, My payslips |
| Branch Manager | same as HR | same as HR | none | Rules (own branch), Audit log (own branch) | My leave, My payslips |
| Store Manager | same as Branch Manager | Employees, Leave, Conduct | none | Rules, Audit log | My leave, My payslips |
| Accountant | Home, Waiting for you, Employees | none | Pay runs, Payslips | Rules (statutory), Audit log | My time, My leave, My payslips |
| Director | Home, Overdue approvals, Schedule, Timesheets | Employees, Organisation, Leave, Conduct | Pay runs, Payslips | Rules, Audit log | My leave, My payslips |

On a phone there is **no bottom tab bar**. The menu is a drawer (the same menu, in the same style) opened from a slim top bar that shows the brand, the shift pill and the job's one primary action. Its groups are Home, Job, Team (heads only), Inbox and Me (My time with sub-links, My leave, My payslips, Profile and security). Home opens with a warm greeting and the person's photo, then a stack of cards: shift, waiting for you, job cards, team, this week. Rule recorded in `docs/ROADMAP.md` (rule 8). Home is the live board for managers (there is no separate "Today" link).

## Open points carried from the proposal

- Who holds the petty cash and pays casuals each day (recommend the Branch Manager or a person they name).
- Whether the client wants holiday rules.
- The legal limits on deductions and the overtime multipliers (the Accountant or the client's lawyer confirms).
- Statutory deductions: calculated from dated tables, or typed until the Accountant confirms.
- Departments, positions and heads move from Access to Workforce: needs the Access and Organisation lane's agreement. The Company/Site rename is landing on main; these documents speak of "branch" and "site" as concepts.
