# Branch day: flow and rules (agreed with the owner, 7 Oct 2026)

Group B of the final Inventory design pass. Replaces the old Branch day rules (Branch Manager enters all counts, reopen with a reason, KES 1,000 reason threshold, `CONSUMPTION` reason). Screens are listed in [final-pass-screen-plan.md](final-pass-screen-plan.md). Related: [requisitions-flow.md](requisitions-flow.md), [discrepancies.md](discrepancies.md).

## In one paragraph

Each evening every department counts what is left on its shelves, blind, on the head's phone. The Branch Manager sees all five departments on one desktop screen, reviews and signs the day closed with a PIN. The result is **Used today**, a plain figure. Next morning the closing count is the opening count: the department accepts it or recounts it. Nothing is reopened or undone; a mistake is fixed with one linked correction.

## Why "Used today", not a gap

Stock is not yet deducted automatically when something is sold (deferred). So opening + received − waste − closing is mostly **what was sold**. Calling it a gap and asking for a reason each day would make people type "consumption" every evening. It is shown as **Used today** instead. Only a figure that looks unusual asks for a reason. Real loss detection waits until sales deduct stock automatically.

*Build note:* "unusual" needs a rule (for example, far above the item's recent daily use). Settle it with the owner before the back-end session; the design only needs the reason prompt and its wording.

## The day, in order

1. **Morning, opening.** Each department's opening is pre-filled from last night's signed close ("same as last night?"). A member accepts it or recounts. A difference is an **overnight variance** and is recorded with the person's name.
2. **During the day.** Deliveries are confirmed ([discrepancies.md](discrepancies.md)), waste is logged ([branch-waste-flow.md](branch-waste-flow.md)), requisitions run.
3. **Evening, count.** Each head counts their own department **blind** on their phone: items and units, empty boxes, no expected figure shown. They send the count with their PIN.
4. **Close.** The Branch Manager's **Today** screen shows five department tiles (*Not counted, Counted, Needs a look*) and anything blocking the close. They open a department to see *opening, received, waste, counted, Used today* per item, then **Close the day** with a summary and a PIN.
5. **After the close.** One usage entry per item is written through the stock ledger door, carrying the `DAY-nnnn` number. The day file keeps everything.

## Who does what

| Role | Does |
|---|---|
| Department Head | Accepts or recounts the opening; counts their department blind; sends with a PIN |
| Any active member of the department | Same as the head, signing with their own PIN, when the head is off |
| Branch Manager | Reviews all five departments, adds a reason where asked, closes the day with a PIN, corrects a count. Fallback for any department (recorded "on behalf of the department") |
| Director, Accountant, Store Manager, System Admin | Read every branch day. System Admin can do every action with their own PIN |

## What blocks closing

- A department that has **not counted** (a department with no tagged items counts as done).
- A delivery **not yet confirmed** for any department.

An **open discrepancy does not block** the close. A missing opening check does not block anything: the day runs on last night's closing figure, marked **"Opening not checked"** on Today.

## Corrections, not reopening

There is **no reopen**. After the close:
- **Correct a count:** the Branch Manager changes **one item's** figure on the closed day file, gives a reason and signs with a PIN. One linked entry is posted. The original close and the correction both stay visible on the file and in the audit log. Allowed until the next morning's opening is accepted.
- After that, the **opening recount** catches a mistake, with the person's name and the variance.

So: caught straight away, Correct a count; caught next morning, the opening recount; nothing is ever reopened, undone or deleted.

## Visibility

- Every desktop role opens every branch day; buttons hide for those who don't do the job.
- Heads see only their own department's slice and no costs. The Branch Manager sees values.
- The Director is told of an unusual figure with its reason. No other alerts.

## Records

`DAY-nnnn` per branch per day. History lists days as *Open, Closed, Corrected*. The day file has the usual tracker, Next step card and **Items / Documents / Activity** tabs; Documents holds the printed day sheet.

## Settings

The "unusual figure" rule and which departments exist (shared with Requisitions: [requisitions-flow.md](requisitions-flow.md)) are managed in Settings by the Branch Manager or System Admin.

## Decisions (settled 7 Oct 2026)

1. Heads count blind on their phones; the Branch Manager approves.
2. Used today replaces the gap.
3. No reopen; Correct a count instead.
4. Opening pre-filled and accepted or recounted by any active member or the Branch Manager; never blocks.
5. Unconfirmed delivery blocks the close; an open discrepancy does not.
