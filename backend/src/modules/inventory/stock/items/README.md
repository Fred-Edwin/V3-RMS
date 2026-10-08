# stock/items

**Design:** approved (Paper step 27) · **Code:** built to the contract (Back end B).

All items (S2): every live item of the hub with what the Central Store holds.

## Spec
- **S2 `GET /inventory/stock/items`** (`stock.read`), query `search` (as you type), `status=all|low|negative`, `categoryId` (the category or its children), `type`, `departmentTag`, `sectionId`, `page`, `pageSize` (25/50/100, default 50). Sorted by name.
- `onHand` = Σ ledger quantity at the Central Store; `restockLevel` from the Central Store's `RestockLevel`. Status (`stock/_shared/stock-status.ts`): `NEGATIVE` (< 0), `OUT` (= 0 with a level set), `LOW` (0 < on hand < level), else `OK`. The chip "Low or out" is LOW + OUT.
- `valueKes` = on hand × the item's **current cost** (latest-price costing, `decisions.md`). The Stock ledger values each movement at its own cost, so the two screens can differ for the same item.
- KPI strip: Items tracked (live items, all three types, "N sections" from Counting), Low or out, Negative stock, On-hand value. It covers the whole store; `chips` follow the filters, and the pager total follows the chip chosen.
- `lastCountedAt` / `sectionName` come from Counting's read functions; "Never counted" when there is none. Money goes through `withoutStockCosts` (`catalog.see_costs`).

## Status
Built and tested: service, the six-role grid, query validation, and the SQL against the dev database (`items-repository.db.test.ts`, `RUN_DB_TESTS=1`).

## Endpoints
| # | Method and path | Capability |
|---|---|---|
| S2 | `GET /inventory/stock/items` | `stock.read` |

## Coupling
`counting/_shared/count-reads` (`lastCountedByItem`, `sectionNamesByItem`, `itemIdsInSection`). The `sectionId` filter is resolved by the service into item ids through `itemIdsInSection`, and the repository filters `i.id IN (…)`; Stock reads no Counting table. `stock/_shared/*`.
