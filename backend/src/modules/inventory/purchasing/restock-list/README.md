# purchasing / restock-list

**Design:** approved (Paper 28B and 28C) · **Code:** built and tested (11 Oct 2026) · **Wire shapes:** `docs/features/inventory/purchasing-attendant-api.md`.

"Review your list" and "Send for approval" on the Attendant's phone: the restock list (items and quantities the person picked) grouped by supplier, one order each.

| Endpoint (under `/inventory/purchasing`) | Access | What |
|---|---|---|
| `POST /restock-list/review` | `orders.request` | groups the list by supplier, with a total, anything that would stop a group, the items nobody sells us, and the approver |
| `POST /restock-list/send` | `orders.request` | makes and submits one order per supplier (`ordersService.create` then `submit`); a supplier that cannot be ordered from is in `failed`, the rest are still sent |

## Rules
- Each item goes to its default supplier (the item's preferred one, else the cheapest by last price) unless the line names a supplier that sells it. Items with no supplier are `unsupplied`, never ordered. A supplier on hold or archived counts as not selling.
- A group is flagged `SUPPLIER_ORDER_OPEN` when the supplier already has an open order (one open order per supplier) or `ITEM_SETUP_INCOMPLETE` when a line was never priced; `send` reports the real error from `ordersService` for it.
- Orders are sent for approval, never approved here. The note is the order's `attendantNote`. Prices are the supplier's last price (nobody types one here).
- Not atomic across suppliers: each is its own transaction. A draft saved but not sent shows its id in `failed.orderId`.
- The review hides money from a caller blind to item prices.

Code: `restock-list-routes|controller|service|repository|validators.ts`, `restock-list-logic.ts` (pure), `restock-list.types.ts`, `restock-list.test.ts`; the database path is covered in `../attendant/attendant.db.test.ts`.
