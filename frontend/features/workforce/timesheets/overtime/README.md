# Timesheets · overtime

**Spec:** Paper Chapter 8 step 3. **Status:** built, awaiting review (19 Oct 2026). **Endpoints:** O1 (the waiting list, read by Home), O2 (decide).

The decision dialog: planned, worked and the extra time; "why, from the record" (counts of orders and tickets in the extra time, work open at the shift end, the service tail the rules allow); "the limits" (the person's week against the weekly cap, the branch's month against its budget); Approve all, Approve part (about half, to five minutes), Decline. Declining needs a reason; authorising above a limit needs a reason too, and a department head over the limit is refused by the server in words ("Your Branch Manager decides it"). **Approving only authorises the time; payroll decides pay, so no money appears here** (the takings of the orders the server can read are deliberately not shown).

| Piece | File |
|---|---|
| Dialog | `components/overtime-dialog.tsx` |
| Evidence and limit lines, the part amount, the reason lists | `lib/overtime-view.ts` |

**Coupling:** opened from `week/`; Home's Waiting for you reads the pending list through `index.ts`.
