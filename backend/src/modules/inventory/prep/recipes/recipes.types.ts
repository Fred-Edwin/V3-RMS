export type { Person, RecipeDetail, RecipeInput, RecipeReason, RecipeRow, RecipesQuery } from '../_shared/prep-contract';

import type { RecipeRow } from '../_shared/prep-contract';

/** `GET /inventory/prep/recipes` response (the contract's `recipesListSchema`). */
export interface RecipesList {
  items: RecipeRow[];
  total: number;
  totalItems: number;
  withoutRecipe: number;
}
