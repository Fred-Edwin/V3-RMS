# counting / print

**Design:** approved (Paper: *Inventory · Counting redesign (Oct 7)*, steps 43 blank sheet, 44 count record) · **Code:** built.

## Endpoints (base `/api/v1/inventory/stock`)
| # | Method | Path | Cap | Notes |
|---|---|---|---|---|
| C6 | GET | `/counts/:id/print` | `counts.read` | the printed record of a signed count: differences and what was decided, both signatures, "This copy is for the Manager and shows expected stock". 409 `COUNT_NOT_OPEN` for a count still being counted |
| C7 | GET | `/counts/blank-sheet` | `counts.read` or `counts.record` | every section with items in shelf order, item and unit only, no stock figure of any kind. Runs `adoptNewItems` first |

C6 carries expected stock, so the Attendant gets 403 on it; C7 is safe for them. `/counts/blank-sheet` is registered before `/counts/:id/print`.

## Code map
`print-routes/controller/service/repository/validators.ts`, `print.types.ts`. The page data is built by `../_shared/count-view.ts` (`buildRecordPrint`, `buildBlankSheet`): one builder for every count response.

## Tests
`../_shared/count-view.test.ts` (record, signatures, footnote, blank sheet has no figure key), `../counting-routes.test.ts` (role grid), `../counts/counts.db.test.ts` (opt-in: the blank sheet and the record run on real data).

## Coupling
`../_shared/` (count-view, count-sections, count-record-repository, count-errors), `../../_shared/central-store-access`.
