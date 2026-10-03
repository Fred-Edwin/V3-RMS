# waste

**Design:** approved (Paper: *Stock and Counting*, chapter 5 "Waste during the day") · **Code:** built to the old flow, **pending redo**.

## Who can do what
- **Store Attendant**: log waste for several items, review, confirm; reverse **their own** entry the same day with a reason. Sees no costs or stock.
- **Store Manager**: log waste with values; reverse any entry.
- **Department Head / Branch**: log waste for their department (branch waste, Flow 13).

## Approved behaviour
- Pick items, quantity, reason chips (Expired, Spoiled, Damaged in store, Prep error); review sheet; stock changes only after confirm.
- A wrong entry is **reversed** with a reason; original and reversal both stay.
- Damage found after receiving is logged as waste (the only damage path).

## Built today vs approved
Old design: single item, no undo, unit cost shown to attendants. Redo adds multi-item logging with confirm summary, reversal, and removes costs from the attendant view.

## Endpoints
3 endpoints (generated from the route files; re-run if routes change).

| Method | Path | Roles |
|---|---|---|
| GET | `/inventory/waste/items` | STORE_MANAGER, STORE_ATTENDANT |
| GET | `/inventory/waste` | STORE_MANAGER, STORE_ATTENDANT |
| POST | `/inventory/waste` | STORE_MANAGER, STORE_ATTENDANT |

## Code map
`waste-controller.ts`, `waste-repository.ts`, `waste-routes.ts`, `waste-service.ts`, `waste-validators.ts`, `waste.types.ts`. 2 test files beside the code.

## Coupling
Uses `stock/stock-repository`, `_shared/stock-scope`, `catalog/inventory-repository`.
