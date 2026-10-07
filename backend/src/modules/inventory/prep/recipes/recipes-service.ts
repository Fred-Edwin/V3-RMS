import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { ConflictError, NotFoundError, UnprocessableEntityError, ValidationError } from '../../../../utils/errors';
import { actorCan, requireHubActor, requireHubReader } from '../../_shared/central-store-access';
import { expectedYieldFor, pastRunsExpected } from '../_shared/expected-yield';
import type { RecipeDetail, RecipeInput, RecipeRow, RecipesQuery } from '../_shared/prep-contract';
import { recipesRepository, type PreppedItem, type RecipeWithNewest } from './recipes-repository';
import type { RecipesList } from './recipes.types';
import { costPerUnitOf, ingredientsTextOf, nairobiDayText, personOf, sameRecipe } from './recipes-view';

type Actor = NonNullable<Request['user']>;

const DAY_MS = 24 * 60 * 60 * 1000;
const CHANGED_WINDOW_DAYS = 30;

const iso = (d: Date): string => d.toISOString();

/** A PREPPED item of the site, or 404. A retired item is still found (its recipe history stays readable). */
const requirePreppedItem = async (siteId: string, itemId: string): Promise<PreppedItem> => {
  const item = await recipesRepository.findItem(siteId, itemId);
  if (!item || item.type !== 'PREPPED') throw new NotFoundError('That item is not a prepped item', 'NOT_FOUND');
  return item;
};

const rowOf = (item: { id: string; name: string; usageUnit: string }, recipe: RecipeWithNewest | undefined, pastRunsAverageText: string | null): RecipeRow => {
  const version = recipe?.versions[0];
  if (!recipe || !version) return { itemId: item.id, itemName: item.name, unit: item.usageUnit, recipe: null, pastRunsAverageText };
  return {
    itemId: item.id,
    itemName: item.name,
    unit: item.usageUnit,
    recipe: {
      ingredientsText: ingredientsTextOf(version.lines),
      targetYield: version.targetYield.toString(),
      mainItemName: version.lines.find((l) => l.isMain)?.inputItem.name ?? '',
      version: version.version,
      lastChangedAt: iso(version.createdAt),
      lastChangedBy: personOf(version.createdBy),
    },
    pastRunsAverageText: null,
  };
};

/** "about 3 kg": the mean of the recent RECORDED runs of an output with no recipe, or null with none. */
const pastRunsTextFor = async (siteId: string, item: { id: string; usageUnit: string }, now: Date): Promise<string | null> => {
  const runs = await recipesRepository.recordedRuns(siteId, item.id);
  const average = pastRunsExpected(runs, now);
  return average === null ? null : expectedYieldFor(average, item.usageUnit, 'RECIPE').text;
};

/** The Recipe detail every caller with `prep.read` gets; the cost per unit only with `prep.see_costs`. */
const detailOf = async (actor: Actor, siteId: string, item: PreppedItem): Promise<RecipeDetail> => {
  const recipe = await recipesRepository.findRecipe(siteId, item.id);
  const version = recipe?.versions[0] ?? null;
  const base: RecipeDetail = {
    itemId: item.id,
    itemName: item.name,
    unit: item.usageUnit,
    current: null,
    suggestFromLastRun: null,
    history: [],
  };

  if (!recipe || !version) {
    const last = await recipesRepository.lastRecordedRun(siteId, item.id);
    return {
      ...base,
      suggestFromLastRun: last
        ? {
            lines: last.inputLines.map((l) => ({ itemId: l.inputItemId, itemName: l.inputItem.name, unit: l.inputItem.usageUnit, amount: l.quantity.toString() })),
            made: last.actualYield.toString(),
            basedOn: `last run, ${nairobiDayText(last.createdAt)}${last.reference ? ` (${last.reference})` : ''}`,
          }
        : null,
    };
  }

  const versions = await recipesRepository.versionsOf(siteId, recipe.id);
  const detail: RecipeDetail = {
    ...base,
    current: {
      version: version.version,
      targetYield: version.targetYield.toString(),
      lines: version.lines.map((l) => ({ itemId: l.inputItemId, itemName: l.inputItem.name, unit: l.inputItem.usageUnit, amount: l.amount.toString(), isMain: l.isMain })),
      changedAt: iso(version.createdAt),
      changedBy: personOf(version.createdBy),
      reason: version.reason,
    },
    history: versions.map((v) => ({ version: v.version, at: iso(v.createdAt), by: personOf(v.createdBy), reason: v.reason, reasonNote: v.reasonNote })),
  };
  if (actorCan(actor, 'prep.see_costs')) {
    const cost = costPerUnitOf(version.targetYield, version.lines);
    if (cost !== null) detail.costPerUnitNow = cost;
  }
  return detail;
};

const checkLines = (item: PreppedItem, input: RecipeInput): void => {
  const mains = input.lines.filter((l) => l.isMain).length;
  if (mains !== 1) throw new UnprocessableEntityError('Pick exactly one main ingredient', 'MAIN_INGREDIENT_REQUIRED');
  if (new Set(input.lines.map((l) => l.itemId)).size !== input.lines.length) {
    throw new UnprocessableEntityError('An ingredient appears twice', 'DUPLICATE_INPUT_LINE');
  }
  if (input.lines.some((l) => l.itemId === item.id)) {
    throw new UnprocessableEntityError('A recipe cannot use the item it makes', 'INPUT_IS_OUTPUT');
  }
};

/**
 * Usual recipes (API_CONTRACT.md §33.3 #1 to #3). One recipe per prepped item; every save writes a new immutable version
 * in one transaction, and the version rows are the change log the Audit log reads.
 */
export const recipesService = {
  /** #1: every live prepped item is a row, with or without a recipe. Filters apply to the rows; the counts do not. */
  list: async (actor: Actor, query: RecipesQuery, now: Date = new Date()): Promise<RecipesList> => {
    const siteId = await requireHubReader(actor);
    const items = await recipesRepository.listPreppedItems(siteId);
    const recipes = await recipesRepository.recipesForItems(siteId, items.map((i) => i.id));
    const recipeOf = new Map(recipes.map((r) => [r.outputItemId, r]));
    const withoutRecipe = items.filter((i) => !recipeOf.get(i.id)?.versions[0]).length;

    const term = query.search?.trim().toLowerCase() ?? '';
    const cutoff = now.getTime() - CHANGED_WINDOW_DAYS * DAY_MS;
    const matching = items.filter((item) => {
      const version = recipeOf.get(item.id)?.versions[0];
      if (query.show === 'has' && !version) return false;
      if (query.show === 'none' && version) return false;
      if (query.changed !== 'any') {
        if (!version) return false;
        const recent = version.createdAt.getTime() >= cutoff;
        if (query.changed === '30d' ? !recent : recent) return false;
      }
      if (term) {
        const names = [item.name, ...(version?.lines.map((l) => l.inputItem.name) ?? [])];
        if (!names.some((n) => n.toLowerCase().includes(term))) return false;
      }
      return true;
    });

    const pageItems = matching.slice((query.page - 1) * query.perPage, query.page * query.perPage);
    const rows = await Promise.all(
      pageItems.map(async (item) => {
        const recipe = recipeOf.get(item.id);
        const text = recipe?.versions[0] ? null : await pastRunsTextFor(siteId, item, now);
        return rowOf(item, recipe, text);
      }),
    );
    return { items: rows, total: matching.length, totalItems: items.length, withoutRecipe };
  },

  /** #2 */
  get: async (actor: Actor, itemId: string): Promise<RecipeDetail> => {
    const siteId = await requireHubReader(actor);
    const item = await requirePreppedItem(siteId, itemId);
    return detailOf(actor, siteId, item);
  },

  /**
   * #3: write the next version. Version 1 has no reason; from version 2 a reason is required, and a save that changes
   * nothing is refused. Two people saving at once cannot both take the same version number (unique index), so the second
   * gets a 409 and re-opens the drawer.
   */
  save: async (actor: Actor, itemId: string, input: RecipeInput): Promise<RecipeDetail> => {
    const siteId = await requireHubActor(actor);
    const item = await requirePreppedItem(siteId, itemId);
    if (item.deletedAt) throw new ConflictError('This item has been retired, so its recipe cannot change', 'ITEM_RETIRED');
    checkLines(item, input);

    const ids = input.lines.map((l) => l.itemId);
    const live = await recipesRepository.findLiveItems(siteId, ids);
    if (live.length !== ids.length) throw new ValidationError('One of the ingredients was not found or has been retired', 'INGREDIENT_NOT_FOUND');

    try {
      await prisma.$transaction(async (tx) => {
        const existing = await recipesRepository.findRecipeForUpdate(tx, siteId, itemId);
        const newest = existing?.versions[0];
        if (existing && newest) {
          if (sameRecipe(newest, input)) throw new UnprocessableEntityError('Nothing has changed since the last version', 'RECIPE_UNCHANGED');
          if (!input.reason) throw new UnprocessableEntityError('Say why the recipe changed', 'REASON_REQUIRED');
        }
        const recipeId = existing ? existing.id : (await recipesRepository.createRecipe(tx, { siteId, outputItemId: itemId })).id;
        const version = existing && newest ? newest.version + 1 : 1;
        const reason = version === 1 ? null : (input.reason ?? null);
        await recipesRepository.createVersion(tx, {
          siteId,
          recipeId,
          version,
          targetYield: input.targetYield,
          reason,
          reasonNote: reason === 'OTHER' ? input.reasonNote?.trim() || null : null,
          createdById: actor.id,
          lines: input.lines.map((l) => ({ inputItemId: l.itemId, amount: l.amount, isMain: l.isMain })),
        });
        if (existing) await recipesRepository.setCurrentVersion(tx, siteId, recipeId, version);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError('Someone else just changed this recipe. Open it again to see their version.', 'RECIPE_CHANGED_ELSEWHERE');
      }
      throw error;
    }
    return detailOf(actor, siteId, item);
  },
};
