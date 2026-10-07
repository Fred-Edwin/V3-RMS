# prep

**Design:** approved (Paper: *Inventory · Prep*) · **Code:** rebuild in progress. Slice 0 (contract, schema, capabilities, ledger reversal) and Slice 2 (Record a run, run list and detail) are built; recipes (Slice 1), fix (3) and oversight (4) follow.

Plan and frozen contract: `docs/features/inventory/prep-plan.md`, `docs/API_CONTRACT.md` §33, `_shared/prep-contract.ts`. Approved wording and mistake/fix tables: [DESIGN-NOTES.md](DESIGN-NOTES.md) (still true for Slices 3-5; **delete it in Slice 5**).

Prep turns raw ingredients into the portions branches order. Recorded **after the fact**: output item, inputs actually used, actual yield.

## Sub-modules
| Folder | Endpoints | Status |
|---|---|---|
| [`record/`](record/README.md) | #4-7 outputs, prep-again, check, record | built (Slice 2) |
| [`runs/`](runs/README.md) | #8 list, #10 detail | built (Slice 2); #9 is Slice 4 |
| `recipes/` | #1-3 | Slice 1 |
| `fix/` | #11-13 | Slice 3 |
| `review/` | #9, #14-17 | Slice 4 |
| `_shared/` | the frozen contract, `expected-yield.ts`, `prep-constants.ts`, flags, run repository and serializer, recipe reader | |

The old five endpoints (`GET /summary`, `GET /items/:id/typical-yield`, and the old runs routes) are gone; `GET /runs`, `GET /runs/:id` and `POST /runs` now answer in the new shapes.

## Who can do what
Seven `prep.*` capabilities in `_shared/central-store-access.ts` (`prep-access.test.ts` pins the grid). No `requireRole` in any Prep route; costs, flags and stock figures are stripped per role in the serializer (`_shared/blind-rule.ts`). No PIN anywhere in Prep.

## Coupling
`stock/ledger` (every movement through `postStockMovement`), `stock/stock-repository`, `_shared/reference-counter`.
