/**
 * Usual recipes: API_CONTRACT.md section 33.3, endpoints 1 to 3. Reads the access token like the other inventory services.
 */
import { apiClient } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';
import type { RecipeDetail, RecipeInput, RecipesList, RecipesQuery } from '../../_shared/types/prep-contract';

const token = (): string | undefined => useAuthStore.getState().accessToken ?? undefined;

export function toQueryString(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

const base = '/inventory/prep/recipes';

export const listRecipes = (query: RecipesQuery = {}): Promise<RecipesList> => apiClient.get<RecipesList>(`${base}${toQueryString(query)}`, token());

export const getRecipe = (itemId: string): Promise<RecipeDetail> => apiClient.get<RecipeDetail>(`${base}/${itemId}`, token());

/** Writes a new immutable version. 422 `RECIPE_UNCHANGED` / `REASON_REQUIRED` / `MAIN_INGREDIENT_REQUIRED`; 409 item retired. */
export const saveRecipe = (itemId: string, input: RecipeInput): Promise<RecipeDetail> => apiClient.put<RecipeDetail>(`${base}/${itemId}`, input, token());
