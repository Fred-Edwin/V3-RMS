# Purchasing and Receiving: business rules (plain English)

Session 1, Stage A, 4 Oct 2026. Sources: the Paper page "Inventory · Purchasing" (read by artboard), `backend/src/modules/inventory/purchasing/README.md` ("Approved behaviour"), `decisions.md` ("One screen set, mock first"), and the old back-end (`receiving-service.ts`, validators) **as reference only**. The mock engine implements exactly this; Session 2 finishes it (invoices, payments, statement, audit) and the later back-end session builds from it. Where a rule is not written down anywhere, it is under [Open questions](#open-questions) with a recommended default, and **is not built until the owner answers**.

Wire shapes: `docs/API_CONTRACT.md` §31. Screens: [screen-inventory.md](screen-inventory.md).

## 1. The order and its states

One order is one **purchase file** that holds every document (LPO, delivery note and photo, invoice and photo, payments, activity). There is one order per supplier at a time (see Q-07).

| State | Meaning | Who moves it on |
|---|---|---|
| `DRAFT` | Saved, not sent to anyone | Raiser edits; **Send for approval** (needs `orders.request`) or, for an approver, **Approve and send** |
| `AWAITING_APPROVAL` | Waiting for the Store Manager | SM or SA approves (PIN) or returns it with a note |
| `RETURNED` | Sent back with the manager's note | The raiser edits it and sends it again (back to `AWAITING_APPROVAL`) |
| `APPROVED` | "Approved, ready to send"; the LPO is signed | Anyone who may send (Q-09) sends it: WhatsApp, Print or Copy link marks it `SENT`; **Mark as sent** covers an order phoned in |
| `SENT` | With the supplier; shows "Due today" or "Overdue by N days" against the expected date | `orders.receive` records the delivery; `payables.record_deposit` may record an advance at any time from `APPROVED` onwards |
| `DELIVERED` | "Delivered, awaiting invoice". Anything not supplied is dropped from the order (Q-03) | `payables.record_invoice` adds the invoice |
| `INVOICED` | "Invoiced, to pay", or **disputed** if the invoice differs from the delivery | `payables.record_payment` records payments; a disputed invoice is settled first (Q-06) |
| `CLOSED` | Paid in full. Read only; documents stay | Nobody; everyone can open it |
| `CANCELLED` | Cancelled before any goods arrived; kept on record, nothing deleted | Nobody; **Raise a new order** starts again |

Tabs: Needs restocking (items, no order yet), Awaiting approval (`AWAITING_APPROVAL`, and `DRAFT`/`RETURNED` for the raiser: Q-07), To receive (`APPROVED`, `SENT`), Awaiting invoice (`DELIVERED`), To pay (`INVOICED`, including disputed), Closed (`CLOSED`, `CANCELLED`).

**Stage tracker** (six steps, shown in the file and in drawers): Raised, Approved, Sent, Delivered, Invoiced, Paid. Each step carries a date and a note (for example "29 Sep · PIN", "30 Sep · 1 short", "10,000 advance").

**Money strip** (on the file): Ordered, Delivered, Invoiced, Paid, Still to pay (est.). Before an invoice, "Still to pay (est.)" is Delivered (or Ordered before delivery) minus what is paid.

## 2. Needs restocking

- An item is **Low** when on hand is below its restock level and **Out** when on hand is zero (existing levels). The list shows items below level across suppliers, "grouped by supplier" or "list by item", with search, a Supplier filter and a sort (default "Most urgent first": Out before Low, then furthest below level).
- **Suggested order quantity** = round up of (restock level minus on hand) divided by the pack size, in whole buy units. Checked against Paper's figures: sugar 100 minus 18 = 82 kg; cooking oil 40 L = 4 jerricans of 10 L; margarine 14 kg = 2 boxes; yeast 800 g = 2 pouches of 500 g; flour 38 kg = 2 cartons of 24 kg; water 48 = 4 cartons of 12; chicken 22 kg = 5 trays of 5 kg. An item never bought before has no pack and no quantity until a supplier is chosen.
- The default supplier is the item's **preferred** supplier, else the cheapest by last price. The dropdown lists every supplier that sells the item (their last price, "Last bought 18 Sep", **Preferred**, "KES 10 cheaper" against the current choice). An item with no supplier sits in "No supplier yet" and joins a supplier's group once one is chosen.
- Estimated total per line = quantity times last price (per buy unit). A group's estimate is the sum.
- An item the Store Attendant added and the Store Manager has not finished setting up can be received but **cannot be ordered** (decision Q2).
- An item retired while on an open order keeps its line; it cannot be added to new orders (decision Q4).
- A supplier **on hold** cannot be ordered from (existing error `SUPPLIER_ON_HOLD`).

## 3. Raising, approving, returning, cancelling

- **Numbers.** Orders are numbered `LPO-nnnn`, gap-free, per site, from one counter (the existing counter table, prefix `LPO`). When the number is given is Q-05. Payments are `PAY-nnnn`. Receipts keep the existing `GRN-nnnn`. The old `EXP-nnnn` estimates are not used by the new flow. The supplier's own invoice number (for example `INV-05188`) and delivery note number (`DN-77120`) are typed in; they are never generated.
- **Who may do what** is one table of capabilities (see the Stage B permissions list below), never a role list in a screen.
  - `orders.request`: save a draft and send it for approval. Held by the Store Manager, System Admin and Store Attendant. **Not** by the Accountant (owner decision 4 Oct; Paper still shows the Accountant raising, Q-01).
  - `orders.approve`: approve with a PIN, or return with a note. Store Manager and System Admin. A Store Manager approving their own order is allowed ("Your own order: approved, ready to send"); the order shows Raised and Authorised by the same person, as on the printed LPO.
  - `orders.cancel`: Store Manager and System Admin. Attendants cannot cancel.
  - `orders.receive`: Store Manager, System Admin and Store Attendant.
- **Approve** needs the actor's own PIN. The mock accepts the demo PIN `1234` and rejects anything else with `INVALID_PIN` (the wrong-PIN state), keeping what the person typed. A System Admin signs with their own PIN and the copy reads "You are signed in as System Admin. Approve with your own PIN." (Paper reference table `OKQ-0`).
- **Return** needs a note (the manager's reason). The raiser sees the note, edits, and sends it again. While an order awaits approval the raiser sees "Waiting for Joseph to approve" with no button.
- **Price flag on approve**: each line shows how its price compares to the last order's price for that supplier line ("▲ 4% on the last order"). It is information, not a block.
- **Approved**: the LPO is fixed; it is no longer editable. Edits after approval are not drawn: cancel and raise again.
- **Send**: Send on WhatsApp (dialog, opens WhatsApp on the supplier's number with the message and downloads the PDF), Print, Copy link all mark `SENT` on continue; "Mark as sent" covers an order placed by phone. `SENT` records who, when, and how.
- **Cancel** (SM or SA, reason from a list plus a note, PIN; optional "Tell the supplier on WhatsApp after cancelling", with the message prefilled): only while nothing has been received. The order stays as `CANCELLED`. Once goods have arrived it cannot be cancelled (error `CANNOT_CANCEL_AFTER_DELIVERY`); Paper says "close it short instead" (Q-04).
- **One open order per supplier** (warning "Another order is still open"): see Q-07.

## 4. Advance (deposit)

- Any time after approval, `payables.record_deposit` records an advance against the order: amount, paid-on date, reference, method (bank transfer, M-Pesa Paybill, M-Pesa Till, M-Pesa Send Money, Cheque, Cash). Shortcuts: 25%, 50%, 100% of the order total.
- It appears on the order's Payments card as "Advance" and is numbered `PAY-nnnn`.
- When the invoice is added the advance is **applied to it automatically** ("Advance applied"). If the invoice or delivery comes to less than the advance, the difference stays as **credit with the supplier** (not refunded in the mock).
- An advance may be more than the order total? Not drawn; the mock refuses it with `DEPOSIT_EXCEEDS_ORDER`.

## 5. Receiving

- Two steps, on a phone: (1) **Check the goods**, (2) **Delivery note and signature**. The receiver enters, for each line, the quantity received (default: the ordered quantity). Line status: OK, "N short", or not supplied.
- **Not supplied / short**: the missing quantity is **dropped from the order** and stays on record (Paper: "The missing box is dropped from this order"; "Anything not supplied is dropped from the order, as agreed with the supplier"). So one delivery closes the delivery stage; a part-delivered order delivered a second time is **not** drawn (Q-03).
- **Over-delivery** (received more than ordered) is not drawn; the mock refuses it with `RECEIVED_EXCEEDS_ORDERED` (Q-10).
- **Price change**: if the supplier's price on a line differs from the order's price, that line shows "Price is 2,400, was 2,340" and the receiver must **Confirm** it before signing (`PRICE_CHANGE_UNCONFIRMED` otherwise). The delivered value uses the confirmed price (2,400 times 4 = 9,600 in Paper's example). What counts as a change and whether a refused change is possible is Q-10.
- **Delivery note**: number (required) and a photo (required in the mock; a photo that fails to upload shows the "Photo upload problems" states and can be retried or skipped by the Store Manager only: Q-10 asks).
- **Sign with PIN and receive**: the signed receipt (`GRN-nnnn`) adds the **received** quantities to Central Store stock (one ledger row per received line through `postStockMovement`; the mock only simulates this) and moves the order to `DELIVERED`. Money recorded on the receipt: delivered value = sum of received quantity times confirmed price; not supplied value is the dropped lines.
- A short receipt writes the supplier's **last price** per line from the receipt (existing rule: a signed receipt overwrites the price and clears a hand-set price).
- Attendants see no money anywhere in receiving **by the earlier decision**; Paper shows money on steps 12 to 14 (Q-02).

## 6. Invoice, dispute, payment (Session 2 builds the screens; the rules are fixed now)

- **One invoice per order.** Added by `payables.record_invoice` (Accountant or Store Manager): supplier's invoice number, invoice date, amount, photo or PDF. Due date = invoice date plus the supplier's terms (for example 14 days). A **duplicate invoice number** for the same supplier is refused with a warning that offers "Open it" or "This is a different invoice" (`DUPLICATE_INVOICE_NUMBER`).
- **Variance**: the invoice amount is compared to the **delivered value** (after dropped lines and confirmed prices). If different, a **reason is required** and the invoice is saved as **disputed** for the difference ("saved as disputed for KES 500 until you settle it with the supplier"). The screen shows Delivered value, "Invoice is higher by +500", Advance applied, Balance to pay. A lower invoice is also a variance (Q-06).
- **A disputed invoice is settled before it is paid**: agree the figure with the supplier, then record it (the screen for this is not in Paper: Q-06).
- **Void an invoice** (Accountant, reason from a list, PIN): only if nothing is paid against it ("If it had been paid, you would reverse the payment first"). It is marked Voided and leaves the statement; the order goes back to "Delivered, awaiting invoice"; the correct invoice is added straight after.
- **Payment** (`payables.record_payment`): amount (default the full balance), paid-on date, reference (cheque number when paying by cheque), method, optional proof (screenshot or slip). A **confirm dialog** shows who, how, the reference, the invoice and the amount, and notes that advances are already counted. **Paying more than is owed** shows a warning and needs the amount corrected or an explicit "Pay KES 20,000.00". Saving creates a payment advice `PAY-nnnn` that can be printed or shared. A part payment leaves the invoice in To pay with the balance. Fully paid closes the order (`CLOSED`).
- **Reverse a payment**: the Accountant records the request, and the **Store Manager's PIN** approves it in the same drawer (reason from a list). The payment stays on the statement marked Reversed, a linked line of the negative amount is added, the invoice goes back to To pay with the amount owing, and the payment is recorded again correctly. Nothing is deleted.
- **Fixing mistakes**: mistakes are fixed, never erased; each fix stays on the statement and in the audit log.

## 7. Who sees what

- Every desktop role (SM, ACC, DIR, BM, SA) opens every Purchasing screen. Write buttons show only for a role holding the capability.
- The Branch Manager does not see the supplier's payment account details (the Payment tab); amounts, dates, methods and references stay visible (owner decision 4 Oct).
- The Accountant sees the whole audit log (owner decision 4 Oct).
- The Store Attendant works on the phone: Needs restocking (Low and Out only), My orders (including approved), Receive. The Attendant sees no payables or supplier balances.

## 8. What the mock only simulates (the back-end session makes real)

PIN verification (real PIN hashes), stock added at receipt (through the ledger door), sequential numbers (the counter table), photos (object storage), WhatsApp (a link, nothing is sent), and every audit entry. Documents and files are never stored by the mock beyond a name, a size and a small thumbnail.

## Stage B permissions (the one back-end change)

Add to `central-store-access.ts`: `orders.request`, `orders.approve`, `orders.cancel`, `orders.receive` and `payables.record_deposit`.

| Capability | SM | SA | ATT | ACC | DIR | BM |
|---|---|---|---|---|---|---|
| `orders.request` | yes | yes | yes | no | no | no |
| `orders.approve` | yes | yes | no | no | no | no |
| `orders.cancel` | yes | yes | no | no | no | no |
| `orders.receive` | yes | yes | yes | no | no | no |
| `payables.record_deposit` (new; `payables.record_payment` also covers "payments, reversals, adjustments", not an advance before an invoice exists) | yes | yes | no | yes | no | no |

SM and SA hold every capability by construction (`CAPABILITIES.filter(...)` and `CAPABILITIES`). The existing `payables.*` and read capabilities already give the Accountant invoices and payments. A read capability for the purchasing screens is proposed in Q-13.

## Open questions

Answer these and the mock follows. Each has a recommended default; none is built until answered.

| # | Question | Where Paper and the decisions disagree | Recommended default |
|---|---|---|---|
| Q-01 | Can the Accountant raise an order? | Decision 4 Oct: no. Paper's sample "LPO-0046 raised by Margaret (Accountant)" (step 04) and its states table ("ATT and ACC send it for approval", step 24) say yes | Follow the decision. The mock's sample row is raised by the Store Attendant; Paper's text stays as is (no Paper edits). `orders.request` is not given to the Accountant |
| Q-02 | Does the Attendant see money while receiving? | Q6 (3 Oct) and the 3 Oct design check: no money. Paper steps 12 to 14 show "Price is 2,400, was 2,340", Ordered 30,136, Delivered 27,486 and "−2,890" on the Attendant's phone | Hide every KES figure from the Attendant; the price-change row reads "Price changed. Confirm." without amounts, and the summary shows quantities only. The Store Manager still sees the figures on desktop |
| Q-03 | Is a short delivery final? | Paper: "not supplied is dropped from the order, as agreed". Session 2 brief wants "a part-delivered order delivered again" | One delivery per order: short quantities are dropped. If a supplier delivers the rest later, the Store Manager raises a new order |
| Q-04 | "Close it short" after delivery: is that a separate action? | Paper's cancel drawer says "Close it short instead" but no screen exists | Not built. The dropped-line rule in Q-03 already closes the delivery stage. Confirm there is no extra action |
| Q-05 | When does an order get its `LPO-nnnn` number? | Paper's states table says "the LPO number is fixed" at Approved, but `LPO-0045` already shows while Awaiting approval | Number at **submit for approval** (so the number is gap-free for approved and awaiting orders); a draft shows "Draft" with no number. A cancelled order keeps its number |
| Q-06 | How is a disputed invoice settled? | Paper says "agree the figure with the supplier, then record it" but draws no screen. Nothing says what the Accountant clicks | A **Settle dispute** button on the invoice with the agreed amount and a note (Accountant, Store Manager); the invoice amount becomes the agreed figure and the dispute clears |
| Q-07 | What is "one open order per supplier", and where do drafts, returned and approved-not-sent orders appear? | Paper's warning says there is one order per supplier; the tabs have no Draft or Approved tab | Open means Draft, Awaiting approval, Returned or Approved/Sent with nothing received. Drafts and Returned appear under **Awaiting approval** (for the raiser, with a Draft or Returned label); Approved and Sent appear under **To receive** (Approved shows "Ready to send") |
| Q-08 | What does **Create 2 orders** do? | Paper draws the button, not the result | Create both as drafts, return to Awaiting approval with "2 draft orders created. Open each to review and send." (Alternative: open each New order in turn.) |
| Q-09 | Who may send, print and copy the link of an approved order? | Paper's step 8 and 9 role is "Anyone" | Anyone holding `orders.approve` or `orders.request` (SM, SA, ATT); DIR, BM and ACC read only. Print is allowed for every role that can open the order |
| Q-10 | Receiving edge cases | Not in Paper: what counts as a price change (any difference?), whether a price change can be refused, over-delivery, a photo that cannot be uploaded | Any difference needs a Confirm; a refused change is not offered (the receiver can raise it with the SM); over-delivery is refused; a photo is required, with a retry and no skip for the Attendant |
| Q-11 | Where does the demo's data come from? | The brief says items and suppliers come from the **real** catalog and supplier data. On the local lane database there are 221 items and 10 suppliers (7 suppliers have real names, 3 are tests) and 77 supplier lines. I have not checked that production has the same | Read items, supplier lines and last prices from the real services. Restock levels and on-hand: use the real restock levels, and on-hand from the real stock figures where they exist, else a mock figure. **Please say if the demo will run against production data**, because the test suppliers ("S6 Test Kagumo Poultry Farm") would show |
| Q-12 | Does Session 1 include the Accountant's **Record advance** (step 10)? | Brief: "build it only if Stage A puts it in this session" | Yes. It opens from the order file built in this session, and the deposit rules are needed by receiving and the file's money strip |
| Q-13 | Is a read capability needed for the purchasing screens? | The brief lists four new capabilities; none says "may open Purchasing" | Add `orders.read` to the "read everything" set (every desktop role), so the Purchasing link and the screens are gated by the table. The Attendant keeps a phone-only view through `orders.request` and `orders.receive` |
