# Final Inventory design pass: screen outline, design order and review batches

Written 7 Oct 2026. Nothing below is drawn yet. Requisitions is detailed in [requisitions-flow.md](requisitions-flow.md); Dispatch rules are in [discrepancies.md](discrepancies.md). The Dispatch, Branch day and Branch waste lists are **provisional**: each is confirmed with the owner (like Requisitions) before its drawing starts.

## How it is drawn

- **In batches, not all at once.** One batch is one chapter: 5 to 7 screens, in the approved Paper format (a numbered step per screen, a caption naming role and device). The owner reviews each batch before the next starts. A fix after review is cheap; redrawing a whole group is not.
- **Within a group the order follows the journey**, so a reviewer reads it in the order a user lives it. Phone screens first where the phone user starts the journey, then the desktop screens that act on it.
- Each screen is checked against the design system tokens and the geometric sidebar master as it is drawn, not at the end.
- The group's **cover, screens index, every-state table and wording table** are drawn last, once the steps are final, so their numbers never go stale.
- Paper pages: Requisitions and Dispatch on "Inventory · Requisition and dispatch"; Branch day on "Inventory · Counting and closing"; Branch waste on a new page "Inventory · Branch waste".

## Group R: Requisitions (22 screens, 4 batches)

**Batch R1: Ask for what we need** (Department Head, phone)
1. Requisitions home: start the requisition for the cycle (Morning, Afternoon, Extra), or open my section
2. My section, suggested lines pre-filled, **Send as suggested**
3. Edit lines: steppers, remove with undo
4. Add an item: search, grouped by category
5. Send summary and PIN
6. Sent, waiting for approval, with **Recall**

**Batch R2: Review and approve** (Branch Manager, desktop; read by all desktop roles)
7. Requisitions list: stage tabs with counts, search and filters, numbered pager
8. Requisition file while collecting: department chips, Next step card, items by department, **Nudge**
9. Return a section: dialog with a required note
10. Returned to the head (phone): the manager's note, changed lines highlighted
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
21. Every state of a requisition (reference table)
22. Wording for empty, loading, error and the requisition messages
Then the group's **cover** and **screens index**.

## Group D: Dispatch (about 22 screens, 4 batches; provisional)

**Batch D1: Pack it** (Store Attendant, phone, with the Store Manager's same screens)
1. To pack: queue by branch, oldest first
2. Pack one department: quantity and on-hand shown, mark each line
3. Short a line or substitute one
4. Sign and send: summary, packed by, signed by, carried by (carrier picker), PIN
5. On the way

**Batch D2: Receive it** (receiving department member or head, phone)
6. Deliveries waiting
7. Count what arrived: blind, no pre-fill
8. This doesn't match: count again
9. Reason and photo for a short or extra line
10. Confirm summary and PIN
11. Confirmed

**Batch D3: The Store Manager's view** (desktop, read by all)
12. Dispatch tabs: To pack, On the way, To confirm, Discrepancies, Closed
13. Dispatch file: tracker, packed, signed and carried by, documents, activity
14. Discrepancy file: the gap, the reason, the photo, the clock
15. Record a finding: four choices, the stock effect shown, PIN
16. Reverse a finding: a new linked entry, reason, PIN
17. Delivery note (A4), store copy and branch copy
18. Carriers list in Settings

**Batch D4: Exceptions and reference**
19. The Branch Manager confirms for a department
20. Fix or cancel a dispatch by reversal
21. Every state of a dispatch, and every finding with its stock effect (reference)
22. Wording table
Then cover and screens index.

## Group B: Branch day (about 14 screens, 3 batches; provisional)

**Batch B1: Open and count**
1. Opening count: accept the closing figure or recount (head, phone)
2. Overnight difference flagged
3. Today: five department tiles and what blocks closing (Branch Manager, desktop)
4. Count a department
5. Reason for a gap over the threshold

**Batch B2: Close**
6. Close summary: the adjustments it writes, PIN
7. Closed day file (`DAY-nnnn`)
8. Reopen with a reason
9. History
10. Thresholds in Settings

**Batch B3: Exceptions and reference**
11. Blocked by an unconfirmed delivery
12. Every state of a branch day
13. Wording table
Then cover and screens index.
*Open for the owner:* who enters the department counts (Branch Manager only, or each head on their phone). Decided when this group's flow is written.

## Group W: Branch waste (about 8 screens, 2 batches; provisional)

Reuses the approved Stock, Count and Waste pattern at the Central Store, for a department.

**Batch W1: Log it** (head or member, phone)
1. Log waste, several items
2. Check before it is logged
3. My department's waste today
4. Reverse a wrong entry

**Batch W2: See it** (Branch Manager, desktop, read by all)
5. Branch waste: by department, reason and value
6. Reverse any entry, with a reason
7. Every state and wording (reference)
Then cover and screens index.

## Order and rough size

R (22) then D (22) then B (14) then W (8): about 66 screens plus 4 covers and 4 indexes, in 13 batches. Review stops after every batch.

## Before drawing

1. Paper must be reachable from the agent session (the Paper tools were not available to this one).
2. The owner approves this outline, or changes it.
3. Dispatch, Branch day and Branch waste flows are written and agreed before their drawing starts.
