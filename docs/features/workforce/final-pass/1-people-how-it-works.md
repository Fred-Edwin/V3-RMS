# How People works (plain words)

Written 21 Oct 2026 from the specs, the code and what the review saw on screen. Where a statement comes from reading and not from seeing it work, it says "by design".

## What People is for
People is the employee file: who works at Wendo, in which branch and department, in what job, on what pay, under which contract, and how they leave. Everything else in Workforce (rota, time, pay, leave, conduct) points at a person, so this part comes first. Nobody is ever deleted. A person who leaves is marked as exited and the file stays.

## Who uses it, and what each role can do
- **HR Manager** does the work: hires people, finishes files, records contracts, decides probation, changes pay details, transfers and exits people, and manages departments, positions and heads. HR also **asks** for a pay change.
- **Director** reads everything and is the one who **approves or declines a pay change**. The Director cannot hire or exit anyone.
- **Accountant** reads the people list and pay details. Cannot hire, cannot see the Organisation page.
- **Branch Manager and Store Manager** see only their own site. They can add a new person with the basics (name, phone, ID, job, start date) and can edit that file only while it is still being set up. Pay, bank, IDs and documents show as "Locked for your role". They can name or end a department head at their own site.
- **Department head** may read the basics of their department's people and write a probation report for HR (by the rules). In the browser today a head has no People screen and no menu link to My file (findings 60 to 63); the owner agreed to add a probation-report card on their Home, a read-only "My team" list and a My file link.
- **A staff member** opens **My file**: they see their own job, IDs and bank in clear, can add an emergency contact, a photo and personal numbers, and cannot change their job.
- **System Admin** is not an employee (no file, no payslip, no clock). The access table lets them hire and edit basics, exit, transfer and manage departments and heads, but never see pay, IDs or bank. In the browser they have the Workforce Home, Attendance clock and Security alerts, and no People or Organisation screen (finding 75; the owner is deciding their scope).

## The normal flow
1. **Add employee** (five steps: Who, Job, Pay, Statutory and bank, Login). It saves as a draft as you go. A casual has three steps and no login. A Branch Manager sees two steps (Who, Job); HR finishes the rest. A duplicate ID or phone is caught on the way.
2. The new person appears on **Employees** as "Needs finishing" until bank, contract, photo and login are in. Pay set at hire is in force on the start day.
3. HR opens the **employee file**. Tabs: Overview, Job and pay, Documents, Activity (Time and Leave are greyed, Conduct is present). The Overview shows a completeness ring, the probation card, the next steps and a "Life at Wendo" timeline.
4. **Probation:** three months by default. HR confirms, extends once (up to three months, with a reason) or ends it. The probation card shows the day count.
5. **Contract:** HR records the contract dates. This only records it; there is no signing yet.
6. **Pay changes:** HR asks, naming the new amount, the day it starts and a reason. It goes to the Director. Until the Director approves, the old amount applies. Nothing is overwritten; every amount stays in the pay history. Nobody approves their own request.
7. **Moves:** transfer to another site, or send to another site for a period (a loan). A preview says what changes first.
8. **Exit:** HR records the reason and the last day; the person is "on notice" until the last day passes, then the nightly job closes the file, stops the login and ends any head role. Exit can be undone for 7 days after the last day; after that, a rehire reopens the same file.
9. **Organisation:** per site, a list of departments with the head, the number of people and who approves things. A department without a head is a gap, and approvals go to the Branch Manager "for now". HR or the Branch Manager can assign a head, name an acting head until a return date, or end a head. The Central Store never has heads. Positions (job titles) are company-wide; HR edits them, and changing whether a position "clocks in" first shows how many people it affects.

## Rules the system enforces
- Every request is checked by capability, not by role name, in one access table.
- A record outside your scope answers "not found"; an action you may not do answers "forbidden".
- Sensitive fields (pay, bank, IDs, documents) are hidden by default and shown masked (last four digits). Showing one is an audited action. Opening someone's pay or a document is logged unless it is your own.
- Every change is written to the audit log in the same step; the entries checked held no passwords, PINs or pay amounts.
- Nightly at 00:05 Nairobi: start-day activation, exits closing, moves and pay changes taking effect, head flags reconciled, old drafts dropped.
- The head flags that Inventory reads are written only through one gateway, from the head records.

## What is shown, and what is hidden
Pay and bank: HR, Director, Accountant, and the person themself. Everyone else sees "Locked". The Branch Manager never sees pay amounts. A person's own My file shows their IDs and bank in clear.

## How it connects
Before: Access (logins and roles) and Inventory's departments. After: the rota uses the department and whether a person clocks in; attendance and timesheets use the same flag; payroll reads pay amounts and the bank details; leave and conduct read the person, department and head. Several screens still say "arrives with Attendance/Leave" for figures that now exist.

## Deliberately not built (or not yet)
Contract signing with a PIN, contract text templates and the signed-document index (later slices); a full audit trail per person on the Activity tab; asking HR for a change from a Branch Manager's screen; a global "find a person" box; the employment type edit; the exit checklist screens for final pay and leave. The legacy staff and department screens still exist but are not linked from the new menu rows.

## What the live walkthrough changed (21 Oct 2026)
The review was followed by a walk of all eight roles in a browser (HR, Director, Branch Manager, Accountant, Store Manager, department head, staff at phone size, System Admin). It found 77 items (`1-people-findings.md`). The owner decided:
- **Payout:** Cash and M-Pesa stay as choices, because casuals are paid that way (findings 1, 2, 22 are "leave"). The pay change has no PIN step; this is still for the owner to confirm (finding 4).
- **Sign-in identity:** `firstname.secondname@wendo.co.ke` (a clash gets a number); an optional personal email at hire; a temporary password like `kahawa.nyota.4721` (two Swahili food words and four digits, made by the server, an unused one expires after 7 days), which the person is never forced to change; the PIN stays compulsory.
- **Conventions everywhere:** a person is always shown as name, position and site; every card the role may change has an Edit button; wording is short, professional and clear.
- **Notifications:** no Inbox inside Workforce; notifications go on each role's Home with a bell.
- **Director:** to read and write everything, with "nobody approves their own request" kept (finding 42).
- **Still to be designed in Paper, then built:** a proper Home for every role, the menu by feature with one naming convention, and the "Is this your phone?" step (the "Welcome back" login is not to be touched).
