# Dispatch: flow and rules (draft defaults, 7 Oct 2026; owner reviews before this group is drawn)

Group D of the final Inventory design pass. Built from the owner's decisions plus recommended defaults where the owner said "use your recommendation". Discrepancy rules are in [discrepancies.md](discrepancies.md) and are not repeated here. Screens: [final-pass-screen-plan.md](final-pass-screen-plan.md). Upstream: [requisitions-flow.md](requisitions-flow.md).

## In one paragraph

An approved requisition becomes **one dispatch per department** (`DSP-nnnn`) in the store's queue. The Attendant packs each department's lines, the dispatch is signed (who packed, who signed, who carried), stock leaves the Central Store, and the delivery goes out with a delivery note. At the branch a member of the department counts it blind and signs. Stock enters the department. Any difference becomes a discrepancy handled as in `discrepancies.md`.

## The thread

`REQ-` (the requisition) → `DSP-` (one per department) → `DSC-` (if the count differs) → `DAY-` (the branch day it must be confirmed before). Each file links to the one before and after. Every stock ledger entry shows its `REQ-`, `DSP-` or `DSC-` number as a link back to the file.

## One list, one link

Dispatch has **no separate sidebar link**. It is the **To pack, On the way, To confirm and Discrepancies tabs of the one Requisitions list**. The store opens on To pack. The list is drawn once (Group R); Group D draws the files, not a second list.

## Packing (Store Attendant, phone first; Store Manager shares the same screens)

1. **To pack** shows one card per branch, oldest first, with how long it has waited, expandable by department. One tap on a department opens it.
2. **Pack one department.** Each line shows the item, unit, **requested quantity** and **what is on hand**. The Attendant sees quantities, including on-hand, but no money. Lines are pre-filled with the requested quantity; the Attendant ticks each line as packed and changes it if less is sent.
3. **Short a line or substitute.** If on hand is lower than requested, the line flags "Not enough in store". The Attendant sends what there is. To substitute, add a line and set the requested line to zero; the department sees both. A short line is normal, not an error; the shortfall is not carried automatically, because the next requisition re-suggests it.
4. **Sign and send.** A summary lists lines and quantities, then **Packed by** (pre-filled with the signed-in person), **Signed by**, **Carried by** (chosen from a short carrier list the Store Manager keeps in Settings: a name or vehicle), and the PIN. Stock leaves the Central Store at once (`DISPATCH_OUT` through the ledger door) and the dispatch is **On the way**. The delivery note prints.
5. Signing is **per department**: each department's dispatch is signed separately, so a slow department never holds up the others.

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
