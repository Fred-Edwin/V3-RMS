# Purchasing and Receiving mock: screen inventory

Written 4 Oct 2026 (Session 1, Stage A) from the Paper page "Inventory · Purchasing" (`p-3-0`, file `01M3TP8J54R83RHC9FJ7RAHGKG`), read by artboard name, not from screenshots. This is the checklist both mock sessions are held to: every row is built and **checked in the browser as the right role** (demo bar), then ticked with its route. Rules the screens follow: [backend-rules.md](backend-rules.md). Wire shapes: `docs/API_CONTRACT.md` §31.

**Key.** Roles: SM Store Manager, ATT Store Attendant, ACC Accountant, DIR Director, BM Branch Manager, SA System Admin. "Read" means the screen opens for that role with the write buttons hidden (not greyed). `IN PAPER` / `NOT IN PAPER`; after the build a row may also say `BUILT, NOT IN PAPER`. Session column: 1 = this session, 2 = [Session 2](../../../sessions/purchasing-mock-session-2.md). Tick column: `[ ]` until built and walked as the role.

## How the routes are laid out

All under `/app/inventory/` (pages in `app/` are thin shells; code in `frontend/features/inventory/purchasing/`).

| Route | What it is |
|---|---|
| `/purchasing` | One page with the six stage tabs (`?tab=needs\|approval\|receive\|invoice\|pay\|closed`, default `needs`; ATT on a phone gets the phone layout) |
| `/purchasing/new` | New order (`?supplier=<id>` preloads the lines picked on Needs restocking) |
| `/purchasing/[orderId]` | The purchase file, in every state (steps 7, 15, 22 are this one page in different states). Drawers and dialogs open over it |
| `/purchasing/[orderId]/lpo` | Printed LPO (A4, step 9) |
| `/purchasing/payments/[paymentId]/advice` | Printed payment advice (steps 21, 21b), Session 2 |
| `/receiving` | Orders to receive (step 11): the Receiving sidebar link. Same list as the "To receive" tab |
| `/receiving/[orderId]` | Receive a delivery: step 1 check the goods, step 2 delivery note and PIN (steps 12 to 14; ATT phone, and SM/SA on desktop in a phone-width column) |
| `/suppliers/[id]` | Existing real supplier page; Session 2 adds its mock-backed orders tab, statement and owing figures |
| `/audit-log` | Existing real audit log; Session 2 adds Purchasing rows from the mock |

The sidebar keeps the two links Paper draws, **Receiving** (with the to-receive count) and **Purchasing**; "Orders to pay" is the **To pay** tab inside Purchasing, never its own link. Both are visible by capability, not by role.

## Chapter 1 to 5: Session 1 (order to delivery)

| Step | Screen (Paper artboard) | Who acts / who reads | Device · route | Data shown | Buttons and what they do | Paper | Tick |
|---|---|---|---|---|---|---|---|
| 01 | Needs restocking, grouped by supplier (`01 · Needs restocking, grouped by supplier · desktop`) | SM, SA act (`orders.request`/`approve`); ACC, DIR, BM read | Desktop · `/purchasing?tab=needs` | Stage tabs with counts; "8 items are below their restock level, across 4 suppliers"; groups by supplier (name, code, terms, "N items · est. KES"); rows: tick, item and how it is bought, status Low/Out, on hand / level, Buy from (supplier and last price), order qty with unit, last price, est. total; "No supplier yet" group; selection bar ("5 items selected · 2 suppliers · est. KES 42,386") | Toggle **Group by supplier / List by item**; tick rows; **Buy from** dropdown (open state: each supplier, price, last bought, Preferred, "KES 10 cheaper"); order qty box; **Create order · N** per group opens New order for that supplier; selection bar **Clear** and **Create 2 orders**; **New order** (top bar) | IN PAPER | [ ] |
| 02 | Needs restocking, by item (appendix) (`02 · Needs restocking, by item · desktop`) | as 01 | Desktop · same route, List-by-item toggle | Flat list with search, Supplier filter, Sort ("Most urgent first"), same columns | Search, filters, sort, tick, qty, buy-from, Create order | IN PAPER | [ ] |
| 03 | New order from the catalog (`03 · New order · desktop`) | SM, SA (`orders.request`/`approve`); others read a saved draft | Desktop · `/purchasing/new` | Catalog of the supplier (Low and out 5 / All 18 / Selected 4), columns item, stock, sold as, price, qty; "Show items from other suppliers"; Order summary card (supplier with **Change**, lines "82 kg × 168", ✕ remove, Expected delivery date picker with Today / Tomorrow / In 3 days, note to supplier, total) | Tick and qty per line; supplier switch; remove line; pick date; note; **Approve and send** (SM/SA with `orders.approve`: asks PIN, approves, lands on step 07); **Save draft**; **Discard** (unsaved-changes warning, step 40d); for ATT the footer reads **Send for approval** (no PIN). | IN PAPER (SM footer); ATT footer NOT IN PAPER, see N-05 | [ ] |
| 04 | Orders waiting for approval (appendix) (`04 · Orders waiting for approval · desktop`) | SM acts; everyone reads | Desktop · `/purchasing?tab=approval` | "2 ORDERS · KES 37,650"; filters Search, Supplier, Raised by; table order no., supplier with item summary, raised by, submitted, stage tracker mini-dots + "Awaiting approval", value | Row **Approve** (SM, `orders.approve`) opens step 05; row click opens the purchase file | IN PAPER | [ ] |
| 05 | Approve order with PIN (`05 · Approve order · desktop overlay`, drawer `Drawer · Approve order`) | SM, SA | Desktop drawer over the approval tab | "Raised by Store Attendant · today 14:10"; compact tracker; supplier, expected, terms; lines with price-change flag ("▲ 4% on the last order"); total; "Note from Store Attendant"; "Your note (required if you return it)" | **Approve with PIN** (PIN dialog, wrong PIN shows the contract error, input kept); **Return to Attendant** (note required). SA sees the SA copy (reference table `OKQ-0`). | IN PAPER | [ ] |
| 06 | Or approve on the phone (appendix) (`06 · Approve order · phone sheet`) | SM, SA | Phone sheet | Same content, single column | **Approve with PIN**, **Return** | IN PAPER | [ ] |
| 07 | Your own order: approved, ready to send (appendix) (`07 · Approved, ready to send · desktop`, page `5a`/LPO-0044) | SM, SA act; everyone reads | Desktop · `/purchasing/[id]` | Breadcrumb Purchasing / Approved / LPO-0044; header (supplier, "Approved · ready to send", "Raised by … approved by …"); stage tracker (Raised, Approved with PIN, Sent, Delivered, Invoiced, Paid); money strip (Ordered, Delivered, Invoiced, Paid, Still to pay est.); Next step card; tabs Items / Documents / Activity; items table (our name first, "Samrat: NAME · code"); right rail: supplier contact, WhatsApp, expected delivery and terms; Payments card | **Send on WhatsApp**, **Print**, **Copy link**; **Print LPO**; **More ▾**; **Record advance** (ACC, SM, SA with `payables.record_deposit`) | IN PAPER (More menu contents NOT IN PAPER, see N-08) | [ ] |
| 08 | Send on WhatsApp (`08 · Send on WhatsApp · desktop overlay`, `Dialog · Send on WhatsApp`) | Paper says "Anyone"; who exactly is Q-09 | Desktop dialog | "To Rajesh Samrat · Samrat Supermarket Ltd · +254 722 118 340"; message text; attachment `LPO-0044.pdf`; steps 1 and 2; "The order is marked Sent when you continue." | **Download PDF and open WhatsApp** (opens `https://wa.me/<number>?text=` and the print page; marks **Sent**); **Cancel** | IN PAPER | [ ] |
| 09 | Printed LPO (`09 · Printed LPO · A4`) | Anyone who can open the order | A4 · `/purchasing/[id]/lpo` | Letterhead; LPO number and date; supplier block; expected delivery, terms, deliver to, raised by; items table with the supplier's name and code first and "Our item: …" second; total and amount in words; notes; **Raised by** and **Authorised by** signatures in the signature font ("Signed with PIN · date"); QR "Scan to open LPO-0044"; supplier acknowledgement block; footer | Browser print (`window.print`), no required step | IN PAPER | [ ] |
| 10 | Record an advance payment (`10 · Record advance · desktop overlay`, `Drawer · Record advance`) | ACC, SM, SA act | Desktop drawer over the order | Order total; amount (25% / 50% / 100% shortcuts); paid on (date); reference; pay using (bank transfer default, M-Pesa Paybill, Till, Send Money, Cheque, Cash, from the supplier's payment methods); note "held against LPO-0044, comes off the invoice automatically; if goods or invoice come to less, the difference stays as credit". BM hides payment details (suppliers.read_payment_details) | **Save advance**, **Cancel** | IN PAPER | [ ] |
| 11 | Orders due for delivery (appendix) (`11 · Orders to receive · desktop`) | SM, SA, ATT act (`orders.receive`); everyone reads | Desktop · `/purchasing?tab=receive` and `/receiving` | "5 ORDERS · KES 61,626"; table order, supplier and item summary, raised by, sent, stage ("Awaiting delivery"), expected ("Due today", "Overdue by 1 day", "In 2 days · 02 Oct"), value (with "Advance 3,000"); row **Receive** (due today or overdue) or **Open** | **Receive** opens `/receiving/[id]`; **Open** opens the purchase file | IN PAPER | [ ] |
| 12 | Check the goods (`12 · Check the goods · phone`) | ATT, SM, SA act | Phone · `/receiving/[id]` | Header "Receive delivery · LPO-0044 · supplier"; compact tracker; "Step 1 of 2 · Check what arrived against the order."; each line: our name, "Ordered 82 kg", received qty stepper, status OK / "1 short"; price-change row "Price is 2,400, was 2,340" with **Confirm**; "The missing box is dropped from this order." | Qty per line; **Confirm** each price change; **Next: delivery note** | IN PAPER (money shown to ATT: see Q-02) | [ ] |
| 13 | Photograph the delivery note (`13 · Photo of the delivery note · phone`) | ATT, SM, SA | Phone · same route, step 2 | "Step 2 of 2"; delivery note number; photo slot (empty state); summary Ordered, Delivered, "1 box not supplied" (money); "When you sign, the stock is added to the Central Store…"; sheet **Add a photo** (Take photo, Choose from gallery, Cancel) | Photo (file input, `capture`), note number, **Sign with PIN and receive** | IN PAPER (money shown to ATT: see Q-02) | [ ] |
| 14 | Delivery note, sign with PIN (`14 · Delivery note and signature · phone`) | ATT, SM, SA | Phone | Photo filled (`IMG_2041.jpg`, 1.8 MB, **Retake photo**), same summary | **Sign with PIN and receive** (PIN sheet; on success stock is "added" in the mock, order becomes Delivered) | IN PAPER | [ ] |
| 15 | Purchase file, awaiting invoice (appendix) (`15 · Purchase file, awaiting invoice · desktop`, `5a`) | SM, ACC act; everyone reads | Desktop · `/purchasing/[id]` | Same page as 07 in the Delivered state: tracker "Delivered 30 Sep · 1 short", money strip (Delivered 27,486, Paid 10,000 advance, Still to pay 17,486), Next step "Add the supplier's invoice", lines table (ordered, delivered, price, result: "As ordered", "Price up 60 (was 2,340)", "1 box not supplied"), right rail Delivery (note number, received by, photo **View**), Payments card with the advance and **Record payment** | **Add invoice** (opens step 17, Session 2), **Record payment**, **Print LPO**, **View** photo | IN PAPER | [ ] |

## Chapters 6 to 10: Session 2 (listed here so nothing is missed)

| Step | Screen | Who acts | Device · route | Paper | Tick |
|---|---|---|---|---|---|
| 16 | Orders awaiting an invoice (appendix), `/purchasing?tab=invoice` | ACC, SM (`payables.record_invoice`); all read | Desktop | IN PAPER | [ ] |
| 17 | Add invoice, empty (drawer over file) | ACC, SM | Desktop drawer | IN PAPER | [ ] |
| 18 | Add invoice, filled in (variance, reason, advance applied) | ACC, SM | Desktop drawer | IN PAPER | [ ] |
| 19 | Orders to pay (appendix), `/purchasing?tab=pay` (table "2b … To pay tab (Accountant)") | ACC, SM (`payables.record_payment`); all read | Desktop | IN PAPER | [ ] |
| 20 | Record payment (drawer) | ACC, SM | Desktop drawer | IN PAPER | [ ] |
| 20b | Record payment by cheque (cheque number) | ACC, SM | Desktop drawer | IN PAPER | [ ] |
| 21 | Payment advice, printed | ACC | A4 | IN PAPER | [ ] |
| 21b | Payment advice, paid by cheque | ACC | A4 | IN PAPER | [ ] |
| 22 | Closed purchase file, `/purchasing/[id]` closed | Everyone reads | Desktop | IN PAPER | [ ] |
| 23 | Audit log (company-wide), `/audit-log` | ACC (whole log), SM, DIR, BM, SA | Desktop | IN PAPER | [ ] |
| 24 | Every state of a purchase file (reference table, a documentation screen, not a product screen) | n/a | Reference | IN PAPER, not built as a screen: it is the state machine in backend-rules.md and the file's state variants | [ ] |
| 25 | Supplier orders tab, `/suppliers/[id]` | SM, ACC; all read | Desktop | IN PAPER | [ ] |
| 26 | Supplier statement, `/suppliers/[id]` | SM, ACC; all read (BM without payment details) | Desktop | IN PAPER | [ ] |
| 27 | Supplier statement, printed | ACC | A4 | IN PAPER | [ ] |
| 28 | Needs restocking (attendant phone): ask for restock, Low/Out only | ATT | Phone | IN PAPER | [ ] |
| 29 | My orders (attendant phone), incl. approved | ATT | Phone | IN PAPER | [ ] |
| 30 | Check the goods (attendant phone) | ATT | Phone | IN PAPER, same screen as 12 | [ ] |
| 31 | Delivery note and signature (attendant phone) | ATT | Phone | IN PAPER, same screen as 14 | [ ] |
| 32 | Order returned with a note (phone) | ATT | Phone | IN PAPER | [ ] |
| 33 | Short delivery, price change (phone) | ATT | Phone | IN PAPER, same screen as 12 with those states | [ ] |
| 34 | Invoice higher than delivery (drawer) | ACC | Desktop drawer | IN PAPER, same screen as 18 | [ ] |
| 35 | Photo upload problems (component states) | anyone adding a photo | Component states | IN PAPER | [ ] |
| 36 | Cancel an order (reason, note, PIN, optional WhatsApp note) | SM, SA (`orders.cancel`) | Desktop drawer | IN PAPER | [ ] |
| 37 | Void an invoice (reason, PIN) | ACC | Desktop drawer | IN PAPER | [ ] |
| 38 | Reverse a payment (reason, Store Manager's PIN) | ACC requests, SM approves | Desktop drawer | IN PAPER | [ ] |
| 39 | Confirm payment (dialog) | ACC | Desktop dialog | IN PAPER | [ ] |
| 40 | Warnings before a mistake: duplicate invoice number, paying more than owed, another order open, unsaved changes | per flow | Desktop dialogs | IN PAPER (40d, unsaved changes, also needed by steps 03 and 05 in Session 1) | [ ] |

## Screens Paper does not have

| Id | What | How it is built | Session | Paper | Tick |
|---|---|---|---|---|---|
| N-01 | **Central Store sidebar group** for each desktop role (and SA) | Existing `nav-groups.ts` and the approved geometric sidebar. Receiving and Purchasing links gain capability rules (`orders.read` or `orders.request` for Purchasing, `orders.receive` or `orders.read` for Receiving). Paper draws the SM sidebar only; other roles get the same shell with items hidden by capability | 1 | NOT IN PAPER | [ ] |
| N-02 | **SA entry to the Central Store** | Check how SA reaches Inventory today (old sidebar). If there is no way in, add one "Central Store" link to the old SA sidebar and nothing else | 1 | NOT IN PAPER | [ ] |
| N-03 | **"Demo data" banner** on every mock screen | Slim banner under the top bar, shared component | 1 | NOT IN PAPER | [ ] |
| N-04 | **Demo bar (SA only)**: role switcher, scenario picker, reset | Fixed bar at the foot of the viewport, rendered only for `SYSTEM_ADMIN`; changes the mock view's role, never logs in | 1 | NOT IN PAPER | [ ] |
| N-05 | **Requester footer on New order** (ATT) and "Waiting for Joseph to approve" status with no button for the raiser | Same card, button **Send for approval**; copy from the Paper states table (step 24) | 1 | NOT IN PAPER (copy IN PAPER) | [ ] |
| N-06 | **Loading, empty and error states** for every list and file | Shared `_shared` states kit and the per-screen copy table; no new designs | 1 | NOT IN PAPER | [ ] |
| N-07 | **PIN dialog and wrong-PIN state** (desktop dialog and phone sheet) | Existing `sign-sheet` / `decision-dialog`; demo PIN `1234` | 1 | NOT IN PAPER (wording for SA IN PAPER, reference table) | [ ] |
| N-08 | **"More ▾" menu** on the purchase file: Copy link, Mark as sent (phone orders), Cancel order | Existing menu pattern; items by capability and state | 1 (Cancel opens Session 2's step 36) | NOT IN PAPER | [ ] |
| N-09 | **Edit a returned order** and re-send | The New order screen opened on the returned order; shows SM's note on top | 1 | NOT IN PAPER | [ ] |
| N-10 | **Receive on desktop** for SM and SA (Paper's step 11 offers **Receive** on desktop, but 12 to 14 are phone only) | The same two steps in a phone-width column | 1 | NOT IN PAPER | [ ] |
| N-11 | **Create several orders at once** (selection bar **Create 2 orders**) | Needs an answer, see Q-08 | 1 | NOT IN PAPER | [ ] |
| N-12 | **Close an order short after delivery** ("Once goods have arrived an order can't be cancelled. Close it short instead.") | Needs an answer, see Q-04 | 2 | NOT IN PAPER | [ ] |
| N-13 | **Settle a disputed invoice** ("agree the figure with the supplier, then record it") | Needs an answer, see Q-06 | 2 | NOT IN PAPER | [ ] |
| N-14 | **Read-only variants** for DIR, BM (and ACC on order screens) | Not separate screens: the same screens with write buttons hidden | 1 and 2 | by decision | [ ] |
| N-15 | **Photo handling in the mock** | The mock keeps file name, size and a small thumbnail in the browser, never the file | 1 | NOT IN PAPER | [ ] |
| N-16 | **Demo-mode supplier page** (orders tab, statement, owing from the mock; legacy-payables deleted) | See Session 2 | 2 | NOT IN PAPER | [ ] |

## Mismatches I found between Paper and the decisions (asked, not guessed)

Numbered Q-01 to Q-13 in [backend-rules.md](backend-rules.md#open-questions). Rows above that depend on one say so. Nothing in them is built until the owner answers.
