# Branch day: flow and rules (agreed with the owner, 7 Oct 2026)

Group B of the final Inventory design pass. Replaces the old Branch day rules (Branch Manager enters all counts, reopen with a reason, KES 1,000 reason threshold, `CONSUMPTION` reason). Screens are listed in [final-pass-screen-plan.md](final-pass-screen-plan.md). Related: [requisitions-flow.md](requisitions-flow.md), [discrepancies.md](discrepancies.md).

## In one paragraph

Each evening every department counts what is left on its shelves, blind, on the head's phone. The Branch Manager sees all five departments on one desktop screen, reviews and signs the day closed with a PIN. The result is **Used today**, a plain figure. Next morning the closing count is the opening count: the department accepts it or recounts it. Nothing is reopened or undone; a mistake is fixed with one linked correction.

## Why "Used today", not a gap

Stock is not yet deducted automatically when something is sold (deferred). So opening + received − waste − closing is mostly **what was sold**. Calling it a gap and asking for a reason each day would make people type "consumption" every evening. It is shown as **Used today** instead. **The system flags nothing as unusual and asks for no reason** (owner decision, 8 Oct 2026: an automatic rule needs history, is noisy while sales do not deduct stock, and the Branch Manager already knows why a day was busy). The manager reads the figures, judges whether they add up and follows up on their own. To help, the department figures show **Yesterday** beside Used today. Real loss detection waits until sales deduct stock automatically.

## The day, in order

1. **Morning, opening.** Each department's opening is pre-filled from last night's signed close ("same as last night?"). A member accepts it or recounts. A difference is an **overnight variance** and is recorded with the person's name.
2. **During the day.** Deliveries are confirmed ([discrepancies.md](discrepancies.md)), waste is logged ([branch-waste-flow.md](branch-waste-flow.md)), requisitions run.
3. **Evening, count.** Each head counts their own department **blind** on their phone: items and units, empty boxes, no expected figure shown. They send the count with their PIN.
4. **Close.** The Branch Manager's **Today** screen shows five department tiles (*Not counted, Counted*) and anything blocking the close. They open a department to see *opening, received, waste, counted, Used today* per item, then **Close the day** with a summary and a PIN.
5. **After the close.** One usage entry per item is written through the stock ledger door, carrying the `DAY-<branch>-nnnn` number (branch-coded, e.g. `DAY-NYR-0044`; edited 8 Oct 2026). The day file keeps everything.

## Who does what

| Role | Does |
|---|---|
| Department Head | Accepts or recounts the opening; counts their department blind; sends with a PIN |
| Any active member of the department | Same as the head, signing with their own PIN, when the head is off |
| Branch Manager | Reviews all five departments, closes the day with a PIN, corrects a count. Fallback for any department (recorded "on behalf of the department") |
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
- No alerts. The Director reads the day like every other desktop role.

## Records

`DAY-<branch>-nnnn` (for example `DAY-NYR-0044`), one per branch per day, counted per branch (corrected 8 Oct 2026 to match `REQ-`, `DSP-`, `DSC-`). History lists days as *Open, Closed, Corrected*. The day file has the usual tracker, Next step card and **Items / Documents / Activity** tabs; Documents holds the printed day sheet.

## Settings

Which departments exist (shared with Requisitions: [requisitions-flow.md](requisitions-flow.md)) is managed in Settings by the Branch Manager or System Admin. There is no unusual-figure rule (removed 8 Oct 2026).

## Decisions (settled 7 Oct 2026)

1. Heads count blind on their phones; the Branch Manager approves.
2. Used today replaces the gap.
3. No reopen; Correct a count instead.
4. Opening pre-filled and accepted or recounted by any active member or the Branch Manager; never blocks.
5. Unconfirmed delivery blocks the close; an open discrepancy does not.

## Design log (Paper, page "Inventory · Counting and closing")

**Owner go-ahead (8 Oct 2026):** the owner said "go" to the opening summary, which recommended the answers below. They are treated as agreed until the owner says otherwise.
- Waste reasons, PIN and reversal rules (see [branch-waste-flow.md](branch-waste-flow.md)): approved Central Store reason list, no PIN on waste, a member reverses their own entry on the same day only.
- ~~Unusual figure rule~~ **Withdrawn the same day (owner, 8 Oct 2026).** No automatic flag, no reason prompt, no Director notice, no Settings rule. See "Corrections from the owner" below.
- **Opening count:** accepting shows last night's signed figures; **Recount** starts a blind count; the overnight difference is seen by the Branch Manager (with the person's name), heads see no costs.
- **Sidebar:** **Day** has two sub-links, **Today** and **History**; **Waste** is a new single row in the Branch group beside Day; heads and members get **Count** and **Waste** in the phone drawer. Part: "Parts · sidebar · Branch Manager · Day, Today active".

### Batch B1, "Open and count" (8 Oct 2026): approved

Chapter 1, thread Wednesday 7 October at Nyeri Town, `DAY-NYR-0044`. Numbering: steps 1, 2, 2b, 3, 3b, 4 (phone) and 5 (desktop); **2b and 3b are additions to the plan** so that every PIN has a receipt-style summary first.
- **1 Opening count** (7:10 am): last night's signed figures, **Yes, same as last night** or **No, I'll recount**. Accepting is 1 tap, no PIN.
- **2 Check the difference and sign:** after a blind recount, a receipt-style summary (8 items, 1 difference, Milk 1L 8 last night, 7 counted) and the PIN. The recount itself uses the step 3 screen.
- **2b Overnight difference recorded:** confirmation with the −1 on Milk 1L and "the Branch Manager can see it".
- **3 Count my department** (6:42 pm), blind, same pattern as Dispatch D8: unit hint, empty boxes, nothing to count against, **Check and sign** disabled until every line is filled.
- **3b Check and sign:** receipt-style summary (8 items, none left blank, two category rows) and PIN, 3 taps.
- **4 Count sent:** small tracker (opening checked, delivery confirmed, evening count signed, Branch Manager closes the day).
- **5 Today** (Branch Manager, 7:12 pm): five department tiles (Counted, Needs a look, Not counted), Used today in KES per department (Branch Manager sees values), **Opening not checked** on Service, "Before the day can close" list (every delivery confirmed, with the open `DSC-NYR-0007` noted as not blocking; Housekeeping has not counted; Opening not checked). **Close the day** is disabled while Housekeeping has not counted.

Judgement calls (owner to confirm):
- Accepting an opening has **no PIN** (fewest taps); a recount is signed with a PIN.
- Step 3b groups items under two names ("Drinks and dry goods", "Serving supplies"); the real categories come from the catalogue.
- The Used today KES figures and the Pastry "unusual figure" are invented for the thread. Which item is unusual is shown in B2.
- Step 4 shows only the head's own slice (no other department's progress), per "heads see only their own".

**B1 additions after review (8 Oct 2026):** **step 0** (the head's Day home on the phone: opening checked, delivery confirmed, evening count with one button) and **step 3c** ("See every figure" before sending, each figure can be changed). Step 5b (Today with a reason blocker) was drawn and then **removed** with the unusual-figure rule, see the corrections below.

### Corrections from the owner (8 Oct 2026)
1. **No automatic "unusual figure".** The system flags nothing, asks for no reason, tells the Director nothing and has no Settings rule. The Branch Manager reads the figures and follows up. Removed: the reason drawer, the Pastry "needs a look" state, the extra blocker, step 5b. Added instead: a **Yesterday** column beside Used today.
2. **Names on the department figures.** "Counted" is **Closing stock**, "Opening" is **Opening stock**. The value is now two columns: **Used value (KES)** (what was used at today's prices) and **Closing stock value (KES)** (what is left on the shelves). The same words are used on the day file, the printed sheet and History.
3. **Date range picker.** Every history page uses the approved date range picker from the Counting redesign page (quick picks Today, Yesterday, Last 7 days, Last 30 days, This month, Last month, Pick a date or range; later dates cannot be picked). Drawn in step 10c.
4. **The Director reads everything the Branch Manager reads.** The Director's sidebar now has Requisitions, Day (Today, History) and Waste under Branches, the same rows as the Branch Manager. The same pages are used with a Branch column and Branch filter on History; **Today for a hub role needs a branch picker, not yet drawn** (open question below).

### Batch B2, "Review and close" (8 Oct 2026): approved
Chapter 2, steps 6 to 9. Thread: Wednesday 7 October, 7:31 pm to 7:48 pm.
- **6 A department's figures** (Pastry): two-pane (department rail with Used value and a branch total; the selected department's items on the right, dark hairlines). Columns: Opening stock, Received, Waste, Closing stock, Used today, Yesterday, Used value, Closing stock value; a total row; the opening check and delivery shown above the table.
- **7 Today, ready to close** (Close the day is active, three green ticks, Opening not checked noted as not blocking).
- **8 Close the day: summary and PIN** (drawer): receipt-style, used value KES 50,060, one row per department with item counts, a line saying closing writes 43 usage entries each marked `DAY-NYR-0044`, signed by the Branch Manager, PIN. 3 taps from Today.
- **9 The day is closed:** green confirmation, **Open the day file** and **Print the day sheet**, and the first five of the 43 ledger entries, each with `DAY-NYR-0044` as a link.
- Judgement calls: the Karatina branch (KRT) and its manager Lucy Wanjiku are invented; item names, prices and figures for Pastry and Housekeeping are invented but add up (Pastry used 8,760 and closing stock value 15,840; Housekeeping used 1,860 and closing stock value 26,800).

### Batch B3, "The record" (8 Oct 2026): approved
Chapter 3, steps 10 to 13d.
- **10 History** (Branch Manager): search by day number, date range, status; columns Day (link) and date, Departments counted, Used value, Closing stock value, Status (Open, Closed, Corrected), Closed by; numbered pager.
- **10b History across branches** (Director; the Accountant, Store Manager and System Admin see the same): adds a Branch column and filter; read only.
- **10c The date range picker open** on the Date filter.
- **11 The closed day file:** title, status, a tracker, the one-line rule about correcting, tabs Items / Documents / Activity, the two-pane figures (as step 6), **Print the day sheet** and **Correct a count** (Branch Manager only).
- **12 Correct a count** (drawer): one item, closing stock was 1 and should be 2, what changes (Used today 3 → 2, Used value 6,000 → 4,000, Closing stock value 2,000 → 4,000), a required reason, an optional note, one linked ledger entry, PIN. Reasons are invented (Counted wrongly, Item was missed, Other).
- **12b After the correction, Activity tab:** status Corrected, both entries stay visible.
- **13 Documents tab:** the day sheet appears twice (at the close, and the latest including the correction); every version is kept.
- **13b, 13c, 13d The printed day sheet** (A4, 6 pages, the approved LPO template): cover (the five departments, the correction, notes), a department page (Pastry, with the corrected figure marked and the Wednesday figure struck through), and the last page (Housekeeping, five head signatures, the Branch Manager's signature, QR). Signatures and QR on the last page only.

Decided by the owner (8 Oct 2026, "go with your recommendation"):
1. **Today for hub roles** has a **branch picker** at the top (the Director, Accountant, Store Manager and System Admin read Today the same way the Branch Manager does). To draw in B4.
2. **One Requisitions link per role.** For hub roles it stays in the Central Store group (as Group R approved), where the list covers every branch with a Branch filter. Their Branches group has **Day** (Today, History) and **Waste**, so the Director's sidebar in step 10b no longer repeats Requisitions.
3. **Correct a count reasons:** Counted wrongly, Item was missed, Other (plus the optional note).
4. **Every desktop role may print the day sheet.**

### Group B complete (8 Oct 2026): B4 approved by the owner; wording table, cover and screens index drawn
Step 18 (chapter 4) is the wording table: the figure names (Opening stock, Received, Waste, Closing stock, Used today, Yesterday, Used value, Closing stock value), the day states (Open, Closed, Corrected), the card chips (Counted, Not counted, Opening not checked, Opening 1 less), what blocks the close, and the buttons and correction reasons. No per-screen states were drawn; the States kit is in Group R. The cover and the screens index (28 screens, steps B0 to B18) sit at the top of the "Inventory · Counting and closing" page. The owner approved Group B on 8 Oct 2026.

### Batch B4, "Exceptions and the audit trail" (8 Oct 2026): approved
Chapter 4, steps 14 to 17. **14** Today blocked by an unconfirmed delivery (Kitchen, with **Confirm for Kitchen**; an open discrepancy is shown as not blocking). **15** The Branch Manager counts for a department (blind, "on behalf of Housekeeping", their own PIN). **16** Today for a hub role: branch picker, read only, no Close button. **17** The existing Audit log extended with Requisitions, Dispatch, Discrepancies, Branch day and Branch waste, a Branch filter, who with title, and the record link. Owner decision: **printing a document is not an audit event.** Still to draw after approval: the every-state and wording table, the group cover and the screens index. Owner review fixes (8 Oct 2026): steps 14, 15 and 16 now reuse the real Today screen and department cards from steps 5 and 7 (same cards everywhere); step 15 shows the dimmed Today behind the drawer; step 16 has the branch picker and no Close button; the step 17 sidebar highlights Audit log under Procurement.

### Audit trail (owner raised 8 Oct 2026)
Each record already has an **Activity** tab (who, when, what, with the record link): drawn on the day file (steps 11 and 12b), and listed for the requisition and dispatch files. What was missing is the **cross-record Audit log** that Purchasing, Catalog and Prep already feed (`/inventory/audit-log`, hub roles only, areas Catalog, Suppliers, Restock levels, Purchasing, Payments, Prep). Plan, to draw in B4 as one updated screen (no new page): add the areas **Requisitions, Dispatch, Discrepancies, Branch day, Branch waste**; add a **Branch** filter; show who (name and title), when, what and the record number as a link; the Branch Manager gets an **Audit log** link scoped to their own branch. Events to log: requisition started, sent, recalled, quantity changed, approved, cancelled, added to; dispatch packed, signed, counted at the branch, confirmed on behalf; finding recorded and reversed; opening accepted or recounted (with the difference); count signed; day closed; count corrected; waste logged and reversed; Departments and Carriers changed in Settings. Entries are never edited or deleted.
