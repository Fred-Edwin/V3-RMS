# Block 1, front end (desktop): Stage 1 gap report

Branch `feat/req-fe-desktop`. Paper page "Requisition and dispatch" (steps 7, 7b, 7c, 7d, 8, 9, 11, 12, 13, 16, 17, 18b, 19, 20, 21, 22) and "gap fixes (8 Oct)" G4, each opened at full size. Compared with `requisitions-contract.md` (+ Amendment 1), `_shared/requisitions-contract.ts`, the back end A README and `requisitions-state.ts`. No code written.

Each item: **Paper shows / Contract says / Need decided.** Where I give a proposal it is only what I will do if you say "go with your proposals"; nothing is built on a guess.

## A. The list (steps 7, 7b, 7c, 7d, 18b)

1. **Filters.** Paper: Cycle (All), Department (All), "Urgent only" checkbox on the Branch Manager list; Branch and Urgent only on the Director's. Contract R1 query has `tab, branchId, q, from, to, status, page, pageSize` only. Decide: add `cycle`, `departmentId`, `urgent` to R1 (back end B, Amendment 2), or drop the three filters.
2. **Tabs.** Paper draws five tabs (Collecting, To approve, To pack, On the way, To confirm). Discrepancies and History are sidebar sub-links, not tabs. Contract lists seven tabs. Proposal: five tabs; the Discrepancies and History pages call R1 with `tab=discrepancies` / `tab=closed`. Confirm.
3. **Time columns.** Paper: "Waiting" (To approve), "Open for" (Collecting), "Unapproved for" (Director's, red over 1 hour). The row has only `openedAt`. "Waiting" must run from when the last section came in, and "Unapproved for" from `urgentAt` or from all-in. Decide the start time for each, and add `allInAt` / `urgentAt` to the row if needed.
4. **Dark badge rule.** Paper: the Branch Manager's "To approve 2" is dark; the Director's "To approve 2" is plain while the sidebar Queue badge is dark; the Branch Manager's Queue badge says 4 while the tabs total 2 waiting. Decide what R2 counts for Queue per role and which tab shows the dark badge (proposal: the tab holding what waits for the caller, from `waitingForYou`).
5. **Which tab each role opens on.** Contract: "the caller's own tab", not named. Paper draws only the Branch Manager and the Director on To approve. Decide Store Manager, Attendant, Accountant, System Admin (proposal: Store Manager and Attendant on To pack; Accountant and System Admin on To approve).
6. **Value column by role.** Paper hides value on the Director's list and on hub History/Discrepancies, but shows it for the Branch Manager. The Director, Store Manager and Accountant hold `requisitions.see_value`. Decide: follow Paper per screen (no value on the hub-role lists) or show value wherever the capability exists.
7. **Urgent note.** Paper 18b quotes a reason under the row ("Deep-clean kit before tomorrow's inspection"). The contract has `urgent` as a boolean with no text, and the phone step 18 draws no note field. Decide: drop the quote, or add an urgent note field (contract change).
8. **History rows (7d).** Paper shows the closed or cancelled time, "5 departments · 5 deliveries", and the cancel reason for cancelled rows. The row has no `closedAt`, `cancelledAt` or `cancelReason`, and the deliveries count is Block 2. Decide: add the three fields to R1 rows (back end B); show the departments count only until Block 2.
9. **"Start a requisition" button** (top right, Branch Manager). Paper draws no desktop start screen. R11 needs a cycle and an optional Urgent. Decide: a small dialog with the cycle chips and the Urgent switch (as the phone step 18 does)? Also the System Admin cannot start one (back end note 3): hide the button for them.
10. **Top-bar search** "Search a requisition" with a ⌘K hint (step 7 only; 7b has no hint). It sits in the shell top bar, which I do not own, and no global search endpoint exists. Decide: leave out, or wire it to the table search.
11. **Hub Queue list.** Only the Branch Manager and Director lists are drawn. The Store Manager's To pack / On the way / To confirm tabs have no drawing (their rows and actions are Block 2). Proposal: same table, Branch column and filter, no row action until Block 2.

## B. Navigation (contract §12 against Paper)

12. **Hub roles.** Contract: one Requisitions row. Paper (7c, 7d, 18b sidebars): a Requisitions row with sub-links Queue, Discrepancies, History for the Store Manager and the Director. Proposal: follow Paper.
13. **Branch Manager's Departments row.** Paper step 20 shows Manage › Departments (between Staff and Menu). Contract §12 lists only the Director's row. Decide: add the Branch Manager's row under Manage.
14. **Director's route.** Paper G4: Operations › Branch Settings › Departments, with "Branch Settings" as a leaf row. Decide: is Branch Settings an existing page that gets a Departments page under it, or is Departments its own row under Operations (the contract's wording)?

## C. The file (steps 8, 9, 11, 12, 13, 16)

15. **Tracker.** Paper labels: Started, Sections coming in / All sections in, Approved, Packed and sent, Counted at the branch, Closed, each with a second line ("1:41 pm · Kitchen head", "4 of 5 in", "Waiting for you", "Central Store · waiting", "Each department", "5 of 5 sent"). Back end draft: Started, All in, Approved, Packed, Delivered, Closed with `at` and `by` only. Proposal: the front end owns the labels and second lines (from the table); I ignore the back end label text.
16. **"Next step" card** (compared with Paper step 22 and the steps). The back end text is `null` everywhere. Paper has a title and a body line. Differences:
    - Paper "With the Central Store now" + "The Store Manager packs each department. You will see each delivery here, and under To pack on the list." / back end "Approved. Waiting for the Central Store."
    - Paper "The Kitchen head added 2 lines after approval" + "The approved lines are not touched…" / back end "An addition is waiting for a signature."
    - Paper "Everything is in. Ready for your signature." matches. "Housekeeping hasn't sent yet" matches; Paper adds the body "4 of 5 sections are in, so the others don't have to wait. You can approve once Housekeeping is in, or send without it."
    - Paper "Five deliveries are on the way" (Block 2).
    - No Paper wording for: the Cancelled card, the Closed card, the Collecting card with no missing section. Back end has "Cancelled", "Closed", "Collecting".
    Proposal: the front end builds title and body from the action key and facts, using Paper wording. I need your words for the three missing cards.
17. **Status chip words.** Paper: Collecting, Ready to approve, Approved · with the store, Addition waiting, Packing and sending. I use these, not the back end `statusText`. Cancelled and Closed chips are not drawn on the file; I would reuse the list's chips.
18. **Nudge menu.** Paper: split button "Nudge Housekeeping" with "Fill it myself (Start Housekeeping's section for them)" and "Send without this section (Approve the 4 sections that are in)". Decide:
    - Which screen "Fill it myself" opens on desktop. Nothing is drawn; the section editor (R8, R12) exists only on the phone designs.
    - With two or more missing sections, which one Nudge targets (the back end gives one department) and whether "Send without" skips them all (the wording says so) or one at a time (R18 is per section).
19. **The "…" menu in the file header.** Contents not drawn. Needed: Print, Mark or clear Urgent (R15), Cancel requisition (R20, before approval only). Nothing on the desktop file shows Urgent being set or cleared. Decide the items.
20. **Change-quantity popover (step 9).** Chips: Agreed by phone, Enough in stock, Too much for the week, Other; links Skip and Save change. R16 takes free text `reason`. Decide: what "Other" sends (a text field is not drawn); whether Skip means "save without a reason"; whether the change is one R16 call on Save/Skip with Esc reverting the field (my proposal).
21. **After approval.** The inputs look the same in step 12, but the contract needs a required reason until the department is packed, and a lock after that (`DEPARTMENT_PACKED`). Paper has no required-reason variant (no Skip) and no locked look. Proposal: the same popover, Skip removed, and a read-only input once packed. Need your words for the lock.
22. **Department rail states.** Paper draws In, Not started, To pack, "1 changed". Not drawn: Draft ("Drafting"?), Skipped (after "Send without this section"), and what clicking Not started shows in the right pane. Need words.
23. **Documents and Activity tabs.** Only the tab labels and the counts are drawn; no content. Contract R4/R5 describe data (sentences, record links, versions). Proposal: simple list rows from that data in the States kit style. R4 and R5 are back end B, so I build against fixtures. Confirm, or hide the two tabs for now.
24. **Approve drawer (step 11).**
    - "The five heads are told" is dynamic (heads of sent sections). "You changed 2 lines: …" is drawn only for two lines; I will word one, two and "n lines" the same way unless you give wording.
    - No wrong-PIN, locked-out or network-error state is drawn. I use inline messages (States kit rule).
    - Nothing shows the Director's or System Admin's signing differently ("You signed…"). Fine unless you want the "signed as" line.
25. **Approved confirmation (step 12).** The green banner "Approved and sent to the Central Store. You signed REQ-… at 2:11 pm." plus "Back to requisitions". Proposal: shown only right after signing (route state), gone on reload.
26. **Dispatch pane (step 13)** shows "Items and dispatches", DSP- links, Packed by, Signed by, Carried by, "Open the dispatch", the short-at-store line, "Show the other 9 lines". All Block 2 data; the contract only says `dispatches` is empty. Proposal: tab reads "Items" while `dispatches` is empty; the dispatch pane waits for Block 2's shape. Confirm.
27. **Addition panel (step 16).** Paper: a "Added after approval · Kitchen" block with columns Item, Already approved, Added, Value and sublabels "New item · On hand 2 trays" and "More of an approved item · On hand …". The addition line has no flag for new item versus more of an approved one, and no "already approved" quantity. Need that from back end B (or derive it on the screen from the department's approved lines; proposal).
28. **Cancelled file.** The wording table says a cancelled file "stops where it was cancelled, with the reason", and the main button is "Start a new one". No screen drawn. Proposal: the same file with the Cancelled chip, a line carrying the reason and who cancelled, and the card button.

## D. Cancel dialog (step 19)

29. **Reason.** Paper: a required drop-down ("Asked for the wrong cycle" shown) plus an optional free note. Contract R20: one `reason` string. Decide: the full list of preset reasons, and how the two parts become one string (proposal: "Preset — note").

## E. Departments (steps 20, G4)

30. **Retire rule.** Paper: "Stops new sections. Anything open must be sent first." Back end `departments-service.ts` retires with no open-section check. Decide: add the check (back end) or change the words.
31. **Restore.** R26 has restore; Paper draws only Rename and Retire in the menu. Proposal: add Restore to a retired row's menu.
32. **Add and Rename dialogs** are not drawn (name only; duplicate name 409). I will use the standard dialog and the States kit inline error.
33. **Assigning items, a head and staff to a department you added.** Your decision: a branch does this "in Departments settings". Paper step 20 draws nothing for it (no item tagging, no head or members). I will not invent it. Need a design, or confirm it is out of Block 1.
34. **Head shown as "Grace W."** from R23. I format it as the first name and an initial.

## F. Print (step 17)

35. **Print payload against Paper.** Paper shows data the R6 payload lacks: "Asked by the Kitchen head, Grace W. at 1:52 pm" per department, started time, the addition approver's signing time and signature block ("Addition approved by … signed with PIN 15:20"), "Deliver to", the generated time, page "n of 6" (can be computed). Paper also draws a script signature (Alex Brush), a QR per page (the payload has one `qrPayload`; the per-department QR points to a dispatch, Block 2), and the Lobster Technologies footer with phone number (static text). Decide: add the missing fields to R6 (back end B) or drop those lines from the print.
36. **Names in print.** The contract says titles, not names, except where a record states who did something; "Grace W." is in the record so I take it as allowed. Confirm.

## G. States, wording, errors (steps 21, 22)

37. **Copy per screen.** The States kit has three samples: "Nothing waiting for you", "Nothing asked for yet", "Couldn't load requisitions". The desktop needs copy for each empty tab, empty History and Discrepancies, empty Departments, file load error and not-found/forbidden. I will write a per-screen table from the kit's rule (title says what is missing, one line says what to do) and bring it for approval at the end of Stage 2, unless you want it sooner.
38. **Error wording.** Step 22 has no wording for any error code. My proposals for the codes you named (the page shows the message under the action, never a card):
    - `SECTION_NOT_SENT`: "That section hasn't been sent yet."
    - `SECTION_ALREADY_SENT`: "That section has already been sent."
    - `NOT_APPROVED`: "This requisition isn't approved yet."
    - `SECTION_NOT_OPEN`: "That section can't be changed now."
    - `ADDITION_NOT_PENDING`: "That addition has already been dealt with."
    - `BRANCH_CODE_MISSING`: "This branch has no code yet. The owner needs to set one before a requisition can be started."
    Paper also has nothing for `INVALID_PIN`, "one already open for this cycle" (409), or `DEPARTMENT_PACKED`. Please approve or replace all of these.
39. **Branch codes.** Paper shows NYR and KRT (Karatina). Production is NYR, KNG, NYH. I show codes from the data, never hardcoded. Paper draws no screen to correct a branch code, so none is built and nothing is added to this list for it.

## H. Responsive, sockets

40. **768 and 1024.** Paper draws desktop at 1440 only. The two-pane file and the list columns need a rule below that. Proposal: keep the two panes down to 1024; at 768 the department rail becomes a row above the lines and the list drops the least important column. Confirm.
41. **Sockets.** Contract: `inventory:badges` nudges a refetch of R2. Proposal: on that event I refetch the badges and also the open list or file. Back end B must emit it; until then I refetch on focus.

## Not gaps (checked)

- Catalog chips: kept to the five standard chips, nothing else touched. Paper's catalog page was not part of this pass.
- Back end A's extra error codes: mapped above (item 38).
- Phone screens (1–6, 10, 14, 15, 18) and G1: not mine.
