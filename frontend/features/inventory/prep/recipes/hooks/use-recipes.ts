import { useCallback, useMemo } from 'react';

import { useAction, useLoader } from '../../../_shared/hooks/use-async';
import type { RecipeDetail, RecipeInput, RecipesList, RecipesQuery } from '../../_shared/types/prep-contract';
import { getRecipe, listRecipes, saveRecipe } from '../services/recipes-api-service';

export const RECIPES_PER_PAGE = 25;

/** The list for the current filters. `reload` is stable; a reload keeps the rows on screen. */
export function useRecipesList(query: RecipesQuery, enabled: boolean) {
  const { search, show, changed, page } = query;
  const key = enabled ? JSON.stringify([search, show, changed, page]) : null;
  const list = useLoader<RecipesList>(
    key,
    () => listRecipes({ search: search || undefined, show, changed, page, perPage: RECIPES_PER_PAGE }),
    'Couldn’t load the usual recipes.'
  );
  const items = useMemo(() => list.data?.items ?? [], [list.data]);
  return { items, data: list.data, status: list.status, error: list.error, reload: list.reload };
}

/** One recipe's detail, loaded when `itemId` is set (the drawer opens). */
export function useRecipeDetail(itemId: string | null, enabled = true) {
  const key = enabled && itemId ? `recipe:${itemId}` : null;
  const detail = useLoader<RecipeDetail>(key, () => getRecipe(itemId ?? ''), 'Couldn’t load this recipe.');
  return { detail: detail.data, status: detail.status, error: detail.error, reload: detail.reload };
}

/** Saving a recipe; the failure (with its error code) stays in `failure` so the drawer keeps what was typed. */
export function useSaveRecipe(itemId: string) {
  const save = useCallback((input: RecipeInput) => saveRecipe(itemId, input), [itemId]);
  return useAction(save, 'Not saved. Nothing changed. Try again.');
}
