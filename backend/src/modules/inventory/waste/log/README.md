# waste/log

**Design:** approved (Paper steps 16 to 18, 22) · **Code:** built to the contract (Stock, Counting and Waste rebuild, Back end B).

Logging waste at the Central Store: the item picker (W1) and logging one or several items as one batch (W2).

## Spec
- **W1 `GET /inventory/stock/waste/waste/items`** (`waste.log`). `often` = this caller's most logged items of the last 60 days (at most 6, retired items dropped); `items` = live hub items matching the search, by name. `unitCost` is the item's cost now, only with `catalog.see_costs`; `onHand` only with `restock.read`.
- **W2 `POST /inventory/stock/waste`** (`waste.log`). `requireHubActor`; the Central Store location from `locationRepository.findCentralStore()`. One `WasteBatch` per `idempotencyKey` (per site and caller): a repeated key returns the same entries with 200 and `replayed: true`; the unique index decides a race. In **one transaction**: one `WasteLog` per entry (`unitCost` = the item's cost now, the batch id, the shared note) and one WASTE ledger row each through `postStockMovement` (`links: { wasteLogId }`, positive quantity in, the door stores it negative). A retired item is `ITEM_RETIRED` (409); an unknown item is 404. Negative stock is allowed and flagged, never blocked: `wentNegative` and `totalValueKes` come back only to a caller who may see them.
- On a replay, `wentNegative` is worked out from the items' on-hand now, not from the moment of the first tap.
- Every response is built by `waste/_shared/waste-view.ts`. Waste is never signed with a PIN.

## Status
Built and tested: service (mocked repositories), the six-role grid on both routes, validation. Real-API walk: see `waste/README.md`.

## Endpoints
Paths are under `/api/v1`; the router is mounted by `waste-hub-routes.ts`.

| # | Method and path | Capability |
|---|---|---|
| W1 | `GET /inventory/stock/waste/items` | `waste.log` |
| W2 | `POST /inventory/stock/waste` | `waste.log` |

## Coupling
`stock/ledger/ledger-door` (`postStockMovement`), `stock/_shared/{stock-repository,nairobi-time}`, `_shared/central-store-access`, `_shared/blind-rule`, `repositories/location-repository`. Reads no other sub-module.
