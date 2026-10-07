# prep / recipes (Usual recipes)

**Design:** approved (Paper "Inventory · Prep", steps 24 to 27) · **Code:** back end built (Prep Slice 1); front end in `frontend/features/inventory/prep/recipes/`.

The usual recipe for each prepped item: target yield for one batch plus the ingredients, exactly one of them the main ingredient. Every save writes a new immutable version; the version rows are the change log.

## Who can do what
| Capability | Roles | Does |
|---|---|---|
| `prep.read` | Store Manager, System Admin, Accountant, Director, Branch Manager, Store Attendant | list and open recipes |
| `prep.see_costs` | all of the above except the Attendant | `costPerUnitNow` on the detail (key absent otherwise) |
| `prep.recipes_write` | Store Manager, System Admin | set and edit a recipe |

Reads resolve the site with `requireHubReader`, writes with `requireHubActor`. Every query carries the hub `siteId` (column `organization_id`). No `requireRole`.

## Endpoints (API_CONTRACT.md §33.3, mounted at `/inventory/prep`)
| # | Method, path | Cap | Notes |
|---|---|---|---|
| 1 | `GET /recipes` | `prep.read` | every live PREPPED item is a row; filters `search` (item or ingredient), `show`, `changed`; counts ignore the filters; `pastRunsAverageText` ("about 3 kg") for items with no recipe, from RECORDED runs |
| 2 | `GET /recipes/:itemId` | `prep.read` | 404 not prepped; `suggestFromLastRun` only when there is no recipe |
| 3 | `PUT /recipes/:itemId` | `prep.recipes_write` | writes the next version |

## Rules the service applies (PUT)
- Version 1 takes no reason (a reason sent is ignored). From version 2 a reason is required (`422 REASON_REQUIRED`); the note is kept only for `OTHER`.
- A save equal to the current version (same yield, same ingredients, amounts and main flag; order ignored) is `422 RECIPE_UNCHANGED`, checked before the reason.
- Exactly one main ingredient (`422 MAIN_INGREDIENT_REQUIRED`), no duplicate ingredient (`422 DUPLICATE_INPUT_LINE`), no ingredient equal to the output (`422 INPUT_IS_OUTPUT`). Unknown or retired ingredient: `400 INGREDIENT_NOT_FOUND`. Retired item: `409 ITEM_RETIRED`.
- Header, version and lines are written in one `prisma.$transaction`; `currentVersion` is bumped. Two saves racing for one version number hit the unique index and the second gets `409 RECIPE_CHANGED_ELSEWHERE`. The database also refuses a second main ingredient in a version (partial unique index).
- "Last changed by" and `history` come from the version rows. Scaling and wording come from `_shared/expected-yield.ts` (`pastRunsExpected`, `expectedYieldFor`, `formatAmount`).

## Audit log
`GET /inventory/audit-log` has area `PREP`: version 1 reads "Recipe set for X", version 2 and later "Recipe changed for X" with the reason (chip words, or the note for Other). Derived from the version rows, nothing extra is stored.

## Files
`recipes-routes.ts`, `recipes-controller.ts`, `recipes-service.ts`, `recipes-repository.ts`, `recipes-validators.ts` (re-exports the frozen contract), `recipes-view.ts` (pure text and comparison helpers), `recipes.types.ts`. Tests: service (mocked repo), routes (capability gate per role), contract and helpers, and `recipes.db.test.ts` (opt-in, `RUN_DB_TESTS=1` and `DATABASE_URL` from `backend/.env`).

## Coupling
Reads `prep_runs` (RECORDED runs only) for the past-runs average and "Use these". Read by the Audit log. The old Prep service is untouched.
