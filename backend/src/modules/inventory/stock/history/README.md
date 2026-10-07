# stock/history

**Design:** approved (Paper steps 28 and 29) · **Code:** built to the contract (Back end B).

The Stock ledger (S3), its CSV export (S4) and one item's Stock card (S5): the history of movements at the Central Store. This folder is the screens' history; `stock/ledger/` (the door that posts movements) is a different thing and is not touched.

## Spec
- **Period.** `from` and `to` are Nairobi days, both default to the last 30 days ending today; one given alone fixes the other. A date after today is `DATE_IN_FUTURE`, `to` before `from` is `RANGE_INVALID` (both 400). The period is `[start of from, end of to)` in Nairobi time.
- **S3 `GET /inventory/stock/ledger`**: per item, `opening` = Σ quantity of every ledger row before the start of `from`; `closing` = Σ up to the end of `to`. By type, signed, inside the period: `in` = RECEIVE + PREP_PRODUCE + DISPATCH_IN (+ MARKET_RECEIVE), `sentOut` = DISPATCH_OUT (+ SALE), `prepUse` = PREP_CONSUME, `waste` = WASTE, `adjusted` = ADJUSTMENT. Every type is in exactly one column, so **each row adds up by construction**; a reversal row is the same type with the opposite sign, so it nets in its own column (a reversed waste entry shows 0 in Waste). Rows are items with a movement in the period or a non-zero opening. Filters: `search` (item name, or a reference), `sectionId`, `chip` = `all` / `adjustments` / `waste` / `negative` (closing < 0), with the counts of all four in `chips`; numbered pager (25/50/100), by name. `note` = "made in Prep" for a PREPPED item produced in the period.
- **Money.** Every movement is valued at the **ledger row's own `unit_cost`** (the cost in force then); `closingValueKes` = Σ quantity × unit cost to the end of `to`. The KPI strip is Opening value, In, Out (sentOut + prepUse + waste), Closing, with the adjusted amount in the closing caption. Each cell is rounded to whole shillings and the adjusted amount absorbs the rounding, so "510,200 + 214,600 − 239,000 − 3,400 = 482,400" always holds on screen. **All items (S2) values stock at the current cost** (latest-price costing, `decisions.md`), so the two screens can differ for the same item: that is by design.
- **References.** `stock/_shared/movement-reference.ts` is the one function that turns a ledger row into reference text: `ADJ-nnnn` (the row's own number), `CNT-…` (through `count_line_id`, shown as the adjustment's source), `GRN-…` (through the delivery line), `PREP-…` (through the prep run), and for a dispatch its `sequenceLabel` (it has no persistent number; needs-doc N11). Search finds an item by any of them within the period.
- **S4 `GET /inventory/stock/ledger/export`**: the same query as S3, CSV, every row, at most 10,000 (413 `EXPORT_TOO_LARGE`). Registered before `/ledger/:itemId`. A name that starts like a formula is written as text.
- **S5 `GET /inventory/stock/ledger/:itemId`**: `show=byDay` (a row per day with a movement, newest first: the 5 most recent and one folded "earlier period" row for the rest, N12) or `show=entries` (every entry, unpaged, newest first). `chip=adjustmentsOnly` keeps the days with an adjustment. `strip` = the period totals; `lastCounted` and `sectionName` come from Counting's read functions; a reversed entry carries `reversed: true` and its reversal reads "Reversal of …". Each day, and the folded row, adds up.
- Money fields go through `withoutStockCosts` (`catalog.see_costs`); every holder of `stock.read` also holds it today.

## Status
Built and tested: pure calculations, service (mocked repository), the six-role grid, query validation, and the SQL against the dev database (`history-repository.db.test.ts`, `RUN_DB_TESTS=1`).

## Endpoints
| # | Method and path | Capability |
|---|---|---|
| S3 | `GET /inventory/stock/ledger` | `stock.read` |
| S4 | `GET /inventory/stock/ledger/export` | `stock.read` |
| S5 | `GET /inventory/stock/ledger/:itemId` | `stock.read` |

## Coupling
- `counting/_shared/count-reads` (`lastCountedByItem`, `sectionNamesByItem`) for the card.
- **One exception, flagged:** the `sectionId` filter needs "which items sit in this section", which none of Counting's five read functions gives. `history-repository.ts` therefore reads `count_section_items` directly in an `EXISTS`. It imports nothing from Counting. If Counting adds an `itemsInSection` read function, switch to it.
- `stock/_shared/{nairobi-time,movement-reference,stock-text,stock-status,stock-view,stock-contract}`, `_shared/central-store-access`.
