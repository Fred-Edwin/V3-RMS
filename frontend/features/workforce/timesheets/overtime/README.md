# Timesheets · overtime

**Spec:** S6; Paper Chapter 12 step 10. **Status:** rebuilt by Segment 1A (19 Oct 2026, not pushed, awaiting review). **Endpoints:** O3 (the item with its evidence), O2 (decide), O1 (the waiting list, read by Home).

The decision dialog (`components/overtime-dialog.tsx`): planned, worked and the extra time; "why, from the record" (counts of orders and tickets, work open at the shift end, colleagues in, the head's note or "none"); "the limits" (that week against the weekly cap, the month so far, the branch that week). Your decision: **Approve all, Approve part (a 5-minute stepper), Decline**; a reason (5 to 280 characters) is needed for part or decline; **your own PIN**; the item's `version`, so a second manager or a double tap gets "This changed while you were looking. Check it again." and the item reloads. An existing answer can be changed until the month is approved ("Change my answer"); on an approved month the dialog is read-only with "Tell HR". **Approving only authorises the time; payroll decides pay, so no money appears here.**

| Piece | File |
|---|---|
| Dialog | `components/overtime-dialog.tsx` |
| Evidence and limit lines, the part stepper, the answer body, refusal words | `lib/overtime-view.ts` |

**Coupling:** opened from `person/` (the drawer and the full month); Home's Waiting for you reads the pending list through `index.ts`.
