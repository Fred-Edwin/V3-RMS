# Handoff: Workforce cleanup pass

Paste everything below the line into the next agent's first message.

---

You are the product designer and critic for the Wendo RMS **Workforce** module, design lane 3. You draw screens in Paper and write docs. You write **no application code**.

## Where you work
- Folder: `/home/fred/Projects/V3-RMS-lanes/lane-3`, branch `docs/workforce-design` (ports 3103/4103). Never touch `~/Projects/V3-RMS` (the owner's main folder), production, or the owner's untracked files. Nothing is pushed and no PR is opened until the owner says "merge".
- Paper file "Wendo RMS · Approved designs", id `01M3TP8J54R83RHC9FJ7RAHGKG`. Workforce pages: p-A-0 (A. The people), p-B-0 (B. Schedule and time, plus the shared Notifications wording table `19TC-0`), p-C-0 (C. Leave and conduct), p-E-0 (D. Pay), p-F-0 (E. Trust and shared parts, Interaction spec, States kit).
- Docs: `docs/features/workforce/README.md` (status table, decisions), `proposal.md`, and the earlier handoff `handoff-groups-c-d-e.md` (design rules and Paper lessons: read its "Design rules" and "Paper lessons" sections first).
- Rules from `CLAUDE.md`: Edit/Write tools only for files (no sed/awk/python), a `Why:` line before each Edit/Write, commit with `git add <explicit paths>` and the trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`, end with a ~5 line plain-English recap. Finish Paper work with `finish_working_on_nodes`.

## State
All chapters are drawn: 1 to 17, the Interaction spec (13 rules plus 14), the States kit, and the wording table. The owner approved Chapters 1 to 9 (Group A and B). Chapters 10 to 17 await approval. The owner has now approved the decisions below and asked for one cleanup pass before reviewing each chapter.

## Decisions confirmed by the owner (do not reopen)
- The Director owns the Conduct rule (HR reads). The ladder (verbal note, written, final written) is fixed in code; names, durations (3, 6, 12 months) and letters are set in Rules.
- Audit entries are kept 7 years, then archived; the QR check page works for the same 7 years, then says "archived".
- A department head may record a clock-in for their own team when there is no signal; a reason is required; the person is told and can dispute it; the Branch Manager sees it on the Today board.
- Holiday work pays 2 x the hourly rate (default, to be confirmed by the Accountant and lawyer). Wendo is open every day; holidays only affect pay.
- The system ships with empty statutory tables; the Accountant types and confirms them (PIN) before the first run. Confirming comes BEFORE preparing a run. Typed mode is removed. Do not invent real rates.
- Pay out: version 1 produces a bank payment file; the Accountant uploads it and marks the run paid. Each pay profile says bank or M-Pesa. No money moves inside the system.
- Petty cash for casuals is held by the Branch Manager by default, with one named delegate allowed in Rules.
- Nobody is ever locked out for wrong payslip codes. Every try is logged; the owner is told after 3. The code screen always warns that opening someone else's payslip is recorded; the Director is told only when it happens on an unconfirmed phone.
- Leave counts every calendar day. One date picker everywhere: the approved range picker from Inventory, Stock and Counting step 28 (frame `KH0-0` on page p-8-0, node `KOH-0`). To reuse it on another page, write HTML with `<x-paper-clone node-id="KOH-0">` inside an absolute wrapper, then edit the cloned cells (see Chapter 14 step 1, `1O17-0`, clone `1RZ5-0`).

## Tasks (do all, in this order, committing at the end of each group)

**Group 1: consistency fixes**
1. HR sidebar: Chapters 10 and 11 HR steps use the Branch Manager sidebar. Swap in the HR sidebar. Copy it from Chapter 12 step 3 (`1IDY-0` on p-E-0), which is the HR shell with Pay runs active. Never redraw a sidebar: duplicate a finished step, delete the main content, write yours, switch the active row with `update_styles` (row `rgba(217,166,94,0.09)`, text `#D9A65E`, weight 500; reset the old one to transparent / `#B5AEA5` / 400).
2. Chapter 10 steps 10 and 11 (Rules tabs strip) must show all ten tabs: Lateness, Overtime, Attendance, Leave, Probation, Casual work, Conduct, Statutory, Holidays, Week and breaks.
3. Joy Chebet's leave balance: Chapter 4 shows 12.5 annual days; change to 5 (21 days a year, earned 1.75 a month, started 14 Jul 2026). Re-check every other Joy balance.
4. Pay run timeline must read the same everywhere: Accountant confirms the tables 19 Oct 09:15, HR prepares 09:40, Accountant approves 11:05, HR publishes 11:20, pay day Fri 23 Oct. Fix the audit log (Chapter 14 step 1, "Pay run approved 13:48", "Pay run prepared 11:20"), Chapter 15 (Accountant list "Today 11:20", HR list "Today 13:48"), Chapter 16, and any wording-table row that quotes a time.
5. Search for leftover "typed mode", "typed" and "locked for" wording in Chapters 12, 13, 14, 16, the wording table and the Interaction spec, and remove it.

**Group 2: dates**
6. Replace plain date boxes and custom calendars with the standard picker: the leave request calendar (Chapter 10), timesheet period selectors (Chapter 8) and any other date or range control. Keep each screen's own data; only the control changes. List what you changed in the README.

**Group 3: missing pieces**
7. Draw the Rules "Week and breaks" tab in Chapter 13 (Director sets; the week starts on Monday; the unpaid break comes from each shift template). Add it as a step and renumber.
8. Add a "Casual pay this period, paid from petty cash" memo line to the pay run summary document PRS-0010 (Chapter 12), so total labour cost is complete. It is not part of the net total.
9. Update Chapter 12 for pay out: after publishing, the Accountant downloads the bank payment file and marks the run paid. Add this to the overview step (Chapter 12 step 1) and the status reference. Show bank or M-Pesa on the pay profile if a screen for it exists; otherwise note it.
10. Casual tab (Chapter 13 step 6): petty cash line should say "The Branch Manager, or one named person" (replacing the open-point wording).
11. Wording table (`19TC-0`, step frame `19T5-0`, duplicate the last row frame `1QBP-0` and edit): add rows "Accountant confirms the tables" (HR and the Director told) and "Payslip opened on an unconfirmed phone" (the Director also told). Check the table frame still fits.

**Group 4: docs and handover**
12. Update `docs/features/workforce/README.md`: status rows, the decisions above, remove resolved open questions, keep a short list of anything still open.
13. Run a final read of every chapter by screenshot (chapter level first, then any step you changed) and fix overlaps. Chapter 12 is on p-E-0 (`1I4H-0`, 15 steps), Chapter 13 below it; Chapter 14 to 17 and the Interaction spec and States kit are stacked on p-F-0.
14. Finish with `finish_working_on_nodes` on every chapter you touched, commit, and write the 5-line recap saying where to find the work and what is left (the owner then reviews chapter by chapter).

## Paper lessons that matter here
- `find_nodes` only searches limited depth and often returns nothing for text; it does find some text nodes. Walk with `get_children`, `get_tree_summary`, and read the `descendantIdMap` from `duplicate_nodes`.
- `duplicate_nodes` takes `nodes: [{id}]`; `move_nodes` takes `moves: [{nodeId, parentId, index}]`; `rename_nodes` takes `updates`.
- Use `write_html` with `targetNodeId` and `mode: "insert-children"`. Empty divs become rectangles. Screenshots can be stale or black: retake.
- Never delete a node by guessing an ID. Confirm with `get_node_info` first.
- Step frames: 1440 wide, 44px caption bar, 900px content; documents are 794 wide. Chapters are 6264 wide with a wrapped row of steps; if you add steps, check the chapter does not overlap the next one and move it with `update_styles {top}`.
- Caption "STEP NN" text is the first text in the bar frame; when you add a step, renumber the ones after it.

## Process
Answer questions with a recommendation and wait for approval before editing Paper when the owner says "outline", "tell me whether" or "do you think we should". Once approved, do all of it without stopping. Check names, dates and totals across steps; the owner reads each screen against the others.
