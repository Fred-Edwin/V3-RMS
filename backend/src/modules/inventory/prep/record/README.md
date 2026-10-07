# prep / record

**Design:** approved (Paper: *Inventory · Prep*, steps 1-8, 35-41) · **Code:** built (Prep rebuild, Slice 2, 7 Oct 2026).

Recording a prep run: the Attendant's "Prep again" tiles, "Something else", the live yield check and the confirm. Spec: `docs/API_CONTRACT.md` §33.3 and §33.5; plan `docs/features/inventory/prep-plan.md` §3.3.

## Who can do what
Every route needs `prep.record` (Store Attendant, Store Manager, System Admin). The reads (#4, #5) resolve the site with `requireHubReader`; check and record with `requireHubActor`.
Blind rule in the answers: run costs only with `prep.see_costs`; stock figures only with `restock.read`; `NOTIFY` (over 35%) is shown as `WARN` to a caller without `prep.read_flags`. The silent stock flag and `needsLook` are never in an Attendant payload.

## Endpoints
| # | Method | Path | Notes |
|---|---|---|---|
| 4 | GET | `/inventory/prep/outputs` | every live PREPPED item, usual figure, last run |
| 5 | GET | `/inventory/prep/prep-again` | up to 3 tiles: most RECORDED runs in 30 days, topped up by most recent from all time |
| 6 | POST | `/inventory/prep/runs/check` | live check; writes nothing |
| 7 | POST | `/inventory/prep/runs` | 201 new, 200 replayed |

## How a run is recorded
One `prisma.$transaction`: read each input's on-hand from the ledger, judge the yield, number it `PREP-nnnn` (`ReferenceCounter`, prefix `PREP`), create the run and lines (`onHandAtRunTime` kept), post one `PREP_CONSUME` per input and one `PREP_PRODUCE` through `postStockMovement`, set the output item's `currentCost` to total input cost ÷ made.
- **Expected figure:** recipe scaling when the run uses the recipe's main ingredient (`prep-recipe-reader.ts`, a read-only helper; this module never imports `recipes/`), else the past-runs mean (`expected-yield.ts`), else none (the run is not judged).
- **needsLook:** the yield is off (over 15%) or an input exceeded stock. `yieldVarianceLabel` and `notifiedStoreManager` are still written for the old columns.
- **Idempotency:** same `(site, user, key)` returns the run (200). A race past the check is decided by the unique index (`P2002`, read, return).
- A typo or repeat warning never blocks and is not stored.
- 422 codes: `INPUT_IS_OUTPUT`, `DUPLICATE_INPUT_LINE`, `QUANTITY_NOT_POSITIVE`. `record-validators.ts` lets a zero amount past Zod so the service answers the contract's 422 rather than 400.

## Code map
`record-routes/controller/service/repository/validators.ts`, `record-logic.ts` (pure rules), `record.types.ts`. Shared: `../_shared/prep-run-repository.ts`, `prep-run-serializer.ts`, `prep-flags.ts`, `prep-recipe-reader.ts`, `prep-time.ts`. Tests: `record-logic.test.ts`, `record-service.test.ts`, `record-service.db.test.ts` (opt-in, `RUN_DB_TESTS=1` plus `DATABASE_URL`).

## Coupling
`stock/ledger` (the door), `stock/stock-repository` (on-hand), `_shared/central-store-access`, `_shared/blind-rule`, `_shared/reference-counter`.

## Deviations to know
- "Most-made" counts RECORDED runs only (a corrected original is not counted twice); the plan said "non-cancelled".
