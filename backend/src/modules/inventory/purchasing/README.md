# purchasing

**Design:** approved (Paper: *Purchasing*, 10 chapters). **Back-end:** built and tested (6 Oct 2026), mounted at `/inventory/purchasing`. **Front end:** still the mock-data build; Step 4 swaps it for this API. Rules: `docs/features/inventory/purchasing-mock/backend-rules.md`. Plan: `docs/features/inventory/purchasing-plan.md`.

## The flow
Need → order (LPO) → approval → send → delivery → invoice → payment → closed. One purchase = one **purchase file** (`PurchaseOrder` and everything hanging off it: lines, delivery, invoices, payments, documents, audit rows). Nothing is deleted once an order is submitted: cancel, void and reverse add a linked row with a reason.

## Map of the six folders
| Folder | What it does |
|---|---|
| `needs-restocking/` | The "we're running low" list grouped by supplier, and the supplier catalog the order form picks from. |
| `orders/` | List, summary, the purchase file, the LPO print (no prices), WhatsApp text; create, edit, discard, submit, approve, return, send, cancel. |
| `receiving/` | `POST /orders/:id/receive`: the delivery, the typed price, the PIN, stock through the ledger door, supplier price and item cost. |
| `payables/` | Deposits, the invoice (variance, duplicate warning), dispute settle, void, payments, reversal (approver PIN), payment advice, extra documents. |
| `supplier-account/` | `GET /suppliers/:id/orders` (with the owing card) and `GET /suppliers/:id/statement` (ageing, `?format=csv`), plus the new-table reads the Suppliers module uses. |
| `files/` | Upload and signed view of delivery notes, invoices and proofs of payment. |
| `_shared/` | One order shape and blind rule (`order-view.ts`), money maths, pin check, audit writer, order state machine, supplier-line matcher, amount in words. |

`purchasing-routes.ts` mounts the six routers under `/inventory/purchasing`. Each router authenticates and gates by capability (`requireCapability`) from `_shared/central-store-access.ts`; never add a `requireRole(...)` list here.

## Rules that matter
- **Blind rule:** the Attendant sees item prices and order totals but no invoice, payments or money; `order-view.ts` is the only place that strips them.
- **Stock:** receiving posts every line through `postStockMovement` with `purchaseDeliveryLineId`. Never write the ledger directly.
- **Reference numbers** (`LPO`, `GRN`, `PAY`) come from `../_shared/reference-counter.ts`, gap-free.
- **PINs:** an order is signed with the user's own PIN; a payment reversal needs a Store Manager or System Admin PIN.
- Receiving with nothing received is refused (cancel the order instead). A non-approver's typed order price is ignored.

## Status
Done: all six folders, the Suppliers module reads the new tables, old receiving, goods-receipt, invoice and payment code and tables removed. Open: the PIN go-live check (production has few PINs set), the front-end swap (Step 4).
