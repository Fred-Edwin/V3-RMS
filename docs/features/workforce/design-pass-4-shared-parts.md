# Workforce design pass 4: shared parts after payroll (Chapters 14 to 17 and conflicts)

19 October 2026. A review of Chapters 14 (Audit and security), 15 (Waiting for you), 16 (When things go wrong) and 17 (Signed documents) against the approved Chapters 12 (Payroll and timesheets) and 13 (Rules). No Paper redraw and no code yet; this file records the owner's decisions and the list of changes to draw.

## Decided by the owner (19 Oct 2026)

| Question | Decision |
|---|---|
| Who is told when someone presses "This wasn't me", or a payslip is opened on an unconfirmed phone, or 3 wrong payslip codes? | **The System Admin**, not the Director. This replaces every "the Director is told" in the account-security alerts (Chapter 12 step 30, Chapter 14 steps 3 and 6, Chapter 16 step 2, the wording table, the Interaction spec). The System Admin sees who, when and which phone, never amounts. The Director still reads the whole log, read only. |
| One audit log or one per feature? | **One company-wide audit log**, one screen under Settings, Audit log, with an **Area filter** (Workforce, Inventory, Access and so on). Role visibility stays per area. The audit foundation is written generically so other features write into it; the older Inventory trails move into it when Inventory is next touched. |
| Waiting for you and Overdue approvals | **Both removed.** Replaced by numbered **menu badges** on each link and a **"Needs you" card on each Home** whose rows open the page where the decision is made. The Director's overdue list becomes a card on the Director's Home (reminders only). Leave is decided on the Leave page, overtime and clock fixes in Timesheets and the Today board, payroll steps in Payroll, appeals in Conduct. |
| Department head approvals | **A department head approves nothing**: no overtime authorising (the earlier 30-minute allowance is dropped) and no missed clock-in decisions. The Branch Manager (own site) decides both. The head's phone keeps the team rota and who is on shift. |

## Also decided (owner accepted the recommendations, 19 Oct 2026; nothing is open)

- **Clock fixes and Report a problem on approved or locked months** (conflict 2): before the site's manager approves the month, the Branch Manager fixes it alone; after approval and until Paid, HR or the Accountant corrects the one payslip (reason, PIN, version 2); after Paid, the developer or next month's line. This removes the "after the window needs the System Admin" rule.
- Menu: only Branch Managers and Store Managers keep a separate Timesheets link; HR, the Accountant and the Director read timesheets inside Payroll.
- Sample month: 86 people everywhere (the "85 paid, 1 left out" example moves to a different case).

## More decisions (owner, 19 Oct 2026)

- **Nobody is signed out automatically for inactivity.** The "Session ended" message, the 30 minute idle rule and the "keeps unsent typing" row are removed from Chapter 16 and the Interaction spec.
- **The UI never explains how the system knows a phone.** No "private marker" wording on any screen; the explainer card is deleted. The first sign-in only asks "Is this your phone?". The mechanism stays in developer docs only.

## Done in Paper (19 Oct 2026)

- **Chapter 14:** Area filter on the log, new payroll and timesheet events, rows re-timed to the September story; System Admin replaces the Director in the account-security alerts (steps 3 to 6 and the visibility table); steps reordered: 2 Activity on my record (tall header, filter chips, flagged entry, one entry opened), 3 Your phones (first sign-in, My phones, Remove this phone), 4 Someone else opened your payslip.
- **Chapter 15:** the Waiting for you page and Overdue approvals are gone. It is now "Needs you on Home": the Branch Manager, HR, Accountant and Director Home cards, states, and a "what changed" step. The head's phone step is deleted.
- **Chapter 16:** Session ended card and row removed; new rows for a site not approving timesheets, a paid month, a corrected payslip after the bank file, a wrong PIN, a request on an approved month, a padlocked Change; payslip alerts go to the System Admin.
- **Chapter 17:** index shows PAY-2026-09 (summary and register), PS-0987 version 2, CPS-0318 and TSH-0019; QR check fixed; retention decided at 7 years.
- **Chapter 4 (Add employee):** M-Pesa and Cash removed from "Paid out by"; bank only.
- **Chapter 9:** Report a problem goes to the Branch Manager; after approval, tell HR. **Chapter 12 step 36:** the payslip button is now "Questions? Call HR" (no in-app problem pathway).
- **Menu sweep:** the "Waiting for you" and "Overdue approvals" rows were removed from the Workforce frames (pages A, B, C, D and E, about 130 frames); the Home card titles that said "Waiting for you" now say "Needs you". The Director's "Overdue approvals" row is gone too.
- **Still to do in Paper:** (1) the separate Timesheets menu link still shows for HR, the Accountant and the Director in the older embedded menus; the navigation table in code is the authority (only Branch and Store Managers get it), so the Paper menus are not redrawn one by one; (2) check the Chapter 1 Home frames for the new "Needs you" card content (only the label changed); (3) the System Admin's own alert on desktop (Chapter 14 step 6 card) is still described, not drawn.
- **Known side effect:** one menu-row fragment in a Chapter 13 frame was removed by mistake during the sweep and is not visible in the checked frames; if a Chapter 13 sidebar looks off, redraw that row.

## Changes to draw

### Chapter 14 Audit and security
- Add the Area filter to the log; new events: timesheets approved per site, payroll calculated, reviewed, approved, published, month marked paid, payslip corrected (version 2), bank file downloaded or voided, export downloaded. Remove "Timesheet period signed" and "Payroll prepared".
- Activity on my record: "Timesheet approved, September" and "Payslip corrected" rows.
- Visibility table: a Branch Manager sees changes to their own site's Lateness, Overtime and minimum cover; the System Admin sees account-security alerts including payslip opens on unconfirmed phones (no amounts).
- Step 3 and the "not drawn yet" alert card: the System Admin, not the Director.

### Chapter 15 Waiting for you
- Retire the chapter as a page. Replace with the Home "Needs you" cards for the Branch Manager, HR, the Accountant, the Director (overdue, reminders only) and the menu badges. Remove the head's phone step. Keep the states that still apply.

### Chapter 16 When things go wrong
- Replace "Open items at the cut-off" with "a site has not approved its timesheets" (Remind). Add: month locked once paid; payslip corrected after the bank file was downloaded; wrong PIN on approve or pay; a request on an approved month; padlocked Change (Chapter 13). Payslip code alert goes to the System Admin. One code screen style (boxes or one field) in Chapters 12 and 16.

### Chapter 17 Signed documents
- Index rows: PAY-2026-09 (September, 86 people), CPS-0318, the month timesheet report, PS-0987 with version 2 shown as replaced. QR check: fix the leftover PRS-0010 and October; add the draft-export result ("Draft, not approved, no signature"). Names in buttons become roles.

### Conflicts
1. Chapters 2 and 4: remove M-Pesa from the pay profile (bank only).
2. The clock-fix rule across Chapters 7, 9 (after the decision above).
3. Chapter 1: Home "Needs you" cards, payroll stage for HR and the Accountant, the open-month estimate for the Director, "Approve September" for the Branch Manager.
4. Slice 4a (built timesheets): keep the clock-time engine; remove the 18:00 day-2 auto-close, Close early and the week picker; add per-site month approval, the date range picker and exports. Decided in the build plan.

### Smaller gaps (later)
The hearing after a final written warning; the Branch Manager's Lateness and Overtime view with locked rows; the P9 document; confirming the Central Store (Store Manager) and Head office (Director) approvers; the Conduct menu connector dot.

## Not changed
`backend/` and `frontend/` were not touched. Paper was not edited in this pass.
