# purchasing

**Design:** approved (Paper: *Purchasing*, 10 chapters from "We're running low" to "When things go wrong") · **Code:** **partly on the old flow, pending redo** (verified in the running app 2026-10-03: *New purchase* is still a "shopping list, not a purchase order" with a PAR column; no LPO approval, advance payment or supplier statement as designed). Receiving, orders (LPO) and supplier invoices/payments are one flow and one sub-module.

## The flow
Need → LPO → approval → send → delivery → invoice → payment → closed. One purchase = one **purchase file** holding every document.

## Who can do what
- **Store Manager**: raises and approves orders (PIN); self-authorises; records invoices and payments; receives.
- **Store Attendant**: raises order requests from Low/Out only (phone), receives deliveries. **No** access to money, AP or stock figures.
- **Accountant**: raises orders, pays deposits and suppliers, owns the *To pay* queue and the supplier statement.

## To do in the redo: order permissions
The one access table (`_shared/central-store-access.ts`) has no capability for purchase orders yet, so the endpoints below still use their old role lists. In the redo, add `orders.request` (attendant and Accountant send an order for approval), `orders.approve`, `orders.cancel` and `orders.receive`, and move these routes onto `requireCapability(...)`. The System Admin holds all of them and signs with their own PIN; the Branch Manager and Director write nothing. Source: `docs/features/inventory/purchasing-design-check.md`.

## Approved behaviour
- Needs-restocking page (grouped by supplier, or list by item); select lines → create one order per supplier.
- Orders: Awaiting approval, To receive, To pay tabs. Approve = PIN. Print/Share/Copy link marks **Sent**; "Mark as sent" covers phone orders.
- Printed LPO shows the supplier's item names and codes first, "Our item" second.
- Advance payment after approval (25/50/100% shortcuts), applied to the invoice automatically.
- Receive delivery on the phone in two steps (check goods; delivery note and PIN). Not-supplied lines are dropped but stay on record. Price change on delivery shows an alert that must be confirmed.
- One invoice per order; a disputed invoice (variance) can be settled; payment records method and reference (e.g. Cheque number); a payment advice is printable.
- Supplier statement of account: period, opening balance, transactions with running balance, ageing, PDF/CSV.
- Tables use the no-fill header style; Receiving history for attendants omits money.

## Built today
Receiving and the purchasing hub/history exist at `/inventory/purchasing/*` and `/inventory/receiving/*`; supplier AP lives in the same service. The 1,528-line `receiving-service` mixes receiving, orders and AP. Two sidebar links (Receiving, Purchasing) remain from the old milestone split; the approved design is one flow.

## Endpoints
17 endpoints (generated from the route files; re-run if routes change).

| Method | Path | Roles |
|---|---|---|
| GET | `/inventory/purchasing/summary` | STORE_MANAGER, ACCOUNTANT, DIRECTOR |
| GET | `/inventory/purchasing/history` | STORE_MANAGER, ACCOUNTANT, DIRECTOR |
| GET | `/inventory/receiving/history` | STORE_MANAGER, STORE_ATTENDANT, ACCOUNTANT, DIRECTOR |
| GET | `/inventory/expected-deliveries` | STORE_MANAGER, STORE_ATTENDANT, ACCOUNTANT, DIRECTOR |
| GET | `/inventory/expected-deliveries/:id` | STORE_MANAGER, STORE_ATTENDANT, ACCOUNTANT, DIRECTOR |
| GET | `/inventory/expected-deliveries/:id/supplier-document` | STORE_MANAGER |
| POST | `/inventory/expected-deliveries` | STORE_MANAGER |
| POST | `/inventory/expected-deliveries/:id/cancel` | STORE_MANAGER |
| GET | `/inventory/items/:id/last-price` | STORE_MANAGER, STORE_ATTENDANT, ACCOUNTANT, DIRECTOR |
| GET | `/inventory/goods-receipts` | STORE_MANAGER, STORE_ATTENDANT |
| GET | `/inventory/goods-receipts/:id` | STORE_MANAGER, STORE_ATTENDANT |
| POST | `/inventory/goods-receipts` | STORE_MANAGER, STORE_ATTENDANT |
| PATCH | `/inventory/goods-receipts/:id` | STORE_MANAGER, STORE_ATTENDANT |
| POST | `/inventory/goods-receipts/:id/sign` | STORE_MANAGER, STORE_ATTENDANT |
| GET | `/inventory/ap/summary` | STORE_MANAGER, ACCOUNTANT, DIRECTOR |
| GET | `/inventory/ap/suppliers` | STORE_MANAGER, ACCOUNTANT, DIRECTOR |
| GET | `/inventory/ap/suppliers/:id` | STORE_MANAGER, ACCOUNTANT, DIRECTOR |

## Code map
`purchase-documents.ts`, `receiving-controller.ts`, `receiving-cost.ts`, `receiving-repository.ts`, `receiving-routes.ts`, `receiving-service.ts`, `receiving-validators.ts`, `receiving.types.ts`. 4 test files beside the code.

## Coupling
`receiving-repository` is imported by suppliers, counting, dispatch (2 files) and branch-day (it also serves ledger reads). Uses `suppliers/supplier-*`, `catalog/inventory-repository`. Split service into receiving / orders / AP at the next purchasing change.
