# Workforce final pass, section 1: design notes, round 2

Paper file "Wendo RMS · Approved designs", page "Workforce · Final pass designs". Fonts: Geist and Geist Mono only. Fictional names in sample data. All six groups of round 2 are drawn and owner-approved (21 Oct 2026). Frames on the page are numbered 7.x to 12.x.

## Group 1: Edit button and person label (frames 7.1 to 7.6)
- 7.1 Job and pay tab, HR view (1440). Cards: Job, IDs and bank, Pay, Deductions and rules. Page header keeps whole-person actions only: Change pay, Send to another site, Transfer or exit.
- 7.2 Edit IDs and bank. Fields: National ID, KRA PIN, NSSF number, SHA number, HELB number (empty if none), Bank, Account number. Changing bank or account reveals "Reason for change" (required) and the note "The Accountant will be told. The change is saved in the audit log." Buttons: Cancel, Save changes.
- 7.3 Edit pay (opened from the Pay card "Edit" or the header "Change pay"). Shows Pay now and since when, New pay a month (KES), Starts on, Reason, Difference (amount and %), the note "Pay is never edited in place. This goes to the Director, and the new amount starts on the date above once approved.", a four-digit PIN. Buttons: Cancel, Send to the Director.
- 7.4 Director reviews a pay change. Person label, then Now, New, Difference (amount and "16.7% more"), Starts on, Asked by (name, position, site, how long ago), Reason, overlap warning ("Another change is already approved" with the other amount and date), PIN. Buttons: Cancel (link), Decline, Approve.
- 7.5 Person label. In a picker (two lines): name semibold, "position · site" grey, circle avatar, selected row tinted; "Nobody" last. In a list or table cell (one line): "Name · position · site"; when space runs out the site is cut first, then the position, never the name. Same label in Assign head, the hire form and Search. Paper cannot show matching letters highlighted; build it in code.
- 7.6 Sidebar attention states (see below).

### Rules drawn
| Rule | Detail |
|---|---|
| Edit | Plain "Edit" text, amber `#A8680A`, underlined, 14 px, top right of every card the role may change. No button box. |
| Read-only card | Grey tag in the same spot: "Director only · in Rules". |
| Pay | Never edited in place; a dated change the Director approves. Both "Edit" on the Pay card and the header "Change pay" open the same dialog. |
| PIN | Pay change asks for a PIN when HR sends it and when the Director decides (decision Q1). |
| Avatars | Every initials avatar is a circle (sidebar user, file header, pickers). |

## Sidebar attention marks (applied to every sidebar frame on the page)
- The brown boxed count is gone. A link with something waiting shows a 6 px amber dot (`#D9A65E`) and a small number (Geist Mono 11 px, medium, cream `#E8DFD0`), 6 px apart, right-aligned.
- Red-brown dot (`#E4694A`) only when something is overdue or blocks payroll. Nothing waiting: no dot, no number. Over 99: "99+".
- Closed feature row: one dot and the total of its sub-links. Open feature: counts on the sub-links, never on the parent.
- Not changed: the bell's unread count in the top bar (still a small brown box with a number).

## Group 2: My file on the phone (frames 8.1 to 8.6, 390)
- Dark top bar (menu, title, bell), then cards on the grey page. "Still to finish" has circle markers and an amber underlined Add (rows 56 px). IDs and bank show two columns, last four digits only, one Show for the card plus Edit.
- The person edits their own numbers at any time; it saves at once with **no HR re-check**; a bank or account change tells the Accountant. **Staff do not see who looked at their file** (remove that sentence from the HR Documents tab in the build; finding 70 closed as "not shown").
- Photo: gallery only, no camera. Full pages, not sheets: 8.4 choose, 8.5 adjust (circle crop, zoom), 8.6 could not save (reference WF-QNT5). The head's "Head of Kitchen" row under Position was not drawn.

## Group 3: Head's probation report and My team (frames 9.1 to 9.5)
- 9.1 phone and 9.3 desktop dialog: "Report on Peter Mwangi". Chips Good / Needs work / Not good, a note, "Send report to HR". Note: "Only HR and your Branch Manager can read this. Peter does not see it."
- 9.4 HR's Decide dialog keeps the approved layout and gains a note block under the three cells: "Victor Maina · Head of Kitchen", "SENT 19 OCT", the note. With no report the existing cell reads "No report yet" (not drawn).
- 9.2 phone and 9.5 desktop My team: read-only (name, position, today's status, shift), search, chips All / On shift / Not on shift, numbered pager with rows per page. No pay, no IDs, no row link.

## Group 4: Not available for your role (frames 10.1, 10.2)
- One screen for every blocked page, replacing silent redirects: the shell stays, content is a top rule, padlock ring (amber), caption "PAGE · NOT AVAILABLE", headline, who the page is for and where to go, a primary and a secondary button, "Wrong page? Ask your manager or HR (reference WF-R7K2). Nothing was changed." The "who it is for" line comes from the access table.

## Group 5: Barista, Service and Kitchen menus (frames 11.1 to 11.3)
- The work row is named for the department (Barista, Service). Links are today's production pages and stay as they are: Barista head: Barista, Performance, History, Deliveries, Requisitions. Service head: New order, Orders, Performance, Order history, Record income, Income history, Deliveries, Requisitions. Waiter phone drawer: the six Service links, no Department group. Housekeeping and non-head Kitchen or Barista drawers were not drawn.

## Group 6: Branch Manager file and Act as (frames 12.1 to 12.6)
- 12.1 Job tab for the Branch Manager: Job card left (tag "Edited by HR"), locked IDs and bank and Pay cards right ("Restricted. ... are handled by HR and the Accountant."; "Restricted. Pay is handled by HR, the Accountant and the Director."). Never write "kept from you".
- 12.2 confirm (wrong PIN: "That PIN is not right. Try again. Your account is never locked."), 12.3 banner "5 MIN LEFT" (red-brown) and a blocked step "You cannot approve this" (sender and approver must be different real people), 12.4 "Time ran out", 12.5 Directors' session detail (read only, every change, "Wendo Admin, acting as Mercy Achieng"), 12.6 phone: "Your account was used today" and Activity on my record. Frames 6.1, 6.3, 6.5 stay as the sketch. Frames 6.2 and 6.4 still say "she"/"her": reword in the build.

## Left out
- Accountant's Edit (bank only); the Accountant sees "HR only" on the other cards.
- Act as on the phone, the Branch Manager's Overview tab, Pastry and Housekeeping menus.

## Open
- 7.4 mentions an approved KES 26,000 from 1 Nov that is not in 7.1's pay history; add it in code if the data exists.
- 7.1 to 7.4 differ from the approved Employee file in layout (tabs, header buttons, Pay tag, dialog title); approved as drawn.
- The sign-in code (`frontend/app/(auth)/login/page.tsx`) still has the old layout. "Real-time visibility" wording must be checked before it ships.
- Clone glitches in Paper (sidebar badge alignment, a hidden Ctrl K chip in 9.3, 9.4, 12.1, 12.5) are Paper artefacts, not design.
