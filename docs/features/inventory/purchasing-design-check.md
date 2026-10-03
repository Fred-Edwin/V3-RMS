# Purchasing design check (3 Oct 2026)

Does the approved Purchasing design (Paper page "Inventory · Purchasing", 40 screens in 10 chapters) still fit what was decided since it was drawn? Checked against the permissions table (`backend/src/modules/inventory/_shared/central-store-access.ts`), the new sidebar, read-only roles, and the System Admin signing with their own PIN.

**Result:** the flow itself still fits. Nothing needs a new screen to stay correct. There is **one small fix made** in Paper, **four mismatches** that need an owner choice, and **two gaps in the code's permissions table** (not in the design).

## Fixed in Paper
- **Screens index, step 38 "Reverse a payment":** the role said "Accountant, approved by **Manager**". Everywhere else the design says Store Manager, and the permissions table has a separate Branch Manager, so "Manager" was ambiguous. Now "Accountant, approved by Store Manager".

## What matches
- **The Accountant writes invoices and payments.** Design chapters 6 and 7 (add invoice, record payment, payment advice, confirm payment, void an invoice) are the Accountant's. Table: `payables.record_invoice` and `payables.record_payment` (payments, reversals, adjustments) go to the Accountant and the Store Manager.
- **Director and Branch Manager write nothing.** The design gives them no action: they appear only as readers ("Everyone", "Store Manager or Director" for the audit log). Table: read only.
- **Attendant sees no money.** Design chapter 9 and "Receiving history for attendants omits money". Table: the attendant holds no payables or cost capability.
- **Orders to pay exists.** Step 19 "Orders to pay" (Accountant, desktop) is the screen that replaces Supplier AP, as planned.
- **Sidebar links.** The design's Receiving and Purchasing links match the new sidebar; Orders to pay lives inside Purchasing (the "To pay" tab), not as its own sidebar link.

## Owner's decisions (4 Oct 2026)
1. **Audit log: who sees what** — the Accountant sees the whole log. Done: the Purchasing chapter 10 note now says so. The table is unchanged.
2. **Branch Manager and payment details** — no change. The recommendation stands as the default: hide only the supplier's account details (the Payment tab); the Branch Manager still sees paid amounts, dates and methods.
3. **System Admin signing with their own PIN** — agreed. Done as a reference table, "Wording · When a System Admin approves or signs", on the Purchasing page. No new screens.
4. **Read-only variants** — agreed, and they wait until the client has approved the role names.
5. **Order permissions** — the table's missing order capabilities are a to-do for the Purchasing rebuild (see the Purchasing README).

## Mismatches that needed the owner's choice (answered above)
1. **Audit log: who sees what.** Chapter 10 says "Accountants see payment and invoice actions only", and step 23 gives the audit log to "Store Manager or Director". The table gives the Accountant, Branch Manager and System Admin the full audit log (`audit.read` is in "read everything"). **Recommendation:** keep the table (read for every desktop role, as agreed on 3 Oct) and change the design note to say the Accountant sees the whole log. Alternative: add an Accountant-only filter to the table.
2. **Branch Manager and payment details.** The table lets the Branch Manager read amounts owed (`payables.read`) but not "supplier payment details" (bank and cheque details). The design's record-payment screens, the payment advice and the supplier statement show the payment method and reference (for example a cheque number). Is a payment's method and reference "payment details" the Branch Manager must not see? **Recommendation:** no. Hide only the supplier's account details (the Payment tab), and let the Branch Manager see paid amounts, dates and methods. Draw a read-only supplier statement and purchase file without the Payment tab.
3. **System Admin signing with their own PIN.** The table gives the System Admin every capability, including approving orders and signing deliveries with their own PIN. The design only shows the Store Manager signing, in text written for that role (for example "You are the Store Manager, so you approve with your PIN"). A System Admin approving would see wrong copy, and the audit trail would name them. **Recommendation:** add a copy variant of the approve drawer (step 05) and the PIN dialogs: "You are signed in as System Admin. Approve with your own PIN." No new screen.
4. **Read-only variants are not drawn.** For roles that can read but not write (Director, Branch Manager, and the Accountant on order screens): needs-restocking, orders, the purchase file and the supplier statement should show no Approve, Create order, Cancel or Record buttons. **Recommendation:** draw one read-only version of the purchase file (step 15/22) and the orders list, and have the rest follow the same rule. Wait until the client has approved the role names (they have not yet).

## Gaps in the code's permissions table (not the design)
- **No capability for orders and receiving.** The table covers payables, suppliers, catalog, restock and audit, but nothing for raising, approving or receiving purchase orders. The Purchasing endpoints still use the old role lists (Store Manager, Accountant, Director; the attendant for receiving). When Purchasing is rebuilt, add capabilities such as `orders.raise`, `orders.approve`, `orders.cancel`, `orders.receive` so these follow the same one table.
- **Order requests by the attendant and Accountant.** The design says the attendant and Accountant raise orders and send them for approval; the Store Manager approves straight away. That needs its own capability too (`orders.request`), separate from approve.

## Not checked
- The 40 screens embed the older sidebar (with Supplier AP and Dashboard). Not redrawn: new designs use the new sidebar master, and the sidebar in the code is already current (see `paper-updates-needed.md`).
