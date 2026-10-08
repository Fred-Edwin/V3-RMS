# Final Inventory design pass: screen outline, design order and review batches

Updated 7 Oct 2026 (owner agreed the outline, the Branch day rules and the shared list). Flows: [requisitions-flow.md](requisitions-flow.md), [dispatch-flow.md](dispatch-flow.md), [branch-day-flow.md](branch-day-flow.md), [branch-waste-flow.md](branch-waste-flow.md); discrepancy rules: [discrepancies.md](discrepancies.md). The Dispatch and Branch waste flows are drafts built on recommended defaults; the owner reviews each when its group comes up.

## How it is drawn

- **In batches, not all at once.** One batch is one chapter: 5 to 7 screens in the approved Paper format (a numbered step per screen, a caption naming role and device). The owner reviews each batch before the next starts. A fix after review is cheap; redrawing a whole group is not.
- **The order follows the journey**, so a reviewer reads it as a user lives it. Phone screens first where a phone user starts the journey, then the desktop screens that act on it.
- Each screen is checked against the design tokens and the geometric sidebar master as it is drawn, not at the end.
- A group's **cover, screens index, every-state table and wording table** are drawn last, once the steps are final.
- **One shared States kit** (Group R, batch R4): skeletons for a list with tabs, a file page and a phone list; the error banner with **Retry**; the empty state. Check what already exists in Paper and `frontend/components/app/shell/shell-states.tsx` and reuse it. Later groups draw **only a wording table**, never per-screen states (`UI_BUILD_RULES` §2).
- **Agent chain.** One prompt per Paper session. At the end of each session the agent drafts the prompt for the next, folding in the corrections and feedback from that session.
- Paper pages: Requisitions and Dispatch on "Inventory · Requisition and dispatch"; Branch day on "Inventory · Counting and closing"; Branch waste on a new page "Inventory · Branch waste".

## Traceability rule for every group

Every record has a number (`REQ-`, `DSP-`, `DSC-`, `DAY-`). Every stock ledger entry created by these flows shows its number as a link back to the file, so a user can go from a stock line to the record that caused it, and from the record to its ledger entries.

## Group R: Requisitions (22 screens, 4 batches)

**Batch R1: Ask for what we need** (Department Head, phone)
1. Requisitions home: start the requisition for the cycle (Morning, Afternoon, Extra), or open my section
2. My section, suggested lines pre-filled, **Send as suggested**
3. Edit lines: steppers, remove with undo
4. Add an item: search, grouped by category
5. Send summary and PIN
6. Sent, waiting for approval, with **Recall**

**Batch R2: Review and approve** (Branch Manager, desktop; read by all desktop roles)
7. **Requisitions list, drawn once for the whole pass:** tabs *Collecting, To approve, To pack, On the way, To confirm, Discrepancies, Closed* with counts, search and filters first, numbered pager. Each role opens on its own tab
8. Requisition file while collecting: department chips, Next step card, items by department, **Nudge**
9. Change a quantity: edit the Approved box in the row, optional reason (replaces "Return a section", owner decision 7 Oct)
10. The head is told (phone): what the manager changed, no action needed
11. Approve and sign: the drawer with "What signing does" and the PIN
12. Approved and sent to the store: the confirmation

**Batch R3: After approval**
13. Approved file following its dispatches (desktop): per-department `DSP-` number and status
14. Follow my delivery (phone, head)
15. Add to an approved requisition (phone, head): the "Added after approval" block and PIN
16. Approve the addition (desktop, Branch Manager)
17. Printed requisition (A4)

**Batch R4: Exceptions and reference**
18. Urgent requisition: set at start, and the Director's view after 1 hour
19. Cancel a requisition: dialog with a reason
20. Departments in Settings: add, rename, retire
21. **States kit** (skeletons, error with Retry, empty)
22. Every state of a requisition (reference table) and the wording table
Then the group's **cover** and **screens index**.

## Group D: Dispatch (about 20 screens, 4 batches; the list is Group R's step 7)

**Batch D1: Pack it** (Store Attendant, phone; the Store Manager shares these)
1. To pack: one card per branch, oldest first, expandable by department
2. Pack one department: quantity and on-hand shown, tick each line
3. Short a line or substitute one
4. Sign and send: summary, packed by, signed by, carried by (carrier picker), PIN
5. On the way

**Batch D2: Receive it** (any active member of the department, phone)
6. Deliveries waiting
7. Count what arrived: blind, no pre-fill
8. This doesn't match: count again
9. Reason and photo for a short or extra line
10. Confirm summary and PIN
11. Confirmed

**Batch D3: The files** (desktop, read by all)
12. Dispatch file: tracker, packed, signed and carried by, documents, activity, ledger links
13. Discrepancy file: the gap, the reason, the photo, the clock
14. Record a finding: four choices, the stock effect shown, PIN
15. Reverse a finding: a new linked entry, reason, PIN
16. Delivery note (A4), store copy and branch copy
17. Carriers list in Settings

**Batch D4: Exceptions and reference**
18. The Branch Manager confirms for a department
19. Cancel a signed dispatch before the branch counts it
20. Every state of a dispatch, every finding with its stock effect, and the wording table
Then cover and screens index.

## Group B: Branch day (about 13 screens, 3 batches)

**Batch B1: Open and count**
1. Opening count (phone): "same as last night?", accept or recount
2. Overnight difference recorded
3. Count my department, blind (phone)
4. Sent, waiting for the manager (phone)
5. **Today** (Branch Manager, desktop): five department tiles, what blocks the close, "Opening not checked"

**Batch B2: Close**
6. A department's figures: opening, received, waste, counted, Used today
7. Reason for an unusual figure
8. Close the day: summary and PIN
9. Closed day file (`DAY-NYR-nnnn`), with ledger links
10. **Correct a count** on a closed day: one item, reason, PIN
11. History, and the unusual-figure rule in Settings

**Batch B3: Exceptions and reference**
12. Blocked by an unconfirmed delivery
13. Every state of a branch day, and the wording table
Then cover and screens index.

## Group W: Branch waste (about 7 screens, 2 batches)

Reuses the approved Central Store waste screens.

**Batch W1: Log it** (member or head, phone)
1. Log waste, several items
2. Check before it is logged
3. My department's waste today
4. Reverse a wrong entry

**Batch W2: See it** (Branch Manager, desktop, read by all)
5. Branch waste: by department, reason and value
6. Reverse any entry, with a reason and PIN
7. Every state and the wording table
Then cover and screens index.

## Size

R (22) then D (about 20) then B (about 13) then W (about 7): about 62 screens plus four covers and four indexes, in 13 batches. Review stops after every batch.

## Before drawing

1. Paper must be reachable from the agent session.
2. The owner approves this outline, or changes it.
3. Each later group's flow is reviewed by the owner before its drawing starts.
