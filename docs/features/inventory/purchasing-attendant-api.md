# Purchasing, Store Attendant phone: the API (Block 6 back end, 11 Oct 2026)

Paper chapter 9, steps 28A to 28Q (30 and 31 unchanged). Branch `feat/block6-contract`, one additive migration `20261011082704_purchasing_attendant_phone`, not pushed. Everything is under `/inventory/purchasing`, every route has `authenticate` and a capability (never a role list), every query carries the hub `siteId`, Zod on every input. Money follows the blind rule: item prices and order totals yes, **never an invoice, payment or balance**. People are named with their role ("Joseph (Store Manager)"). Dates are Nairobi days.

## 1. Gap table

| Screen | Served by | Result |
|---|---|---|
| 28A Home | none | **gap, built:** `GET /attendant/home` (restock card, Needs you now, my open orders, approver, badges) |
| 28B Restock list | `GET /needs-restocking` | suggested qty already = reorder level minus on hand (whole buy units). **Gap, fixed:** the Attendant got no on-hand or level; new capability `orders.see_stock` opens them on this list and the catalog |
| 28C Review and send | `POST /orders` + `submit` per supplier | **gap, built:** `POST /restock-list/review`, `POST /restock-list/send` |
| 28D Approved: send it | `GET /orders/:id`, `/lpo`, `/whatsapp`, `POST /send` | **gap, built:** collected-by field, `GET /collectors`, `PUT /orders/:id/collected-by`; `send` and `approve` accept it |
| 28E Search | none | **gap, built:** `GET /attendant/search` |
| 28F My orders | `GET /orders?raisedBy` | **gap, built:** `GET /attendant/my-orders` (Needs you / Waiting, chip counts, search by supplier, item or LPO) |
| 28G, 28G2 History | `GET /orders?stage=CLOSED` (no dates, no pager) | **gap, built:** `GET /attendant/history` (from/to, status, search, pager, by month); column `closed_at` |
| 28H Returned | `GET /orders/:id`, `PATCH`, `submit` | covered, plus **built:** `POST /orders/:id/withdraw`. The per-line "asked for a change" flag has no data (section 5) |
| 28I Menu | counts only | **gap, built:** `GET /attendant/badges`. Nav rows belong to the front end |
| 28J Order, sent and overdue | `GET /orders/:id` | covered; the order now carries `collectedBy`, and the supplier card `phone` |
| 28K Order, awaiting | `GET /orders/:id` | covered, plus **built:** `POST /orders/:id/remind`, `withdraw`; `can.remind`, `can.withdraw` |
| 28L Order, closed | `GET /orders/:id` | covered: delivered value only, invoice, payments and money are null, documents are LPO and delivery note; the tracker's "disputed" note is now hidden from the Attendant |
| 28M Supplier | `GET /suppliers/:id` needs `suppliers.read` | **gap, built:** `GET /attendant/suppliers/:id` |
| 28N Notifications | none (the layer is push only) | **gap, built:** `GET /attendant/notifications`, `POST .../read`, `POST .../read-all`, the pushes, the 08:00 job |
| 28P Restock levels | `GET /inventory/restock-levels` is Store Manager only and numberless for the Attendant | **gap, built:** `GET /attendant/restock-levels` |
| 28Q States kit | none | front end only (copy table on the artboard) |

## 2. Endpoints (new or changed)

Access words: **read** = `orders.read`; **raise** = `orders.request`; **choose** = `orders.approve` or `orders.request`; **stock** = `orders.see_stock` or `restock.read`. Errors use the existing envelope; new codes are in section 3.

| Method and path (under `/inventory/purchasing`) | Access | Request | Response (`data`) |
|---|---|---|---|
| `GET /attendant/home` | read | none | `{ restock:{total,out,low}, needsYou: MyOrderRow[], myOrders:{rows (first 5),total,needYou}, approver:{id,name,role}\|null, badges, today }` |
| `GET /attendant/badges` | read | none | `{ receiving, restock, myOrders, unreadNotices }` |
| `GET /attendant/my-orders` | read | `filter=all\|needs\|waiting\|overdue`, `q` | `{ counts:{all,needs,waiting,overdue}, filter, needsYou[], waitingOnOthers[], approver }`; row = `OrderRowView` + `group` + `need: RETURNED\|SEND\|RECEIVE\|null` |
| `GET /attendant/history` | read | `from`, `to` (YYYY-MM-DD, default last 30 days, `to` max today), `status=all\|paid\|cancelled`, `q`, `raisedBy`, `page`, `pageSize` (20, max 100) | `{ range, summary:{allTime,inRange}, page, pageSize, total, months:[{key,label,rows:[{id,reference,supplier,itemCount,shortCount,value,valueKind:DELIVERED\|ORDERED,outcome:PAID\|CANCELLED,cancelReason,closedOn}]}] }` |
| `GET /attendant/search` | read | `q` (1 to 60) | `{ q, counts:{items,suppliers,orders}, items[] (status OUT\|LOW\|OK\|NO_LEVEL, onHand/level if stock, suggestedQty, supplier, onOpenOrder), suppliers[] (openOrderCount,itemCount), orders[] (status,stage,dueLabel,expectedDate,closedOn,itemCount) }` |
| `GET /attendant/suppliers/:id` | read | none | `{ supplier:{id,name,code,category,contactName,phone,whatsapp,status}, openOrder: OrderRowView\|null, items[] (price,status,onHand?,level?,suggestedQty,onOpenOrder), lowCount }` |
| `GET /attendant/restock-levels` | stock | `status=OUT\|LOW\|OK`, `supplierId`, `q`, `page`, `pageSize` | `{ counts:{all,out,low,ok}, page, pageSize, total, suppliers[], rows:[{inventoryItemId,name,status,onHand,level,usageUnit,fill(0..1),supplier}], setBy }` |
| `GET /attendant/notifications` | read | `filter=all\|unread\|needs` | `{ counts:{all,unread,needsMe}, groups:[{label,day,notices:[{key,type,at,orderId,reference,supplierName,itemCount,title,body,action,unread}]}] }` (counts ignore the chip) |
| `POST /attendant/notifications/read` | read | `{ keys: string[1..200] }` | 204 |
| `POST /attendant/notifications/read-all` | read | none | `{ marked }` |
| `POST /restock-list/review` | raise | `{ lines:[{inventoryItemId,qty,supplierId?}] }` | `{ groups:[{supplier,orderNumber,itemCount,estimatedTotal,openOrder,problem:null\|SUPPLIER_ORDER_OPEN\|ITEM_SETUP_INCOMPLETE,lines[]}], unsupplied[], orderCount, estimatedTotal, approver }` |
| `POST /restock-list/send` | raise | same plus `note` | `{ sent:[{supplier,order:OrderView}], failed:[{supplier,code,message,orderId}], unsupplied[] }`: one order per supplier, each sent for approval (not approved); a failed supplier does not stop the others |
| `GET /collectors` | choose | `q` | `{ carriers:[{id,name,kind}] (active only), staff:[{id,name,role}] (hub, active) }` |
| `PUT /orders/:id/collected-by` | choose | `{ collectedBy: Collected \| null }` | `OrderView`; only while APPROVED or SENT; audited |
| `POST /orders/:id/send` (changed) | choose | `{ via, collectedBy? }` | `OrderView`; "Mark as sent" is `via: MANUAL`; only the first send takes `collectedBy` |
| `POST /orders/:id/approve` (changed) | `orders.approve` | `{ pin, collectedBy? }` | `OrderView` ("Set by Joseph") |
| `POST /orders/:id/withdraw` | raise | none | `OrderView`; raiser only, AWAITING_APPROVAL or RETURNED, no PIN, becomes CANCELLED with reason `WITHDRAWN` |
| `POST /orders/:id/remind` | raise | none | `OrderView`; raiser only, AWAITING_APPROVAL, push to the Store Manager, once per 4 hours |
| `GET /needs-restocking`, `GET /catalog` (changed) | as before | | `onHand` and `level` now present for the Attendant |

`Collected` = `{kind:'SUPPLIER_DELIVERS'}` \| `{kind:'CARRIER',carrierId}` \| `{kind:'STAFF',userId}` \| `{kind:'OTHER',name}`. Order list and detail reads also gain `collectedBy`, `can.withdraw`, `can.remind`, `can.setCollectedBy` and `supplier.phone`.

**The new field.** `OrderView.collectedBy = { kind, label, summary, carrierId, userId, setBy:{id,name,role}\|null, setAt }` or `null`. Show "Sent, collected by {label}" (`summary` is "collected by X" or "supplier delivers"). Columns on `purchase_orders`: `collected_by_kind`, `_carrier_id`, `_user_id`, `_name`, `_set_by_id`, `_set_at`. A vehicle carries no driver name. The picker is Purchasing only.

## 3. Migration, access row, errors

One migration: the `PurchaseCollectedByKind` enum; the six collected-by columns; `closed_at` on orders (backfilled from the last invoice payment); `PurchaseCancelReason.WITHDRAWN`; table `purchasing_notice_reads (user_id, notice_key, read_at)`. Applied on the lane database only. One access row: `orders.see_stock` (Store Attendant, Store Manager, System Admin; it opens on-hand and reorder level on Purchasing screens only, nothing else; names mirrored in `frontend/features/inventory/_shared/lib/capabilities.ts`). New error codes: `COLLECTOR_NOT_FOUND` 422, `REMINDER_TOO_SOON` 409 (`details.lastRemindedAt`), `DATE_RANGE_INVALID` 422.

## 4. Notification rows (added to the map; Paper's map page has none for Purchasing and I did not edit it)

Sent through the one layer (`_shared/notify.ts`, new audience `users`). The Notifications screen is derived from the orders (the layer stores no inbox); only "opened" marks are stored, per person, 30-day window.

| # | What happened | Who is told | How | Wording |
|---|---|---|---|---|
| 21b | An order is sent for approval | nobody | badge nudge only | |
| 22 | Approved | the person who raised it (not if they approved their own) | push; Home and Notifications | "Joseph (Store Manager) approved LPO-0045 to Kagumo. Ready to send." Button Print or share while still approved |
| 23 | Returned | the raiser | push; button Edit and resend | "Joseph (Store Manager) sent LPO-0048 back: "note"" |
| 24 | Delivery due today (sent order) | the hub's Store Attendants | 08:00 Nairobi job; button Receive delivery | "Delivery due today" |
| 25 | Overdue (first day, then the list shows days late) | the hub's Store Attendants | 08:00 job; button Call supplier | "1 day overdue" |
| 26 | Closed (paid in full) | the raiser | push; no figure | "LPO-0040 to Kagumo is paid in full." |
| 27 | Reminder | the hub's Store Manager | push | "Amina (Store Attendant) is waiting for you to approve LPO-0047." |

## 5. Where Paper is silent (safest default taken; each is a one-line change)

- **Returned line flag** (28H "Joseph asked for a change" under Carrots): the return carries one note and the Store Manager's return drawer draws no per-line flag, so there is no data. Recommend: a later `flaggedLineIds` on `return` when the drawer is drawn. Until then the screen shows the note only.
- **Withdraw** is not signed: no PIN, no reason asked. Recommend keeping it.
- **Remind** repeats at most every 4 hours per order (`REMINDER_GAP_HOURS`).
- **My orders** = orders the caller raised that are awaiting approval, returned, approved or sent. Drafts are not shown (a draft still holds the supplier's slot: `SUPPLIER_ORDER_OPEN` carries its id). A delivery due or late needs every Attendant, so Home's "Needs you now" also lists other people's due deliveries; My orders does not.
- **Needs you** = returned, approved (send it), sent with a delivery date today or earlier. An approved order that is late gets no overdue notice (the supplier has not been told).
- **History** covers every closed or cancelled order, newest first, dated by the day it closed (`closed_at`) or was cancelled; `raisedBy` narrows it. Status options are All, Paid, Cancelled (a withdrawn order is Cancelled, `cancelReason: WITHDRAWN`). Header "46 orders · Last 30 days: 12" is `summary.allTime` and `summary.inRange`; the pager's "of 46" is `total`, which follows the filters. Recommend the screen shows `total` in the pager only.
- **Units:** on hand, level and `fill` are in the item's usage unit; `suggestedQty` is whole buy units. Paper shows one unit; they differ only for items bought in a pack of more than one.
- **Staff picker** lists the hub's active staff of any role; carriers are the active Carriers list.
- **Restock levels** lists items with a Central Store level above zero (items with none are not shown; levels are set in Catalog).
- **Replying to a returned order** is `PATCH attendantNote` then `submit` (two calls); the reply replaces the first note.
- Fixed on the way: "due today" and "overdue" now count Nairobi days (they counted UTC days, three hours late); the order list search also matches an item name.
- Not mine: the five nav rows (`nav-table.ts`), the front-end type mirror of the new fields, the Paper map page rows above.
