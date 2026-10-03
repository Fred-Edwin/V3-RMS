# stock

**Design:** approved (Paper: *Stock and Counting*, chapters 5–6) · **Code:** built to the old flow, **pending redo**.

Where stock is and where it went: the stock position, the **Stock ledger** (one row per item with opening, in, sent out, Prep use, waste, adjusted, closing) and the **Stock card** per item.

## Who can do what
- **Store Manager** (and Branch Manager, Department Head within their scope): see values. **Accountant/Director** views wait for their shells.
- **Store Attendant**: no on-hand, no ledger, no values anywhere (server-enforced; waste hint shows no stock).

## Approved behaviour
- Ledger landing: filters date range (quick picks + two-month calendar), section, "Had adjustments", "Had waste", "Negative stock only", search by item or reference (ADJ-3402, CNT-2026-1013). Footer "Showing x of y"; export.
- Stock card: opening-to-closing strip, one row per day with source reference (ADJ, DSP, GRN), "By day" grouping; opening a day shows its entries. Quiet periods collapse.
- The ledger is never edited; a correction is a new linked entry.
- No all-items Journal (dropped 1 Oct 2026); the Audit log covers who/when/why.
- Strips: hub (items tracked, low or out, negative, today's count), all-items (tracked, low/out, negative, on-hand value).

## Built today vs approved
Built in Milestone Six (stock hub, all items, ledger, hub KPI strip) to the older design. Gaps to close in the redo: ledger summary view with the opening→closing columns, Stock card, date picker with quick picks, "Had waste"/"Had adjustments" chips, attendant stripped of figures.

## Endpoints
3 endpoints (generated from the route files; re-run if routes change).

| Method | Path | Roles |
|---|---|---|
| GET | `/inventory/stock` | STORE_MANAGER |
| GET | `/inventory/stock/summary` | STORE_MANAGER, STORE_ATTENDANT |
| GET | `/inventory/stock/items/:itemId/ledger` | STORE_MANAGER, MANAGER |

## Code map
`stock-controller.ts`, `stock-repository.ts`, `stock-routes.ts`, `stock-service.ts`, `stock-validators.ts`, `stock.types.ts`. 1 test files beside the code.

## Coupling
Uses `_shared/stock-scope`, `catalog/inventory-repository`, `counting/count-service`, `counting/count-calc`.
