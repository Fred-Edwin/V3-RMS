# waste

**Design:** approved (Paper: *Inventory · Counting redesign (Oct 7)*, steps 16 to 23) · **Code:** rebuilt to the frozen contract (Stock, Counting and Waste rebuild, Back end B).

Waste at the Central Store, plus the Department Head's branch waste (unchanged).

## Sub-modules
| Folder | What | Endpoints | README |
|---|---|---|---|
| `log/` | the item picker, log one or several items as a batch | W1, W2 | [log](log/README.md) |
| `entries/` | the list with its KPI strip | W3 | [entries](entries/README.md) |
| `reverse/` | reverse an entry | W4 | [reverse](reverse/README.md) |
| `department/` | the Department Head's branch waste, **moved unchanged**; replaced by `branch/` in Block 3 | 3 old endpoints | below |
| `branch/` | a branch's departments log and reverse waste; the Branch Manager and the hub roles read it (Block 3; contract only so far, a placeholder router) | BW1 to BW7 | [branch](branch/README.md) |
| `_shared/` | the frozen contract, `waste-view` (builds every response), `waste-rules` (who may reverse, who sees only their own), `waste-row` | none | this file |

## Who can do what
- **Store Manager, System Admin**: log, read every entry, reverse any entry.
- **Store Attendant**: logs, reads **only their own entries** (a capability test: they hold `waste.read` but not `stock.read`), reverses their own entry on the **same Nairobi day**. Sees item cost, never a stock figure: no on-hand, no "went negative", no waste KPIs.
- **Accountant, Director, Branch Manager**: read every entry; no writes.
- **Waste is never signed with a PIN** (owner, 8 Oct 2026). Negative stock from waste is allowed and flagged (to those who may see stock), never blocked.

## Endpoints
All under `/api/v1/inventory/stock/waste`, mounted by `waste-hub-routes.ts`.

| # | Method and path | Capability |
|---|---|---|
| W1 | `GET /items` | `waste.log` |
| W2 | `POST /` | `waste.log` |
| W3 | `GET /` | `waste.read` (Attendant: own only) |
| W4 | `POST /:id/reverse` | `waste.reverse_any`, or `waste.reverse_own` + the same-day rule |

## Rules that hold across the folders
- One `WasteBatch` per `idempotencyKey`; one `WasteLog` and one WASTE ledger row per entry, all written through `postStockMovement` in one transaction.
- A reversed entry keeps its original row and ledger row; a linked reversing row returns the stock, and the entry reads `REVERSED` and counts for nothing in the KPIs.
- `waste/_shared/waste-view.ts` decides every response; there is no `isAttendant` check anywhere.

## `department/` (the Department Head's branch waste)
The three old endpoints (`GET /inventory/waste/items`, `GET` and `POST /inventory/waste`), their service, repository, validators, types and tests, moved here unchanged (only relative import paths changed, and `stockRepository` now comes from `stock/_shared/stock-repository`). Still mounted from `routes/index.ts`. The old files' Central Store role allowance (`STORE_MANAGER`, `STORE_ATTENDANT` through `resolveWasteScope`) is part of "unchanged"; the rebuilt Central Store waste is the `/inventory/stock/waste` routes. Delete this folder when branch waste is redone.

## Coupling
`stock/ledger/ledger-door`, `stock/_shared/{stock-repository,nairobi-time,person}`, `_shared/{central-store-access,blind-rule,wire}`, `repositories/location-repository`. Reads no other sub-module.
