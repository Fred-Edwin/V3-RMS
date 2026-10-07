import { z } from 'zod';

/**
 * Request schemas for Usual recipes (API_CONTRACT.md §33.3 #1 to #3). The shapes are the frozen contract's; this file only
 * re-exports them and adds the path parameter.
 */
export {
  recipesQuerySchema,
  recipeInputSchema,
  recipeRowSchema,
  recipesListSchema,
  recipeDetailSchema,
  recipeReasonSchema,
} from '../_shared/prep-contract';

export const recipeItemParamSchema = z.object({ itemId: z.string().uuid() });
