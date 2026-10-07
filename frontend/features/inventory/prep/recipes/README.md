# Prep / Usual recipes (front end)

**Status:** built against the frozen contract (API_CONTRACT.md section 33.3, endpoints 1 to 3) and checked in the browser with fixtures (the back end landed separately). Live walk against the real back end happens at integration.

## What the user does
- **List** (`/app/inventory/prep/recipes`, Paper step 24): every live prepped item, with its recipe, target yield, main ingredient and who last changed it. Search, Show (all / with / without a recipe), Changed (any / 30 days / older), "Clear filters", pager.
- **Edit drawer** (step 25) and **first recipe** (step 26, with "Use these" from `suggestFromLastRun`): target yield, ingredient rows with exactly one main ingredient, live scaling rows (half a batch, one batch, double), reason chips (required from the second version), Save disabled until valid.
- **Recipe line** (step 27): `RecipeLine`, read-only, shown on a prepped item's Catalog page; exported through `features/inventory/prep/index.ts`.

## Access
- Read: `prep.read`. Write controls (Edit, Set, "Set a recipe", the drawer): `prep.recipes_write` only. Cost line in the drawer: only when the payload carries `costPerUnitNow` (`prep.see_costs`). The list has no costs.

## Files
- `components/`: `recipes-screen` (container), `recipes-list-view` (pure body), `recipes-table`, `recipe-drawer`, `scaling-panel`, `amount-stepper`, `recipe-line`.
- `hooks/use-recipes.ts`, `hooks/use-ingredient-options.ts`; `services/recipes-api-service.ts`.
- `lib/recipe-scaling.ts` (front-end copy of `scaleRecipe`, pinned by `_shared/lib/expected-yield.cases.json`), `lib/recipe-form.ts` (validation, one-main rule, request body, error mapping), `lib/recipes-states-copy.ts` (the one copy table for step 42), `lib/press.ts` (press feedback classes).
- Types come from `_shared/types/prep-contract.ts` (frozen mirror).

## Rules worth knowing
- Scaling rows are `targetYield x used / mainAmount` rounded to 2 dp, shown whole for portions and one decimal for kg and L. Same cases as the back end.
- Errors: `RECIPE_UNCHANGED` shows under the form, `REASON_REQUIRED` under the chips, `MAIN_INGREDIENT_REQUIRED` under the ingredients; anything else shows "Not saved. Nothing changed. Try again." and the form keeps what was typed.
- Motion: press feedback scale(0.97), 150ms ease-out, transform only; the drawer uses the Catalog drawer curve (300ms in, 200ms out); nothing animates on typing or on the scaling rows.

## Coupling
- Imports the Catalog's `DrawerHost`, the stock states kit, `usePermissions`, and `listItems` (ingredient picker, up to 500 items) from the same feature.
- The Catalog item page imports `RecipeLine` from `@/features/inventory/prep` only.
