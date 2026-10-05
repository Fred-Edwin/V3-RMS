# purchasing (front-end, mock data)

**Status (5 Oct 2026):** Sessions 1 and 2 built, so the mock is **complete**: need, order, approval, send, advance, receive, invoice, dispute, payment, closed file, supplier orders and statement, audit log, the Attendant's phone views and every exception. It all runs on **mock data kept in the browser**; nothing calls the real API or writes to the database. The client has not approved the flow or who does what, so the back-end waits (see `docs/features/inventory/decisions.md`, "One screen set, mock first"). Next: the client demo, then feedback, then the back-end session.

Design: Paper "Inventory · Purchasing" (`p-3-0`). Rules: `docs/features/inventory/purchasing-mock/backend-rules.md`. Screens and tick-off: `…/screen-inventory.md`. Demo walkthrough: `…/demo-script.md`. Wire shapes: `docs/API_CONTRACT.md` §31.

## Routes (under `/app/inventory/`)
| Route | Screen |
|---|---|
| `purchasing?tab=needs\|approval\|receive\|invoice\|pay\|closed` | Purchasing, six stage tabs. The Attendant (no `orders.read`) gets the phone layout instead: Restock, To receive, My orders |
| `purchasing/new` (`?supplier=&lines=`, `?edit=`) | New order; also edits a draft or a returned order |
| `purchasing/[orderId]` | The purchase file in every state; the invoice, payment, void, reverse, settle and add-document drawers open over it. Closed: Documents first and the audit log on the right |
| `purchasing-print/[orderId]` | Printed LPO (standalone, A4) |
| `purchasing-print/payment/[paymentId]` | Printed payment advice (A4), bank or cheque |
| `purchasing-print/statement/[supplierId]?from=&to=` | Printed supplier statement (A4) |
| `receiving` | redirects to the To receive tab |
| `receiving/[orderId]` | Receive a delivery, two steps (phone first) |
| `suppliers/[id]` (existing page) | Orders tab, Statement tab and the "What we owe" card read this mock |
| `audit-log` (existing page) | "Purchasing and payments" view reads this mock; `?q=LPO-0044` opens it searching |

## How it is built
- `services/purchasing-service.ts` is the one interface screens use. `hooks/use-purchasing.ts` supplies it (today the in-browser mock, acting as the effective role). The back-end session swaps the body of that hook.
- `mock/engine.ts` holds the business rules as pure functions; `mock/fixtures.ts` is the whole world (curated from the real catalog and suppliers once; never read at runtime); `mock/scenarios.ts` builds 17 demo states by running the engine (`journey` helper); `mock/store.ts` keeps state in `localStorage` (version key, try/catch; bump `STATE_VERSION` when the shape changes); `mock/mock-service.ts` binds them to the interface.
- Access follows the one permissions table (`orders.*`, `payables.*`, `audit.read`); screens use `usePermissions()` and `order.can`, never role names. A System Admin sees a **demo bar** (view as a role, load a scenario; folds to a tab on a phone) on Purchasing, Receiving, the supplier page and the audit log; it never logs in as anyone. Every mock screen carries the "Demo data" banner.
- Real supplier pages use real ids; `hooks/use-supplier-purchasing.ts` matches a real supplier to its demo supplier by name. A supplier with no match shows empty orders and statement.
- Money is hidden from the Attendant everywhere (Q-02): prices, totals, invoices, payments.
- The upload problem states of Paper `35` (uploading, could not upload, file too large) are in `components/photo-slot.tsx` and used by every photo. A file whose name contains "fail" fails once so the retry can be shown.

## Tests
`mock/engine.test.ts` and `mock/engine.payables.test.ts` (every rule), `services/purchasing-service.contract.test.ts` (every operation against the interface, so it can be pointed at the real back-end), `components/screens/next-step.test.ts` (the key action of each flow shows only for the roles that hold the capability), `mock-isolation.test.ts` (no purchasing screen imports a real API service; the old payables code stays deleted).

## Demo PIN
`1234`. Anything else shows the wrong-PIN state. It signs for whoever acts; a reversal takes a Store Manager's PIN.

## Coupling
Reads `_shared` (shell, states kit, permissions, phone parts) and `components/ui2`. The supplier page (`suppliers/components/supplier-purchasing-tabs.tsx`, `supplier-page-screen.tsx`) and the audit log screen import from here.

## Decisions taken while building (see backend-rules.md for the full list)
Q-01 to Q-13 answered 4 Oct 2026. Q-14 (payments need no approval; the advice prints "Prepared by" only) and Q-15 (a voided invoice stays on the statement, struck through) answered 5 Oct 2026. Paying more than is owed is blocked on screen as Paper draws it; the contract keeps `confirmOverpay` for the client to decide (Q-16).
