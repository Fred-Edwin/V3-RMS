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
| A. The people | 1 Role homes and navigation | Workforce · A. The people | **Drawn, awaiting owner review** |
| | 2 Hire an employee | same | not started |
| | 3 Departments and heads | same | not started |
| | 4 Employee file and HR workspace | same | not started |
| B. Schedule and time | 5 Build the rota · 6 A day at work · 7 Today board and fixing time · 8 Timesheets and overtime · 9 My time and Report a problem | to come | not started |
| C. Leave and conduct | 10 Leave · 11 Conduct | to come | not started |
| D. Pay | 12 Payroll · 13 Rules | to come | not started |
| E. Trust and shared parts | 14 Audit and security · 15 Waiting for you · 16 When things go wrong · Signed documents index | to come | not started |

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

Staff and department heads use the phone: Home (the clock card), their app's own tabs, **My time**, and under More: Leave and Payslips. Home is the live board for managers (there is no separate "Today" link).

## Open points carried from the proposal

- Who holds the petty cash and pays casuals each day (recommend the Branch Manager or a person they name).
- Whether the client wants holiday rules.
- The legal limits on deductions and the overtime multipliers (the Accountant or the client's lawyer confirms).
- Statutory deductions: calculated from dated tables, or typed until the Accountant confirms.
- Departments, positions and heads move from Access to Workforce: needs the Access and Organisation lane's agreement. The Company/Site rename is landing on main; these documents speak of "branch" and "site" as concepts.
