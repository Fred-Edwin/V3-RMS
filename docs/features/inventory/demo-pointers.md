# Demo pointers (owner's cue card)

Short reminders only. Detail lives in the sub-module READMEs and `purchasing-mock/demo-script.md`.

## Part 1. Catalog, Suppliers, Restock levels, Audit log

**Overview (say first)**
- The Central Store buys, receives, preps, counts and sends stock to the branches.
- Every desktop role **reads** every Central Store screen. **Writing belongs to whoever does the job.**
- The Attendant is blind to money and stock figures.
- Nothing is deleted: retire or reverse, with a reason. Every change is logged: who, when, why.

**Catalog** (Store Manager writes; Attendant adds a missing item; others read)
- Purpose: every item we count and issue, in the unit we use it.
- Do: search (also matches supplier names) · open an item (pack, sellers, history) · add an item · edit with the Review change step · retire with a reason.

**Restock levels** (Store Manager; Department Head own department)
- Purpose: the level that decides OK / Low / Out and drives purchasing suggestions.
- Do: Whose levels switch · edit in rows, then Review changes · history and Put back.

**Suppliers** (Store Manager writes; Accountant payment details; Branch Manager no Payment tab)
- Purpose: who sells what, at what price, and how we pay them.
- Do: open Samrat · tabs Overview, Contacts, Payment (numbers hidden until Show), Catalog, Documents · add a Cheque method live, then remove it · upload a document.

**Audit log** (Store Manager, Accountant, Director read; nobody edits)
- Do: show the entries just made · filter by area, who, when.

**Role contrast:** Store Manager writes · Attendant (phone, no money) · Accountant (payment details) · Branch Manager (read only).

## Part 2. Purchasing and Receiving (demo data in the browser)

**Setup:** System Admin, Purchasing, Demo bar. **Load "A normal day" first.** PIN is **1234** everywhere.

**Overview (say first)**
- Purpose: buy stock properly: need, order, approve, receive, invoice, pay, closed file.
- Roles: Attendant requests and receives · Store Manager approves and sends · Accountant invoices and pays · Director and Branch Manager read.
- Conventions: PIN signs a step · nothing deleted, reverse with a reason · every step in the audit log · the Attendant never sees money.

**The flow, one line each**
1. Need: Needs restocking tab, tick items, Create order.
2. Approve: Store Manager approves (price flag, PIN).
3. Send: WhatsApp or Print LPO.
4. Receive: Attendant on the phone, blind, short line, photo, PIN.
5. Invoice: Accountant adds invoice (matches / variance / dispute).
6. Pay: M-Pesa or cheque, payment advice.
7. Closed file: Documents and audit log.

**Documents to show:** LPO (print) · delivery note photo · invoice · payment advice (print) · supplier statement (PDF/CSV) · audit log (search LPO-0044).

**Role by role** (Demo bar, View as)
- **Store Manager** (scenario "An order awaiting approval"): approve (wrong PIN first), send, print LPO.
- **Attendant** (phone): restock, My orders, To receive.
- **Accountant** (scenario "The Accountant's day"): invoice 27,486 then 27,986 (variance), settle dispute, pay, cheque, reverse.
- **Director / Branch Manager:** read only; Branch Manager has no Payment tab.

**Say out loud:** this part is a working preview on sample data; the real back-end follows your feedback. Ask the choices list in `purchasing-mock/demo-script.md` ("Choices to ask the client").
