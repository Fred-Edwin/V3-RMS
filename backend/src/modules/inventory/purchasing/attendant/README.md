# purchasing / attendant

**Design:** approved (Paper chapter 9, steps 28A to 28Q) · **Code:** built and tested (11 Oct 2026) · **Wire shapes and the gap table:** `docs/features/inventory/purchasing-attendant-api.md` (the contract; read it first).

The reads behind the Store Attendant's Purchasing phone. Nothing here changes an order: writes are in `../orders/` and `../restock-list/`. The routes are for anyone holding `orders.read` (a Store Manager can call them too); what each caller sees follows the blind rule, not the role.

## What it does
| Endpoint (under `/inventory/purchasing`) | Screen |
|---|---|
| `GET /attendant/home` | 28A: restock card, Needs you now, my open orders, the approver, the badges |
| `GET /attendant/badges` | 28I: Receiving, Restock list, My orders counts and the bell |
| `GET /attendant/my-orders` | 28F |
| `GET /attendant/history` | 28G, 28G2 (from and to, status, search, pager) |
| `GET /attendant/search` | 28E |
| `GET /attendant/suppliers/:id` | 28M |
| `GET /attendant/restock-levels` | 28P (needs `orders.see_stock` or `restock.read`) |
| `GET /attendant/notifications`, `POST .../read`, `POST .../read-all` | 28N |

## Rules worth knowing
- **Needs you** (`attendant-logic.ts` `needOf`): returned, approved (send it), or sent with a delivery date today or earlier. Everything else waits on someone else. My orders are the caller's own (drafts are not shown); a delivery due is every Attendant's, so Home also lists other people's.
- **Never an invoice or payment figure.** History reads a lighter select (`HISTORY_SELECT`: lines and the delivered total, nothing of invoices or payments); order rows go through `order-view.ts`.
- **Stock figures** (on hand, level) appear for `restock.read` or `orders.see_stock` only. Suggested quantity is level minus on hand in whole buy units, from the default supplier (`defaultBuy`).
- **Dates are Nairobi days** (`count-time.ts`). History is dated by `closed_at` (paid in full) or the cancel time; the migration back-filled `closed_at`.
- **Notifications are derived**, not stored: events on the orders the caller raised (returned, approved, closed) plus deliveries due and overdue for anyone who may receive; 30-day window. Only "opened" marks are stored (`purchasing_notice_reads`, key `TYPE:orderId`, a return adds the time). The pushes are in `../_shared/purchasing-notify.ts`; the 08:00 job is `due-notices.ts` (registered in `jobs/purchasing-due-jobs.ts`).

## Code map
`attendant-routes|controller|service|repository|validators.ts`, `attendant.types.ts`, `attendant-logic.ts` (pure rules), `due-notices.ts`. Tests beside: `attendant-logic.test.ts`, `attendant-service.test.ts`, `due-notices.test.ts`, and the opt-in `attendant.db.test.ts` (`RUN_DB_TESTS=1`, lane database, one file at a time).

## Coupling
Reads `orders/orders-repository` (lists, counts), `needs-restocking` (the list, stock, supplier lines, default supplier), `restock/restock-suggestion`, `counting/_shared/count-time` (Nairobi days), `_shared/order-view`. `restock-list/` imports this folder's repository and logic.
