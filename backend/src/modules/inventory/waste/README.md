# waste

**Design:** approved (Paper: *Inventory · Counting redesign (Oct 7)*, steps 16 to 23) · **Code:** rebuilt to the frozen contract (Stock, Counting and Waste rebuild, Back end B).

Waste at the Central Store (`log/`, `entries/`, `reverse/`), and a branch's departments' waste (`branch/`, Block 3). The two never mix: a branch entry sits on the branch's `siteId` at a department location, a Central Store entry on the hub's.

## Sub-modules
| Folder | What | Endpoints | README |
|---|---|---|---|
| `log/` | the item picker, log one or several items as a batch | W1, W2 | [log](log/README.md) |
| `entries/` | the list with its KPI strip | W3 | [entries](entries/README.md) |
| `reverse/` | reverse an entry | W4 | [reverse](reverse/README.md) |
| `branch/` | a branch's departments log and reverse waste; the Branch Manager and the hub roles read it. Replaced the old `department/` (three endpoints under `/inventory/waste`), now deleted. Under `/inventory/branch-waste` | BW1 to BW7 | [branch](branch/README.md) |
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

## Coupling
`stock/ledger/ledger-door`, `stock/_shared/{stock-repository,nairobi-time,person}`, `_shared/{central-store-access,blind-rule,wire}`, `repositories/location-repository`. `branch/` also uses `deliveries/deliveries-repository` (`ensureDepartmentLocation`); see its README. The Audit log reads `waste_logs` for both areas (`WASTE`, `BRANCH_WASTE`).
