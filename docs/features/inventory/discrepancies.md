# Discrepancies: what happens when a delivery to a branch is short

Agreed with the owner, 7 Oct 2026, before any Requisitions, Dispatch or Branch day screen is drawn. This replaces the "transit discrepancy" rule that used to sit in [decisions.md](decisions.md) (`found and re-delivered / transit loss / miscount corrected`, a Director adjudicating, a held dispatch). Part of the final Inventory design pass: Requisitions, then Dispatch, then Branch day, then Branch waste.

## In one paragraph

A branch counts what arrived without being shown what was sent. If a count does not match, the screen flags it and the person counts again. Whatever is still different is signed, with a reason and an optional photo, and the branch's part is over. The gap then sits as **unaccounted** until the Store Manager records **one finding** that says where it went. The finding moves the stock and creates the loss record. Everyone with read access can see the whole story. There is no tolerance, no escalation, no "send the rest" and no third party.

## What a discrepancy is

A difference between what left the Central Store and what a branch department counted on arrival. It is not a case to be argued: someone has to say what happened to the gap, and the system records that against the right party.

Numbering: a requisition is `REQ-`, a department's dispatch is `DSP-`, a discrepancy is `DSC-`, a branch day is `DAY-` (like LPO and GRN in Purchasing).

## At the branch: count blind, flag, recount, sign

1. The department opens its delivery. Each line shows the item and its unit with an **empty count box**. The sent quantity is **not shown and nothing is pre-filled**. Sign stays disabled until every line has a count.
2. A matching count passes silently.
3. A line that does not match flags at once: "This doesn't match what was sent. Count again." The sent figure is **not** revealed, or a person in a hurry would just type it.
4. The second count is final. If it matches, the flag clears.
5. A line that still differs is marked **Short** or **Extra**. The person picks a reason (**Not in the box, Damaged, Wrong item, Other**) and may attach a photo. A photo is suggested for Damaged and Wrong item, never forced.
6. A summary shows what signing writes ("Milk: you counted 18, 20 were sent"), then the PIN.
7. Signing moves **what was counted** into the department's stock. The gap is held as **unaccounted**: in neither the store's stock nor the branch's.

All lines matching is the common case and takes the same count-and-sign steps, with no flags.

**Who confirms.** Any active member of the receiving department, signing with their own PIN, or the Branch Manager for any department (recorded as the real signer, "on behalf of the department"). The head sees every confirmation on the file. A department with one person falls back to the Branch Manager. The delivery file always shows who signed and when.

**If nobody confirms.** A delivery unconfirmed 2 hours after arrival shows "Waiting for the branch" to everyone and nudges the Branch Manager. It blocks only that department's day close (unchanged).

Note for the client: the printed delivery note carries the sent quantities, so a determined receiver could copy from it. The aim is to stop a hurried tap, not a deliberate cheat. The branch copy may omit quantities if the client prefers.

## What happens after the branch signs

The discrepancy `DSC-nnnn` opens on the dispatch file, assigned to the **Store Manager**. They find out what happened (talking to the packer and the carrier, outside the system if needed) and record **one finding** with their PIN.

| Finding | Meaning | Stock effect | Recorded against | Counts as a loss? |
|---|---|---|---|---|
| **Packed short at the store** | Store sent 18 but recorded 20 | The 2 return to store stock | The store: who packed, who signed | **No.** An error, shown on its own report line |
| **Lost or damaged on the way** | Left the store, never arrived | Written off at the cost frozen at dispatch | The carrier / route | Yes |
| **Branch counted wrong** | All 20 arrived | The department's stock is corrected up by the gap | The receiver | No |
| **Can't tell** | Nobody can say | Written off at frozen cost | Unexplained (its own bucket) | Yes |

For an **Extra** line (counted more than sent) the findings are the mirror: *packed more than recorded* (store stock goes down, an error), *branch counted wrong* (department corrected down), *can't tell* (the extra is taken in and recorded as unexplained). **Open for the owner:** confirm the Extra wording.

Every posting goes through the stock ledger door (`postStockMovement`), as a new linked entry carrying the `DSC-` number. Nothing is edited or deleted.

## Making blame traceable

Each dispatch (`DSP-`) records, at sign-off:
- **Packed by**: the person who picked the lines.
- **Signed by**: the person who signed the dispatch (can be the same person).
- **Carried by**: a name or vehicle chosen from a short **carrier list** the Store Manager keeps. Drivers are not users.

Without these, "recorded against" would be empty.

## A loss stays until something proves it wrong

A finding is never deleted. If the item turns up later, the Store Manager **reverses** the finding with a new linked entry, a reason and their PIN. The original and the reversal both stay visible on the file and in the audit log.

## After a finding

- The branch sees the finding on the same delivery file.
- Nothing is sent back later. If the branch still needs the item, it goes into the **next requisition**: suggestions are restock level minus on hand, so a short delivery makes the item suggest itself again. There is no "send the rest" option.
- A discrepancy never blocks the branch from closing its day. An unconfirmed delivery does.

## Alerts and who sees what

No tolerance: every gap opens a discrepancy and an alert.

| Who | Gets | Can do |
|---|---|---|
| Store Manager | Alert when opened; a reminder after **24 hours** without a finding, then daily | Record and reverse findings |
| Branch Manager | Informed | Nothing |
| Director | Informed of every discrepancy and every finding | Nothing |
| Accountant | Informed when a loss is written off, with its value | Nothing |
| Everyone else with read access | No alert | Opens it on the file and in the list |

Visibility only: no second approver on write-offs, no escalation. Read follows the usual convention: every desktop role opens every screen; the Accountant's **sidebar** is narrower, her access is not.

## Reports

Because every finding has a cause, a person or party, a branch, a route and a value at cost, the Reporting module can list lost quantities and their value, split by cause. Packing errors are shown apart from losses. Unexplained losses are their own line. Patterns (one route, packer or branch recurring) show up without a penalty process in the system: management decides what to do with the evidence.

## Still to confirm with the owner

1. Extra-line findings wording (above).
2. Who may record or reverse a finding: Store Manager and System Admin (System Admin signs with their own PIN). Anyone else?
3. Photo limits (size, count per line); stored as documents on the dispatch file like Purchasing's delivery-note photo.
4. The 2-hour "waiting for the branch" and 24-hour reminder times, as settings or fixed.
