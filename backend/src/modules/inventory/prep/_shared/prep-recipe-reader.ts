import { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';

type Client = typeof prisma | Prisma.TransactionClient;

/**
 * Read-only view of a usual recipe, owned by Record a run so it never imports the `recipes/` module (Slice 1 builds that in
 * parallel). It reads the current version and lines of `prep_recipes` for `(siteId, outputItemId)` and nothing else.
 */
export type PrepRecipeRead = {
  versionId: string;
  version: number;
  targetYield: Prisma.Decimal;
  lines: {
    inputItemId: string;
    itemName: string;
    unit: string;
    amount: Prisma.Decimal;
    isMain: boolean;
  }[];
};

const versionInclude = {
  lines: {
    orderBy: { lineOrder: 'asc' },
    include: { inputItem: { select: { name: true, usageUnit: true } } },
  },
} satisfies Prisma.PrepRecipeVersionInclude;

type RecipeWithVersions = Prisma.PrepRecipeGetPayload<{
  include: { versions: { include: typeof versionInclude } };
}>;

const toRead = (recipe: RecipeWithVersions): PrepRecipeRead | null => {
  const current = recipe.versions[0];
  if (!current) return null;
  return {
    versionId: current.id,
    version: current.version,
    targetYield: current.targetYield,
    lines: current.lines.map((line) => ({
      inputItemId: line.inputItemId,
      itemName: line.inputItem.name,
      unit: line.inputItem.usageUnit,
      amount: line.amount,
      isMain: line.isMain,
    })),
  };
};

const recipeInclude = {
  versions: { orderBy: { version: 'desc' }, take: 1, include: versionInclude },
} satisfies Prisma.PrepRecipeInclude;

export const prepRecipeReader = {
  /** The current version of one output item's recipe, or null when it has none yet. */
  readCurrent: async (siteId: string, outputItemId: string, client: Client = prisma): Promise<PrepRecipeRead | null> => {
    const recipe = await client.prepRecipe.findFirst({ where: { siteId, outputItemId }, include: recipeInclude });
    return recipe ? toRead(recipe) : null;
  },

  /** The current recipe of each given output item (items without one are absent from the map). */
  readCurrentForItems: async (siteId: string, outputItemIds: string[], client: Client = prisma): Promise<Map<string, PrepRecipeRead>> => {
    const result = new Map<string, PrepRecipeRead>();
    if (outputItemIds.length === 0) return result;
    const recipes = await client.prepRecipe.findMany({ where: { siteId, outputItemId: { in: outputItemIds } }, include: recipeInclude });
    for (const recipe of recipes) {
      const read = toRead(recipe);
      if (read) result.set(recipe.outputItemId, read);
    }
    return result;
  },
};
