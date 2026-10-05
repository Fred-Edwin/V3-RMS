# purchasing (front-end, mock data)

**Status (5 Oct 2026):** Session 1 of 2 built. The flow from need to delivery works end to end on **mock data kept in the browser**; nothing calls the real API or writes to the database. The client has not approved the flow or who does what, so the back-end waits (see `docs/features/inventory/decisions.md`, "One screen set, mock first").

Design: Paper "Inventory · Purchasing" (`p-3-0`). Rules: `docs/features/inventory/purchasing-mock/backend-rules.md`. Screens and tick-off: `…/screen-inventory.md`. Wire shapes: `docs/API_CONTRACT.md` §31.

## Routes (under `/app/inventory/`)
| Route | Screen |
|---|---|
| `purchasing?tab=needs\|approval\|receive\|invoice\|pay\|closed` | Purchasing, six stage tabs. Needs restocking (grouped or by item), Awaiting approval, To receive are built; Awaiting invoice, To pay, Closed list orders and wait for Session 2's screens |
| `purchasing/new` (`?supplier=&lines=`, `?edit=`) | New order; also edits a draft or a returned order |
| `purchasing/[orderId]` | The purchase file in every state |
| `purchasing-print/[orderId]` | Printed LPO (standalone, A4) |
| `receiving` | redirects to the To receive tab |
| `receiving/[orderId]` | Receive a delivery, two steps (phone first) |

## How it is built
- `services/purchasing-service.ts` is the one interface screens use. `hooks/use-purchasing.ts` supplies it (today the in-browser mock, acting as the effective role). The back-end session swaps the body of that hook.
- `mock/engine.ts` holds the business rules as pure functions; `mock/fixtures.ts` is the whole world (curated from the real catalog and suppliers once; never read at runtime); `mock/scenarios.ts` builds demo states by running the engine; `mock/store.ts` keeps state in `localStorage` (version key, try/catch); `mock/mock-service.ts` binds them to the interface.
- Access follows the one permissions table (`orders.*`, `payables.record_deposit`, read via `orders.read`); screens use `usePermissions()` and `order.can`, never role names. A System Admin sees a **demo bar** (view as a role, load a scenario); it never logs in as anyone. Every mock screen carries the "Demo data" banner.
- Tests: `mock/engine.test.ts` (rules), `services/purchasing-service.contract.test.ts` (per operation, against the interface, so it can be pointed at the real back-end).

## Demo PIN
`1234`. Anything else shows the wrong-PIN state.

## Coupling
Reads `_shared` (shell, states kit, permissions, phone parts) and `components/ui2`. Does not touch `suppliers/legacy-payables/` (Session 2 replaces it).

## Open (asked, defaults applied, see backend-rules.md)
Q-01 to Q-13 were answered with the recommended defaults on 4 Oct 2026. Not in Paper and built from existing patterns: the More menu, editing a returned order, receive on desktop, the PIN dialog, "Create several orders" (creates one draft each), the "No supplier yet" row (cannot be ticked until a supplier with a price is chosen).
