# Dispatch: flow and rules (approved by the owner, 8 Oct 2026; where this text differs from Paper, Paper wins)

Group D of the final Inventory design pass. Built from the owner's decisions plus recommended defaults where the owner said "use your recommendation"; the drawn and approved screens are the 23 steps D1 to D21 in Paper. Discrepancy rules are in [discrepancies.md](discrepancies.md) and are not repeated here. Screens: [final-pass-screen-plan.md](final-pass-screen-plan.md). Upstream: [requisitions-flow.md](requisitions-flow.md).

## In one paragraph

An approved requisition becomes **one dispatch per department** (`DSP-nnnn`) in the store's queue. The Attendant packs each department's lines, the dispatch is signed (who packed, who signed, who carried), stock leaves the Central Store, and the delivery goes out with a delivery note. At the branch a member of the department counts it blind and signs. Stock enters the department. Any difference becomes a discrepancy handled as in `discrepancies.md`.

## The thread

`REQ-` (the requisition) → `DSP-` (one per department) → `DSC-` (if the count differs) → `DAY-` (the branch day it must be confirmed before). Numbers carry the branch code and count per branch (`REQ-NYR-0112`, `DSP-NYR-0231`; edited 8 Oct 2026 to match the owner's numbering decision in `requisitions-flow.md`). Document numbers are drawn in `#1F5BAE`, underlined when a link. Each file links to the one before and after. Every stock ledger entry shows its `REQ-`, `DSP-` or `DSC-` number as a link back to the file.

## One list, one link

Dispatch has **no sidebar link of its own for the desktop roles**. It is the **To pack, On the way, To confirm and Discrepancies tabs of the one Requisitions list**, and Paper's sidebars show them as the sub-links of the one Requisitions row (Queue, Discrepancies, History). The store opens on To pack. The list is drawn once (Group R); Group D draws the files, not a second list. The Store Attendant's phone menu keeps a **Dispatch** row (badge = branches to pack), with the To pack, On the way and Done tabs (gap fix G3).

## Packing (Store Attendant, phone first; Store Manager shares the same screens)

1. **To pack** shows one card per branch, oldest first, with how long it has waited, expandable by department. One tap on a department opens it.
2. **Pack one department.** Each line shows the item, unit, **requested quantity** and **what is on hand**. The Attendant sees quantities, including on-hand, but no money. Lines are pre-filled with the requested quantity; the Attendant ticks each line as packed and changes it if less is sent.
3. **Short a line.** If on hand is lower than requested, the line flags "Not enough in store". The Attendant sends what there is (a stepper). **There is no substitute option** (owner, 8 Oct 2026: not needed). A short line is normal, not an error; the shortfall is not carried automatically, because the next requisition re-suggests it.
4. **Department by department.** Finishing one department goes straight to the next. Nothing is signed and no stock moves yet. When all departments are packed, a list shows every department ticked (tap one to look again) and leads to the final review. (Owner, 8 Oct 2026.)
5. **Final review, sign and send, once for the whole requisition.** A summary lists the departments and what is short, with **See every line** for a scrollable list of all lines. Then **Packed by** (pre-filled with the signed-in person), **Signed by** (the same person: the packer signs; owner, 7 Oct 2026; the Store Manager appears as signer only when they sign themselves), **Carried by** (chosen from a short carrier list the Store Manager keeps in Settings: a name or vehicle), and the PIN. One signature covers all departments, but **each department still gets its own `DSP-` record and its own delivery note**, so each branch department counts its own delivery. Stock leaves the Central Store at once (`DISPATCH_OUT` through the ledger door) and every dispatch is **On the way** together.
6. **Changed rule (owner, 8 Oct 2026):** the earlier "sign per department so a slow department never holds up the others" is replaced by one final sign. A department that is not ready therefore holds the others; the owner has not said how to handle that (see the open question in the design log).

## Delivery note

A4, printed from the dispatch file: `DSP-` number, branch and department, date, carrier, lines. Two copies: the **store copy** shows quantities; the **branch copy** may omit them (an owner decision still open: the client may prefer to show them). Both carry the packed-by and signed-by names.

## Receiving at the branch (any active member of the department, phone first)

Exactly the count-blind flow in [discrepancies.md](discrepancies.md): empty boxes, a flag on a mismatch, a recount, a reason and optional photo for what still differs, a summary, a PIN. Matching counts take the same count-and-sign steps with no flags. The Branch Manager can confirm for any department ("on behalf of", real signer recorded).

## Fixing a dispatch

- **Before it is signed:** edit freely.
- **After it is signed and before the branch counts it:** the Store Manager can **cancel** the dispatch with a reason and a PIN. Stock returns to the store by a linked reversal, and the department's lines go back to the queue.
- **After the branch has signed:** no edits. Any difference is a discrepancy; any other fix is a linked correction with a reason.
- Nothing is deleted.

## Tracker (dispatch file)

Approved → Packed → On the way → Confirmed → Closed, each with a date and who. A requisition's own tracker rolls up its departments' dispatches.

## Who does what

| Role | Does |
|---|---|
| Store Attendant | Packs, signs and sends (PIN), picks the carrier. Sees quantities including on-hand, no money |
| Store Manager | Same as the Attendant, plus cancels a dispatch, records and reverses discrepancy findings, keeps the carrier list |
| Department member / head | Counts and signs the delivery for their department |
| Branch Manager | Confirms for a department; reads their branch's discrepancies |
| Director, Accountant, System Admin | Read everything; System Admin can do every action with their own PIN. Director and Accountant get the alerts in `discrepancies.md` |

## Every state of a dispatch

| State | Tracker | Who does what | Main button |
|---|---|---|---|
| To pack | Approved | Attendant or Store Manager packs | **Pack** |
| Packing | Approved | Same | **Sign and send** |
| On the way | Packed | Department counts on arrival | **Count the delivery** (department) |
| Waiting for the branch | On the way, over 2 hours since arrival | Branch Manager nudged | **Confirm for the department** (Branch Manager) |
| Confirmed | Confirmed | Nothing, unless a discrepancy opened | none |
| Discrepancy open | Confirmed, gap held | Store Manager records a finding | **Record a finding** |
| Closed | Confirmed, discrepancies settled | Everyone can open | **Print** |
| Cancelled | Stops at the cancel, with reason | Kept on record | none |

## Decisions already settled

- The Attendant sees quantities when packing; the rest of the blind rule stands.
- Per-department signing; carrier, packer and signer recorded.
- Discrepancy handling: [discrepancies.md](discrepancies.md).

## Defaults taken here, owner to confirm when reviewing

1. Dispatch is tabs of the one Requisitions list, with no sidebar link of its own.
2. Cancelling a signed dispatch before the branch counts it is allowed for the Store Manager, with a reason and PIN.
3. The branch copy of the delivery note may omit quantities (open for the client).
4. A short line is never carried automatically; the next requisition re-suggests it.

## Design log (Paper, page "Inventory · Requisition and dispatch", Chapters 5 to 8)

Owner confirmed the four defaults above by saying "proceed" to the summary that recommended them (8 Oct 2026). Steps are numbered D1 to D20 in captions and layer names.

### Batch D1, "Pack it" (8 Oct 2026): approved by the owner, 8 Oct 2026, after one rework

Chapter 5, seven phone screens for the Store Attendant, thread `REQ-NYR-0112` and `DSP-NYR-0231` to `0235`. Numbering changed: the batch is D1 to D6 plus D5b, so **Receive it starts at D7** (D7 to D12), The files at D13 to D18, Exceptions at D19 to D21.
- **D1 To pack:** one card per branch, oldest first (Nyeri Town waiting 29 min, expanded by department, "Start here" on Kitchen; Karatina collapsed).
- **D2 Pack one department:** "Department 1 of 5"; lines grouped by category, requested and in-store shown, no money; one tick per line; **Done with Kitchen** is disabled until every line is ticked.
- **D3 Short a line:** a sheet over D2 with a stepper only (2 asked, send 1). No substitute option.
- **D4 Every department packed:** five ticked departments (tap one to look again) and **Go to the final review**.
- **D5 Final review:** receipt-style summary (40 lines, 1 short, one row per department, "Five delivery notes, one per department", **See every line**), packed by and signed by, carried by, PIN, **Sign and send to Nyeri Town**. 3 taps.
- **D5b Every line, in detail:** the full scrollable list of all 40 lines by department with sent quantities; short lines highlighted.
- **D6 On the way:** confirmation, the five `DSP-` numbers as links, signed and carried by, Print the five delivery notes.
- **Owner corrections (8 Oct 2026):** (1) no "send a different item" option, he did not see the need; (2) the attendant needs to scroll every item before signing: a second, detailed frame; (3) pack department by department, then one final review where carried by, signing and sending happen once for the whole requisition.
- **Open question for the owner:** one final signature means a department that is not ready holds the others. Group R steps 13 and 14 still show Kitchen and Barista on the way while Pastry is packing; they need updating if the owner confirms the single send (recommendation: update them to show all five leaving together).
- **Judgement calls:** the second branch is invented (Karatina, code KRT); the attendant is shown by title only; times continue Group R (all packed 3:01, signed 3:03, left 3:05).

### Batch D3, "The files" (8 Oct 2026): approved by the owner, 8 Oct 2026

Chapter 7, desktop, Store Manager (every desktop role reads it). Numbering: D13 to D18 plus D17b, so Exceptions start at D19.
- **D13 Dispatch file** (`DSP-NYR-0232`): tracker to "Counted at the branch", Next step card "Milk 1L is short by 2" with **Record a finding**, tabs Items / Documents / Activity, items with Sent, Counted and Gap.
- **D14 Discrepancy file** (`DSC-NYR-0007`): the gap (24 sent, 22 counted, 2 held as unaccounted), the reason and photo, who packed, signed, carried, counted, and a line saying the finding writes a linked ledger entry.
- **D15 Record a finding:** drawer with the four findings and each one's stock effect and who it is recorded against, a live "what this does" summary (Milk 1L, 2 back in store, not a loss), optional note, PIN.
- **D16 Reverse a finding:** dialog showing the recorded finding, what reversing does (a new linked entry; both stay on file), reason chips and PIN. Drawn over the open file for lack of a closed-file state; to be redrawn if the owner wants the closed state shown behind it.
- **D17 Delivery note, store copy (A4):** follows the approved LPO template; asked and sent quantities, no money, packed and signed by (cursive signature with PIN line), a received-by line for the branch, QR, Lobster footer.
- **D17b Delivery note, branch copy (A4):** same document but with a blank **Your count** column instead of quantities, so the count stays blind (default 3 from the defaults list, recommended and accepted).
- **D18 Carriers in Settings:** a short list (name or vehicle), kind, deliveries this month, Active or Retired; retiring keeps history.
- **Owner addition (8 Oct 2026):** the delivery notes were missing from the first plan; they are D17 and D17b.
- **Judgement calls to confirm:** the Store Manager sidebar part ("Parts · sidebar · Store Manager · Requisitions active") is reused on the Carriers screen even though the code puts Settings under Procurement; the Findings wording for an Extra line is not drawn; who may record a finding stays Store Manager and System Admin.

- **Owner changes after D3 was drawn (8 Oct 2026):** the D13 next-step card now reads "Milk 1L is short by 2: record what happened". The owner asked how a long delivery note behaves: **the table continues on the next A4 page; every page repeats the header and column headings and carries "Page n of m"; the signature block, received-by line and QR appear on the last page only; a line is never split across pages.** Not drawn (the rule is plain); a page 2 is a possible D17c if the owner wants it.

### Sidebar sub-links under Requisitions (owner approved the outline, 8 Oct 2026)

When a link has several pages it uses the sub-link **design** of the approved Prep sidebar (chevron on the parent, indented rail, filled square on the active one, counts at the right). **Queue** (live work as tabs: Collecting, To approve, To pack, On the way, To confirm), **Discrepancies** (its own list: gap, finding, days open), **History** (closed and cancelled, with search and a date filter). Same three for every desktop role; Department Heads have no sidebar. Carriers and Departments stay in Settings. Rolled out to every desktop sidebar in Group R (Chapters 2 to 4, except step 20, which has the Manage group open) and Group D (D13 to D16). Drawn as new Group R steps 7c (Discrepancies list) and 7d (History). Working parts: "Parts · Requisitions sidebar states" and the Branch Manager and Store Manager sidebar parts.
- **Not yet updated:** D18 (Carriers) still shows the old Requisitions-active sidebar; it should show Settings under Procurement.

### Batch D4, "Exceptions and reference" (8 Oct 2026): approved by the owner, 8 Oct 2026 (Group D approved, with the sub-link rollout)

Chapter 8, plus the group's cover and screens index (23 screens).
- **D19 Confirm for a department** (Branch Manager, desktop drawer): Pastry's delivery not counted 2 hours after arrival; the Branch Manager does the same blind count, signs "on behalf of Pastry", PIN. The record shows who really counted.
- **D20 Cancel a signed dispatch** (Store Manager, dialog): what cancelling does (stock back by a linked entry, lines back to the queue, delivery note voided but kept), only before the branch counts, reason chips and PIN.
- **D21 Every state, every finding and the wording** (reference): eight states, the four findings with stock effect and who it is recorded against, and the wording table. Titles, not names.
- **Group R step 13 updated** to match the single final send: all five departments On the way at 3:05 pm ("5 of 5 sent", "Five deliveries are on the way").
- **Judgement calls:** D19 and D20 are drawn over Group R's step 13 file page (Branch Manager sidebar) for lack of a Store Manager dispatch list; the Branch Manager's confirmation reuses the blind count; Cancel is blocked once any department member has signed.

### Batch D2, "Receive it" (8 Oct 2026): approved by the owner, 8 Oct 2026

Chapter 6, six phone screens for the Barista Department Head (`DSP-NYR-0232`, 8 lines); the discrepancy is `DSC-NYR-0007` (Milk 1L, 22 counted, 24 sent).
- **D7 Deliveries waiting:** "Your delivery is here", the `DSP-` link, left 3:05 pm, **Count the delivery**; earlier delivery confirmed.
- **D8 Count what arrived:** blind: unit hint only, empty boxes, no sent figure, no tick when a count matches; **Check and sign** disabled while lines remain.
- **D9 This doesn't match:** the milk line flags "This doesn't match what was sent. Count again." The sent figure is not shown.
- **D10 Reason and photo:** a sheet with four reason chips (Not in the box, Damaged, Wrong item, Other) and an optional photo.
- **D11 Confirm with your PIN:** receipt-style summary (8 lines, 1 short, "7 lines match", the milk line with "you counted 22, 24 were sent" revealed only now), signed by title, PIN.
- **D12 Confirmed:** counted stock is in the department; the short line opens `DSC-NYR-0007` for the Store Manager; a small tracker ends at "Store Manager records what happened".
- **Judgement calls:** the Barista lines (beans, milk, sugar, cocoa, syrup, cups, filters, napkins) are invented; the all-match case is described in the chapter text, not drawn separately; D7 to D12 times run 3:28 to 3:35 pm.
