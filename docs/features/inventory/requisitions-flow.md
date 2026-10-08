# Requisitions: flow and screens (owner answers applied, 7 Oct 2026)

Group R of the final Inventory design pass (order: Requisitions, Dispatch, Branch day, Branch waste). Nothing is drawn until the owner approves the screen outline in [final-pass-screen-plan.md](final-pass-screen-plan.md). Paper page: "Inventory · Requisition and dispatch" (empty today). Companion rules: [discrepancies.md](discrepancies.md).

## What this group is

A branch asks the Central Store for stock. **Each Department Head asks for what their department needs.** Those asks combine into **one requisition for the whole branch** (`REQ-NYR-nnnn`, see Numbers). The Branch Manager reviews it and signs once. The approved requisition goes to the Store Manager and into the dispatch queue (Group D). The requisition file stays the single thread for the whole journey: ask, approve, pack, deliver, confirm, close.

A branch can have several requisitions a day: **Morning**, **Afternoon**, and an **Extra** one when something comes up. There is one open requisition per branch per cycle.

## Principles carried over from Purchasing

1. **One record, one page.** A requisition is a file that looks the same in every state. Status, tracker and the one main button change.
2. **A tracker with dates and who**, a **Next step** card, **Items / Documents / Activity** tabs.
3. **Lists are queues by stage**, with counts, and the action sits on the row.
4. **Read for all, write by job.** Every desktop role opens every requisition; buttons appear only for whoever does that job. No permission-denied screens.
5. **Traceable both ways.** The file links to its dispatches (`DSP-`); a dispatch links back to its requisition.
6. **Corrections are new linked entries** with a reason. Nothing is deleted.
7. **Few taps.** Pre-filled suggestions, "send as suggested", one summary and one PIN per signature.
8. **One states kit and one "every state" table**, not artboards per screen per state.

## Devices

- **Department Head: phone first.** Phone screens render as a centred phone-width column at desktop width (same as Stock, Count and Waste). No separate desktop layout.
- **Branch Manager, Store Manager, Director, Accountant: desktop first.** No phone frames now.
- No fake phone status bar on any frame.

## Links and roles

- **One sidebar link: "Requisitions"**, with a badge of what waits for you. One row in `nav-table.ts`. It opens on **your** tab: Department Head on their own section; Branch Manager on To approve; Store Manager and Attendant on To pack (Group D).

| Role | Does |
|---|---|
| Department Head | Starts the requisition (if none is open for the cycle), fills, edits, sends with a PIN, recalls their own section, adds to an approved requisition. Sees only their department's catalog slice, no costs |
| Branch Manager | Reviews all sections, edits any line, returns a section, nudges, signs once with a PIN, approves additions, cancels before approval. Can also start a requisition |
| Store Manager / Attendant | Read here; they act in To pack (Group D) |
| Director | Reads everything and **can approve any requisition** (and an addition) with their own PIN, for any branch (owner, 8 Oct 2026) |
| Accountant, System Admin | Read everything. System Admin can do every action, signing with their own PIN |

## Numbers

**`REQ-<branch>-nnnn`** (owner decision, 7 Oct 2026), for example `REQ-NYR-0112`: a three-letter branch code and a counter that runs **per branch**, so each branch has a clean sequence and the Central Store sees the branch at a glance. The branch code is a setting on the branch (build note: add it). Screens always lead with a plain label ("Afternoon · Wed 7 Oct") and show the number smaller beside it; people are not expected to read the number. Children keep the same shape: `DSP-NYR-nnnn` per department dispatch, `DSC-NYR-nnnn` per discrepancy, `DAY-NYR-nnnn` per branch day (the dispatch file also shows its parent `REQ-` number as a link).

## Departments

The five departments are **Kitchen, Barista, Pastry, Service, Housekeeping**. The list is data, not code: the Branch Manager or System Admin can add, rename or retire a department in Settings. A requisition has a section per active department. A department with no tagged items counts as done (as today). *Build note:* check the department list in the schema before the build session.

## The journey, by tap

**Department Head (phone), the routine case: 4 taps**
1. Open **Requisitions**. It opens on **my section**: if none is open for the cycle, **Start the afternoon requisition** (cycle pre-chosen by time of day, changeable to Morning or Extra). Lines are pre-filled with *restock level minus on hand*, grouped by category.
2. Check the list. Tap **Send as suggested**.
3. A summary sheet ("12 lines, nothing changed") with **Send**.
4. Enter the PIN. The section shows *Sent, waiting for Peter to approve*, with **Recall** until the Branch Manager approves.

**When something differs:** change a quantity (stepper or typing; changed lines show "changed from 27"); remove a line with **Undo**; add an item by search, grouped by category; add a note for the manager. A returned section opens with the manager's note on top and the changed lines highlighted.

**Branch Manager (desktop), the routine case: 4 steps**
1. Tap the badge or **Requisitions**. It opens on **To approve**.
2. Open the requisition. Each department is a chip: *Not started, In, Returned, Approved*. All lines are grouped by department.
3. **Approve and sign** opens a drawer: what will be sent per department, what changed, "One signature covers the whole requisition".
4. Enter the PIN. The heads are told, and the requisition goes to the Store Manager's queue.

**Missing or wrong:** change a line in the row ("you changed 20 to 14", head told, optional reason); **there is no "Return a section"** (owner decision, 7 Oct 2026: the manager rings the head if needed, then edits the quantity); a department not in yet has one main action, **Nudge**, and a menu with *Fill it myself* and *Send without this section*; **Cancel** before approval, with a reason.

## After approval: additions

A requisition is **not locked** after approval, but changes are explicit.
- A head can **add lines** (new items, or more of an item) to an approved requisition. The new lines show in their own block, **"Added after approval"**, with who added them and when, and never overwrite approved lines.
- An addition needs the **head's PIN** and the **Branch Manager's approval** (PIN) before it goes to the store. Until approved it shows as *Waiting for Peter*.
- Additions are allowed **until that department's dispatch is signed**. After that, a new need is a new requisition (Extra).
- **Reducing or removing** an approved line is the Branch Manager's change, with a reason, until that department is packed.
- Every addition and change is a linked entry on the file's Activity.

## Urgent

An urgent flag can be set when starting or any time before approval. It notifies the Branch Manager at once and the **Director if still unapproved after 1 hour (fixed)**. It never bypasses the signature, but the Director may sign it themselves with their own PIN (owner, 8 Oct 2026); the record shows who approved.

## Every state of a requisition

| State | Tracker | Who does what | Main button |
|---|---|---|---|
| Collecting | Started, sections coming in | Heads fill and send; manager can nudge | **Send section** (head) / **Nudge** (manager) |
| Ready to approve | All sections in, or sent without some | Manager reviews and signs | **Approve and sign** |
| Approved, waiting for the store | Approved with PIN | Store packs per department (Group D) | **Add to this requisition** (head) |
| Addition waiting | Added lines flagged | Manager approves the addition | **Approve addition** |
| Packing / On the way / To confirm | Per department | Store packs; heads confirm (Group D) | per Group D |
| Closed | All departments confirmed | Everyone can open | **Print** |
| Cancelled | Stops at the point of cancel, with reason | Kept on record | **Start a new one** |

## What the old designs got wrong, and what changes

- Four sidebar items split the journey (Requisitions, Deliveries, Day, Waste) with no link between them. Now one thread.
- Counts that drive no action ("Today's volume 156 units"). Now stage tabs with counts that mean "waiting for you".
- Four number columns and a struck-through figure beside a boxed one. Now Requested and Approved only; on hand and restock level sit under the item name.
- The main button at the bottom of a long scroll. Now a Next step card at the top and a sticky footer on phones.
- Three equal buttons on a missing section. Now one primary action and a menu.
- About 33 artboards of loading, error, empty and permission-denied variants. Now the states kit, the every-state table and one wording table.
- A fake phone status bar. Removed.

## Decisions (all settled 7 Oct 2026)

1. Heads start the requisition; asks combine into one per branch per cycle; Morning, Afternoon and Extra.
2. A head's send needs a PIN.
3. Additions after approval are allowed, clearly marked, and approved by the Branch Manager; closed once the department's dispatch is signed.
4. Urgent: Director told after 1 hour, fixed.
5. Five departments, with more addable.

Screens are listed in [final-pass-screen-plan.md](final-pass-screen-plan.md).

## Design log (Paper, page "Inventory · Requisition and dispatch")

### Batch R1, "Ask for what we need" (7 Oct 2026): approved by the owner, 7 Oct 2026

Chapter 1, six phone steps for the Kitchen head: start, check the list, change lines, add an item, send with PIN, sent and waiting. Routine path is steps 1, 2, 5, 6.

Judgement calls (owner to confirm):
- **Summary and PIN are one sheet** (step 5). The head types the PIN and taps **Send for approval**, so the routine case is still 4 taps: start, send as suggested, PIN, send. The earlier wording ("summary sheet with Send, then the PIN") would have been 5.
- **"4 taps" counts the PIN as one tap**, and holds once the requisition is open; starting it adds one tap, so the caption says so.
- **Task screens use a back arrow**, the home screen a menu icon (same as the Stock, Count and Waste head phones). No bottom tabs, no status bar.
- **The send sheet shows an order summary, not sentences** (owner correction, 7 Oct 2026): a receipt-style card with the item total, a "changes" pill, and one row per category (item count and the item names on one truncated line), plus "See every line". It stays the same size however many items there are. On the routine path the pill is absent.
- Quantities are right-aligned in one lane; on hand and Restock level sit under the item name; no money anywhere.

Owner corrections:
- **Titles, not names, in screen copy** (7 Oct 2026): write "the Branch Manager sees what you changed", never "Peter sees...". Names appear only where a record states who did something (activity lines, audit), and even there prefer the title where it reads well. Applies to all later batches and groups.

### Batch R3, "After approval" (7 Oct 2026): approved by the owner, 7 Oct 2026

**Document-name colour (owner, 7 Oct 2026): `#1F5BAE`.** Every linked document number on screen (`REQ-`, `DSP-`, `DSC-`, `DAY-`) is Geist Mono in `#1F5BAE`, underlined. This replaces the ink-and-underline rule below and the copper used first. Printed documents keep ink numbers.


Chapter 3, steps 13 to 17: the approved file following its dispatches (13), the head following their delivery (14), the head adding to an approved requisition with PIN (15), the Branch Manager approving the addition (16), and the printed requisition (17).

Judgement calls (owner to confirm):
- **Step 13 reuses the two-pane file.** The rail now lists one dispatch per department with its `DSP-NYR-` number (a link) and status; the pane shows the selected dispatch (packed by, signed by, carried by, approved vs sent, a short line flagged). The Next step card has no button while the store works; **Print** is the only action.
- **Step 14 never shows sent quantities** (the branch counts blind, see `discrepancies.md`). It shows the tracker, the `DSP-` link and the carrier. "Add to this requisition" stays available until the department's dispatch is signed.
- **Step 15: one sheet for summary and PIN**, same as the head's send. The "Added after approval" block sits apart from the approved lines, which are marked "stay as approved".
- **Step 16: review, then PIN** (2 steps). The block shows already-approved against added quantities and value; the dialog says the 12 approved lines do not change and the lines join the Kitchen's unsigned dispatch.
- **Step 17: one combined A4**, a cover plus a page per department, **no money** (owner decision: it goes to the Central Store to fulfil). The cover lists departments with their `DSP-` numbers and pages, the manager's changes, and additions; each department page has asked, approved (changes struck through), a Packed tick box, an "Added after approval" block and blank Packed by / Signed by / Carried by lines. Only the cover and the Kitchen page are drawn; the other four follow the same layout.

**Owner corrections to R3 (7 Oct 2026):**
- **The packer signs the dispatch.** "Packed and signed by the Store Attendant"; the Store Manager appears as signer only when they sign themselves. Step 13 and step 14 now say so.
- **Document numbers are blue `#1F5BAE`, not copper.** `REQ-`, `DSP-` and the rest are Geist Mono in `#1F5BAE` (owner's colour), underlined when they are links. Copper stays for the main button, the active tab and the selected row. Applies to every later screen, in every group.
- **Step 17 follows the approved LPO and statement template:** A4 794 by 1123, 48px side margins, the 10px navy top bar, the round logo with "Wendo Coffee Bistro" and a grey subtitle, a small mono label above a large mono document number, a two-column info block (party left, key and value right), a table with a `#` column and mono uppercase headers over a navy rule, cursive PIN signatures (Alex Brush) with "Signed with PIN", a QR code, and the standard Lobster footer. No money. Ink and grey only, no copper. The department page keeps the same header, with the dispatch number under the requisition number, a Packed tick column, and blank Packed by, Signed by and Carried by lines (the Dispatch group will draw the delivery note itself).

### Batch R4, "Exceptions and reference" (8 Oct 2026): approved by the owner, 8 Oct 2026

Chapter 4 plus the group cover and screens index (24 screens in all).
- **18 Urgent:** a switch on the head's phone before sending (Service head, Extra cycle). **18b** Director's list: urgent ones show after the fixed 1 hour with **Open and approve** (owner, 8 Oct 2026: the Director can approve any requisition, with their own PIN).
- **19 Cancel:** dialog over the file page with a required reason and a PIN; only before approval; the file stays on record as Cancelled.
- **20 Departments in Settings:** add, rename, retire; a department is data, not code. Row menu holds Rename and Retire.
- **21 States kit:** Empty, Empty with an action, Error with Retry (320 by 220, as in `shell-states.tsx`), and three skeletons (list with tabs, file page, phone list) that keep the real shell. Drawn once for the whole pass; later groups add only wording.
- **22 Every state and the wording table:** seven states (Returned is gone) and eight moments with their words, titles not names.
- **Cover and screens index** are drawn in the Purchasing format, left of Chapter 1. Index lists 24 rows: 22 steps plus 7b and 18b.
- **Chapter 2 was rebuilt in its final form** during this session, because its steps row disappeared from the file for an unknown reason. Content follows the R2 corrections below.
- **Owner approved R4 (8 Oct 2026)**, with one change: the Director can approve anything (not only urgent ones). Step 18b caption, banner, button and the wording table were updated. Cancel needs reason and PIN; the Departments settings page is for the Branch Manager (a hub-level Director view is not drawn).

### Batch R2, "Review and approve" (7 Oct 2026): redrawn after owner review; rebuilt 8 Oct 2026 and approved with Group R

**Owner changes after the first review (7 Oct 2026):**
- **Two-pane file, not drop-downs.** A department rail (status, lines, value, "1 changed", running total) on the left; the selected department's full lines on the right, nothing truncated. Replaces the chips and collapsed sections in steps 8, 11, 12.
- **"Return a section" removed.** The manager edits the Approved quantity in the row (optional reason chips; the head is told). Step 9 is now "Change a quantity"; step 10 is the head's phone saying what changed, no action needed, Recall still available until approval. The Returned state is gone from the every-state table; the head's second PIN is gone.
- **Printed requisition (R3 step 17):** one combined A4 document, a cover page plus one page per department, **no money anywhere** (it goes to the Central Store to fulfil). Cover: `REQ-` number, branch, cycle, per-department line counts, who approved and when. Department pages: item, unit, Requested, Approved, changes marked, any "Added after approval" block.

- **Dark hairlines (owner, 7 Oct):** the line under the file tabs and the line between the department rail and the lines are ink, not light grey. Applies to every master-detail file screen in later groups.
- **Step 7b, the Collecting tab** (drawn after the owner asked): requisitions still waiting for a section. Columns Sections, Lines, Value so far, Open for; the row action is **Nudge Housekeeping**. It is the same list as step 7 with its own tab, rows and action.

Original notes for the batch follow (steps 9 and 10 below are superseded as above).

Chapter 2, six screens: the Requisitions list (7), the file while collecting (8), return a section (9), returned to the head on a phone (10), approve and sign (11), approved and sent (12). Steps 7, 8 or 11, 12 are the Branch Manager's 4 steps.

Judgement calls (owner to confirm):
- **The chapter is not in clock order.** Captions carry the time: steps 8, 9, 10 happen at 1:58 to 2:02 pm while Housekeeping is still out; steps 7, 11, 12 at 2:10 to 2:11 pm once all five sections are in. The plan's numbering is kept.
- **The list is one screen for every role.** Seven stage tabs with counts (the Branch Manager's "waiting for you" count is the dark badge on To approve), search and filters first, a numbered pager, rows per page. Drawn for the Branch Manager, so there is no Branch column; **hub roles get a Branch column and a Branch filter**, and each role opens on its own tab. Not yet drawn for them.
- **No tab for Cancelled, Returned or Addition waiting** (recommendation from the first summary, unchanged): Cancelled sits in Closed with a status chip, a returned section in Collecting, an addition waiting in To approve.
- **Sidebar for the Branch Manager:** the master's construction with only the Branch group open (Requisitions active with a count badge, Day); the other groups collapsed. Deliveries is folded into the list tabs, so it is not drawn. Part: "Parts · sidebar · Branch Manager · Requisitions active".
- **The Next step card is the one primary action.** While collecting it is **Nudge Housekeeping** with a menu (Fill it myself, Send without this section); when everything is in it is **Approve and sign**; once approved it has no button.
- **Money shows only to the Branch Manager:** value per line, per department and in total. Approved is an editable box beside Requested; a changed line is highlighted and says the head will be told.
- **Approve and sign is one drawer**: a summary (40 lines, KES 58,020, one row per department, what you changed), one line on what signing does, and the PIN. Steps 3 and 4 of the 4.
- **After signing it is the same file page**, in its approved state, with a confirmation banner, a tracker that now has Approved filled, and each department chip reading To pack. The `DSP-` numbers appear in R3 step 13.
- **Returning a section** needs a note (required) and shows the head what they will see; a changed line is highlighted on the head's phone, and "Send again" is 2 taps (send, PIN).
