# prep

**Design:** approved (Paper: *Inventory · Prep*) · **Code:** rebuilt (Prep rebuild, 7 Oct 2026, branch `feat/prep-rebuild`). Chapter 9 (manager on tablet and phone) was parked by the owner: the manager screens are desktop-first.

Design record and reasons: `docs/features/inventory/prep-plan.md` (kept because code comments cite its sections). Contract as built: `docs/API_CONTRACT.md` §33 and `_shared/prep-contract.ts`.

Prep turns raw ingredients into the portions branches order. Recorded **after the fact**: output item, inputs actually used, actual yield. A recorded run is never edited: a slip is **corrected** (the old run becomes Corrected, a new numbered run replaces it) or **cancelled**, by reversing the ledger rows, never by editing them.

## Sub-modules
| Folder | Endpoints | What it does |
|---|---|---|
| [`recipes/`](recipes/README.md) | #1-3 | Usual recipes: list, detail, save a new immutable version |
| [`record/`](record/README.md) | #4-7 | Outputs, Prep-again tiles, live check, record a run (idempotent, numbered `PREP-nnnn`) |
| [`runs/`](runs/README.md) | #8, #9, #10 | Run list, summary, run detail (blind per role) |
| [`fix/`](fix/README.md) | #11-13 | Correct, cancel, cancel preview; the 24-hour rule |
| [`review/`](review/README.md) | #14-17 | Needs a look, its count (sidebar badge), Mark reviewed, CSV export |
| `_shared/` | | The frozen contract, `expected-yield.ts` (scaling and judging), `prep-constants.ts`, flags, run repository and serializer, recipe reader |

Front end: `frontend/features/inventory/prep/` mirrors this (each sub-module has its own README with its Paper parity table).

## Rules worth knowing
- **Judging a run:** recipe scaling when the run uses the recipe's main ingredient, else the mean of the last 10 recorded runs (or those in the last 30 days, whichever gives fewer), else not judged. 15% off warns; 35% off also sets the in-app flag. A typo or repeat warning never blocks and is not stored. A repeat means the same output with the same amounts within the last 2 hours (owner decision).
- **Ledger:** every movement goes through `postStockMovement`. A reversal keeps the original row's type with the opposite sign, once per row (`stock/README.md`).
- **Output cost:** a new run, or a correction of the latest recorded run of that output, sets the output item's cost; a cancel never changes it.
- **Idempotency:** record and correct carry a key; the same `(site, user, key)` returns the same run.

## Who can do what
Seven `prep.*` capabilities in `_shared/central-store-access.ts` (`_shared/prep-access.test.ts` pins the grid). No `requireRole` in any Prep route. Costs need `prep.see_costs`, flags and Needs a look need `prep.read_flags` (never the Attendant), stock figures need `restock.read`; the serializer strips them per role. No PIN anywhere in Prep.

## Running the database tests
The `*.db.test.ts` files (opt-in) commit real rows and reset the shared `PREP` counter, so run them **one file at a time** against a local database: `cd backend && RUN_DB_TESTS=1 pnpm exec vitest run --no-file-parallelism src/modules/inventory/prep src/modules/inventory/stock` (with `DATABASE_URL` from `backend/.env`). Run in parallel they trample each other and can leave stray runs behind.

## Coupling
`stock/ledger` (every movement), `stock/stock-repository` (on-hand), `_shared/reference-counter` (run numbers), the audit log (area `PREP`), the Catalog item page (recipe line), the shell sidebar (Prep sub-links and the Needs a look badge).
