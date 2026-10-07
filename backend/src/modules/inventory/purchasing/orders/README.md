# Purchasing · orders

The order from draft to cancelled-or-delivered: raise, approve, send. Receiving, invoices and payments continue on the same
order in `../receiving/` and `../payables/`. Rules: `docs/features/inventory/purchasing-mock/backend-rules.md` §1 to §3.
Plan: `docs/features/inventory/purchasing-plan.md`.

**Status:** built, tests green (6 Oct 2026). Not yet wired to the front end (step 4).

## Endpoints (under `/inventory/purchasing`)

| Route | Capability | What |
| --- | --- | --- |
| `GET /summary` | `orders.read` | tab counts, value awaiting approval, due to receive |
| `GET /orders` | `orders.read` | every order (read-only for all readers), `?stage&supplierId&raisedBy&q` |
| `GET /orders/:id` | `orders.read` | the purchase file: order, documents, activity |
| `GET /orders/:id/lpo` | `orders.read` | printed order data: **no prices, no total, no amount in words** |
| `GET /orders/:id/whatsapp` | `orders.approve` or `orders.request` | the WhatsApp text |
| `POST /orders`, `PATCH /orders/:id`, `DELETE /orders/:id` | `orders.request` | save draft, edit, discard a draft |
| `POST /orders/:id/submit` | `orders.request` | number it (LPO-nnnn) and send for approval |
| `POST /orders/:id/approve` | `orders.approve` | own PIN; an approver's own draft is approved straight away |
| `POST /orders/:id/return` | `orders.approve` | note required |
| `POST /orders/:id/send` | `orders.approve` or `orders.request` | WhatsApp, print, link, phoned in; a second send changes nothing |
| `POST /orders/:id/cancel` | `orders.cancel` | reason and own PIN; never after delivery |

## Rules worth knowing

- One open order (draft to sent) per supplier: checked in the service and held by a partial unique index.
- "Orderable" item = the supplier sells it with a price, or a person holding `orders.approve` types one; otherwise
  `ITEM_SETUP_INCOMPLETE`. (Owner may overrule; the catalog's "needs setup" rule matched 145 of 221 items.)
- The LPO number is given at submit, or at approval of an approver's own draft. A returned order keeps its number.
- Every status change is a guarded update (`from` statuses), so a lost race becomes `ORDER_WRONG_STATE`, not a double move.
- The audit row is written in the same transaction as the change.
- Blind rule: the Attendant sees item prices and order totals; `invoice`, `payments` and `money` are removed
  (`_shared/order-view.ts`, `blind-rule.ts`). No role names appear in this folder.
- Discarding a draft deletes it with its audit rows (it has no number and nothing was sent).
