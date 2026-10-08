# Block 1 front end (phone): Paper vs contract gaps (Stage 1 report)

Screens opened at full size in Paper: steps 1, 2, 3, 4, 5, 6, 10, 14, 15, 18, G1, the states kit (21), the wording table (22), "Phone menus by role", and the notification map. Compared with `requisitions-contract.md` (+ Amendment 1), the front-end contract mirror, and back end A's README and `requisitions-state.ts`. Nothing is built. Each item says what I need decided; where I list a "default", that is only what I will do if you say nothing.

## A. Screens the contract does not cover

1. **Step 1, the "12 Kitchen items are below their restock level" line.** Paper shows the count of suggested lines *before* the requisition is started. R7 `Home` has no such number. Need: add `suggestedLineCount` to R7 (back end B), or drop the number from the line.
2. **Step 1, the cycle picker.** Paper lets the head pick Morning, Afternoon or Extra. `Home.open` describes only the suggested cycle. A head may have Morning open while choosing Afternoon, and a second start in the same cycle is a 409. Need: R7 returns the open requisition for each cycle, so the picker can show "Continue" or disable a cycle. Default: pick a cycle, press Start, and show the 409 message inline if it exists.
3. **Step 1, home when a requisition is already open.** Paper draws only the "nothing started" state. The Draft, Sent, Changed-by-manager and Approved states of the home are not drawn. Default: when a requisition is open for the suggested cycle, the home goes straight to that section's screen (step 2, 6, 10 or 14). Confirm.
4. **Step 1, "Earlier today".** Paper shows a "Delivered" chip and "Kitchen asked for 9 lines · confirmed at 9:10 am". "Delivered" and the confirm time are Block 2 data. `earlierToday` has no time field. Need: what chip and sub-line show before Block 2. Default: the status chip from `statusText` (Approved, Closed) and "Kitchen asked for N lines · sent 6:40 am", which needs `sentAt` added to `earlierToday`.
5. **Step 1, headline per cycle.** Only two headlines are drawn: "Nothing asked for yet this afternoon" and, for Extra, "Something came up after the Afternoon one?". Need the Morning headline, the Extra headline when no Afternoon exists, and the evening wording.
6. **Steps 2 and 6, "started 1:41 pm".** The header shows the time the requisition was started. `SectionEdit` and `Home.open` carry no `openedAt`. Need: add `openedAt` to R8 and R7.
7. **Steps 2, 3 and 5, two-level categories.** The contract gives Kitchen `categoryPath` with two levels. Paper draws one flat heading per group ("Prep kitchen · chicken and beef", "Dry items"). Need: how the two levels show. Default: one heading, the path joined with " · ".
8. **Step 3, "removed" and "changed" counts.** The footer says "11 lines · 2 changed · 1 removed" and step 6 says "4 changed from the suggestion" after reload. R12 replaces the whole draft, so the server forgets removed lines, and `changedCount` cannot include them. The sheet in step 5 says "4 changes" (2 changed, 1 removed, 1 added). Need: either the server records removed suggested lines and counts them, or "changed" means quantity differs or line added, and removed lines are counted only on the device before sending. Back end A decision.
9. **Step 3, when the draft is saved.** R12 is a whole-draft PUT. Paper does not say when it is sent. Default: debounced autosave (about 600 ms after the last edit) plus a flush on Review and send. Confirm. Also: stepper step size is 1 and typing is allowed; for kg and litre items I will allow decimals when typed. Confirm.
10. **Step 3, small inconsistencies in Paper.** "Changed from 36" has no unit but "Changed from 11 kg" has one; row text is "Level 40" in step 3 and "Restock level 40" in step 2. Default: unit shown only when it is not obvious from the stepper, "Level" in edit rows, "Restock level" in read rows, as drawn.
11. **Step 4, starting quantity.** `AddableItem.suggestedQty` can be 0 for items at or above their level; quantities must be above zero. Default: start at the suggested quantity, minimum 1.
12. **Step 5, "See every line".** Not drawn. Default: expands the sheet to the full read-only line list. Confirm.
13. **Step 5, the Branch Manager note.** `noteForManager` is saved by R12, not by R13 (`{ pin }` only). Default: save the draft (with the note) and then send. No maximum length is given. I will use 200 characters. Confirm.
14. **Step 5, "no changes" case.** For "Send as suggested" the "N changes" chip would read "0 changes". Default: hide the chip.
15. **Step 6, "See lines".** Opens a read-only list of the sent lines, not drawn. Default: step 2's layout, read-only.
16. **Steps 6, 10 and 14, the head's tracker.** Paper draws a head-specific tracker with different steps and words on each screen:
    - Step 6: Kitchen asked, Branch Manager approves, Store packs and sends, Kitchen counts and confirms.
    - Step 14: Approved, Packed and signed, On the way, You count it and sign.

    The contract tracker is six steps with the labels Started, All in, Approved, Packed, Delivered, Closed. They do not match. Also, a head sees only their own section (R3), so the head cannot tell whether other sections are in; the requisition status gives it (Collecting means "Waiting for the other sections", Ready to approve means "Waiting"). Need: confirm the head tracker is built on the phone from the requisition status, own section and approval data, using the Paper words, and that the Block 2 rows show greyed with no dates until Block 2.
17. **Step 10, "The head is told".** Needs, per changed line: asked quantity, approved quantity, unit and reason. The contract has these (`requestedQty`, `approvedQty`, `changeReason`). Not drawn: how the notice goes away (a seen/acknowledge action), several changed lines (only one is drawn), and a line with no reason. Default: the banner stays while any line has `changedByManager`, lists each line, and omits "Reason:" when empty. Also open: if the head recalls and resends, does a line the manager changed keep its Approved quantity? R12 sends only `requestedQty`. Back end A decision.
18. **Step 14 without dispatch data.** Paper shows "Your delivery is on the way" (Block 2). For an approved requisition still with the store, no banner or wording is drawn. Back end A drafted "Approved. Waiting for the Central Store." and that phrase is not in Paper step 22 either. Need: the words for the approved, not-yet-packed banner. Proposal: "Approved. Waiting for the Central Store." Also whether the tracker and carrier slot show nothing or only the Approved row (I will show the Approved row only).
19. **Step 15, after the addition is sent.** Only the compose screen and the confirm sheet are drawn. The pending state ("Added after approval", "Waiting for approval") on the file after sending is not drawn, and there is no way to recall or edit a pending addition (contract has none). The sheet already shows "Waiting for approval" before it is sent. Also: "More of an approved item · 12 already" means adding an item that is already on the approved list. R21 does not say whether a duplicate item is allowed. Plural wording: "Ask for 2 more lines?" has no singular. Need: confirm duplicates are allowed, the pending display on the file, and the singular.
20. **Step 18, Urgent.** Drawn only at start. The contract (R15) lets the head set or clear Urgent on their section any time before approval, and the brief lists an "Urgent switch", but no Paper screen has a switch after start and none shows an Urgent badge on the section screens. Default: only at start, plus a small "Urgent" tag on the section header. Confirm, or send a design for the after-start switch.
21. **Step 18, the paragraph under the switch.** "Housekeeping needs a deep-clean kit before tomorrow's inspection. Only your section is filled in." is it a note field? R11 has no note. "Only your section is filled in" also suggests an Extra starts with the head's section pre-filled while the others stay empty. Need: static example or a text field; and whether an Extra pre-fills from restock levels (contract says the starter's section is pre-filled for every cycle).
22. **Step 18 vs wording table.** The screen says "The Branch Manager is told at once. If it is not approved within 1 hour, the Director is told too and can approve it with their own PIN." The table says "The Director is told if it is not approved within 1 hour and can approve it." Default: use the screen's version.

## B. History (G1)

23. **Row content.** Paper shows "Sent Wed 7 Oct · 6:40 am" and, for a cancelled row, "Cancelled Tue 6 Oct · asked twice by mistake". R9 rows have `openedAt` only: no `sentAt`, no `cancelledAt`, no cancel reason. Need: add `sentAt`, `cancelledAt`, `cancelReason` to R9 (back end B).
24. **Tabs.** Paper has Requisitions and Deliveries tabs. Deliveries is Block 2. Default: no tab bar in Block 1, a plain History with the requisitions list.
25. **Table rules.** Paper shows date range, status, numbered pager with no search and no rows-per-page; UI_BUILD_RULES §4a asks for search first and rows per page. Paper wins; default: build what Paper shows, state in URL. Confirm.
26. **Tapping a row.** Opens the head's read-only view of that requisition (closed and cancelled screens are not drawn). Default: the same screen as step 6, with the status banner and no Recall.
27. **Member.** The menu map gives a member a History row that holds past deliveries only (Block 2). In Block 1 that page would be empty. Default: add the History row for heads only now; the member row arrives in Block 2.
28. **Back arrow on History.** Paper draws a back arrow on History (a drawer destination). Default: follow Paper.

## C. Wording and errors

29. **Back end A's new error codes have no wording in Paper.** Step 21 draws only "Couldn't load requisitions" and step 22 has no error rows. Proposed wording (inline message on the screen, per the kit rule), please approve or edit:
    - `REQUISITION_ALREADY_OPEN`: "This cycle's requisition is already started. Open it from Requisitions."
    - `INVALID_PIN`: "That PIN is not right. Try again."
    - `NOT_YOUR_DEPARTMENT`: "That belongs to another department."
    - `SECTION_EMPTY`: "Add at least one line before you send."
    - `ITEM_NOT_IN_DEPARTMENT`: "That item is not on your department's list."
    - `ALREADY_APPROVED`: "This requisition is already approved."
    - `NOT_READY_TO_APPROVE`: "Not every section is in yet."
    - `ADDITION_LOCKED`: "Your delivery is already signed. Start an Extra instead."
    - `REASON_REQUIRED`: "Give a reason for the change."
    - `DEPARTMENT_PACKED`: "The store has already packed this. It can't change now."
    - `CANCELLED`: "This requisition was cancelled."
    - `SECTION_NOT_SENT`: "Your list has not been sent."
    - `SECTION_ALREADY_SENT`: "Your list is already sent. Recall it to change it."
    - `NOT_APPROVED`: "This requisition is not approved yet."
    - `SECTION_NOT_OPEN`: "This list can't be changed now."
    - `ADDITION_NOT_PENDING`: "That addition is no longer waiting."
    - `BRANCH_CODE_MISSING`: "This branch has no code yet. Ask the owner to set it."
    - Offline: "No connection. Your list is kept; try again when you are back online."
    - Unknown error: "Something went wrong. Try again."

    The front-end contract mirror's `REQUISITION_ERROR_CODES` lacks the six extra codes. I may not edit it (read only), so I need an owner-approved amendment or permission to add them.
30. **"Next step" card wording against Paper step 22.** Checked the draft in `requisitions-state.ts` against the step 22 tables.
    - Match: "Everything is in. Ready for your signature."; "X hasn't sent yet" with "Nudge X"; "Cancelled" with "Start a new one"; "Closed" with "Print".
    - Not in Paper: "Approved. Waiting for the Central Store." (Paper's state name is "Approved, with the store"; buttons "Add to this requisition (head) · Print"). "An addition is waiting for a signature" (Paper names the state "Addition waiting", button "Approve addition"). "Collecting" with no waiting section.
    - Tracker labels: back end uses Started, All in, Approved, Packed, Delivered, Closed. Paper's tracker column reads "Started, sections coming in", "All sections in, or sent without one", "Approved, with the time and who".
    - Paper has no phone "Next step" card. The desktop screens that use it (8, 11, 12, 13) belong to the other front-end session, so I have not checked those.
31. **Step 22 title.** It says "eight states" and lists seven rows. Cosmetic.

## D. Other

32. **Mock service.** The prompt says a hand-written mock service exists. I found none under `features/inventory/requisitions`. I will write one beside the services, driven by the contract fixtures.
33. **Badges and sockets.** The map shows no count badge on the head's Requisitions row, and R2 does not say what `requisitions` counts for a head. Default: no badge for heads in Block 1. The phone screens refetch the open requisition when `inventory:badges` arrives (map row 2 needs the screen to update). The push deep-link path is not specified; default: `/app/branch/requisitions/[id]`.
34. **Head menu rows.** The map lists Requisitions, Deliveries, Day (Count tonight, Past days), Waste, History. Block 1 builds Requisitions and History. Default, per the prompt: Deliveries, Day and Waste stay as links to the old pages; "Past days" is not added until Block 4.
35. **Person display.** `Person` has `roleLabel` and `name`. Default: show "You" when the actor is the viewer, otherwise the role label ("Branch Manager"), never the name.

## Decisions I need from you, in order of how much they block
- Items 3, 16, 18, 20, 21 (screen behaviour not drawn).
- Items 1, 2, 4, 6, 8, 17, 23 (small additions to R7, R8, R9, R12 for back end A or B; or tell me to drop the Paper detail).
- Item 29 (approve the error wording) and the contract mirror amendment.
- Everything else I will take as the stated default unless you say otherwise.
