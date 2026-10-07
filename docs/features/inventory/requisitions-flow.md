# Requisitions: flow and screens (owner answers applied, 7 Oct 2026)

Group R of the final Inventory design pass (order: Requisitions, Dispatch, Branch day, Branch waste). Nothing is drawn until the owner approves the screen outline in [final-pass-screen-plan.md](final-pass-screen-plan.md). Paper page: "Inventory · Requisition and dispatch" (empty today). Companion rules: [discrepancies.md](discrepancies.md).

## What this group is

A branch asks the Central Store for stock. **Each Department Head asks for what their department needs.** Those asks combine into **one requisition for the whole branch** (`REQ-nnnn`). The Branch Manager reviews it and signs once. The approved requisition goes to the Store Manager and into the dispatch queue (Group D). The requisition file stays the single thread for the whole journey: ask, approve, pack, deliver, confirm, close.

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
| Director, Accountant, System Admin | Read everything. System Admin can do every action, signing with their own PIN |

## Numbers

`REQ-nnnn` per branch per cycle. Children: `DSP-nnnn` per department dispatch, `DSC-nnnn` per discrepancy, `DAY-nnnn` per branch day.

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

**Missing or wrong:** change a line in the row ("you changed 20 to 14", head told); **Return a section** with a required note; a department not in yet has one main action, **Nudge**, and a menu with *Fill it myself* and *Send without this section*; **Cancel** before approval, with a reason.

## After approval: additions

A requisition is **not locked** after approval, but changes are explicit.
- A head can **add lines** (new items, or more of an item) to an approved requisition. The new lines show in their own block, **"Added after approval"**, with who added them and when, and never overwrite approved lines.
- An addition needs the **head's PIN** and the **Branch Manager's approval** (PIN) before it goes to the store. Until approved it shows as *Waiting for Peter*.
- Additions are allowed **until that department's dispatch is signed**. After that, a new need is a new requisition (Extra).
- **Reducing or removing** an approved line is the Branch Manager's change, with a reason, until that department is packed.
- Every addition and change is a linked entry on the file's Activity.

## Urgent

An urgent flag can be set when starting or any time before approval. It notifies the Branch Manager at once and the **Director if still unapproved after 1 hour (fixed)**. It never bypasses the signature.

## Every state of a requisition

| State | Tracker | Who does what | Main button |
|---|---|---|---|
| Collecting | Started, sections coming in | Heads fill and send; manager can nudge | **Send section** (head) / **Nudge** (manager) |
| Ready to approve | All sections in, or sent without some | Manager reviews and signs | **Approve and sign** |
| Returned (a section) | Section back with a note | Head fixes and resends | **Send again** |
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
