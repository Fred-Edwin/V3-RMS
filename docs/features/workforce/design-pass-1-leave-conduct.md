# Workforce design pass 1: Leave and Conduct (Chapters 10 and 11)

19 October 2026. A design session with the owner on Paper page "Workforce · C. Leave and conduct" (file `01M3TP8J54R83RHC9FJ7RAHGKG`). No code was written. **The owner approved Chapters 10 and 11 on 19 Oct 2026.** Still open: the Chapter 13 Rules tabs other than Leave and Conduct have not been checked for the row-level Change and locked Change pattern, and the Chapter 11 staff steps 1 and 4 sit out of date order.

## What the owner decided

| Question | Decision | Why |
|---|---|---|
| How should a staff member see their leave? | A Leave home with one card per leave type HR sets: days left, taken and booked, and a bar that is green over half, amber under half, red under a quarter. A Request page, a History page, and a follow-up page for each request. | At a glance, one story, one place for each job. |
| Where does the tall dark header go? | On the first screen of a section (Leave home, History, Conduct list, a notice waiting to be signed). The thin bar stays on screens where you do something. | A tall header gives the screen a headline number; forms need the room. |
| How is a request's progress shown? | A vertical stepper with circles: green done, ringed current, red declined, grey to come, and an amber passed step when nobody answered in 3 days and it moved to HR. | Reads the real approval chain at a glance. |
| Who is named in messages to the approver? | The role ("your Branch Manager"), never a name. | The person changes, the role does not. |
| PDF or a screen for slips and notices? | A Document view: the real document fitted to the phone, pinch to zoom, Download PDF and Share. | Phones open PDFs badly. |
| Do staff sign leave slips? | No. The approver's PIN signs the slip. | A staff signature would imply they could refuse an approval. |
| Who writes a warning? | The manager raises, signs and issues it. HR decides appeals only. | The issuer never judges their own notice. |
| How is the letter wording handled? | Ready-made letters **fixed in the system**. The issuer fills the blanks and adds one line of their own. Changes are made in code; there is no editing screen. | Keeps the design simple. An editing screen was drawn and then removed. |
| Can the manager ask HR to withdraw a notice? | No button. The manager phones HR. HR can withdraw or change any notice. | Keeps it simple. |
| When do the 7 appeal days start? | From the day the notice is issued, signed or not. | Signing late never extends the appeal. |
| Can staff appeal before signing? | Yes. Signing only shows the notice was received. An appeal button is on the notice. | Someone who disagrees should never have to sign first. |
| How does the staff member find out about a notice? | Push notification, then an Inbox message, then the Conduct page, which is the permanent list with downloads. | The push can be missed, the Inbox and the Conduct page cannot. |
| Where is a leave request decided? | Only on the Leave page, with the rota. Waiting for you shows a summary and a "Review with the rota" button. Overtime and clock fixes are decided in Waiting for you. | One decision screen, not two. |

## Decided on the owner's behalf

- Sample data: Cynthia Wairimu has 12 days left, 9 taken (5 in June, 4 in August), 0 booked, plus a declined request on 27 to 29 July.
- Bar colour thresholds are fixed in the system, not a Rules setting.
- Leave home must list every type the person is entitled to (Maternity and Paternity only for those who qualify). Only Annual, Sick and Family emergency are drawn.
- The steps in each chapter are ordered staff, manager, HR. In Chapter 11 the staff steps 1 and 4 show screens that follow an HR decision, so they sit out of date order.

## Open points for later

- The "hearing" after a final written warning has no screen in Chapters 10 to 17.
- Equation or "before, change, after" rows in Chapters 12 to 17 were not swept for the alignment pattern. Chapter 10 step 15 is fixed. Matches found by a quick text search in Chapters 12 to 17: none with the NOW / NEW layout; the Chapter 11 and 10 summary rows are label and value lists.
- Chapter 15 step 6 (after-answer states) still describes leave being answered inside Waiting for you.
- The Conduct row added to the phone menu has no connector dot on the rail and uses a plain document icon.
- Phones: the sign and appeal screens (Chapter 11 step 3) are kept from the old design with role names.

## Change log (Paper)

### Chapter 10 · Leave
| Frame | What changed |
|---|---|
| Step 1 (menu) | Added a Conduct link under Me. |
| Step 2 Leave home + Request | New. Leave home with three cards, coloured bars, a bar key and a waiting line; Request kept, wording changed to "Send to your Branch Manager". |
| Step 3 History + request | New. Tall-header History with filter tabs and a hairline list; one request with the stepper. |
| Step 4 endings | New. Approved (slip download) and declined (reason). |
| Step 5 moved to HR | New. Stepper with the passed 3-day step. |
| Step 6 Document view | New. Leave slip LVE-0031 and notice WRN-0007 with logo, QR, signatures and footer cloned from step 17. |
| Step 7 Inbox answer | Kept (right phone); left phone removed. Wording changed to roles. |
| Step 8 not enough days | Kept (middle phone); declined and with-HR phones removed. |
| Step 9 Waiting for you | Decline and Approve replaced by "Review with the rota". Caption and note rewritten. |
| Step 10 Leave | Caption rewritten. |
| Step 11 approve dialog | Her, she and his copy made neutral. |
| Step 15 adjust a balance | The now, add, new row is three fixed-width columns with fixed separators. |
| Old step 2 (Ask for leave), old step 15 (three phones), old step 3 left phone, old step 14 declined and with-HR phones | Deleted, replaced by the new frames. |
| Chapter header | "19 steps". |

### Chapter 11 · Conduct
| Frame | What changed |
|---|---|
| Step 1 Conduct page | New. Tall-header list of notices with download; one notice with a stepper, download and appeal. |
| Step 2 Inbox + notice | The notice before signing is new: tall header, stepper with "Sign that you received it" current, sign, read the full letter, and "I do not agree · appeal to HR". |
| Step 3 sign and appeal | Wording changed to roles. |
| Step 4 outcome + Conduct page | Right phone replaced by the Conduct list after an appeal (verbal note active, written warning replaced with a download). |
| Step 7 issue a warning | The own-line label and the caption say the letter is ready-made. |
| Step 8 notice document, step 9 record not signed | Gendered copy made neutral. |
| Chapter header | "13 steps". |

### Editing a rule (agreed 19 Oct 2026)
- Decision: every row of a Rules table that the viewer may change has a "Change" link in a fixed column; the page-level "Change this rule" button is gone. Change opens the shared dialog (now to new, from, why, PIN, what it would change, who is told).
- Chapter 10 step 18 (Rules, Leave): Change on each leave type row (HR); minimum cover has no link in the HR view; header now "Changed by HR".
- Chapter 10 step 19 (new): the Change dialog for Annual leave (21 to 24 days from 1 Jan 2027, version 2). Old step 19 is now step 20; the chapter header says 20 steps.
- Chapter 10 step 20 (minimum cover, Branch Manager): the "Edit minimum cover" button replaced by Change on each row. The dialog is still the older, shorter one (no reason or PIN) and should be redrawn as the shared dialog.
- Chapter 13 step 7 (Rules, Conduct): Change on each level and each time limit (Director); the page-level button removed.
- Chapter 13 step 8 (new): the Change dialog for how long a written warning stays (6 to 9 months from 2 Nov 2026). Steps 8 to 12 are now 9 to 13; the header says 13 steps.

### Locked Change links and the "later" frames (19 Oct 2026, second round)
- Decision: where a viewer cannot change a row, the Change link stays visible with a padlock and a click says who can ("Only the Branch Manager of Nyeri Town, the Director or the System Admin can change minimum cover. Ask one of them."). This replaces the earlier "hide the link" rule. Minimum cover is changed by the Branch Manager (own site), the Director or the System Admin; HR reads it.
- Chapter 10 step 18: locked Change links on the minimum cover rows, with the popover shown open on one row. Step 20 dialog redrawn as the shared dialog (reason, PIN, who is told).
- Chapter 10 and 11 "Not drawn yet" frames renamed "Drawn elsewhere": the cards now say where each item is drawn (Chapters 12, 13, 14, 15 and the shared States kit). Only the lawyer's decision on figures and wording remains open, and it is not a screen.
- Other Rules tabs in Chapter 13 are not yet checked for locked Change links.

### Chapter 13 · Rules, Conduct tab (step 7)
- Who does what: Whoever issues raises, signs and issues; HR decides every appeal and can withdraw any notice; the Branch Manager reads their own site; the Director changes the rule and reads all.
- Time to appeal: counted from the day the notice is issued, signed or not.
- Subtitle: the ladder and the letters are fixed.
- An editing screen and a Letter wording row were added and then removed (the letters are fixed in the system).

### Chapter 15 · Waiting for you
- Steps 1 and 2 (Branch Manager and HR): leave rows show "Review with the rota" instead of Approve and Decline.

## Design pass 2: Chapters 12 and 13 (19 Oct 2026)

The owner agreed all four recommendations: Branch Manager own-site editing only on Lateness, Overtime and minimum cover; the same Document view for a payslip; Chapter 12 ordered by the monthly run with staff and heads last; roles in messages, names only on signed records.

### Chapter 13 · Rules
| Frame | What changed |
|---|---|
| Steps 1, 3, 4, 5, 6, 10, 11 (Lateness, Overtime, Attendance, Probation, Casual work, Holidays, Week and breaks) | "Change this rule" button removed. A Change link on every changeable row; rows the system sets say Fixed (Probation signed contract, Casual who records and who approves, unpaid break per shift template). |
| Step 6 Casual work | Branch Manager "who holds the cash" line now Read only. |
| Step 9 Statutory | "Change a rate" button removed; Change on every band, relief and deduction row. |
| Step 10 Holidays | Change on each holiday. New row "Pay for hours worked on a holiday" with a locked Change and popover (only the Accountant can change it). |
| Step 2 Lateness dialog | Caption says Change on a row opens this one dialog; labels now NOW and FROM in the same style as Chapter 10. |
| Step 3 Overtime panel | Names replaced by the role. |
| Step 12 Version history | Page-level button removed. |
| Step 13 Who edits what | Rebuilt as a table: tab, changed by, confirmed by, told. Subtitle explains Change, padlock and Fixed. |
| Chapter header | Intro says every row has a Change link and where the Leave tab is drawn (Chapter 10 step 18). |

### Chapter 12 · Payroll
| Frame | What changed |
|---|---|
| Whole chapter | Reordered and renumbered 1 to 16 plus Designed later: overview, worked payslip, Pay runs, Accountant confirms the tables, prepare, review, approve, publish, pay run summary, Director reopen, staff phone payslip, Document view, A4 payslip, casual phone, voucher, status reference. Two duplicated step numbers and two missing captions fixed. Header says 16 steps. |
| Step 12 Document view (new) | The payslip PS-1042 as a phone Document view: logo, QR, Accountant signature, pinch to zoom, Download PDF, Share. Cloned from Chapter 10 step 6. |
| Step 11 payslip phone | "Save as a PDF" became "View document". |
| Messages | "Anne Muthoni" and "Mercy Achieng" replaced by the role in messages and captions. Names stay on signed records, the audit log and the sidebar user. |
| Copy | "her" and "he" removed from the review table. |
| Step references | Captions that pointed at steps 2, 3 and 4 now point at 5 and 6, and "Steps 5 to 8". |

### Open after pass 2
- A Branch Manager's view of Lateness and Overtime (with locked rows for other sites) is not drawn; only the Director's view and the Holidays padlock are.
- "Accountant pays out" (overview step 7) still has no screen of its own.

## Not changed

`backend/` and `frontend/` were not touched. Chapters 14 to 17 were not changed.
