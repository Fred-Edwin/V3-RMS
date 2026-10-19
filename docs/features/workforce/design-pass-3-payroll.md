# Workforce design pass 3: Payroll and timesheets as one feature (Chapter 12)

19 October 2026. A design session with the owner on Paper page "Workforce · D. Pay" (file `01M3TP8J54R83RHC9FJ7RAHGKG`). No code was written. The owner rejected the earlier Chapter 12 (pay runs) and Chapter 8 (timesheets) and asked for payroll and timesheets to be redesigned from scratch as ONE feature, **Payroll**, with the month as its backbone. The new chapter replaces both. **The owner approved the set on 19 Oct 2026** ("consider the rest approved"); the old Chapter 12 and the old Chapter 8 frames were deleted.

## What the owner decided

| Question | Decision | Why |
|---|---|---|
| What is the unit of payroll? | One calendar month. One page per month, months list on the left, the month on the right. There is no separate pay run. | One place, one story. |
| How is a month shown? | KPI strip on top, a very dark hairline, then the months list and the month. Tabs: Timesheets, Rules applied, Tax and deductions, Casual pay, Totals, Payslips. | Same layout everywhere. |
| What is the stage line? | Timesheets approved, Calculated, Reviewed, Approved, Published, Paid. Amber for the current stage, green when finished, grey to come. | The owner's amber rule: amber means in progress or needs you. |
| Who approves timesheets? | The manager of each site (Branch Manager, Store Manager for the Central Store, Director for Head office). HR can NOT approve for a site. Payroll waits for any unapproved site. | Simpler code, one approver per site. |
| Who prepares and approves payroll? | The system calculates, HR reviews, the Accountant approves with a PIN. Nobody approves a month they prepared. The Accountant confirms the tax tables first. | Separation of duties. |
| Where is a selected month marked? | Neutral grey (#E4E2DE) with a dark left bar. Never amber. | Amber is kept for action. |
| Date filter on timesheets | The standard date range picker, with quick picks per Monday to Sunday week. | One date filter in the product. |
| Export | PDF (landscape, signed, drawn as a document) and Excel (drawn). Timesheet: department then name A to Z, 20 people on page 1, a department never split. Payroll: register (PDF, Excel), summary (PDF), statutory schedules (Excel), bank file, all payslips. | A month can be taken away and filed. |
| Draft stamp | Every export says "Draft, not approved" until the Accountant approves. Excel is a working copy that names the signed document it matches. | Only the PDF carries the signature and QR. |
| Who can export payroll? | The Accountant, HR and the Director. Branch Managers cannot export payroll, only their own timesheets. | Payroll is company-level. |
| How are the table rows shown? | 50 rows per page, a pager only when there are more. | Table convention. |
| How is the open month shown to the Director? | An estimate: pay **earned so far** (not "spent": nothing is paid during the month), the expected pay for the whole month, a bar that is amber while the month is open (green when paid) with a marker for today, and the change against the month before. | Salaries are paid after the month ends. |
| Can a published month be corrected? | **Yes, until the Accountant marks the month Paid.** HR or the Accountant corrects the one payslip with a reason and a PIN; it is audit-logged; the staff member is told; the payslip becomes version 2. Staff do not raise anything in the system: they phone HR or the Accountant. | The owner did not want a "raise a correction" pathway built. |
| What locks the month? | **Marking the month Paid.** The dialog says plainly that nothing can be changed afterwards. After that, a change goes through the developer, or is put right as a line in next month's payroll. | A clean, single event. No timer. |
| What about the bank file? | Payment is by bank only (no M-Pesa). The file is available once the month is published. If a payslip is corrected after it was downloaded, the file is voided and a new one is downloaded. Casual pay is paid from petty cash and is not in it. | |
| Is there a Director reopen? | No. It was drawn, then removed (the Director could not say whose payslip). | |
| Staff pay timing | Staff see their payslip as soon as it is published and are paid a few days later (pay day Fri 23 Oct for September). | |

## Staff on the phone (owner, 19 Oct 2026)

- **My payslips home:** the latest net pay as the hero, **amounts hidden by default with an eye icon to show them** (the same for the year so far, the recent list and the history), View payslip and Download PDF, a year-so-far bar (green for net, amber for taken off; never the deep brown used by the buttons), and recent payslips.
- **Payslip detail:** a This month / Year to date toggle, earnings and deductions with each line's working, View document and Download PDF.
- **History:** payslips by year, and **Download P9 for 2026** (the Kenyan Tax Deduction Card, the year's pay and tax on one page for the staff member's KRA return; available when the year closes, January 2027).
- **Document view:** the signed payslip fitted to the phone, pinch to zoom, then Download PDF or Share.
- **Payslip document (A4):** the standard layout: employer and employee details, employee number, KRA PIN, NSSF and SHA numbers, pay method (bank, masked), earnings and deductions with this month and year to date, PAYE after personal relief, employer contributions, leave balance, version, signature and QR. The sample figures are illustrative, not from the real tax tables.
- **Casual pay sheet** (was "voucher"): the document recording the daily pay of casual workers, CPS-0318. The department head can **preview the pay sheet** before sending it to the Branch Manager; it is printed after approval. (The petty-cash accounting entry can still be called a petty cash voucher on the finance side.)

## The 36 steps

| Steps | Content |
|---|---|
| 01 | How payroll works (overview, stages, who sees what) |
| 02 to 12 | Timesheets: the month, the date range, the export menu, the exported PDF (pages 1 and 2), the Excel export, a person's drawer, the full month, deciding overtime, approving the month, the approved state |
| 13 to 18 | The payroll month: waiting for a site, rules applied, tax and deductions, casual pay, totals and HR's review, the Accountant approves |
| 19 to 21 | HR publishes (Payslips tab), the Accountant pays out (bank file), Mark as paid locks the month |
| 22 to 25 | Payroll exports: the export menu, the register PDF, the summary PDF, the Excel workbook |
| 26 | The Director's estimate for the open month |
| 27 to 29 | Corrections open until paid, correct a payslip, the month locked once paid |
| 30 to 36 | Staff phone: getting in, Payslips home, detail and history, the A4 payslip, the Document view, casual pay on the phone, the casual pay sheet, a corrected payslip (version 2) |

Sample month: September 2026 (Nyeri Town 31, Nyeri Highway 28, Central Store 11, Head office 16: 86 people, gross 4,126,400, net 3,168,500, casual pay 63,900). Rules in force: Overtime v4 (from 1 Aug), Lateness v2 (from 1 Sep), Absence v1, tax tables v4 confirmed by the Accountant on 19 Oct, 09:15. October is the open month (earned so far 2,530,000 of an expected 4,131,000, day 19 of 31).

## Who sees what

| Role | Does | Sees |
|---|---|---|
| Branch Manager, Store Manager | Approves their own site's timesheets | Their own timesheets, no payroll |
| HR | Reviews, publishes, corrects until paid | Every month, every site; exports the register |
| Accountant | Confirms tax tables, approves, corrects until paid, pays out | Every month, every site; exports |
| Director | Approves Head office timesheets | Everything read only, plus the open-month estimate |
| System Admin | Nothing in payroll | Everything read only |
| Staff | Opens their own payslip with their own code | Their own payslip: view, zoom, download, share |
| Department head | Records casual workers and previews the pay sheet | Their casual pay sheets |

The sidebar link is **Payroll** (it was "Pay runs"). Chapters 13 to 17 still say "pay run" in some copy; see the open points.

## Change log (Paper)

- New chapter "Chapter 12 · Payroll and timesheets" with 36 steps (above). Old Chapter 12 (16 steps) and old Chapter 8 (Timesheets and overtime) deleted.
- Sidebar link "Pay runs" renamed "Payroll" in the other chapters (about 65 places).
- Naming rule applied throughout: a role alone, or a name with the role; no he, she, her or his.
- Document numbers: PAY-2026-09 (payroll month), PS-0987 (payslip), CPS-0318 (casual pay sheet). The earlier PRS and CPV numbers are retired.

## Open points and code impact

- **Built timesheets (slice 4a)** follow the earlier design (period closes 18:00 on the 2nd day after the month, Close early, a week picker, a person's week). The new design is one calendar month per site, approved by that site's manager, with a date range picker, an export (PDF and Excel) and a person's drawer plus a full-month page. The build session must reconcile these; the owner decides what changes.
- The new "corrections until paid" window needs: HR or the Accountant correcting one payslip with a reason and PIN, version numbers on payslips, a voided bank file when a correction follows a download, and a lock on Mark as paid.
- The staff Payslips home hides amounts by default (the choice can be remembered per device).
- **Cleanup done (19 Oct 2026):** "pay run" was swept to "payroll" in Chapters 13 to 17 and the shared parts (captions, Waiting for you, the audit log, the Rules copy, the wording table); the Director's reopen was replaced by "payslip corrected" in the message copy; "voucher" became "casual pay sheet" (CPS-0318) everywhere; the sample month in those chapters is now September 2026 (86 people, net 3,168,500). Still unswept, on purpose: the Inventory "Prep run" wording, which is a different thing.
- The P9 document itself is not drawn; only the download button on History.
- Whether the Central Store's approver is the Store Manager and Head office's is the Director is assumed, not confirmed.

## Not changed

`backend/` and `frontend/` were not touched.
