# purchasing (front-end, live API)

**Status (6 Oct 2026, Step 4 of the Central Store go-live):** the screens run on the real back-end at `/inventory/purchasing` (built in Step 3). The in-browser mock, its scenarios, the System Admin demo bar, the "Demo data" banners and the demo "view as a role" are deleted. Built to the approved Paper designs; **the owner approves screen by screen** (see "Awaiting approval" below).

Design: Paper "Inventory · Purchasing" (`p-3-0`). Rules: `docs/features/inventory/purchasing-mock/backend-rules.md`. Wire shapes: `docs/API_CONTRACT.md` §31 and §31.9 (where the live API differs from the first design). Back-end: `backend/src/modules/inventory/purchasing/`.

## Routes (under `/app/inventory/`)
| Route | Screen |
|---|---|
| `purchasing?tab=needs\|approval\|receive\|invoice\|pay\|closed` | Purchasing, six stage tabs. Whoever can `orders.request` but not `orders.approve` (the Store Attendant in the access table) gets Restock, To receive and My orders instead |
| `purchasing/new` (`?supplier=&lines=`, `?edit=`) | New order; also edits a draft or a returned order |
| `purchasing/[orderId]` | The purchase file in every state; the invoice, payment, void, reverse, settle and add-document drawers open over it. Closed: Documents first and the audit log on the right |
| `purchasing-print/[orderId]` | Printed LPO (standalone, A4; no prices, total or amount in words) |
| `purchasing-print/payment/[paymentId]` | Printed payment advice (A4) |
| `purchasing-print/statement/[supplierId]?from=&to=` | Printed supplier statement (A4) |
| `receiving` | redirects to the To receive tab |
| `receiving/[orderId]` | Receive a delivery, two steps (phone first): quantities and the price on the delivery note, then the note number, its photo and your PIN |
| `suppliers/[id]` (existing page) | Orders tab, Statement tab and the "What we owe" card read `GET /suppliers/:id/orders` and `/statement` by the supplier's real id |
| `audit-log` (existing page) | "Purchasing and payments" view reads `GET /inventory/audit-log?area=PURCHASING\|PAYMENTS`; each row links to its purchase file; `?q=LPO-0044` opens it searching |

## How it is built
- `services/purchasing-service.ts` is the one interface the screens use. `services/purchasing-api-service.ts` implements it over HTTP (the shared `apiClient`, plus `fetch` for the multipart upload and the 204 discard). `hooks/use-purchasing.ts` supplies it and bumps a version counter after every write (done or refused), so every open list and file reloads.
- Screens never import the API client or the HTTP service; `service-boundary.test.ts` fails if one does, or if the mock, demo bar or demo role come back.
- **Access is the server's table**, read with `usePermissions()` and each order's own `can`; no role names. Two separate rules for money: item prices and order totals follow `catalog.see_costs` (the Store Attendant has it); invoices, payments, due labels, the money strip and the supplier statement follow `payables.read` and are never sent to the Attendant. Stock figures (`onHand`, `level`) are left out for a caller without `restock.read`; the types mark them optional.
- Refusals arrive as `ApiError` with the server's plain message and a `code`; use `isPurchasingError(e, code)` and `errorDetails(e)` from `types/` (`SUPPLIER_ORDER_OPEN` links to the open order, `DUPLICATE_INVOICE_NUMBER` offers "it is a different invoice", `PAYMENT_EXCEEDS_BALANCE` resends with `confirmOverpay`, `INVALID_PIN` shows under the PIN boxes).
- Receive: each line sends `{lineId, receivedQty, deliveredPrice, priceConfirmed}`. A price typed that differs from the order's must be confirmed before Next; receiving nothing at all is blocked ("cancel the order instead"); the PIN is 4 digits.
- Uploads go to `POST /uploads`; the upload problem states of Paper `35` are in `components/photo-slot.tsx`. "View" on a document or the delivery-note photo asks `GET /uploads/:id/url` for a short-lived link (local dev storage is in memory and returns a `memory://` link that a browser cannot open; production storage returns a real one).

## Tests
`services/purchasing-service.contract.test.ts` (every operation of the HTTP service against mocked `fetch` answers shaped like §31 and §31.9, plus refusals), `components/screens/next-step.test.ts` (each next-step button follows the order's `can`), `service-boundary.test.ts` (the boundary above; the old payables code stays deleted). The business rules are tested in the back-end module.

## Gaps logged for the back-end (not built)
- "Download all documents" on a closed file (the button is removed): needs an endpoint that zips the purchase file.
- The receive and payment screens keep their client-side checks as well as the server's.

## Awaiting approval (owner, screen by screen)
Purchasing six tabs; New order; the purchase file (every state); Receive (the new typed-price field is not in Paper: it sits under each quantity stepper); the Attendant's Restock / To receive / My orders (now shows item prices and order totals); invoice, payment, reverse, void and settle drawers; the three prints; supplier Orders and Statement tabs; audit log view. Narrow windows (under about 950px) squeeze the item name column on the purchase file's delivered state; a desktop width is fine.

## Coupling
Reads `_shared` (shell, states kit, permissions, phone parts) and `components/ui2`. The supplier page (`suppliers/components/supplier-purchasing-tabs.tsx`, `supplier-page-screen.tsx`) and the audit log screen import from here.

## Decisions
Q-01 to Q-13 answered 4 Oct 2026; Q-14 and Q-15 on 5 Oct 2026 (payments need no approval; a voided invoice stays on the statement, struck through). Paying more than is owed is blocked on screen as Paper draws it; the API keeps `confirmOverpay` (Q-16, the client decides).
