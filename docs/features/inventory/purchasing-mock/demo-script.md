# Purchasing and Receiving demo script

For the owner, to run the client demo. Everything runs on demo data kept in the browser; nothing is real. Log in as the **System Admin**, open **Purchasing**, and use the dark **Demo bar** at the foot of the screen: *View as* switches the role, *Scenario* + **Load** jumps to a state. The PIN for every signature is **1234** (a wrong one shows the wrong-PIN message). On a phone the bar folds to a small "Demo" tab.

Tip: load "A normal day" first. It has something in every tab. Load again at any time to reset.

## 1. Store Manager (Joseph) — scenario "An order awaiting approval", then "Approved, ready to send"
1. Purchasing → *Awaiting approval*: the Attendant's chicken request. Click **Approve**, point out the "price up 4%" flag and the Attendant's note. Try PIN 0000 (wrong), then 1234.
2. The order is "Approved, ready to send": **Send on WhatsApp** (dialog), **Print LPO** (A4, signed by PIN), **More ▾** → Cancel order (reason, PIN).
3. *Needs restocking*: tick items, change supplier, **Create order**.
Point out: nothing is typed twice; the LPO number is given when it is submitted.

## 2. Store Attendant — View as Store Attendant (phone layout), scenario "A normal day"
1. **Restock**: tick items (suggested amounts fill in), add a note, **Send order for approval**. No prices anywhere.
2. **My orders**: statuses; scenario "An order returned with a note" shows the manager's note and **Edit and send again**.
3. **To receive**: scenario "Delivery due, with a price change" → **Receive delivery**: change a quantity to make a line short, **Confirm** the price change, add the delivery note number and a photo (pick any file; a file named "fail…" shows the upload-failed state with Retry), sign with PIN.
Point out: the Attendant never sees money.

## 3. Accountant (Margaret) — scenario "The Accountant's day" (or "Delivered, awaiting invoice")
1. *Awaiting invoice* → **Add invoice**. Type 27,486 (matches the delivery: advance applied, balance 17,486). Then try 27,986: a +500 variance appears, a reason is required, saved as **disputed**. Re-using INV-05121 shows the duplicate warning.
2. A disputed file offers **Settle dispute** (agreed amount + note); it cannot be paid first.
3. *To pay*: overdue first. **Pay** → pick M-Pesa or **Cheque** (cheque number), **Save payment** → Confirm dialog → **Print payment advice**. Try 20,000 on a 17,486 balance: blocked.
4. On a closed file: **Documents**, **+ Add a document**, the audit log on the right. **Reverse** a payment (reason + Store Manager's PIN) and watch it return to To pay; **Void invoice** on an unpaid one (it returns to Delivered).
5. Suppliers → Samrat: **What we owe**, **Orders** tab, **Statement** tab (**Export PDF** / **Export CSV**).
6. Audit log → *Purchasing and payments*.

## 4. Director — View as Director, scenario "A normal day"
Open every tab, a file, a supplier's statement and the audit log. Everything is visible, no write buttons anywhere.

## 5. Branch Manager — View as Branch Manager
Same as the Director, except the supplier page has **no Payment tab** (no bank or M-Pesa details). Amounts, dates and references are visible.

## 6. System Admin — View as System Admin
Does everything, signing with their own PIN (the reverse drawer says "Your own PIN").

## Scenarios (Demo bar)
Fresh start · A normal day · The Accountant's day · An order awaiting approval · An order returned with a note · Approved, ready to send · Sent, with an advance paid · Delivery due, with a price change · Delivered, awaiting invoice · Invoice higher than delivery (disputed) · Invoiced, ready to pay · Invoice overdue · Part paid · Paid in full by cheque · A payment reversed · An invoice voided · An order cancelled.

## Choices to ask the client
1. Does a supplier payment need the Store Manager's approval? (Built: no; only a reversal does. Q-14.)
2. Should paying more than the invoice be allowed, with a confirmation, to leave credit with the supplier? (Built: blocked. Q-16.)
3. May the Attendant see prices when ordering and receiving? (Built: no. Q-02.)
4. Does the Attendant need desktop access, or is the phone enough?
5. Who may send, print and copy an LPO? (Built: Store Manager, System Admin, Attendant. Q-09.)
6. Is a short delivery final, or can the supplier deliver the rest later on the same order? (Built: final; raise a new order. Q-03.)
7. Who settles a disputed invoice? (Built: Accountant, Store Manager. Q-06.)
8. Should a voided invoice stay on the statement? (Built: yes, struck through. Q-15.)
9. Keep a separate **Receiving** sidebar link, or only the "To receive" tab inside Purchasing?
10. Should the Director and Branch Manager be able to approve orders, or stay read-only?
